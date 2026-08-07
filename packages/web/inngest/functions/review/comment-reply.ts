/**
 * Comment-reply handler for the review pipeline.
 *
 * Triggered by: "pr.comment.replied" — responds when @codesheriff is mentioned
 * in a PR comment or review-comment thread.
 */
import { inngest } from "../../client";
import prisma from "@/lib/db";
import {
	resolveProviderForRepository,
	isReviewCapableProvider,
} from "@/modules/vcs/resolve";
import type { VCSProvider } from "@/modules/vcs/types";
import { generateTextWithFallback } from "@/modules/ai/lib/models";
import { sendCommentReplyNotification } from "@/modules/notifications/actions";

interface ReplyContext {
	owner: string;
	repo: string;
	prNumber: number;
	userId: string;
	diff: string;
	title: string;
	description: string | null;
}

async function fetchReplyPrData(
	provider: VCSProvider,
	userId: string,
	owner: string,
	repo: string,
	prNumber: number
): Promise<ReplyContext> {
	const data = await provider.getPullRequestDiff(owner, repo, prNumber);

	return {
		...data,
		owner,
		repo,
		prNumber,
		userId,
	};
}

async function fetchThreadHistory(
	owner: string,
	repo: string,
	prNumber: number,
	provider: VCSProvider | undefined,
	commentId?: number,
	isReviewComment: boolean = false
) {
	// Thread history is a ReviewCapable capability; non-capable providers
	// (GitLab/Bitbucket) degrade to an empty thread.
	if (!provider || !isReviewCapableProvider(provider)) return [];

	if (isReviewComment && commentId) {
		return await provider.getReviewCommentThread(
			owner,
			repo,
			prNumber,
			commentId
		);
	} else {
		return await provider.getIssueCommentThread(owner, repo, prNumber);
	}
}

async function generateCommentReply(
	ctx: ReplyContext,
	commentBody: string,
	threadHistory: any[]
): Promise<string> {
	const threadPrompt =
		threadHistory && threadHistory.length > 0
			? `Conversation History:\n${threadHistory
					.map((c: any) => `${c.author}: ${c.body}`)
					.join("\n\n")}\n\n`
			: "";

	const prompt = `You are Code Sheriff 🤠, an expert AI code reviewer. A developer has asked you a question regarding their Pull Request or a specific line of code.

${threadPrompt}PR Title: ${ctx.title}
PR Description: ${ctx.description || "No description provided"}

Code Changes:
\`\`\`diff
${ctx.diff}
\`\`\`

User's Question:
"${commentBody}"

Please provide a helpful, clear, and constructive answer. Respond as a participant in the conversation thread. If they are asking you to suggest code improvements or fixes, specify them in inline code blocks with exact changes. Keep your response concise, polite, and technical.`;

	return await generateTextWithFallback(prompt);
}

async function sendReplyNotification(
	ctx: ReplyContext,
	replyContent: string
): Promise<void> {
	const repository = await prisma.repository.findFirst({
		where: { owner: ctx.owner, name: ctx.repo },
	});

	if (repository) {
		const review = await prisma.review.findFirst({
			where: {
				repositoryId: repository.id,
				prNumber: ctx.prNumber,
			},
			orderBy: { createdAt: "desc" },
		});

		if (review) {
			await sendCommentReplyNotification(review.id, replyContent as string);
		}
	}
}

/**
 * Inngest function to handle conversational comment replies when @codesheriff is mentioned.
 */
export const handleCommentReply = inngest.createFunction(
	{ id: "handle-comment-reply", concurrency: 5 },
	{ event: "pr.comment.replied" },
	async ({ event, step }) => {
		const {
			owner,
			repo,
			prNumber,
			commentBody,
			commentId,
			isReviewComment,
			userId,
		} = event.data;

		try {
			const resolved = await resolveProviderForRepository(owner, repo);
			const provider = resolved.provider;

			const ctx = await step.run("fetch-pr-data-for-reply", async () => {
				return await fetchReplyPrData(provider, userId, owner, repo, prNumber);
			});

			const threadHistory = await step.run("fetch-thread-history", async () => {
				return await fetchThreadHistory(
					owner,
					repo,
					prNumber,
					provider,
					commentId,
					isReviewComment
				);
			});

			const replyContent = await step.run("generate-comment-reply", async () => {
				return await generateCommentReply(ctx, commentBody, threadHistory);
			});

			await step.run("post-reply-comment", async () => {
				if (isReviewCapableProvider(provider)) {
					await provider.postCommentReply(
						owner,
						repo,
						prNumber,
						replyContent,
						commentId,
						isReviewComment
					);
				} else {
					// GitLab/Bitbucket degrade: post the reply as a plain comment.
					await provider.postReviewComment(
						owner,
						repo,
						prNumber,
						replyContent
					);
				}
			});

			await step.run("send-reply-notification", async () => {
				await sendReplyNotification(ctx, replyContent);
			});

			return { success: true };
		} catch (error) {
			console.error("Failed to process comment reply:", error);
			throw error;
		}
	}
);
