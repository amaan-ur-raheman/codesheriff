import { isReviewCapableProvider } from "@/modules/vcs/resolve";
import { dashboardReviewsUrl } from "../context";
import type { ReviewContext, ParsedSuggestions } from "../context";

/**
 * Step: update-github-status-success
 * Commit-status fallback path when no check run exists. No-op for providers
 * without commit-status support.
 */
export async function updateStatusSuccess(ctx: ReviewContext): Promise<void> {
	if (!isReviewCapableProvider(ctx.provider)) return;
	await ctx.provider.updatePRCommitStatus(
		ctx.owner,
		ctx.repo,
		ctx.headSha,
		"success",
		"Review complete",
		dashboardReviewsUrl
	);
}

/**
 * Whether a suggestion's line range can be rendered as a check annotation.
 * A range that fails this is dropped from the check run, so callers must be
 * able to report what they lost.
 */
function hasUsableLineRange(s: any): boolean {
	if (!s) return false;

	const startLine = Number(s.startLine);
	if (isNaN(startLine) || startLine <= 0) return false;

	const endLine = s.endLine !== undefined ? Number(s.endLine) : startLine;
	if (isNaN(endLine) || endLine < startLine || endLine <= 0) return false;

	return true;
}

/**
 * Step: update-github-check-run-success
 * Completes the check run with annotations built from the valid suggestions.
 * Only runs on ReviewCapableProvider (check run ids only exist there).
 */
export async function updateCheckRunSuccess(
	ctx: ReviewContext,
	verifiedSuggestions: ParsedSuggestions | null
): Promise<void> {
	if (!isReviewCapableProvider(ctx.provider) || !ctx.checkRunId) return;

	const allSuggestions = verifiedSuggestions?.suggestions || [];
	const validSuggestions = allSuggestions.filter(hasUsableLineRange);

	// Annotations are the only place findings reach the PR's checks UI, so an
	// unusable line range loses a finding with no visible signal. Say so.
	const dropped = allSuggestions.filter((s: any) => !hasUsableLineRange(s));
	if (dropped.length > 0) {
		console.warn(
			`Dropped ${dropped.length} of ${allSuggestions.length} suggestion(s) from the check run: unusable line range`,
			dropped.map((s: any) => ({
				id: s?.id,
				filePath: s?.filePath,
				startLine: s?.startLine,
				endLine: s?.endLine,
			}))
		);
	}

	const annotations = validSuggestions.map((s: any) => {
		let level: "notice" | "warning" | "failure" = "notice";
		if (s.severity === "error") level = "failure";
		else if (s.severity === "warning") level = "warning";

		const start = Number(s.startLine);
		const end = s.endLine !== undefined ? Number(s.endLine) : start;

		return {
			path: s.filePath,
			start_line: start,
			end_line: end,
			annotation_level: level,
			message: s.description || "Code suggestion",
			title: s.title || "CodeSheriff Finding",
		};
	});

	// Annotate with what GitHub can actually display, but never claim "0
	// findings" when findings were parsed and only lost their annotations.
	const summary =
		annotations.length === 0 && allSuggestions.length > 0
			? `CodeSheriff review completed. Parsed ${allSuggestions.length} finding(s), but none could be annotated — see run logs.`
			: `CodeSheriff review completed. Found ${annotations.length} findings.`;

	await ctx.provider.updatePRCheckRun(
		ctx.owner,
		ctx.repo,
		ctx.checkRunId,
		"completed",
		"success",
		summary,
		annotations
	);
}
