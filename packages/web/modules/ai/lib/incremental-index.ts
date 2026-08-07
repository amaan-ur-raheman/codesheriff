/**
 * Pure decision logic for incremental repo indexing (Spec 0002).
 *
 * Turns a GitHub compare outcome into an indexing plan:
 * - force-push (base SHA gone / diverged) → full re-index
 * - changed files over the threshold → full re-index
 * - otherwise → incremental: upsert added/modified/renamed, delete removed
 *
 * Kept free of I/O so the decisions are unit-testable (see
 * __tests__/modules/ai/incremental-index.test.ts).
 */

export interface CompareFile {
	filename: string;
	status: string;
	previous_filename?: string | null;
}

export interface CompareOutcome {
	/** GitHub compare `status` field: ahead / behind / identical / diverged / ... */
	status: string;
	totalCommits: number;
	/** False when the base SHA no longer exists (compare API returned 404). */
	baseExists: boolean;
	files: CompareFile[];
}

export type IndexPlan =
	| { mode: "full"; reason: "force-push-no-base" | "force-push-diverged" | "over-threshold" }
	| { mode: "incremental"; upsertPaths: string[]; deletePaths: string[] };

const UPSERT_STATUSES = new Set(["added", "modified", "renamed", "copied", "changed"]);

export function computeIndexPlan(
	outcome: CompareOutcome,
	fullReindexThreshold: number
): IndexPlan {
	// Locked decision: a force-push (stored base SHA no longer exists → compare 404,
	// or ancestry rewritten → "diverged") falls back to a full re-index.
	if (!outcome.baseExists) {
		return { mode: "full", reason: "force-push-no-base" };
	}
	if (outcome.status === "diverged") {
		return { mode: "full", reason: "force-push-diverged" };
	}

	// Locked decision: file-count threshold only; a push changing more than the
	// threshold falls back to a full re-index (200 is the default).
	if (outcome.files.length > fullReindexThreshold) {
		return { mode: "full", reason: "over-threshold" };
	}

	const upsertPaths: string[] = [];
	const deletePaths: string[] = [];
	const deleteCandidates: string[] = [];
	const upsertSet = new Set<string>();
	const deleteSet = new Set<string>();

	// Pass 1: collect upserts and rename deletions; a path re-added in the same
	// diff wins over a removal, so deletions are finalized only in pass 2.
	for (const file of outcome.files) {
		if (UPSERT_STATUSES.has(file.status)) {
			if (!upsertSet.has(file.filename)) {
				upsertSet.add(file.filename);
				upsertPaths.push(file.filename);
			}
			// A rename replaces the old path: delete the previous vector.
			if (file.previous_filename) {
				deleteCandidates.push(file.previous_filename);
			}
		} else if (file.status === "removed") {
			deleteCandidates.push(file.filename);
		}
	}

	// Pass 2: finalize deletions, excluding paths upserted in this same diff.
	for (const path of deleteCandidates) {
		if (!upsertSet.has(path) && !deleteSet.has(path)) {
			deleteSet.add(path);
			deletePaths.push(path);
		}
	}

	return { mode: "incremental", upsertPaths, deletePaths };
}
