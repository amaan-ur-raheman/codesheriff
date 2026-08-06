/**
 * Inngest background job functions for Code Sheriff
 *
 * This module contains serverless functions that handle:
 * - AI code review generation
 * - Repository indexing for RAG
 * - Webhook processing
 *
 * All functions are executed asynchronously to avoid blocking the main application
 * and provide reliable processing with automatic retries.
 *
 * @module inngest/functions
 */
import { inngest } from "../client";

import type { ReviewContext } from "./review/context";
import { resolveProviderForRepository } from "@/modules/vcs/resolve";
import { fetchPrData } from "./review/steps/fetch-pr-data";
import { createLoadingComment } from "./review/steps/create-loading-comment";
import {
	createCheckRun,
	updateStatusPending,
} from "./review/steps/create-check-run";
import { retrieveReviewContext } from "./review/steps/retrieve-context";
import { generateAiReview } from "./review/steps/generate-ai-review";
import { parseSuggestions } from "./review/steps/parse-suggestions";
import { verifySuggestions } from "./review/steps/verify-suggestions";
import { postComment } from "./review/steps/post-comment";
import { saveReview } from "./review/steps/save-review";
import { sendNotification } from "./review/steps/send-notification";
import {
	updateStatusSuccess,
	updateCheckRunSuccess,
} from "./review/steps/update-status";
import { sendWebhookNotifications } from "./review/steps/send-webhooks";
import {
	updateCommentFailed,
	resolveFailureSha,
	updateStatusFailed,
	updateCheckRunFailed,
	createFailedReview,
	sendFailureNotification,
} from "./review/steps/handle-failure";

/**
 * Inngest function to generate an AI code review for a Pull Request.
 *
 * Triggered by: "pr.review.requested" event.
 *
 * Thin orchestrator: each pipeline stage lives in `./review/steps` as an
 * independently testable step that takes the typed ReviewContext and returns
 * its output. Step names are stable (durable-execution contract).
 *
 * The VCS provider is resolved once via the shared factory helper
 * (`resolveProviderForRepository`) and threaded through `ctx.provider`; steps
 * call provider methods instead of importing GitHub helpers directly.
 */
export const generateReview = inngest.createFunction(
	{ id: "generate-review", concurrency: 5 },
	{ event: "pr.review.requested" },
	async ({ event, step }) => {
		const {
			owner,
			repo,
			prNumber,
			userId,
			before,
			after,
			checkRunId: eventCheckRunId,
		} = event.data;

		let ctx: ReviewContext | null = null;

		try {
			const resolved = await resolveProviderForRepository(owner, repo); 			ctx = {
 				provider: resolved.provider,
 				providerType: resolved.providerType,
 				owner,
 				repo,
 				prNumber,
 				userId,
 				before,
 				after,
 				token: resolved.token,
 				diff: "",
 				title: "",
 				description: null,
 				headSha: "",
 				checkRunId: eventCheckRunId || null,
 				loadingCommentId: null,
 			};

			const prData = await step.run("fetch-pr-data", async () => {
				return await fetchPrData(ctx as ReviewContext);
			});

			Object.assign(ctx, prData);

			ctx.loadingCommentId = await step.run("create-loading-comment", async () => {
				return await createLoadingComment(ctx as ReviewContext);
			});

			if (!ctx.checkRunId) {
				ctx.checkRunId = await step.run("create-github-check-run", async () => {
					return await createCheckRun(ctx as ReviewContext);
				});

				if (!ctx.checkRunId) {
					await step.run("update-github-status-pending", async () => {
						await updateStatusPending(ctx as ReviewContext);
					});
				}
			}

			const context = await step.run("retrieve-context", async () => {
				return await retrieveReviewContext(ctx as ReviewContext);
			});

			const review = await step.run("generate-ai-review", async () => {
				return await generateAiReview(ctx as ReviewContext, context);
			});

			const parsedSuggestions = await step.run("parse-suggestions", async () => {
				return await parseSuggestions(review as string);
			});

			const verifiedSuggestions = await step.run("verify-suggestions-sandbox", async () => {
				return await verifySuggestions(ctx as ReviewContext, parsedSuggestions);
			});

			await step.run("post-comment", async () => {
				await postComment(ctx as ReviewContext, review as string, verifiedSuggestions);
			});

			const savedReview = await step.run("save-review", async () => {
				return await saveReview(ctx as ReviewContext, review as string, verifiedSuggestions);
			});

			await step.run("send-notification", async () => {
				await sendNotification(savedReview);
			});

			if (!ctx.checkRunId) {
				await step.run("update-github-status-success", async () => {
					await updateStatusSuccess(ctx as ReviewContext);
				});
			} else {
				await step.run("update-github-check-run-success", async () => {
					await updateCheckRunSuccess(ctx as ReviewContext, verifiedSuggestions);
				});
			}

			await step.run("send-webhook-notifications", async () => {
				await sendWebhookNotifications(ctx as ReviewContext, review as string);
			});

			return { success: true };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			// Attempt to update commit status to failure via the resolved provider
			try {
				if (ctx) {
					if (ctx.loadingCommentId) {
						await step.run("update-github-comment-failed", async () => {
							await updateCommentFailed(ctx as ReviewContext, errorMessage);
						});
					}

					const sha = await resolveFailureSha(ctx as ReviewContext, after);

					if (sha) {
						if (!ctx.checkRunId) {
							await step.run("update-github-status-failed", async () => {
								await updateStatusFailed(ctx as ReviewContext, sha as string, errorMessage);
							});
						} else {
							await step.run("update-github-check-run-failed", async () => {
								await updateCheckRunFailed(ctx as ReviewContext, errorMessage);
							});
						}
					}
				}
			} catch (statusError) {
				console.error("Failed to post error status:", statusError);
			}

			const failedReview = await step.run("create-failed-review", async () => {
				return await createFailedReview(owner, repo, prNumber, errorMessage);
			});

			await step.run("send-failure-notification", async () => {
				await sendFailureNotification(failedReview, errorMessage);
			});

			throw error;
		}
	}
);

export { handleCommentReply } from "./review/comment-reply";
