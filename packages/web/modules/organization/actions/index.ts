"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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
			(m) => m.user.id === session.user.id
		);
		return {
			...org,
			memberCount: org.members.length,
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

	const membership = await prisma.organizationMember.findUnique({
		where: {
			organizationId_userId: {
				organizationId: orgId,
				userId: session.user.id,
			},
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

	const membership = await prisma.organizationMember.findUnique({
		where: {
			organizationId_userId: {
				organizationId: orgId,
				userId: session.user.id,
			},
		},
	});

	if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
		throw new Error("Only owners and admins can invite members");
	}

	const userToInvite = await prisma.user.findUnique({
		where: { email },
	});

	if (!userToInvite) {
		throw new Error("User not found with this email");
	}

	const existingMember = await prisma.organizationMember.findUnique({
		where: {
			organizationId_userId: {
				organizationId: orgId,
				userId: userToInvite.id,
			},
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

	return member;
}

export async function removeMember(orgId: string, userId: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const membership = await prisma.organizationMember.findUnique({
		where: {
			organizationId_userId: {
				organizationId: orgId,
				userId: session.user.id,
			},
		},
	});

	if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
		throw new Error("Only owners and admins can remove members");
	}

	if (userId === session.user.id) {
		throw new Error("Cannot remove yourself from the organization");
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

	const membership = await prisma.organizationMember.findUnique({
		where: {
			organizationId_userId: {
				organizationId: orgId,
				userId: session.user.id,
			},
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
