import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

// Initialize OpenCode Zen provider using @ai-sdk/openai-compatible
const opencodeProvider = createOpenAICompatible({
	name: "opencode-zen",
	baseURL: "https://opencode.ai/zen/v1",
	apiKey: process.env.OPENCODE_API_KEY || "",
});

export const opencode = (modelId: string) => opencodeProvider.chatModel(modelId) as any;

/**
 * Generates text using the OpenCode Zen model (defaulting to mimo-v2.5-free),
 * falling back to google("gemini-2.5-flash") if the OpenCode Zen generation fails
 * or if no API key is provided.
 *
 * @param prompt The prompt to send to the model
 * @returns The generated text
 */
export async function generateTextWithFallback(prompt: string): Promise<string> {
	const opencodeApiKey = process.env.OPENCODE_API_KEY;
	const opencodeModelName = process.env.OPENCODE_MODEL || "mimo-v2.5-free";

	if (opencodeApiKey) {
		try {
			console.log(`[AI] Attempting text generation with OpenCode Zen model: ${opencodeModelName}`);
			const { text } = await generateText({
				model: opencode(opencodeModelName),
				prompt,
			});
			return text;
		} catch (error) {
			console.error("[AI] OpenCode Zen text generation failed, falling back to Gemini:", error);
		}
	} else {
		console.log("[AI] No OPENCODE_API_KEY found, skipping OpenCode Zen and using fallback model (Gemini).");
	}

	// Fallback model
	console.log("[AI] Generating text with fallback model: gemini-2.5-flash");
	const { text } = await generateText({
		model: google("gemini-2.5-flash"),
		prompt,
	});
	return text;
}
