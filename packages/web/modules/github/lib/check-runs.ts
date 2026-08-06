import { getOctokit } from "./auth";

/**
 * Updates the commit status on GitHub for a PR commit.
 *
 * @param token - GitHub access token.
 * @param owner - Repository owner username.
 * @param repo - Repository name.
 * @param sha - Commit SHA.
 * @param state - Status check state.
 * @param description - Description of the check status.
 * @param targetUrl - Detail page url.
 */
export async function updatePRCommitStatus(
	token: string,
	owner: string,
	repo: string,
	sha: string,
	state: "pending" | "success" | "failure" | "error",
	description: string,
	targetUrl?: string
) {
	try {
		const octokit = await getOctokit({ token, owner, repo });
		await octokit.rest.repos.createCommitStatus({
			owner,
			repo,
			sha,
			state,
			description,
			context: "CodeSheriff",
			target_url: targetUrl,
		});
	} catch (error) {
		console.error("Failed to update commit status on GitHub:", error);
	}
}

/**
 * Creates a check run on GitHub for a PR commit.
 */
export async function createPRCheckRun(
	token: string,
	owner: string,
	repo: string,
	sha: string
) {
	try {
		const octokit = await getOctokit({ token, owner, repo });
		const response = await octokit.rest.checks.create({
			owner,
			repo,
			name: "CodeSheriff Review",
			head_sha: sha,
			status: "in_progress",
			started_at: new Date().toISOString(),
		});
		return response.data.id;
	} catch (error: any) {
		if (error && error.status === 403) {
			console.error(
				"Failed to create GitHub check run: 403 Forbidden. " +
					"This usually indicates insufficient permissions (e.g., using an OAuth user token instead of a GitHub App installation token). " +
					"The Checks API write endpoints require GitHub App permissions.",
				error
			);
		} else {
			console.error("Failed to create GitHub check run:", error);
		}
		return null;
	}
}

/**
 * Updates a check run on GitHub with completion status and annotations.
 */
export async function updatePRCheckRun(
	token: string,
	owner: string,
	repo: string,
	checkRunId: number,
	status: "completed",
	conclusion: "success" | "failure" | "cancelled" | "timed_out",
	summary: string,
	annotations?: {
		path: string;
		start_line: number;
		end_line: number;
		annotation_level: "notice" | "warning" | "failure";
		message: string;
		title?: string;
	}[]
) {
	try {
		const octokit = await getOctokit({ token, owner, repo });
		const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/dashboard\/?$/, "");
		const logoUrl = `${appUrl}/logo.png`;

		// GitHub limits annotations to 50 per request
		const chunkedAnnotations = annotations ? annotations.slice(0, 50) : undefined;

		await octokit.rest.checks.update({
			owner,
			repo,
			check_run_id: checkRunId,
			status,
			conclusion,
			completed_at: new Date().toISOString(),
			output: {
				title: "CodeSheriff Code Review",
				summary: `<img src="${logoUrl}" width="48" height="48" align="right" />\n\n${summary}`,
				annotations: chunkedAnnotations,
			},
		});
	} catch (error) {
		console.error("Failed to update GitHub check run:", error);
	}
}
