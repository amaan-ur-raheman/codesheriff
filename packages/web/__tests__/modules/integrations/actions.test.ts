import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db
vi.mock("@/lib/db", () => ({
	default: {
		organizationMember: {
			findUnique: vi.fn(),
		},
		integrationConfig: {
			findMany: vi.fn(),
			create: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
	},
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn().mockResolvedValue({
				user: { id: "user-123" },
			}),
		},
	},
}));

// Mock next headers
vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue({}),
}));

// Mock webhooks
vi.mock("@/lib/webhooks", () => ({
	sendSlackWebhook: vi.fn().mockResolvedValue({ success: true }),
	sendDiscordWebhook: vi.fn().mockResolvedValue({ success: true }),
}));

import prisma from "@/lib/db";
import { sendSlackWebhook, sendDiscordWebhook } from "@/lib/webhooks";
import {
	getIntegrationConfigs,
	createIntegrationConfig,
	updateIntegrationConfig,
	toggleIntegrationActive,
	deleteIntegrationConfig,
	testWebhook,
} from "@/modules/integrations/actions";

const mockPrisma = prisma as unknown as {
	organizationMember: {
		findUnique: ReturnType<typeof vi.fn>;
	};
	integrationConfig: {
		findMany: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
};

describe("Integrations Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("requireOrgMembership check", () => {
		it("throws error if user is not a member of the organization", async () => {
			mockPrisma.organizationMember.findUnique.mockResolvedValueOnce(null);

			await expect(getIntegrationConfigs("org-123")).rejects.toThrow(
				"Not a member of this organization"
			);
		});
	});

	describe("getIntegrationConfigs", () => {
		it("returns configurations for the organization", async () => {
			mockPrisma.organizationMember.findUnique.mockResolvedValueOnce({
				organizationId: "org-123",
				userId: "user-123",
			});
			mockPrisma.integrationConfig.findMany.mockResolvedValueOnce([
				{ id: "cfg-1", type: "slack" },
			]);

			const configs = await getIntegrationConfigs("org-123");

			expect(configs).toHaveLength(1);
			expect(configs[0]).toEqual({ id: "cfg-1", type: "slack" });
		});
	});

	describe("createIntegrationConfig", () => {
		it("creates a new integration configuration", async () => {
			mockPrisma.organizationMember.findUnique.mockResolvedValueOnce({
				organizationId: "org-123",
				userId: "user-123",
			});
			mockPrisma.integrationConfig.create.mockResolvedValueOnce({
				id: "cfg-new",
			});

			const config = await createIntegrationConfig("org-123", "slack", { url: "http://webhook" });

			expect(config).toEqual({ id: "cfg-new" });
			expect(mockPrisma.integrationConfig.create).toHaveBeenCalledWith({
				data: {
					organizationId: "org-123",
					type: "slack",
					config: { url: "http://webhook" },
					isActive: true,
				},
			});
		});
	});

	describe("updateIntegrationConfig", () => {
		it("updates config if user is a member of the integration's organization", async () => {
			mockPrisma.integrationConfig.findUnique.mockResolvedValueOnce({
				id: "cfg-1",
				organizationId: "org-123",
			});
			mockPrisma.organizationMember.findUnique.mockResolvedValueOnce({
				organizationId: "org-123",
				userId: "user-123",
			});
			mockPrisma.integrationConfig.update.mockResolvedValueOnce({ id: "cfg-1" });

			const updated = await updateIntegrationConfig("cfg-1", { url: "http://new" });

			expect(updated).toEqual({ id: "cfg-1" });
			expect(mockPrisma.integrationConfig.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: "cfg-1" },
					data: expect.objectContaining({
						config: { url: "http://new" },
					}),
				})
			);
		});
	});

	describe("toggleIntegrationActive", () => {
		it("toggles active status of the integration", async () => {
			mockPrisma.integrationConfig.findUnique.mockResolvedValueOnce({
				id: "cfg-1",
				organizationId: "org-123",
			});
			mockPrisma.organizationMember.findUnique.mockResolvedValueOnce({
				organizationId: "org-123",
				userId: "user-123",
			});
			mockPrisma.integrationConfig.update.mockResolvedValueOnce({ id: "cfg-1", isActive: false });

			const updated = await toggleIntegrationActive("cfg-1", false);

			expect(updated).toEqual({ id: "cfg-1", isActive: false });
			expect(mockPrisma.integrationConfig.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: "cfg-1" },
					data: expect.objectContaining({
						isActive: false,
					}),
				})
			);
		});
	});

	describe("deleteIntegrationConfig", () => {
		it("deletes the integration configuration", async () => {
			mockPrisma.integrationConfig.findUnique.mockResolvedValueOnce({
				id: "cfg-1",
				organizationId: "org-123",
			});
			mockPrisma.organizationMember.findUnique.mockResolvedValueOnce({
				organizationId: "org-123",
				userId: "user-123",
			});
			mockPrisma.integrationConfig.delete.mockResolvedValueOnce({ id: "cfg-1" });

			await deleteIntegrationConfig("cfg-1");

			expect(mockPrisma.integrationConfig.delete).toHaveBeenCalledWith({
				where: { id: "cfg-1" },
			});
		});
	});

	describe("testWebhook", () => {
		it("sends test payload to slack integration webhook url", async () => {
			await testWebhook("slack", "https://slack.url");

			expect(sendSlackWebhook).toHaveBeenCalledWith(
				"https://slack.url",
				expect.objectContaining({
					text: expect.any(String),
				})
			);
		});

		it("sends test payload to discord integration webhook url", async () => {
			await testWebhook("discord", "https://discord.url");

			expect(sendDiscordWebhook).toHaveBeenCalledWith(
				"https://discord.url",
				expect.objectContaining({
					embeds: expect.any(Array),
				})
			);
		});

		it("returns fail response for unsupported webhook types", async () => {
			const res = await testWebhook("gitter", "https://gitter.url");
			expect(res).toEqual({ success: false, error: "Unsupported integration type" });
		});
	});
});
