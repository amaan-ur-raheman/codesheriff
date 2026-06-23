import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db
vi.mock("@/lib/db", () => ({
	default: {
		organization: {
			create: vi.fn(),
			findMany: vi.fn(),
			findUnique: vi.fn(),
			delete: vi.fn(),
		},
		organizationMember: {
			findUnique: vi.fn(),
			create: vi.fn(),
			delete: vi.fn(),
			update: vi.fn(),
		},
		user: {
			findUnique: vi.fn(),
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

import prisma from "@/lib/db";
import {
	createOrganization,
	getOrganizations,
	getOrganization,
	inviteMember,
	removeMember,
	updateMemberRole,
	deleteOrganization,
} from "@/modules/organization/actions";

const mockPrisma = prisma as unknown as {
	organization: {
		create: ReturnType<typeof vi.fn>;
		findMany: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
	organizationMember: {
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	user: {
		findUnique: ReturnType<typeof vi.fn>;
	};
};

describe("Organization Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("createOrganization", () => {
		it("creates organization with membership and handles slug parsing", async () => {
			mockPrisma.organization.create.mockResolvedValueOnce({
				id: "org-1",
				name: "My Org Info!",
				slug: "my-org-info",
			});

			const org = await createOrganization("My Org Info!", "Some description");

			expect(org).toEqual({
				id: "org-1",
				name: "My Org Info!",
				slug: "my-org-info",
			});
			expect(mockPrisma.organization.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						name: "My Org Info!",
						slug: "my-org-info",
						description: "Some description",
						ownerId: "user-123",
					}),
				})
			);
		});
	});

	describe("getOrganizations", () => {
		it("retrieves organizations user is a member of and formats role counts", async () => {
			mockPrisma.organization.findMany.mockResolvedValueOnce([
				{
					id: "org-1",
					members: [
						{ user: { id: "user-123" }, role: "owner" },
						{ user: { id: "user-456" }, role: "member" },
					],
				},
			]);

			const orgs = await getOrganizations();

			expect(orgs).toHaveLength(1);
			expect(orgs[0]).toEqual(
				expect.objectContaining({
					id: "org-1",
					memberCount: 2,
					currentUserRole: "owner",
				})
			);
		});
	});

	describe("getOrganization", () => {
		it("returns details if member", async () => {
			mockPrisma.organizationMember.findUnique.mockResolvedValueOnce({
				role: "admin",
			});
			mockPrisma.organization.findUnique.mockResolvedValueOnce({
				id: "org-1",
				name: "Target Org",
				members: [],
			});

			const org = await getOrganization("org-1");

			expect(org).toEqual(
				expect.objectContaining({
					id: "org-1",
					currentUserRole: "admin",
				})
			);
		});
	});

	describe("inviteMember", () => {
		it("adds user to organization member records if actor is owner or admin", async () => {
			mockPrisma.organizationMember.findUnique
				.mockResolvedValueOnce({ role: "admin" }) // Actor permission
				.mockResolvedValueOnce(null); // Existing member check

			mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-to-invite" });
			mockPrisma.organizationMember.create.mockResolvedValueOnce({
				userId: "user-to-invite",
				role: "member",
			});

			const member = await inviteMember("org-1", "invited@example.com", "member");

			expect(member).toEqual({ userId: "user-to-invite", role: "member" });
			expect(mockPrisma.organizationMember.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: {
						organizationId: "org-1",
						userId: "user-to-invite",
						role: "member",
					},
				})
			);
		});
	});

	describe("removeMember", () => {
		it("deletes membership record if actor is owner/admin and target is not self", async () => {
			mockPrisma.organizationMember.findUnique.mockResolvedValueOnce({ role: "owner" });
			mockPrisma.organizationMember.delete.mockResolvedValueOnce({});

			const result = await removeMember("org-1", "user-456");

			expect(result).toEqual({ success: true });
			expect(mockPrisma.organizationMember.delete).toHaveBeenCalledWith({
				where: {
					organizationId_userId: {
						organizationId: "org-1",
						userId: "user-456",
					},
				},
			});
		});

		it("throws error if target is self", async () => {
			mockPrisma.organizationMember.findUnique.mockResolvedValueOnce({ role: "owner" });

			await expect(removeMember("org-1", "user-123")).rejects.toThrow(
				"Cannot remove yourself from the organization"
			);
		});
	});

	describe("updateMemberRole", () => {
		it("updates role in db if actor is owner", async () => {
			mockPrisma.organizationMember.findUnique.mockResolvedValueOnce({ role: "owner" });
			mockPrisma.organizationMember.update.mockResolvedValueOnce({
				userId: "user-456",
				role: "admin",
			});

			const updated = await updateMemberRole("org-1", "user-456", "admin");

			expect(updated).toEqual({ userId: "user-456", role: "admin" });
			expect(mockPrisma.organizationMember.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						organizationId_userId: {
							organizationId: "org-1",
							userId: "user-456",
						},
					},
					data: { role: "admin" },
				})
			);
		});
	});

	describe("deleteOrganization", () => {
		it("deletes organization if actor is owner", async () => {
			mockPrisma.organization.findUnique.mockResolvedValueOnce({
				id: "org-1",
				ownerId: "user-123",
			});
			mockPrisma.organization.delete.mockResolvedValueOnce({});

			const result = await deleteOrganization("org-1");

			expect(result).toEqual({ success: true });
			expect(mockPrisma.organization.delete).toHaveBeenCalledWith({
				where: { id: "org-1" },
			});
		});
	});
});
