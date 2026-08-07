import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	generateInviteToken,
	isInviteExpired,
	computeSeatUpgrade,
	INVITE_TOKEN_TTL_DAYS,
} from "@/modules/organization/lib/invites";

describe("invite token helpers (Spec 0003)", () => {
	describe("generateInviteToken", () => {
		it("generates a non-empty opaque token", () => {
			const token = generateInviteToken();
			expect(token).toBeTruthy();
			expect(token.length).toBeGreaterThanOrEqual(32);
		});

		it("generates unique tokens", () => {
			const a = generateInviteToken();
			const b = generateInviteToken();
			expect(a).not.toBe(b);
		});
	});

	describe("isInviteExpired", () => {
		it("returns false for a fresh invite", () => {
			expect(isInviteExpired(new Date())).toBe(false);
		});

		it("returns true after the TTL has elapsed", () => {
			const invitedAt = new Date();
			invitedAt.setDate(invitedAt.getDate() - (INVITE_TOKEN_TTL_DAYS + 1));
			expect(isInviteExpired(invitedAt)).toBe(true);
		});

		it("is not expired exactly at the TTL boundary", () => {
			const invitedAt = new Date();
			invitedAt.setDate(invitedAt.getDate() - INVITE_TOKEN_TTL_DAYS);
			expect(isInviteExpired(invitedAt)).toBe(false);
		});
	});

	describe("computeSeatUpgrade", () => {
		it("returns 0 extra seats when active members fit the current seat count", () => {
			expect(computeSeatUpgrade({ activeCount: 2, currentSeats: 5 })).toBe(0);
		});

		it("returns the number of seats to add when active members exceed current seats", () => {
			// 4 active members on a 3-seat plan → add 1 seat.
			expect(computeSeatUpgrade({ activeCount: 4, currentSeats: 3 })).toBe(1);
		});

		it("returns 0 when there is no paid seat limit (no subscription yet)", () => {
			expect(computeSeatUpgrade({ activeCount: 4, currentSeats: null })).toBe(0);
		});

		it("returns 0 when the org has no seats purchased at all (free org)", () => {
			expect(computeSeatUpgrade({ activeCount: 1, currentSeats: 0 })).toBe(0);
		});
	});
});

// ---- Action lifecycle (mocked prisma) ----

vi.mock("@/lib/db", () => ({
	default: {
		organization: {
			create: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
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

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn().mockResolvedValue({ user: { id: "user-123" } }),
		},
	},
}));

vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/email", () => ({
	sendEmail: vi.fn().mockResolvedValue({ id: "email-1" }),
}));

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
import { sendEmail } from "@/lib/email";
import { polarClient } from "@/modules/payment/config/polar";
import {
	inviteMember,
	acceptOrgInvite,
	transferOwnership,
} from "@/modules/organization/actions";

