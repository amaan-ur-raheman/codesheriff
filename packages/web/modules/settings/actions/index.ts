"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { deleteWebhook } from "@/modules/github/lib/github";
import { decrementRepositoryCount } from "@/modules/payment/lib/subscription";

export async function getUserProfile() {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			throw new Error("Unauthorized");
		}

		const user = await prisma.user.findUnique({
			where: {
				id: session.user.id,
			},
			select: {
				id: true,
				name: true,
				email: true,
				image: true,
				createdAt: true,
			},
		});

		return user;
	} catch (error) {
		console.error("Error fetching user profile:", error);
		return null;
	}
}

export async function updateUserProfile(data: {
	name?: string;
	email?: string;
}) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			throw new Error("Unauthorized");
		}

		const updatedUser = await prisma.user.update({
			where: {
				id: session.user.id,
			},
			data: {
				name: data.name,
				email: data.email,
			},
			select: {
				id: true,
				name: true,
				email: true,
			},
		});

		revalidatePath("/dashboard/settings", "page");

		return {
			success: true,
			user: updatedUser,
		};
	} catch (error) {
		console.error("Error updating user profile:", error);
		return { success: false, error: "Failed to update profile" };
	}
}

export async function getConnectedRepositories() {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			throw new Error("Unauthorized");
		}

		const repositories = await prisma.repository.findMany({
			where: {
				userId: session.user.id,
			},
			select: {
				id: true,
				name: true,
				fullName: true,
				url: true,
				createdAt: true,
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		return repositories;
	} catch (error) {
		console.error("Error fetching connected repositories:", error);
		return [];
	}
}

export async function disconnectRepository(repositoryId: string) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			throw new Error("Unauthorized");
		}

		const repository = await prisma.repository.findUnique({
			where: {
				id: repositoryId,
				userId: session.user.id,
			},
		});

		if (!repository) {
			throw new Error("Repository not found or not owned by user");
		}

		await deleteWebhook(repository.owner, repository.name);

		await prisma.repository.delete({
			where: {
				id: repositoryId,
				userId: session.user.id,
			},
		});

		await decrementRepositoryCount(session.user.id);

		revalidatePath("/dashboard/settings", "page");
		revalidatePath("/dashboard/repository", "page");
		revalidatePath("/dashboard/reviews", "page");

		return { success: true };
	} catch (error) {
		console.error("Error disconnecting repository:", error);
		return { success: false, error: "Failed to disconnect repository" };
	}
}

export async function disconnectAllRepositories() {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			throw new Error("Unauthorized");
		}

	const repositories = await prisma.repository.findMany({
		where: {
			userId: session.user.id,
		},
	});

	// Delete webhooks in parallel
	await Promise.all(
		repositories.map(async (repo) => {
			await deleteWebhook(repo.owner, repo.name);
		})
	);

	// Delete all repositories from database
	const result = await prisma.repository.deleteMany({
		where: {
			userId: session.user.id,
		},
	});

	// Decrement count by the number of repositories deleted
	for (let i = 0; i < result.count; i++) {
		await decrementRepositoryCount(session.user.id);
	}

		revalidatePath("/dashboard/settings", "page");
		revalidatePath("/dashboard/repository", "page");
		revalidatePath("/dashboard/reviews", "page");

		return { success: true, count: result.count };
	} catch (error) {
		console.error("Error disconnecting all repositories:", error);
		return {
			success: false,
			error: "Failed to disconnect all repositories",
		};
	}
}
