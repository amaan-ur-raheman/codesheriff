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
import {
	getPullRequestDiff,
	postReviewComment,
	postCommentReply,
	getCompareDiff,
	postInlineReviewComments,
	updatePRCommitStatus,
	createPRCheckRun,
	updatePRCheckRun,
	getReviewCommentThread,
	getIssueCommentThread,
} from "@/modules/github/lib/github";
import { retrieveContext } from "@/modules/ai/lib/rag";
import { verifySuggestionsInSandbox } from "@/modules/ai/lib/sandbox";
import prisma from "@/lib/db";
import {
	sendReviewCompletedNotification,
	sendReviewFailedNotification,
	sendCommentReplyNotification,
} from "@/modules/notifications/actions";
import { sendSlackWebhook, sendDiscordWebhook } from "@/lib/webhooks";

import { generateText } from "ai";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/dashboard\/?$/, "");
const dashboardReviewsUrl = `${appUrl}/dashboard/reviews`;
import { google } from "@ai-sdk/google";

/**
 * Inngest function to generate an AI code review for a Pull Request.
 *
 * Triggered by: "pr.review.requested" event.
 *
 * Workflow:
 * 1. **fetch-pr-data**: Retrieves the PR diff, title, and description from GitHub.
 * 2. **retrieve-context**: Uses RAG to fetch relevant code snippets from the vector DB based on PR content.
 * 3. **generate-ai-review**: Sends the diff and context to Google Gemini to generate the review markdown.
 * 4. **post-comment**: Posts the generated review as a comment on the GitHub PR.
 * 5. **save-review**: Saves the review details to the database.
 */
