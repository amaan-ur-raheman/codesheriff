import type { VerifyStatus } from "@/modules/ai/lib/suggestions";

/**
 * Shared rendering vocabulary for per-suggestion sandbox verification
 * outcomes. Consumed by the PR inline-comment builder (markdown) and the
 * dashboard review view (badges). "neutral" covers suggestions that were
 * never checked — e.g. posted unlabeled after a sandbox outage, or on
 * providers without sandbox capability.
 */

export type VerifyStatusView = VerifyStatus | "neutral";

export interface VerifyStatusMeta {
	status: VerifyStatusView;
	/** Human label, e.g. "Sandbox error". */
	label: string;
	/** Short markdown line for the PR inline comment ("" for neutral). */
	markdown: string;
	/** Tailwind classes for the dashboard badge. */
	badgeClassName: string;
}

export const VERIFY_STATUS_META: Record<VerifyStatusView, VerifyStatusMeta> = {
	verified: {
		status: "verified",
		label: "Verified",
		markdown: "> ✅ **Sandbox verified** — the suggested fix passed its checks.",
		badgeClassName:
			"border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
	},
	failed: {
		status: "failed",
		label: "Test Failed",
		markdown: "> ❌ **Test failed** — the suggested fix did not pass its checks.",
		badgeClassName: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400",
	},
	sandbox_error: {
		status: "sandbox_error",
		label: "Sandbox Error",
		markdown:
			"> ⚠️ **Sandbox error** — the change could not be verified (timeout or sandbox issue).",
		badgeClassName:
			"border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
	},
	neutral: {
		status: "neutral",
		label: "Not Checked",
		// Neutral suggestions render no status line on the PR comment.
		markdown: "",
		badgeClassName: "",
	},
};

/**
 * Resolves the view status of a suggestion, preferring the structured
 * verifyStatus written by the sandbox pipeline and falling back to the legacy
 * boolean `verified` flag for older reviews.
 */
export function resolveVerifyStatus(suggestion: {
	verifyStatus?: VerifyStatus;
	verified?: boolean;
}): VerifyStatusView {
	if (suggestion.verifyStatus) return suggestion.verifyStatus;
	if (suggestion.verified === true) return "verified";
	if (suggestion.verified === false) return "failed";
	return "neutral";
}

/** Markdown status line for a PR inline comment ("" when neutral). */
export function verifyStatusMarkdown(suggestion: {
	verifyStatus?: VerifyStatus;
	verified?: boolean;
	verifyError?: string;
}): string {
	const meta = VERIFY_STATUS_META[resolveVerifyStatus(suggestion)];
	if (!meta.markdown) return "";
	// The error is rendered inside a fenced block; strip backticks so sandbox
	// output can never break out of the fence (defense in depth — the runner
	// already caps the length).
	// Remove backticks entirely so no fence-breaking sequence can survive.
	const sanitizedError = suggestion.verifyError?.replace(/`/g, "") ?? "";
	const errorLine = sanitizedError
		? `\n\n<details><summary>Verification details</summary>\n\n\`\`\`\n${sanitizedError}\n\`\`\`\n</details>`
		: "";
	return `${meta.markdown}${errorLine}`;
}
