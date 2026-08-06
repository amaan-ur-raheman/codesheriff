import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate, mockKill, mockRun, mockRead, mockWrite, MockTimeoutError, MockFileNotFoundError } =
	vi.hoisted(() => {
		class MockTimeoutError extends Error {}
		class MockFileNotFoundError extends Error {}
		return {
			mockCreate: vi.fn(),
			mockKill: vi.fn(),
			mockRun: vi.fn(),
			mockRead: vi.fn(),
			mockWrite: vi.fn(),
			MockTimeoutError,
			MockFileNotFoundError,
		};
	});

// Mock the E2B SDK before any import of the sandbox module.
vi.mock("e2b", () => ({
	Sandbox: {
		create: (...args: unknown[]) => mockCreate(...args),
	},
	TimeoutError: MockTimeoutError,
	FileNotFoundError: MockFileNotFoundError,
}));

// Mock the GitHub lib so no real network is touched.
vi.mock("@/modules/github/lib/github", () => ({
	getOctokit: vi.fn().mockResolvedValue({
		rest: {
			pulls: {
				get: vi.fn().mockResolvedValue({
					data: {
						head: {
							ref: "feature-branch",
							repo: { clone_url: "https://github.com/owner/repo.git" },
						},
					},
				}),
			},
		},
	}),
}));

import { verifySuggestionsInSandbox, getSandboxConfig, SandboxUnavailableError } from "@/modules/ai/lib/sandbox";
import { buildGitCredentialHelperScript } from "@/modules/ai/lib/sandbox/git-credential-helper";

function makeSandbox() {
	return {
		commands: { run: mockRun },
		files: { read: mockRead, write: mockWrite },
		kill: mockKill,
	};
}

import type { CodeSuggestion } from "@/modules/ai/lib/suggestions";

const suggestions: CodeSuggestion[] = [
	{
		id: "s1",
		filePath: "src/a.ts",
		startLine: 1,
		endLine: 1,
		severity: "warning",
		title: "Fix",
		description: "desc",
		originalCode: "const a = 1;",
		suggestedCode: "const a = 2;",
		category: "general",
	},
];

function makeCommandResult(exitCode: number, stdout = "", stderr = "") {
	return { exitCode, stdout, stderr, error: undefined };
}

describe("getSandboxConfig", () => {
	it("defaults to sandbox mode with the documented defaults", () => {
		const cfg = getSandboxConfig({});
		expect(cfg.mode).toBe("sandbox");
		expect(cfg.timeoutMs).toBe(120_000);
		expect(cfg.maxMemoryMB).toBe(512);
		expect(cfg.e2bApiKey).toBeUndefined();
	});

	it("honors SANDBOX_MODE=exec and overrides", () => {
		const cfg = getSandboxConfig({
			SANDBOX_MODE: "exec",
			SANDBOX_TIMEOUT_MS: "30000",
			SANDBOX_MAX_MEMORY_MB: "1024",
			E2B_API_KEY: "test-key",
		});
		expect(cfg.mode).toBe("exec");
		expect(cfg.timeoutMs).toBe(30_000);
		expect(cfg.maxMemoryMB).toBe(1024);
		expect(cfg.e2bApiKey).toBe("test-key");
	});
});

describe("git credential helper", () => {
	it("embeds the token in the script but never in a URL/argv position", () => {
		const script = buildGitCredentialHelperScript("ghp_secret123");
		expect(script).toContain("ghp_secret123");
		expect(script).toContain("username=x-access-token");
		expect(script).toContain("password=ghp_secret123");
		expect(script.startsWith("#!/bin/sh")).toBe(true);
	});
});

