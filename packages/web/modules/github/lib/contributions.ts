import { getOctokit } from "./auth";

/**
 * Fetches GitHub user contribution data using GraphQL API
 * @param token - GitHub access token
 * @param username - GitHub username
 * @returns Promise resolving to contribution calendar data
 */
export async function fetchUserContribution(token: string, username: string) {
	const octokit = await getOctokit({ token });

	const query = `
        query($username: String!) {
            user(login: $username) {
                contributionsCollection {
                    contributionCalendar {
                        totalContributions
                        weeks {
                            contributionDays {
                                contributionCount
                                date
                                color
                            }
                        }
                    }
                }
            }
        }
    `;

	try {
		const response: any = await octokit.graphql(query, {
			username,
		});

		if (!response.user) {
			throw new Error(`GitHub user '${username}' not found`);
		}

		return response.user.contributionsCollection.contributionCalendar;
	} catch (error) {
		console.error("Error fetching contribution data:", error);
		throw new Error(
			"Failed to fetch contribution data from GitHub: " +
				(error as Error).message
		);
	}
}
