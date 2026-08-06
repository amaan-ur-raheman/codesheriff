import {
	updatePRCommitStatus,
	updatePRCheckRun,
} from "@/modules/github/lib/github";
import { dashboardReviewsUrl } from "../context";
import type { ReviewContext, ParsedSuggestions } from "../context";

/**
 * Step: update-github-status-success
 * Commit-status fallback path when no check run exists.
 */
export async function updateStatusSuccess(ctx: ReviewContext): Promise<void> {
	await updatePRCommitStatus(
		ctx.token,
		ctx.owner,
		ctx.repo,
		ctx.headSha,
		"success",
		"Review complete",
		dashboardReviewsUrl
	);
}

/**
 * Step: update-github-check-run-success
 * Completes the check run with annotations built from the valid suggestions.
 */
export async function updateCheckRunSuccess(
	ctx: ReviewContext,
	verifiedSuggestions: ParsedSuggestions | null
): Promise<void> {
	const validSuggestions = (verifiedSuggestions?.suggestions || []).filter(
		(s: any) => {
			if (!s) return false;
			const startLine = Number(s.startLine);
			if (isNaN(startLine) || startLine <= 0) {
				return false;
			}
			const endLine =
				s.endLine !== undefined ? Number(s.endLine) : startLine;
			if (isNaN(endLine) || endLine < startLine || endLine <= 0) {
				return false;
			}
			return true;
		}
	);

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

	await updatePRCheckRun(
		ctx.token,
		ctx.owner,
		ctx.repo,
		ctx.checkRunId as number,
		"completed",
		"success",
		`CodeSheriff review completed. Found ${annotations.length} findings.`,
		annotations
	);
}
