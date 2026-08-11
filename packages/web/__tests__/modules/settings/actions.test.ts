import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
	default: {
		repository: {
			findMany: vi.fn(),
			count: vi.fn(),
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

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

// The action module imports these at top level; stub them so the test stays
// isolated from GitHub webhook plumbing and subscription side effects.
vi.mock("@/modules/github/lib/github", () => ({
	deleteWebhook: vi.fn(),
}));

vi.mock("@/modules/payment/lib/subscription", () => ({
	decrementRepositoryCount: vi.fn(),
}));

import prisma from "@/lib/db";
import { getConnectedRepositories } from "@/modules/settings/actions";

const mockPrisma = prisma as unknown as {
	repository: {
		findMany: ReturnType<typeof vi.fn>;
		count: ReturnType<typeof vi.fn>;
	};
};

describe("Settings — connected repositories", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns one page plus the total count, applying skip/take from page + pageSize", async () => {
		const rows = [
			{
				id: "r1",
				name: "repo-a",
				fullName: "user/repo-a",
				url: "https://github.com/user/repo-a",
				createdAt: new Date(),
			},
			{
				id: "r2",
				name: "repo-b",
				fullName: "user/repo-b",
				url: "https://github.com/user/repo-b",
				createdAt: new Date(),
			},
		];
		mockPrisma.repository.findMany.mockResolvedValueOnce(rows);
		mockPrisma.repository.count.mockResolvedValueOnce(23);

		const result = await getConnectedRepositories(3, 8);

		expect(mockPrisma.repository.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ skip: 16, take: 8 })
		);
		expect(mockPrisma.repository.count).toHaveBeenCalledWith({
			where: { userId: "user-123" },
		});
		expect(result).toEqual({ repositories: rows, total: 23 });
	});

	it("defaults to page 1 / pageSize 8", async () => {
		mockPrisma.repository.findMany.mockResolvedValueOnce([]);
		mockPrisma.repository.count.mockResolvedValueOnce(0);

		await getConnectedRepositories();

		expect(mockPrisma.repository.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ skip: 0, take: 8 })
		);
	});

	it("caps pageSize at 50 so callers cannot request unbounded queries", async () => {
		mockPrisma.repository.findMany.mockResolvedValueOnce([]);
		mockPrisma.repository.count.mockResolvedValueOnce(0);

		const result = await getConnectedRepositories(1, 100000);

		expect(mockPrisma.repository.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ skip: 0, take: 50 })
		);
		expect(result).toEqual({ repositories: [], total: 0 });
	});

	it("clamps page and pageSize to valid ranges for hostile inputs", async () => {
		mockPrisma.repository.findMany.mockResolvedValueOnce([]);
		mockPrisma.repository.count.mockResolvedValueOnce(0);

		await getConnectedRepositories(0, 0);

		expect(mockPrisma.repository.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ skip: 0, take: 1 })
		);
	});

	it("returns empty results instead of throwing when unauthenticated", async () => {
		const { auth } = await import("@/lib/auth");
		vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as any);

		const result = await getConnectedRepositories(1, 8);

		expect(result).toEqual({ repositories: [], total: 0 });
	});
});
