import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}));

const mockOctokit = {
	auth: vi.fn().mockResolvedValue({ type: "token", token: "github-token" }),
	rest: {
		repos: {},
		pulls: {},
		issues: {},
		checks: {},
		search: {},
	},
	graphql: vi.fn(),
};

vi.mock("octokit", () => ({
	Octokit: vi.fn().mockImplementation(() => mockOctokit),
}));

const mockGetOctokit = vi.fn().mockImplementation(() => Promise.resolve(mockOctokit));
vi.mock("@/modules/github/lib/auth", () => ({
	getOctokit: () => mockGetOctokit(),
	getGithubAccessToken: vi.fn().mockImplementation(() => Promise.resolve("github-token")),
}));

const mockRepositoryFindFirst = vi.fn();
const mockAccountFindFirst = vi.fn();
vi.mock("@/lib/db", () => ({
	default: {
		repository: { findFirst: (...args: unknown[]) => mockRepositoryFindFirst(...args) },
		account: { findFirst: (...args: unknown[]) => mockAccountFindFirst(...args) },
	},
}));

import {
	resolveProviderForRepository,
	normalizeProviderType,
	isReviewCapableProvider,
} from "@/modules/vcs/resolve";
import { GitHubProvider } from "@/modules/vcs/github-provider";
import { GitLabProvider } from "@/modules/vcs/gitlab-provider";
import { BitbucketProvider } from "@/modules/vcs/bitbucket-provider";
import { createCheckRun, updateStatusPending } from "@/inngest/functions/review/steps/create-check-run";
import { createLoadingComment } from "@/inngest/functions/review/steps/create-loading-comment";
import { postComment } from "@/inngest/functions/review/steps/post-comment";
import { verifySuggestions } from "@/inngest/functions/review/steps/verify-suggestions";
import type { ReviewContext, ParsedSuggestions } from "@/inngest/functions/review/context";

const baseRepo = {
	id: "repo-1",
	userId: "user-1",
	owner: "owner",
	name: "repo",
	provider: "github",
};

const makeCtx = (provider: any, overrides: Partial<ReviewContext> = {}): ReviewContext =>
	({
		provider,
		providerType: provider.name,
		owner: "owner",
		repo: "repo",
		prNumber: 5,
		userId: "user-1",
		token: "token-123",
		diff: "diff-content",
		title: "Fix bug",
		description: "desc",
		headSha: "sha-123",
		checkRunId: null,
		loadingCommentId: null,
		...overrides,
	}) as ReviewContext;

describe("resolveProviderForRepository", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("resolves a GitHub provider from the repository provider field", async () => {
		mockRepositoryFindFirst.mockResolvedValue({ ...baseRepo, provider: "github" });
		mockAccountFindFirst.mockResolvedValue({ accessToken: "gh-token" });

		const resolved = await resolveProviderForRepository("owner", "repo");

		expect(resolved.providerType).toBe("github");
		expect(resolved.provider).toBeInstanceOf(GitHubProvider);
		expect(resolved.token).toBe("gh-token");
		// The repository provider field drove the resolution — no header sniffing.
		expect(mockAccountFindFirst).toHaveBeenCalledWith({
			where: { userId: "user-1", providerId: "github" },
		});
	});

	it("resolves a GitLab provider (base-only) from the repository provider field", async () => {
		mockRepositoryFindFirst.mockResolvedValue({ ...baseRepo, provider: "gitlab" });
		mockAccountFindFirst.mockResolvedValue({ accessToken: "gl-token" });

		const resolved = await resolveProviderForRepository("owner", "repo");

		expect(resolved.providerType).toBe("gitlab");
		expect(resolved.provider).toBeInstanceOf(GitLabProvider);
		expect(isReviewCapableProvider(resolved.provider)).toBe(false);
	});

	it("resolves a Bitbucket provider (base-only) from the repository provider field", async () => {
		mockRepositoryFindFirst.mockResolvedValue({ ...baseRepo, provider: "bitbucket" });
		mockAccountFindFirst.mockResolvedValue({ accessToken: "bb-token" });

		const resolved = await resolveProviderForRepository("owner", "repo");

		expect(resolved.providerType).toBe("bitbucket");
		expect(resolved.provider).toBeInstanceOf(BitbucketProvider);
		expect(isReviewCapableProvider(resolved.provider)).toBe(false);
	});

	it("defaults legacy repositories (null provider) to github", async () => {
		mockRepositoryFindFirst.mockResolvedValue({ ...baseRepo, provider: null });
		mockAccountFindFirst.mockResolvedValue({ accessToken: "gh-token" });

		const resolved = await resolveProviderForRepository("owner", "repo");
		expect(resolved.providerType).toBe("github");
		expect(resolved.provider).toBeInstanceOf(GitHubProvider);
	});

	it("throws when the repository does not exist", async () => {
		mockRepositoryFindFirst.mockResolvedValue(null);

		await expect(resolveProviderForRepository("owner", "missing")).rejects.toThrow(
			"Repository owner/missing not found in database"
		);
	});

	it("throws when the owner has no stored credentials for the provider", async () => {
		mockRepositoryFindFirst.mockResolvedValue({ ...baseRepo, provider: "gitlab" });
		mockAccountFindFirst.mockResolvedValue(null);

		await expect(resolveProviderForRepository("owner", "repo")).rejects.toThrow(
			"No gitlab access token found"
		);
	});
});

