import { describe, it, expect } from "vitest";
import { computeIndexPlan, type CompareOutcome } from "@/modules/ai/lib/incremental-index";

const DEFAULT_THRESHOLD = 200;

function outcome(overrides: Partial<CompareOutcome> = {}): CompareOutcome {
	return {
		status: "ahead",
		totalCommits: 3,
		baseExists: true,
		files: [],
		...overrides,
	};
}

describe("computeIndexPlan", () => {
	describe("force-push detection (locked: force-push → full re-index)", () => {
		it("falls back to a full re-index when the stored base SHA no longer exists (compare 404)", () => {
			const plan = computeIndexPlan(outcome({ baseExists: false }), DEFAULT_THRESHOLD);
			expect(plan).toEqual({ mode: "full", reason: "force-push-no-base" });
		});

		it("falls back to a full re-index when the compare reports diverged ancestry", () => {
			const plan = computeIndexPlan(outcome({ status: "diverged" }), DEFAULT_THRESHOLD);
			expect(plan).toEqual({ mode: "full", reason: "force-push-diverged" });
		});
	});

	describe("large diff fallback (locked: file-count threshold, keep 200)", () => {
		it("falls back to a full re-index when changed files exceed the threshold", () => {
			const files = Array.from({ length: 201 }, (_, i) => ({
				filename: `src/file-${i}.ts`,
				status: "modified",
			}));
			const plan = computeIndexPlan(outcome({ files }), DEFAULT_THRESHOLD);
			expect(plan).toEqual({ mode: "full", reason: "over-threshold" });
		});

		it("stays incremental when changed files are at or under the threshold", () => {
			const files = Array.from({ length: 200 }, (_, i) => ({
				filename: `src/file-${i}.ts`,
				status: "modified",
			}));
			const plan = computeIndexPlan(outcome({ files }), DEFAULT_THRESHOLD);
			expect(plan.mode).toBe("incremental");
		});
	});

	describe("incremental plan (locked: only added/modified/renamed upserted, removed deleted)", () => {
		it("upserts added and modified files, deletes removed files", () => {
			const plan = computeIndexPlan(
				outcome({
					files: [
						{ filename: "src/new.ts", status: "added" },
						{ filename: "src/edited.ts", status: "modified" },
						{ filename: "src/gone.ts", status: "removed" },
					],
				}),
				DEFAULT_THRESHOLD
			);

			expect(plan).toEqual({
				mode: "incremental",
				upsertPaths: ["src/new.ts", "src/edited.ts"],
				deletePaths: ["src/gone.ts"],
			});
		});

		it("treats a rename as delete-old + upsert-new", () => {
			const plan = computeIndexPlan(
				outcome({
					files: [
						{
							filename: "src/renamed.ts",
							previous_filename: "src/old-name.ts",
							status: "renamed",
						},
					],
				}),
				DEFAULT_THRESHOLD
			);

			expect(plan).toEqual({
				mode: "incremental",
				upsertPaths: ["src/renamed.ts"],
				deletePaths: ["src/old-name.ts"],
			});
		});

		it("returns an empty incremental plan for an identical compare (idempotent re-delivery)", () => {
			const plan = computeIndexPlan(outcome({ status: "identical", files: [] }), DEFAULT_THRESHOLD);
			expect(plan).toEqual({ mode: "incremental", upsertPaths: [], deletePaths: [] });
		});

		it("deduplicates paths that appear both as removed and re-added", () => {
			const plan = computeIndexPlan(
				outcome({
					files: [
						{ filename: "src/x.ts", status: "removed" },
						{ filename: "src/x.ts", status: "added" },
					],
				}),
				DEFAULT_THRESHOLD
			);

			// Re-added wins: upsert, never delete.
			if (plan.mode !== "incremental") {
				throw new Error("expected incremental plan");
			}
			expect(plan.deletePaths).not.toContain("src/x.ts");
			expect(plan.upsertPaths).toContain("src/x.ts");
		});
	});
});
