import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db
vi.mock("@/lib/db", () => ({
	default: {
		repository: {
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

// Mock next headers
vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue({}),
}));

// Mock github lib helper
vi.mock("@/modules/github/lib/github", () => ({
	getRepositories: vi.fn(),
}));

import prisma from "@/lib/db";
import { fetchRepositories } from "@/modules/repository/actions";
import { getRepositories } from "@/modules/github/lib/github";

const mockPrisma = prisma as unknown as {
	repository: {
		findMany: ReturnType<typeof vi.fn>;
	};
};

describe("Repository Index Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("fetchRepositories", () => {
		it("throws unauthorized if session is missing", async () => {
			const { auth } = await import("@/lib/auth");
			vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

			await expect(fetchRepositories()).rejects.toThrow("Unauthorized");
		});

		it("fetches repos from GitHub and maps connection state using db repo records", async () => {
			const mockGithubRepos = [
				{ id: "101", name: "repo-a" },
				{ id: "102", name: "repo-b" },
			];
			vi.mocked(getRepositories).mockResolvedValueOnce(mockGithubRepos as any);

			mockPrisma.repository.findMany.mockResolvedValueOnce([
				{ githubId: BigInt(101), userId: "user-123" },
			]);

			const result = await fetchRepositories(1, 10);

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				id: "101",
				name: "repo-a",
				isConnected: true,
			});
			expect(result[1]).toEqual({
				id: "102",
				name: "repo-b",
				isConnected: false,
			});

			expect(getRepositories).toHaveBeenCalledWith(1, 10);
			expect(mockPrisma.repository.findMany).toHaveBeenCalledWith({
				where: { userId: "user-123" },
			});
		});
	});
});
