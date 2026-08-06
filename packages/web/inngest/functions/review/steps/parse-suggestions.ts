import type { ParsedSuggestions } from "../context";

/**
 * Step: parse-suggestions
 * Extracts the SUGGESTIONS_JSON block from the model output and parses it.
 * Returns null when the block is absent or malformed.
 */
export async function parseSuggestions(
	review: string
): Promise<ParsedSuggestions | null> {
	const match = (review as string).match(
		/<!--\s*SUGGESTIONS_JSON\s*\n([\s\S]*?)\n\s*-->/
	);

	if (match?.[1]) {
		try {
			const parsed = JSON.parse(match[1]);
			return {
				suggestions: Array.isArray(parsed.suggestions)
					? parsed.suggestions
					: [],
				summary: parsed.summary ?? {
					totalIssues: 0,
					errors: 0,
					warnings: 0,
					suggestions: 0,
				},
			};
		} catch {
			return null;
		}
	}

	return null;
}
