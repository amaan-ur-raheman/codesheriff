import { Sandbox, TimeoutError, FileNotFoundError } from "e2b";
import { getOctokit } from "@/modules/github/lib/github";
import type { CodeSuggestion } from "../suggestions";
import type { SandboxConfig } from "./config";
import type { VerificationResult } from "./types";
import { buildGitCredentialHelperScript } from "./git-credential-helper";

/**
 * Thrown when the E2B sandbox cannot be provisioned or the review cannot be
 * set up inside it (no API key, API/auth failure, clone failure). The caller
 * treats this as "sandbox unavailable" — suggestions are posted unlabeled and
 * the review never fails.
 */
export class SandboxUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SandboxUnavailableError";
	}
}

const REPO_DIR = "/repo";
const HELPER_PATH = "/tmp/git-credential-helper.sh";
const MAX_ERROR_LENGTH = 2000;

async function fileExists(sandbox: Sandbox, path: string): Promise<boolean> {
	try {
		const res = await sandbox.commands.run(`test -f ${path} && echo yes`);
		return res.stdout.trim() === "yes";
	} catch {
		return false;
	}
}

/**
 * Verifies suggestions inside a single E2B cloud sandbox.
 *
 * Lifecycle: create one sandbox → clone once via a git credential helper
 * (token never in the URL or argv) → install dependencies once → for each
 * suggestion apply its diff, run the test suite, record the outcome, restore
 * the file → kill the sandbox.
 *
 * - Test failure → "failed" (the suggestion is judged on its own merits)
 * - Timeout / sandbox failure → "sandbox_error" (not a verdict on the code)
 * - Sandbox unavailable → throws SandboxUnavailableError so the caller posts
 *   suggestions unlabeled and the review succeeds.
 */
