/**
 * Outcome of verifying a single suggestion inside the sandbox.
 *
 * - "verified"      — the suggested change applied and (when a test script
 *                     exists) the test suite passed
 * - "failed"        — the change applied but tests failed, or the original
 *                     code block could not be matched for applying
 * - "sandbox_error" — the sandbox itself misbehaved (timeout, memory limit,
 *                     lost connection); NOT a judgment on the suggestion
 */
export type VerifyStatus = "verified" | "failed" | "sandbox_error";

export interface VerificationResult {
	id: string;
	/** Backwards-compatible success flag (true only when status === "verified"). */
	success: boolean;
	/** Backwards-compatible error log (alias of verifyError). */
	errorLog?: string;
	verifyStatus?: VerifyStatus;
	verifyError?: string;
	verifyDurationMs?: number;
}
