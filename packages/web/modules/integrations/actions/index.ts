"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { sendSlackWebhook, sendDiscordWebhook } from "@/lib/webhooks";

async function getSession() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}
	return session;
}

async function requireOrgMembership(orgId: string) {
	const session = await getSession();

	const membership = await prisma.organizationMember.findUnique({
		where: {
			organizationId_userId: {
				organizationId: orgId,
				userId: session.user.id,
			},
		},
	});

	if (!membership) {
		throw new Error("Not a member of this organization");
	}

	return { session, membership };
}

export async function getIntegrationConfigs(orgId: string) {
	await requireOrgMembership(orgId);

	return prisma.integrationConfig.findMany({
		where: { organizationId: orgId },
		orderBy: { createdAt: "desc" },
	});
}

export async function createIntegrationConfig(
	orgId: string,
	type: string,
	config: any
) {
	await requireOrgMembership(orgId);

	return prisma.integrationConfig.create({
		data: {
			organizationId: orgId,
			type,
			config,
			isActive: true,
		},
	});
}

export async function updateIntegrationConfig(id: string, config: any) {
	const session = await getSession();

	const integration = await prisma.integrationConfig.findUnique({
		where: { id },
		select: { organizationId: true },
	});

	if (!integration) throw new Error("Integration not found");
	await requireOrgMembership(integration.organizationId);

	return prisma.integrationConfig.update({
		where: { id },
		data: { config, updatedAt: new Date() },
	});
}

export async function toggleIntegrationActive(id: string, isActive: boolean) {
	const session = await getSession();

	const integration = await prisma.integrationConfig.findUnique({
		where: { id },
		select: { organizationId: true },
	});

	if (!integration) throw new Error("Integration not found");
	await requireOrgMembership(integration.organizationId);

	return prisma.integrationConfig.update({
		where: { id },
		data: { isActive, updatedAt: new Date() },
	});
}

export async function deleteIntegrationConfig(id: string) {
	const session = await getSession();

	const integration = await prisma.integrationConfig.findUnique({
		where: { id },
		select: { organizationId: true },
	});

	if (!integration) throw new Error("Integration not found");
	await requireOrgMembership(integration.organizationId);

	return prisma.integrationConfig.delete({
		where: { id },
	});
}

export async function testWebhook(type: string, webhookUrl: string) {
	await getSession();

	if (type === "slack") {
		return sendSlackWebhook(webhookUrl, {
			text: "Test notification from Code Horse",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: ":horse: *Code Horse Integration Test*\nThis is a test message to verify your Slack webhook is working correctly.",
					},
				},
			],
		});
	}

	if (type === "discord") {
		return sendDiscordWebhook(webhookUrl, {
			content: "",
			embeds: [
				{
					title: "Code Horse Integration Test",
					description:
						"This is a test message to verify your Discord webhook is working correctly.",
					color: 0x7c3aed,
					thumbnail: {
						url: "https://em-content.zobj.net/source/twitter/408/horse_1f40e.png",
					},
				},
			],
		});
	}

	return { success: false, error: "Unsupported integration type" };
}
