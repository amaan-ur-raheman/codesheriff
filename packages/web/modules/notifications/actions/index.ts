"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
	sendSlackWebhook,
	sendDiscordWebhook,
	postWebhookWithTimeout,
} from "@/lib/webhooks";
import {
	reviewCompletedEmail,
	reviewFailedEmail,
	usageLimitWarningEmail,
	subscriptionChangedEmail,
	commentReplyEmail,
} from "../lib/email-templates";

async function getSession() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}
	return session;
}

async function shouldSendEmail(userId: string): Promise<boolean> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { emailNotifications: true },
	});
	return user?.emailNotifications !== false;
}

interface WebhookPayload {
	type: "completed" | "failed";
	prNumber: number;
	prTitle: string;
	prUrl: string;
	repositoryName: string;
	error?: string;
}

const WEBHOOK_TIMEOUT_MS = Number(process.env.WEBHOOK_DELIVERY_TIMEOUT_MS) || 5000;

async function deliverToIntegrations(
	orgId: string | null | undefined,
	payload: WebhookPayload
): Promise<void> {
	if (!orgId) return;
	if (process.env.WEBHOOK_DELIVERY_ENABLED === "false") return;

	const configs = await prisma.integrationConfig.findMany({
		where: { organizationId: orgId, isActive: true },
	});

	const title = `#${payload.prNumber} ${payload.prTitle}`;
	const text =
		payload.type === "failed"
			? `:horse: Review failed for ${title}${payload.error ? `: ${payload.error}` : ""}`
			: `:horse: Review complete for ${title}`;

	for (const cfg of configs) {
		const webhookUrl = (cfg.config as { webhookUrl?: string } | null)?.webhookUrl;
		if (!webhookUrl) continue;			try {
				if (cfg.type === "slack") {
					await postWebhookWithTimeout(async () => {
					const result = await sendSlackWebhook(webhookUrl, {
						text,
						blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
					});
					if (!result.success) {
						throw new Error(result.error || "Slack webhook delivery failed");
					}					}, WEBHOOK_TIMEOUT_MS);
				} else if (cfg.type === "discord") {
				await postWebhookWithTimeout(async () => {
					const result = await sendDiscordWebhook(webhookUrl, {
						content: "",
						embeds: [
							{
								title: `Code Sheriff Review ${payload.type === "failed" ? "Failed" : "Complete"}`,
								description: `${payload.repositoryName} · ${title}${payload.error ? `\n${payload.error}` : ""}`,
								color: payload.type === "failed" ? 0xff0000 : 0x7c3aed,
							},
						],
					})
					if (!result.success) {
						throw new Error(result.error || "Discord webhook delivery failed");
					}
				}, WEBHOOK_TIMEOUT_MS);
			}
		} catch (err) {
			console.error(`Webhook delivery failed (${cfg.type}, org ${orgId}):`, err);
		}
	}
}

export async function getNotifications(limit: number = 20) {
	const session = await getSession();

	return prisma.notification.findMany({
		where: { userId: session.user.id },
		orderBy: [{ read: "asc" }, { createdAt: "desc" }],
		take: limit,
	});
}

export async function getUnreadCount() {
	const session = await getSession();

	const count = await prisma.notification.count({
		where: { userId: session.user.id, read: false },
	});

	return count;
}

export async function markAsRead(notificationId: string) {
	const session = await getSession();

	await prisma.notification.updateMany({
		where: { id: notificationId, userId: session.user.id },
		data: { read: true },
	});
}

export async function markAllAsRead() {
	const session = await getSession();

	await prisma.notification.updateMany({
		where: { userId: session.user.id, read: false },
		data: { read: true },
	});
}

interface NotificationData {
	reviewId?: string;
	prNumber?: number;
	prUrl?: string;
	usageType?: string;
	current?: number;
	limit?: number;
	newTier?: string;
	status?: string;
}

async function createNotification(
	userId: string,
	type: string,
	title: string,
	message: string,
	data?: NotificationData
) {
	const existing = await prisma.notification.findFirst({
		where: {
			userId,
			type,
			...(data?.reviewId
				? { data: { path: ["reviewId"], equals: data.reviewId } }
				: {}),
		},
	});

	if (existing) return existing;

	return prisma.notification.create({
		data: { userId, type, title, message, data: data as any },
	});
}

