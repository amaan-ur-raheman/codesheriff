import type { Octokit } from "octokit";
import {
  ReviewCapableProvider,
  VCSRepository,
  VCSFile,
  VCSPullRequest,
  ThreadComment,
  InlineReviewComment,
  CheckRunAnnotation,
  GitHubCredentials,
} from "./types";
import { getOctokit } from "../github/lib/auth";
import {
  postLoadingReviewComment as postLoadingReviewCommentHelper,
  updateReviewComment as updateReviewCommentHelper,
  updateReviewCommentFailed as updateReviewCommentFailedHelper,
  postCommentReply as postCommentReplyHelper,
  postInlineReviewComments as postInlineReviewCommentsHelper,
  getReviewCommentThread as getReviewCommentThreadHelper,
  getIssueCommentThread as getIssueCommentThreadHelper,
} from "../github/lib/comments";
import {
  updatePRCommitStatus as updatePRCommitStatusHelper,
  createPRCheckRun as createPRCheckRunHelper,
  updatePRCheckRun as updatePRCheckRunHelper,
} from "../github/lib/check-runs";
import { getCompareDiff as getCompareDiffHelper } from "../github/lib/diffs";

/**
 * Resolves the authenticated GitHub credentials for the current session:
 * a GitHub App installation Octokit when App credentials are configured for
 * the repository context, otherwise the user's OAuth access token client.
 */
export async function resolveGitHubCredentials(): Promise<GitHubCredentials> {
  const octokit = await getOctokit({});
  return { octokit };
}

export class GitHubProvider implements ReviewCapableProvider {
  name = "github" as const;
  private octokit: Octokit;

  constructor(octokit: Octokit) {
    this.octokit = octokit;
  }

  /**
   * Best-effort extraction of the access token from the injected client.
   * Returns undefined for GitHub App installation clients (whose auth()
   * returns an app descriptor without a plain token) — the delegated lib
   * helpers re-resolve credentials via getOctokit and prefer App auth when
   * env credentials + owner/repo are available, so a missing token here
   * is not a failure.
   */
  private async getToken(): Promise<string> {
    try {
      const auth = await this.octokit.auth();
      return (auth as { token?: string }).token ?? "";
    } catch {
      return "";
    }
  }

