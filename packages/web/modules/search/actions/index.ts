"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export interface SearchResult {
	type: "repository" | "review";
	title: string;
	description: string;
	url: string;
	icon: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
	if (!query || query.trim().length === 0) {
		return [];
	}

	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return [];
	}

	const searchTerm = query.trim();

	const [repositories, reviews] = await Promise.all([
		prisma.repository.findMany({
			where: {
				userId: session.user.id,
				OR: [
					{ name: { contains: searchTerm, mode: "insensitive" } },
					{ fullName: { contains: searchTerm, mode: "insensitive" } },
				],
			},
			take: 5,
			orderBy: { updatedAt: "desc" },
		}),
		prisma.review.findMany({
			where: {
				repository: {
					userId: session.user.id,
				},
				prTitle: { contains: searchTerm, mode: "insensitive" },
			},
			take: 5,
			orderBy: { createdAt: "desc" },
		}),
	]);

	const results: SearchResult[] = [
		...repositories.map((repo) => ({
			type: "repository" as const,
			title: repo.fullName,
			description: repo.url,
			url: `/dashboard/repository?id=${repo.id}`,
			icon: "GitRepository",
		})),
		...reviews.map((review) => ({
			type: "review" as const,
			title: `PR #${review.prNumber}: ${review.prTitle}`,
			description: review.status,
			url: `/dashboard/reviews?id=${review.id}`,
			icon: "PullRequest",
		})),
	];

	return results;
}
