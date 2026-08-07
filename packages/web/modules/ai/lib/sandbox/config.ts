/**
 * Sandbox configuration.
 *
 * SANDBOX_MODE selects the verification backend:
 *   - "sandbox" (default, production) — E2B cloud sandbox, isolated per review
 *   - "exec" (local dev only) — hardened in-process child-process verification
 *
 * E2B enforces memory at the *template* level (the SDK has no per-sandbox
 * memory option), so SANDBOX_MAX_MEMORY_MB is honored by the exec path via a
 * `ulimit` guard and documented for operators choosing an E2B template.
 */

export type SandboxMode = "sandbox" | "exec";

export interface SandboxConfig {
	mode: SandboxMode;
	/** Timebox for the whole verification run, in milliseconds. Default 120000. */
	timeoutMs: number;
	/** Memory cap in MB. Default 512. */
	maxMemoryMB: number;
	/** E2B API key; required when mode === "sandbox". */
	e2bApiKey?: string;
}

export function getSandboxConfig(env: Record<string, string | undefined> = process.env): SandboxConfig {
	const mode: SandboxMode = env.SANDBOX_MODE === "exec" ? "exec" : "sandbox";
	const timeoutMs = parseInt(env.SANDBOX_TIMEOUT_MS ?? "", 10) || 120_000;
	const maxMemoryMB = parseInt(env.SANDBOX_MAX_MEMORY_MB ?? "", 10) || 512;
	return { mode, timeoutMs, maxMemoryMB, e2bApiKey: env.E2B_API_KEY };
}
