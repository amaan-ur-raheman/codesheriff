import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db
vi.mock("@/lib/db", () => ({
	default: {
		organization: {
			create: vi.fn(),
			findMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		organizationMember: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			findMany: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
			count: vi.fn(),
			delete: vi.fn(),
		},
		user: {
			findUnique: vi.fn(),
			findByEmail: vi.fn(),
		},
	},
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn().mockResolvedValue({
				user: { id: "user-123", email: "owner@example.com" },
			}),
		},
	},
}));

// Mock next headers
vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue({}),
}));

// Mock Polar so org provisioning stays hermetic (Spec 0003 AC-1)
vi.mock("@/modules/payment/config/polar", () => ({
	polarClient: {
		customers: {
			create: vi.fn().mockResolvedValue({ id: "polar-cust-1" }),
		},
		checkouts: {
			create: vi
				.fn()
				.mockResolvedValue({ url: "https://checkout.polar.sh/xyz" }),
		},
	},
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
		update: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
	organizationMember: {
		findUnique: ReturnType<typeof vi.fn>;
		findFirst: ReturnType<typeof vi.fn>;
		findMany: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		updateMany: ReturnType<typeof vi.fn>;
		count: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
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
				ownerId: "user-123",
				members: [
					{
						id: "m-1",
						userId: "user-123",
						role: "owner",
						user: { id: "user-123" },
					},
				],
			});

			const org = await createOrganization("My Org Info!", "Some description");

			expect(org).toEqual(
				expect.objectContaining({
					id: "org-1",
					name: "My Org Info!",
					slug: "my-org-info",
				})
			);
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

		it("provisions a Polar customer for the org when the user has an email (AC-1)", async () => {
			mockPrisma.organization.create.mockResolvedValueOnce({
				id: "org-1",
				name: "My Org",
				slug: "my-org",
			});

			await createOrganization("My Org");

			expect(mockPrisma.organization.update).toHaveBeenCalledWith({
				where: { id: "org-1" },
				data: { polarCustomerId: "polar-cust-1" },
			});
		});
	});

	describe("getOrganizations", () => {
		it("retrieves organizations user is a member of and formats role counts", async () => {
			mockPrisma.organization.findMany.mockResolvedValueOnce([
				{
					id: "org-1",
					members: [
						{
							id: "m-1",
							role: "owner",
							status: "active",
							user: {
								id: "user-123",
								name: "Owner",
								email: "owner@example.com",
								image: null,
							},
						},
						{
							id: "m-2",
							role: "member",
							status: "active",
							user: {
								id: "user-456",
								name: "Member",
								email: "member@example.com",
								image: null,
							},
						},
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
			mockPrisma.organizationMember.findFirst.mockResolvedValueOnce({
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
			mockPrisma.organizationMember.findFirst
				.mockResolvedValueOnce({ role: "admin" }) // Actor permission
				.mockResolvedValueOnce(null) // No existing invite by email
				.mockResolvedValueOnce(null); // No existing membership for the user

			mockPrisma.user.findUnique.mockResolvedValueOnce({
				id: "user-to-invite",
			});
			mockPrisma.organization.findUnique.mockResolvedValueOnce({
				id: "org-1",
				polarSubscriptionId: null,
			});
			mockPrisma.organizationMember.count.mockResolvedValueOnce(0);
			mockPrisma.organizationMember.create.mockResolvedValueOnce({
				id: "m-3",
				userId: "user-to-invite",
				role: "member",
				status: "active",
				user: {
					id: "user-to-invite",
					name: "Invited",
					email: "invited@example.com",
					image: null,
				},
			});

			const result = await inviteMember(
				"org-1",
				"invited@example.com",
				"member"
			);

			expect(result.member).toEqual(
				expect.objectContaining({
					userId: "user-to-invite",
					role: "member",
				})
			);
			expect(result.seatCheckoutUrl).toBeNull();
			expect(mockPrisma.organizationMember.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						organizationId: "org-1",
						userId: "user-to-invite",
						role: "member",
						status: "active",
					}),
				})
			);
		});
	});

	describe("removeMember", () => {
		it("deletes membership record if actor is owner/admin and target is not self", async () => {
			mockPrisma.organizationMember.findFirst
				.mockResolvedValueOnce({ role: "owner" }) // actor
				.mockResolvedValueOnce({ role: "member", status: "active" }); // target
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
			mockPrisma.organizationMember.findFirst.mockResolvedValueOnce({
				role: "owner",
			});

			await expect(removeMember("org-1", "user-123")).rejects.toThrow(
				"Cannot remove yourself from the organization"
			);
		});

		it("throws when removing the last owner of the organization (AC-6)", async () => {
			mockPrisma.organizationMember.findFirst
				.mockResolvedValueOnce({ role: "admin" }) // actor is an admin
				.mockResolvedValueOnce({
					role: "owner",
					status: "active",
				}); // target is the owner
			mockPrisma.organizationMember.count.mockResolvedValueOnce(1); // only one owner

			await expect(removeMember("org-1", "user-owner")).rejects.toThrow(
				"Cannot remove the last owner of the organization"
			);
		});
	});

	describe("updateMemberRole", () => {
		it("updates role in db if actor is owner", async () => {
			mockPrisma.organizationMember.findFirst.mockResolvedValueOnce({
				role: "owner",
			});
			mockPrisma.organizationMember.update.mockResolvedValueOnce({
				id: "m-2",
				userId: "user-456",
				role: "admin",
				user: {
					id: "user-456",
					name: "Member",
					email: "member@example.com",
					image: null,
				},
			});

			const updated = await updateMemberRole("org-1", "user-456", "admin");

			expect(updated).toEqual(
				expect.objectContaining({
					userId: "user-456",
					role: "admin",
				})
			);
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
