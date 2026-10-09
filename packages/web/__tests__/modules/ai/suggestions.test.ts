import { describe, it, expect } from "vitest";
import {
	escapeRawControlChars,
	parseSuggestionBlock,
	parseSuggestionsFromReview,
} from "@/modules/ai/lib/suggestions";
import { parseSuggestions } from "@/inngest/functions/review/steps/parse-suggestions";

/**
 * Regression cover for a defect found during a live pipeline run: a single
 * literal tab byte inside a `suggestedCode` value made the whole
 * SUGGESTIONS_JSON block fail `JSON.parse`, and the bare `catch {}` in the
 * parse step discarded every finding. The review body still listed two issues
 * while the check run reported "Found 0 findings".
 *
 * The payload below is the real model output from that run, unescaped tab and
 * all.
 */
const RAW_TAB_REVIEW = [
	"## AI Code Review",
	"",
	"Found an N+1 query problem in `getOrdersWithTotals`.",
	"",
	"<!-- SUGGESTIONS_JSON",
	"{",
	'  "suggestions": [',
	"    {",
	'      "id": "n-plus-one",',
	'      "filePath": "src/orders.ts",',
	'      "startLine": 53,',
	'      "endLine": 67,',
	'      "severity": "warning",',
	'      "title": "N+1 Query Problem in getOrdersWithTotals",',
	'      "description": "One query per id instead of a single batched query.",',
	// originalCode escapes its newlines correctly; suggestedCode opens with a
	// raw tab byte, which is what broke the strict parse.
	'      "originalCode": "\\tconst totals = [];\\n\\tfor (const id of ids) {}",',
	'      "suggestedCode": "\tif (ids.length === 0) return [];\\n\\tconst all = await query(ids);",',
	'      "category": "performance"',
	"    }",
	"  ],",
	'  "summary": { "totalIssues": 1, "errors": 0, "warnings": 1, "suggestions": 0 }',
	"}",
	"-->",
].join("\n");

const WELL_FORMED_REVIEW = `Review text.

<!-- SUGGESTIONS_JSON
{
  "suggestions": [
    {
      "id": "ok",
      "filePath": "src/a.ts",
      "startLine": 10,
      "endLine": 12,
      "severity": "error",
      "title": "Real finding",
      "description": "desc",
      "originalCode": "const a = 1;",
      "suggestedCode": "const a = 2;",
      "category": "correctness"
    }
  ],
  "summary": { "totalIssues": 1, "errors": 1, "warnings": 0, "suggestions": 0 }
}
-->`;

const wrap = (block: string) => `prose\n\n<!-- SUGGESTIONS_JSON\n${block}\n-->\n`;

describe("escapeRawControlChars", () => {
	it("escapes a raw tab inside a string literal", () => {
		expect(escapeRawControlChars('"a\tb"')).toBe('"a\\tb"');
	});

	it("escapes a raw newline and carriage return inside a string literal", () => {
		expect(escapeRawControlChars('"a\nb"')).toBe('"a\\nb"');
		expect(escapeRawControlChars('"a\rb"')).toBe('"a\\rb"');
	});

	it("escapes other control bytes as \\uXXXX", () => {
		expect(escapeRawControlChars('"a\u0007b"')).toBe('"a\\u0007b"');
	});

	it("leaves already-escaped sequences untouched", () => {
		const alreadyEscaped = '"a\\tb\\nc"';
		expect(escapeRawControlChars(alreadyEscaped)).toBe(alreadyEscaped);
	});

	it("does not escape a trailing backslash's escapee", () => {
		expect(escapeRawControlChars('"a\\\\"')).toBe('"a\\\\"');
	});

	it("leaves structural whitespace outside strings alone", () => {
		const pretty = '{\n  "a": 1,\n  "b": [\n    2\n  ]\n}';
		expect(escapeRawControlChars(pretty)).toBe(pretty);
	});

	it("round-trips a block that JSON.parse rejects", () => {
		const broken = '{"code": "\tconst a = 1;"}';
		expect(() => JSON.parse(broken)).toThrow();
		expect(JSON.parse(escapeRawControlChars(broken))).toEqual({
			code: "\tconst a = 1;",
		});
	});
});

