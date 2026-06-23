"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Octokit } from "octokit";

export async function getReviews() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		throw new Error("Unauthorized");
	}

	const reviews = await prisma.review.findMany({
		where: {
			repository: {
				userId: session.user.id,
			},
		},
		include: {
			repository: true,
		},
		orderBy: {
			createdAt: "desc",
		},
		take: 50,
	});

	return reviews;
}

export async function applySuggestion(reviewId: string, suggestionId: string) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	// 1. Fetch review and repository details
	const review = await prisma.review.findFirst({
		where: {
			id: reviewId,
			repository: {
				userId: session.user.id,
			},
		},
		include: {
			repository: {
				include: {
					user: {
						include: {
							accounts: {
								where: { providerId: "github" },
							},
						},
					},
				},
			},
		},
	});

	if (!review) throw new Error("Review not found");
	const githubAccount = review.repository.user.accounts[0];
	if (!githubAccount?.accessToken) throw new Error("GitHub access token not found");

	// 2. Find suggestion inside the saved JSON suggestions block
	const suggestionsData = review.suggestions as any;
	if (!suggestionsData || !Array.isArray(suggestionsData.suggestions)) {
		throw new Error("No structured suggestions found for this review");
	}

	const suggestionsList = [...suggestionsData.suggestions];
	const suggestionIdx = suggestionsList.findIndex((s: any) => s.id === suggestionId);
	if (suggestionIdx === -1) throw new Error("Suggestion not found");

	const suggestion = suggestionsList[suggestionIdx];
	if (suggestion.applied) {
		throw new Error("Suggestion has already been applied");
	}

	const token = githubAccount.accessToken;
	const { owner, name: repo } = review.repository;
	const prNumber = review.prNumber;

	// 3. Fetch PR info from GitHub to find the head branch branch
	const octokit = new Octokit({ auth: token });
	const { data: pr } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: prNumber,
	});

	const branch = pr.head.ref;
	const headRepoOwner = pr.head.repo?.owner?.login || owner;
	const headRepoName = pr.head.repo?.name || repo;

	// 4. Fetch the target file content from GitHub for the PR branch
	const { data: fileData } = (await octokit.rest.repos.getContent({
		owner: headRepoOwner,
		repo: headRepoName,
		path: suggestion.filePath,
		ref: branch,
	})) as any;

	if (Array.isArray(fileData)) {
		throw new Error("Target path is a directory, not a file");
	}

	const currentContent = Buffer.from(fileData.content, "base64").toString("utf-8");

	// 5. Replace original code with suggested code
	const original = suggestion.originalCode || "";
	const replacement = suggestion.suggestedCode || "";

	const lines = currentContent.split(/\r?\n/);
	let newContent: string;

	if (suggestion.startLine > 0 && suggestion.startLine <= lines.length) {
		const startIdx = Math.max(0, suggestion.startLine - 1);
		const endIdx = Math.min(lines.length, suggestion.endLine || suggestion.startLine);
		
		const targetSection = lines.slice(startIdx, endIdx).join("\n").trim();
		const normalizedOriginal = original.trim();

		// Check if the lines match the originalCode we expect
		if (
			targetSection === normalizedOriginal ||
			targetSection.replace(/\s+/g, "") === normalizedOriginal.replace(/\s+/g, "")
		) {
			const updatedLines = [...lines];
			updatedLines.splice(startIdx, endIdx - startIdx, ...replacement.split(/\r?\n/));
			newContent = updatedLines.join("\n");
		} else if (currentContent.includes(original)) {
			// Fallback to exact match text replace if lines shifted
			newContent = currentContent.replace(original, () => replacement);
		} else {
			throw new Error("Target file content does not match the original suggestion. It may have been modified.");
		}
	} else if (currentContent.includes(original)) {
		newContent = currentContent.replace(original, () => replacement);
	} else {
		throw new Error("Could not find the original code block to replace.");
	}

	// 6. Commit the file update back to GitHub
	await octokit.rest.repos.createOrUpdateFileContents({
		owner: headRepoOwner,
		repo: headRepoName,
		path: suggestion.filePath,
		message: `Apply CodeSheriff suggestion: ${suggestion.title || "improve code"}`,
		content: Buffer.from(newContent).toString("base64"),
		sha: fileData.sha,
		branch: branch,
	});

	// 7. Update database to mark this suggestion as applied
	suggestionsList[suggestionIdx] = {
		...suggestion,
		applied: true,
	};

	await prisma.review.update({
		where: { id: reviewId },
		data: {
			suggestions: {
				...suggestionsData,
				suggestions: suggestionsList,
			},
		},
	});

	return { success: true };
}

