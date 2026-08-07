"use server";

import prisma from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
	sendSlackWebhook,
	sendDiscordWebhook,
	postWebhookWithTimeout,
} from "@/lib/webhooks";
import { requireAdmin } from "./index";
import {
	computeVerifyMetrics,
	computeIndexingMetrics,
	loadThresholds,
	evaluateAlerts,
	type VerifySuggestion,
} from "@/modules/admin/lib/metrics";

const METRICS_WINDOW_DAYS = 7;

function windowStart(): Date {
	return new Date(Date.now() - METRICS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Verify pipeline metrics over the trailing 7 days (AC-1). Admin-only.
 */
export async function getVerifyMetrics() {
	await requireAdmin();

	const reviews = await prisma.review.findMany({
		where: { createdAt: { gte: windowStart() } },
		select: { suggestions: true },
	});

	const suggestions = reviews.flatMap(
		(r) => ((r.suggestions as VerifySuggestion[] | null) ?? [])
	);

	return {
		windowDays: METRICS_WINDOW_DAYS,
		...computeVerifyMetrics(suggestions),
	};
}

/**
 * Incremental indexing metrics over the trailing 7 days (AC-2). Admin-only.
 */
export async function getIndexingMetrics() {
	await requireAdmin();

	const runs = await prisma.indexRun.findMany({
		where: { runAt: { gte: windowStart() } },
	});

	return {
		windowDays: METRICS_WINDOW_DAYS,
		...computeIndexingMetrics(runs),
	};
}

interface AlertDelivery {
	alerts: ReturnType<typeof evaluateAlerts>;
	attemptedOrgs: number;
	deliveredToUsers: number;
}

/** In-app alerts are deduped within this lookback (the cron cadence). */
const ALERT_DEDUPE_MS = 6 * 60 * 60 * 1000;

/**
 * Internal alert check (AC-3): computes the 7d metrics, evaluates the
 * configured thresholds, and delivers fired alerts to org webhooks, admin
 * email (respecting the emailNotifications preference), and in-app
 * notifications. No user input; safe to run from a cron. Never throws on
 * delivery failures — each channel is best effort.
 */
export async function runMetricsAlertCheck(): Promise<AlertDelivery> {
	const [reviews, runs, orgs, adminUsers] = await Promise.all([
		prisma.review.findMany({
			where: { createdAt: { gte: windowStart() } },
			select: { suggestions: true },
		}),
		prisma.indexRun.findMany({
			where: { runAt: { gte: windowStart() } },
		}),
		prisma.organization.findMany({
			include: { integrations: { where: { isActive: true } } },
		}),
		prisma.user.findMany({ where: { role: "admin" } }),
	]);

	const suggestions = reviews.flatMap(
		(r) => ((r.suggestions as VerifySuggestion[] | null) ?? [])
	);
	const verify = computeVerifyMetrics(suggestions);
	const indexing = computeIndexingMetrics(runs);
	const alerts = evaluateAlerts(verify, indexing, loadThresholds(process.env));

	if (alerts.length === 0) {
		return { alerts: [], attemptedOrgs: 0, deliveredToUsers: 0 };
	}

	const summary = alerts.map((a) => a.message).join(" ");
	const title = `Code Sheriff metrics alert: ${alerts.length} threshold(s) crossed`;

	let attemptedOrgs = 0;
	let deliveredToUsers = 0;

	// Org Slack/Discord webhooks.
	for (const org of orgs) {
		const configs = org.integrations;
		if (configs.length === 0) continue;
		for (const cfg of configs) {
			const webhookUrl = (cfg.config as { webhookUrl?: string } | null)
				?.webhookUrl;
			if (!webhookUrl) continue;				try {
				if (cfg.type === "slack") {
					await postWebhookWithTimeout(async () => {
						const result = await sendSlackWebhook(webhookUrl, {
							text: summary,
							blocks: [
								{
									type: "section",
									text: { type: "mrkdwn", text: `:rotating_light: ${summary}` },
								},
							],
						});
						if (!result.success) {
							throw new Error(result.error || "Slack webhook delivery failed");
						}
					});
				} else if (cfg.type === "discord") {
					await postWebhookWithTimeout(async () => {
						const result = await sendDiscordWebhook(webhookUrl, {
							content: "",
							embeds: [
								{
									title: "Code Sheriff metrics alert",
									description: summary,
									color: 0xdc2626,
								},
							],
						});
						if (!result.success) {
							throw new Error(
								result.error || "Discord webhook delivery failed"
							);
						}
					});
				}
			} catch (err) {
				console.error(
					`Metrics alert webhook delivery failed (${cfg.type}, org ${org.id}):`,
					err
				);
			}
		}
		attemptedOrgs++;
	}

	// Admin email + in-app notifications (respect emailNotifications).
	for (const user of adminUsers) {
		try {
			// Dedupe: skip the in-app notification when one was already created
			// within the cron cadence — recurring alerts shouldn't pile up.
			const existing = await prisma.notification.findFirst({
				where: {
					userId: user.id,
					type: "metrics_alert",
					createdAt: { gte: new Date(Date.now() - ALERT_DEDUPE_MS) },
				},
			});
			if (!existing) {
				await prisma.notification.create({
					data: {
						userId: user.id,
						type: "metrics_alert",
						title,
						message: summary,
					},
				});
			}
			deliveredToUsers++;

			if (user.emailNotifications !== false && user.email) {
				await sendEmail({
					to: user.email,
					subject: title,
					html: `<p><strong>${title}</strong></p><ul>${alerts
						.map((a) => `<li>${a.message}</li>`)
						.join("")}</ul>`,
				});
			}
		} catch (deliveryError) {
			// Best effort: one admin's delivery failure never blocks the rest.
			console.error(
				`Metrics alert delivery failed for user ${user.id}:`,
				deliveryError
			);
		}
	}

	return { alerts, attemptedOrgs, deliveredToUsers };
}