export const generateReview = inngest.createFunction(
	{ id: "generate-review", concurrency: 5 },
	{ event: "pr.review.requested" },
	async ({ event, step }) => {
		const { owner, repo, prNumber, userId, before, after, checkRunId: eventCheckRunId } = event.data;
		let checkRunId: any = eventCheckRunId || null;

		try {
			const { diff, title, description, token, headSha } = await step.run(
				"fetch-pr-data",
				async () => {
					const account = await prisma.account.findFirst({
						where: {
							userId: userId,
							providerId: "github",
						},
					});

					if (!account?.accessToken) {
						throw new Error("No GitHub access token found");
					}

					const prMetadata = await getPullRequestDiff(
						account.accessToken,
						owner,
						repo,
						prNumber
					);

					let diffContent = prMetadata.diff;

					if (before && after && before !== "0000000000000000000000000000000000000000") {
						try {
							diffContent = await getCompareDiff(
								account.accessToken,
								owner,
								repo,
								before,
								after
							);
						} catch (compareError) {
							console.warn("Failed to get compare diff, falling back to full PR diff:", compareError);
						}
					}

					return {
						diff: diffContent,
						title: prMetadata.title,
						description: prMetadata.description,
						token: account.accessToken,
						headSha: prMetadata.headSha,
					};
				}
			);

			if (!checkRunId) {
				await step.run("update-github-status-pending", async () => {
					await updatePRCommitStatus(
						token,
						owner,
						repo,
						headSha,
						"pending",
						"Review in progress",
						dashboardReviewsUrl
					);
				});

				checkRunId = await step.run("create-github-check-run", async () => {
					return await createPRCheckRun(token, owner, repo, headSha);
				});
			}

			const context = await step.run("retrieve-context", async () => {
				const query = `${title}\n${description}`;

				return await retrieveContext(query, `${owner}/${repo}`);
			});

			const review = await step.run("generate-ai-review", async () => {
				const isIncremental = !!(before && after && before !== "0000000000000000000000000000000000000000");

				const prompt = `You are an expert code reviewer. Analyze the following pull request and provide a detailed, constructive code review.
${isIncremental ? `\n**NOTE:** This is an incremental review focusing ONLY on the latest changes pushed to the PR (base commit: ${before} to head commit: ${after}). Do not re-review parts of the code that are unchanged in this diff.\n` : ""}
PR Title: ${title}
PR Description: ${description || "No description provided"}

Context from Codebase:
${context.join("\n\n")}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Please provide:
1. **Walkthrough**: A file-by-file explanation of the changes.
2. **Sequence Diagram**: A Mermaid JS sequence diagram visualizing the flow of the changes (if applicable). Use \`\`\`mermaid ... \`\`\` block. 
   **STRICT MERMAID RULES**:
   - Start with \`sequenceDiagram\`.
   - **MUST** explicitly declare all participants at the top using \`participant Alias as Name\`.
   - **DO NOT** use special characters like parentheses \`()\`, slashes \`/\`, dots \`.\`, brackets \`[]\`, or braces \`{}\` in participant names or message labels. Use only alphanumeric characters and spaces.
   - Example of a GOOD label: \`Process Payment Request\`
   - Example of a BAD label: \`processPayment(data)\`
   - Keep the diagram focused on the core logic changes.
   - If a diagram is not helpful for these changes, omit this section entirely.
3. **Summary**: Brief overview.
4. **Strengths**: What's done well.
5. **Issues**: Bugs, security concerns, code smells.
6. **Suggestions**: Specific code improvements with inline code blocks.
7. **Poem**: A short, creative poem summarizing the changes at the very end.

After the poem, you MUST include a JSON suggestions block in the following exact format. This block must appear at the very end of your response, wrapped in an HTML comment:

<!-- SUGGESTIONS_JSON
{
  "suggestions": [
    {
      "id": "unique-id-1",
      "filePath": "path/to/file.ts",
      "startLine": 10,
      "endLine": 15,
      "severity": "error",
      "title": "Short title for the issue",
      "description": "Detailed explanation of the problem and how to fix it.",
      "originalCode": "the problematic code",
      "suggestedCode": "the improved code",
      "category": "security"
    }
  ],
  "summary": {
    "totalIssues": 3,
    "errors": 1,
    "warnings": 1,
    "suggestions": 1
  }
}
-->

Rules for the SUGGESTIONS_JSON block:
- "severity" must be one of: "error", "warning", "info", "suggestion"
- "category" should be one of: "security", "performance", "bug", "style", "maintainability", "best-practice", "general"
- Each suggestion must have a unique "id"
- "originalCode" and "suggestedCode" should contain the exact code snippets (use the original indentation)
- If no actionable inline suggestions exist, return an empty suggestions array with all summary counts at 0
- Do NOT include any markdown or text after the closing --> of the SUGGESTIONS_JSON block

Format the rest of your response in markdown.`;

				const { text } = await generateText({
					model: google("gemini-2.5-flash"),
					prompt,
				});

				return text;
			});

			const parsedSuggestions = await step.run("parse-suggestions", async () => {
				const match = (review as string).match(
					/<!--\s*SUGGESTIONS_JSON\s*\n([\s\S]*?)\n\s*-->/
				);

				if (match?.[1]) {
					try {
						const parsed = JSON.parse(match[1]);
						return {
							suggestions: Array.isArray(parsed.suggestions)
								? parsed.suggestions
								: [],
							summary: parsed.summary ?? {
								totalIssues: 0,
								errors: 0,
								warnings: 0,
								suggestions: 0,
							},
						};
					} catch {
						return null;
					}
				}

				return null;
			});

			const verifiedSuggestions = await step.run("verify-suggestions-sandbox", async () => {
				if (!parsedSuggestions || !parsedSuggestions.suggestions || parsedSuggestions.suggestions.length === 0) {
					return parsedSuggestions;
				}

				try {
					const verificationResults = await verifySuggestionsInSandbox(
						token as string,
						owner,
						repo,
						prNumber,
						parsedSuggestions.suggestions
					);

					const updatedSuggestions = parsedSuggestions.suggestions.map((s: any) => {
						const result = verificationResults.find((r) => r.id === s.id);
						return {
							...s,
							verified: result ? result.success : false,
							verificationLog: result?.errorLog || undefined,
						};
					});

					return {
						...parsedSuggestions,
						suggestions: updatedSuggestions,
					};
				} catch (sandboxError) {
					console.error("Sandbox verification execution failed:", sandboxError);
					return parsedSuggestions;
				}
			});

			await step.run("post-comment", async () => {
				// Post the main overview review comment
				await postReviewComment(token as string, owner, repo, prNumber, review as string);

				// Post inline file suggestions if they exist
				if (verifiedSuggestions && verifiedSuggestions.suggestions && verifiedSuggestions.suggestions.length > 0) {
					try {
						const inlineComments = verifiedSuggestions.suggestions.map((s: any) => {
							const severityText = s.severity === "error" 
								? "⚠️ Potential issue | 🔴 Critical" 
								: s.severity === "warning" 
									? "⚠️ Potential issue | 🟡 Major" 
									: "ℹ️ Suggestion";
							
							const title = s.title ? `### ${severityText}\n**${s.title}**\n\n` : `### ${severityText}\n\n`;
							const description = s.description ? `${s.description}\n\n` : "";
							
							let suggestionBlock = "";
							if (s.suggestedCode !== undefined && s.suggestedCode !== null) {
								suggestionBlock = `<details>\n<summary>Suggested fix</summary>\n\n\`\`\`suggestion\n${s.suggestedCode}\n\`\`\`\n</details>\n\n`;
							}

							const promptBlock = `<details>\n<summary>🤖 Prompt for AI Agents</summary>\n\nVerify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.\n\nIn \`@${s.filePath}\` at line ${s.startLine}, ${s.title ? `${s.title}: ` : ""}${s.description}\n</details>\n\n`;

							const commentObj: any = {
								path: s.filePath,
								line: s.endLine || s.startLine,
								side: "RIGHT",
								body: `${title}${description}${suggestionBlock}${promptBlock}`,
							};

							// Support multi-line suggestions
							if (s.startLine && s.endLine && s.startLine < s.endLine) {
								commentObj.start_line = s.startLine;
								commentObj.start_side = "RIGHT";
							}

							return commentObj;
						});

						await postInlineReviewComments(token as string, owner, repo, prNumber, inlineComments);
					} catch (inlineError) {
						console.error("Failed to post inline review comments:", inlineError);
					}
				}
			});

			const savedReview = await step.run("save-review", async () => {
				const repository = await prisma.repository.findFirst({
					where: {
						owner,
						name: repo,
					},
				});

				if (repository) {
					return await prisma.review.create({
						data: {
							repositoryId: repository.id,
							prNumber,
							prTitle: title,
							prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
							review: review as string,
							suggestions: verifiedSuggestions
								? (verifiedSuggestions as any)
								: undefined,
							status: "completed",
						},
					});
				}
			});

			await step.run("send-notification", async () => {
				if (savedReview) {
					await sendReviewCompletedNotification(savedReview.id);
				}
			});

			await step.run("update-github-status-success", async () => {
				await updatePRCommitStatus(
					token,
					owner,
					repo,
					headSha,
					"success",
					"Review complete",
					dashboardReviewsUrl
				);
			});

			if (checkRunId) {
				await step.run("update-github-check-run-success", async () => {
					const validSuggestions = (verifiedSuggestions?.suggestions || []).filter((s: any) => {
						if (!s) return false;
						const startLine = Number(s.startLine);
						if (isNaN(startLine) || startLine <= 0) {
							return false;
						}
						const endLine = s.endLine !== undefined ? Number(s.endLine) : startLine;
						if (isNaN(endLine) || endLine < startLine || endLine <= 0) {
							return false;
						}
						return true;
					});

					const annotations = validSuggestions.map((s: any) => {
						let level: "notice" | "warning" | "failure" = "notice";
						if (s.severity === "error") level = "failure";
						else if (s.severity === "warning") level = "warning";
						
						const start = Number(s.startLine);
						const end = s.endLine !== undefined ? Number(s.endLine) : start;

						return {
							path: s.filePath,
							start_line: start,
							end_line: end,
							annotation_level: level,
							message: s.description || "Code suggestion",
							title: s.title || "CodeSheriff Finding",
						};
					});

					await updatePRCheckRun(
						token,
						owner,
						repo,
						checkRunId,
						"completed",
						"success",
						`CodeSheriff review completed. Found ${annotations.length} findings.`,
						annotations
					);
				});
			}

			await step.run("send-webhook-notifications", async () => {
				const repository = await prisma.repository.findFirst({
					where: { owner, name: repo },
					include: {
						user: {
							include: {
								organizationMemberships: {
									include: {
										organization: {
											include: {
												integrations: {
													where: { isActive: true },
												},
											},
										},
									},
								},
							},
						},
					},
				});

				if (!repository) return;

				const reviewSummary =
					typeof review === "string"
						? review.slice(0, 2000)
						: "Review completed";

				for (const membership of repository.user.organizationMemberships) {
					for (const integration of membership.organization.integrations) {
						const config = integration.config as any;
						const webhookUrl = config?.webhookUrl;
						if (!webhookUrl) continue;

						if (integration.type === "slack") {
							await sendSlackWebhook(webhookUrl, {
								text: `:horse: Review completed for PR #${prNumber} in ${owner}/${repo}`,
								blocks: [
									{
										type: "section",
										text: {
											type: "mrkdwn",
											text: `:white_check_mark: *Review Complete*\n*PR:* <${`https://github.com/${owner}/${repo}/pull/${prNumber}`}|#${prNumber} ${title}>\n*Repo:* ${owner}/${repo}\n\n${reviewSummary.slice(0, 300)}...`,
										},
									},
								],
							});
						} else if (integration.type === "discord") {
							await sendDiscordWebhook(webhookUrl, {
								content: "",
								embeds: [
									{
										title: `Review Complete: #${prNumber} ${title}`,
										description: reviewSummary.slice(0, 2000),
										url: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
										color: 0x22c55e,
										author: {
											name: `${owner}/${repo}`,
										},
									},
								],
							});
						}
					}
				}
			});

			return { success: true };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			// Attempt to update commit status to failure on GitHub
			try {
				const account = await prisma.account.findFirst({
					where: {
						userId: userId,
						providerId: "github",
					},
				});
				if (account?.accessToken) {
					let sha = after;
					if (!sha || sha === "0000000000000000000000000000000000000000") {
						try {
							const prData = await getPullRequestDiff(
								account.accessToken,
								owner,
								repo,
								prNumber
							);
							sha = prData.headSha;
						} catch (_) {}
					}
					if (sha) {
						await step.run("update-github-status-failed", async () => {
							await updatePRCommitStatus(
								account.accessToken as string,
								owner,
								repo,
								sha,
								"failure",
								"Review failed: " + errorMessage.slice(0, 50),
								dashboardReviewsUrl
							);
						});

						if (checkRunId) {
							await step.run("update-github-check-run-failed", async () => {
								await updatePRCheckRun(
									account.accessToken as string,
									owner,
									repo,
									checkRunId,
									"completed",
									"failure",
									"CodeSheriff review failed: " + errorMessage.slice(0, 100)
								);
							});
						}
					}
				}
			} catch (statusError) {
				console.error("Failed to post error status to GitHub:", statusError);
			}

			const failedReview = await step.run("create-failed-review", async () => {
				const repository = await prisma.repository.findFirst({
					where: { owner, name: repo },
				});

				if (repository) {
					return await prisma.review.create({
						data: {
							repositoryId: repository.id,
							prNumber,
							prTitle: `${owner}/${repo} PR #${prNumber}`,
							prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
							review: `Review failed: ${errorMessage}`,
							status: "failed",
						},
					});
				}
			});

			if (failedReview) {
				await step.run("send-failure-notification", async () => {
					await sendReviewFailedNotification(failedReview.id, errorMessage);
				});
			}

			throw error;
		}
	}
);

