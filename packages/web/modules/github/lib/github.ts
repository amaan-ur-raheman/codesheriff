import { Octokit } from "octokit";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * Retrieves the GitHub access token for the currently authenticated user.
 *
 * @throws Error if the user is not authenticated or hasn't connected GitHub.
 * @returns The GitHub access token string.
 */
export const getGithubAccessToken = async () => {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		throw new Error("Unauthorized");
	}

	const account = await prisma.account.findFirst({
		where: {
			userId: session.user.id,
			providerId: "github",
		},
	});

	if (!account?.accessToken) {
		throw new Error("No GitHub access token found");
	}

	return account.accessToken;
};

/**
 * Fetches user contribution data from GitHub GraphQL API.
 *
 * @param token - GitHub access token.
 * @param username - GitHub username.
 * @returns The contribution calendar data.
 */
/**
 * Fetches GitHub user contribution data using GraphQL API
 * @param token - GitHub access token
 * @param username - GitHub username
 * @returns Promise resolving to contribution calendar data
 */
export async function fetchUserContribution(token: string, username: string) {
	const octokit = new Octokit({ auth: token });

	const query = `
        query($username: String!) {
            user(login: $username) {
                contributionsCollection {
                    contributionCalendar {
                        totalContributions
                        weeks {
                            contributionDays {
                                contributionCount
                                date
                                color
                            }
                        }
                    }
                }
            }
        }
    `;

	/* interface ContributionData {
		user: {
			contributionCollection: {
				contributionCalendar: {
					totalContributions: number;
					weeks: {
						contributionDays: {
							contributionCount: number;
							date: string | Date;
							color: string;
						}[];
					}[];
				};
			};
		};
	} */

	try {
		const response: any = await octokit.graphql(query, {
			username,
		});

		if (!response.user) {
			throw new Error(`GitHub user '${username}' not found`);
		}

		return response.user.contributionsCollection.contributionCalendar;
	} catch (error) {
		console.error("Error fetching contribution data:", error);
		throw new Error(
			"Failed to fetch contribution data from GitHub: " +
				(error as Error).message
		);
	}
}

/**
 * Lists repositories for the authenticated user.
 *
 * @param page - Page number (default: 1).
 * @param perPage - Repositories per page (default: 10).
 * @returns List of repositories.
 */
export const getRepositories = async (
	page: number = 1,
	perPage: number = 10
) => {
	const token = await getGithubAccessToken();
	const octokit = new Octokit({ auth: token });

	const { data } = await octokit.rest.repos.listForAuthenticatedUser({
		sort: "updated",
		direction: "desc",
		visibility: "all",
		per_page: perPage,
		page: page,
	});

	return data;
};

/**
 * Creates a webhook on a GitHub repository to listen for pull request events.
 * If the webhook already exists, it returns the existing one.
 *
 * @param owner - Repository owner.
 * @param repo - Repository name.
 * @returns The created or existing webhook data.
 */
export const createWebhook = async (owner: string, repo: string) => {
	const token = await getGithubAccessToken();
	const octokit = new Octokit({ auth: token });

	const webhookUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/webhooks/github`;

	const { data: hooks } = await octokit.rest.repos.listWebhooks({
		owner,
		repo,
	});

	const existingWebhook = hooks.find(
		(hook) => hook.config.url === webhookUrl
	);
	if (existingWebhook) {
		return existingWebhook;
	}

	const { data } = await octokit.rest.repos.createWebhook({
		owner,
		repo,
		config: {
			url: webhookUrl,
			content_type: "json",
		},
		events: ["pull_request", "issue_comment", "pull_request_review_comment"],
	});

	return data;
};

/**
 * Deletes the Code Horse webhook from a GitHub repository.
 *
 * @param owner - Repository owner.
 * @param repo - Repository name.
 * @returns True if successful or webhook didn't exist, false otherwise.
 */
export const deleteWebhook = async (owner: string, repo: string) => {
	const token = await getGithubAccessToken();
	const octokit = new Octokit({ auth: token });
	const webhookUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/webhooks/github`;

	try {
		const { data: hooks } = await octokit.rest.repos.listWebhooks({
			owner,
			repo,
		});

		const hookToDelete = hooks.find(
			(hook) => hook.config.url === webhookUrl
		);

		if (hookToDelete) {
			await octokit.rest.repos.deleteWebhook({
				owner,
				repo,
				hook_id: hookToDelete.id,
			});

			return true;
		}

		return false;
	} catch (error) {
		console.error("Error deleting webhook:", error);
		return false;
	}
};