export async function verifyWithE2B(
	token: string,
	owner: string,
	repo: string,
	prNumber: number,
	suggestions: CodeSuggestion[],
	config: SandboxConfig
): Promise<VerificationResult[]> {
	if (suggestions.length === 0) return [];
	if (!config.e2bApiKey) {
		throw new SandboxUnavailableError("E2B_API_KEY is not set");
	}

	// Resolve the head branch + plain clone URL. The token is NOT embedded in
	// the URL — authentication happens through the credential helper below.
	const octokit = await getOctokit({ token, owner, repo });
	const { data: pr } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: prNumber,
	});
	const cloneUrl = pr.head.repo?.clone_url;
	const ref = pr.head.ref;
	if (!cloneUrl) {
		throw new SandboxUnavailableError("Repository clone URL not found");
	}
	// The ref is interpolated into a shell command — validate it to keep the
	// credential-hygiene posture of this module airtight.
	if (!/^[a-zA-Z0-9._/\-]+$/.test(ref)) {
		throw new SandboxUnavailableError("Unsafe branch ref rejected");
	}

	let sandbox: Sandbox;
	try {
		sandbox = await Sandbox.create({
			timeoutMs: config.timeoutMs,
			metadata: {
				app: "codesheriff",
				owner,
				repo,
				maxMemoryMB: String(config.maxMemoryMB),
			},
		});
	} catch (err) {
		throw new SandboxUnavailableError(
			`E2B sandbox unavailable: ${err instanceof Error ? err.message : "unknown error"}`
		);
	}

	try {
		// Clone once via a git credential helper — the token only ever lives
		// inside the helper file (0700) inside the ephemeral sandbox.
		await sandbox.files.write(HELPER_PATH, buildGitCredentialHelperScript(token));
		await sandbox.commands.run(`chmod 700 ${HELPER_PATH}`);
		await sandbox.commands.run(`git config --global credential.helper ${HELPER_PATH}`);

		const cloneRes = await sandbox.commands.run(
			`git clone --depth 1 --branch ${ref} ${cloneUrl} ${REPO_DIR}`,
			{ timeoutMs: config.timeoutMs }
		);
		if (cloneRes.exitCode !== 0) {
			throw new SandboxUnavailableError(
				`Clone failed: ${(cloneRes.stderr || cloneRes.stdout).slice(0, MAX_ERROR_LENGTH)}`
			);
		}

		// Detect test script + lockfile; install once.
		let hasTestScript = false;
		try {
			const pkgJson = await sandbox.files.read(`${REPO_DIR}/package.json`);
			const pkg = JSON.parse(pkgJson);
			hasTestScript = Boolean(pkg.scripts?.test);
		} catch {
			// No package.json — skip install/tests.
		}

		const hasBunLock = await fileExists(sandbox, `${REPO_DIR}/bun.lock`);
		const installCmd = hasBunLock ? "bun install" : "npm install";
		const testCmd = hasBunLock ? "bun test" : "npm run test";

		if (hasTestScript) {
			const installRes = await sandbox.commands.run(`cd ${REPO_DIR} && ${installCmd}`, {
				timeoutMs: config.timeoutMs,
			});
			if (installRes.exitCode !== 0) {
				throw new SandboxUnavailableError(
					`Dependency install failed: ${(installRes.stderr || installRes.stdout).slice(0, MAX_ERROR_LENGTH)}`
				);
			}
		}

		const results: VerificationResult[] = [];

		for (const suggestion of suggestions) {
			const startedAt = Date.now();
			const record = (partial: {
				verifyStatus: VerificationResult["verifyStatus"];
				verifyError?: string;
			}) => {
				results.push({
					id: suggestion.id,
					success: partial.verifyStatus === "verified",
					errorLog: partial.verifyError,
					verifyDurationMs: Date.now() - startedAt,
					...partial,
				});
			};

			let editedFile = false;
			let pristineContent = "";

			try {
				const filePath = `${REPO_DIR}/${suggestion.filePath}`;
				const content = await sandbox.files.read(filePath);
				pristineContent = content;
				const normalizedContent = content.replace(/\r\n/g, "\n");
				const normalizedOriginal = suggestion.originalCode.replace(/\r\n/g, "\n");
				const normalizedSuggested = suggestion.suggestedCode.replace(/\r\n/g, "\n");

				if (!normalizedContent.includes(normalizedOriginal)) {
					record({
						verifyStatus: "failed",
						verifyError: `Could not apply fix: Original code block mismatch in ${suggestion.filePath}`,
					});
					continue;
				}

				const updatedContent = normalizedContent.replace(
					normalizedOriginal,
					normalizedSuggested
				);
				await sandbox.files.write(filePath, updatedContent);
				editedFile = true;

				if (!hasTestScript) {
					record({ verifyStatus: "verified" });
					continue;
				}

				const testRes = await sandbox.commands.run(`cd ${REPO_DIR} && ${testCmd}`, {
					timeoutMs: config.timeoutMs,
				});
				if (testRes.exitCode === 0) {
					record({ verifyStatus: "verified" });
				} else {
					record({
						verifyStatus: "failed",
						verifyError: (testRes.stderr || testRes.stdout || "Tests failed").slice(
							0,
							MAX_ERROR_LENGTH
						),
					});
				}
			} catch (err) {
				// Timeout and any sandbox-level failure are sandbox errors,
				// never a verdict on the suggestion itself.
				record({
					verifyStatus: "sandbox_error",
					verifyError:
						err instanceof TimeoutError
							? "Sandbox timed out"
							: err instanceof FileNotFoundError
								? `Could not apply fix: File not found in ${suggestion.filePath}`
								: `Sandbox error: ${err instanceof Error ? err.message : "unknown error"}`,
				});
			} finally {
				// Restore the pristine file so the next suggestion is verified
				// against the untouched clone — mirroring the exec path.
				if (editedFile) {
					await sandbox.files
						.write(`${REPO_DIR}/${suggestion.filePath}`, pristineContent)
						.catch(() => {
							// Sandbox may be gone; nothing to restore.
						});
				}
			}
		}

		return results;
	} finally {
		await sandbox.kill().catch(() => {
			// Sandbox already gone — nothing to clean up.
		});
	}
}
