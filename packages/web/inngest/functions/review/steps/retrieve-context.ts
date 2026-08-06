import { retrieveContext } from "@/modules/ai/lib/rag";
import type { ReviewContext } from "../context";

/**
 * Step: retrieve-context
 * Queries the RAG vector store for relevant codebase context based on the PR
 * title and description.
 */
export async function retrieveReviewContext(
	ctx: ReviewContext
): Promise<string[]> {
	const query = `${ctx.title}\n${ctx.description}`;
	return await retrieveContext(query, `${ctx.owner}/${ctx.repo}`);
}