export async function sendReviewCompletedNotification(reviewId: string) {
	const review = await prisma.review.findUnique({
		where: { id: reviewId },
		include: { repository: { include: { user: true } } },
	});

	if (!review || !review.repository?.user?.email) return;

	const user = review.repository.user;
	const reviewUrl = `https://codesheriff.app/dashboard/reviews/${review.id}`;

	await createNotification(
		user.id,
		"review_completed",
		"Review Complete",
		`Review for #${review.prNumber} ${review.prTitle} is ready.`,
		{ reviewId, prNumber: review.prNumber, prUrl: review.prUrl }
	);

	try {
		if (await shouldSendEmail(user.id)) {
			await sendEmail({
				to: user.email,
				subject: `Review complete: #${review.prNumber} ${review.prTitle}`,
				html: reviewCompletedEmail(
					review.prTitle,
					review.prNumber,
					review.repository.fullName,
					reviewUrl
				),
			});
		}
	} catch (emailError) {
		console.error("Failed to send review completed email:", emailError);
	}

	try {
		await deliverToIntegrations(review.repository.orgId, {
			type: "completed",
			prNumber: review.prNumber,
			prTitle: review.prTitle,
			prUrl: review.prUrl,
			repositoryName: review.repository.fullName,
		});
	} catch (webhookError) {
		console.error("Failed to deliver review webhook:", webhookError);
	}
}

export async function sendReviewFailedNotification(
	reviewId: string,
	error: string
) {
	const review = await prisma.review.findUnique({
		where: { id: reviewId },
		include: { repository: { include: { user: true } } },
	});

	if (!review || !review.repository?.user?.email) return;

	const user = review.repository.user;

	await createNotification(
		user.id,
		"review_failed",
		"Review Failed",
		`Review for #${review.prNumber} ${review.prTitle} failed: ${error}`,
		{ reviewId, prNumber: review.prNumber, prUrl: review.prUrl }
	);

	try {
		if (await shouldSendEmail(user.id)) {
			await sendEmail({
				to: user.email,
				subject: `Review failed: #${review.prNumber} ${review.prTitle}`,
				html: reviewFailedEmail(
					review.prTitle,
					review.prNumber,
					review.repository.fullName,
					error
				),
			});
		}
	} catch (emailError) {
		console.error("Failed to send review failed email:", emailError);
	}

	try {
		await deliverToIntegrations(review.repository.orgId, {
			type: "failed",
			prNumber: review.prNumber,
			prTitle: review.prTitle,
			prUrl: review.prUrl,
			repositoryName: review.repository.fullName,
			error,
		});
	} catch (webhookError) {
		console.error("Failed to deliver review webhook:", webhookError);
	}
}

export async function sendUsageLimitWarning(
	userId: string,
	usageType: string,
	current: number,
	limit: number
) {
	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user?.email) return;

	const percent = limit > 0 ? Math.round((current / limit) * 100) : 0;

	await createNotification(
		userId,
		"usage_warning",
		"Usage Warning",
		`${percent}% of monthly ${usageType} used.`,
		{ usageType, current, limit }
	);

	try {
		if (await shouldSendEmail(userId)) {
			await sendEmail({
				to: user.email,
				subject: `Usage warning: ${percent}% of monthly ${usageType} used`,
				html: usageLimitWarningEmail(usageType, current, limit),
			});
		}
	} catch (emailError) {
		console.error("Failed to send usage limit warning email:", emailError);
	}
}

export async function sendSubscriptionChangedNotification(
	userId: string,
	newTier: string,
	status: string
) {
	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user?.email) return;

	await createNotification(
		userId,
		"subscription_changed",
		"Subscription Updated",
		`Your subscription has been updated to ${newTier} (${status}).`,
		{ newTier, status }
	);

	try {
		if (await shouldSendEmail(userId)) {
			await sendEmail({
				to: user.email,
				subject: `Subscription updated: ${newTier} (${status})`,
				html: subscriptionChangedEmail(newTier, status),
			});
		}
	} catch (emailError) {
		console.error("Failed to send subscription changed email:", emailError);
	}
}

export async function sendCommentReplyNotification(
	reviewId: string,
	replyContent: string
) {
	const review = await prisma.review.findUnique({
		where: { id: reviewId },
		include: { repository: { include: { user: true } } },
	});

	if (!review || !review.repository?.user?.email) return;

	const user = review.repository.user;
	const snippet = replyContent.slice(0, 300) + (replyContent.length > 300 ? "..." : "");

	await createNotification(
		user.id,
		"comment_reply",
		"Code Sheriff Replied",
		`Code Sheriff replied to your comment on #${review.prNumber} ${review.prTitle}.`,
		{ reviewId, prNumber: review.prNumber, prUrl: review.prUrl }
	);

	try {
		if (await shouldSendEmail(user.id)) {
			await sendEmail({
				to: user.email,
				subject: `Code Sheriff replied: #${review.prNumber} ${review.prTitle}`,
				html: commentReplyEmail(
					review.prTitle,
					review.prNumber,
					review.repository.fullName,
					snippet,
					review.prUrl
				),
			});
		}
	} catch (emailError) {
		console.error("Failed to send comment reply email:", emailError);
	}
}
