import { parseSuggestionBlock, parseSuggestionsFromReview } from "@/modules/ai/lib/suggestions";
import type { ParsedSuggestions } from "../context";

/**
 * Step: parse-suggestions
 *
 * Extracts the SUGGESTIONS_JSON block from the model output and parses it.
 *
 * Every finding in the review lives in that one block, so a parse failure is
 * not a degraded review — it is a review that reports nothing while its prose
 * body lists the problems. The parser therefore repairs raw control bytes
 * before giving up, and falls back to the structured markdown shape before
 * concluding there is nothing to report.
 *
 * Returns null only when no suggestion block of any shape was present.
 */
export async function parseSuggestions(
	review: string
): Promise<ParsedSuggestions | null> {
	const fromBlock = parseSuggestionBlock(review);
	if (fromBlock) {
		return { suggestions: fromBlock.suggestions, summary: fromBlock.summary };
	}

	// Block absent or unsalvageable: the model may still have emitted the
	// structured markdown shape this parser also understands.
	const structured = parseSuggestionsFromReview(review);
	if (structured.suggestions.length > 0) {
		return {
			suggestions: structured.suggestions,
			summary: structured.summary,
		};
	}

	return null;
}
