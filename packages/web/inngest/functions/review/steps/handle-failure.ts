import prisma from "@/lib/db";
import {
	updateReviewCommentFailed,
	getPullRequestDiff,
	updatePRCommitStatus,
	updatePRCheckRun,
} from "@/modules/github/lib/github";
import { dashboardReviewsUrl } from "../context";
import { sendReviewFailedNotification } from "@/modules/notifications/actions";

/**
 * Step: update-github-comment-failed
 * Rewrites the loading comment into a failure message.
 */
export async function updateCommentFailed(
	token: string,
	owner: string,
	repo: string,
	loadingCommentId: number,
	errorMessage: string
): Promise<void> {
	await updateReviewCommentFailed(
		token as string,
		owner,
		repo,
		loadingCommentId as number,
		errorMessage
	);
}

/**
 * Resolves the SHA to mark failed (uses the event head sha, falling back to
 * the PR head sha when the event sha is the zero sha).
 */
export async function resolveFailureSha(
	token: string,
	owner: string,
	repo: string,
	prNumber: number,
	after?: string
): Promise<string | undefined> {
	let sha = after;
	if (!sha || sha === "0000000000000000000000000000000000000000") {
		try {
			const prData = await getPullRequestDiff(token, owner, repo, prNumber);
			sha = prData.headSha;
		} catch (_) {}
	}
	return sha;
}

/**
 * Step: update-github-status-failed
 * Commit-status failure path when no check run exists.
 */
export async function updateStatusFailed(
	token: string,
	owner: string,
	repo: string,
	sha: string,
	errorMessage: string
): Promise<void> {
	await updatePRCommitStatus(
		token as string,
		owner,
		repo,
		sha,
		"failure",
		"Review failed: " + errorMessage.slice(0, 50),
		dashboardReviewsUrl
	);
}

/**
 * Step: update-github-check-run-failed
 * Completes the check run with a failure conclusion.
 */
export async function updateCheckRunFailed(
	token: string,
	owner: string,
	repo: string,
	checkRunId: number,
	errorMessage: string
): Promise<void> {
	await updatePRCheckRun(
		token as string,
		owner,
		repo,
		checkRunId,
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
