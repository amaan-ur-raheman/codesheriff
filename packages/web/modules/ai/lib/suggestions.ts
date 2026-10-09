/**
 * Types and parser for inline code suggestions from AI reviews.
 *
 * Suggestions are embedded as a JSON block in the review markdown
 * inside an HTML comment: <!-- SUGGESTIONS_JSON { ... } -->
 */	export type VerifyStatus = "verified" | "failed" | "sandbox_error";

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
		/** @deprecated use verifyStatus — kept for existing UI rendering */
		verified?: boolean;
		/** @deprecated use verifyError — kept for existing UI rendering */
		verificationLog?: string;
		/** Outcome of sandbox verification: verified | failed | sandbox_error. */
		verifyStatus?: VerifyStatus;
		/** Human-readable error/log when not verified. */
		verifyError?: string;
		/** Milliseconds the sandbox spent verifying this suggestion. */
		verifyDurationMs?: number;
		applied?: boolean;
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

/**
 * Read the structured suggestions block stored on a review record
 * (Review.suggestions is a Prisma Json column). Validates the shape and
 * falls back to a computed summary when the stored summary is missing, so
 * callers never touch `JsonValue` directly or cast through `any`.
 */
export function readStoredSuggestions(
	value: unknown
): ReviewSuggestions | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	const candidate = value as {
		suggestions?: unknown;
		summary?: unknown;
	};

	if (!Array.isArray(candidate.suggestions)) {
		return null;
	}

	// Validate each suggestion entry has required fields.
	const validSeverities = new Set(["error", "warning", "info", "suggestion"]);
	const suggestions: CodeSuggestion[] = candidate.suggestions.filter(
		(s: any): s is CodeSuggestion =>
			!!s &&
			typeof s === "object" &&
			typeof s.id === "string" &&
			typeof s.filePath === "string" &&
			typeof s.title === "string" &&
			validSeverities.has(s.severity)
	);

	if (suggestions.length === 0 && candidate.suggestions.length > 0) {
		return null;
	}

	// Stored summary counters are only trustworthy when every entry survived
	// validation — otherwise recompute so badge counts can't exceed the list.
	const hadDroppedEntries =
		suggestions.length !== candidate.suggestions.length;

	// Validate stored summary counters before using them.
	const rawSummary = candidate.summary;
	let summary: ReviewSuggestions["summary"];
	if (
		!hadDroppedEntries &&
		rawSummary &&
		typeof rawSummary === "object" &&
		!Array.isArray(rawSummary) &&
		typeof (rawSummary as any).totalIssues === "number" &&
		typeof (rawSummary as any).errors === "number" &&
		typeof (rawSummary as any).warnings === "number" &&
		typeof (rawSummary as any).suggestions === "number"
	) {
		summary = rawSummary as ReviewSuggestions["summary"];
	} else {
		summary = computeSummary(suggestions);
	}

	return { suggestions, summary };
}

const SUGGESTIONS_JSON_REGEX =
	/<!--\s*SUGGESTIONS_JSON\s*\n([\s\S]*?)\n\s*-->/;

const EMPTY_SUMMARY = {
	totalIssues: 0,
	errors: 0,
	warnings: 0,
	suggestions: 0,
};

const CONTROL_ESCAPES: Record<string, string> = {
	"\t": "\\t",
	"\n": "\\n",
	"\r": "\\r",
};

/**
 * Escapes raw control bytes that appear *inside* JSON string literals.
 *
 * JSON permits only `\" \\ \/ \b \f \n \r \t` and `\uXXXX` escapes within a
 * string; a literal tab or newline byte is a syntax error. Models emit code
 * blocks verbatim often enough that a single unescaped tab in one
 * `suggestedCode` value makes the entire SUGGESTIONS_JSON block unparseable —
 * which used to discard every finding in the review, silently.
 *
 * Only bytes inside a string are touched, so already-escaped `\n` sequences
 * pass through untouched. Structural whitespace (indentation, newlines between
 * properties) is left alone.
 */
export function escapeRawControlChars(source: string): string {
	let out = "";
	let inString = false;
	let escaped = false;

	for (const char of source) {
		if (escaped) {
			out += char;
			escaped = false;
			continue;
		}
		if (char === "\\") {
			out += char;
			escaped = true;
			continue;
		}
		if (char === '"') {
			inString = !inString;
			out += char;
			continue;
		}
		if (inString && char < " ") {
			out += CONTROL_ESCAPES[char] ?? `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
			continue;
		}
		out += char;
	}

	return out;
}

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

export function trimNewlines(str: string): string {
	return str.replace(/^(?:\r?\n)+|(?:\r?\n)+$/g, "");
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

	// `\z` is a Perl end-of-string anchor; JavaScript has no such escape and
	// reads it as a literal "z", which made this pattern require a trailing
	// "z" and never match. `$` (no `m` flag) is the end of input.
	const sectionRegex =
		/###\s+Suggestion:\s*(.+?)(?:\n|$)([\s\S]*?)(?=###\s+Suggestion:|##\s|$)/gi;

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
			originalCode: trimNewlines(originalCode),
			suggestedCode: trimNewlines(suggestedCode),
			category: categoryMatch?.[1]?.trim() ?? "general",
		});
	}

	return suggestions;
}

/**
 * Parses the `<!-- SUGGESTIONS_JSON ... -->` block from a review.
 *
 * Tries a strict parse first, then retries with raw control bytes escaped, so
 * a model that emits a literal tab or newline inside a code block does not cost
 * us the whole review. Returns `null` only when no block is present or the
 * payload is unsalvageable — the caller decides whether to try other shapes.
 */
export function parseSuggestionBlock(
	reviewText: string
): ReviewSuggestions | null {
	const match = reviewText.match(SUGGESTIONS_JSON_REGEX);
	if (!match?.[1]) return null;

	const raw = match[1];

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		try {
			parsed = JSON.parse(escapeRawControlChars(raw));
			console.warn(
				"SUGGESTIONS_JSON contained raw control characters and was repaired before parsing",
				raw.length
			);
		} catch {
			return null;
		}
	}

	if (!parsed || typeof parsed !== "object") return null;

	const candidate = parsed as {
		suggestions?: unknown;
		summary?: ReviewSuggestions["summary"];
	};

	const suggestions = Array.isArray(candidate.suggestions)
		? (candidate.suggestions as CodeSuggestion[])
		: [];

	return {
		suggestions,
		summary: candidate.summary ?? computeSummary(suggestions),
	};
}

/**
 * Parse suggestions from a review text.
 *
 * Strategy:
 * 1. Look for a <!-- SUGGESTIONS_JSON { ... } --> block (repairing raw control
 *    bytes if the strict parse fails)
 * 2. Fall back to parsing structured markdown suggestion blocks
 * 3. Return empty suggestions if nothing found
 */
export function parseSuggestionsFromReview(
	reviewText: string
): ReviewSuggestions {
	const fromBlock = parseSuggestionBlock(reviewText);
	if (fromBlock) return fromBlock;

	const structuredSuggestions = parseStructuredBlocks(reviewText);

	if (structuredSuggestions.length > 0) {
		return {
			suggestions: structuredSuggestions,
			summary: computeSummary(structuredSuggestions),
		};
	}

	return { suggestions: [], summary: { ...EMPTY_SUMMARY } };
}
