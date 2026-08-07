import type { Octokit } from "octokit";

export interface VCSRepository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  language: string | null;
  stars: number;
  topics: string[];
  defaultBranch: string;
  provider: "github" | "gitlab" | "bitbucket";
}

export interface VCSFile {
  path: string;
  content: string;
}

export interface VCSPullRequest {
  number: number;
  title: string;
  description: string;
  diff: string;
  url: string;
  state: "open" | "closed" | "merged";
  /** Head commit SHA of the PR, used for check runs and commit statuses. */
  headSha?: string;
}

export interface VCSProvider {
  name: string;
  listRepositories(page?: number, perPage?: number): Promise<VCSRepository[]>;
  getPullRequestDiff(owner: string, repo: string, prNumber: number): Promise<VCSPullRequest>;
  postReviewComment(owner: string, repo: string, prNumber: number, comment: string): Promise<void>;
  createWebhook(owner: string, repo: string, callbackUrl: string): Promise<any>;
  deleteWebhook(owner: string, repo: string, webhookId: string): Promise<void>;
  getRepoFileContents(owner: string, repo: string, path?: string): Promise<VCSFile[]>;
  getContributions(username: string): Promise<any>;
  searchPullRequests(query: string, perPage?: number): Promise<any>;
}

// ---------------------------------------------------------------------------
// Advanced review capabilities
// ---------------------------------------------------------------------------

export type CommitStatusState = "pending" | "success" | "failure" | "error";

export type CheckRunConclusion = "success" | "failure" | "cancelled" | "timed_out";

export interface InlineReviewComment {
  path: string;
  line: number;
  body: string;
  side?: "LEFT" | "RIGHT";
  start_line?: number;
  start_side?: "LEFT" | "RIGHT";
}

export interface CheckRunAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: "notice" | "warning" | "failure";
  message: string;
  title?: string;
}

export interface ThreadComment {
  author: string;
  body: string | null;
  createdAt: string;
}

/**
 * A VCS provider that can drive the full AI review loop: check runs, commit
 * statuses, inline comments, comment lifecycle, thread history, and incremental
 * diffs on top of the base {@link VCSProvider} capabilities.
 *
 * Note: `getValidDiffLines` is intentionally NOT part of this interface — it is
 * a pure diff parser with no provider state, so it lives in the github lib.
 */
export interface ReviewCapableProvider extends VCSProvider {
  // Check runs
  createPRCheckRun(owner: string, repo: string, sha: string): Promise<number | null>;
  updatePRCheckRun(
    owner: string,
    repo: string,
    checkRunId: number,
    status: "completed",
    conclusion: CheckRunConclusion,
    summary: string,
    annotations?: CheckRunAnnotation[]
  ): Promise<void>;

  // Commit statuses
  updatePRCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    state: CommitStatusState,
    description: string,
    targetUrl?: string
  ): Promise<void>;

  // Inline comments
  postInlineReviewComments(
    owner: string,
    repo: string,
    prNumber: number,
    comments: InlineReviewComment[]
  ): Promise<void>;

  // Comment lifecycle
  postLoadingReviewComment(owner: string, repo: string, prNumber: number): Promise<number>;
  updateReviewComment(owner: string, repo: string, commentId: number, review: string): Promise<void>;
  updateReviewCommentFailed(
    owner: string,
    repo: string,
    commentId: number,
    errorMessage: string
  ): Promise<void>;
  postCommentReply(
    owner: string,
    repo: string,
    prNumber: number,
    replyContent: string,
    commentId?: number,
    isReviewComment?: boolean
  ): Promise<void>;

  // Thread history
  getReviewCommentThread(
    owner: string,
    repo: string,
    prNumber: number,
    commentId: number
  ): Promise<ThreadComment[]>;
  getIssueCommentThread(owner: string, repo: string, prNumber: number): Promise<ThreadComment[]>;

  // Incremental diff
  getCompareDiff(owner: string, repo: string, base: string, head: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// Resolved credentials per provider
// ---------------------------------------------------------------------------

export interface GitHubCredentials {
  octokit: Octokit;
}

export interface GitLabCredentials {
  token: string;
}

export interface BitbucketCredentials {
  token: string;
}
