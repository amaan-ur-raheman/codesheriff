import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
vi.mock("@/lib/db", () => ({
	default: {
		repository: {
			findMany: vi.fn(),
		},
		review: {
			findMany: vi.fn(),
		},
	},
}));

// Mock auth
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

import prisma from "@/lib/db";
import { globalSearch } from "@/modules/search/actions";

const mockPrisma = prisma as unknown as {
	repository: {
		findMany: ReturnType<typeof vi.fn>;
	};
	review: {
		findMany: ReturnType<typeof vi.fn>;
	};
};

describe("Search Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("globalSearch", () => {
		it("returns empty array if query is empty or whitespace", async () => {
			const res1 = await globalSearch("");
			const res2 = await globalSearch("   ");
			expect(res1).toEqual([]);
			expect(res2).toEqual([]);
		});

		it("returns empty array if user is unauthorized", async () => {
			const { auth } = await import("@/lib/auth");
			vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

			const res = await globalSearch("some-query");
			expect(res).toEqual([]);
		});

		it("searches and returns combined repositories and reviews matching query", async () => {
			mockPrisma.repository.findMany.mockResolvedValueOnce([
				{ id: "repo-1", fullName: "owner/repo-one", url: "github/repo-one" },
			]);
			mockPrisma.review.findMany.mockResolvedValueOnce([
				{ id: "rev-1", prNumber: 4, prTitle: "Add tests", status: "completed" },
			]);

			const results = await globalSearch("test");

			expect(results).toHaveLength(2);
			expect(results[0]).toEqual({
				type: "repository",
				title: "owner/repo-one",
				description: "github/repo-one",
				url: "/dashboard/repository?id=repo-1",
				icon: "GitRepository",
			});
			expect(results[1]).toEqual({
				type: "review",
				title: "PR #4: Add tests",
				description: "completed",
				url: "/dashboard/reviews?id=rev-1",
				icon: "PullRequest",
			});

			expect(mockPrisma.repository.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						userId: "user-123",
					}),
				})
			);
		});
	});
});
