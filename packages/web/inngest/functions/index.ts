import prisma from "@/lib/db";
import { inngest } from "../client";
import { getRepoFileContents } from "@/modules/github/lib/github";
import { indexCodebase } from "@/modules/ai/lib/rag";

export const indexRepo = inngest.createFunction(
	{ id: "index-repo" },
	{ event: "repository.connected" },
	async ({ event, step }) => {
		const { owner, repo, userId } = event.data;

		const fileCount = await step.run("fetch-files-index-codebase", async () => {
			const account = await prisma.account.findFirst({
				where: {
					userId: userId,
					providerId: "github",
				},
			});

			if (!account?.accessToken) {
				throw new Error("No GitHub access token found");
			}

			const files = await getRepoFileContents(
				account.accessToken,
				owner,
				repo
			);

			// Index immediately and return only metadata
			await indexCodebase(`${owner}/${repo}`, files);

			return files.length;
		});

		return { success: true, indexedFiles: fileCount };
	}
);
