import { describe, it, expect, vi, beforeEach } from "vitest";

const mockOctokit = {
	rest: {
		repos: {
			listForAuthenticatedUser: vi.fn(),
			listWebhooks: vi.fn(),
			createWebhook: vi.fn(),
			deleteWebhook: vi.fn(),
			getContent: vi.fn(),
		},
		pulls: {
			get: vi.fn(),
		},
		issues: {
			createComment: vi.fn(),
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

import { createVCSProvider } from "@/modules/vcs/factory";
import { GitHubProvider } from "@/modules/vcs/github-provider";

describe("VCS Providers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("createVCSProvider factory", () => {
		it("creates a GitHubProvider", () => {
			const provider = createVCSProvider("github", "token");
			expect(provider).toBeInstanceOf(GitHubProvider);
			expect(provider.name).toBe("github");
		});

		it("throws for unknown provider", () => {
			expect(() => createVCSProvider("invalid" as any, "token")).toThrow(
				"Unknown VCS provider: invalid"
			);
		});
	});

	describe("GitHubProvider integration helper methods", () => {
		const provider = new GitHubProvider("github-token");

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
				mockOctokit.rest.issues.createComment.mockResolvedValueOnce({});

				await provider.postReviewComment("owner", "repo", 5, "Hello feedback");

				expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
					owner: "owner",
					repo: "repo",
					issue_number: 5,
					body: "## 🤖 AI Code Review\n\nHello feedback\n\n---\n*Powered By CodeSheriff*",
				});
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
	});
});
