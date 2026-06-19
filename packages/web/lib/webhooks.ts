interface SlackMessage {
	text: string;
	blocks?: any[];
}

interface DiscordMessage {
	content: string;
	embeds?: any[];
}

interface WebhookResult {
	success: boolean;
	error?: string;
}

export async function sendSlackWebhook(
	webhookUrl: string,
	message: SlackMessage
): Promise<WebhookResult> {
	try {
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(message),
		});

		if (!response.ok) {
			const text = await response.text();
			return { success: false, error: `Slack webhook failed: ${response.status} ${text}` };
		}

		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to send Slack webhook",
		};
	}
}

export async function sendDiscordWebhook(
	webhookUrl: string,
	message: DiscordMessage
): Promise<WebhookResult> {
	try {
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(message),
		});

		if (!response.ok) {
			const text = await response.text();
			return { success: false, error: `Discord webhook failed: ${response.status} ${text}` };
		}

		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to send Discord webhook",
		};
	}
}
