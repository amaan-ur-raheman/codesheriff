import prisma from "@/lib/db";
import { sendSlackWebhook, sendDiscordWebhook } from "@/lib/webhooks";
import type { ReviewContext } from "../context";

/**
 * Step: send-webhook-notifications
 * Delivers the review-complete event to the org's active Slack/Discord
 * integrations for every org the repository owner belongs to.
 */
export async function sendWebhookNotifications(
	ctx: ReviewContext,
	review: string
): Promise<void> {
	const repository = await prisma.repository.findFirst({
		where: { owner: ctx.owner, name: ctx.repo },
		include: {
			user: {
				include: {
					organizationMemberships: {
						include: {
							organization: {
								include: {
									integrations: {
										where: { isActive: true },
									},
								},
							},
						},
					},
				},
			},
		},
	});

	if (!repository) return;

	const reviewSummary =
		typeof review === "string"
			? review.slice(0, 2000)
			: "Review completed";

	for (const membership of repository.user.organizationMemberships) {
		for (const integration of membership.organization.integrations) {
			const config = integration.config as any;
			const webhookUrl = config?.webhookUrl;
			if (!webhookUrl) continue;

			if (integration.type === "slack") {
				await sendSlackWebhook(webhookUrl, {
					text: `:horse: Review completed for PR #${ctx.prNumber} in ${ctx.owner}/${ctx.repo}`,
					blocks: [
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: `:white_check_mark: *Review Complete*\n*PR:* <${`https://github.com/${ctx.owner}/${ctx.repo}/pull/${ctx.prNumber}`}|#${ctx.prNumber} ${ctx.title}>\n*Repo:* ${ctx.owner}/${ctx.repo}\n\n${reviewSummary.slice(0, 300)}...`,
							},
						},
					],
				});
			} else if (integration.type === "discord") {
				await sendDiscordWebhook(webhookUrl, {
					content: "",
					embeds: [
						{
							title: `Review Complete: #${ctx.prNumber} ${ctx.title}`,
							description: reviewSummary.slice(0, 2000),
							url: `https://github.com/${ctx.owner}/${ctx.repo}/pull/${ctx.prNumber}`,
							color: 0x22c55e,
							author: {
								name: `${ctx.owner}/${ctx.repo}`,
							},
						},
					],
				});
			}
		}
	}
}
