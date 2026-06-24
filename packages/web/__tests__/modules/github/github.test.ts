import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}));

const mockOctokit = {
	rest: {
		repos: {
			createCommitStatus: vi.fn().mockResolvedValue({}),
			createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
		},
		checks: {
			create: vi.fn().mockResolvedValue({ data: { id: 101 } }),
			update: vi.fn().mockResolvedValue({}),
		},
		pulls: {
			getReviewComment: vi.fn().mockResolvedValue({
				data: { id: 2, in_reply_to_id: 1, body: "Reply comment", created_at: "2026-06-20T12:00:00Z" },
			}),
			listReviewComments: vi.fn().mockResolvedValue({
				data: [
					{ id: 1, body: "Root comment", user: { login: "user1" }, created_at: "2026-06-20T10:00:00Z" },
					{ id: 2, in_reply_to_id: 1, body: "Reply comment", user: { login: "user2" }, created_at: "2026-06-20T12:00:00Z" },
					{ id: 3, in_reply_to_id: 5, body: "Other thread", user: { login: "user3" }, created_at: "2026-06-20T11:00:00Z" },
				],
			}),
		},
		issues: {
			listComments: vi.fn().mockResolvedValue({
				data: [
					{ id: 10, body: "PR comment 1", user: { login: "user1" }, created_at: "2026-06-20T10:00:00Z" },
					{ id: 11, body: "PR comment 2", user: { login: "user2" }, created_at: "2026-06-20T10:30:00Z" },
				],
			}),
		},
	},
};

vi.mock("octokit", () => ({
	Octokit: vi.fn().mockImplementation(() => mockOctokit),
}));

import {
	updatePRCommitStatus,
	createPRCheckRun,
	updatePRCheckRun,
	getReviewCommentThread,
	getIssueCommentThread,
} from "@/modules/github/lib/github";

describe("GitHub API Integration Helpers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("updatePRCommitStatus", () => {
		it("calls createCommitStatus with correct parameters", async () => {
			await updatePRCommitStatus(
				"token-123",
				"owner-test",
				"repo-test",
				"sha-123",
				"pending",
				"Review in progress",
				"http://target.url"
			);

			expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith({
				owner: "owner-test",
				repo: "repo-test",
				sha: "sha-123",
				state: "pending",
				description: "Review in progress",
				context: "CodeSheriff",
				target_url: "http://target.url",
			});
		});

		it("handles errors gracefully and does not crash", async () => {
			mockOctokit.rest.repos.createCommitStatus.mockRejectedValueOnce(new Error("API Error"));
			
			// This should not throw
			await updatePRCommitStatus(
				"token-123",
				"owner-test",
				"repo-test",
				"sha-123",
				"pending",
				"Review in progress"
			);
		});
	});

	describe("createPRCheckRun", () => {
		it("creates check run and returns its id", async () => {
			const id = await createPRCheckRun("token-123", "owner-test", "repo-test", "sha-123");
			expect(id).toBe(101);
			expect(mockOctokit.rest.checks.create).toHaveBeenCalledWith(
				expect.objectContaining({
					owner: "owner-test",
					repo: "repo-test",
					name: "CodeSheriff Review",
					head_sha: "sha-123",
					status: "in_progress",
				})
			);
		});
	});

	describe("updatePRCheckRun", () => {
		it("updates check run with success status and annotations", async () => {
			const annotations = [
				{
					path: "src/index.ts",
					start_line: 5,
					end_line: 5,
					annotation_level: "warning" as const,
					message: "Fix warning",
					title: "Warning Title",
				},
			];

			await updatePRCheckRun(
				"token-123",
				"owner-test",
				"repo-test",
				101,
				"completed",
				"success",
				"Review passed",
				annotations
			);

			expect(mockOctokit.rest.checks.update).toHaveBeenCalledWith(
				expect.objectContaining({
					owner: "owner-test",
					repo: "repo-test",
					check_run_id: 101,
					status: "completed",
					conclusion: "success",
					output: expect.objectContaining({
						title: "CodeSheriff Code Review",
						summary: expect.stringContaining("Review passed"),
						annotations: annotations,
					}),
				})
			);
		});

		it("limits annotations count to a maximum of 50 to prevent GitHub errors", async () => {
			const manyAnnotations = Array.from({ length: 60 }, (_, idx) => ({
				path: "src/index.ts",
				start_line: idx + 1,
				end_line: idx + 1,
				annotation_level: "notice" as const,
				message: `Annotation ${idx}`,
			}));

			await updatePRCheckRun(
				"token-123",
				"owner-test",
				"repo-test",
				101,
				"completed",
				"success",
				"Review passed",
				manyAnnotations
			);

			expect(mockOctokit.rest.checks.update).toHaveBeenCalledWith(
				expect.objectContaining({
					output: expect.objectContaining({
						annotations: expect.any(Array),
					}),
				})
			);

			const callArgs = mockOctokit.rest.checks.update.mock.calls[0][0];
			expect(callArgs.output.annotations).toHaveLength(50);
		});
	});

	describe("getReviewCommentThread", () => {
		it("resolves full thread context and orders comment chronologically", async () => {
			const thread = await getReviewCommentThread("token-123", "owner-test", "repo-test", 42, 2);
			
			expect(thread).toHaveLength(2);
			expect(thread[0]).toEqual({
				author: "user1",
				body: "Root comment",
				createdAt: "2026-06-20T10:00:00Z",
			});
			expect(thread[1]).toEqual({
				author: "user2",
				body: "Reply comment",
				createdAt: "2026-06-20T12:00:00Z",
			});
		});
	});

	describe("getIssueCommentThread", () => {
		it("lists all issue comments", async () => {
			const thread = await getIssueCommentThread("token-123", "owner-test", "repo-test", 42);
			
			expect(thread).toHaveLength(2);
			expect(thread[0].body).toBe("PR comment 1");
			expect(thread[1].body).toBe("PR comment 2");
		});
	});
});