const mockPrisma = prisma as unknown as {
	organization: {
		create: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
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

const mockSendEmail = sendEmail as unknown as ReturnType<typeof vi.fn>;
const mockCheckoutsCreate =
	polarClient.checkouts.create as unknown as ReturnType<typeof vi.fn>;

describe("Org invite lifecycle (Spec 0003)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("inviteMember", () => {
		beforeEach(() => {
			vi.stubEnv("POLAR_ORG_PRODUCT_ID", "prod_org_seat");
		});

		afterEach(() => {
			vi.unstubAllEnvs();
		});

		it("creates a pending membership and sends an email when the email has no account (AC-2)", async () => {
			// Actor permission check
			mockPrisma.organizationMember.findFirst.mockResolvedValueOnce({
				role: "admin",
			});
			// No existing pending invite for that org+email
			mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(null);
			// No user with that email yet
			mockPrisma.user.findUnique.mockResolvedValueOnce(null);
			// Org has no paid subscription yet
			mockPrisma.organization.findUnique.mockResolvedValueOnce({
				id: "org-1",
				polarSubscriptionId: null,
			});
			// Active member count (seat enforcement)
			mockPrisma.organizationMember.count.mockResolvedValueOnce(2);
			mockPrisma.organizationMember.create.mockResolvedValueOnce({
				id: "member-pending",
				organizationId: "org-1",
				userId: null,
				status: "pending",
				invitedEmail: "new@example.com",
				inviteToken: "tok-123",
			});

			const result = await inviteMember("org-1", "new@example.com", "member");

			expect(result.member.status).toBe("pending");
			expect(result.member.userId).toBeNull();
			expect(result.seatCheckoutUrl).toBeNull();
			expect(mockPrisma.organizationMember.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						organizationId: "org-1",
						status: "pending",
						invitedEmail: "new@example.com",
						inviteToken: expect.any(String),
					}),
				})
			);
			expect(mockSendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					to: "new@example.com",
					subject: expect.stringContaining("invit"),
				})
			);
		});

		it("throws when the actor is not an owner or admin", async () => {
			mockPrisma.organizationMember.findFirst.mockResolvedValueOnce({
				role: "member",
			});

			await expect(
				inviteMember("org-1", "someone@example.com", "member")
			).rejects.toThrow("Only owners and admins can invite members");
		});

		it("opens a seat checkout for a subscribed org on a pending invite (AC-3)", async () => {
			mockPrisma.organizationMember.findFirst
				.mockResolvedValueOnce({ role: "admin" }) // actor
				.mockResolvedValueOnce(null); // no existing invite
			mockPrisma.user.findUnique.mockResolvedValueOnce(null); // no account yet
			mockPrisma.organization.findUnique.mockResolvedValueOnce({
				id: "org-1",
				name: "Paid Org",
				polarSubscriptionId: "sub-1",
				polarCustomerId: "cust-1",
			});
			mockPrisma.organizationMember.count.mockResolvedValueOnce(2);
			mockPrisma.organizationMember.create.mockResolvedValueOnce({
				id: "member-pending",
				organizationId: "org-1",
				userId: null,
				status: "pending",
				invitedEmail: "new@example.com",
				inviteToken: "tok-123",
			});

			const result = await inviteMember("org-1", "new@example.com", "member");

			expect(mockCheckoutsCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					products: [expect.any(String)],
					customerId: "cust-1",
					seats: 3,
				})
			);
			expect(result.seatCheckoutUrl).toBe(
				"https://checkout.polar.sh/xyz"
			);
		});

		it("opens a seat checkout when a subscribed org adds an existing account (AC-3)", async () => {
			mockPrisma.organizationMember.findFirst
				.mockResolvedValueOnce({ role: "admin" }) // actor
				.mockResolvedValueOnce(null) // no pending invite by email
				.mockResolvedValueOnce(null); // not already a member
			mockPrisma.user.findUnique.mockResolvedValueOnce({
				id: "user-789",
				email: "member@example.com",
			});
			mockPrisma.organization.findUnique.mockResolvedValueOnce({
				id: "org-1",
				polarSubscriptionId: "sub-1",
				polarCustomerId: "cust-1",
			});
			mockPrisma.organizationMember.count.mockResolvedValueOnce(1);
			mockPrisma.organizationMember.create.mockResolvedValueOnce({
				id: "m-4",
				status: "active",
				userId: "user-789",
			});

			const result = await inviteMember(
				"org-1",
				"member@example.com",
				"member"
			);

			expect(mockCheckoutsCreate).toHaveBeenCalledWith(
				expect.objectContaining({ seats: 2 })
			);
			expect(result.seatCheckoutUrl).toBe(
				"https://checkout.polar.sh/xyz"
			);
		});
	});

	describe("acceptOrgInvite", () => {
		it("activates a pending membership for a valid, unexpired, single-use token (AC-2, AC-5)", async () => {
			mockPrisma.organizationMember.findFirst.mockResolvedValueOnce({
				id: "member-pending",
				organizationId: "org-1",
				userId: null,
				status: "pending",
				invitedEmail: "new@example.com",
				inviteToken: "tok-123",
				invitedAt: new Date(),
			});
			mockPrisma.user.findUnique.mockResolvedValueOnce({
				id: "user-123",
				email: "new@example.com",
			});
			mockPrisma.organizationMember.updateMany.mockResolvedValueOnce({
				count: 1,
			});

			const result = await acceptOrgInvite("tok-123");

			expect(result.status).toBe("active");
			expect(result.userId).toBe("user-123");
			expect(mockPrisma.organizationMember.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						id: "member-pending",
						inviteToken: "tok-123",
						status: "pending",
					}),
					data: expect.objectContaining({
						status: "active",
						userId: "user-123",
						inviteToken: null,
					}),
				})
			);
		});

		it("rejects a concurrent second accept of the same token (AC-5 single use)", async () => {
			mockPrisma.organizationMember.findFirst.mockResolvedValueOnce({
				id: "member-pending",
				organizationId: "org-1",
				userId: null,
				status: "pending",
				invitedEmail: "new@example.com",
				inviteToken: "tok-123",
				invitedAt: new Date(),
			});
			mockPrisma.user.findUnique.mockResolvedValueOnce({
				id: "user-123",
				email: "new@example.com",
			});
			// The first accept already claimed it: updateMany matches 0 rows.
			mockPrisma.organizationMember.updateMany.mockResolvedValueOnce({
				count: 0,
			});

			await expect(acceptOrgInvite("tok-123")).rejects.toThrow(/invalid/i);
		});

		it("rejects an expired token (AC-5)", async () => {
			const invitedAt = new Date();
			invitedAt.setDate(invitedAt.getDate() - (INVITE_TOKEN_TTL_DAYS + 1));

			mockPrisma.organizationMember.findFirst.mockResolvedValueOnce({
				id: "member-pending",
				status: "pending",
				invitedEmail: "new@example.com",
				inviteToken: "tok-expired",
				invitedAt,
			});

			await expect(acceptOrgInvite("tok-expired")).rejects.toThrow(/expired/i);
		});

		it("rejects a token that was already used (AC-5 single use)", async () => {
			mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(null);

			await expect(acceptOrgInvite("tok-used")).rejects.toThrow(/invalid/i);
		});
	});

	describe("transferOwnership", () => {
		it("transfers the owner role to another active member (AC-6)", async () => {
			mockPrisma.organizationMember.findFirst
				.mockResolvedValueOnce({ role: "owner" }) // actor is owner
				.mockResolvedValueOnce({
					id: "member-456",
					role: "member",
					status: "active",
				}); // target member exists and is active
			mockPrisma.organization.update.mockResolvedValueOnce({});
			mockPrisma.organizationMember.update.mockResolvedValueOnce({});
			mockPrisma.organizationMember.update.mockResolvedValueOnce({});

			await transferOwnership("org-1", "user-456");

			expect(mockPrisma.organization.update).toHaveBeenCalledWith(
				expect.objectContaining({ data: { ownerId: "user-456" } })
			);
			expect(mockPrisma.organizationMember.update).toHaveBeenCalledWith(
				expect.objectContaining({ data: { role: "owner" } })
			);
		});

		it("throws when the actor is not the owner", async () => {
			mockPrisma.organizationMember.findFirst.mockResolvedValueOnce({
				role: "admin",
			});

			await expect(transferOwnership("org-1", "user-456")).rejects.toThrow(
				"Only the owner"
			);
		});
	});
});
