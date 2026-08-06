import {
  VCSProvider,
  ReviewCapableProvider,
  GitHubCredentials,
  GitLabCredentials,
  BitbucketCredentials,
} from "./types";
import { GitHubProvider } from "./github-provider";
import { GitLabProvider } from "./gitlab-provider";
import { BitbucketProvider } from "./bitbucket-provider";

export type VCSProviderType = "github" | "gitlab" | "bitbucket";

/**
 * Creates a VCS provider from already-resolved credentials:
 * - GitHub: an authenticated Octokit client
 * - GitLab/Bitbucket: an access token string
 *
 * GitHub returns a {@link ReviewCapableProvider}; GitLab and Bitbucket
 * implement only the base {@link VCSProvider} capabilities.
 */
export function createVCSProvider(
  provider: "github",
  credentials: GitHubCredentials
): ReviewCapableProvider;
export function createVCSProvider(
  provider: "gitlab",
  credentials: GitLabCredentials
): VCSProvider;
export function createVCSProvider(
  provider: "bitbucket",
  credentials: BitbucketCredentials
): VCSProvider;
export function createVCSProvider(
  provider: VCSProviderType,
  credentials: GitHubCredentials | GitLabCredentials | BitbucketCredentials
): VCSProvider {
  switch (provider) {
    case "github":
      return new GitHubProvider((credentials as GitHubCredentials).octokit);
    case "gitlab":
      return new GitLabProvider((credentials as GitLabCredentials).token);
    case "bitbucket":
      return new BitbucketProvider((credentials as BitbucketCredentials).token);
    default:
      throw new Error(`Unknown VCS provider: ${provider}`);
  }
}
