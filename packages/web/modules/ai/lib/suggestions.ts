/**
 * Types and parser for inline code suggestions from AI reviews.
 *
 * Suggestions are embedded as a JSON block in the review markdown
 * inside an HTML comment: <!-- SUGGESTIONS_JSON { ... } -->
 */

export interface CodeSuggestion {
	id: string;
	filePath: string;
	startLine: number;
	endLine: number;
	severity: "error" | "warning" | "info" | "suggestion";
	title: string;
	description: string;
	originalCode: string;
	suggestedCode: string;
	category: string;
	verified?: boolean;
	verificationLog?: string;
}

export interface ReviewSuggestions {
	suggestions: CodeSuggestion[];
	summary: {
		totalIssues: number;
		errors: number;
		warnings: number;
		suggestions: number;
	};
}

const SUGGESTIONS_JSON_REGEX =
	/<!--\s*SUGGESTIONS_JSON\s*\n([\s\S]*?)\n\s*-->/;

function computeSummary(
	suggestions: CodeSuggestion[]
): ReviewSuggestions["summary"] {
	return {
		totalIssues: suggestions.length,
		errors: suggestions.filter((s) => s.severity === "error").length,
		warnings: suggestions.filter((s) => s.severity === "warning").length,
		suggestions: suggestions.filter((s) => s.severity === "suggestion").length,
	};
}

function generateId(): string {
	return Math.random().toString(36).substring(2, 10);
}

/**
 * Attempt to extract structured suggestion blocks from review markdown
 * when no JSON block is present.
 *
 * Looks for patterns like:
 *   ### Suggestion: Title
 *   **File:** path/to/file.ts
 *   **Lines:** 10-20
 *   **Severity:** warning
 *   **Category:** performance
 *   Description text...
 *   ```diff
 *   - old
 *   + new
 *   ```
 */
function parseStructuredBlocks(
	reviewText: string
): CodeSuggestion[] {
	const suggestions: CodeSuggestion[] = [];

	const sectionRegex =
		/###\s+Suggestion:\s*(.+?)(?:\n|$)([\s\S]*?)(?=###\s+Suggestion:|##\s|\z)/gi;

	let match;
	while ((match = sectionRegex.exec(reviewText)) !== null) {
		const title = match[1].trim();
		const body = match[2];

		const fileMatch = body.match(/\*\*File:\*\*\s*(.+?)(?:\n|$)/i);
		const linesMatch = body.match(/\*\*Lines?:\*\*\s*(\d+)\s*[-–]\s*(\d+)/i);
		const severityMatch = body.match(
			/\*\*Severity:\*\*\s*(error|warning|info|suggestion)/i
		);
		const categoryMatch = body.match(/\*\*Category:\*\*\s*(.+?)(?:\n|$)/i);
		const descMatch = body.match(/(?:Description|Details)?:?\s*([\s\S]*?)(?=```|$)/i);

		const diffMatch = body.match(
			/```(?:diff)?\n([\s\S]*?)```/
		);

		let originalCode = "";
		let suggestedCode = "";

		if (diffMatch) {
			const lines = diffMatch[1].split("\n");
			for (const line of lines) {
				if (line.startsWith("-")) {
					originalCode += line.slice(1) + "\n";
				} else if (line.startsWith("+")) {
					suggestedCode += line.slice(1) + "\n";
				}
			}
		}

		suggestions.push({
			id: generateId(),
			filePath: fileMatch?.[1]?.trim() ?? "unknown",
			startLine: linesMatch?.[1] ? parseInt(linesMatch[1]) : 1,
			endLine: linesMatch?.[2] ? parseInt(linesMatch[2]) : 1,
			severity:
				(severityMatch?.[1]?.toLowerCase() as CodeSuggestion["severity"]) ??
				"suggestion",
			title,
			description: descMatch?.[1]?.trim() ?? "",
			originalCode: originalCode.trim(),
			suggestedCode: suggestedCode.trim(),
			category: categoryMatch?.[1]?.trim() ?? "general",
		});
	}

	return suggestions;
}

/**
 * Parse suggestions from a review text.
 *
 * Strategy:
 * 1. Look for a <!-- SUGGESTIONS_JSON { ... } --> block
 * 2. Fall back to parsing structured markdown suggestion blocks
 * 3. Return empty suggestions if nothing found
 */
export function parseSuggestionsFromReview(
	reviewText: string
): ReviewSuggestions {
	const jsonMatch = reviewText.match(SUGGESTIONS_JSON_REGEX);

	if (jsonMatch?.[1]) {
		try {
			const parsed = JSON.parse(jsonMatch[1]);
			const suggestions: CodeSuggestion[] = Array.isArray(parsed.suggestions)
				? parsed.suggestions
				: [];

			return {
				suggestions,
				summary: parsed.summary ?? computeSummary(suggestions),
			};
		} catch {
			// JSON parse failed, fall through to structured block parsing
		}
	}

	const structuredSuggestions = parseStructuredBlocks(reviewText);

	if (structuredSuggestions.length > 0) {
		return {
			suggestions: structuredSuggestions,
			summary: computeSummary(structuredSuggestions),
		};
	}

	return {
		suggestions: [],
		summary: { totalIssues: 0, errors: 0, warnings: 0, suggestions: 0 },
	};
}
