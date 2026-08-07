import type { CodeSuggestion } from "../suggestions";
import { getSandboxConfig } from "./config";
import { verifyWithE2B, SandboxUnavailableError } from "./e2b-runner";
import { verifyInProcess } from "./exec-runner";

export type { VerificationResult, VerifyStatus } from "./types";
export { SandboxUnavailableError };
export { getSandboxConfig } from "./config";
export type { SandboxConfig, SandboxMode } from "./config";

/**
 * Verifies each parsed suggestion in an isolated sandbox and returns
 * per-suggestion outcomes (verified / failed / sandbox_error).
 *
 * SANDBOX_MODE selects the backend:
 *   - "sandbox" (default): E2B cloud sandbox — one sandbox per review
 *   - "exec": hardened in-process child-process verification (local dev)
 *
 * When the sandbox itself is unavailable (no E2B_API_KEY, provisioning
 * failure, clone failure) this throws {@link SandboxUnavailableError}; callers
 * must catch it and post suggestions unlabeled — the review never fails.
 */
export async function verifySuggestionsInSandbox(
	token: string,
	owner: string,
	repo: string,
	prNumber: number,
	suggestions: CodeSuggestion[]
) {
	const config = getSandboxConfig();
	if (config.mode === "sandbox") {
		return verifyWithE2B(token, owner, repo, prNumber, suggestions, config);
	}
	return verifyInProcess(token, owner, repo, prNumber, suggestions, config);
}
