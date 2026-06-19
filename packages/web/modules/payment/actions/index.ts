"use server";

import { auth } from "@/lib/auth";
import {
	getRemainingLimits,
	updateUserTier,
} from "@/modules/payment/lib/subscription";
import { polarClient } from "@/modules/payment/config/polar";
import prisma from "@/lib/db";

import { headers } from "next/headers";

export interface SubscriptionData {
	user: {
		id: string;
		name: string;
		email: string;
		subscriptionTier: string;
		subscriptionStatus: string | null;
		polarCustomerId: string | null;
		polarSubscriptionId: string | null;
	} | null;
	limits: {
		tier: "FREE" | "PRO";
		repositories: {
			current: number;
			limit: number | null;
			canAdd: boolean;
		};
		reviews: {
			[repositoryId: string]: {
				current: number;
				limit: number | null;
				canAdd: boolean;
			};
		};
	} | null;
}

/**
 * Retrieves the current user's subscription data and usage limits.
 *
 * @returns An object containing user details and limit information.
 */
export async function getSubscriptionData(): Promise<SubscriptionData> {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		return { user: null, limits: null };
	}

	const user = await prisma.user.findUnique({
		where: { id: session.user.id },
	});

	if (!user) {
		return { user: null, limits: null };
	}

	const limits = await getRemainingLimits(user.id);

	return {
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			subscriptionTier: user.subscriptionTier || "FREE",
			subscriptionStatus: user.subscriptionStatus || null,
			polarCustomerId: user.polarCustomerId || null,
			polarSubscriptionId: user.polarSubscriptionId || null,
		},
		limits,
	};
}

/**
 * Syncs the user's subscription status with Polar.sh.
 * Checks for active or cancelled subscriptions and updates the local database.
 *
 * @throws Error if user is not authenticated.
 * @returns Object indicating success status and the new subscription status.
 */
export async function syncSubscriptionStatus() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		throw new Error("Not authenticated");
	}

	const user = await prisma.user.findUnique({
		where: { id: session.user.id },
	});

	if (!user || !user.polarCustomerId) {
		return { success: false, message: "No Polar customer ID found" };
	}

	try {
		// Fetch subscriptions from Polar
		const result = await polarClient.subscriptions.list({
			customerId: user.polarCustomerId,
		});

		const subscriptions = result.result?.items || [];

		// Find the most relevant subscription (active or most recent)
		const activeSub = subscriptions.find(
			(sub: any) => sub.status === "active"
		);
		const latestSub = subscriptions[0]; // Assuming API returns sorted or we should sort

		if (activeSub) {
			await updateUserTier(user.id, "PRO", "ACTIVE", activeSub.id);
			return { success: true, status: "ACTIVE" };
		} else if (latestSub) {
			// If latest is canceled/expired
			const status =
				latestSub.status === "canceled" ? "CANCELLED" : "EXPIRED";
			// Only downgrade if we are sure it's not active
			if (latestSub.status !== "active") {
				await updateUserTier(user.id, "FREE", status, latestSub.id);
			}
			return { success: true, status };
		}

		return { success: true, status: "NO_SUBSCRIPTION" };
	} catch (error) {
		console.error("Failed to sync subscription:", error);
		return { success: false, error: "Failed to sync with Polar" };
	}
}
