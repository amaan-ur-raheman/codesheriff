"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getActiveReviews() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) throw new Error("Unauthorized");

	const reviews = await prisma.review.findMany({
		where: {
			repository: { userId: session.user.id },
			status: { in: ["pending", "in_progress"] },
		},
		select: {
			id: true,
			prTitle: true,
			prNumber: true,
			status: true,
			repository: { select: { fullName: true } },
		},
		orderBy: { createdAt: "desc" },
	});

	return reviews;
}
