import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { Octokit } from "octokit";
import { CodeSuggestion } from "./suggestions";

const execAsync = promisify(exec);

export interface VerificationResult {
	id: string;
	success: boolean;
	errorLog?: string;
}

/**
 * Verifies code suggestions in a temporary shallow checkout of the pull request branch.
 * Handles auto-detecting lockfiles (Bun vs npm), applying changes, executing tests,
 * and capturing any execution or test failures.
 */
export async function verifySuggestionsInSandbox(
	token: string,
	owner: string,
	repo: string,
	prNumber: number,
	suggestions: CodeSuggestion[]
): Promise<VerificationResult[]> {
	if (suggestions.length === 0) return [];

	const tempDir = path.join("/tmp", `codesheriff-sandbox-${Date.now()}`);
	const octokit = new Octokit({ auth: token });

	try {
		// 1. Fetch pull request details to get head branch information
		const { data: pr } = await octokit.rest.pulls.get({
			owner,
			repo,
			pull_number: prNumber,
		});

		const cloneUrl = pr.head.repo?.clone_url;
		const ref = pr.head.ref;

		if (!cloneUrl) {
			throw new Error("Repository clone URL not found");
		}

		// Inject token into clone URL
		const authenticatedUrl = cloneUrl.replace(
			"https://",
			`https://x-access-token:${token}@`
		);

		// 2. Shallow clone the specific branch
		await fs.mkdir(tempDir, { recursive: true });
		await execAsync(`git clone --depth 1 --branch ${ref} ${authenticatedUrl} ${tempDir}`);

		// Check if package.json has a test runner configured
		let hasTestScript = false;
		try {
			const pkgJsonContent = await fs.readFile(path.join(tempDir, "package.json"), "utf-8");
			const pkg = JSON.parse(pkgJsonContent);
			hasTestScript = !!pkg.scripts?.test;
		} catch {
			// Ignore if no package.json
		}

		const results: VerificationResult[] = [];

		// 3. Apply and run verification on each suggestion
		for (const suggestion of suggestions) {
			const filePath = path.join(tempDir, suggestion.filePath);

			try {
				let content = await fs.readFile(filePath, "utf-8");

				// Replace original block with suggested block
				const normalizedContent = content.replace(/\r\n/g, "\n");
				const normalizedOriginal = suggestion.originalCode.replace(/\r\n/g, "\n");
				const normalizedSuggested = suggestion.suggestedCode.replace(/\r\n/g, "\n");

				if (!normalizedContent.includes(normalizedOriginal)) {
					results.push({
						id: suggestion.id,
						success: false,
						errorLog: `Could not apply fix: Original code block mismatch in ${suggestion.filePath}`,
					});
					continue;
				}

				const updatedContent = normalizedContent.replace(
					normalizedOriginal,
					normalizedSuggested
				);

				await fs.writeFile(filePath, updatedContent, "utf-8");

				if (!hasTestScript) {
					results.push({
						id: suggestion.id,
						success: true,
					});
					// Restore original content
					await fs.writeFile(filePath, content, "utf-8");
					continue;
				}

				// Check lockfiles
				const useBun = await fs.access(path.join(tempDir, "bun.lock")).then(() => true).catch(() => false);
				const installCmd = useBun ? "bun install" : "npm install";
				const testCmd = useBun ? "bun test" : "npm run test";

				// Install node_modules inside the temp folder if they don't exist
				const nodeModulesExist = await fs.access(path.join(tempDir, "node_modules")).then(() => true).catch(() => false);
				if (!nodeModulesExist) {
					await execAsync(installCmd, { cwd: tempDir });
				}

				// Run tests
				await execAsync(testCmd, { cwd: tempDir });

				results.push({
					id: suggestion.id,
					success: true,
				});

				// Restore original content for next suggestion verification
				await fs.writeFile(filePath, content, "utf-8");
			} catch (err: any) {
				results.push({
					id: suggestion.id,
					success: false,
					errorLog: err.stderr || err.stdout || err.message || "Test run failed",
				});
				// Restore original content
				try {
					const originalFileContent = await octokit.rest.repos.getContent({
						owner,
						repo,
						path: suggestion.filePath,
						ref,
					});
					if (!Array.isArray(originalFileContent.data) && originalFileContent.data.type === "file" && originalFileContent.data.content) {
						const restored = Buffer.from(originalFileContent.data.content, "base64").toString("utf-8");
						await fs.writeFile(filePath, restored, "utf-8");
					}
				} catch {
					// Fallback: ignore
				}
			}
		}

		return results;
	} catch (error) {
		console.error("Sandbox verification execution error:", error);
		return suggestions.map((s) => ({
			id: s.id,
			success: false,
			errorLog: `Verification sandbox error: ${error instanceof Error ? error.message : "Unknown error"}`,
		}));
	} finally {
		// Clean up the temp sandbox folder
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch (cleanupError) {
			console.error("Failed to delete sandbox directory:", cleanupError);
		}
	}
}
