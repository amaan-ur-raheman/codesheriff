import { VCSProvider } from "./types";
import { GitHubProvider } from "./github-provider";
import { GitLabProvider } from "./gitlab-provider";
import { BitbucketProvider } from "./bitbucket-provider";

type VCSProviderType = "github" | "gitlab" | "bitbucket";

export function createVCSProvider(provider: VCSProviderType, token: string): VCSProvider {
  switch (provider) {
    case "github":
      return new GitHubProvider(token);
    case "gitlab":
      return new GitLabProvider(token);
    case "bitbucket":
      return new BitbucketProvider(token);
    default:
      throw new Error(`Unknown VCS provider: ${provider}`);
  }
}
