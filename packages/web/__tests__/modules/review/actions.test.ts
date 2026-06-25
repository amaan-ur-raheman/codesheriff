import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock imports
vi.mock("@/lib/db", () => ({
	default: {
		review: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			update: vi.fn(),
		},
	},
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn().mockResolvedValue({
				user: { id: "user-123" },
			}),
		},
	},
}));

vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue({}),
}));

const mockOctokit = {
	rest: {
		pulls: {
			get: vi.fn().mockResolvedValue({
				data: {
					head: {
						ref: "feature/auth",
						repo: {
							owner: { login: "test-owner" },
							name: "test-repo",
						},
					},
				},
			}),
		},
		repos: {
			getContent: vi.fn(),
			createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
		},
	},
};

vi.mock("octokit", () => ({
	Octokit: vi.fn().mockImplementation(() => mockOctokit),
}));

import prisma from "@/lib/db";
import { getReviews, applySuggestion, applySuggestionsBatch } from "@/modules/review/actions";

const mockPrisma = prisma as unknown as {
	review: {
		findMany: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		findFirst: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
};

describe("Review Server Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getReviews", () => {
		it("retrieves reviews for the logged-in user", async () => {
			const mockReviews = [
				{ id: "rev-1", prTitle: "Add landing page" },
				{ id: "rev-2", prTitle: "Fix database schema" },
			];
			mockPrisma.review.findMany.mockResolvedValue(mockReviews);

			const result = await getReviews();
			expect(result).toEqual(mockReviews);
			expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { repository: { userId: "user-123" } },
				})
			);
		});
	});

	describe("applySuggestion", () => {
		it("successfully fetches file, replaces code, commits it and updates db", async () => {
			const mockReview = {
				id: "rev-1",
				prNumber: 42,
				suggestions: {
					suggestions: [
						{
							id: "sug-1",
							filePath: "src/utils.ts",
							startLine: 1,
							endLine: 2,
							originalCode: "console.log('original');",
							suggestedCode: "console.log('suggested');",
							applied: false,
						},
					],
				},
				repository: {
					owner: "test-owner",
					name: "test-repo",
					user: {
						accounts: [{ providerId: "github", accessToken: "github-token" }],
					},
				},
			};

			mockPrisma.review.findFirst.mockResolvedValue(mockReview);
			mockOctokit.rest.repos.getContent.mockResolvedValue({
				data: {
					content: Buffer.from("console.log('original');\n").toString("base64"),
					sha: "file-sha-123",
				},
			});

			const result = await applySuggestion("rev-1", "sug-1");
			expect(result).toEqual({ success: true });

			expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
				expect.objectContaining({
					owner: "test-owner",
					repo: "test-repo",
					path: "src/utils.ts",
					content: Buffer.from("console.log('suggested');").toString("base64"),
					sha: "file-sha-123",
					branch: "feature/auth",
				})
			);

			expect(mockPrisma.review.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: "rev-1" },
					data: {
						suggestions: {
							suggestions: [
								expect.objectContaining({
									id: "sug-1",
									applied: true,
								}),
							],
						},
					},
				})
			);
		});

		it("throws an error when originalCode is empty and startLine is invalid", async () => {
			const mockReview = {
				id: "rev-1",
				prNumber: 42,
				suggestions: {
					suggestions: [
						{
							id: "sug-1",
							filePath: "src/utils.ts",
							startLine: 0,
							endLine: 0,
							originalCode: "",
							suggestedCode: "console.log('suggested');",
							applied: false,
						},
					],
				},
				repository: {
					owner: "test-owner",
					name: "test-repo",
					user: {
						accounts: [{ providerId: "github", accessToken: "github-token" }],
					},
				},
			};

			mockPrisma.review.findFirst.mockResolvedValue(mockReview);
			mockOctokit.rest.repos.getContent.mockResolvedValue({
				data: {
					content: Buffer.from("console.log('original');\n").toString("base64"),
					sha: "file-sha-123",
				},
			});

			await expect(applySuggestion("rev-1", "sug-1")).rejects.toThrow(
				"Could not find the original code block to replace."
			);
		});

		it("throws an error when originalCode is empty and startLine is valid but file content line is not empty", async () => {
			const mockReview = {
				id: "rev-1",
				prNumber: 42,
				suggestions: {
					suggestions: [
						{
							id: "sug-1",
							filePath: "src/utils.ts",
							startLine: 1,
							endLine: 1,
							originalCode: "",
							suggestedCode: "console.log('suggested');",
							applied: false,
						},
					],
				},
				repository: {
					owner: "test-owner",
					name: "test-repo",
					user: {
						accounts: [{ providerId: "github", accessToken: "github-token" }],
					},
				},
			};

			mockPrisma.review.findFirst.mockResolvedValue(mockReview);
			mockOctokit.rest.repos.getContent.mockResolvedValue({
				data: {
					content: Buffer.from("console.log('original');\n").toString("base64"),
					sha: "file-sha-123",
				},
			});

			await expect(applySuggestion("rev-1", "sug-1")).rejects.toThrow(
				"Target file content does not match the original suggestion. It may have been modified."
			);
		});
	});

	describe("applySuggestionsBatch", () => {
		it("groups and applies multiple suggestions sorted bottom-to-top by line numbers", async () => {
			const mockReview = {
				id: "rev-1",
				prNumber: 42,
				suggestions: {
					suggestions: [
						{
							id: "sug-1",
							filePath: "src/math.ts",
							startLine: 1,
							endLine: 1,
							originalCode: "const x = 1;",
							suggestedCode: "const x = 10;",
							applied: false,
						},
						{
							id: "sug-2",
							filePath: "src/math.ts",
							startLine: 3,
							endLine: 3,
							originalCode: "const y = 2;",
							suggestedCode: "const y = 20;",
							applied: false,
						},
					],
				},
				repository: {
					owner: "test-owner",
					name: "test-repo",
					user: {
						accounts: [{ providerId: "github", accessToken: "github-token" }],
					},
				},
			};

			mockPrisma.review.findFirst.mockResolvedValue(mockReview);
			mockOctokit.rest.repos.getContent.mockResolvedValue({
				data: {
					content: Buffer.from("const x = 1;\n\nconst y = 2;\n").toString("base64"),
					sha: "file-sha-456",
				},
			});

			const result = await applySuggestionsBatch("rev-1", ["sug-1", "sug-2"]);
			expect(result).toEqual({ success: true });

			// Content after applying both (sug-2 then sug-1) should be:
			// const x = 10;\n\nconst y = 20;\n
			expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
				expect.objectContaining({
					path: "src/math.ts",
					content: Buffer.from("const x = 10;\n\nconst y = 20;\n").toString("base64"),
				})
			);

			expect(mockPrisma.review.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: "rev-1" },
					data: {
						suggestions: {
							suggestions: [
								expect.objectContaining({ id: "sug-1", applied: true }),
								expect.objectContaining({ id: "sug-2", applied: true }),
							],
						},
					},
				})
			);
		});
	});
});
