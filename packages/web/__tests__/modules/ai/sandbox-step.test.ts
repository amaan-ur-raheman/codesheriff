import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CodeSuggestion } from "@/modules/ai/lib/suggestions";

// Isolated mock graph for the verify-suggestions step: the sandbox module is
// mocked so we control verification outcomes; the capability guard returns
// true so the step runs the verification branch.
const { mockStepVerify, mockStepUnavailableError } = vi.hoisted(() => {
	class MockStepUnavailableError extends Error {
		name = "SandboxUnavailableError";
	}
	return {
		mockStepVerify: vi.fn(),
		mockStepUnavailableError: MockStepUnavailableError,
	};
});

vi.mock("@/modules/ai/lib/sandbox", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/modules/ai/lib/sandbox")>();
	return {
		...actual,
		verifySuggestionsInSandbox: mockStepVerify,
		SandboxUnavailableError: mockStepUnavailableError,
	};
});

vi.mock("@/modules/vcs/resolve", () => ({
	isReviewCapableProvider: vi.fn().mockReturnValue(true),
}));

import { verifySuggestions } from "@/inngest/functions/review/steps/verify-suggestions";

const parsed = {
	suggestions: [
		{
			id: "s1",
			filePath: "src/a.ts",
			startLine: 1,
			endLine: 1,
			severity: "warning",
			title: "Fix",
			description: "desc",
			originalCode: "const a = 1;",
			suggestedCode: "const a = 2;",
			category: "general",
		} as CodeSuggestion,
	],
	summary: { totalIssues: 1, errors: 0, warnings: 1, suggestions: 0 },
};

const ctx = {
	provider: {},
	providerType: "github",
	token: "token",
	owner: "owner",
	repo: "repo",
	prNumber: 1,
} as never;

describe("verifySuggestions step", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("writes verifyStatus/verifyError/verifyDurationMs into each suggestion", async () => {
		mockStepVerify.mockResolvedValue([
			{
				id: "s1",
				success: true,
				verifyStatus: "verified",
				verifyDurationMs: 42,
			},
		]);

		const out = await verifySuggestions(ctx, parsed as never);

		expect(out?.suggestions[0]).toMatchObject({
			id: "s1",
			verified: true,
			verifyStatus: "verified",
			verifyDurationMs: 42,
			verificationLog: undefined,
			verifyError: undefined,
		});
	});

	it("returns suggestions untouched (unlabeled) when the sandbox is unavailable", async () => {
		mockStepVerify.mockRejectedValue(
			new mockStepUnavailableError("E2B_API_KEY is not set")
		);

		const out = await verifySuggestions(ctx, parsed as never);

		expect(out).toBe(parsed);
		expect(out?.suggestions[0].verifyStatus).toBeUndefined();
		expect(out?.suggestions[0].verified).toBeUndefined();
	});
});
