import { isReviewCapableProvider } from "@/modules/vcs/resolve";
import { getValidDiffLines } from "@/modules/github/lib/github";
import type { ReviewContext, ParsedSuggestions } from "../context";

/**
 * Step: post-comment
 * Posts the final overview review comment (updating the loading comment where
 * possible), then posts inline file suggestions that land on valid diff lines.
 * Inline comments are only posted on ReviewCapableProvider; GitLab/Bitbucket
 * degrade to the overview comment only.
 */
export async function postComment(
	ctx: ReviewContext,
	review: string,
	verifiedSuggestions: ParsedSuggestions | null
): Promise<void> {
	const provider = ctx.provider;
	const capable = isReviewCapableProvider(provider);

	// Post or update the main overview review comment
	if (ctx.loadingCommentId && capable) {
		await provider.updateReviewComment(
			ctx.owner,
			ctx.repo,
			ctx.loadingCommentId,
			review
		);
	} else {
		await provider.postReviewComment(
			ctx.owner,
			ctx.repo,
			ctx.prNumber,
			review
		);
	}

	// Post inline file suggestions if they exist (ReviewCapable only)
	if (!capable) return;

	if (
		verifiedSuggestions &&
		verifiedSuggestions.suggestions &&
		verifiedSuggestions.suggestions.length > 0
	) {
		try {
			const validDiffLines = getValidDiffLines(ctx.diff);
			const inlineComments = verifiedSuggestions.suggestions
				.map((s: any) => {
					const severityText =
						s.severity === "error"
							? "⚠️ Potential issue | 🔴 Critical"
							: s.severity === "warning"
							? "⚠️ Potential issue | 🟡 Major"
							: "ℹ️ Suggestion";

					const title = s.title
						? `### ${severityText}\n**${s.title}**\n\n`
						: `### ${severityText}\n\n`;
					const description = s.description ? `${s.description}\n\n` : "";

					let suggestionBlock = "";
					if (
						s.suggestedCode !== undefined &&
						s.suggestedCode !== null
					) {
						suggestionBlock = `\`\`\`suggestion\n${s.suggestedCode}\n\`\`\`\n\n`;
					}

					const promptBlock = `<details>\n<summary>🤖 Prompt for AI Agents</summary>\n\nVerify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.\n\nIn \`@${s.filePath}\` at line ${s.startLine}, ${
						s.title ? `${s.title}: ` : ""
					}${s.description || ""}\n</details>\n\n`;

					const endLine = s.endLine || s.startLine;
					const commentObj: any = {
						path: s.filePath,
						line: endLine,
						side: "RIGHT",
						body: `${title}${description}${suggestionBlock}${promptBlock}`,
					};

					// Support multi-line suggestions
					if (s.startLine && s.endLine && s.startLine < s.endLine) {
						commentObj.start_line = s.startLine;
						commentObj.start_side = "RIGHT";
					}

					return commentObj;
				})
				.filter((comment: any) => {
					const filePath = comment.path;
					const line = comment.line;
					const startLine = comment.start_line;

					const fileValidLines = validDiffLines[filePath];
					if (!fileValidLines) {
						console.warn(
							`Skipping comment for file not in diff: ${filePath}`
						);
						return false;
					}

					// Check if end line is in diff
					if (!fileValidLines.has(line)) {
						console.warn(
							`Skipping comment for line not in diff: ${filePath}:${line}`
						);
						return false;
					}

					// If multi-line, check start line. If start line is not in diff, degrade to single line.
					if (startLine && !fileValidLines.has(startLine)) {
						console.warn(
							`Degrading multi-line comment to single line: ${filePath}:${startLine}-${line}`
						);
						delete comment.start_line;
						delete comment.start_side;
						// Remove the suggestion block to avoid posting an invalid multi-line suggestion on a single-line comment
						comment.body = comment.body.replace(
							/```suggestion\r?\n[\s\S]*?\r?\n```\r?\n\r?\n/,
							""
						);
					}

					return true;
				});

			if (inlineComments.length > 0) {
				await provider.postInlineReviewComments(
					ctx.owner,
					ctx.repo,
					ctx.prNumber,
					inlineComments
				);
			} else {
				console.log("No valid inline comments within the PR diff to post.");
			}
		} catch (inlineError) {
			console.error("Failed to post inline review comments:", inlineError);
		}
	}
}
