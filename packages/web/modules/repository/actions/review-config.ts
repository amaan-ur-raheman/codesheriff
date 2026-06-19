"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getReviewConfig(repositoryId: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const repo = await prisma.repository.findUnique({
		where: { id: repositoryId },
		select: { userId: true },
	});

	if (!repo || repo.userId !== session.user.id) {
		throw new Error("Repository not found");
	}

	const config = await prisma.reviewConfig.findUnique({
		where: { repositoryId },
	});

	if (config) {
		return config;
	}

	return prisma.reviewConfig.create({
		data: { repositoryId },
	});
}

export async function updateReviewConfig(
	repositoryId: string,
	data: {
		focusAreas?: string[];
		minSeverity?: string;
		autoReview?: boolean;
		customPrompt?: string;
	}
) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const repo = await prisma.repository.findUnique({
		where: { id: repositoryId },
		select: { userId: true },
	});

	if (!repo || repo.userId !== session.user.id) {
		throw new Error("Repository not found");
	}

	await prisma.reviewConfig.upsert({
		where: { repositoryId },
		create: {
			repositoryId,
			focusAreas: data.focusAreas ?? [
				"security",
				"performance",
				"readability",
				"maintainability",
			],
			minSeverity: data.minSeverity ?? "warning",
			autoReview: data.autoReview ?? true,
			customPrompt: data.customPrompt ?? null,
		},
		update: {
			...(data.focusAreas !== undefined && { focusAreas: data.focusAreas }),
			...(data.minSeverity !== undefined && { minSeverity: data.minSeverity }),
			...(data.autoReview !== undefined && { autoReview: data.autoReview }),
			...(data.customPrompt !== undefined && { customPrompt: data.customPrompt }),
		},
	});

	return { success: true };
}

export async function getCustomRules(repositoryId: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const repo = await prisma.repository.findUnique({
		where: { id: repositoryId },
		select: { userId: true },
	});

	if (!repo || repo.userId !== session.user.id) {
		throw new Error("Repository not found");
	}

	return prisma.customReviewRule.findMany({
		where: { repositoryId },
		orderBy: { createdAt: "desc" },
	});
}

export async function createCustomRule(
	repositoryId: string,
	name: string,
	description: string,
	ruleContent: string
) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const repo = await prisma.repository.findUnique({
		where: { id: repositoryId },
		select: { userId: true },
	});

	if (!repo || repo.userId !== session.user.id) {
		throw new Error("Repository not found");
	}

	return prisma.customReviewRule.create({
		data: {
			repositoryId,
			name,
			description: description || null,
			ruleContent,
		},
	});
}

export async function updateCustomRule(
	ruleId: string,
	data: {
		name?: string;
		description?: string;
		ruleContent?: string;
		isActive?: boolean;
	}
) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const rule = await prisma.customReviewRule.findUnique({
		where: { id: ruleId },
		include: { repository: { select: { userId: true } } },
	});

	if (!rule || rule.repository.userId !== session.user.id) {
		throw new Error("Rule not found");
	}

	return prisma.customReviewRule.update({
		where: { id: ruleId },
		data: {
			...(data.name !== undefined && { name: data.name }),
			...(data.description !== undefined && { description: data.description }),
			...(data.ruleContent !== undefined && { ruleContent: data.ruleContent }),
			...(data.isActive !== undefined && { isActive: data.isActive }),
		},
	});
}

export async function deleteCustomRule(ruleId: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const rule = await prisma.customReviewRule.findUnique({
		where: { id: ruleId },
		include: { repository: { select: { userId: true } } },
	});

	if (!rule || rule.repository.userId !== session.user.id) {
		throw new Error("Rule not found");
	}

	await prisma.customReviewRule.delete({
		where: { id: ruleId },
	});

	return { success: true };
}
