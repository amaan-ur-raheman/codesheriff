import {
	createPRCheckRun,
	updatePRCommitStatus,
} from "@/modules/github/lib/github";
import { dashboardReviewsUrl } from "../context";
import type { ReviewContext } from "../context";

/**
 * Step: create-github-check-run
 * Creates an in-progress check run for the PR head commit. Returns the check
 * run id, or null when the GitHub App lacks permission (then the caller falls
 * back to a commit status).
 */
export async function createCheckRun(ctx: ReviewContext): Promise<number | null> {
	return await createPRCheckRun(ctx.token, ctx.owner, ctx.repo, ctx.headSha);
}

/**
 * Step: update-github-status-pending
 * Fallback when check runs are unavailable: sets a pending commit status.
 */
export async function updateStatusPending(ctx: ReviewContext): Promise<void> {
	await updatePRCommitStatus(
		ctx.token,
		ctx.owner,
		ctx.repo,
		ctx.headSha,
		"pending",
		"Review in progress",
		dashboardReviewsUrl
	);
}