export async function applySuggestionsBatch(reviewId: string, suggestionIds: string[]) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	if (!suggestionIds || suggestionIds.length === 0) {
		throw new Error("No suggestions provided to apply");
	}

	// 1. Fetch review and repository details
	const review = await prisma.review.findFirst({
		where: {
			id: reviewId,
			repository: {
				userId: session.user.id,
			},
		},
		include: {
			repository: {
				include: {
					user: {
						include: {
							accounts: {
								where: { providerId: "github" },
							},
						},
					},
				},
			},
		},
	});

	if (!review) throw new Error("Review not found");
	const githubAccount = review.repository.user.accounts[0];
	if (!githubAccount?.accessToken) throw new Error("GitHub access token not found");

	// 2. Find suggestions inside JSON
	const suggestionsData = review.suggestions as any;
	if (!suggestionsData || !Array.isArray(suggestionsData.suggestions)) {
		throw new Error("No structured suggestions found for this review");
	}

	const suggestionsList = [...suggestionsData.suggestions];
	const selectedSuggestions = suggestionsList.filter(
		(s: any) => suggestionIds.includes(s.id) && !s.applied
	);

	if (selectedSuggestions.length === 0) {
		throw new Error("No unapplied suggestions found in the batch");
	}

	const token = githubAccount.accessToken;
	const { owner, name: repo } = review.repository;
	const prNumber = review.prNumber;

	// 3. Fetch PR info from GitHub to find the head branch branch
	const octokit = new Octokit({ auth: token });
	const { data: pr } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: prNumber,
	});

	const branch = pr.head.ref;
	const headRepoOwner = pr.head.repo?.owner?.login || owner;
	const headRepoName = pr.head.repo?.name || repo;

	// 4. Group suggestions by file path
	const suggestionsByFile: Record<string, typeof selectedSuggestions> = {};
	for (const s of selectedSuggestions) {
		if (!suggestionsByFile[s.filePath]) {
			suggestionsByFile[s.filePath] = [];
		}
		suggestionsByFile[s.filePath].push(s);
	}

	// 5. Apply suggestions file by file
	for (const filePath of Object.keys(suggestionsByFile)) {
		const fileSuggestions = suggestionsByFile[filePath];
		
		// Sort descending by line number to prevent line shift issues
		fileSuggestions.sort((a, b) => (b.startLine || 0) - (a.startLine || 0));

		// Fetch file content
		const { data: fileData } = (await octokit.rest.repos.getContent({
			owner: headRepoOwner,
			repo: headRepoName,
			path: filePath,
			ref: branch,
		})) as any;

		if (Array.isArray(fileData)) {
			throw new Error(`Target path ${filePath} is a directory, not a file`);
		}

		let fileContent = Buffer.from(fileData.content, "base64").toString("utf-8");

		// Apply all changes sequentially from bottom to top
		for (const suggestion of fileSuggestions) {
			const original = suggestion.originalCode || "";
			const replacement = suggestion.suggestedCode || "";

			const lines = fileContent.split(/\r?\n/);

			if (suggestion.startLine > 0 && suggestion.startLine <= lines.length) {
				const startIdx = Math.max(0, suggestion.startLine - 1);
				const endIdx = Math.min(lines.length, suggestion.endLine || suggestion.startLine);
				
				const targetSection = lines.slice(startIdx, endIdx).join("\n").trim();
				const normalizedOriginal = original.trim();

				if (
					targetSection === normalizedOriginal ||
					targetSection.replace(/\s+/g, "") === normalizedOriginal.replace(/\s+/g, "")
				) {
					const updatedLines = [...lines];
					updatedLines.splice(startIdx, endIdx - startIdx, ...replacement.split(/\r?\n/));
					fileContent = updatedLines.join("\n");
				} else if (fileContent.includes(original)) {
					fileContent = fileContent.replace(original, replacement);
				} else {
					throw new Error(`Content mismatch in ${filePath} for suggestion: ${suggestion.title}`);
				}
			} else if (fileContent.includes(original)) {
				fileContent = fileContent.replace(original, replacement);
			} else {
				throw new Error(`Could not find suggestion snippet in ${filePath}`);
			}
		}

		// Commit the updated file content to GitHub
		await octokit.rest.repos.createOrUpdateFileContents({
			owner: headRepoOwner,
			repo: headRepoName,
			path: filePath,
			message: `Apply CodeSheriff suggestions batch (${fileSuggestions.length} changes)`,
			content: Buffer.from(fileContent).toString("base64"),
			sha: fileData.sha,
			branch: branch,
		});
	}

	// 6. Update database to mark these suggestions as applied
	const updatedSuggestionsList = suggestionsList.map((s: any) => {
		if (suggestionIds.includes(s.id)) {
			return { ...s, applied: true };
		}
		return s;
	});

	await prisma.review.update({
		where: { id: reviewId },
		data: {
			suggestions: {
				...suggestionsData,
				suggestions: updatedSuggestionsList,
			},
		},
	});

	return { success: true };
}
