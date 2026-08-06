import { isReviewCapableProvider } from "@/modules/vcs/resolve";
import type { ReviewContext } from "../context";

/**
 * Step: create-loading-comment
 * Posts the "review in progress" signal.
 *
 * - ReviewCapableProvider: posts a trackable loading comment (returned id is
 *   later rewritten into the final review).
 * - GitLab/Bitbucket: degrades to a plain loading comment via the base
 *   postReviewComment; returns null so the final review is posted separately.
 *
 * Returns null when posting fails so the pipeline can continue.
 */
export async function createLoadingComment(
	ctx: ReviewContext
): Promise<number | null> {
	try {
		if (isReviewCapableProvider(ctx.provider)) {
			return await ctx.provider.postLoadingReviewComment(
				ctx.owner,
				ctx.repo,
				ctx.prNumber
			);
		}

		await ctx.provider.postReviewComment(
			ctx.owner,
			ctx.repo,
			ctx.prNumber,
			"⏳ **Review in progress...** CodeSheriff is analyzing this pull request and will post the review shortly."
		);
		return null;
	} catch (commentError) {
		console.error("Failed to post loading comment:", commentError);
		return null;
	}
}
