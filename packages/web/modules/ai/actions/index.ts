"use server";

import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import {
	canCreateReview,
	incrementReviewCount,
} from "@/modules/payment/lib/subscription";
import { Octokit } from "octokit";
import { updatePRCommitStatus, createPRCheckRun } from "@/modules/github/lib/github";

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
		const respository = await prisma.repository.findFirst({
			where: {
				owner,
				name: repo,
			},
			include: {
				user: {
					include: {
						accounts: {
							where: {
								providerId: "github",
							},
						},
					},
				},
			},
		});

		if (!respository) {
			throw new Error(
				`Repository ${owner}/${repo} not found in database. Please reconnect the repository.`
			);
		}

		const canReview = await canCreateReview(
			respository.user.id,
			respository.id
		);

		if (!canReview) {
			throw new Error(
				"Review limit reached for this repository. Please upgrade to PRO for unlimited reviews."
			);
		}

		const githubAccount = respository.user.accounts[0];

		if (!githubAccount?.accessToken) {
			throw new Error(
				`No GitHub access token found for repository owner.`
			);
		}

		const token = githubAccount.accessToken;

		// Resolve head SHA
		let headSha = after;
		if (!headSha || headSha === "0000000000000000000000000000000000000000") {
			try {
				const octokit = new Octokit({ auth: token });
				const { data: pr } = await octokit.rest.pulls.get({
					owner,
					repo,
					pull_number: prNumber,
				});
				headSha = pr.head.sha;
			} catch (prError) {
				console.error("Failed to fetch PR details for head SHA:", prError);
			}
		}

		let checkRunId: number | null = null;
		if (headSha) {
			// Instantly set commit status to pending (pulsing yellow/orange dot)
			await updatePRCommitStatus(
				token,
				owner,
				repo,
				headSha,
				"pending",
				"Review in progress",
				dashboardReviewsUrl
			);

			// Instantly create Check Run in_progress (animating loading spinner)
			checkRunId = await createPRCheckRun(token, owner, repo, headSha);
		}

		await inngest.send({
			name: "pr.review.requested",
			data: {
				owner,
				repo,
				prNumber,
				userId: respository.user.id,
				before,
				after,
				headSha,
				checkRunId,
			},
		});

		await incrementReviewCount(respository.user.id, respository.id);

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
		const repository = await prisma.repository.findFirst({
			where: { owner, name: repo },
			include: {
				user: {
					include: {
						accounts: {
							where: { providerId: "github" },
						},
					},
				},
			},
		});

		if (!repository) {
			throw new Error(`Repository ${owner}/${repo} not found in database.`);
		}

		const githubAccount = repository.user.accounts[0];
		if (!githubAccount?.accessToken) {
			throw new Error(`No GitHub access token found for repository owner.`);
		}

		await inngest.send({
			name: "pr.comment.replied",
			data: {
				owner,
				repo,
				prNumber,
				commentBody,
				commentId,
				isReviewComment,
				userId: repository.user.id,
			},
		});

		return { success: true, message: "Reply request queued" };
	} catch (error) {
		console.error("Failed to handle comment mention:", error);
		return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
	}
}
