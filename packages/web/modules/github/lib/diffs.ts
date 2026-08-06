import { getOctokit } from "./auth";

/**
 * Fetches pull request diff and metadata from GitHub
 * @param token - GitHub access token
 * @param owner - Repository owner username
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns Promise resolving to PR diff, title, and description
 */
export async function getPullRequestDiff(
	token: string,
	owner: string,
	repo: string,
	prNumber: number
) {
	const octokit = await getOctokit({ token, owner, repo });

	const { data: pr } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: prNumber,
	});

	const { data: diff } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: prNumber,
		mediaType: {
			format: "diff",
		},
	});

	return {
		diff: diff as unknown as string,
		title: pr.title,
		description: pr.body,
		headSha: pr.head.sha,
	};
}

/**
 * Compares two commit SHAs and returns the raw diff string
 * @param token - GitHub access token
 * @param owner - Repository owner username
 * @param repo - Repository name
 * @param base - Base commit SHA (before)
 * @param head - Head commit SHA (after)
 * @returns Promise resolving to the diff string
 */
export async function getCompareDiff(
	token: string,
	owner: string,
	repo: string,
	base: string,
	head: string
): Promise<string> {
	const octokit = await getOctokit({ token, owner, repo });

	const { data: diff } = await octokit.rest.repos.compareCommits({
		owner,
		repo,
		base,
		head,
		mediaType: {
			format: "diff",
		},
	});

	return diff as unknown as string;
}

/**
 * Parses a unified diff string and returns a map of file paths to a Set of line numbers
 * that are valid for inline commenting (i.e., lines present on the RIGHT/new side of hunks).
 */
export function getValidDiffLines(diffContent: string): Record<string, Set<number>> {
	const validLines: Record<string, Set<number>> = {};
	if (!diffContent) return validLines;

	// Split by diff files
	const fileDiffs = diffContent.split(/^diff --git /m);

	for (const fileDiff of fileDiffs) {
		if (!fileDiff.trim()) continue;

		// Extract target file path (e.g. +++ b/path/to/file)
		const matchFile = fileDiff.match(/^\+\+\+ b\/(.+)$/m);
		if (!matchFile) continue;
		const filePath = matchFile[1].trim();

		validLines[filePath] = new Set<number>();

		// Find all hunk headers: @@ -oldStart,oldLength +newStart,newLength @@
		const hunkHeaderRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
		let match;
		while ((match = hunkHeaderRegex.exec(fileDiff)) !== null) {
			const newStart = parseInt(match[1], 10);
			const newLength = match[2] ? parseInt(match[2], 10) : 1;
			for (let i = 0; i < newLength; i++) {
				validLines[filePath].add(newStart + i);
			}
		}
	}

	return validLines;
}
