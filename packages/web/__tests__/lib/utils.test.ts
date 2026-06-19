import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn utility", () => {
	it("merges class names", () => {
		const result = cn("text-red-500", "text-blue-500");
		expect(result).toBe("text-blue-500");
	});

	it("handles conditional classes", () => {
		const result = cn("base", false && "hidden", true && "visible");
		expect(result).toContain("base");
		expect(result).toContain("visible");
		expect(result).not.toContain("hidden");
	});

	it("handles undefined and null", () => {
		const result = cn("base", undefined, null);
		expect(result).toBe("base");
	});

	it("merges tailwind conflicting classes", () => {
		const result = cn("p-4", "p-8");
		expect(result).toBe("p-8");
	});

	it("returns empty string for no input", () => {
		const result = cn();
		expect(result).toBe("");
	});
});