/**
 * Recursively fetches contents of all files in a repository.
 *
 * @param token - GitHub access token.
 * @param owner - Repository owner.
 * @param repo - Repository name.
 * @param path - Current path to fetch (default: root).
 * @returns Array of file objects with path and decoded content.
 */
/**
 * Recursively fetches all file contents from a GitHub repository
 * @param token - GitHub access token
 * @param owner - Repository owner username
 * @param repo - Repository name
 * @param path - Directory path to start from (default: root)
 * @returns Promise resolving to array of file objects with path and content
 */
export async function getRepoFileContents(
	token: string,
	owner: string,
	repo: string,
	path: string = ""
): Promise<
	{
		path: string;
		content: string;
	}[]
> {
	const octokit = new Octokit({ auth: token });

	const { data } = await octokit.rest.repos.getContent({
		owner,
		repo,
		path,
	});

	if (!Array.isArray(data)) {
		// It's a file
		if (data.type === "file" && data.content) {
			return [
				{
					path: data.path,
					content: Buffer.from(data.content, "base64").toString(
						"utf-8"
					),
				},
			];
		}
		return [];
	}

	let files: { path: string; content: string }[] = [];

	for (const item of data) {
		if (item.type === "file") {
			const { data: fileData } = await octokit.rest.repos.getContent({
				owner,
				repo,
				path: item.path,
			});

			if (
				!Array.isArray(fileData) &&
				fileData.type === "file" &&
				fileData.content
			) {
				// Filter out non-code files if needed (images, etc)
				// For now lets include everything that looks like text
				if (
					!item.path.match(
						/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz)$/i
					)
				) {
					files.push({
						path: item.path,
						content: Buffer.from(
							fileData.content,
							"base64"
						).toString("utf-8"),
					});
				}
			}
		} else if (item.type === "dir") {
			const subFiles = await getRepoFileContents(
				token,
				owner,
				repo,
				item.path
			);

			files = files.concat(subFiles);
		}
	}

	return files;
}

/**
 * Fetches the diff, title, and description of a pull request.
 *
 * @param token - GitHub access token.
 * @param owner - Repository owner.
 * @param repo - Repository name.
 * @param prNumber - Pull request number.
 * @returns Object containing diff string, title, and description.
 */
/**
 * Fetches pull request diff and metadata from GitHub
 * @param token - GitHub access token
 * @param owner - Repository owner username
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns Promise resolving to PR diff, title, and description
 */
export async function getPullRequestDiff(
	token: string,
	owner: string,
	repo: string,
	prNumber: number
) {
	const octokit = new Octokit({ auth: token });

	const { data: pr } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: prNumber,
	});

	const { data: diff } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: prNumber,
		mediaType: {
			format: "diff",
		},
	});

	return {
		diff: diff as unknown as string,
		title: pr.title,
		description: pr.body,
	};
}

/**
 * Posts a review comment on a pull request.
 *
 * @param token - GitHub access token.
 * @param owner - Repository owner.
 * @param repo - Repository name.
 * @param prNumber - Pull request number.
 * @param review - The markdown content of the review.
 */
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
) {
	const octokit = new Octokit({ auth: token });

	await octokit.rest.issues.createComment({
		owner,
		repo,
		issue_number: prNumber,
		body: `## 🤖 AI Code Review\n\n${review}\n\n---\n*Powered By CodeHorse*`,
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
	const octokit = new Octokit({ auth: token });

	if (isReviewComment && commentId) {
		await octokit.rest.pulls.createReplyForReviewComment({
			owner,
			repo,
			pull_number: prNumber,
			comment_id: commentId,
			body: `🐴 **Code Horse Reply:**\n\n${replyContent}`,
		});
	} else {
		await octokit.rest.issues.createComment({
			owner,
			repo,
			issue_number: prNumber,
			body: `🐴 **Code Horse Reply:**\n\n${replyContent}`,
		});
	}
}

/**
 * Compares two commit SHAs and returns the raw diff string
 * @param token - GitHub access token
 * @param owner - Repository owner username
 * @param repo - Repository name
 * @param base - Base commit SHA (before)
 * @param head - Head commit SHA (after)
 * @returns Promise resolving to the diff string
 */
export async function getCompareDiff(
	token: string,
	owner: string,
	repo: string,
	base: string,
	head: string
): Promise<string> {
	const octokit = new Octokit({ auth: token });

	const { data: diff } = await octokit.rest.repos.compareCommits({
		owner,
		repo,
		base,
		head,
		mediaType: {
			format: "diff",
		},
	});

	return diff as unknown as string;
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
	const octokit = new Octokit({ auth: token });

	await octokit.rest.pulls.createReview({
		owner,
		repo,
		pull_number: prNumber,
		event: "COMMENT",
		comments,
	});
}

