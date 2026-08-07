import prisma from "@/lib/db";
import { inngest } from "../client";
import { getOctokit } from "@/modules/github/lib/auth";
import { getRepoFileContents, getFileContentsAtRef } from "@/modules/github/lib/files";
import { indexCodebase, deleteCodebaseFiles } from "@/modules/ai/lib/rag";
import { computeIndexPlan } from "@/modules/ai/lib/incremental-index";

/**
 * Incremental repo indexing (Spec 0002).
 *
 * Triggered by a `push` webhook to a watched branch. Compares the stored
 * `lastIndexedCommitSha` against the new head and:
 * - force-push (compare 404 or "diverged") → full re-index
 * - changed files over `INDEX_FULL_REINDEX_THRESHOLD` → full re-index
 * - otherwise → embed only added/modified/renamed files, delete removed vectors
 *
 * `lastIndexedCommitSha` advances only after a fully successful run (AC-3, AC-5).
 */
export const indexRepoIncremental = inngest.createFunction(
	{
		id: "index-repo-incremental",
		concurrency: { limit: 1, key: "event.data.repoId" },
	},
	{ event: "index-repo-incremental" },
	async ({ event, step }) => {
		const { owner, repo, ref, headSha } = event.data as {
			owner: string;
			repo: string;
			ref: string;
			headSha: string;
		};

		const repoId = `${owner}/${repo}`;

		const result = await step.run("index-incremental", async () => {
			// Feature flag: incremental indexing can be disabled entirely.
			if (process.env.INCREMENTAL_INDEX_ENABLED === "false") {
				return { skipped: "disabled" as const };
			}

			const repository = await prisma.repository.findFirst({
				where: { fullName: repoId },
			});

			if (!repository?.userId) {
				return { skipped: "repo-not-connected" as const };
			}

			const account = await prisma.account.findFirst({
				where: { userId: repository.userId, providerId: "github" },
			});

			if (!account?.accessToken) {
				throw new Error("No GitHub access token found");
			}

			// Branch policy (locked: default branch only by default).
			const branch = ref.replace(/^refs\/heads\//, "");
			const allowedBranches = process.env.INDEX_PUSH_BRANCHES?.split(",")
				.map((b) => b.trim())
				.filter(Boolean);

			const octokit = await getOctokit({ token: account.accessToken, owner, repo });
			let defaultBranch: string | undefined;

			if (allowedBranches && allowedBranches.length > 0) {
				if (!allowedBranches.includes(branch)) {
					return { skipped: "branch-not-watched" as const };
				}
			} else {
				const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
				defaultBranch = repoData.default_branch;
				if (defaultBranch !== branch) {
					return { skipped: "branch-not-watched" as const };
				}
			}

			const baseSha = repository.lastIndexedCommitSha;

			// A null watermark means this repo was never indexed (or the manual
			// "index now" backfill path) → full re-index, not a compare (Spec 0002).
			// Content is fetched at headSha so index and watermark stay consistent.
			if (!baseSha) {
				const files = await getRepoFileContents(account.accessToken, owner, repo, "", headSha);
				await indexCodebase(repoId, files);
				await prisma.repository.update({
					where: { id: repository.id },
					data: { lastIndexedCommitSha: headSha },
				});
				return { mode: "full" as const, reason: "first-index" as const, indexedFiles: files.length };
			}

			// Compare base..head; a 404 means the stored base SHA was force-pushed away.
			let compareStatus: string;
			let compareFiles: {
				filename: string;
				status: string;
				previous_filename?: string | null;
			}[] = [];
			let baseExists = true;

			try {
				const { data } = await octokit.rest.repos.compareCommits({
					owner,
					repo,
					base: baseSha,
					head: headSha,
				});
				compareStatus = data.status;
				compareFiles = (data.files ?? []).map((f) => ({
					filename: f.filename,
					status: f.status,
					previous_filename: f.previous_filename,
				}));
			} catch (error) {
				const status = (error as { status?: number }).status;
				if (status === 404) {
					baseExists = false;
					compareStatus = "no-base";
				} else {
					throw error;
				}
			}

			const threshold = Number(process.env.INDEX_FULL_REINDEX_THRESHOLD ?? 200);
			const plan = computeIndexPlan(
				{ status: compareStatus, totalCommits: 0, baseExists, files: compareFiles },
				threshold
			);

			if (plan.mode === "full") {
				const files = await getRepoFileContents(account.accessToken, owner, repo, "", headSha);
				await indexCodebase(repoId, files);
				await prisma.repository.update({
					where: { id: repository.id },
					data: { lastIndexedCommitSha: headSha },
				});
				return { mode: "full" as const, reason: plan.reason, indexedFiles: files.length };
			}

			// Incremental: embed changed files, delete removed vectors.
			const changedFiles =
				plan.upsertPaths.length > 0
					? await getFileContentsAtRef(account.accessToken, owner, repo, plan.upsertPaths, headSha)
					: [];
			await indexCodebase(repoId, changedFiles);
			await deleteCodebaseFiles(repoId, plan.deletePaths);

			// Advance the watermark only after full success (AC-3, AC-5).
			await prisma.repository.update({
				where: { id: repository.id },
				data: { lastIndexedCommitSha: headSha },
			});

			return {
				mode: "incremental" as const,
				upserted: changedFiles.length,
				deleted: plan.deletePaths.length,
			};
		});

		return result;
	}
);
