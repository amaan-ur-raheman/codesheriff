import { Octokit, App } from "octokit";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * Retrieves the GitHub access token for the currently authenticated user.
 *
 * @throws Error if the user is not authenticated or hasn't connected GitHub.
 * @returns The GitHub access token string.
 */
export const getGithubAccessToken = async () => {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		throw new Error("Unauthorized");
	}

	const account = await prisma.account.findFirst({
		where: {
			userId: session.user.id,
			providerId: "github",
		},
	});

	if (!account?.accessToken) {
		throw new Error("No GitHub access token found");
	}

	return account.accessToken;
};

let appInstance: App | null = null;

/**
 * Gets an authenticated Octokit instance. If GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY
 * are present, it authenticates as the GitHub App (the CodeSheriff Bot) for the given
 * repository. Otherwise, it falls back to the user's OAuth access token.
 */
export async function getOctokit(params: {
	token?: string;
	owner?: string;
	repo?: string;
}): Promise<Octokit> {
	const appId = process.env.GITHUB_APP_ID;
	const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

	if (appId && privateKey && params.owner && params.repo) {
		try {
			if (!appInstance) {
				const formattedKey = privateKey.replace(/\\n/g, "\n");
				appInstance = new App({
					appId,
					privateKey: formattedKey,
				});
			}

			// Get the installation for the specified repository
			const { data: installation } = await appInstance.octokit.request(
				"GET /repos/{owner}/{repo}/installation",
				{
					owner: params.owner,
					repo: params.repo,
				}
			);

			return await appInstance.getInstallationOctokit(installation.id);
		} catch (error) {
			console.error(
				"Failed to authenticate as GitHub App, falling back to OAuth access token:",
				error
			);
		}
	}

	const token = params.token || (await getGithubAccessToken().catch(() => undefined));
	if (!token) {
		throw new Error(
			"No authorization method available (no GitHub App credentials and no access token)"
		);
	}

	return new Octokit({ auth: token });
}
