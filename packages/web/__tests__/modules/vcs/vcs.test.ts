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

vi.mock("@/lib/db", () => ({
	default: {
		account: {
			findFirst: vi.fn(),
		},
	},
}));

const mockOctokit = {
	auth: vi.fn().mockResolvedValue({ type: "token", token: "github-token" }),
	rest: {
		repos: {
			listForAuthenticatedUser: vi.fn(),
			listWebhooks: vi.fn(),
			createWebhook: vi.fn(),
			deleteWebhook: vi.fn(),
			getContent: vi.fn(),
			createCommitStatus: vi.fn().mockResolvedValue({}),
		},
		checks: {
			create: vi.fn().mockResolvedValue({ data: { id: 101 } }),
			update: vi.fn().mockResolvedValue({}),
		},
		pulls: {
			get: vi.fn(),
			getReviewComment: vi.fn(),
			listReviewComments: vi.fn(),
		},
		issues: {
			createComment: vi.fn().mockResolvedValue({ data: { id: 42 } }),
			listComments: vi.fn(),
		},
		search: {
			issuesAndPullRequests: vi.fn(),
		},
	},
	graphql: vi.fn(),
};

vi.mock("octokit", () => ({
	Octokit: vi.fn().mockImplementation(() => mockOctokit),
}));

vi.mock("@/modules/github/lib/auth", () => ({
	getOctokit: vi.fn().mockImplementation(() => Promise.resolve(mockOctokit)),
	getGithubAccessToken: vi.fn().mockImplementation(() => Promise.resolve("github-token")),
}));

import { createVCSProvider } from "@/modules/vcs/factory";
import { GitHubProvider, resolveGitHubCredentials } from "@/modules/vcs/github-provider";
import { GitLabProvider, resolveGitLabCredentials } from "@/modules/vcs/gitlab-provider";
import { BitbucketProvider, resolveBitbucketCredentials } from "@/modules/vcs/bitbucket-provider";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

const mockGetSession = (auth.api.getSession as unknown as ReturnType<typeof vi.fn>);
const mockPrismaAccount = (prisma as unknown as {
	account: { findFirst: ReturnType<typeof vi.fn> };
}).account.findFirst;

