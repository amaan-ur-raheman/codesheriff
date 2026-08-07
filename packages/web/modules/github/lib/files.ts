import { getOctokit } from "./auth";

/**
 * Recursively fetches all file contents from a GitHub repository
 * @param token - GitHub access token
 * @param owner - Repository owner username
 * @param repo - Repository name
 * @param path - Directory path to start from (default: root)
 * @returns Promise resolving to array of file objects with path and content
 */
/**
 * Fetches the content of specific files at a given commit SHA (Spec 0002
 * incremental indexing — only changed files are embedded).
 *
 * A fetch failure throws: the incremental run must NOT advance its watermark
 * past a file it failed to embed (AC-5), so the caller retries the whole run.
 * @param token - GitHub access token
 * @param owner - Repository owner username
 * @param repo - Repository name
 * @param paths - File paths to fetch
 * @param ref - Commit SHA (or branch) to read from
 * @returns Promise resolving to array of file objects with path and content
 */
export async function getFileContentsAtRef(
	token: string,
	owner: string,
	repo: string,
	paths: string[],
	ref: string
): Promise<{ path: string; content: string }[]> {
	const octokit = await getOctokit({ token, owner, repo });
	const files: { path: string; content: string }[] = [];

	for (const path of paths) {
		const { data } = await octokit.rest.repos.getContent({
			owner,
			repo,
			path,
			ref,
		});

		if (!Array.isArray(data) && data.type === "file" && data.content) {
			files.push({
				path: data.path,
				content: Buffer.from(data.content, "base64").toString("utf-8"),
			});
		}
	}

	return files;
}

/**
 * Recursively fetches all file contents from a GitHub repository
 * @param token - GitHub access token
 * @param owner - Repository owner username
 * @param repo - Repository name
 * @param path - Directory path to start from (default: root)
 * @param ref - Optional commit SHA or branch to read from; defaults to the
 * default branch. Used by the incremental full re-index (Spec 0002) so the
 * index content and the watermark SHA stay consistent.
 * @returns Promise resolving to array of file objects with path and content
 */
export async function getRepoFileContents(
	token: string,
	owner: string,
	repo: string,
	path: string = "",
	ref?: string
): Promise<
	{
		path: string;
		content: string;
	}[]
> {
	const octokit = await getOctokit({ token, owner, repo });

	const { data } = await octokit.rest.repos.getContent({
		owner,
		repo,
		path,
		ref,
	});

	if (!Array.isArray(data)) {
		// It's a file
		if (data.type === "file" && data.content) {
			return [
				{
					path: data.path,
					content: Buffer.from(data.content, "base64").toString(
						"utf-8"
					),
				},
			];
		}
		return [];
	}

	let files: { path: string; content: string }[] = [];

	for (const item of data) {
		if (item.type === "file") {
			const { data: fileData } = await octokit.rest.repos.getContent({
				owner,
				repo,
				path: item.path,
				ref,
			});

			if (
				!Array.isArray(fileData) &&
				fileData.type === "file" &&
				fileData.content
			) {
				// Filter out non-code files if needed (images, etc)
				// For now lets include everything that looks like text
				if (
					!item.path.match(
						/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz)$/i
					)
				) {
					files.push({
						path: item.path,
						content: Buffer.from(
							fileData.content,
							"base64"
						).toString("utf-8"),
					});
				}
			}
		} else if (item.type === "dir") {
			const subFiles = await getRepoFileContents(
				token,
				owner,
				repo,
				item.path,
				ref
			);

			files = files.concat(subFiles);
		}
	}

	return files;
}
