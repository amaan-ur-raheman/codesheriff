import { getGithubAccessToken, getOctokit } from "./auth";

/**
 * Lists repositories for the authenticated user.
 *
 * @param page - Page number (default: 1).
 * @param perPage - Repositories per page (default: 10).
 * @returns List of repositories.
 */
export const getRepositories = async (
	page: number = 1,
	perPage: number = 10
) => {
	const token = await getGithubAccessToken();
	const octokit = await getOctokit({ token });

	const { data } = await octokit.rest.repos.listForAuthenticatedUser({
		sort: "updated",
		direction: "desc",
		visibility: "all",
		per_page: perPage,
		page: page,
	});

	return data;
};
