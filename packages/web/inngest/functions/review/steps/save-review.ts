import prisma from "@/lib/db";
import type { ReviewContext, ParsedSuggestions } from "../context";

/**
 * Step: save-review
 * Persists the completed review (with verified suggestions) to the database.
 * Returns the saved review, or undefined when the repository isn't found.
 */
export async function saveReview(
	ctx: ReviewContext,
	review: string,
	verifiedSuggestions: ParsedSuggestions | null
) {
	const repository = await prisma.repository.findFirst({
		where: {
			owner: ctx.owner,
			name: ctx.repo,
		},
	});

	if (repository) {
		return await prisma.review.create({
			data: {
				repositoryId: repository.id,
				prNumber: ctx.prNumber,
				prTitle: ctx.title,
				prUrl: `https://github.com/${ctx.owner}/${ctx.repo}/pull/${ctx.prNumber}`,
				review: review as string,
				suggestions: verifiedSuggestions
					? (verifiedSuggestions as any)
					: undefined,
				status: "completed",
			},
		});
	}
}
