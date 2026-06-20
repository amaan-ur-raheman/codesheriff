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
