import { Octokit } from "octokit";
import { VCSProvider, VCSRepository, VCSFile, VCSPullRequest } from "./types";

export class GitHubProvider implements VCSProvider {
  name = "github" as const;
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
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
    await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `## 🤖 AI Code Review\n\n${comment}\n\n---\n*Powered By CodeSheriff*`,
    });
  }

  async createWebhook(
    owner: string,
    repo: string,
    callbackUrl: string
  ): Promise<any> {
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
  }

  async deleteWebhook(
    owner: string,
    repo: string,
    webhookId: string
  ): Promise<void> {
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
}
