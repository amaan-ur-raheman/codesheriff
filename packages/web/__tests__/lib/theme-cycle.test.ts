import { describe, expect, it } from "vitest";
import {
	computeNextTheme,
	resolveAppearance,
	type ThemeAppearance,
	type ThemePreference,
} from "@/lib/theme-cycle";

const STATES: ThemePreference[] = ["light", "dark", "system"];
const OSES: ThemeAppearance[] = ["light", "dark"];
const MAYBE_UNDEFINED: (ThemePreference | undefined)[] = [
	"light",
	"dark",
	"system",
	undefined,
];

describe("computeNextTheme — guaranteed flip", () => {
	it.each(OSES)(
		"every click changes the visible appearance (os=%s)",
		(os) => {
			for (const theme of MAYBE_UNDEFINED) {
				for (const last of MAYBE_UNDEFINED) {
					const next = computeNextTheme({ theme, os, last });
					const before = resolveAppearance(theme, os);
					const after = resolveAppearance(next, os);
					expect(
						after,
						`os=${os} theme=${theme} last=${last}`
					).not.toBe(before);
				}
			}
		}
	);
});

describe("computeNextTheme — full ring reachability", () => {
	it.each(OSES)("all three states stay reachable (os=%s)", (os) => {
		for (const start of STATES) {
			let theme: ThemePreference = start;
			let last: ThemePreference | undefined = undefined;
			const visited = new Set<ThemePreference>([theme]);

			// The full ring is 4 steps; 12 steps covers three full passes.
			for (let i = 0; i < 12; i++) {
				const next = computeNextTheme({ theme, os, last });
				last = theme;
				theme = next;
				visited.add(theme);
			}

			expect([...visited].sort(), `start=${start} os=${os}`).toEqual([
				"dark",
				"light",
				"system",
			]);
		}
	});

	it.each(OSES)("never revisits the same appearance consecutively (os=%s)", (os) => {
		for (const start of STATES) {
			let theme: ThemePreference = start;
			let last: ThemePreference | undefined = undefined;
			let prevAppearance = resolveAppearance(theme, os);

			for (let i = 0; i < 20; i++) {
				const next = computeNextTheme({ theme, os, last });
				const appearance = resolveAppearance(next, os);
				expect(appearance).not.toBe(prevAppearance);
				last = theme;
				theme = next;
				prevAppearance = appearance;
			}
		}
	});
});

describe("computeNextTheme — external setTheme recovery", () => {
	it("recovers when the ThemeMenu sets system directly", () => {
		// Menu set "system" on a dark OS; the toggle's stale memory says "light".
		const os: ThemeAppearance = "dark";
		const next = computeNextTheme({ theme: "system", os, last: "light" });
		expect(next).toBe("light");
		expect(resolveAppearance(next, os)).toBe("light");
	});

	it("recovers when the ThemeMenu sets a literal directly", () => {
		// Menu set "light" (opposite of dark OS); stale memory says "system".
		const os: ThemeAppearance = "dark";
		const next = computeNextTheme({ theme: "light", os, last: "system" });
		expect(next).toBe("dark");
		expect(resolveAppearance(next, os)).toBe("dark");
	});
});

describe("resolveAppearance", () => {
	it("resolves system to the OS", () => {
		expect(resolveAppearance("system", "dark")).toBe("dark");
		expect(resolveAppearance("system", "light")).toBe("light");
	});

	it("resolves literals to themselves", () => {
		expect(resolveAppearance("light", "dark")).toBe("light");
		expect(resolveAppearance("dark", "light")).toBe("dark");
	});

	it("treats undefined as light", () => {
		expect(resolveAppearance(undefined, "dark")).toBe("light");
	});
});
