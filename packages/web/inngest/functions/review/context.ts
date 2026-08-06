const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/dashboard\/?$/, "");

/** Canonical app base URL used for status targets and links. */
export const reviewAppUrl = appUrl;

/** Dashboard reviews listing URL used as the commit-status target. */
export const dashboardReviewsUrl = `${appUrl}/dashboard/reviews`;

/**
 * Typed context threaded through the review pipeline steps.
 *
 * Carries the resolved VCS provider plus PR metadata and credentials.
 * Today only the GitHub provider exists; ticket #54 wires the provider
 * resolution through the VCS factory.
 */
export interface ReviewContext {
	provider: "github" | "gitlab" | "bitbucket";
	owner: string;
	repo: string;
	prNumber: number;
	userId: string;
	before?: string;
	after?: string;
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
