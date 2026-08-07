import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
	default: {
		review: { findMany: vi.fn() },
		indexRun: { findMany: vi.fn() },
		organization: { findMany: vi.fn() },
		user: { findMany: vi.fn() },
		notification: { create: vi.fn(), findFirst: vi.fn() },
	},
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}));

vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/email", () => ({
	sendEmail: vi.fn().mockResolvedValue({ id: "email-1" }),
}));

vi.mock("@/lib/webhooks", () => ({
	sendSlackWebhook: vi.fn().mockResolvedValue({ success: true }),
	sendDiscordWebhook: vi.fn().mockResolvedValue({ success: true }),
	postWebhookWithTimeout: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

import prisma from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendSlackWebhook } from "@/lib/webhooks";
import {
	getVerifyMetrics,
	getIndexingMetrics,
	runMetricsAlertCheck,
} from "@/modules/admin/actions/metrics";

const mockPrisma = prisma as unknown as {
	review: { findMany: ReturnType<typeof vi.fn> };
	indexRun: { findMany: ReturnType<typeof vi.fn> };
	organization: { findMany: ReturnType<typeof vi.fn> };
	user: { findMany: ReturnType<typeof vi.fn> };
	notification: {
		create: ReturnType<typeof vi.fn>;
		findFirst: ReturnType<typeof vi.fn>;
	};
};

// The auth mock lives in the vi.mock factory; re-import to grab the fn.
import { auth } from "@/lib/auth";
const mockAuthSession = auth.api.getSession as unknown as ReturnType<
	typeof vi.fn
>;
const mockSendEmail = sendEmail as unknown as ReturnType<typeof vi.fn>;
const mockSendSlack = sendSlackWebhook as unknown as ReturnType<typeof vi.fn>;

const adminSession = { user: { id: "admin-1", role: "admin" } };
const userSession = { user: { id: "user-1", role: "user" } };

describe("admin metric actions (Spec 0006)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getVerifyMetrics", () => {
		it("requires an admin session", async () => {
			mockAuthSession.mockResolvedValue(userSession);

			await expect(getVerifyMetrics()).rejects.toThrow(
				"Admin access required"
			);
		});

		it("aggregates suggestions JSON into verify metrics (AC-1)", async () => {
			mockAuthSession.mockResolvedValue(adminSession);
			mockPrisma.review.findMany.mockResolvedValueOnce([
				{
					suggestions: [
						{ verifyStatus: "verified", verifyDurationMs: 100 },
						{ verifyStatus: "sandbox_error", verifyDurationMs: 400 },
					],
				},
				{ suggestions: [{ verified: true }] },
				{ suggestions: null },
			]);

			const metrics = await getVerifyMetrics();

			expect(metrics.windowDays).toBe(7);
			expect(metrics.sampleCount).toBe(3);
			expect(metrics.p50DurationMs).toBe(100);
			expect(metrics.p95DurationMs).toBe(400);
			expect(metrics.sandboxErrorRate).toBeCloseTo(1 / 3);
		});
	});

	describe("getIndexingMetrics", () => {
		it("aggregates IndexRun rows into indexing metrics (AC-2)", async () => {
			mockAuthSession.mockResolvedValue(adminSession);
			mockPrisma.indexRun.findMany.mockResolvedValueOnce([
				{ kind: "incremental", status: "success", fileDelta: 4 },
				{ kind: "incremental", status: "success", fileDelta: 6 },
				{ kind: "full", status: "success", fileDelta: null },
			]);

			const metrics = await getIndexingMetrics();

			expect(metrics.runCount).toBe(3);
			expect(metrics.avgFileDelta).toBe(5);
			expect(metrics.maxFileDelta).toBe(6);
			expect(metrics.fallbackRate).toBeCloseTo(1 / 3);
			expect(metrics.failureRate).toBe(0);
		});
	});

	describe("runMetricsAlertCheck", () => {
		const healthyReviews = [
			{ suggestions: [{ verifyStatus: "verified", verifyDurationMs: 100 }] },
		];
		const healthyRuns = [
			{ kind: "incremental", status: "success", fileDelta: 2 },
		];

		it("delivers nothing when all metrics are below threshold", async () => {
			mockPrisma.review.findMany.mockResolvedValueOnce(healthyReviews);
			mockPrisma.indexRun.findMany.mockResolvedValueOnce(healthyRuns);
			mockPrisma.organization.findMany.mockResolvedValueOnce([]);
			mockPrisma.user.findMany.mockResolvedValueOnce([]);

			const result = await runMetricsAlertCheck();

			expect(result).toEqual({
				alerts: [],
				attemptedOrgs: 0,
				deliveredToUsers: 0,
			});
			expect(mockPrisma.notification.create).not.toHaveBeenCalled();
			expect(mockSendEmail).not.toHaveBeenCalled();
			expect(mockSendSlack).not.toHaveBeenCalled();
		});

		it("fires alerts and delivers to org webhooks + admin email + in-app (AC-3)", async () => {
			mockPrisma.review.findMany.mockResolvedValueOnce([
				{ suggestions: [{ verifyStatus: "sandbox_error" }] },
			]);
			mockPrisma.indexRun.findMany.mockResolvedValueOnce(healthyRuns);
			mockPrisma.organization.findMany.mockResolvedValueOnce([
				{
					id: "org-1",
					integrations: [
						{
							type: "slack",
							isActive: true,
							config: { webhookUrl: "https://hooks.slack.com/x" },
						},
					],
				},
			]);
			mockPrisma.user.findMany.mockResolvedValueOnce([
				{
					id: "admin-1",
					email: "admin@example.com",
					emailNotifications: true,
				},
			]);
			mockPrisma.notification.findFirst.mockResolvedValueOnce(null);
			mockPrisma.notification.create.mockResolvedValueOnce({ id: "n1" });

			const result = await runMetricsAlertCheck();

			expect(result.alerts.map((a) => a.kind)).toContain(
				"sandbox_error_rate"
			);
			expect(result.attemptedOrgs).toBe(1);
			expect(result.deliveredToUsers).toBe(1);
			expect(mockPrisma.notification.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						userId: "admin-1",
						type: "metrics_alert",
					}),
				})
			);
			expect(mockSendEmail).toHaveBeenCalledWith(
				expect.objectContaining({ to: "admin@example.com" })
			);
			expect(mockSendSlack).toHaveBeenCalledWith(
				"https://hooks.slack.com/x",
				expect.objectContaining({ text: expect.any(String) })
			);
		});

		it("skips the in-app notification when one was created within the dedupe window", async () => {
			mockPrisma.review.findMany.mockResolvedValueOnce([
				{ suggestions: [{ verifyStatus: "sandbox_error" }] },
			]);
			mockPrisma.indexRun.findMany.mockResolvedValueOnce(healthyRuns);
			mockPrisma.organization.findMany.mockResolvedValueOnce([]);
			mockPrisma.user.findMany.mockResolvedValueOnce([
				{
					id: "admin-1",
					email: "admin@example.com",
					emailNotifications: true,
				},
			]);
			// A metrics_alert notification already exists inside the 6h window.
			mockPrisma.notification.findFirst.mockResolvedValueOnce({ id: "n-old" });

			const result = await runMetricsAlertCheck();

			expect(result.alerts.length).toBeGreaterThan(0);
			expect(result.deliveredToUsers).toBe(1);
			expect(mockPrisma.notification.create).not.toHaveBeenCalled();
			// Email still fires — dedupe is only for the in-app notification.
			expect(mockSendEmail).toHaveBeenCalled();
		});

		it("skips email for admins who disabled email notifications", async () => {
			mockPrisma.review.findMany.mockResolvedValueOnce([
				{ suggestions: [{ verifyStatus: "sandbox_error" }] },
			]);
			mockPrisma.indexRun.findMany.mockResolvedValueOnce(healthyRuns);
			mockPrisma.organization.findMany.mockResolvedValueOnce([]);
			mockPrisma.user.findMany.mockResolvedValueOnce([
				{
					id: "admin-1",
					email: "admin@example.com",
					emailNotifications: false,
				},
			]);
			mockPrisma.notification.findFirst.mockResolvedValueOnce(null);
			mockPrisma.notification.create.mockResolvedValueOnce({ id: "n1" });

			const result = await runMetricsAlertCheck();

			expect(result.deliveredToUsers).toBe(1);
			expect(mockPrisma.notification.create).toHaveBeenCalled();
			expect(mockSendEmail).not.toHaveBeenCalled();
		});
	});
});