/**
 * Inngest function to handle conversational comment replies when @codesheriff is mentioned.
 *
 * Triggered by: "pr.comment.replied" event.
 */
export const handleCommentReply = inngest.createFunction(
	{ id: "handle-comment-reply", concurrency: 5 },
	{ event: "pr.comment.replied" },
	async ({ event, step }) => {
		const { owner, repo, prNumber, commentBody, commentId, isReviewComment, userId } = event.data;

		try {
			const { diff, title, description, token } = await step.run(
				"fetch-pr-data-for-reply",
				async () => {
					const account = await prisma.account.findFirst({
						where: {
							userId: userId,
							providerId: "github",
						},
					});

					if (!account?.accessToken) {
						throw new Error("No GitHub access token found");
					}

					const data = await getPullRequestDiff(
						account.accessToken,
						owner,
						repo,
						prNumber
					);

					return {
						...data,
						token: account.accessToken,
					};
				}
			);

			const threadHistory = await step.run("fetch-thread-history", async () => {
				if (isReviewComment && commentId) {
					return await getReviewCommentThread(token, owner, repo, prNumber, commentId);
				} else {
					return await getIssueCommentThread(token, owner, repo, prNumber);
				}
			});

			const replyContent = await step.run("generate-comment-reply", async () => {
				const threadPrompt = threadHistory && threadHistory.length > 0
					? `Conversation History:\n${threadHistory.map((c: any) => `${c.author}: ${c.body}`).join("\n\n")}\n\n`
					: "";

				const prompt = `You are Code Sheriff 🤠, an expert AI code reviewer. A developer has asked you a question regarding their Pull Request or a specific line of code.

${threadPrompt}PR Title: ${title}
PR Description: ${description || "No description provided"}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

User's Question:
"${commentBody}"

Please provide a helpful, clear, and constructive answer. Respond as a participant in the conversation thread. If they are asking you to suggest code improvements or fixes, specify them in inline code blocks with exact changes. Keep your response concise, polite, and technical.`;

				const { text } = await generateText({
					model: google("gemini-2.5-flash"),
					prompt,
				});

				return text;
			});

			await step.run("post-reply-comment", async () => {
				await postCommentReply(
					token,
					owner,
					repo,
					prNumber,
					replyContent,
					commentId,
					isReviewComment
				);
			});

			await step.run("send-reply-notification", async () => {
				const repository = await prisma.repository.findFirst({
					where: { owner, name: repo },
				});

				if (repository) {
					const review = await prisma.review.findFirst({
						where: {
							repositoryId: repository.id,
							prNumber,
						},
						orderBy: { createdAt: "desc" },
					});

					if (review) {
						await sendCommentReplyNotification(
							review.id,
							replyContent as string
						);
					}
				}
			});

			return { success: true };
		} catch (error) {
			console.error("Failed to process comment reply:", error);
			throw error;
		}
	}
);
