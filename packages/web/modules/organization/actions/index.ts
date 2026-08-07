"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { polarClient } from "@/modules/payment/config/polar";
import { sendEmail } from "@/lib/email";
import {
	generateInviteToken,
	isInviteExpired,
	computeSeatUpgrade,
	INVITE_TOKEN_TTL_DAYS,
} from "@/modules/organization/lib/invites";

/**
 * Creates an organization. The creator becomes the owner member, and (best
 * effort) a Polar customer is provisioned for the org so it can be billed per
 * seat (Spec 0003 AC-1). Polar provisioning never blocks org creation.
 */
export async function createOrganization(
	name: string,
	description?: string
) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");

	const organization = await prisma.organization.create({
		data: {
			name,
			slug,
			description,
			ownerId: session.user.id,
			members: {
				create: {
					userId: session.user.id,
					role: "owner",
				},
			},
		},
		include: {
			members: {
				include: {
					user: true,
				},
			},
		},
	});

	// Best-effort org Polar customer (AC-1). Failures never block org creation,
	// and provisioning is skipped when the user has no real email (Polar
	// rejects placeholder domains).
	if (session.user.email) {
		try {
			const customer = await polarClient.customers.create({
				email: session.user.email,
				name,
			});
			await prisma.organization.update({
				where: { id: organization.id },
				data: { polarCustomerId: customer.id },
			});
		} catch (error) {
			console.error("Failed to provision Polar customer for org:", error);
		}
	}

	return organization;
}

export async function getOrganizations() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const organizations = await prisma.organization.findMany({
		where: {
			members: {
				some: {
					userId: session.user.id,
				},
			},
		},
		include: {
			members: {
				select: {
					id: true,
					role: true,
					status: true,
					user: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return organizations.map((org) => {
		const currentUserMember = org.members.find(
			(m) => m.user?.id === session.user.id
		);
		return {
			...org,
			memberCount: org.members.filter((m) => m.status === "active").length,
			currentUserRole: currentUserMember?.role ?? "member",
		};
	});
}

export async function getOrganization(orgId: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const membership = await prisma.organizationMember.findFirst({
		where: {
			organizationId: orgId,
			userId: session.user.id,
		},
	});

	if (!membership) {
		throw new Error("Not a member of this organization");
	}

	const organization = await prisma.organization.findUnique({
		where: { id: orgId },
		include: {
			members: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
						},
					},
				},
				orderBy: {
					joinedAt: "asc",
				},
			},
		},
	});

	if (!organization) {
		throw new Error("Organization not found");
	}

	return {
		...organization,
		currentUserRole: membership.role,
	};
}

/**
 * Invites a member by email (Spec 0003 AC-2, AC-3, AC-5).
 *
 * - If the email maps to an existing account, an active membership is created
 *   directly (existing behavior).
 * - Otherwise a PENDING membership with a single-use invite token is created
 *   and an invite email is sent; accepting activates the membership.
 * - Seat enforcement: when the invite would push active members over the
 *   org's purchased seats, a Polar checkout for the added seats is opened and
 *   its URL is returned so the owner can pay (AC-3).
 */
export async function inviteMember(
	orgId: string,
	email: string,
	role: string = "member"
) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const membership = await prisma.organizationMember.findFirst({
		where: {
			organizationId: orgId,
			userId: session.user.id,
		},
	});

	if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
		throw new Error("Only owners and admins can invite members");
	}

	const existingInvite = await prisma.organizationMember.findFirst({
		where: {
			organizationId: orgId,
			invitedEmail: email,
		},
	});

	if (existingInvite) {
		throw new Error("User is already invited or a member of this organization");
	}

	const userToInvite = await prisma.user.findUnique({
		where: { email },
	});

	const org = await prisma.organization.findUnique({
		where: { id: orgId },
	});

	const activeCount = await prisma.organizationMember.count({
		where: { organizationId: orgId, status: "active" },
	});

	// Seat enforcement (AC-3): we don't store purchased-seat counts, so a
	// subscribed org is treated as buying seats as it grows — adding any new
	// active member extends the subscription by one seat.
	const seatsNeeded =
		org && org.polarSubscriptionId
			? computeSeatUpgrade({
					activeCount: activeCount + 1,
					currentSeats: activeCount,
			  })
			: 0;

	// Opens a Polar checkout for the added seats. Best effort — an invite
	// never fails because checkout creation does (AC-3).
	const openSeatCheckout = async (): Promise<string | null> => {
		const productId = process.env.POLAR_ORG_PRODUCT_ID;
		if (seatsNeeded <= 0 || !org?.polarCustomerId || !productId) {
			return null;
		}
		try {
			const checkout = await polarClient.checkouts.create({
				products: [productId],
				customerId: org.polarCustomerId,
				seats: activeCount + 1,
				successUrl:
					process.env.POLAR_SUCCESS_URL ?? "/dashboard/organizations",
			});
			return checkout.url;
		} catch (error) {
			console.error("Failed to create seat checkout:", error);
			return null;
		}
	};

	if (userToInvite) {
		const existingMember = await prisma.organizationMember.findFirst({
			where: {
				organizationId: orgId,
				userId: userToInvite.id,
			},
		});

		if (existingMember) {
			throw new Error("User is already a member of this organization");
		}

		const member = await prisma.organizationMember.create({
			data: {
				organizationId: orgId,
				userId: userToInvite.id,
				role,
				status: "active",
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						image: true,
					},
				},
			},
		});

		const seatCheckoutUrl = await openSeatCheckout();
		return { member, seatCheckoutUrl };
	}

	// Pending invite for someone without an account yet (AC-2, AC-5).
	const inviteToken = generateInviteToken();
	const member = await prisma.organizationMember.create({
		data: {
			organizationId: orgId,
			role,
			status: "pending",
			invitedEmail: email,
			inviteToken,
			invitedAt: new Date(),
		},
	});

	const seatCheckoutUrl = await openSeatCheckout();

	const appUrl =
		process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
	const acceptUrl = `${appUrl}/orgs/invite/${inviteToken}`;

	await sendEmail({
		to: email,
		subject: `You're invited to join ${org?.name ?? "an organization"} on Code Sheriff`,
		html: `<p>You've been invited to join <strong>${org?.name ?? "an organization"}</strong> on Code Sheriff.</p><p><a href="${acceptUrl}">Accept the invite</a></p><p>This invite expires in ${INVITE_TOKEN_TTL_DAYS} days.</p>`,
	});

	return { member, seatCheckoutUrl };
}

