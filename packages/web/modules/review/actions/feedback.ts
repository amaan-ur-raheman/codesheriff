"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function submitReviewFeedback(
	reviewId: string,
	rating: number,
	comment?: string
) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const feedback = await prisma.reviewFeedback.upsert({
		where: {
			reviewId_userId: {
				reviewId,
				userId: session.user.id,
			},
		},
		update: {
			rating,
			comment: comment || null,
		},
		create: {
			reviewId,
			userId: session.user.id,
			rating,
			comment: comment || null,
		},
	});

	return feedback;
}

export async function getReviewFeedback(reviewId: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const [aggregate, userFeedback, positiveCount, negativeCount] = await Promise.all([
		prisma.reviewFeedback.aggregate({
			where: { reviewId },
			_avg: { rating: true },
			_count: { rating: true },
		}),
		prisma.reviewFeedback.findUnique({
			where: {
				reviewId_userId: {
					reviewId,
					userId: session.user.id,
				},
			},
		}),
		prisma.reviewFeedback.count({
			where: { reviewId, rating: { gte: 3 } },
		}),
		prisma.reviewFeedback.count({
			where: { reviewId, rating: { lt: 3 } },
		}),
	]);

	return {
		averageRating: aggregate._avg.rating ?? 0,
		totalFeedback: aggregate._count.rating,
		positiveCount,
		negativeCount,
		userFeedback,
	};
}

export async function getReviewFeedbackStats(reviewId: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const [aggregate, positiveCount, negativeCount] = await Promise.all([
		prisma.reviewFeedback.aggregate({
			where: { reviewId },
			_avg: { rating: true },
			_count: { rating: true },
		}),
		prisma.reviewFeedback.count({
			where: {
				reviewId,
				rating: { gte: 3 },
			},
		}),
		prisma.reviewFeedback.count({
			where: {
				reviewId,
				rating: { lt: 3 },
			},
		}),
	]);

	return {
		averageRating: aggregate._avg.rating ?? 0,
		totalFeedback: aggregate._count.rating,
		positiveCount,
		negativeCount,
	};
}
