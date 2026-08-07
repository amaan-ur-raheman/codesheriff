import { describe, it, expect, vi } from "vitest";

// postComment transitively imports the GitHub helper barrel -> github/lib/auth
// -> the better-auth config, which throws at load time without GitHub OAuth env
// vars (CI doesn't set them). Mock the auth config out of the graph.
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import {
	resolveVerifyStatus,
	verifyStatusMarkdown,
	VERIFY_STATUS_META,
} from "@/modules/review/lib/verify-status";
import { postComment } from "@/inngest/functions/review/steps/post-comment";

const DIFF =
	"diff --git a/src/index.ts b/src/index.ts\nindex 0000000..1111111 100644\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -10,1 +10,1 @@\n-let x = 1;\n+const x = 1;";

function capableProvider() {
	const provider: any = {
		createPRCheckRun: vi.fn(), // isReviewCapableProvider guard
		postReviewComment: vi.fn().mockResolvedValue(undefined),
		updateReviewComment: vi.fn().mockResolvedValue(undefined),
		postInlineReviewComments: vi.fn().mockResolvedValue(undefined),
	};
	return provider;
}

function makeCtx(provider: any) {
	return {
		provider,
		owner: "owner",
		repo: "repo",
		prNumber: 5,
		prTitle: "PR",
		prUrl: "http://example.com/pr",
		diff: DIFF,
		before: "sha-before",
		after: "sha-after",
		token: "token",
		providerType: "github",
	} as never;
}

function suggestion(extra: Record<string, unknown> = {}) {
	return {
		id: "s1",
		filePath: "src/index.ts",
		startLine: 10,
		endLine: 10,
		severity: "warning",
		title: "Use const",
		description: "Prefer const over let",
		originalCode: "let x = 1;",
		suggestedCode: "const x = 1;",
		category: "style",
		...extra,
	};
}

describe("resolveVerifyStatus", () => {
	it("prefers the structured verifyStatus field", () => {
		expect(resolveVerifyStatus({ verifyStatus: "verified" })).toBe("verified");
		expect(resolveVerifyStatus({ verifyStatus: "failed" })).toBe("failed");
		expect(resolveVerifyStatus({ verifyStatus: "sandbox_error" })).toBe("sandbox_error");
	});

	it("falls back to the legacy boolean for older reviews", () => {
		expect(resolveVerifyStatus({ verified: true })).toBe("verified");
		expect(resolveVerifyStatus({ verified: false })).toBe("failed");
	});

	it("is neutral when never checked or unlabeled after a sandbox outage", () => {
		expect(resolveVerifyStatus({})).toBe("neutral");
		expect(resolveVerifyStatus({ verifyStatus: undefined, verified: undefined })).toBe("neutral");
	});
});

describe("verifyStatusMarkdown", () => {
	it("renders a status line for each non-neutral outcome", () => {
		expect(verifyStatusMarkdown({ verifyStatus: "verified" })).toContain(
			"✅ **Sandbox verified**"
		);
		expect(verifyStatusMarkdown({ verifyStatus: "failed" })).toContain("❌ **Test failed**");
		expect(verifyStatusMarkdown({ verifyStatus: "sandbox_error" })).toContain(
			"⚠️ **Sandbox error**"
		);
	});

	it("renders an empty string for neutral suggestions (unlabeled)", () => {
		expect(verifyStatusMarkdown({})).toBe("");
	});

	it("appends verifyError details when present", () => {
		const md = verifyStatusMarkdown({
			verifyStatus: "failed",
			verifyError: "Assertion failed at line 3",
		});
		expect(md).toContain("Assertion failed at line 3");
	});
});

describe("postComment PR rendering", () => {
	it("includes the verify status line in inline comment bodies", async () => {
		const provider = capableProvider();
		await postComment(
			makeCtx(provider),
			"Review text",
			{
				suggestions: [suggestion({ verifyStatus: "verified" })],
			} as never
		);

		expect(provider.postInlineReviewComments).toHaveBeenCalledTimes(1);
		const [owner, repo, pr, comments] = provider.postInlineReviewComments.mock.calls[0];
		expect(owner).toBe("owner");
		expect(repo).toBe("repo");
		expect(pr).toBe(5);
		expect(comments[0].body).toContain("✅ **Sandbox verified**");
	});

	it("shows sandbox_error and failed statuses distinctly", async () => {
		const provider = capableProvider();
		await postComment(
			makeCtx(provider),
			"Review text",
			{
				suggestions: [
					suggestion({ id: "s1", verifyStatus: "failed", verifyError: "test output" }),
					suggestion({
						id: "s2",
						verifyStatus: "sandbox_error",
						verifyError: "timed out",
					}),
				],
			} as never
		);

		const comments = provider.postInlineReviewComments.mock.calls[0][3];
		expect(comments[0].body).toContain("❌ **Test failed**");
		expect(comments[0].body).toContain("test output");
		expect(comments[1].body).toContain("⚠️ **Sandbox error**");
		expect(comments[1].body).toContain("timed out");
	});

	it("renders neutral suggestions without any status line", async () => {
		const provider = capableProvider();
		await postComment(
			makeCtx(provider),
			"Review text",
			{
				suggestions: [suggestion({})],
			} as never
		);

		const comments = provider.postInlineReviewComments.mock.calls[0][3];
		expect(comments[0].body).not.toContain("**Sandbox verified**");
		expect(comments[0].body).not.toContain("**Test failed**");
		expect(comments[0].body).not.toContain("**Sandbox error**");
		expect(comments[0].body).toContain("Use const");
	});

	it("keeps the overview comment body unchanged", async () => {
		const provider = capableProvider();
		await postComment(makeCtx(provider), "Review text", {
			suggestions: [suggestion({ verifyStatus: "verified" })],
		} as never);

		expect(provider.postReviewComment).toHaveBeenCalledWith("owner", "repo", 5, "Review text");
	});
});

describe("VERIFY_STATUS_META completeness", () => {
	it("covers every status plus neutral", () => {
		expect(Object.keys(VERIFY_STATUS_META).sort()).toEqual(
			["verified", "failed", "sandbox_error", "neutral"].sort()
		);
	});
});
