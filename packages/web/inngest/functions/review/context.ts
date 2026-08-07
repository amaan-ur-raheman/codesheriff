const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/dashboard\/?$/, "");

/** Canonical app base URL used for status targets and links. */
export const reviewAppUrl = appUrl;

/** Dashboard reviews listing URL used as the commit-status target. */
export const dashboardReviewsUrl = `${appUrl}/dashboard/reviews`;

import type { VCSProvider } from "@/modules/vcs/types";

/**
 * Typed context threaded through the review pipeline steps.
 *
 * Carries the resolved VCS provider instance (from the shared factory via
 * `resolveProviderForRepository`) plus PR metadata. Steps call provider
 * methods through the abstraction instead of importing GitHub helpers
 * directly; capabilities are checked with `isReviewCapableProvider`.
 */
export interface ReviewContext {
	provider: VCSProvider;
	providerType: "github" | "gitlab" | "bitbucket";
	owner: string;
	repo: string;
	prNumber: number;
	userId: string;
	before?: string;
	after?: string;
	/** Resolved access token from the shared resolve helper (used by the sandbox verifier). */
	token: string;
	diff: string;
	title: string;
	description: string | null;
	headSha: string;
	checkRunId: number | null;
	loadingCommentId: number | null;
}

export interface ParsedSuggestions {
	suggestions: any[];
	summary?: {
		totalIssues: number;
		errors: number;
		warnings: number;
		suggestions: number;
	};
}
