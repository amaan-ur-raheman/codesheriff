import { isReviewCapableProvider } from "@/modules/vcs/resolve";
import { dashboardReviewsUrl } from "../context";
import type { ReviewContext } from "../context";

/**
 * Step: create-github-check-run
 * Creates an in-progress check run for the PR head commit on providers that
 * support it (ReviewCapableProvider). Returns the check run id, or null when
 * the provider is not review-capable or the GitHub App lacks permission (the
 * caller then falls back to a commit status where supported).
 */
export async function createCheckRun(ctx: ReviewContext): Promise<number | null> {
	if (!isReviewCapableProvider(ctx.provider)) {
		// GitLab/Bitbucket degrade: no check run.
		return null;
	}
	return await ctx.provider.createPRCheckRun(ctx.owner, ctx.repo, ctx.headSha);
}

/**
 * Step: update-github-status-pending
 * Fallback when check runs are unavailable: sets a pending commit status.
 * No-op for providers without commit-status support.
 */
export async function updateStatusPending(ctx: ReviewContext): Promise<void> {
	if (!isReviewCapableProvider(ctx.provider)) return;
	await ctx.provider.updatePRCommitStatus(
		ctx.owner,
		ctx.repo,
		ctx.headSha,
		"pending",
		"Review in progress",
		dashboardReviewsUrl
	);
}
