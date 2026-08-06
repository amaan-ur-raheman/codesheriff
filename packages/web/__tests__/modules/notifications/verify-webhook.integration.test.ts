import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import http from "node:http";
import prisma from "@/lib/db";
import {
	sendReviewCompletedNotification,
	sendReviewFailedNotification,
} from "@/modules/notifications/actions";

// Mock only concerns unrelated to this feature: auth/session, headers, and the
// real outbound email (we don't want to send real mail during verification).
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue({}) }));

const PORT = 39191;
const BASE = `http://localhost:${PORT}`;
const received: { path: string; body: any }[] = [];
const logs: string[] = [];
let server: http.Server;

const UID = "verify-user-1";
const ORG = "verify-org-1";
const REPO = "verify-repo-1";
const REPO_NOORG = "verify-repo-noorg";
const REV = "verify-rev-1";
const REV2 = "verify-rev-2";
const REV_NOORG = "verify-rev-noorg";
const REV_DISABLED = "verify-rev-disabled";
const REV_DEAD = "verify-rev-dead";

beforeAll(async () => {
	server = http.createServer((req, res) => {
		let data = "";
		req.on("data", (c) => (data += c));
		req.on("end", () => {
			try {
				received.push({ path: req.url || "", body: JSON.parse(data || "{}") });
			} catch {
				received.push({ path: req.url || "", body: data });
			}
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: true }));
		});
	});
	await new Promise<void>((r) => server.listen(PORT, r));

	vi.spyOn(console, "error").mockImplementation((...a) => {
		logs.push(a.map((x) => String(x)).join(" "));
	});
	vi.spyOn(console, "log").mockImplementation((...a) => {
		logs.push(a.map((x) => String(x)).join(" "));
	});

	await prisma.user.upsert({
		where: { id: UID },
		update: {},
		create: { id: UID, name: "Verify", email: "verify-0001@example.com" },
	});
	await prisma.organization.upsert({
		where: { id: ORG },
		update: {},
		create: { id: ORG, name: "Verify Org", slug: "verify-org-0001", ownerId: UID },
	});
	await prisma.repository.upsert({
		where: { id: REPO },
		update: { orgId: ORG },
		create: {
			id: REPO,
			githubId: BigInt(9990000001),
			name: "repo",
			owner: "owner",
			fullName: "owner/repo",
			url: "http://github.com/owner/repo",
			userId: UID,
			orgId: ORG,
		},
	});
	await prisma.repository.upsert({
		where: { id: REPO_NOORG },
		update: { orgId: null },
		create: {
			id: REPO_NOORG,
			githubId: BigInt(9990000002),
			name: "repo2",
			owner: "owner",
			fullName: "owner/repo2",
			url: "http://github.com/owner/repo2",
			userId: UID,
			orgId: null,
		},
	});
	const seeds: Array<[string, string, number, string]> = [
		[REV, REPO, 42, "Verify PR"],
		[REV2, REPO, 43, "Verify PR 2"],
		[REV_NOORG, REPO_NOORG, 44, "No Org PR"],
		[REV_DISABLED, REPO, 45, "Disabled PR"],
		[REV_DEAD, REPO, 46, "Dead PR"],
	];
	for (const seed of seeds) {
		const [id, repoId, num, title] = seed;
		await prisma.review.upsert({
			where: { id },
			update: {},
			create: {
				id,
				repositoryId: repoId,
				prNumber: num,
				prTitle: title,
				prUrl: `http://github.com/owner/repo/pull/${num}`,
				review: "ok",
				status: "completed",
			},
		});
	}
	await prisma.integrationConfig.upsert({
		where: { id: "verify-cfg-slack" },
		update: { config: { webhookUrl: `${BASE}/slack` } },
		create: {
			id: "verify-cfg-slack",
			organizationId: ORG,
			type: "slack",
			isActive: true,
			config: { webhookUrl: `${BASE}/slack` },
		},
	});
	await prisma.integrationConfig.upsert({
		where: { id: "verify-cfg-discord" },
		update: { config: { webhookUrl: `${BASE}/discord` } },
		create: {
			id: "verify-cfg-discord",
			organizationId: ORG,
			type: "discord",
			isActive: true,
			config: { webhookUrl: `${BASE}/discord` },
		},
	});
});

