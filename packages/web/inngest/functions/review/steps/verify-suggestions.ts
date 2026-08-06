import { verifySuggestionsInSandbox } from "@/modules/ai/lib/sandbox";
import { isReviewCapableProvider } from "@/modules/vcs/resolve";
import type { ReviewContext, ParsedSuggestions } from "../context";

/**
 * Step: verify-suggestions-sandbox
 * Verifies each parsed suggestion in the sandbox and attaches the
 * verified/verificationLog fields. Returns the parsed suggestions untouched
 * when there are none or when verification fails entirely (never fails the
 * review).
 */
export async function verifySuggestions(
	ctx: ReviewContext,
	parsedSuggestions: ParsedSuggestions | null
): Promise<ParsedSuggestions | null> {
	if (
		!parsedSuggestions ||
		!parsedSuggestions.suggestions ||
		parsedSuggestions.suggestions.length === 0
	) {
		return parsedSuggestions;
	}

	// Sandbox verification fetches repository files with the provider token and
	// is a ReviewCapable capability; skip it for GitLab/Bitbucket (the review
	// still posts, just without sandbox-verified suggestions).
	if (!isReviewCapableProvider(ctx.provider)) {
		return parsedSuggestions;
	}

	try {
		const verificationResults = await verifySuggestionsInSandbox(
			ctx.token as string,
			ctx.owner,
			ctx.repo,
			ctx.prNumber,
			parsedSuggestions.suggestions
		);

		const updatedSuggestions = parsedSuggestions.suggestions.map((s: any) => {
			const result = verificationResults.find((r) => r.id === s.id);
			return {
				...s,
				verified: result ? result.success : false,
				verificationLog: result?.errorLog || undefined,
			};
		});

		return {
			...parsedSuggestions,
			suggestions: updatedSuggestions,
		};
	} catch (sandboxError) {
		console.error("Sandbox verification execution failed:", sandboxError);
		return parsedSuggestions;
	}
}
