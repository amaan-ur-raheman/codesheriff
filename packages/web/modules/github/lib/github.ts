import { Octokit, App } from "octokit";
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

let appInstance: App | null = null;

/**
 * Gets an authenticated Octokit instance. If GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY
 * are present, it authenticates as the GitHub App (the CodeSheriff Bot) for the given
 * repository. Otherwise, it falls back to the user's OAuth access token.
 */
export async function getOctokit(params: {
	token?: string;
	owner?: string;
	repo?: string;
}): Promise<Octokit> {
	const appId = process.env.GITHUB_APP_ID;
	const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

	if (appId && privateKey && params.owner && params.repo) {
		try {
			if (!appInstance) {
				const formattedKey = privateKey.replace(/\\n/g, "\n");
				appInstance = new App({
					appId,
					privateKey: formattedKey,
				});
			}

			// Get the installation for the specified repository
			const { data: installation } = await appInstance.octokit.request(
				"GET /repos/{owner}/{repo}/installation",
				{
					owner: params.owner,
					repo: params.repo,
				}
			);

			return await appInstance.getInstallationOctokit(installation.id);
		} catch (error) {
			console.error(
				"Failed to authenticate as GitHub App, falling back to OAuth access token:",
				error
			);
		}
	}

	const token = params.token || (await getGithubAccessToken().catch(() => undefined));
	if (!token) {
		throw new Error(
			"No authorization method available (no GitHub App credentials and no access token)"
		);
	}

	return new Octokit({ auth: token });
}

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
	const octokit = await getOctokit({ token });

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
	const octokit = await getOctokit({ token });

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
	const octokit = await getOctokit({ token, owner, repo });

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
 * Deletes the Code Sheriff webhook from a GitHub repository.
 *
 * @param owner - Repository owner.
 * @param repo - Repository name.
 * @returns True if successful or webhook didn't exist, false otherwise.
 */
export const deleteWebhook = async (owner: string, repo: string) => {
	const token = await getGithubAccessToken();
	const octokit = await getOctokit({ token, owner, repo });
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
	const octokit = await getOctokit({ token, owner, repo });

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
	const octokit = await getOctokit({ token, owner, repo });

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
		headSha: pr.head.sha,
	};
}

/**
 * Updates the commit status on GitHub for a PR commit.
 *
 * @param token - GitHub access token.
 * @param owner - Repository owner username.
 * @param repo - Repository name.
 * @param sha - Commit SHA.
 * @param state - Status check state.
 * @param description - Description of the check status.
 * @param targetUrl - Detail page url.
 */
export async function updatePRCommitStatus(
	token: string,
	owner: string,
	repo: string,
	sha: string,
	state: "pending" | "success" | "failure" | "error",
	description: string,
	targetUrl?: string
) {
	try {
		const octokit = await getOctokit({ token, owner, repo });
		await octokit.rest.repos.createCommitStatus({
			owner,
			repo,
			sha,
			state,
			description,
			context: "CodeSheriff",
			target_url: targetUrl,
		});
	} catch (error) {
		console.error("Failed to update commit status on GitHub:", error);
	}
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
	const octokit = await getOctokit({ token, owner, repo });
	const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/dashboard\/?$/, "");
	const logoUrl = `${appUrl}/logo.png`;

	await octokit.rest.issues.createComment({
		owner,
		repo,
		issue_number: prNumber,
		body: `## 🤠 AI Code Review\n\n${review}\n\n---\n<img src="${logoUrl}" width="32" height="32" align="left" style="margin-right: 8px;" /> *Powered By [CodeSheriff](${appUrl})*`,
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
	const octokit = await getOctokit({ token, owner, repo });

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
 * Creates a check run on GitHub for a PR commit.
 */
export async function createPRCheckRun(
	token: string,
	owner: string,
	repo: string,
	sha: string
) {
	try {
		const octokit = await getOctokit({ token, owner, repo });
		const response = await octokit.rest.checks.create({
			owner,
			repo,
			name: "CodeSheriff Review",
			head_sha: sha,
			status: "in_progress",
			started_at: new Date().toISOString(),
		});
		return response.data.id;
	} catch (error: any) {
		if (error && error.status === 403) {
			console.error(
				"Failed to create GitHub check run: 403 Forbidden. " +
				"This usually indicates insufficient permissions (e.g., using an OAuth user token instead of a GitHub App installation token). " +
				"The Checks API write endpoints require GitHub App permissions.",
				error
			);
		} else {
			console.error("Failed to create GitHub check run:", error);
		}
		return null;
	}
}

/**
 * Updates a check run on GitHub with completion status and annotations.
 */
export async function updatePRCheckRun(
	token: string,
	owner: string,
	repo: string,
	checkRunId: number,
	status: "completed",
	conclusion: "success" | "failure" | "cancelled" | "timed_out",
	summary: string,
	annotations?: {
		path: string;
		start_line: number;
		end_line: number;
		annotation_level: "notice" | "warning" | "failure";
		message: string;
		title?: string;
	}[]
) {
	try {
		const octokit = await getOctokit({ token, owner, repo });
		const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/dashboard\/?$/, "");
		const logoUrl = `${appUrl}/logo.png`;
		
		// GitHub limits annotations to 50 per request
		const chunkedAnnotations = annotations ? annotations.slice(0, 50) : undefined;

		await octokit.rest.checks.update({
			owner,
			repo,
			check_run_id: checkRunId,
			status,
			conclusion,
			completed_at: new Date().toISOString(),
			output: {
				title: "CodeSheriff Code Review",
				summary: `<img src="${logoUrl}" width="48" height="48" align="right" />\n\n${summary}`,
				annotations: chunkedAnnotations,
			},
		});
	} catch (error) {
		console.error("Failed to update GitHub check run:", error);
	}
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

