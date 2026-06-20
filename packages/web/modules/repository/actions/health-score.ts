"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function calculateHealthScore(
	repositoryId: string
): Promise<number> {
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

	const reviews = await prisma.review.findMany({
		where: { repositoryId },
		include: { feedbacks: { select: { rating: true } } },
		orderBy: { createdAt: "asc" },
	});

	if (reviews.length === 0) {
		return 0;
	}

	// Review completion rate (completed vs total) - 30%
	const completedReviews = reviews.filter(
		(r) => r.status === "completed"
	).length;
	const completionRate = completedReviews / reviews.length;
	const completionScore = completionRate * 30;

	// Average feedback rating - 30%
	const allFeedbacks = reviews.flatMap((r) => r.feedbacks);
	const avgRating =
		allFeedbacks.length > 0
			? allFeedbacks.reduce((sum, f) => sum + f.rating, 0) /
			  allFeedbacks.length
			: 3;
	// Normalize to 0-30 (assume 1-5 scale, 5 = best)
	const ratingScore = ((avgRating - 1) / 4) * 30;

	// Issue density (issues found per review) - 20%
	// Lower issue density = higher score
	const totalIssues = reviews.reduce((sum, r) => {
		const suggestions = (r.suggestions as any[]) || [];
		return sum + suggestions.length;
	}, 0);
	const avgIssuesPerReview = totalIssues / reviews.length;
	// Assume 0 issues = 100%, 10+ issues = 0%
	const densityScore = Math.max(0, (1 - avgIssuesPerReview / 10)) * 20;

	// Trend (improving or declining) - 20%
	const midpoint = Math.floor(reviews.length / 2);
	const firstHalf = reviews.slice(0, midpoint);
	const secondHalf = reviews.slice(midpoint);

	const getAvgScore = (subset: typeof reviews) => {
		if (subset.length === 0) return 0;
		const issues = subset.reduce((sum, r) => {
			const s = (r.suggestions as any[]) || [];
			return sum + s.length;
		}, 0);
		return subset.length > 0 ? issues / subset.length : 0;
	};

	const firstHalfAvg = getAvgScore(firstHalf);
	const secondHalfAvg = getAvgScore(secondHalf);

	// If second half has fewer issues, trend is positive
	let trendScore = 10;
	if (secondHalfAvg < firstHalfAvg) {
		trendScore = 20;
	} else if (secondHalfAvg > firstHalfAvg) {
		trendScore = Math.max(0, 10 - (secondHalfAvg - firstHalfAvg) * 2);
	}

	const healthScore = Math.round(
		completionScore + ratingScore + densityScore + trendScore
	);

	const score = Math.min(100, Math.max(0, healthScore));

	// Persist the score to the latest review
	const latestReview = reviews[reviews.length - 1];
	if (latestReview) {
		await prisma.review.update({
			where: { id: latestReview.id },
			data: { healthScore: score },
		});
	}

	return score;
}

export async function getHealthScores() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const repos = await prisma.repository.findMany({
		where: { userId: session.user.id },
		include: {
			reviews: {
				select: { healthScore: true },
				where: { healthScore: { not: null } },
			},
		},
	});

	return repos.map((repo) => {
		const scores = repo.reviews
			.map((r) => r.healthScore)
			.filter((s): s is number => s !== null);

		const avgScore =
			scores.length > 0
				? scores.reduce((sum, s) => sum + s, 0) / scores.length
				: 0;

		return {
			repositoryId: repo.id,
			repositoryName: repo.name,
			healthScore: Math.round(avgScore),
			reviewCount: repo.reviews.length,
		};
	});
}

export async function getHealthTrend(
	repositoryId: string,
	months: number = 6
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

	const startDate = new Date();
	startDate.setMonth(startDate.getMonth() - months);

	const reviews = await prisma.review.findMany({
		where: {
			repositoryId,
			createdAt: { gte: startDate },
		},
		select: {
			createdAt: true,
			healthScore: true,
			suggestions: true,
			feedbacks: { select: { rating: true } },
		},
		orderBy: { createdAt: "asc" },
	});

	const monthNames = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];

	const now = new Date();
	const monthlyData: Record<string, { score: number; count: number }> = {};

	for (let i = months - 1; i >= 0; i--) {
		const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const key = `${date.getFullYear()}-${monthNames[date.getMonth()]}`;
		monthlyData[key] = { score: 0, count: 0 };
	}

	reviews.forEach((review) => {
		const date = new Date(review.createdAt);
		const key = `${date.getFullYear()}-${monthNames[date.getMonth()]}`;

		if (monthlyData[key]) {
			const score = review.healthScore ?? 50;
			monthlyData[key].score += score;
			monthlyData[key].count += 1;
		}
	});

	return Object.entries(monthlyData).map(([month, data]) => ({
		month,
		healthScore: data.count > 0 ? Math.round(data.score / data.count) : null,
	}));
}
