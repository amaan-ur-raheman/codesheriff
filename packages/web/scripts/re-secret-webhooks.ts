/**
 * Re-points and re-secrets CodeSheriff's own GitHub webhooks.
 *
 * For every connected repository (from the DB, or the --repos override), this
 * lists the repo's webhooks and PATCHes ONLY hooks whose URL ends with
 * `/api/webhooks/github` so they:
 *
 *   1. point at `NEXT_PUBLIC_APP_BASE_URL` (the live app URL), and
 *   2. sign deliveries with `GITHUB_WEBHOOK_SECRET`.
 *
 * Any other webhook on the repo (CI, Slack, other bots) is never touched —
 * matching is done on the URL, and only the CodeSheriff endpoint is updated.
 *
 * Why: the webhook route verifies `x-hub-signature-256` whenever
 * `GITHUB_WEBHOOK_SECRET` is set, but webhooks created before the secret was
 * wired into `createWebhook` were registered unsigned — so their deliveries
 * get rejected with 401 in any environment that has the secret configured.
 *
 * Auth: tries the GitHub App (CodeSheriff-Bot) first for each repo, falling
 * back to the OAuth token of the user who connected the repo. Note the App
 * needs the "Webhooks: Read & write" repository permission to list hooks —
 * if every repo fails with "Resource not accessible", grant that permission
 * (Settings → Developer settings → GitHub Apps → CodeSheriff-Bot →
 * Permissions → Repository → Webhooks → Read & write).
 *
 * Default is a DRY RUN — pass `--apply` to make changes.
 *
 * Usage (from packages/web):
 *   bun run scripts/re-secret-webhooks.ts                          # dry run over all connected repos
 *   bun run scripts/re-secret-webhooks.ts --apply                  # apply
 *   bun run scripts/re-secret-webhooks.ts --repos owner/repo,owner/repo2 --apply
 */
import "dotenv/config";

import { Octokit } from "octokit";

import prisma from "../lib/db";
import { getOctokit } from "../modules/github/lib/auth";

const WEBHOOK_PATH = "/api/webhooks/github";

type RepoRef = { owner: string; name: string; userId: string | null };

function parseArgs(): { apply: boolean; repoOverrides: RepoRef[] } {
	const apply = process.argv.includes("--apply");
	const repoOverrides: RepoRef[] = [];
	const flagIndex = process.argv.indexOf("--repos");
	if (flagIndex !== -1) {
		const list = process.argv[flagIndex + 1] ?? "";
		for (const full of list.split(",")) {
			const [owner, name] = full.trim().split("/");
			if (owner && name) {
				repoOverrides.push({ owner, name, userId: null });
			}
		}
	}
	return { apply, repoOverrides };
}

async function listConnectedRepos(): Promise<RepoRef[]> {
	const rows = await prisma.repository.findMany({
		distinct: ["owner", "name"],
		select: { owner: true, name: true, userId: true },
	});
	return rows.map((row) => ({
		owner: row.owner,
		name: row.name,
		userId: row.userId,
	}));
}

/**
 * Builds the ordered list of authenticated clients that can manage hooks on
 * this repo: the GitHub App first, then the connecting user's OAuth token.
 */
async function buildAuthStrategies(repo: RepoRef): Promise<Octokit[]> {
	const strategies: Octokit[] = [];

	const appOctokit = await getOctokit({
		owner: repo.owner,
		repo: repo.name,
	}).catch(() => null);
	if (appOctokit) {
		strategies.push(appOctokit);
	}

	if (repo.userId) {
		const account = await prisma.account.findFirst({
			where: { userId: repo.userId, providerId: "github" },
		});
		if (account?.accessToken) {
			strategies.push(new Octokit({ auth: account.accessToken }));
		}
	}

	return strategies;
}

function describeListFailure(error: unknown): string {
	if (!error) {
		return (
			"no auth strategy available (no GitHub App credentials and no " +
			"connected account token with hook access)"
		);
	}
	const message = (error as { message?: string })?.message ?? String(error);
	if (message.includes("Resource not accessible")) {
		return (
			`${message} — the GitHub App needs the "Webhooks: Read & write" repository ` +
			`permission, or the connected account's token needs admin:repo_hook scope.`
		);
	}
	if (message.includes("Not Found")) {
		return (
			`${message} — the GitHub App is not installed on this repo, or the ` +
			`connected account no longer has access to it.`
		);
	}
	return message;
}