afterAll(async () => {
	await prisma.notification.deleteMany({ where: { userId: UID } });
	await prisma.integrationConfig.deleteMany({
		where: { id: { in: ["verify-cfg-slack", "verify-cfg-discord"] } },
	});
	await prisma.review.deleteMany({
		where: { id: { in: [REV, REV2, REV_NOORG, REV_DISABLED, REV_DEAD] } },
	});
	await prisma.repository.deleteMany({ where: { id: { in: [REPO, REPO_NOORG] } } });
	await prisma.organization.deleteMany({ where: { id: ORG } });
	await prisma.user.deleteMany({ where: { id: UID } });
	await new Promise<void>((r) => server.close(() => r()));
});

describe("review event webhook delivery (runtime)", () => {
	it("AC-1: completed review delivers to active Slack and Discord for the org", async () => {
		received.length = 0;
		await sendReviewCompletedNotification(REV);

		const slack = received.find((r) => r.path === "/slack");
		const discord = received.find((r) => r.path === "/discord");
		expect(slack, "slack payload received").toBeDefined();
		expect(discord, "discord payload received").toBeDefined();
		expect(slack!.body.text).toContain("Review complete");
		expect(slack!.body.text).toContain("#42 Verify PR");
		expect(discord!.body.embeds[0].title).toContain("Complete");
		expect(discord!.body.embeds[0].description).toContain("owner/repo");

		const note = await prisma.notification.findFirst({
			where: { userId: UID, type: "review_completed", data: { path: ["reviewId"], equals: REV } },
		});
		expect(note, "in-app notification created").toBeDefined();
	});

	it("AC-1: failed review delivers the failure event to integrations", async () => {
		received.length = 0;
		await sendReviewFailedNotification(REV2, "Gemini Timeout");

		const slack = received.find((r) => r.path === "/slack");
		const discord = received.find((r) => r.path === "/discord");
		expect(slack!.body.text).toContain("Review failed");
		expect(slack!.body.text).toContain("#43");
		expect(discord!.body.embeds[0].title).toContain("Failed");
		expect(discord!.body.embeds[0].description).toContain("Gemini Timeout");

		const note = await prisma.notification.findFirst({
			where: { userId: UID, type: "review_failed", data: { path: ["reviewId"], equals: REV2 } },
		});
		expect(note, "failed in-app notification created").toBeDefined();
	});

	it("AC-4: repo with no org delivers nothing externally but still notifies in-app", async () => {
		received.length = 0;
		await sendReviewCompletedNotification(REV_NOORG);

		expect(received.length, "no external delivery for personal repo").toBe(0);
		const note = await prisma.notification.findFirst({
			where: { userId: UID, type: "review_completed", data: { path: ["reviewId"], equals: REV_NOORG } },
		});
		expect(note, "in-app notification still created").toBeDefined();
	});

	it("AC-5: disabled feature flag suppresses external delivery", async () => {
		const prev = process.env.WEBHOOK_DELIVERY_ENABLED;
		process.env.WEBHOOK_DELIVERY_ENABLED = "false";
		received.length = 0;
		await sendReviewCompletedNotification(REV_DISABLED);
		process.env.WEBHOOK_DELIVERY_ENABLED = prev;

		expect(received.length, "no delivery when flag disabled").toBe(0);
		const note = await prisma.notification.findFirst({
			where: { userId: UID, type: "review_completed", data: { path: ["reviewId"], equals: REV_DISABLED } },
		});
		expect(note, "in-app notification still created when disabled").toBeDefined();
	});

	it("AC-2: a failing webhook does not block the review or other integrations", async () => {
		await prisma.integrationConfig.update({
			where: { id: "verify-cfg-slack" },
			data: { config: { webhookUrl: "http://localhost:1/slack" } },
		});
		received.length = 0;
		await sendReviewCompletedNotification(REV_DEAD);
		await prisma.integrationConfig.update({
			where: { id: "verify-cfg-slack" },
			data: { config: { webhookUrl: `${BASE}/slack` } },
		});

		const discord = received.find((r) => r.path === "/discord");
		expect(discord, "discord still delivered despite slack failure").toBeDefined();
		expect(
			received.find((r) => r.path === "/slack"),
			"slack not delivered (dead host)"
		).toBeUndefined();
		const note = await prisma.notification.findFirst({
			where: { userId: UID, type: "review_completed", data: { path: ["reviewId"], equals: REV_DEAD } },
		});
		expect(note, "review completed and notified despite webhook failure").toBeDefined();
		const loggedFailure = logs.some((l) => l.includes("Webhook delivery failed"));
		expect(loggedFailure, "AC-2: failed delivery is retried, logged, and dropped (not silent)").toBe(true);
	});

	it("AC-3: webhook URLs are never written to logs", () => {
		const leaked = logs.some((l) => l.includes("39191") || l.includes("localhost"));
		expect(leaked, "no webhook host leaked into logs").toBe(false);
	});
});