describe("verifySuggestionsInSandbox (E2B mode)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCreate.mockReset();
		mockKill.mockReset();
		mockRun.mockReset();
		mockRead.mockReset();
		mockWrite.mockReset();
		mockCreate.mockResolvedValue(makeSandbox());
		mockKill.mockResolvedValue(true);
		mockWrite.mockResolvedValue({});
		process.env.SANDBOX_MODE = "sandbox";
		process.env.E2B_API_KEY = "test-key";
	});

	it("routes through E2B: one sandbox per review, killed afterwards", async () => {
		mockRun.mockImplementation((cmd: string) =>
			Promise.resolve(
				cmd.includes("test -f") ? makeCommandResult(0, "yes") : makeCommandResult(0)
			)
		);
		mockRead.mockResolvedValue('{"scripts":{"test":"vitest run"}}');

		await verifySuggestionsInSandbox("token", "owner", "repo", 1, suggestions);

		expect(mockCreate).toHaveBeenCalledTimes(1);
		expect(mockKill).toHaveBeenCalledTimes(1);
		// Clone command must use the plain URL (no token).
		const cloneCall = mockRun.mock.calls.find((c) => String(c[0]).includes("git clone"));
		expect(cloneCall).toBeDefined();
		const cloneCmd = String(cloneCall![0]);
		expect(cloneCmd).not.toContain("token");
		expect(cloneCmd).toContain("https://github.com/owner/repo.git");
		// Clones into a writable dir — the template root "/" is read-only
		expect(cloneCmd).toContain("/tmp/repo");
		// The credential helper is wired via git config before the clone.
		const configCall = mockRun.mock.calls.find((c) => String(c[0]).includes("credential.helper"));
		expect(configCall).toBeDefined();
		expect(String(configCall![0])).toContain("git config --global credential.helper");
		expect(String(configCall![0])).not.toContain("token");
	});

	it("marks suggestions verified when tests pass, failed when they fail", async () => {
		let testRuns = 0;
		mockRun.mockImplementation((cmd: string) => {
			if (cmd.includes("test -f")) return Promise.resolve(makeCommandResult(0, "yes"));
			if (cmd.includes("run test") || cmd.includes("bun test")) {
				testRuns += 1;
				return Promise.resolve(
					testRuns === 1
						? makeCommandResult(0)
						: makeCommandResult(1, "", "FAIL: 1 test failed")
				);
			}
			return Promise.resolve(makeCommandResult(0));
		});
		mockRead.mockResolvedValue('const a = 1;');
		mockRead.mockResolvedValueOnce('{"scripts":{"test":"vitest run"}}');

		const results = await verifySuggestionsInSandbox(
			"token",
			"owner",
			"repo",
			1,
			[suggestions[0], { ...suggestions[0], id: "s2" }]
		);

		expect(results).toHaveLength(2);
		expect(results[0]).toMatchObject({ id: "s1", verifyStatus: "verified", success: true });
		expect(results[1]).toMatchObject({
			id: "s2",
			verifyStatus: "failed",
			success: false,
			verifyError: "FAIL: 1 test failed",
		});
		expect(results[0].verifyDurationMs).toBeGreaterThanOrEqual(0);
	});

	it("maps a command timeout to sandbox_error, not failed", async () => {
		mockRun.mockImplementation((cmd: string) => {
			if (cmd.includes("test -f")) return Promise.resolve(makeCommandResult(0, "yes"));
			if (cmd.includes("run test") || cmd.includes("bun test"))
				return Promise.reject(new MockTimeoutError("deadline exceeded"));
			return Promise.resolve(makeCommandResult(0));
		});
		mockRead.mockResolvedValue('const a = 1;');
		mockRead.mockResolvedValueOnce('{"scripts":{"test":"vitest run"}}');

		const results = await verifySuggestionsInSandbox("token", "owner", "repo", 1, suggestions);

		expect(results[0]).toMatchObject({
			id: "s1",
			verifyStatus: "sandbox_error",
			success: false,
			verifyError: "Sandbox timed out",
		});
	});

	it("throws SandboxUnavailableError when the sandbox cannot be created", async () => {
		mockCreate.mockRejectedValueOnce(new Error("401 invalid api key"));

		await expect(
			verifySuggestionsInSandbox("token", "owner", "repo", 1, suggestions)
		).rejects.toBeInstanceOf(SandboxUnavailableError);
	});

	it("throws SandboxUnavailableError when E2B_API_KEY is missing", async () => {
		delete process.env.E2B_API_KEY;
		await expect(
			verifySuggestionsInSandbox("token", "owner", "repo", 1, suggestions)
		).rejects.toBeInstanceOf(SandboxUnavailableError);
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("throws SandboxUnavailableError when the clone fails", async () => {
		mockRun
			.mockResolvedValueOnce(makeCommandResult(0)) // chmod
			.mockResolvedValueOnce(makeCommandResult(0)) // git config
			.mockResolvedValueOnce(makeCommandResult(128, "", "fatal: repository not found"));

		await expect(
			verifySuggestionsInSandbox("token", "owner", "repo", 1, suggestions)
		).rejects.toBeInstanceOf(SandboxUnavailableError);
		expect(mockKill).toHaveBeenCalledTimes(1);
	});

	it("falls back to npm when bun is not installed even if bun.lock exists", async () => {
		mockRun.mockImplementation((cmd: string) => {
			if (cmd.includes("test -f")) return Promise.resolve(makeCommandResult(0, "yes")); // bun.lock present
			if (cmd.includes("command -v bun")) return Promise.resolve(makeCommandResult(127)); // bun missing
			if (cmd.includes("npm run test")) return Promise.resolve(makeCommandResult(0));
			if (cmd.includes("npm install")) return Promise.resolve(makeCommandResult(0));
			return Promise.resolve(makeCommandResult(0));
		});
		mockRead.mockResolvedValue('const a = 1;');
		mockRead.mockResolvedValueOnce('{"scripts":{"test":"vitest run"}}');

		const results = await verifySuggestionsInSandbox("token", "owner", "repo", 1, suggestions);

		// Despite the bun.lock, the runner must use npm when the binary is absent.
		expect(results[0]).toMatchObject({ id: "s1", verifyStatus: "verified", success: true });
		const installCall = mockRun.mock.calls.find((c) => String(c[0]).includes("install"));
		expect(installCall).toBeDefined();
		expect(String(installCall![0])).toContain("npm install");
		const testCall = mockRun.mock.calls.find((c) => String(c[0]).includes("run test"));
		expect(testCall).toBeDefined();
		expect(String(testCall![0])).toContain("npm run test");
	});

	it("rejects unsafe file paths as failed, never touching the sandbox filesystem", async () => {
		mockRun.mockImplementation((cmd: string) =>
			Promise.resolve(
				cmd.includes("test -f") ? makeCommandResult(0, "yes") : makeCommandResult(0)
			)
		);
		mockRead.mockResolvedValue('{"scripts":{"test":"vitest run"}}');

		const results = await verifySuggestionsInSandbox("token", "owner", "repo", 1, [
			{ ...suggestions[0], id: "evil", filePath: "../../etc/passwd" },
		]);

		expect(results[0]).toMatchObject({
			id: "evil",
			verifyStatus: "failed",
			verifyError: "Unsafe file path rejected: ../../etc/passwd",
		});
		// No read/write happened for the traversal path
		const evilReads = mockRead.mock.calls.filter((c) => String(c[0]).includes(".."));
		expect(evilReads).toHaveLength(0);
	});

	it("maps a missing file to failed, matching the exec runner", async () => {
		mockRun.mockImplementation((cmd: string) =>
			Promise.resolve(
				cmd.includes("test -f") ? makeCommandResult(0, "yes") : makeCommandResult(0)
			)
		);
		mockRead.mockResolvedValue('const a = 1;');
		mockRead.mockResolvedValueOnce('{"scripts":{"test":"vitest run"}}'); // package.json
		mockRead.mockRejectedValueOnce(new MockFileNotFoundError("missing")); // suggestion file

		const results = await verifySuggestionsInSandbox("token", "owner", "repo", 1, suggestions);

		expect(results[0]).toMatchObject({
			id: "s1",
			verifyStatus: "failed",
			verifyError: "Could not apply fix: File not found in src/a.ts",
		});
	});

	it("restores the file between two suggestions on the same file", async () => {
		mockRun.mockImplementation((cmd: string) => {
			if (cmd.includes("test -f")) return Promise.resolve(makeCommandResult(0, "yes"));
			if (cmd.includes("run test") || cmd.includes("bun test"))
				return Promise.resolve(makeCommandResult(0));
			return Promise.resolve(makeCommandResult(0));
		});
		mockRead.mockResolvedValue('const a = 1;');
		mockRead.mockResolvedValueOnce('{"scripts":{"test":"vitest run"}}');

		const twoSameFile: CodeSuggestion[] = [
			{ ...suggestions[0], id: "s1" },
			{ ...suggestions[0], id: "s2" },
		];

		const results = await verifySuggestionsInSandbox("token", "owner", "repo", 1, twoSameFile);

		// Both suggestions target src/a.ts with the same originalCode; the
		// second would fail to apply unless the file was restored after s1.
		expect(results[0].verifyStatus).toBe("verified");
		expect(results[1].verifyStatus).toBe("verified");
		// Restore writes happened after each edit.
		expect(mockWrite.mock.calls.length).toBeGreaterThanOrEqual(2);
	});
});

describe("verifySuggestionsInSandbox (exec mode)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.SANDBOX_MODE = "exec";
	});

	it("does not touch the E2B SDK", async () => {
		// exec mode hits the file system/child processes; a full end-to-end run
		// requires a real git+repo. Here we only assert routing: E2B is skipped
		// even though E2B_API_KEY is set, and the in-process runner's own
		// failure path returns sandbox_error results (review never fails).
		process.env.E2B_API_KEY = "test-key";
		const results = await verifySuggestionsInSandbox("token", "owner", "repo", 1, suggestions);
		expect(mockCreate).not.toHaveBeenCalled();
		expect(results).toHaveLength(1);
		expect(results[0].verifyStatus).toBe("sandbox_error");
	});
});
