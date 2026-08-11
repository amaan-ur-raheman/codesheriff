import { getGithubAccessToken, getOctokit } from "./auth";

/**
 * Lists repositories for the authenticated user.
 *
 * @param page - Page number (default: 1).
 * @param perPage - Repositories per page (default: 10).
 * @returns The page of repositories plus the total page count (parsed from
 *   GitHub's rel="last" Link header, which carries the exact final page
 *   number at the requested per_page).
 */
export const getRepositories = async (
	page: number = 1,
	perPage: number = 10
) => {
	const token = await getGithubAccessToken();
	const octokit = await getOctokit({ token });

	const response = await octokit.rest.repos.listForAuthenticatedUser({
		sort: "updated",
		direction: "desc",
		visibility: "all",
		per_page: perPage,
		page: page,
	});

	// GitHub exposes no total count for /user/repos. The Link header carries
	// rel="last" with the final page number whenever more pages exist — that
	// is exactly totalPages at this per_page. Without it, we're on the only
	// page, so the current page number is the total.
	const lastMatch = (response.headers.link ?? "").match(
		/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/
	);
	const totalPages = lastMatch ? parseInt(lastMatch[1], 10) : page;

	return { items: response.data, totalPages };
};
