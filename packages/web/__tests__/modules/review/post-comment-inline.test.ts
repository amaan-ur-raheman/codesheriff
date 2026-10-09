import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Exercises the real `postComment` step, including inline-comment placement.
 *
 * The pre-existing degradation test re-implemented the map/filter logic
 * inline, so it drifted from the shipped code and could not catch this. These
 * tests call the step itself.
 */

const { mockValidDiffLines, mockPostInline, mockUpdateComment } = vi.hoisted(() => ({
	mockValidDiffLines: vi.fn(),
	mockPostInline: vi.fn(),
	mockUpdateComment: vi.fn(),
}));

vi.mock("@/modules/github/lib/github", () => ({
	getValidDiffLines: mockValidDiffLines,
}));

vi.mock("@/modules/vcs/resolve", () => ({
	isReviewCapableProvider: vi.fn().mockReturnValue(true),
}));

vi.mock("@/modules/review/lib/verify-status", () => ({
	verifyStatusMarkdown: vi.fn().mockReturnValue(""),
}));

import { postComment } from "@/inngest/functions/review/steps/post-comment";

const ctx = {
	provider: {
		updateReviewComment: mockUpdateComment,
		postReviewComment: vi.fn(),
		postInlineReviewComments: mockPostInline,
	},
	owner: "owner",
	repo: "repo",
	prNumber: 7,
	diff: "diff",
	loadingCommentId: 1,
} as never;

function suggestion(overrides: Record<string, unknown> = {}) {
	return {
		id: "s1",
		filePath: "src/orders.ts",
		startLine: 10,
		endLine: 15,
		severity: "error",
		title: "Real finding",
		description: "something is wrong",
		originalCode: "old",
		suggestedCode: "const a = 1;\nconst b = 2;",
		category: "correctness",
		...overrides,
	};
}

const parsed = (suggestions: unknown[]) => ({
	suggestions,
	summary: { totalIssues: suggestions.length, errors: 0, warnings: 0, suggestions: 0 },
});

describe("postComment inline placement", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUpdateComment.mockResolvedValue(undefined);
		mockPostInline.mockResolvedValue(undefined);
	});

	it("posts inline when the whole range is in the diff", async () => {
		mockValidDiffLines.mockReturnValue({ "src/orders.ts": new Set([10, 15]) });

		await postComment(ctx, "review", parsed([suggestion()]) as never);

		expect(mockPostInline).toHaveBeenCalledTimes(1);
		const comments = mockPostInline.mock.calls[0][3];
		expect(comments[0]).toMatchObject({
			path: "src/orders.ts",
			line: 15,
			start_line: 10,
		});
	});

	it("anchors to a line inside the declared range instead of dropping", async () => {
		// endLine 67 is past EOF on a 53-line file; 53 is still in the diff.
		mockValidDiffLines.mockReturnValue({ "src/orders.ts": new Set([53]) });

		await postComment(
			ctx,
			"review",
			parsed([suggestion({ startLine: 53, endLine: 67 })]) as never,
		);

		expect(mockPostInline).toHaveBeenCalledTimes(1);
		const comments = mockPostInline.mock.calls[0][3];
		expect(comments[0].line).toBe(53);
		// A single-line anchor cannot carry a multi-line replacement block.
		expect(comments[0].start_line).toBeUndefined();
		expect(comments[0].body).not.toContain("```suggestion");
		expect(comments[0].body).toContain("Real finding");
	});

	it("prefers the lowest valid line in the declared range", async () => {
		mockValidDiffLines.mockReturnValue({ "src/orders.ts": new Set([54, 60]) });

		await postComment(
			ctx,
			"review",
			parsed([suggestion({ startLine: 53, endLine: 67 })]) as never,
		);

		expect(mockPostInline.mock.calls[0][3][0].line).toBe(54);
	});

	it("does not anchor outside the range the model declared", async () => {
		// 10 is nearby but outside the declared 53-67 range.
		mockValidDiffLines.mockReturnValue({ "src/orders.ts": new Set([10]) });

		await postComment(
			ctx,
			"review",
			parsed([suggestion({ startLine: 53, endLine: 67 })]) as never,
		);

		expect(mockPostInline).not.toHaveBeenCalled();
	});

	it("still degrades a bad start line to single line when the end is valid", async () => {
		mockValidDiffLines.mockReturnValue({ "src/orders.ts": new Set([15]) });

		await postComment(ctx, "review", parsed([suggestion()]) as never);

		const comments = mockPostInline.mock.calls[0][3];
		expect(comments[0].line).toBe(15);
		expect(comments[0].start_line).toBeUndefined();
		expect(comments[0].body).not.toContain("```suggestion");
	});

	it("keeps the suggestion block when the whole range is valid", async () => {
		mockValidDiffLines.mockReturnValue({ "src/orders.ts": new Set([10, 15]) });

		await postComment(ctx, "review", parsed([suggestion()]) as never);

		expect(mockPostInline.mock.calls[0][3][0].body).toContain("```suggestion");
	});

	it("drops a finding whose file is not in the diff", async () => {
		mockValidDiffLines.mockReturnValue({ "src/other.ts": new Set([1]) });

		await postComment(ctx, "review", parsed([suggestion()]) as never);

		expect(mockPostInline).not.toHaveBeenCalled();
	});

	it("posts only the placeable findings when some must be dropped", async () => {
		mockValidDiffLines.mockReturnValue({ "src/orders.ts": new Set([53]) });

		await postComment(
			ctx,
			"review",
			parsed([
				suggestion({ id: "a", startLine: 53, endLine: 67 }),
				suggestion({ id: "b", startLine: 15, endLine: 15 }),
			]) as never,
		);

		expect(mockPostInline).toHaveBeenCalledTimes(1);
		expect(mockPostInline.mock.calls[0][3]).toHaveLength(1);
	});
});
