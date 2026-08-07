import {
	isReviewCapableProvider,
} from "@/modules/vcs/resolve";
import type { ReviewContext } from "../context";

export interface FetchPrDataOutput {
	diff: string;
	title: string;
	description: string | null;
	headSha: string;
}

/**
 * Step: fetch-pr-data
 * Retrieves the PR diff (or incremental compare diff when before/after are
 * provided on a ReviewCapable provider), title, description, and head SHA
 * through the resolved VCS provider.
 */
export async function fetchPrData(
	ctx: ReviewContext
): Promise<FetchPrDataOutput> {
	const pr = await ctx.provider.getPullRequestDiff(
		ctx.owner,
		ctx.repo,
		ctx.prNumber
	);

	let diffContent = pr.diff;

	if (
		ctx.before &&
		ctx.after &&
		ctx.before !== "0000000000000000000000000000000000000000" &&
		isReviewCapableProvider(ctx.provider)
	) {
		try {
			diffContent = await ctx.provider.getCompareDiff(
				ctx.owner,
				ctx.repo,
				ctx.before,
				ctx.after
			);
		} catch (compareError) {
			console.warn(
				"Failed to get compare diff, falling back to full PR diff:",
				compareError
			);
		}
	}

	return {
		diff: diffContent,
		title: pr.title,
		description: pr.description,
		headSha: pr.headSha ?? "",
	};
}