describe("normalizeProviderType", () => {
	it("maps known providers and defaults unknown/null to github", () => {
		expect(normalizeProviderType("github")).toBe("github");
		expect(normalizeProviderType("gitlab")).toBe("gitlab");
		expect(normalizeProviderType("bitbucket")).toBe("bitbucket");
		expect(normalizeProviderType(null)).toBe("github");
		expect(normalizeProviderType(undefined)).toBe("github");
		expect(normalizeProviderType("mercurial" as any)).toBe("github");
	});
});	describe("capability degradation (GitLab/Bitbucket)", () => {
	const gitlab = new GitLabProvider("gl-token");
	const ctx = makeCtx(gitlab);

	it("createCheckRun returns null for a non-capable provider (no check run)", async () => {
		const checkRunId = await createCheckRun(ctx);
		expect(checkRunId).toBeNull();
	});

	it("updateStatusPending is a no-op for a non-capable provider", async () => {
		await expect(updateStatusPending(ctx)).resolves.toBeUndefined();
	});

	it("createLoadingComment posts a plain loading comment and returns null", async () => {
		// GitLabProvider.postReviewComment hits the network; mock it to observe
		// the degradation path without making a real request.
		const postSpy = vi.spyOn(gitlab, "postReviewComment").mockResolvedValue(undefined);

		const loadingCommentId = await createLoadingComment(ctx);

		expect(loadingCommentId).toBeNull();
		expect(postSpy).toHaveBeenCalledWith(
			"owner",
			"repo",
			5,
			expect.stringContaining("Review in progress")
		);
	});

	it("postComment posts a plain overview comment and never inline comments", async () => {
		const postSpy = vi.spyOn(gitlab, "postReviewComment").mockResolvedValue(undefined);

		const suggestions: ParsedSuggestions = {
			suggestions: [
				{
					id: "s1",
					filePath: "src/index.ts",
					startLine: 10,
					endLine: 10,
					title: "Use const",
					description: "Prefer const over let",
				},
			],
		};

		await postComment(makeCtx(gitlab, { diff: "diff --git a/src/index.ts b/src/index.ts\n@@ -10,1 +10,1 @@\n-let x = 1;\n+const x = 1;" }), "Review text", suggestions);

		// GitLabProvider has no postInlineReviewComments (base-only), so the
		// degradation is structural: only the overview comment is posted.
		expect(postSpy).toHaveBeenCalledWith("owner", "repo", 5, "Review text");
		expect((gitlab as any).postInlineReviewComments).toBeUndefined();
	});

	it("verifySuggestions skips the sandbox for a non-capable provider", async () => {
		const result = await verifySuggestions(
			ctx,
			{ suggestions: [{ id: "s1", filePath: "a.ts", startLine: 1 }] }
		);

		// Suggestions pass through untouched (no sandbox verification attempted).
		expect(result?.suggestions).toHaveLength(1);
		expect(result?.suggestions[0].verified).toBeUndefined();
	});
});
