import { generateTextWithFallback } from "@/modules/ai/lib/models";
import type { ReviewContext } from "../context";

/**
 * Step: generate-ai-review
 * Builds the review prompt from the PR metadata + RAG context and calls the
 * model (with fallback). Returns the raw model output, which includes the
 * SUGGESTIONS_JSON block.
 */
export async function generateAiReview(
	ctx: ReviewContext,
	context: string[]
): Promise<string> {
	const isIncremental = !!(
		ctx.before &&
		ctx.after &&
		ctx.before !== "0000000000000000000000000000000000000000"
	);

	const prompt = `You are an expert code reviewer. Analyze the following pull request and provide a detailed, constructive code review.
${isIncremental ? `\n**NOTE:** This is an incremental review focusing ONLY on the latest changes pushed to the PR (base commit: ${ctx.before} to head commit: ${ctx.after}). Do not re-review parts of the code that are unchanged in this diff.\n` : ""}
PR Title: ${ctx.title}
PR Description: ${ctx.description || "No description provided"}

Context from Codebase:
${context.join("\n\n")}

Code Changes:
\`\`\`diff
${ctx.diff}
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
6. **Poem**: A short, creative poem summarizing the changes at the very end.

IMPORTANT: Do NOT include any code suggestions, code improvements, or diff blocks in the main markdown sections of your response (Walkthrough, Summary, Issues, etc.), as these will be posted separately as inline comments directly on GitHub. Provide ALL code suggestions, improvements, and diffs ONLY inside the SUGGESTIONS_JSON block at the end.

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

	return await generateTextWithFallback(prompt);
}
