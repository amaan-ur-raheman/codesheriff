import { describe, expect, it, afterEach, beforeEach } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { applyFixLocally } from "./fix";

describe("applyFixLocally", () => {
	let dir: string;
	let cwd: string;

	beforeEach(() => {
		dir = mkdtempSync(path.join(tmpdir(), "codesheriff-fix-"));
		cwd = process.cwd();
		process.chdir(dir);
	});

	afterEach(() => {
		process.chdir(cwd);
		rmSync(dir, { recursive: true, force: true });
	});

	it("applies an exact-match replacement", async () => {
		writeFileSync(path.join(dir, "a.ts"), "const x = 1;\nconst y = 2;\n");
		const res = await applyFixLocally("a.ts", "const x = 1;", "const x = 3;", 1, 1);
		expect(res.success).toBe(true);
		expect(readFileSync(path.join(dir, "a.ts"), "utf-8")).toContain("const x = 3;");
	});

	it("falls back to line-range replacement when the original code has drifted", async () => {
		writeFileSync(path.join(dir, "b.ts"), "a\nb\nc\nd\n");
		const res = await applyFixLocally("b.ts", "zzz-not-found", "X", 2, 3);
		expect(res.success).toBe(true);
		expect(readFileSync(path.join(dir, "b.ts"), "utf-8")).toBe("a\nX\nd\n");
	});

	it("returns failure for missing files", async () => {
		const res = await applyFixLocally("missing.ts", "x", "y", 1, 1);
		expect(res.success).toBe(false);
	});

	it("normalizes CRLF line endings before replacing", async () => {
		writeFileSync(path.join(dir, "c.ts"), "const a = 1;\r\nconst b = 2;\r\n");
		const res = await applyFixLocally("c.ts", "const a = 1;", "const a = 9;", 1, 1);
		expect(res.success).toBe(true);
		expect(readFileSync(path.join(dir, "c.ts"), "utf-8")).toBe("const a = 9;\nconst b = 2;\n");
	});
});
