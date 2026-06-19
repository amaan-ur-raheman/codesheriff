import { VCSProvider, VCSRepository, VCSFile, VCSPullRequest } from "./types";

const BITBUCKET_API_BASE = "https://api.bitbucket.org/2.0";

export class BitbucketProvider implements VCSProvider {
  name = "bitbucket" as const;
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(this.token).toString("base64")}`;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${BITBUCKET_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bitbucket API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listRepositories(page = 1, perPage = 10): Promise<VCSRepository[]> {
    const data = await this.request<any>(
      `/repositories?role=member&sort=-updated_on&pagelen=${perPage}&page=${page}`
    );

    return (data.values ?? []).map((repo: any) => ({
      id: this.hashStringToId(repo.full_name),
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description ?? null,
      url: repo.links.html.href,
      language: repo.language ?? null,
      stars: repo.stars_count ?? 0,
      topics: [],
      defaultBranch: repo.mainbranch?.name ?? "main",
      provider: "bitbucket" as const,
    }));
  }

  async getPullRequestDiff(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<VCSPullRequest> {
    const pr = await this.request<any>(
      `/repositories/${owner}/${repo}/pullrequests/${prNumber}`
    );

    const diffResponse = await fetch(
      `${BITBUCKET_API_BASE}/repositories/${owner}/${repo}/pullrequests/${prNumber}/diff`,
      {
        headers: {
          Authorization: this.authHeader,
          Accept: "text/plain",
        },
      }
    );

    if (!diffResponse.ok) {
      const errorText = await diffResponse.text();
      throw new Error(`Failed to fetch diff (${diffResponse.status}): ${errorText}`);
    }

    const diff = await diffResponse.text();

    return {
      number: pr.id,
      title: pr.title,
      description: pr.description ?? "",
      diff,
      url: pr.links.html.href,
      state: pr.state === "MERGED" ? "merged" : pr.state === "CLOSED" ? "closed" : "open",
    };
  }

  async postReviewComment(
    owner: string,
    repo: string,
    prNumber: number,
    comment: string
  ): Promise<void> {
    await this.request(
      `/repositories/${owner}/${repo}/pullrequests/${prNumber}/comments`,
      {
        method: "POST",
        body: JSON.stringify({
          content: {
            raw: `## 🤖 AI Code Review\n\n${comment}\n\n---\n*Powered By CodeHorse*`,
          },
        }),
      }
    );
  }

  async createWebhook(
    owner: string,
    repo: string,
    callbackUrl: string
  ): Promise<any> {
    const data = await this.request<any>(
      `/repositories/${owner}/${repo}/hooks`,
      {
        method: "POST",
        body: JSON.stringify({
          description: "CodeHorse Webhook",
          url: callbackUrl,
          events: ["pullrequest:created", "pullrequest:updated"],
        }),
      }
    );

    return data;
  }

  async deleteWebhook(
    owner: string,
    repo: string,
    webhookId: string
  ): Promise<void> {
    await this.request(
      `/repositories/${owner}/${repo}/hooks/${webhookId}`,
      { method: "DELETE" }
    );
  }

  async getRepoFileContents(
    owner: string,
    repo: string,
    path = ""
  ): Promise<VCSFile[]> {
    const ref = "main";
    const encodedPath = path ? `/${encodeURIComponent(path)}` : "";

    const data = await this.request<any>(
      `/repositories/${owner}/${repo}/src/${ref}${encodedPath}`
    );

    let files: VCSFile[] = [];

    if (data.type === "commit_file") {
      if (!data.path.match(/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz)$/i)) {
        files.push({ path: data.path, content: data.data ?? "" });
      }
      return files;
    }

    const entries = data.values ?? [];
    for (const entry of entries) {
      if (entry.type === "commit_file") {
        if (!entry.path.match(/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz)$/i)) {
          try {
            const content = await this.request<string>(
              `/repositories/${owner}/${repo}/src/${ref}/${encodeURIComponent(entry.path)}`,
              { headers: { Accept: "text/plain" } } as any
            );
            files.push({ path: entry.path, content: content as unknown as string });
          } catch {
            // Skip binary or unreadable files
          }
        }
      } else if (entry.type === "commit_directory") {
        const subFiles = await this.getRepoFileContents(owner, repo, entry.path);
        files = files.concat(subFiles);
      }
    }

    return files;
  }

  async getContributions(username: string): Promise<any> {
    const data = await this.request<any>(
      `/repositories/${username}?role=member&sort=-updated_on&pagelen=100`
    );

    const repos = data.values ?? [];
    let totalContributions = 0;
    const calendar: Record<string, number> = {};

    for (const repo of repos) {
      try {
        const activity = await this.request<any>(
          `/repositories/${repo.full_name}/commits?pagelen=100`
        );

        for (const commit of activity.values ?? []) {
          if (commit.author?.user?.username === username) {
            const date = commit.date?.split("T")[0];
            if (date) {
              totalContributions++;
              calendar[date] = (calendar[date] || 0) + 1;
            }
          }
        }
      } catch {
        // Skip private repos or repos without access
      }
    }

    return {
      totalContributions,
      calendar,
    };
  }

  async searchPullRequests(query: string, perPage = 10): Promise<any> {
    const data = await this.request<any>(
      `/search/code?search_click=true&q=${encodeURIComponent(query)}&type=code&pagelen=${perPage}`
    );

    return (data.values ?? []).map((pr: any) => ({
      number: pr.id,
      title: pr.title,
      url: pr.links.html.href,
      state: pr.state.toLowerCase(),
      repository: pr.repository?.full_name ?? "",
    }));
  }

  private hashStringToId(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
