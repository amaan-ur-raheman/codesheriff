"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";

async function requireAdmin() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		throw new Error("Unauthorized");
	}

	const user = session.user as typeof session.user & { role?: string };

	if (user.role !== "admin") {
		throw new Error("Forbidden: Admin access required");
	}

	return session;
}

export async function getAdminStats() {
	await requireAdmin();

	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const weekStart = new Date(now);
	weekStart.setDate(now.getDate() - now.getDay());
	weekStart.setHours(0, 0, 0, 0);

	const [
		totalUsers,
		totalReviews,
		activeSubscriptions,
		reviewsToday,
		reviewsThisWeek,
		recentReviews,
	] = await Promise.all([
		prisma.user.count(),
		prisma.review.count(),
		prisma.user.count({
			where: {
				subscriptionStatus: "ACTIVE",
			},
		}),
		prisma.review.count({
			where: {
				createdAt: { gte: todayStart },
			},
		}),
		prisma.review.count({
			where: {
				createdAt: { gte: weekStart },
			},
		}),
		prisma.review.findMany({
			select: {
				id: true,
				createdAt: true,
				status: true,
			},
			orderBy: { createdAt: "desc" },
			take: 100,
		}),
	]);

	const totalRevenueResult = await prisma.user.aggregate({
		_count: {
			id: true,
		},
		where: {
			subscriptionTier: "PRO",
		},
	});

	const totalRevenue = totalRevenueResult._count.id * 19;

	const errorReviews = recentReviews.filter(
		(r) => r.status === "error" || r.status === "failed"
	);
	const errorRate =
		recentReviews.length > 0
			? (errorReviews.length / recentReviews.length) * 100
			: 0;

	const avgReviewTime = 0;

	return {
		totalUsers,
		totalReviews,
		activeSubscriptions,
		totalRevenue,
		reviewsToday,
		reviewsThisWeek,
		errorRate: Math.round(errorRate * 10) / 10,
		avgReviewTime,
	};
}

export async function getUsersList(page: number = 1, limit: number = 20) {
	await requireAdmin();

	const skip = (page - 1) * limit;

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			select: {
				id: true,
				name: true,
				email: true,
				image: true,
				role: true,
				subscriptionTier: true,
				subscriptionStatus: true,
				createdAt: true,
				_count: {
					select: {
						repositories: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
			skip,
			take: limit,
		}),
		prisma.user.count(),
	]);

	return {
		users,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
	};
}

export async function getRecentReviews(limit: number = 20) {
	await requireAdmin();

	const reviews = await prisma.review.findMany({
		select: {
			id: true,
			prTitle: true,
			prNumber: true,
			prUrl: true,
			status: true,
			createdAt: true,
			repository: {
				select: {
					fullName: true,
					user: {
						select: {
							name: true,
							email: true,
						},
					},
				},
			},
		},
		orderBy: { createdAt: "desc" },
		take: limit,
	});

	return reviews;
}

export async function getSystemHealth() {
	await requireAdmin();

	const [totalUsers, totalReviews, totalRepositories, totalApiKeys] =
		await Promise.all([
			prisma.user.count(),
			prisma.review.count(),
			prisma.repository.count(),
			prisma.apiKey.count(),
		]);

	return {
		status: "healthy",
		timestamp: new Date().toISOString(),
		stats: {
			totalUsers,
			totalReviews,
			totalRepositories,
			totalApiKeys,
		},
	};
}

export async function getReviewsOverTime() {
	await requireAdmin();

	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const reviews = await prisma.review.findMany({
		where: {
			createdAt: { gte: thirtyDaysAgo },
		},
		select: {
			createdAt: true,
		},
		orderBy: { createdAt: "asc" },
	});

	const dailyCounts: Record<string, number> = {};

	const current = new Date(thirtyDaysAgo);
	const today = new Date();
	while (current <= today) {
		const key = current.toISOString().split("T")[0];
		dailyCounts[key] = 0;
		current.setDate(current.getDate() + 1);
	}

	reviews.forEach((review) => {
		const key = review.createdAt.toISOString().split("T")[0];
		if (dailyCounts[key] !== undefined) {
			dailyCounts[key]++;
		}
	});

	return Object.entries(dailyCounts).map(([date, count]) => ({
		date,
		reviews: count,
	}));
}
