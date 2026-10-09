import { describe, it, expect, vi } from "vitest";

// `diffs.ts` imports `getOctokit` from the GitHub helper barrel, which reaches
// the better-auth config and throws at load time without GitHub OAuth env vars.
// The diff parsing under test is pure and never touches auth.
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { getDiffFileLines } from "@/modules/github/lib/diffs";
import {
	findOriginalCodeRange,
	resolveSuggestionAnchor,
} from "@/modules/review/lib/suggestion-anchor";

const DIFF = `diff --git a/src/orders.ts b/src/orders.ts
index 1111111..2222222 100644
--- a/src/orders.ts
+++ b/src/orders.ts
@@ -25,6 +25,10 @@ export async function findOrdersByCustomer(
 ): Promise<Row[]> {
-\treturn driver.query(SELECT_ORDERS_BY_CUSTOMER, [customerId]);
+\t// Interpolated rather than bound for the hot path.
+\treturn driver.query(
+\t\t\`SELECT id FROM orders WHERE customer_id = '\${customerId}'\`,
+\t);
 }
`;

describe("getDiffFileLines", () => {
	it("records new-side line numbers with their text", () => {
		const lines = getDiffFileLines(DIFF);
		const file = lines["src/orders.ts"];

		expect(file).toBeDefined();
		expect(file.get(25)).toBe("): Promise<Row[]> {");
		expect(file.get(26)).toBe("\t// Interpolated rather than bound for the hot path.");
	});

	it("does not consume a new-side number for a removed line", () => {
		const file = getDiffFileLines(DIFF)["src/orders.ts"];
		const numbers = [...file.keys()];

		// Contiguous: the removed line must not leave a hole.
		expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
		for (let i = 1; i < numbers.length; i++) {
			expect(numbers[i]).toBe(numbers[i - 1] + 1);
		}
	});

	it("returns nothing for an empty diff", () => {
		expect(getDiffFileLines("")).toEqual({});
	});
});

describe("findOriginalCodeRange", () => {
	const lines = new Map<number, string>([
		[10, "export function f() {"],
		[11, "\tconst a = 1;"],
		[12, "\treturn a;"],
		[13, "}"],
	]);
	const valid = new Set([10, 11, 12, 13]);

	it("locates the snippet where the code actually is", () => {
		const found = findOriginalCodeRange(lines, valid, "\tconst a = 1;\n\treturn a;");

		expect(found).toEqual({ startLine: 11, endLine: 12 });
	});

	it("tolerates whitespace differences", () => {
		const found = findOriginalCodeRange(lines, valid, "const a = 1;\nreturn a;");

		expect(found).toEqual({ startLine: 11, endLine: 12 });
	});

	it("prefers the match nearest the declared start line", () => {
		const repeated = new Map<number, string>([
			[5, "const a = 1;"],
			[6, "return a;"],
			[20, "const a = 1;"],
			[21, "return a;"],
		]);
		const all = new Set(repeated.keys());

		expect(findOriginalCodeRange(repeated, all, "const a = 1;\nreturn a;", 19))
			.toEqual({ startLine: 20, endLine: 21 });
		expect(findOriginalCodeRange(repeated, all, "const a = 1;\nreturn a;", 4))
			.toEqual({ startLine: 5, endLine: 6 });
	});

	it("returns null when the snippet is not in the diff", () => {
		expect(findOriginalCodeRange(lines, valid, "const nowhere = true;")).toBeNull();
	});

	it("returns null for an empty snippet", () => {
		expect(findOriginalCodeRange(lines, valid, "   ")).toBeNull();
	});
});

describe("resolveSuggestionAnchor", () => {
	const lines = new Map<number, string>([
		[29, "\t// a comment"],
		[30, "\treturn driver.query("],
		[31, "\t\t`SELECT 1`,"],
		[32, "\t);"],
	]);
	const valid = new Set([29, 30, 31, 32]);

	it("corrects a range the model got wrong", () => {
		// Model declared 30-32 (3 lines) for a snippet that actually starts at 29.
		const anchor = resolveSuggestionAnchor({
			lines,
			validLines: valid,
			originalCode: "\t// a comment\n\treturn driver.query(\n\t\t`SELECT 1`,\n\t);",
			declaredStartLine: 30,
			declaredEndLine: 32,
		});

		expect(anchor).toEqual({
			startLine: 29,
			endLine: 32,
			anchoredByContent: true,
		});
	});

	it("falls back to the declared range when the snippet cannot be found", () => {
		const anchor = resolveSuggestionAnchor({
			lines,
			validLines: valid,
			originalCode: "const missing = true;",
			declaredStartLine: 30,
			declaredEndLine: 32,
		});

		expect(anchor).toEqual({
			startLine: 30,
			endLine: 32,
			anchoredByContent: false,
		});
	});

	it("falls back when no line map is available", () => {
		expect(
			resolveSuggestionAnchor({
				originalCode: "anything",
				declaredStartLine: 10,
				declaredEndLine: 12,
			})
		).toEqual({ startLine: 10, endLine: 12, anchoredByContent: false });
	});

	it("refuses to move an anchor far from what the model declared", () => {
		const anchor = resolveSuggestionAnchor({
			lines,
			validLines: valid,
			originalCode: "\t// a comment\n\treturn driver.query(\n\t\t`SELECT 1`,\n\t);",
			declaredStartLine: 200,
			declaredEndLine: 203,
		});

		expect(anchor.anchoredByContent).toBe(false);
		expect(anchor.startLine).toBe(200);
	});

	it("normalises a missing endLine", () => {
		expect(
			resolveSuggestionAnchor({
				declaredStartLine: 10,
				declaredEndLine: undefined,
			})
		).toEqual({ startLine: 10, endLine: 10, anchoredByContent: false });
	});

	it("repairs an endLine that precedes the start", () => {
		expect(
			resolveSuggestionAnchor({
				declaredStartLine: 10,
				declaredEndLine: 4,
			})
		).toEqual({ startLine: 10, endLine: 10, anchoredByContent: false });
	});
});