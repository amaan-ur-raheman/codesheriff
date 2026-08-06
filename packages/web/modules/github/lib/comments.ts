import { getOctokit } from "./auth";

/**
 * Posts an AI-generated code review comment to a GitHub pull request
 * @param token - GitHub access token
 * @param owner - Repository owner username
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param review - AI-generated review content
 */
export async function postReviewComment(
	token: string,
	owner: string,
	repo: string,
	prNumber: number,
	review: string
): Promise<number> {
	const octokit = await getOctokit({ token, owner, repo });
	const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/dashboard\/?$/, "");
	const logoUrl = `${appUrl}/logo.png`;

	const response = await octokit.rest.issues.createComment({
		owner,
		repo,
		issue_number: prNumber,
		body: `## 🤠 AI Code Review\n\n${review}\n\n---\n<img src="${logoUrl}" width="32" height="32" align="left" style="margin-right: 8px;" /> *Powered By [CodeSheriff](${appUrl})*`,
	});
	return response.data.id;
}

/**
 * Posts a loading review comment on a pull request.
 */
export async function postLoadingReviewComment(
	token: string,
	owner: string,
	repo: string,
	prNumber: number
): Promise<number> {
	const octokit = await getOctokit({ token, owner, repo });
	const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/dashboard\/?$/, "");
	const logoUrl = `${appUrl}/logo.png`;

	const response = await octokit.rest.issues.createComment({
		owner,
		repo,
		issue_number: prNumber,
		body: `## 🤠 AI Code Review\n\n⏳ **Review in progress...** CodeSheriff is analyzing your pull request and generating review suggestions. This usually takes less than a minute.\n\n---\n<img src="${logoUrl}" width="32" height="32" align="left" style="margin-right: 8px;" /> *Powered By [CodeSheriff](${appUrl})*`,
	});
	return response.data.id;
}

/**
 * Updates a previously posted review comment.
 */
export async function updateReviewComment(
	token: string,
	owner: string,
	repo: string,
	commentId: number,
	review: string
) {
	const octokit = await getOctokit({ token, owner, repo });
	const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/dashboard\/?$/, "");
	const logoUrl = `${appUrl}/logo.png`;

	await octokit.rest.issues.updateComment({
		owner,
		repo,
		comment_id: commentId,
		body: `## 🤠 AI Code Review\n\n${review}\n\n---\n<img src="${logoUrl}" width="32" height="32" align="left" style="margin-right: 8px;" /> *Powered By [CodeSheriff](${appUrl})*`,
	});
}

/**
 * Updates a previously posted review comment with a failure message.
 */
export async function updateReviewCommentFailed(
	token: string,
	owner: string,
	repo: string,
	commentId: number,
	errorMessage: string
) {
	const octokit = await getOctokit({ token, owner, repo });
	const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/dashboard\/?$/, "");
	const logoUrl = `${appUrl}/logo.png`;

	await octokit.rest.issues.updateComment({
		owner,
		repo,
		comment_id: commentId,
		body: `## 🤠 AI Code Review\n\n❌ **Review failed.** An error occurred while generating the review. Please try triggering it again.\n\n**Error:** ${errorMessage}\n\n---\n<img src="${logoUrl}" width="32" height="32" align="left" style="margin-right: 8px;" /> *Powered By [CodeSheriff](${appUrl})*`,
	});
}

/**
 * Posts a reply to a pull request comment thread or issue comment
 * @param token - GitHub access token
 * @param owner - Repository owner username
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param replyContent - Reply body text
 * @param commentId - The ID of the comment to reply to (if review comment)
 * @param isReviewComment - Whether it is a line-level review comment
 */
export async function postCommentReply(
	token: string,
	owner: string,
	repo: string,
	prNumber: number,
	replyContent: string,
	commentId?: number,
	isReviewComment: boolean = false
) {
	const octokit = await getOctokit({ token, owner, repo });
	const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/dashboard\/?$/, "");
	const logoUrl = `${appUrl}/logo.png`;

	const commentBody = `<img src="${logoUrl}" width="24" height="24" align="left" style="margin-right: 8px;" /> 🤠 **Code Sheriff Reply:**\n\n${replyContent}`;

	if (isReviewComment && commentId) {
		await octokit.rest.pulls.createReplyForReviewComment({
			owner,
			repo,
			pull_number: prNumber,
			comment_id: commentId,
			body: commentBody,
		});
	} else {
		await octokit.rest.issues.createComment({
			owner,
			repo,
			issue_number: prNumber,
			body: commentBody,
		});
	}
}

export async function postInlineReviewComments(
	token: string,
	owner: string,
	repo: string,
	prNumber: number,
	comments: {
		path: string;
		line: number;
		body: string;
		side?: "LEFT" | "RIGHT";
		start_line?: number;
		start_side?: "LEFT" | "RIGHT";
	}[]
) {
	const octokit = await getOctokit({ token, owner, repo });

	await octokit.rest.pulls.createReview({
		owner,
		repo,
		pull_number: prNumber,
		event: "COMMENT",
		comments,
	});
}

/**
 * Fetches previous comments in a review comment thread
 */
export async function getReviewCommentThread(
	token: string,
	owner: string,
	repo: string,
	prNumber: number,
	commentId: number
) {
	try {
		const octokit = await getOctokit({ token, owner, repo });

		// Get the comment details to find the thread (in_reply_to_id)
		const { data: targetComment } = await octokit.rest.pulls.getReviewComment({
			owner,
			repo,
			comment_id: commentId,
		});

		// Fetch all review comments for this PR
		const { data: allComments } = await octokit.rest.pulls.listReviewComments({
			owner,
			repo,
			pull_number: prNumber,
		});

		// Find the root comment ID
		const rootId = targetComment.in_reply_to_id || targetComment.id;

		// Filter comments belonging to the same thread (root comment or replies to it)
		const threadComments = allComments
			.filter((c) => c.id === rootId || c.in_reply_to_id === rootId)
			.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

		return threadComments.map((c) => ({
			author: c.user?.login || "unknown",
			body: c.body,
			createdAt: c.created_at,
		}));
	} catch (error) {
		console.error("Failed to fetch review comment thread:", error);
		return [];
	}
}

/**
 * Fetches PR issue comments to get thread history
 */
export async function getIssueCommentThread(
	token: string,
	owner: string,
	repo: string,
	prNumber: number
) {
	try {
		const octokit = await getOctokit({ token, owner, repo });
		const { data: comments } = await octokit.rest.issues.listComments({
			owner,
			repo,
			issue_number: prNumber,
		});
		return comments.map((c) => ({
			author: c.user?.login || "unknown",
			body: c.body || "",
			createdAt: c.created_at,
		}));
	} catch (error) {
		console.error("Failed to fetch issue comments:", error);
		return [];
	}
}
