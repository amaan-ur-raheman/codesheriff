import { describe, it, expect } from "vitest";
import {
	computePercentile,
	computeVerifyMetrics,
	computeIndexingMetrics,
	loadThresholds,
	evaluateAlerts,
	DEFAULT_METRIC_THRESHOLDS,
} from "@/modules/admin/lib/metrics";

describe("computePercentile (Spec 0006 AC-1)", () => {
	it("returns null for an empty set", () => {
		expect(computePercentile([], 50)).toBeNull();
	});

	it("computes the 50th percentile (median) using nearest-rank", () => {
		expect(computePercentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
	});

	it("computes the 95th percentile", () => {
		expect(computePercentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
	});

	it("handles a single value", () => {
		expect(computePercentile([42], 95)).toBe(42);
	});

	it("does not mutate the input order", () => {
		const values = [10, 1, 9, 2];
		computePercentile(values, 50);
		expect(values).toEqual([10, 1, 9, 2]);
	});
});

describe("computeVerifyMetrics (Spec 0006 AC-1)", () => {
	it("computes p50/p95 duration and sandbox error rate from structured statuses", () => {
		const suggestions = [
			{ verifyStatus: "verified", verifyDurationMs: 100 },
			{ verifyStatus: "verified", verifyDurationMs: 200 },
			{ verifyStatus: "failed", verifyDurationMs: 300 },
			{ verifyStatus: "sandbox_error", verifyDurationMs: 400 },
		];

		const metrics = computeVerifyMetrics(suggestions);

		expect(metrics.sampleCount).toBe(4);
		expect(metrics.p50DurationMs).toBe(200);
		expect(metrics.p95DurationMs).toBe(400);
		expect(metrics.sandboxErrorRate).toBe(0.25);
	});

	it("parses legacy boolean verified flags and counts them in the sample", () => {
		const metrics = computeVerifyMetrics([
			{ verified: true },
			{ verified: false },
			{},
		]);

		expect(metrics.sampleCount).toBe(2);
		expect(metrics.sandboxErrorRate).toBe(0);
		expect(metrics.p50DurationMs).toBeNull();
	});

	it("returns zeros/nulls when no suggestion has a verify outcome", () => {
		const metrics = computeVerifyMetrics([{}, {}, {}]);

		expect(metrics.sampleCount).toBe(0);
		expect(metrics.p50DurationMs).toBeNull();
		expect(metrics.p95DurationMs).toBeNull();
		expect(metrics.sandboxErrorRate).toBe(0);
	});

	it("ignores suggestions without verifyDurationMs for percentiles", () => {
		const metrics = computeVerifyMetrics([
			{ verifyStatus: "verified", verifyDurationMs: 100 },
			{ verifyStatus: "verified" },
		]);

		expect(metrics.sampleCount).toBe(2);
		expect(metrics.p50DurationMs).toBe(100);
		expect(metrics.p95DurationMs).toBe(100);
	});
});

describe("computeIndexingMetrics (Spec 0006 AC-2)", () => {
	const run = (
		kind: string,
		status: string,
		fileDelta: number | null = null
	) => ({ kind, status, fileDelta });

	it("computes run count, avg/max delta, and fallback rate", () => {
		const metrics = computeIndexingMetrics([
			run("incremental", "success", 4),
			run("incremental", "success", 6),
			run("full", "success"),
			run("incremental", "success", 2),
		]);

		expect(metrics.runCount).toBe(4);
		expect(metrics.avgFileDelta).toBe(4);
		expect(metrics.maxFileDelta).toBe(6);
		expect(metrics.fallbackRate).toBe(0.25);
		expect(metrics.failureRate).toBe(0);
	});

	it("counts failed runs in the failure rate", () => {
		const metrics = computeIndexingMetrics([
			run("incremental", "success"),
			run("incremental", "failed"),
			run("incremental", "failed"),
		]);

		expect(metrics.failureRate).toBeCloseTo(2 / 3);
		expect(metrics.fallbackRate).toBe(0);
	});

	it("returns zeros/nulls for an empty window", () => {
		const metrics = computeIndexingMetrics([]);

		expect(metrics.runCount).toBe(0);
		expect(metrics.avgFileDelta).toBeNull();
		expect(metrics.maxFileDelta).toBeNull();
		expect(metrics.fallbackRate).toBe(0);
		expect(metrics.failureRate).toBe(0);
	});

	it("excludes full runs (null delta) from the delta stats", () => {
		const metrics = computeIndexingMetrics([
			run("full", "success"),
			run("incremental", "success", 10),
		]);

		expect(metrics.avgFileDelta).toBe(10);
		expect(metrics.maxFileDelta).toBe(10);
		expect(metrics.fallbackRate).toBe(0.5);
	});
});

describe("loadThresholds (Spec 0006 AC-3)", () => {
	it("falls back to defaults when env vars are missing or invalid", () => {
		expect(loadThresholds({})).toEqual(DEFAULT_METRIC_THRESHOLDS);
		expect(loadThresholds({ METRICS_ALERT_SANDBOX_ERROR_RATE: "abc" })).toEqual(
			DEFAULT_METRIC_THRESHOLDS
		);
		expect(
			loadThresholds({ METRICS_ALERT_SANDBOX_ERROR_RATE: "0" })
		).toEqual(DEFAULT_METRIC_THRESHOLDS);
	});

	it("reads each threshold from the environment", () => {
		expect(
			loadThresholds({
				METRICS_ALERT_SANDBOX_ERROR_RATE: "0.35",
				METRICS_ALERT_VERIFY_P95_MS: "120000",
				METRICS_ALERT_INDEXING_RATE: "0.4",
			})
		).toEqual({
			sandboxErrorRate: 0.35,
			verifyP95Ms: 120000,
			indexingRate: 0.4,
		});
	});
});

describe("evaluateAlerts (Spec 0006 AC-3)", () => {
	const baseVerify = {
		sampleCount: 10,
		p50DurationMs: 1000,
		p95DurationMs: 5000,
		sandboxErrorRate: 0.05,
	};
	const baseIndexing = {
		runCount: 10,
		avgFileDelta: 5,
		maxFileDelta: 20,
		fallbackRate: 0.1,
		failureRate: 0.05,
	};

	it("fires no alerts when everything is below threshold", () => {
		expect(
			evaluateAlerts(baseVerify, baseIndexing, DEFAULT_METRIC_THRESHOLDS)
		).toEqual([]);
	});

	it("fires a sandbox error rate alert above the 20% threshold", () => {
		const alerts = evaluateAlerts(
			{ ...baseVerify, sandboxErrorRate: 0.25 },
			baseIndexing,
			DEFAULT_METRIC_THRESHOLDS
		);
		expect(alerts.map((a) => a.kind)).toContain("sandbox_error_rate");
	});

	it("does not fire exactly at the threshold boundary (strict >)", () => {
		const alerts = evaluateAlerts(
			{ ...baseVerify, sandboxErrorRate: 0.2 },
			baseIndexing,
			DEFAULT_METRIC_THRESHOLDS
		);
		expect(alerts.map((a) => a.kind)).not.toContain("sandbox_error_rate");
	});

	it("fires a verify p95 alert above 100s", () => {
		const alerts = evaluateAlerts(
			{ ...baseVerify, p95DurationMs: 150000 },
			baseIndexing,
			DEFAULT_METRIC_THRESHOLDS
		);
		expect(alerts.map((a) => a.kind)).toContain("verify_p95");
	});

	it("does not fire a verify p95 alert when no durations exist", () => {
		const alerts = evaluateAlerts(
			{ ...baseVerify, p95DurationMs: null },
			baseIndexing,
			DEFAULT_METRIC_THRESHOLDS
		);
		expect(alerts.map((a) => a.kind)).not.toContain("verify_p95");
	});

	it("fires an indexing alert when the failure rate exceeds the threshold", () => {
		const alerts = evaluateAlerts(
			baseVerify,
			{ ...baseIndexing, failureRate: 0.3 },
			DEFAULT_METRIC_THRESHOLDS
		);
		expect(alerts.map((a) => a.kind)).toContain("indexing");
	});

	it("fires an indexing alert when the fallback rate exceeds the threshold", () => {
		const alerts = evaluateAlerts(
			baseVerify,
			{ ...baseIndexing, fallbackRate: 0.5 },
			DEFAULT_METRIC_THRESHOLDS
		);
		expect(alerts.map((a) => a.kind)).toContain("indexing");
	});

	it("fires multiple alerts simultaneously", () => {
		const alerts = evaluateAlerts(
			{ ...baseVerify, sandboxErrorRate: 0.5, p95DurationMs: 200000 },
			{ ...baseIndexing, fallbackRate: 0.6 },
			DEFAULT_METRIC_THRESHOLDS
		);
		expect(alerts.map((a) => a.kind).sort()).toEqual([
			"indexing",
			"sandbox_error_rate",
			"verify_p95",
		]);
	});
});