describe("VCS Providers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetSession.mockResolvedValue({ user: { id: "user-123" } });
		// vitest loads the repo's real .env, so pin the webhook secret to a
		// known state: absent by default, set explicitly by the one test
		// that exercises the signed-webhook path.
		delete process.env.GITHUB_WEBHOOK_SECRET;
	});

	describe("createVCSProvider factory", () => {
		it("creates a GitHubProvider from an authenticated Octokit client", () => {
			const provider = createVCSProvider("github", { octokit: mockOctokit as never });
			expect(provider).toBeInstanceOf(GitHubProvider);
			expect(provider.name).toBe("github");
		});

		it("creates a GitLabProvider from a token string", () => {
			const provider = createVCSProvider("gitlab", { token: "gl-token" });
			expect(provider).toBeInstanceOf(GitLabProvider);
			expect(provider.name).toBe("gitlab");
		});

		it("creates a BitbucketProvider from a token string", () => {
			const provider = createVCSProvider("bitbucket", { token: "bb-token" });
			expect(provider).toBeInstanceOf(BitbucketProvider);
			expect(provider.name).toBe("bitbucket");
		});

		it("throws for unknown provider", () => {
			expect(() =>
				createVCSProvider("invalid" as never, { token: "x" })
			).toThrow("Unknown VCS provider: invalid");
		});
	});

	describe("capability split", () => {
		it("GitHubProvider is ReviewCapable (implements advanced review methods)", () => {
			const provider = createVCSProvider("github", { octokit: mockOctokit as never });

			// Check runs
			expect(provider.createPRCheckRun).toBeTypeOf("function");
			expect(provider.updatePRCheckRun).toBeTypeOf("function");
			// Commit statuses
			expect(provider.updatePRCommitStatus).toBeTypeOf("function");
			// Inline comments
			expect(provider.postInlineReviewComments).toBeTypeOf("function");
			// Comment lifecycle
			expect(provider.postLoadingReviewComment).toBeTypeOf("function");
			expect(provider.updateReviewComment).toBeTypeOf("function");
			expect(provider.updateReviewCommentFailed).toBeTypeOf("function");
			expect(provider.postCommentReply).toBeTypeOf("function");
			// Thread history
			expect(provider.getReviewCommentThread).toBeTypeOf("function");
			expect(provider.getIssueCommentThread).toBeTypeOf("function");
			// Incremental diff
			expect(provider.getCompareDiff).toBeTypeOf("function");
		});

		it("GitLab and Bitbucket stay base-only (no advanced review methods)", () => {
			const gitlab = createVCSProvider("gitlab", { token: "gl-token" });
			const bitbucket = createVCSProvider("bitbucket", { token: "bb-token" });

			expect((gitlab as any).createPRCheckRun).toBeUndefined();
			expect((gitlab as any).postInlineReviewComments).toBeUndefined();
			expect((gitlab as any).getCompareDiff).toBeUndefined();
			expect((bitbucket as any).createPRCheckRun).toBeUndefined();
			expect((bitbucket as any).getReviewCommentThread).toBeUndefined();
		});
	});

	describe("credential resolvers", () => {
		it("resolveGitHubCredentials returns an authenticated Octokit client", async () => {
			const credentials = await resolveGitHubCredentials();
			expect(credentials.octokit).toBe(mockOctokit);
		});

		it("resolveGitLabCredentials returns the stored GitLab token", async () => {
			mockPrismaAccount.mockResolvedValue({ accessToken: "gl-token-123" });

			const credentials = await resolveGitLabCredentials();
			expect(credentials).toEqual({ token: "gl-token-123" });
			expect(mockPrismaAccount).toHaveBeenCalledWith({
				where: { userId: "user-123", providerId: "gitlab" },
			});
		});

		it("resolveBitbucketCredentials returns the stored Bitbucket token", async () => {
			mockPrismaAccount.mockResolvedValue({ accessToken: "bb-token-123" });

			const credentials = await resolveBitbucketCredentials();
			expect(credentials).toEqual({ token: "bb-token-123" });
			expect(mockPrismaAccount).toHaveBeenCalledWith({
				where: { userId: "user-123", providerId: "bitbucket" },
			});
		});

		it("throws when the provider is not connected", async () => {
			mockPrismaAccount.mockResolvedValue(null);

			await expect(resolveGitLabCredentials()).rejects.toThrow(
				"No gitlab access token found"
			);
		});
	});

	describe("GitHubProvider integration helper methods", () => {
		const provider = new GitHubProvider(mockOctokit as never);

		describe("listRepositories", () => {
			it("maps github repositories to VCSRepository schema", async () => {
				mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValueOnce({
					data: [
						{
							id: 123,
							name: "my-repo",
							full_name: "owner/my-repo",
							description: "A cool repo",
							html_url: "https://github.com/owner/my-repo",
							language: "TypeScript",
							stargazers_count: 5,
							topics: ["cool", "project"],
							default_branch: "main",
						},
					],
				});

				const repos = await provider.listRepositories(1, 10);

				expect(repos).toHaveLength(1);
				expect(repos[0]).toEqual({
					id: 123,
					name: "my-repo",
					fullName: "owner/my-repo",
					description: "A cool repo",
					url: "https://github.com/owner/my-repo",
					language: "TypeScript",
					stars: 5,
					topics: ["cool", "project"],
					defaultBranch: "main",
					provider: "github",
				});
				expect(mockOctokit.rest.repos.listForAuthenticatedUser).toHaveBeenCalledWith({
					sort: "updated",
					direction: "desc",
					visibility: "all",
					per_page: 10,
					page: 1,
				});
			});
		});

		describe("getPullRequestDiff", () => {
			it("fetches PR and its diff representation and maps payload", async () => {
				mockOctokit.rest.pulls.get
					.mockResolvedValueOnce({
						data: {
							number: 5,
							title: "Fix bug",
							body: "Bug description",
							html_url: "https://github.com/pr/5",
							state: "open",
							merged: false,
						},
					})
					.mockResolvedValueOnce({
						data: "diff-content-here",
					});

				const pr = await provider.getPullRequestDiff("owner", "repo", 5);

				expect(pr).toEqual({
					number: 5,
					title: "Fix bug",
					description: "Bug description",
					diff: "diff-content-here",
					url: "https://github.com/pr/5",
					state: "open",
				});
			});
		});

		describe("postReviewComment", () => {
			it("creates issue comment on github", async () => {
				const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
				process.env.NEXT_PUBLIC_APP_URL = "https://codehorse.vercel.app";

				mockOctokit.rest.issues.createComment.mockResolvedValueOnce({});

				await provider.postReviewComment("owner", "repo", 5, "Hello feedback");

				expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
					owner: "owner",
					repo: "repo",
					issue_number: 5,
					body: "## 🤠 AI Code Review\n\nHello feedback\n\n---\n<img src=\"https://codehorse.vercel.app/logo.png\" width=\"32\" height=\"32\" align=\"left\" style=\"margin-right: 8px;\" /> *Powered By [CodeSheriff](https://codehorse.vercel.app)*",
				});

				process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
			});

			it("omits the logo and shows a text-only footer when APP_URL is localhost or unset", async () => {
				const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
				process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

				mockOctokit.rest.issues.createComment.mockResolvedValueOnce({});

				await provider.postReviewComment("owner", "repo", 5, "Hello feedback");

				expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
					owner: "owner",
					repo: "repo",
					issue_number: 5,
					body: "## 🤠 AI Code Review\n\nHello feedback\n\n---\n*Powered By CodeSheriff*",
				});

				process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
			});
		});

		describe("webhooks management", () => {
			it("createWebhook returns existing webhook if configuration matches callbackUrl", async () => {
				mockOctokit.rest.repos.listWebhooks.mockResolvedValueOnce({
					data: [
						{ id: 99, config: { url: "https://callback.com" } },
					],
				});

				const hook = await provider.createWebhook("owner", "repo", "https://callback.com");
				expect(hook.id).toBe(99);
				expect(mockOctokit.rest.repos.createWebhook).not.toHaveBeenCalled();
			});

			it("createWebhook creates a new webhook if not exists", async () => {
				mockOctokit.rest.repos.listWebhooks.mockResolvedValueOnce({
					data: [],
				});
				mockOctokit.rest.repos.createWebhook.mockResolvedValueOnce({
					data: { id: 100, config: { url: "https://callback.com" } },
				});

				const hook = await provider.createWebhook("owner", "repo", "https://callback.com");
				expect(hook.id).toBe(100);
				expect(mockOctokit.rest.repos.createWebhook).toHaveBeenCalledWith({
					owner: "owner",
					repo: "repo",
					config: { url: "https://callback.com", content_type: "json" },
					events: ["pull_request", "issue_comment", "pull_request_review_comment"],
				});
			});

			it("createWebhook signs new hooks with the shared secret when GITHUB_WEBHOOK_SECRET is set", async () => {
				// beforeEach pins the env to absent, so set it explicitly here.
				process.env.GITHUB_WEBHOOK_SECRET = "test-secret";

				mockOctokit.rest.repos.listWebhooks.mockResolvedValueOnce({
					data: [],
				});
				mockOctokit.rest.repos.createWebhook.mockResolvedValueOnce({
					data: { id: 100, config: { url: "https://callback.com" } },
				});

				const hook = await provider.createWebhook("owner", "repo", "https://callback.com");
				expect(hook.id).toBe(100);
				expect(mockOctokit.rest.repos.createWebhook).toHaveBeenCalledWith({
					owner: "owner",
					repo: "repo",
					config: {
						url: "https://callback.com",
						content_type: "json",
						secret: "test-secret",
					},
					events: ["pull_request", "issue_comment", "pull_request_review_comment"],
				});
			});

			it("deleteWebhook deletes webhook if found by ID", async () => {
				mockOctokit.rest.repos.listWebhooks.mockResolvedValueOnce({
					data: [
						{ id: 99, config: { url: "https://callback.com" } },
					],
				});
				mockOctokit.rest.repos.deleteWebhook.mockResolvedValueOnce({});

				await provider.deleteWebhook("owner", "repo", "99");

				expect(mockOctokit.rest.repos.deleteWebhook).toHaveBeenCalledWith({
					owner: "owner",
					repo: "repo",
					hook_id: 99,
				});
			});
		});

		describe("getRepoFileContents", () => {
			it("fetches single file content recursively", async () => {
				mockOctokit.rest.repos.getContent.mockResolvedValueOnce({
					data: {
						type: "file",
						path: "src/utils.ts",
						content: Buffer.from("const a = 1;").toString("base64"),
					},
				});

				const files = await provider.getRepoFileContents("owner", "repo", "src/utils.ts");
				expect(files).toHaveLength(1);
				expect(files[0]).toEqual({
					path: "src/utils.ts",
					content: "const a = 1;",
				});
			});
		});

		describe("getContributions", () => {
			it("executes graphql user contribution query", async () => {
				mockOctokit.graphql.mockResolvedValueOnce({
					user: {
						contributionsCollection: {
							contributionCalendar: {
								totalContributions: 42,
							},
						},
					},
				});

				const result = await provider.getContributions("my-username");
				expect(result.totalContributions).toBe(42);
				expect(mockOctokit.graphql).toHaveBeenCalledWith(
					expect.stringContaining("contributionsCollection"),
					{ username: "my-username" }
				);
			});

			it("throws error if user not found", async () => {
				mockOctokit.graphql.mockResolvedValueOnce({
					user: null,
				});

				await expect(provider.getContributions("my-username")).rejects.toThrow(
					"GitHub user 'my-username' not found"
				);
			});
		});

		describe("searchPullRequests", () => {
			it("searches and maps pulls correctly", async () => {
				mockOctokit.rest.search.issuesAndPullRequests.mockResolvedValueOnce({
					data: {
						items: [
							{
								number: 1,
								title: "PR Title",
								html_url: "url1",
								state: "open",
								repository_url: "repoUrl1",
							},
						],
					},
				});

				const results = await provider.searchPullRequests("query");
				expect(results).toHaveLength(1);
				expect(results[0]).toEqual({
					number: 1,
					title: "PR Title",
					url: "url1",
					state: "open",
					repository: "repoUrl1",
				});
			});
		});

		describe("ReviewCapableProvider advanced methods", () => {
			it("creates a check run via the shared github helper", async () => {
				const id = await provider.createPRCheckRun("owner", "repo", "sha-123");
				expect(id).toBe(101);
				expect(mockOctokit.rest.checks.create).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "owner",
						repo: "repo",
						head_sha: "sha-123",
						name: "CodeSheriff Review",
						status: "in_progress",
					})
				);
			});

			it("updates commit status with the provider's client token", async () => {
				await provider.updatePRCommitStatus(
					"owner",
					"repo",
					"sha-123",
					"pending",
					"Review in progress",
					"http://target.url"
				);

				expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith({
					owner: "owner",
					repo: "repo",
					sha: "sha-123",
					state: "pending",
					description: "Review in progress",
					context: "CodeSheriff",
					target_url: "http://target.url",
				});
			});

			it("posts a loading comment and returns its id", async () => {
				const id = await provider.postLoadingReviewComment("owner", "repo", 5);
				expect(id).toBe(42);
				expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "owner",
						repo: "repo",
						issue_number: 5,
						body: expect.stringContaining("Review in progress"),
					})
				);
			});
		});
	});
});
