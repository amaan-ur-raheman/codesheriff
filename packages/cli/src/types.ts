export interface Repository {
	id: string;
	name: string;
	owner: string;
	fullName: string;
	url: string;
	openPrCount?: number;
}

export interface PullRequest {
	number: number;
	title: string;
	url: string;
	state: string;
}

export interface CodeSuggestion {
	id: string;
	filePath: string;
	startLine: number;
	endLine: number;
	severity: "error" | "warning" | "info" | "suggestion";
	title: string;
	description: string;
	originalCode: string;
	suggestedCode: string;
	category: string;
	verified?: boolean;
	verificationLog?: string;
}

export interface Review {
	id: string;
	prNumber: number;
	prTitle: string;
	prUrl: string;
	review: string;
	status: string;
	suggestions?: {
		suggestions: CodeSuggestion[];
		summary: {
			totalIssues: number;
			errors: number;
			warnings: number;
			suggestions: number;
		};
	};
}

export type ViewState = 
	| "landing"
	| "repo-list"
	| "pr-list"
	| "review-progress"
	| "review-layout";
