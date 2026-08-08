import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import chalk from "chalk";
import { brand, verified, destructive, muted, bold, lockup, tagline } from "./theme";

// chalk auto-disables styling in non-TTY (piped) environments; force the
// 16-color level so the ANSI-safety contract is actually exercised.
beforeAll(() => {
	chalk.level = 1;
});

afterAll(() => {
	chalk.level = 0;
});

describe("editorial theme", () => {
	it("emits ANSI escape sequences", () => {
		expect(brand("x")).toContain("\u001b[");
		expect(verified("x")).toContain("\u001b[");
		expect(muted("x")).toContain("\u001b[");
	});

	it("never emits truecolor (24-bit) sequences — stays 16-color ANSI-safe", () => {
		const samples = [brand, verified, destructive, muted, bold].map((fn) => fn("x"));
		for (const s of samples) {
			expect(s).not.toContain("38;2;");
			expect(s).not.toContain("48;2;");
		}
	});

	it("maps brand to the amber family (ANSI yellow) and verified to green", () => {
		expect(brand("x")).toContain("93m"); // yellowBright
		expect(verified("x")).toContain("32m"); // green
	});

	it("lockup carries the wordmark and the geometric star, with no emoji", () => {
		expect(lockup).toContain("CODE SHERIFF");
		expect(lockup).toContain("★");
		expect(lockup).not.toMatch(/[\u{1F400}-\u{1FAFF}]/u);
	});

	it("tagline matches the product voice", () => {
		expect(tagline).toContain("code");
	});
});
