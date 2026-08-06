import { postLoadingReviewComment } from "@/modules/github/lib/github";
import type { ReviewContext } from "../context";

/**
 * Step: create-loading-comment
 * Posts the "review in progress" comment. Returns null when it fails so the
 * pipeline can continue without a loading comment.
 */
export async function createLoadingComment(
	ctx: ReviewContext
): Promise<number | null> {
	try {
		return await postLoadingReviewComment(
			ctx.token,
			ctx.owner,
			ctx.repo,
			ctx.prNumber
		);
	} catch (commentError) {
		console.error("Failed to post loading comment:", commentError);
		return null;
	}
}
