import prisma from "@/lib/db";
import {
	getPullRequestDiff,
	getCompareDiff,
} from "@/modules/github/lib/github";

export interface FetchPrDataInput {
	userId: string;
	owner: string;
	repo: string;
	prNumber: number;
	before?: string;
	after?: string;
}

export interface FetchPrDataOutput {
	token: string;
	diff: string;
	title: string;
	description: string | null;
	headSha: string;
}

/**
 * Step: fetch-pr-data
 * Retrieves the PR diff (or incremental compare diff when before/after are
 * provided), title, description, and the user's GitHub access token.
 */
export async function fetchPrData(
	input: FetchPrDataInput
): Promise<FetchPrDataOutput> {
	const account = await prisma.account.findFirst({
		where: {
			userId: input.userId,
			providerId: "github",
		},
	});

	if (!account?.accessToken) {
		throw new Error("No GitHub access token found");
	}

	const prMetadata = await getPullRequestDiff(
		account.accessToken,
		input.owner,
		input.repo,
		input.prNumber
	);

	let diffContent = prMetadata.diff;

	if (
		input.before &&
		input.after &&
		input.before !== "0000000000000000000000000000000000000000"
	) {
		try {
			diffContent = await getCompareDiff(
				account.accessToken,
				input.owner,
				input.repo,
				input.before,
				input.after
			);
		} catch (compareError) {
			console.warn(
				"Failed to get compare diff, falling back to full PR diff:",
				compareError
			);
		}
	}

	return {
		diff: diffContent,
		title: prMetadata.title,
		description: prMetadata.description,
		token: account.accessToken,
		headSha: prMetadata.headSha,
	};
}
