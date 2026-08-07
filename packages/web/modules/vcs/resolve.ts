import prisma from "@/lib/db";
import { getOctokit } from "../github/lib/auth";
import { VCSProvider, ReviewCapableProvider } from "./types";
import { createVCSProvider, VCSProviderType } from "./factory";

/**
 * Normalizes a repository's stored provider value into a known provider type.
 * Defaults to "github" for legacy repositories created before the field existed.
 */
export function normalizeProviderType(
	provider: string | null | undefined
): VCSProviderType {
	if (provider === "gitlab" || provider === "bitbucket") return provider;
	return "github";
}

/**
 * Type guard: does this provider implement the advanced review capabilities
 * (check runs, commit statuses, inline comments, comment lifecycle, thread
 * history, incremental diff)?
 */
export function isReviewCapableProvider(
	provider: VCSProvider
): provider is ReviewCapableProvider {
	return typeof (provider as ReviewCapableProvider).createPRCheckRun === "function";
}

export interface ResolvedProvider {
	provider: VCSProvider;
	providerType: VCSProviderType;
	token: string;
	repository: {
		id: string;
		userId: string;
		provider: string | null;
		[name: string]: unknown;
	};
}

/**
 * Resolves the VCS provider for a repository by reading the repository's
 * `provider` field (no header sniffing) and resolving that provider's stored
 * credentials for the repository owner.
 *
 * Used by both the review trigger (server action) and the Inngest review
 * function so the provider is always resolved the same way.
 *
 * @throws Error if the repository is not found or the owner has no stored
 * credentials for the repository's provider.
 */
export async function resolveProviderForRepository(
	owner: string,
	repo: string
): Promise<ResolvedProvider> {
	const repository = await prisma.repository.findFirst({
		where: { owner, name: repo },
	});

	if (!repository) {
		throw new Error(
			`Repository ${owner}/${repo} not found in database. Please reconnect the repository.`
		);
	}

	const providerType = normalizeProviderType(repository.provider);

	const account = await prisma.account.findFirst({
		where: {
			userId: repository.userId,
			providerId: providerType,
		},
	});

	if (!account?.accessToken) {
		throw new Error(
			`No ${providerType} access token found for repository owner.`
		);
	}

	const token = account.accessToken;

	let provider: VCSProvider;
	if (providerType === "github") {
		const octokit = await getOctokit({ token, owner, repo });
		provider = createVCSProvider("github", { octokit });
	} else {
		// GitLab/Bitbucket take a token string; the union is narrowed to
		// non-github here so each overload is valid for its branch.
		provider =
			providerType === "gitlab"
				? createVCSProvider("gitlab", { token })
				: createVCSProvider("bitbucket", { token });
	}

	return { provider, providerType, token, repository };
}
