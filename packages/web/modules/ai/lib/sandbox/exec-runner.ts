import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { getOctokit } from "@/modules/github/lib/github";
import type { CodeSuggestion } from "../suggestions";
import type { SandboxConfig } from "./config";
import type { VerificationResult } from "./types";
import { buildGitCredentialHelperScript } from "./git-credential-helper";
import { assertSafeRepoPath } from "./paths";

const execAsync = promisify(exec);
const MAX_ERROR_LENGTH = 2000;

function isTimeoutError(err: any): boolean {
	// child_process exec with a timeout kills the process and sets
	// err.killed = true / err.signal = "SIGTERM".
	return Boolean(err?.killed) || err?.signal === "SIGTERM";
}

/**
 * In-process (exec-mode) verification — the hardened local-dev fallback.
 *
 * Same lifecycle as the E2B path: clone once via a git credential helper
 * (never a token in the URL or argv), install once, apply each suggestion's
 * diff and run tests, record per-suggestion outcomes, tear down.
 *
 * The timebox (SANDBOX_TIMEOUT_MS) and memory cap (SANDBOX_MAX_MEMORY_MB)
 * are enforced with exec timeouts and a ulimit guard; overruns map to
 * sandbox_error, not failed.
 */
export async function verifyInProcess(
	token: string,
	owner: string,
	repo: string,
	prNumber: number,
	suggestions: CodeSuggestion[],
	config: SandboxConfig
): Promise<VerificationResult[]> {
	if (suggestions.length === 0) return [];

	const tempDir = path.join(os.tmpdir(), `codesheriff-sandbox-${Date.now()}`);
	const helperPath = path.join(os.tmpdir(), `codesheriff-cred-helper-${Date.now()}.sh`);
	const octokit = await getOctokit({ token, owner, repo });
	const memoryKb = Math.max(64, config.maxMemoryMB) * 1024;

	try {
		// 1. Fetch pull request details to get head branch + plain clone URL.
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
		// The ref is interpolated into a shell command — validate it.
		if (!/^[a-zA-Z0-9._/\-]+$/.test(ref)) {
			throw new Error("Unsafe branch ref rejected");
		}

		// 2. Write the git credential helper (0700) — the token never appears
		//    in the clone URL, argv, or logs.
		await fs.writeFile(helperPath, buildGitCredentialHelperScript(token), {
			mode: 0o700,
		});

		// 3. Shallow clone the branch using the credential helper.
		await fs.mkdir(tempDir, { recursive: true });
		await execAsync(
			`git -c credential.helper=${helperPath} clone --depth 1 --branch ${ref} ${cloneUrl} ${tempDir}`,
			{ timeout: config.timeoutMs }
		);

		// Detect test runner + lockfile.
		let hasTestScript = false;
		let useBun = false;
		try {
			const pkgJsonContent = await fs.readFile(path.join(tempDir, "package.json"), "utf-8");
			const pkg = JSON.parse(pkgJsonContent);
			hasTestScript = !!pkg.scripts?.test;
		} catch {
			// No package.json — skip install/tests.
		}
		try {
			await fs.access(path.join(tempDir, "bun.lock"));
			useBun = true;
		} catch {
			useBun = false;
		}
		const installCmd = useBun ? "bun install" : "npm install";
		const testCmd = useBun ? "bun test" : "npm run test";

		const results: VerificationResult[] = [];

		// 4. Install once (before the suggestion loop).
		if (hasTestScript) {
			await execAsync(`ulimit -v ${memoryKb} 2>/dev/null; ${installCmd}`, {
				cwd: tempDir,
				timeout: config.timeoutMs,
			});
		}

		// 5. Apply + verify each suggestion in the same session.
		for (const suggestion of suggestions) {
			const startedAt = Date.now();

			try {
				// Suggestion paths are AI-generated — never let them escape the clone.
				assertSafeRepoPath(suggestion.filePath);
				const filePath = path.join(tempDir, suggestion.filePath);
				const content = await fs.readFile(filePath, "utf-8");

				const normalizedContent = content.replace(/\r\n/g, "\n");
				const normalizedOriginal = suggestion.originalCode.replace(/\r\n/g, "\n");
				const normalizedSuggested = suggestion.suggestedCode.replace(/\r\n/g, "\n");

				if (!normalizedContent.includes(normalizedOriginal)) {
					results.push({
						id: suggestion.id,
						success: false,
						errorLog: `Could not apply fix: Original code block mismatch in ${suggestion.filePath}`,
						verifyStatus: "failed",
						verifyError: `Could not apply fix: Original code block mismatch in ${suggestion.filePath}`,
						verifyDurationMs: Date.now() - startedAt,
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
						verifyStatus: "verified",
						verifyDurationMs: Date.now() - startedAt,
					});
					await fs.writeFile(filePath, content, "utf-8");
					continue;
				}

				try {
					await execAsync(`ulimit -v ${memoryKb} 2>/dev/null; ${testCmd}`, {
						cwd: tempDir,
						timeout: config.timeoutMs,
					});
					results.push({
						id: suggestion.id,
						success: true,
						verifyStatus: "verified",
						verifyDurationMs: Date.now() - startedAt,
					});
				} catch (testErr: any) {
					// Timeout / memory overrun is a sandbox error, not a failed suggestion.
					if (isTimeoutError(testErr)) {
						results.push({
							id: suggestion.id,
							success: false,
							errorLog: "Sandbox timed out",
							verifyStatus: "sandbox_error",
							verifyError: "Sandbox timed out",
							verifyDurationMs: Date.now() - startedAt,
						});
					} else {
						results.push({
							id: suggestion.id,
							success: false,
							errorLog: (testErr.stderr || testErr.stdout || testErr.message || "Test run failed").slice(
								0,
								MAX_ERROR_LENGTH
							),
							verifyStatus: "failed",
							verifyError: (
								testErr.stderr ||
								testErr.stdout ||
								testErr.message ||
								"Test run failed"
							).slice(0, MAX_ERROR_LENGTH),
							verifyDurationMs: Date.now() - startedAt,
						});
					}
				}

				// Restore original content for the next suggestion.
				await fs.writeFile(filePath, content, "utf-8");
			} catch (fileErr: any) {
				results.push({
					id: suggestion.id,
					success: false,
					errorLog: (fileErr.message || "Could not read file").slice(0, MAX_ERROR_LENGTH),
					verifyStatus: "failed",
					verifyError: (fileErr.message || "Could not read file").slice(0, MAX_ERROR_LENGTH),
					verifyDurationMs: Date.now() - startedAt,
				});
			}
		}

		return results;
	} catch (error) {
		// Setup/clone/install-level failure. Unlike the E2B path (which throws
		// SandboxUnavailableError so suggestions are posted unlabeled), the
		// local exec path intentionally labels every suggestion sandbox_error:
		// it is a local-dev debugging tool where that signal is the useful one.
		console.error("Sandbox verification execution error:", error);
		return suggestions.map((s) => ({
			id: s.id,
			success: false,
			errorLog: `Verification sandbox error: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
			verifyStatus: "sandbox_error" as const,
			verifyError: error instanceof Error ? error.message : "Unknown error",
		}));
	} finally {
		// Clean up temp dir + credential helper (token never left on disk).
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch (cleanupError) {
			console.error("Failed to delete sandbox directory:", cleanupError);
		}
		try {
			await fs.rm(helperPath, { force: true });
		} catch {
			// Best-effort cleanup.
		}
	}
}
