import { VCSProvider, VCSRepository, VCSFile, VCSPullRequest } from "./types";

const GITLAB_API_BASE = "https://gitlab.com/api/v4";

export class GitLabProvider implements VCSProvider {
  name = "gitlab" as const;
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${GITLAB_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitLab API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listRepositories(page = 1, perPage = 10): Promise<VCSRepository[]> {
    const data = await this.request<any[]>(
      `/projects?membership=true&order_by=last_activity_at&sort=desc&per_page=${perPage}&page=${page}`
    );

    return data.map((project) => ({
      id: project.id,
      name: project.name,
      fullName: project.path_with_namespace,
      description: project.description,
      url: project.web_url,
      language: project.language,
      stars: project.star_count,
      topics: project.topics ?? [],
      defaultBranch: project.default_branch ?? "main",
      provider: "gitlab" as const,
    }));
  }

  async getPullRequestDiff(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<VCSPullRequest> {
    const projectId = encodeURIComponent(`${owner}/${repo}`);

    const mr = await this.request<any>(
      `/projects/${projectId}/merge_requests/${prNumber}`
    );

    const changes = await this.request<any>(
      `/projects/${projectId}/merge_requests/${prNumber}/changes`
    );

    const diff = (changes.changes ?? [])
      .map(
        (change: any) =>
          `diff --git a/${change.old_path} b/${change.new_path}\n` +
          `--- a/${change.old_path}\n` +
          `+++ b/${change.new_path}\n` +
          `${change.diff}`
      )
      .join("\n");

    return {
      number: mr.iid,
      title: mr.title,
      description: mr.description ?? "",
      diff,
      url: mr.web_url,
      state: mr.state === "merged" ? "merged" : mr.state === "closed" ? "closed" : "open",
    };
  }

  async postReviewComment(
    owner: string,
    repo: string,
    prNumber: number,
    comment: string
  ): Promise<void> {
    const projectId = encodeURIComponent(`${owner}/${repo}`);

    await this.request(`/projects/${projectId}/merge_requests/${prNumber}/notes`, {
      method: "POST",
      body: JSON.stringify({
        body: `## 🤖 AI Code Review\n\n${comment}\n\n---\n*Powered By CodeHorse*`,
      }),
    });
  }

  async createWebhook(
    owner: string,
    repo: string,
    callbackUrl: string
  ): Promise<any> {
    const projectId = encodeURIComponent(`${owner}/${repo}`);

    const hooks = await this.request<any[]>(
      `/projects/${projectId}/hooks`
    );

    const existing = hooks.find((h: any) => h.url === callbackUrl);
    if (existing) return existing;

    return this.request(`/projects/${projectId}/hooks`, {
      method: "POST",
      body: JSON.stringify({
        url: callbackUrl,
        merge_requests_events: true,
        push_events: false,
      }),
    });
  }

  async deleteWebhook(
    owner: string,
    repo: string,
    webhookId: string
  ): Promise<void> {
    const projectId = encodeURIComponent(`${owner}/${repo}`);

    await this.request(
      `/projects/${projectId}/hooks/${webhookId}`,
      { method: "DELETE" }
    );
  }

  async getRepoFileContents(
    owner: string,
    repo: string,
    path = ""
  ): Promise<VCSFile[]> {
    const projectId = encodeURIComponent(`${owner}/${repo}`);
    const project = await this.request<any>(`/projects/${projectId}`);
    const ref = project.default_branch ?? "main";
    return this.fetchTreeRecursive(projectId, path, ref);
  }

  private async fetchTreeRecursive(
    projectId: string,
    path: string,
    ref: string = "main"
  ): Promise<VCSFile[]> {
    const tree = await this.request<any[]>(
      `/projects/${projectId}/repository/tree?path=${path}&ref=${ref}&per_page=100`
    );

    let files: VCSFile[] = [];

    for (const item of tree) {
      if (item.type === "blob") {
        const filePath = item.path;
        if (!filePath.match(/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz)$/i)) {
          try {
            const content = await this.request<string>(
              `/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${ref}`,
              { headers: {} }
            );
            files.push({ path: filePath, content });
          } catch {
            // Skip binary or unreadable files
          }
        }
      } else if (item.type === "tree") {
        const subFiles = await this.fetchTreeRecursive(projectId, item.path, ref);
        files = files.concat(subFiles);
      }
    }

    return files;
  }

  async getContributions(username: string): Promise<any> {
    const user = await this.request<any>(`/users?username=${username}`);

    if (!user.length) {
      throw new Error(`GitLab user '${username}' not found`);
    }

    const events = await this.request<any[]>(
      `/users/${user[0].id}/events?action=pushed&after=${
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      }&per_page=100`
    );

    const calendar: Record<string, number> = {};
    for (const event of events) {
      const date = event.created_at.split("T")[0];
      calendar[date] = (calendar[date] || 0) + 1;
    }

    return {
      totalContributions: events.length,
      calendar,
    };
  }

  async searchPullRequests(query: string, perPage = 10): Promise<any> {
    const data = await this.request<any[]>(
      `/merge_requests?search=${encodeURIComponent(query)}&scope=all&per_page=${perPage}`
    );

    return data.map((mr) => ({
      number: mr.iid,
      title: mr.title,
      url: mr.web_url,
      state: mr.state,
      repository: mr.references.full,
    }));
  }
}
