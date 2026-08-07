import {
	verifySuggestionsInSandbox,
	SandboxUnavailableError,
} from "@/modules/ai/lib/sandbox";
import { isReviewCapableProvider } from "@/modules/vcs/resolve";
import type { ReviewContext, ParsedSuggestions } from "../context";
import type { CodeSuggestion } from "@/modules/ai/lib/suggestions";

/**
 * Step: verify-suggestions-sandbox
 * Verifies each parsed suggestion in the sandbox and attaches the per-suggestion
 * verify results (verifyStatus / verifyError / verifyDurationMs, plus the
 * legacy verified/verificationLog flags). Returns the parsed suggestions
 * untouched when there are none, when verification fails entirely, or when the
 * sandbox is unavailable — the review never fails.
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

		const updatedSuggestions = parsedSuggestions.suggestions.map((s: CodeSuggestion) => {
			const result = verificationResults.find((r) => r.id === s.id);
			return {
				...s,
				// Legacy flags for existing UI rendering.
				verified: result ? result.success : false,
				verificationLog: result?.errorLog || undefined,
				// New per-suggestion verify results.
				verifyStatus: result?.verifyStatus,
				verifyError: result?.verifyError,
				verifyDurationMs: result?.verifyDurationMs,
			};
		});

		return {
			...parsedSuggestions,
			suggestions: updatedSuggestions,
		};
	} catch (sandboxError) {
		// Sandbox unavailable → suggestions posted unlabeled, review succeeds.
		if (sandboxError instanceof SandboxUnavailableError) {
			console.warn("Sandbox unavailable, posting suggestions unlabeled:", sandboxError.message);
		} else {
			console.error("Sandbox verification execution failed:", sandboxError);
		}
		return parsedSuggestions;
	}
}