  async listRepositories(page = 1, perPage = 10): Promise<VCSRepository[]> {
    const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
      sort: "updated",
      direction: "desc",
      visibility: "all",
      per_page: perPage,
      page,
    });

    return data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      language: repo.language,
      stars: repo.stargazers_count,
      topics: (repo.topics as string[]) ?? [],
      defaultBranch: repo.default_branch,
      provider: "github" as const,
    }));
  }

  async getPullRequestDiff(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<VCSPullRequest> {
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    const { data: diff } = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: { format: "diff" },
    });

    return {
      number: pr.number,
      title: pr.title,
      description: pr.body ?? "",
      diff: diff as unknown as string,
      url: pr.html_url,
      state: pr.merged ? "merged" : pr.state === "closed" ? "closed" : "open",
    };
  }

  async postReviewComment(
    owner: string,
    repo: string,
    prNumber: number,
    comment: string
  ): Promise<void> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const isProdUrl = appUrl && !appUrl.includes("localhost") && !appUrl.includes("127.0.0.1");

    let footer = "*Powered By CodeSheriff*";
    if (isProdUrl) {
      const cleanUrl = appUrl.replace(/\/dashboard\/?$/, "");
      const logoUrl = `${cleanUrl}/logo.png`;
      footer = `<img src="${logoUrl}" width="32" height="32" align="left" style="margin-right: 8px;" /> *Powered By [CodeSheriff](${cleanUrl})*`;
    }

    await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `## 🤠 AI Code Review\n\n${comment}\n\n---\n${footer}`,
    });
  }

  async createWebhook(
    owner: string,
    repo: string,
    callbackUrl: string
  ): Promise<any> {
    try {
      const { data: hooks } = await this.octokit.rest.repos.listWebhooks({
        owner,
        repo,
      });

      const existing = hooks.find((h) => h.config.url === callbackUrl);
      if (existing) return existing;

      const { data } = await this.octokit.rest.repos.createWebhook({
        owner,
        repo,
        config: { url: callbackUrl, content_type: "json" },
        events: ["pull_request", "issue_comment", "pull_request_review_comment"],
      });

      return data;
    } catch (error: any) {
      console.warn(
        `[GitHubProvider] Failed to manage repository webhooks:`,
        error.message || error
      );
      // Fallback: return a simulated webhook object so connection can proceed
      return {
        id: -1,
        config: { url: callbackUrl },
        events: ["pull_request", "issue_comment", "pull_request_review_comment"],
        active: true,
      };
    }
  }

  async deleteWebhook(
    owner: string,
    repo: string,
    webhookId: string
  ): Promise<void> {
    try {
      const { data: hooks } = await this.octokit.rest.repos.listWebhooks({
        owner,
        repo,
      });

      const hook = hooks.find((h) => h.id === Number(webhookId));
      if (hook) {
        await this.octokit.rest.repos.deleteWebhook({
          owner,
          repo,
          hook_id: hook.id,
        });
      }
    } catch (error: any) {
      console.warn(
        `[GitHubProvider] Failed to delete webhook from repository:`,
        error.message || error
      );
    }
  }

  async getRepoFileContents(
    owner: string,
    repo: string,
    path = ""
  ): Promise<VCSFile[]> {
    return this.fetchFileContentsRecursive(owner, repo, path);
  }

  private async fetchFileContentsRecursive(
    owner: string,
    repo: string,
    path: string
  ): Promise<VCSFile[]> {
    const { data } = await this.octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });

    if (!Array.isArray(data)) {
      if (data.type === "file" && data.content) {
        return [
          {
            path: data.path,
            content: Buffer.from(data.content, "base64").toString("utf-8"),
          },
        ];
      }
      return [];
    }

    let files: VCSFile[] = [];

    for (const item of data) {
      if (item.type === "file") {
        const { data: fileData } = await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path: item.path,
        });

        if (
          !Array.isArray(fileData) &&
          fileData.type === "file" &&
          fileData.content &&
          !item.path.match(/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz)$/i)
        ) {
          files.push({
            path: item.path,
            content: Buffer.from(fileData.content, "base64").toString("utf-8"),
          });
        }
      } else if (item.type === "dir") {
        const subFiles = await this.fetchFileContentsRecursive(
          owner,
          repo,
          item.path
        );
        files = files.concat(subFiles);
      }
    }

    return files;
  }

  async getContributions(username: string): Promise<any> {
    const query = `
      query($username: String!) {
        user(login: $username) {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  contributionCount
                  date
                  color
                }
              }
            }
          }
        }
      }
    `;

    const response: any = await this.octokit.graphql(query, { username });

    if (!response.user) {
      throw new Error(`GitHub user '${username}' not found`);
    }

    return response.user.contributionsCollection.contributionCalendar;
  }

  async searchPullRequests(query: string, perPage = 10): Promise<any> {
    const { data } = await this.octokit.rest.search.issuesAndPullRequests({
      q: `${query} is:pr`,
      per_page: perPage,
    });

    return data.items.map((item) => ({
      number: item.number,
      title: item.title,
      url: item.html_url,
      state: item.state,
      repository: item.repository_url,
    }));
  }

  // ---------------------------------------------------------------------------
  // ReviewCapableProvider — check runs
  //
  // Advanced methods delegate to the shared github lib helpers (single source
  // of truth from #49) rather than calling this.octokit directly: the helpers
  // re-resolve credentials via getOctokit, preserving GitHub App auth
  // preference when env credentials + owner/repo are available.
  // ---------------------------------------------------------------------------

  async createPRCheckRun(
    owner: string,
    repo: string,
    sha: string
  ): Promise<number | null> {
    return createPRCheckRunHelper(await this.getToken(), owner, repo, sha);
  }

  async updatePRCheckRun(
    owner: string,
    repo: string,
    checkRunId: number,
    status: "completed",
    conclusion: "success" | "failure" | "cancelled" | "timed_out",
    summary: string,
    annotations?: CheckRunAnnotation[]
  ): Promise<void> {
    await updatePRCheckRunHelper(
      await this.getToken(),
      owner,
      repo,
      checkRunId,
      status,
      conclusion,
      summary,
      annotations
    );
  }

  // ---------------------------------------------------------------------------
  // ReviewCapableProvider — commit statuses
  // ---------------------------------------------------------------------------

  async updatePRCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    state: "pending" | "success" | "failure" | "error",
    description: string,
    targetUrl?: string
  ): Promise<void> {
    await updatePRCommitStatusHelper(
      await this.getToken(),
      owner,
      repo,
      sha,
      state,
      description,
      targetUrl
    );
  }

  // ---------------------------------------------------------------------------
  // ReviewCapableProvider — inline comments
  // ---------------------------------------------------------------------------

  async postInlineReviewComments(
    owner: string,
    repo: string,
    prNumber: number,
    comments: InlineReviewComment[]
  ): Promise<void> {
    await postInlineReviewCommentsHelper(
      await this.getToken(),
      owner,
      repo,
      prNumber,
      comments
    );
  }

  // ---------------------------------------------------------------------------
  // ReviewCapableProvider — comment lifecycle
  // ---------------------------------------------------------------------------

  async postLoadingReviewComment(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<number> {
    return postLoadingReviewCommentHelper(
      await this.getToken(),
      owner,
      repo,
      prNumber
    );
  }

  async updateReviewComment(
    owner: string,
    repo: string,
    commentId: number,
    review: string
  ): Promise<void> {
    await updateReviewCommentHelper(
      await this.getToken(),
      owner,
      repo,
      commentId,
      review
    );
  }

  async updateReviewCommentFailed(
    owner: string,
    repo: string,
    commentId: number,
    errorMessage: string
  ): Promise<void> {
    await updateReviewCommentFailedHelper(
      await this.getToken(),
      owner,
      repo,
      commentId,
      errorMessage
    );
  }

  async postCommentReply(
    owner: string,
    repo: string,
    prNumber: number,
    replyContent: string,
    commentId?: number,
    isReviewComment: boolean = false
  ): Promise<void> {
    await postCommentReplyHelper(
      await this.getToken(),
      owner,
      repo,
      prNumber,
      replyContent,
      commentId,
      isReviewComment
    );
  }

  // ---------------------------------------------------------------------------
  // ReviewCapableProvider — thread history
  // ---------------------------------------------------------------------------

  async getReviewCommentThread(
    owner: string,
    repo: string,
    prNumber: number,
    commentId: number
  ): Promise<ThreadComment[]> {
    return getReviewCommentThreadHelper(
      await this.getToken(),
      owner,
      repo,
      prNumber,
      commentId
    );
  }

  async getIssueCommentThread(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ThreadComment[]> {
    return getIssueCommentThreadHelper(
      await this.getToken(),
      owner,
      repo,
      prNumber
    );
  }

  // ---------------------------------------------------------------------------
  // ReviewCapableProvider — incremental diff
  // ---------------------------------------------------------------------------

  async getCompareDiff(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<string> {
    return getCompareDiffHelper(await this.getToken(), owner, repo, base, head);
  }
}
