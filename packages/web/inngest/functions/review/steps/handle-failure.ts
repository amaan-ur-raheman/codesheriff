import prisma from "@/lib/db";
import { isReviewCapableProvider } from "@/modules/vcs/resolve";
import { dashboardReviewsUrl } from "../context";
import type { ReviewContext } from "../context";
import { sendReviewFailedNotification } from "@/modules/notifications/actions";

/**
 * Step: update-github-comment-failed
 * Rewrites the loading comment into a failure message (ReviewCapable only).
 */
export async function updateCommentFailed(
	ctx: ReviewContext,
	errorMessage: string
): Promise<void> {
	if (!isReviewCapableProvider(ctx.provider) || !ctx.loadingCommentId) return;
	await ctx.provider.updateReviewCommentFailed(
		ctx.owner,
		ctx.repo,
		ctx.loadingCommentId,
		errorMessage
	);
}

/**
 * Resolves the SHA to mark failed (uses the event head sha, falling back to
 * the PR head sha when the event sha is the zero sha).
 */
export async function resolveFailureSha(
	ctx: ReviewContext,
	after?: string
): Promise<string | undefined> {
	let sha = after;
	if (!sha || sha === "0000000000000000000000000000000000000000") {
		try {
			const pr = await ctx.provider.getPullRequestDiff(
				ctx.owner,
				ctx.repo,
				ctx.prNumber
			);
			sha = pr.headSha;
		} catch {}
	}
	return sha;
}

/**
 * Step: update-github-status-failed
 * Commit-status failure path when no check run exists (ReviewCapable only).
 */
export async function updateStatusFailed(
	ctx: ReviewContext,
	sha: string,
	errorMessage: string
): Promise<void> {
	if (!isReviewCapableProvider(ctx.provider)) return;
	await ctx.provider.updatePRCommitStatus(
		ctx.owner,
		ctx.repo,
		sha,
		"failure",
		"Review failed: " + errorMessage.slice(0, 50),
		dashboardReviewsUrl
	);
}

/**
 * Step: update-github-check-run-failed
 * Completes the check run with a failure conclusion (ReviewCapable only).
 */
export async function updateCheckRunFailed(
	ctx: ReviewContext,
	errorMessage: string
): Promise<void> {
	if (!isReviewCapableProvider(ctx.provider) || !ctx.checkRunId) return;
	await ctx.provider.updatePRCheckRun(
		ctx.owner,
		ctx.repo,
		ctx.checkRunId,
		"completed",
		"failure",
		"CodeSheriff review failed: " + errorMessage.slice(0, 100)
	);
}

/**
 * Step: create-failed-review
 * Persists a failed review record when the repository exists.
 */
export async function createFailedReview(
	owner: string,
	repo: string,
	prNumber: number,
	errorMessage: string
) {
	const repository = await prisma.repository.findFirst({
		where: { owner, name: repo },
	});

	if (repository) {
		return await prisma.review.create({
			data: {
				repositoryId: repository.id,
				prNumber,
				prTitle: `${owner}/${repo} PR #${prNumber}`,
				prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
				review: `Review failed: ${errorMessage}`,
				status: "failed",
			},
		});
	}
}

/**
 * Step: send-failure-notification
 * Fires the failure notification for a persisted failed review.
 */
export async function sendFailureNotification(
	failedReview: any,
	errorMessage: string
): Promise<void> {
	if (failedReview) {
		await sendReviewFailedNotification(failedReview.id, errorMessage);
	}
}
