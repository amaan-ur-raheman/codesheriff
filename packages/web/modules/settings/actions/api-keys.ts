"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

function hashKey(key: string): string {
	return createHash("sha256").update(key).digest("hex");
}

function generateApiKey(): string {
	const random = randomBytes(32).toString("hex");
	return `ch_${random}`;
}

async function requireAuth() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		throw new Error("Unauthorized");
	}

	return session;
}

export async function createApiKey(name: string) {
	const session = await requireAuth();

	const plainKey = generateApiKey();
	const keyHash = hashKey(plainKey);

	const apiKey = await prisma.apiKey.create({
		data: {
			userId: session.user.id,
			name,
			key: keyHash,
		},
	});

	revalidatePath("/dashboard/settings", "page");

	return {
		id: apiKey.id,
		name: apiKey.name,
		key: plainKey,
		createdAt: apiKey.createdAt,
	};
}

export async function getApiKeys() {
	const session = await requireAuth();

	const keys = await prisma.apiKey.findMany({
		where: {
			userId: session.user.id,
		},
		select: {
			id: true,
			name: true,
			lastUsed: true,
			expiresAt: true,
			createdAt: true,
		},
		orderBy: { createdAt: "desc" },
	});

	return keys;
}

export async function deleteApiKey(keyId: string) {
	const session = await requireAuth();

	const key = await prisma.apiKey.findUnique({
		where: { id: keyId },
	});

	if (!key || key.userId !== session.user.id) {
		throw new Error("API key not found or not owned by user");
	}

	await prisma.apiKey.delete({
		where: { id: keyId },
	});

	revalidatePath("/dashboard/settings", "page");

	return { success: true };
}

async function validateApiKey(key: string) {
	const keyHash = hashKey(key);

	const apiKey = await prisma.apiKey.findUnique({
		where: { key: keyHash },
		include: {
			user: {
				select: {
					id: true,
					name: true,
					email: true,
					role: true,
					subscriptionTier: true,
				},
			},
		},
	});

	if (!apiKey) {
		return null;
	}

	if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
		return null;
	}

	await prisma.apiKey.update({
		where: { id: apiKey.id },
		data: { lastUsed: new Date() },
	});

	return apiKey.user;
}
