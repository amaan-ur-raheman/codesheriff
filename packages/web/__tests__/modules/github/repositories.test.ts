import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/modules/github/lib/auth", () => ({
	getGithubAccessToken: vi.fn().mockResolvedValue("token-123"),
	getOctokit: vi.fn(),
}));

import { getRepositories } from "@/modules/github/lib/repositories";
import { getOctokit } from "@/modules/github/lib/auth";

const mockOctokit = {
	rest: {
		repos: {
			listForAuthenticatedUser: vi.fn(),
		},
	},
};

describe("getRepositories pagination", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getOctokit).mockResolvedValue(mockOctokit as any);
	});

	it("parses totalPages from the rel=last link", async () => {
		mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValueOnce({
			data: [{ id: 1, name: "repo-a" }],
			headers: {
				link: '<https://api.github.com/user/repos?page=2&per_page=10>; rel="next", <https://api.github.com/user/repos?page=12&per_page=10>; rel="last"',
			},
		});

		const result = await getRepositories(1, 10);

		expect(result).toEqual({
			items: [{ id: 1, name: "repo-a" }],
			totalPages: 12,
		});
	});

	it("defaults totalPages to the current page when no rel=last link is present", async () => {
		mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValueOnce({
			data: [{ id: 1, name: "repo-a" }],
			headers: {},
		});

		const result = await getRepositories(1, 10);

		expect(result.totalPages).toBe(1);
		expect(mockOctokit.rest.repos.listForAuthenticatedUser).toHaveBeenCalledWith(
			expect.objectContaining({ page: 1, per_page: 10 })
		);
	});

	it("falls back to the requested page when rel=last is missing on a page greater than one", async () => {
		// GitHub can omit rel="last" when it cannot calculate it. In that case
		// the deepest page we have seen is the requested page, and the pager
		// must not claim a larger total exists.
		mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValueOnce({
			data: [{ id: 3, name: "repo-c" }],
			headers: { link: '<https://api.github.com/user/repos?page=2&per_page=10>; rel="prev"' },
		});

		const result = await getRepositories(3, 10);

		expect(result).toEqual({
			items: [{ id: 3, name: "repo-c" }],
			totalPages: 3,
		});
	});

	it("returns the current page as totalPages when the last page is the requested one", async () => {
		mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValueOnce({
			data: [{ id: 1, name: "repo-a" }],
			headers: {
				link: '<https://api.github.com/user/repos?page=2&per_page=10>; rel="prev", <https://api.github.com/user/repos?page=3&per_page=10>; rel="last"',
			},
		});

		const result = await getRepositories(3, 10);

		expect(result.totalPages).toBe(3);
	});
});