async function processRepo(
	repo: RepoRef,
	targetUrl: string,
	secret: string,
	apply: boolean
): Promise<{ updated: number; needUpdate: number }> {
	const strategies = await buildAuthStrategies(repo);

	let octokit: Octokit | null = null;
	let hooks: Awaited<ReturnType<Octokit["rest"]["repos"]["listWebhooks"]>>["data"] = [];
	let lastError: unknown = null;

	for (const candidate of strategies) {
		try {
			const { data } = await candidate.rest.repos.listWebhooks({
				owner: repo.owner,
				repo: repo.name,
			});
			hooks = data;
			octokit = candidate;
			break;
		} catch (error) {
			lastError = error;
		}
	}

	if (!octokit) {
		throw new Error(describeListFailure(lastError));
	}

	// ONLY touch hooks that belong to CodeSheriff. Everything else on the
	// repo (CI, Slack, the user's own tooling) is left alone.
	const ours = hooks.filter((hook) => hook.config?.url?.endsWith(WEBHOOK_PATH));

	if (ours.length === 0) {
		console.log(`  - ${repo.owner}/${repo.name}: no CodeSheriff webhook found (skipped)`);
		return { updated: 0, needUpdate: 0 };
	}

	let updated = 0;
	let needUpdate = 0;
	for (const hook of ours) {
		const alreadyCorrect =
			hook.config?.url === targetUrl && Boolean(hook.config?.secret);
		if (alreadyCorrect) {
			console.log(`  = ${repo.owner}/${repo.name} hook#${hook.id}: already correct`);
			continue;
		}
		needUpdate++;
		console.log(
			`  ${apply ? "~" : "?"} ${repo.owner}/${repo.name} hook#${hook.id}: ` +
				`url=${hook.config?.url ?? "(none)"} secret=${hook.config?.secret ? "set" : "MISSING"}` +
				(apply ? "" : " (dry run — not applied)")
		);
		if (apply) {
			// GitHub treats the update config as a full replacement — spell out
			// insecure_ssl explicitly ("0" = standard HTTPS, no TLS skip) so a
			// PATCH that omits it can't reset the secret alongside it.
			await octokit.rest.repos.updateWebhook({
				owner: repo.owner,
				repo: repo.name,
				hook_id: hook.id,
				config: { url: targetUrl, content_type: "json", secret, insecure_ssl: "0" },
			});
			updated++;
		}
	}
	return { updated, needUpdate };
}

async function main() {
	const { apply, repoOverrides } = parseArgs();
	const secret = process.env.GITHUB_WEBHOOK_SECRET;
	const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;

	if (!secret) {
		throw new Error(
			"GITHUB_WEBHOOK_SECRET is not set — refusing to run without a secret to sign with."
		);
	}
	if (!baseUrl) {
		throw new Error(
			"NEXT_PUBLIC_APP_BASE_URL is not set — cannot compute the webhook callback URL."
		);
	}
	const targetUrl = `${baseUrl.replace(/\/+$/, "")}${WEBHOOK_PATH}`;

	console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"} (pass --apply to make changes)`);
	console.log(`Target webhook URL: ${targetUrl}`);
	console.log(`Signing secret: set (length ${secret.length}) — value never printed`);
	console.log("");

	const repos =
		repoOverrides.length > 0 ? repoOverrides : await listConnectedRepos();

	if (repos.length === 0) {
		console.log("No repositories to process (no connected repos in DB and no --repos given).");
		return;
	}

	console.log(`Processing ${repos.length} repo(s)...`);
	let totalUpdated = 0;
	let totalNeedUpdate = 0;
	let failures = 0;

	for (const repo of repos) {
		try {
			const result = await processRepo(repo, targetUrl, secret, apply);
			totalUpdated += result.updated;
			totalNeedUpdate += result.needUpdate;
		} catch (error) {
			failures++;
			console.error(`  ! ${repo.owner}/${repo.name}: ${(error as Error).message}`);
		}
	}

	console.log("");
	if (apply) {
		console.log(`Done: ${totalUpdated} hook(s) updated, ${failures} repo(s) failed.`);
	} else {
		console.log(
			`Done (dry run): ${totalNeedUpdate} hook(s) would be updated, ` +
				`${failures} repo(s) failed. Pass --apply to make the changes.`
		);
	}
	if (failures > 0) {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error("Script failed:", error);
	process.exit(1);
});
