import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockOctokit } = vi.hoisted(() => ({
	mockOctokit: {
		rest: {
			repos: {
				listWebhooks: vi.fn(),
				createWebhook: vi.fn(),
				deleteWebhook: vi.fn(),
			},
		},
	},
}));

vi.mock("@/modules/github/lib/auth", () => ({
	getGithubAccessToken: vi.fn().mockResolvedValue("github-token"),
	getOctokit: vi.fn().mockResolvedValue(mockOctokit),
}));

import {
	createWebhook,
	deleteWebhook,
} from "@/modules/github/lib/webhooks";

describe("GitHub webhook helpers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXT_PUBLIC_APP_BASE_URL = "https://app.example.com";
		// vitest loads the repo's real .env, so pin the secret to a known
		// state for this file: absent by default, set explicitly per test.
		delete process.env.GITHUB_WEBHOOK_SECRET;
	});

	it("signs new webhooks with the shared secret when GITHUB_WEBHOOK_SECRET is set", async () => {
		process.env.GITHUB_WEBHOOK_SECRET = "s3cret-value";

		mockOctokit.rest.repos.listWebhooks.mockResolvedValueOnce({ data: [] });
		mockOctokit.rest.repos.createWebhook.mockResolvedValueOnce({
			data: { id: 1, config: {} },
		});

		await createWebhook("owner", "repo");

		expect(mockOctokit.rest.repos.createWebhook).toHaveBeenCalledWith({
			owner: "owner",
			repo: "repo",
			config: {
				url: "https://app.example.com/api/webhooks/github",
				content_type: "json",
				secret: "s3cret-value",
			},
			events: [
				"pull_request",
				"issue_comment",
				"pull_request_review_comment",
			],
		});
	});

	it("creates unsigned webhooks when GITHUB_WEBHOOK_SECRET is unset (lenient posture)", async () => {
		mockOctokit.rest.repos.listWebhooks.mockResolvedValueOnce({ data: [] });
		mockOctokit.rest.repos.createWebhook.mockResolvedValueOnce({
			data: { id: 1, config: {} },
		});

		await createWebhook("owner", "repo");

		expect(mockOctokit.rest.repos.createWebhook).toHaveBeenCalledWith({
			owner: "owner",
			repo: "repo",
			config: {
				url: "https://app.example.com/api/webhooks/github",
				content_type: "json",
			},
			events: [
				"pull_request",
				"issue_comment",
				"pull_request_review_comment",
			],
		});
	});

	it("returns the existing webhook when one already matches the callback URL", async () => {
		mockOctokit.rest.repos.listWebhooks.mockResolvedValueOnce({
			data: [
				{
					id: 99,
					config: { url: "https://app.example.com/api/webhooks/github" },
				},
			],
		});

		const hook = await createWebhook("owner", "repo");

		expect(hook.id).toBe(99);
		expect(mockOctokit.rest.repos.createWebhook).not.toHaveBeenCalled();
	});

	it("deletes the CodeSheriff webhook when its URL matches", async () => {
		mockOctokit.rest.repos.listWebhooks.mockResolvedValueOnce({
			data: [
				{
					id: 99,
					config: { url: "https://app.example.com/api/webhooks/github" },
				},
			],
		});
		mockOctokit.rest.repos.deleteWebhook.mockResolvedValueOnce({});

		const deleted = await deleteWebhook("owner", "repo");

		expect(deleted).toBe(true);
		expect(mockOctokit.rest.repos.deleteWebhook).toHaveBeenCalledWith({
			owner: "owner",
			repo: "repo",
			hook_id: 99,
		});
	});
});