describe("parseSuggestionBlock", () => {
	it("returns null when no block is present", () => {
		expect(parseSuggestionBlock("just prose")).toBeNull();
	});

	it("parses a well-formed block unchanged", () => {
		const parsed = parseSuggestionBlock(WELL_FORMED_REVIEW);
		expect(parsed?.suggestions).toHaveLength(1);
		expect(parsed?.suggestions[0].id).toBe("ok");
		expect(parsed?.summary).toEqual({
			totalIssues: 1,
			errors: 1,
			warnings: 0,
			suggestions: 0,
		});
	});

	it("recovers a block that only a raw tab invalidates", () => {
		const parsed = parseSuggestionBlock(RAW_TAB_REVIEW);

		expect(parsed).not.toBeNull();
		expect(parsed?.suggestions).toHaveLength(1);
		expect(parsed?.suggestions[0]).toMatchObject({
			id: "n-plus-one",
			filePath: "src/orders.ts",
			severity: "warning",
		});
	});

	it("preserves the leading tab in the recovered code", () => {
		const parsed = parseSuggestionBlock(RAW_TAB_REVIEW);
		expect(parsed?.suggestions[0].suggestedCode).toBe(
			"\tif (ids.length === 0) return [];\n\tconst all = await query(ids);"
		);
	});

	it("computes a summary when the block omits one", () => {
		const block = wrap(
			JSON.stringify({
				suggestions: [
					{
						id: "a",
						filePath: "a.ts",
						startLine: 1,
						endLine: 1,
						severity: "error",
						title: "t",
						description: "d",
						originalCode: "",
						suggestedCode: "",
						category: "c",
					},
					{
						id: "b",
						filePath: "b.ts",
						startLine: 1,
						endLine: 1,
						severity: "info",
						title: "t",
						description: "d",
						originalCode: "",
						suggestedCode: "",
						category: "c",
					},
				],
			})
		);

		expect(parseSuggestionBlock(block)?.summary).toEqual({
			totalIssues: 2,
			errors: 1,
			warnings: 0,
			suggestions: 0,
		});
	});

	it("returns null when the payload is unsalvageable, not merely strict", () => {
		expect(parseSuggestionBlock(wrap("{ this is not json at all"))).toBeNull();
	});
});

describe("parseSuggestionsFromReview", () => {
	it("still falls back to structured markdown blocks", () => {
		const review = [
			"### Suggestion: Tighten the guard",
			"**File:** src/a.ts",
			"**Lines:** 10-12",
			"**Severity:** warning",
			"**Category:** correctness",
			"Some description.",
			"```diff",
			"- const a = 1;",
			"+ const a = 2;",
			"```",
		].join("\n");

		const parsed = parseSuggestionsFromReview(review);
		expect(parsed.suggestions).toHaveLength(1);
		expect(parsed.suggestions[0]).toMatchObject({
			filePath: "src/a.ts",
			startLine: 10,
			endLine: 12,
			severity: "warning",
		});
	});

	it("returns an empty result when there is nothing to parse", () => {
		expect(parseSuggestionsFromReview("nothing here")).toEqual({
			suggestions: [],
			summary: { totalIssues: 0, errors: 0, warnings: 0, suggestions: 0 },
		});
	});
});

describe("parseSuggestions step", () => {
	it("recovers findings from a block broken by a raw control byte", async () => {
		const parsed = await parseSuggestions(RAW_TAB_REVIEW);

		// This is the assertion that failed before the fix: the step returned
		// null, so the review reported zero findings while listing two issues.
		expect(parsed).not.toBeNull();
		expect(parsed?.suggestions).toHaveLength(1);
		expect(parsed?.summary?.totalIssues).toBe(1);
	});

	it("parses a well-formed block", async () => {
		const parsed = await parseSuggestions(WELL_FORMED_REVIEW);
		expect(parsed?.suggestions).toHaveLength(1);
	});

	it("still returns null when the model found nothing", async () => {
		expect(await parseSuggestions("No issues found.")).toBeNull();
	});

	it("keeps a block that parses to an empty array distinguishable", async () => {
		const parsed = await parseSuggestions(
			wrap('{"suggestions": [], "summary": {"totalIssues": 0, "errors": 0, "warnings": 0, "suggestions": 0}}')
		);
		expect(parsed).toEqual({
			suggestions: [],
			summary: { totalIssues: 0, errors: 0, warnings: 0, suggestions: 0 },
		});
	});
});
