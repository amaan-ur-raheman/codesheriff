/**
 * Authentication configuration using Better Auth.
 *
 * This file sets up the authentication system for Code Sheriff, including:
 * - PostgreSQL adapter (via Prisma) for storing user data.
 * - GitHub OAuth provider for user login.
 * - Integration with Polar.sh for subscription management.
 * - Webhook handlers for syncing Polar subscription events to the local database.
 *
 * @module lib/auth
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
	polar,
	checkout,
	portal,
	usage,
	webhooks,
} from "@polar-sh/better-auth";

import prisma from "./db";
import { polarClient } from "@/modules/payment/config/polar";
import {
	SubscriptionTier,
	updatePolarCustomerId,
	updateUserTier,
} from "@/modules/payment/lib/subscription";

if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
	throw new Error("Missing required GitHub OAuth environment variables");
}

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	socialProviders: {
		github: {
			clientId: process.env.GITHUB_CLIENT_ID,
			clientSecret: process.env.GITHUB_CLIENT_SECRET,
			scope: ["repo"],
		},
	},
	trustedOrigins: [
		"http://localhost:3000",
		"https://codesheriff.vercel.app",
		"https://kamden-epeiric-caiden.ngrok-free.dev",
	],
	plugins: [
		polar({
			client: polarClient,
			createCustomerOnSignUp: true,
			use: [
				checkout({
					products: [
						{
							productId: "087676b3-70c9-4135-943c-5892a93a92b8",
							slug: "pro", // Custom slug for easy reference in Checkout URL, e.g. /checkout/pro
						},
					],
					successUrl:
						process.env.POLAR_SUCCESS_URL ||
						"/dashboard/subscriptions?success=true",
					authenticatedUsersOnly: true,
				}),
				portal({
					returnUrl:
						process.env.NEXT_PUBLIC_APP_URL ||
						"http://localhost:3000/dashboard",
				}),
				usage(),
				webhooks({
					secret: process.env.POLAR_WEBHOOK_SECRET!,
					/**
					 * Handles the 'subscription.active' event from Polar.
					 * Updates the user's tier to PRO and status to ACTIVE.
					 */
					onSubscriptionActive: async (payload) => {
						const customerId = payload.data.customerId;

						const user = await prisma.user.findUnique({
							where: {
								polarCustomerId: customerId,
							},
						});

						if (user) {
							await updateUserTier(
								user.id,
								"PRO",
								"ACTIVE",
								payload.data.id
							);
						}
					},
					/**
					 * Handles the 'subscription.canceled' event from Polar.
					 * Updates the user's status to CANCELLED.
					 * Note: The tier might remain valid until the end of the billing period,
					 * but here we just mark the status.
					 */
					onSubscriptionCanceled: async (payload) => {
						const customerId = payload.data.customerId;

						const user = await prisma.user.findUnique({
							where: {
								polarCustomerId: customerId,
							},
						});

					if (user) {
						await updateUserTier(
							user.id,
							user.subscriptionTier as SubscriptionTier,
							"CANCELLED"
						);
					}
					},
					/**
					 * Handles the 'subscription.revoked' event from Polar.
					 * Downgrades the user to FREE and updates status to EXPIRED.
					 */
					onSubscriptionRevoked: async (payload) => {
						const customerId = payload.data.customerId;

						const user = await prisma.user.findUnique({
							where: {
								polarCustomerId: customerId,
							},
						});

						if (user) {
							await updateUserTier(user.id, "FREE", "EXPIRED");
						}
					},
					onOrderPaid: async () => {},
					/**
					 * Handles the 'customer.created' event.
					 * Links the local user record with the Polar customer ID.
					 */
					onCustomerCreated: async (payload) => {
						const user = await prisma.user.findUnique({
							where: {
								email: payload.data.email,
							},
						});

						if (user) {
							await updatePolarCustomerId(
								user.id,
								payload.data.id
							);
						}
					},
					/**
					 * Org billing (Spec 0003): reconcile organization subscriptions.
					 * Subscription lifecycle events on an ORG customer update the
					 * org's stored subscription id, so seat enforcement (AC-3) knows
					 * whether the org is paid. Seat events are reconciliation no-ops
					 * locally: member add/remove already keeps active count in sync.
					 */
					onPayload: async (payload: { type: string; data: any }) => {
						if (!payload || typeof payload.type !== "string") return;

						const type = payload.type as string;
						const customerId: string | undefined =
							payload.data?.customerId;

						// Subscription lifecycle events on an org customer.
						if (
							type.startsWith("subscription.") &&
							customerId
						) {
							const org = await prisma.organization.findUnique({
								where: { polarCustomerId: customerId },
							});

							if (org) {
								await prisma.organization.update({
									where: { id: org.id },
									data: {
										polarSubscriptionId:
											type === "subscription.revoked" ||
											type === "subscription.canceled"
												? null
												: payload.data?.id ?? org.polarSubscriptionId,
										},
								});
							}
						}
					},
				}),
			],
		}),
	],
});
