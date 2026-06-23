import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
vi.mock("@/lib/db", () => ({
	default: {
		repository: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
		},
		review: {
			findMany: vi.fn(),
			update: vi.fn(),
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
import {
	calculateHealthScore,
	getHealthScores,
	getHealthTrend,
} from "@/modules/repository/actions/health-score";

const mockPrisma = prisma as unknown as {
	repository: {
		findUnique: ReturnType<typeof vi.fn>;
		findMany: ReturnType<typeof vi.fn>;
	};
	review: {
		findMany: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
};

describe("Repository Health Score Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("calculateHealthScore", () => {
		it("throws unauthorized error if user session is invalid", async () => {
			const { auth } = await import("@/lib/auth");
			vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

			await expect(calculateHealthScore("repo-123")).rejects.toThrow("Unauthorized");
		});

		it("throws repository not found if repository does not exist or user doesn't own it", async () => {
			mockPrisma.repository.findUnique.mockResolvedValueOnce(null);
			await expect(calculateHealthScore("repo-123")).rejects.toThrow("Repository not found");

			mockPrisma.repository.findUnique.mockResolvedValueOnce({ userId: "other-user" });
			await expect(calculateHealthScore("repo-123")).rejects.toThrow("Repository not found");
		});

		it("returns 0 if there are no reviews", async () => {
			mockPrisma.repository.findUnique.mockResolvedValueOnce({ userId: "user-123" });
			mockPrisma.review.findMany.mockResolvedValueOnce([]);

			const score = await calculateHealthScore("repo-123");
			expect(score).toBe(0);
		});

		it("calculates correct health score based on completion rate, average rating, issue density, and trend", async () => {
			mockPrisma.repository.findUnique.mockResolvedValueOnce({ userId: "user-123" });

			// 2 reviews
			// First review: 2 issues, completed, rating 4
			// Second review: 1 issue, completed, rating 5 (trend is positive because second has fewer issues)
			const mockReviews = [
				{
					id: "rev-1",
					status: "completed",
					suggestions: [{}, {}],
					feedbacks: [{ rating: 4 }],
					createdAt: new Date("2026-06-20T10:00:00Z"),
				},
				{
					id: "rev-2",
					status: "completed",
					suggestions: [{}],
					feedbacks: [{ rating: 5 }],
					createdAt: new Date("2026-06-20T11:00:00Z"),
				},
			];

			mockPrisma.review.findMany.mockResolvedValueOnce(mockReviews);
			mockPrisma.review.update.mockResolvedValueOnce({});

			const score = await calculateHealthScore("repo-123");

			// Completion score: 100% completed = 30 points
			// Rating: Avg is 4.5. Formula: ((4.5 - 1) / 4) * 30 = 26.25 points
			// Density: Avg issues is 1.5. Formula: Math.max(0, 1 - 1.5/10) * 20 = 17 points
			// Trend: firstHalfAvg = 2, secondHalfAvg = 1. second < first, so trend is positive = 20 points
			// Total expected: Math.round(30 + 26.25 + 17 + 20) = 93 points
			expect(score).toBe(93);
			expect(mockPrisma.review.update).toHaveBeenCalledWith({
				where: { id: "rev-2" },
				data: { healthScore: 93 },
			});
		});

		it("correctly handles declining trend and lower scores", async () => {
			mockPrisma.repository.findUnique.mockResolvedValueOnce({ userId: "user-123" });

			// 2 reviews
			// First review: 0 issues, completed, rating 5
			// Second review: 6 issues, completed, rating 2 (trend is declining)
			const mockReviews = [
				{
					id: "rev-1",
					status: "completed",
					suggestions: [],
					feedbacks: [{ rating: 5 }],
					createdAt: new Date("2026-06-20T10:00:00Z"),
				},
				{
					id: "rev-2",
					status: "completed",
					suggestions: [{}, {}, {}, {}, {}, {}],
					feedbacks: [{ rating: 2 }],
					createdAt: new Date("2026-06-20T11:00:00Z"),
				},
			];

			mockPrisma.review.findMany.mockResolvedValueOnce(mockReviews);
			mockPrisma.review.update.mockResolvedValueOnce({});

			const score = await calculateHealthScore("repo-123");

			// Completion: 30 points
			// Rating: Avg is 3.5. Formula: ((3.5 - 1) / 4) * 30 = 18.75 points
			// Density: Avg is 3. Formula: (1 - 3/10) * 20 = 14 points
			// Trend: firstHalfAvg = 0, secondHalfAvg = 6. second > first.
			// Formula: Math.max(0, 10 - (6 - 0) * 2) = 0 points
			// Expected total: Math.round(30 + 18.75 + 14 + 0) = 63 points
			expect(score).toBe(63);
		});
	});

	describe("getHealthScores", () => {
		it("returns aggregated health scores for user repositories", async () => {
			const mockRepos = [
				{
					id: "repo-1",
					name: "repo-one",
					reviews: [
						{ healthScore: 80 },
						{ healthScore: 90 },
					],
				},
				{
					id: "repo-2",
					name: "repo-two",
					reviews: [
						{ healthScore: null },
					],
				},
			];

			mockPrisma.repository.findMany.mockResolvedValueOnce(mockRepos);

			const scores = await getHealthScores();

			expect(scores).toHaveLength(2);
			expect(scores[0]).toEqual({
				repositoryId: "repo-1",
				repositoryName: "repo-one",
				healthScore: 85,
				reviewCount: 2,
			});
			expect(scores[1]).toEqual({
				repositoryId: "repo-2",
				repositoryName: "repo-two",
				healthScore: 0,
				reviewCount: 1,
			});
		});
	});

	describe("getHealthTrend", () => {
		it("generates correct monthly historical trend data", async () => {
			mockPrisma.repository.findUnique.mockResolvedValueOnce({ userId: "user-123" });

			// Setup reviews matching mock historical months
			const mockReviews = [
				{
					createdAt: new Date("2026-06-20T10:00:00Z"),
					healthScore: 80,
					suggestions: [],
					feedbacks: [],
				},
				{
					createdAt: new Date("2026-05-15T10:00:00Z"),
					healthScore: 90,
					suggestions: [],
					feedbacks: [],
				},
			];

			mockPrisma.review.findMany.mockResolvedValueOnce(mockReviews);

			const trend = await getHealthTrend("repo-123", 3);

			// Expect 3 months of trend data
			expect(trend).toHaveLength(3);
			// The latest month (June 2026) should have score 80
			const june = trend.find((t) => t.month.endsWith("Jun"));
			expect(june).toBeDefined();
			expect(june?.healthScore).toBe(80);

			// The previous month (May 2026) should have score 90
			const may = trend.find((t) => t.month.endsWith("May"));
			expect(may).toBeDefined();
			expect(may?.healthScore).toBe(90);
		});
	});
});
