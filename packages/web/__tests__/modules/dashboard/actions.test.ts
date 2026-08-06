import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
vi.mock("@/lib/db", () => ({
	default: {
		organizationMember: {
			findUnique: vi.fn(),
		},
		repository: {
			create: vi.fn().mockResolvedValue({ id: "repo-1" }),
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

// Mock github lib helpers (connectRepository only uses createWebhook)
vi.mock("@/modules/github/lib/github", () => ({
	createWebhook: vi.fn().mockResolvedValue({ id: "wh-1" }),
	fetchUserContribution: vi.fn(),
	getGithubAccessToken: vi.fn(),
}));

// Mock subscription limits
vi.mock("@/modules/payment/lib/subscription", () => ({
	canConnectRepository: vi.fn().mockResolvedValue(true),
	incrementRepositoryCount: vi.fn().mockResolvedValue(undefined),
}));

// Mock inngest client
vi.mock("@/inngest/client", () => ({
	inngest: {
		send: vi.fn().mockResolvedValue({}),
	},
}));

import prisma from "@/lib/db";
import { connectRepository } from "@/modules/dashboard/actions";
import { createWebhook } from "@/modules/github/lib/github";
import { canConnectRepository } from "@/modules/payment/lib/subscription";

const mockPrisma = prisma as unknown as {
	organizationMember: { findUnique: ReturnType<typeof vi.fn> };
	repository: { create: ReturnType<typeof vi.fn> };
};

describe("connectRepository", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("throws unauthorized if session is missing", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

		await expect(
			connectRepository("owner", "repo", 101)
		).rejects.toThrow("Unauthorized");
	});

	it("links the repository to the org when orgId is provided and user is an owner/admin", async () => {
		mockPrisma.organizationMember.findUnique.mockResolvedValue({
			id: "membership-1",
			role: "admin",
		} as never);

		const webhook = await connectRepository(
			"owner",
			"repo",
			101,
			"org-1"
		);

		expect(webhook).toEqual({ id: "wh-1" });
		expect(mockPrisma.organizationMember.findUnique).toHaveBeenCalledWith({
			where: {
				organizationId_userId: {
					organizationId: "org-1",
					userId: "user-123",
				},
			},
		});
		expect(mockPrisma.repository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					orgId: "org-1",
				}),
			})
		);
	});

	it("rejects org linking when the user is not a member of the organization", async () => {
		mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

		await expect(
			connectRepository("owner", "repo", 101, "org-1")
		).rejects.toThrow("You are not a member of this organization");

		expect(mockPrisma.repository.create).not.toHaveBeenCalled();
		expect(createWebhook).not.toHaveBeenCalled();
	});

	it("rejects org linking for plain members (only owner/admin can connect)", async () => {
		mockPrisma.organizationMember.findUnique.mockResolvedValue({
			id: "membership-1",
			role: "member",
		} as never);

		await expect(
			connectRepository("owner", "repo", 101, "org-1")
		).rejects.toThrow(
			"Only organization owners and admins can connect repositories"
		);

		expect(mockPrisma.repository.create).not.toHaveBeenCalled();
		expect(createWebhook).not.toHaveBeenCalled();
	});

	it("connects without an org (orgId null) when no org context is provided", async () => {
		const webhook = await connectRepository("owner", "repo", 101);

		expect(webhook).toEqual({ id: "wh-1" });
		expect(mockPrisma.organizationMember.findUnique).not.toHaveBeenCalled();
		expect(mockPrisma.repository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					orgId: null,
				}),
			})
		);
	});

	it("respects the subscription repository limit", async () => {
		vi.mocked(canConnectRepository).mockResolvedValueOnce(false);

		await expect(
			connectRepository("owner", "repo", 101)
		).rejects.toThrow("Repository limit reached");

		expect(createWebhook).not.toHaveBeenCalled();
		expect(mockPrisma.repository.create).not.toHaveBeenCalled();
	});
});