/**
 * Accepts a pending org invite by token (Spec 0003 AC-2, AC-5).
 * The token is single-use: after activation it is nulled, so it cannot be
 * reused. Expired tokens are rejected.
 */
export async function acceptOrgInvite(token: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const invite = await prisma.organizationMember.findFirst({
		where: { inviteToken: token },
	});

	if (!invite || invite.status !== "pending") {
		throw new Error("Invalid invite");
	}

	if (isInviteExpired(invite.invitedAt)) {
		throw new Error("Invite has expired");
	}

	const user = await prisma.user.findUnique({
		where: { email: invite.invitedEmail! },
	});

	if (!user) {
		throw new Error("No account found for the invited email");
	}

	if (user.id !== session.user.id) {
		throw new Error("This invite is for a different account");
	}

	// Atomic claim (AC-5 single use): only one concurrent accept can flip the
	// pending invite to active, because the where clause re-checks status and
	// the token. A second accept finds count 0 and is rejected.
	const claimed = await prisma.organizationMember.updateMany({
		where: {
			id: invite.id,
			inviteToken: token,
			status: "pending",
		},
		data: {
			status: "active",
			userId: user.id,
			inviteToken: null,
			joinedAt: new Date(),
		},
	});

	if (claimed.count === 0) {
		throw new Error("Invalid invite");
	}

	return {
		...invite,
		status: "active" as const,
		userId: user.id,
		inviteToken: null,
	};
}

export async function removeMember(orgId: string, userId: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const membership = await prisma.organizationMember.findFirst({
		where: {
			organizationId: orgId,
			userId: session.user.id,
		},
	});

	if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
		throw new Error("Only owners and admins can remove members");
	}

	if (userId === session.user.id) {
		throw new Error("Cannot remove yourself from the organization");
	}

	// AC-6: the last owner cannot be removed.
	const target = await prisma.organizationMember.findFirst({
		where: { organizationId: orgId, userId },
	});

	if (target?.role === "owner") {
		const ownerCount = await prisma.organizationMember.count({
			where: { organizationId: orgId, role: "owner", status: "active" },
		});
		if (ownerCount <= 1) {
			throw new Error("Cannot remove the last owner of the organization");
		}
	}

	await prisma.organizationMember.delete({
		where: {
			organizationId_userId: {
				organizationId: orgId,
				userId,
			},
		},
	});

	return { success: true };
}

export async function updateMemberRole(
	orgId: string,
	userId: string,
	role: string
) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const membership = await prisma.organizationMember.findFirst({
		where: {
			organizationId: orgId,
			userId: session.user.id,
		},
	});

	if (!membership || membership.role !== "owner") {
		throw new Error("Only owners can update member roles");
	}

	if (userId === session.user.id) {
		throw new Error("Owner cannot change their own role");
	}

	const updatedMember = await prisma.organizationMember.update({
		where: {
			organizationId_userId: {
				organizationId: orgId,
				userId,
			},
		},
		data: { role },
		include: {
			user: {
				select: {
					id: true,
					name: true,
					email: true,
					image: true,
				},
			},
		},
	});

	return updatedMember;
}

/**
 * Transfers org ownership to another active member (Spec 0003 AC-6).
 * Only the current owner can transfer; the target must be an active member.
 */
export async function transferOwnership(orgId: string, newOwnerId: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const membership = await prisma.organizationMember.findFirst({
		where: {
			organizationId: orgId,
			userId: session.user.id,
		},
	});

	if (!membership || membership.role !== "owner") {
		throw new Error("Only the owner can transfer ownership");
	}

	if (newOwnerId === session.user.id) {
		throw new Error("Organization is already owned by this user");
	}

	const target = await prisma.organizationMember.findFirst({
		where: { organizationId: orgId, userId: newOwnerId },
	});

	if (!target || target.status !== "active") {
		throw new Error("Target must be an active member of the organization");
	}

	await prisma.organization.update({
		where: { id: orgId },
		data: { ownerId: newOwnerId },
	});

	await prisma.organizationMember.update({
		where: {
			organizationId_userId: {
				organizationId: orgId,
				userId: newOwnerId,
			},
		},
		data: { role: "owner" },
	});

	// The former owner drops to admin (still a member, no longer owner).
	await prisma.organizationMember.update({
		where: {
			organizationId_userId: {
				organizationId: orgId,
				userId: session.user.id,
			},
		},
		data: { role: "admin" },
	});

	return { success: true };
}

export async function deleteOrganization(orgId: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const organization = await prisma.organization.findUnique({
		where: { id: orgId },
	});

	if (!organization) {
		throw new Error("Organization not found");
	}

	if (organization.ownerId !== session.user.id) {
		throw new Error("Only the owner can delete the organization");
	}

	await prisma.organization.delete({
		where: { id: orgId },
	});

	return { success: true };
}
