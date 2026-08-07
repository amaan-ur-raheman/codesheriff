/**
 * Pure metric aggregation + alert evaluation for the verify and indexing
 * pipelines (Spec 0006). No I/O here — every function is unit-testable and
 * the Prisma-shaped inputs are kept structural so callers can pass either
 * DB rows or test fixtures.
 */

// ---- Percentiles (AC-1) ----

/**
 * Nearest-rank percentile over `values`. Returns null for an empty set.
 * Input is not mutated.
 */
export function computePercentile(
	values: number[],
	p: number
): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
	return sorted[rank - 1];
}

// ---- Verify metrics (AC-1) ----

/** Per-suggestion verify outcome — the shape stored in Review.suggestions. */
export interface VerifySuggestion {
	verifyStatus?: string;
	/** @deprecated legacy boolean flag on older reviews. */
	verified?: boolean;
	verifyDurationMs?: number;
}

export interface VerifyMetrics {
	/** Suggestions that carry a verify outcome (structured or legacy). */
	sampleCount: number;
	p50DurationMs: number | null;
	p95DurationMs: number | null;
	/** sandbox_error / total, 0..1. */
	sandboxErrorRate: number;
}

/**
 * Aggregates per-suggestion verify outcomes (AC-1). Both the current
 * `verifyStatus` shape and the legacy `verified` boolean are parsed; only
 * suggestions with an outcome count toward the sample.
 */
export function computeVerifyMetrics(
	suggestions: VerifySuggestion[]
): VerifyMetrics {
	const durations: number[] = [];
	let sandboxErrors = 0;
	let total = 0;

	for (const s of suggestions) {
		const status =
			s.verifyStatus ??
			(s.verified === true
				? "verified"
				: s.verified === false
					? "failed"
					: undefined);
		if (!status) continue;

		total++;
		if (status === "sandbox_error") sandboxErrors++;
		if (typeof s.verifyDurationMs === "number" && s.verifyDurationMs >= 0) {
			durations.push(s.verifyDurationMs);
		}
	}

	return {
		sampleCount: total,
		p50DurationMs: computePercentile(durations, 50),
		p95DurationMs: computePercentile(durations, 95),
		sandboxErrorRate: total > 0 ? sandboxErrors / total : 0,
	};
}

// ---- Indexing metrics (AC-2) ----

/** One row of the IndexRun table (structural — DB row or fixture). */
export interface IndexRunLike {
	kind: string;
	status: string;
	fileDelta: number | null;
}

export interface IndexingMetrics {
	runCount: number;
	/** Mean/max of non-null file deltas (full re-indexes excluded). */
	avgFileDelta: number | null;
	maxFileDelta: number | null;
	/** full runs / total runs, 0..1. */
	fallbackRate: number;
	/** failed runs / total runs, 0..1. */
	failureRate: number;
}

/**
 * Aggregates IndexRun rows over a window (AC-2). Full re-indexes carry a
 * null fileDelta and count toward the fallback rate.
 */
export function computeIndexingMetrics(runs: IndexRunLike[]): IndexingMetrics {
	const total = runs.length;
	const fullRuns = runs.filter((r) => r.kind === "full").length;
	const failed = runs.filter((r) => r.status === "failed").length;
	const deltas = runs
		.map((r) => r.fileDelta)
		.filter((d): d is number => typeof d === "number");

	const avg =
		deltas.length > 0
			? deltas.reduce((sum, d) => sum + d, 0) / deltas.length
			: null;
	const max = deltas.length > 0 ? Math.max(...deltas) : null;

	return {
		runCount: total,
		avgFileDelta: avg,
		maxFileDelta: max,
		fallbackRate: total > 0 ? fullRuns / total : 0,
		failureRate: total > 0 ? failed / total : 0,
	};
}

// ---- Alert thresholds (AC-3) ----

export interface MetricThresholds {
	/** Sandbox error rate (0..1) above which an alert fires. */
	sandboxErrorRate: number;
	/** Verify p95 duration in ms above which an alert fires. */
	verifyP95Ms: number;
	/** Indexing failure OR fallback rate (0..1) above which an alert fires. */
	indexingRate: number;
}

export const DEFAULT_METRIC_THRESHOLDS: MetricThresholds = {
	sandboxErrorRate: 0.2,
	verifyP95Ms: 100_000,
	indexingRate: 0.2,
};

/** Reads thresholds from the environment, falling back per-var to defaults. */
export function loadThresholds(
	env: Record<string, string | undefined>
): MetricThresholds {
	const positive = (value: string | undefined, fallback: number) => {
		const n = Number(value);
		return Number.isFinite(n) && n > 0 ? n : fallback;
	};
	return {
		sandboxErrorRate: positive(
			env.METRICS_ALERT_SANDBOX_ERROR_RATE,
			DEFAULT_METRIC_THRESHOLDS.sandboxErrorRate
		),
		verifyP95Ms: positive(
			env.METRICS_ALERT_VERIFY_P95_MS,
			DEFAULT_METRIC_THRESHOLDS.verifyP95Ms
		),
		indexingRate: positive(
			env.METRICS_ALERT_INDEXING_RATE,
			DEFAULT_METRIC_THRESHOLDS.indexingRate
		),
	};
}

// ---- Alert evaluation (AC-3) ----

export type FiredAlertKind = "sandbox_error_rate" | "verify_p95" | "indexing";

export interface FiredAlert {
	kind: FiredAlertKind;
	message: string;
}

/**
 * Evaluates the configured thresholds against the current metrics and returns
 * the alerts that fired (AC-3). Thresholds are strict: exactly-at does not
 * fire. Never throws — an empty array means healthy.
 */
export function evaluateAlerts(
	verify: VerifyMetrics,
	indexing: IndexingMetrics,
	thresholds: MetricThresholds
): FiredAlert[] {
	const alerts: FiredAlert[] = [];

	if (verify.sandboxErrorRate > thresholds.sandboxErrorRate) {
		alerts.push({
			kind: "sandbox_error_rate",
			message: `Sandbox error rate is ${(verify.sandboxErrorRate * 100).toFixed(
				1
			)}% over the last 7 days (threshold ${(
				thresholds.sandboxErrorRate * 100
			).toFixed(0)}%).`,
		});
	}

	if (
		verify.p95DurationMs !== null &&
		verify.p95DurationMs > thresholds.verifyP95Ms
	) {
		alerts.push({
			kind: "verify_p95",
			message: `p95 verify duration is ${(verify.p95DurationMs / 1000).toFixed(
				1
			)}s over the last 7 days (threshold ${(
				thresholds.verifyP95Ms / 1000
			).toFixed(0)}s).`,
		});
	}

	if (
		indexing.failureRate > thresholds.indexingRate ||
		indexing.fallbackRate > thresholds.indexingRate
	) {
		alerts.push({
			kind: "indexing",
			message: `Indexing failure rate is ${(
				indexing.failureRate * 100
			).toFixed(1)}% and fallback-to-full rate is ${(
				indexing.fallbackRate * 100
			).toFixed(1)}% over the last 7 days (threshold ${(
				thresholds.indexingRate * 100
			).toFixed(0)}%).`,
		});
	}

	return alerts;
}
