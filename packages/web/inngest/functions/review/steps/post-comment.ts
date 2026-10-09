import { isReviewCapableProvider } from "@/modules/vcs/resolve";
import { getValidDiffLines } from "@/modules/github/lib/github";
import { verifyStatusMarkdown } from "@/modules/review/lib/verify-status";
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

				const endLine = s.endLine || s.startLine;
				const startLine = s.startLine || endLine;
				const rangeSize = endLine - startLine + 1;

				/**
				 * GitHub applies a ```suggestion block by replacing exactly the
				 * commented range, so the block must have precisely that many
				 * lines. Models routinely disagree with themselves here — a
				 * 9-line range carrying an 11-line replacement — and the review
				 * still posts fine. The failure only surfaces later, as
				 * "Applying suggestions on deleted lines is currently not
				 * supported", because GitHub maps the surplus lines past the
				 * range and onto deleted content.
				 *
				 * A mismatched block is therefore dropped rather than shipped:
				 * the explanation and the fix still reach the reader, they just
				 * are not one click away.
				 */
				let suggestionBlock = "";
				if (
					s.suggestedCode !== undefined &&
					s.suggestedCode !== null
				) {
					const blockLines = s.suggestedCode.split(/\r?\n/).length;

					if (blockLines === rangeSize) {
						suggestionBlock = `\`\`\`suggestion\n${s.suggestedCode}\n\`\`\`\n\n`;
					} else {
						// Unapplicable as one-click, but the fix must still reach the
						// reader — so show it as a diff. GitHub renders an "Apply
						// suggestion" button only for a real suggestion block, so
						// dropping it silently would lose the fix entirely.
						console.warn(
							`Rendering suggestion as a diff: ${blockLines} line(s) of suggestedCode cannot replace a ${rangeSize}-line range at ${s.filePath}:${startLine}-${endLine}`
						);

						const before = (s.originalCode || "").split(/\r?\n/) as string[];
						const after = s.suggestedCode.split(/\r?\n/) as string[];
						const diff = [
							...before.map((line) => `- ${line}`),
							...after.map((line) => `+ ${line}`),
						].join("\n");

						suggestionBlock = `\`\`\`diff\n${diff}\n\`\`\`\n\n`;
					}
				}

				// Per-suggestion sandbox verify status (verified / failed /
				// sandbox_error). Neutral suggestions render no status line.
				const verifyStatusLine = verifyStatusMarkdown(s);

				const promptBlock = `<details>\n<summary>🤖 Prompt for AI Agents</summary>\n\nVerify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.\n\nIn \`@${s.filePath}\` at line ${startLine}, ${
					s.title ? `${s.title}: ` : ""
				}${s.description || ""}\n</details>\n\n`;

				const commentObj: any = {
					path: s.filePath,
					line: endLine,
					side: "RIGHT",
					body: `${verifyStatusLine}${title}${description}${suggestionBlock}${promptBlock}`,
				};

				// Support multi-line suggestions
				if (startLine < endLine) {
					commentObj.start_line = startLine;
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

					// A multi-line replacement block is only valid on a comment that
					// spans the same number of lines, so once we drop to a single
					// line the block has to go with it.
					const degradeToSingleLine = () => {
						delete comment.start_line;
						delete comment.start_side;
						comment.body = comment.body.replace(
							/```suggestion\r?\n[\s\S]*?\r?\n```\r?\n\r?\n/,
							""
						);
					};

					// Models routinely overstate endLine — a 53-line file gets a
					// 53-67 range, and every comment is then dropped. Anchoring to
					// a line the model itself declared is faithful, so prefer that
					// over losing the finding entirely. We never reach outside the
					// declared range, because guessing a different line risks
					// pointing the reader at code the finding isn't about.
					if (!fileValidLines.has(line)) {
						const rangeStart = comment.start_line ?? line;
						let anchored: number | null = null;

						for (
							let candidate = rangeStart;
							candidate <= line;
							candidate++
						) {
							if (fileValidLines.has(candidate)) {
								anchored = candidate;
								break;
							}
						}

						if (anchored === null) {
							console.warn(
								`Skipping comment: no line in ${rangeStart}-${line} is in the diff: ${filePath}`
							);
							return false;
						}

						console.warn(
							`Anchoring comment to line ${anchored} (declared ${rangeStart}-${line}): ${filePath}`
						);
						comment.line = anchored;
						degradeToSingleLine();
						return true;
					}

					// If multi-line, check start line. If start line is not in diff, degrade to single line.
					if (startLine && !fileValidLines.has(startLine)) {
						console.warn(
							`Degrading multi-line comment to single line: ${filePath}:${startLine}-${line}`
						);
						degradeToSingleLine();
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
