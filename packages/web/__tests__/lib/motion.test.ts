import { describe, it, expect } from "vitest";
import {
	EASE,
	DURATION,
	STAGGER,
	MOTION_PREFERRED_QUERY,
	REVEAL_TRIGGER,
} from "@/lib/motion";

describe("shared motion language", () => {
	it("locks the single ease curve", () => {
		expect(EASE).toBe("power3.out");
	});

	it("locks the duration register", () => {
		expect(DURATION).toEqual({
			micro: 0.22,
			fast: 0.5,
			base: 0.6,
			cell: 0.65,
			stats: 0.55,
			section: 0.7,
			cta: 0.8,
			hero: 0.9,
			count: 1.3,
		});
	});

	it("locks the stagger defaults", () => {
		expect(STAGGER).toEqual({
			heroLines: 0.13,
			heroCta: 0.09,
		});
	});

	it("codifies the app-wide reduced-motion policy", () => {
		expect(MOTION_PREFERRED_QUERY).toBe(
			"(prefers-reduced-motion: no-preference)",
		);
	});

	it("reveals play once and can never leave content hidden", () => {
		expect(REVEAL_TRIGGER).toEqual({
			start: "top 85%",
			once: true,
			toggleActions: "play none none none",
		});
	});
});
