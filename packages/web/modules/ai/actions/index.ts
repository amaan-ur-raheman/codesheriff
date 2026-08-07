"use server";

import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import {
	canCreateReview,
	incrementReviewCount,
} from "@/modules/payment/lib/subscription";
import {
	resolveProviderForRepository,
	isReviewCapableProvider,
} from "@/modules/vcs/resolve";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/dashboard\/?$/, "");
const dashboardReviewsUrl = `${appUrl}/dashboard/reviews`;

/**
 * Initiates an AI-powered code review for a pull request
 * @param owner - Repository owner username
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns Promise with success status and message
 */
export async function reviewPullRequest(
	owner: string,
	repo: string,
	prNumber: number,
	before?: string,
	after?: string
) {
	try {
		// Shared resolution: reads the repository's provider field and resolves
		// the right credentials for that provider (same helper as the pipeline).
		const resolved = await resolveProviderForRepository(owner, repo);
		const repository = resolved.repository;

		const canReview = await canCreateReview(
			repository.userId,
			repository.id
		);

		if (!canReview) {
			throw new Error(
				"Review limit reached for this repository. Please upgrade to PRO for unlimited reviews."
			);
		}

		// Resolve head SHA
		let headSha = after;
		if (!headSha || headSha === "0000000000000000000000000000000000000000") {
			try {
				const pr = await resolved.provider.getPullRequestDiff(
					owner,
					repo,
					prNumber
				);
				headSha = pr.headSha;
			} catch (prError) {
				console.error("Failed to fetch PR details for head SHA:", prError);
			}
		}

		let checkRunId: number | null = null;
		if (headSha && isReviewCapableProvider(resolved.provider)) {
			// Instantly create Check Run in_progress (animating loading spinner)
			checkRunId = await resolved.provider.createPRCheckRun(
				owner,
				repo,
				headSha
			);

			// If Check Run creation failed (e.g. 403 Forbidden/lack of App permissions),
			// fall back to setting commit status to pending (pulsing yellow/orange dot)
			if (!checkRunId) {
				await resolved.provider.updatePRCommitStatus(
					owner,
					repo,
					headSha,
					"pending",
					"Review in progress",
					dashboardReviewsUrl
				);
			}
		}

		await inngest.send({
			name: "pr.review.requested",
			data: {
				owner,
				repo,
				prNumber,
				userId: repository.userId,
				before,
				after,
				headSha,
				checkRunId,
			},
		});

		await incrementReviewCount(repository.userId, repository.id);

		return { success: true, message: "Review Queued" };
	} catch (error) {
		console.error("Error in reviewPullRequest:", error);
		try {
			const repository = await prisma.repository.findFirst({
				where: {
					owner,
					name: repo,
				},
			});

			if (repository) {
				await prisma.review.create({
					data: {
						repositoryId: repository.id,
						prNumber,
						prTitle: "Failed to fetch PR",
						prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
						review: `Error: ${
							error instanceof Error
								? error.message
								: "Unknown Error"
						}`,
						status: "failed",
					},
				});
			}
		} catch (dbError) {
			console.error("Failed to save error to database:", dbError);
		}
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Dispatches an event to Inngest when a comment mentions Code Sheriff
 */
export async function replyToPullRequestComment(
	owner: string,
	repo: string,
	prNumber: number,
	commentBody: string,
	commentId: number,
	isReviewComment: boolean
) {
	try {
		// Shared resolution: reads the repository's provider field and resolves
		// the right credentials (same helper as the review pipeline).
		const resolved = await resolveProviderForRepository(owner, repo);

		await inngest.send({
			name: "pr.comment.replied",
			data: {
				owner,
				repo,
				prNumber,
				commentBody,
				commentId,
				isReviewComment,
				userId: resolved.repository.userId,
			},
		});

		return { success: true, message: "Reply request queued" };
	} catch (error) {
		console.error("Failed to handle comment mention:", error);
		return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
	}
}
