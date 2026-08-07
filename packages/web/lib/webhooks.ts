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

const DEFAULT_WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Runs a webhook call with a timeout and a single retry (shared by the
 * review-notification and metrics-alert delivery paths). Throws when the
 * call fails or times out on both attempts.
 */
export async function postWebhookWithTimeout<T>(
	fn: () => Promise<T>,
	timeoutMs: number = DEFAULT_WEBHOOK_TIMEOUT_MS
): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			return await Promise.race([
				fn(),
				new Promise<T>((_, reject) =>
					setTimeout(
						() => reject(new Error("webhook delivery timed out")),
						timeoutMs
					)
				),
			]);
		} catch (err) {
			lastError = err;
			if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
		}
	}
	throw lastError;
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
