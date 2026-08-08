# 0006. Verify & indexing metrics with alerting

**Date**: 2026-08-07
**Status**: Approved — decisions locked by wayfinder grilling (2026-08-07)

## Summary

Code Sheriff already computes and stores the raw signal for review health — per-suggestion sandbox verify results (`verifyStatus`, `verifyError`, `verifyDurationMs`) live in `Review.suggestions` JSON, and the incremental indexing track (Spec 0002) will produce per-run outcomes. None of it is visible today: the admin dashboard's `avgReviewTime` is a hardcoded `0` placeholder, and nobody is told when the sandbox starts failing or indexing breaks. This spec makes the verify and indexing pipelines observable: DB-derived metrics, surfaced on the admin dashboard, with alerting to the channels the org already uses.

## Context

The verify step (Spec 0001, implemented) writes per-suggestion results into the `Review.suggestions` JSON column. The indexing track (Spec 0002) will add `Repository.lastIndexedCommitSha` and an incremental Inngest function — currently producing no run-level record. The notification infrastructure already exists and is org-scoped: `deliverToIntegrations` (Slack/Discord webhooks), Resend email, and the in-app `Notification` model. The admin module exists but `avgReviewTime` is `0` — a placeholder waiting on this spec. Inngest Cloud (the production deploy target per Spec 0007) ships built-in run/step analytics, which covers function-level failures at zero infra; this spec covers the product-level, DB-derived metrics.

## Requirements

**User stories**:
- As an operator, I want to see verify duration and sandbox error rate over time, so that I can tell when the review pipeline is degrading.
- As an operator, I want to see incremental indexing runs (count, file delta, fallback rate), so that I can tell when indexing is broken or thrashing.
- As an operator, I want alerts on Slack/Discord, email, and in-app when thresholds are crossed, so that I notice before users do.

**Acceptance criteria**:
- **AC-1**: Verify metrics are computed from the existing `Review.suggestions` JSON: p50/p95 `verifyDurationMs` and sandbox error rate (`sandbox_error` / total suggestions) over a trailing 7-day window.
- **AC-2**: Indexing metrics come from a new `IndexRun` table: run count, avg/max file delta, and full-reindex fallback rate.
- **AC-3**: Alerts fire on thresholds — sandbox error rate > 20% (7d), verify p95 > 100 s, indexing failure or fallback rate > 20% — delivered via org Slack/Discord webhooks, email (respecting the `emailNotifications` preference), and in-app notification.
- **AC-4**: The admin dashboard shows the real metrics (replacing the `avgReviewTime: 0` placeholder) with a small verify + indexing panel.

## Options considered

### Option 1: DB-derived metrics in Postgres

Aggregate `Review.suggestions` JSON via Prisma and a new `IndexRun` table; alert on a scheduled check.

**Pros**: No new infra; the data already exists; works on the deploy target (Vercel + Postgres); Inngest Cloud complements with function-level analytics.
**Cons**: Percentile math over JSON in JS; 7-day window queries.

### Option 2: Third-party observability service

Ship metrics to a hosted APM/metrics service.

**Pros**: Rich dashboards, alerting UIs.
**Cons**: New dependency and cost; the deploy target already has Inngest Cloud analytics for function-level signal; product-level metrics are a small, DB-shaped query.

### Option 3: Inngest Cloud analytics only

Rely on Inngest Cloud's built-in run/step analytics.

**Pros**: Zero infra.
**Cons**: Covers function runs, not product-level outcomes (sandbox error rate, file delta); not surfaced in the admin dashboard; not alertable on the product thresholds.

## Decision

**Chosen option**: Option 1, DB-derived Postgres metrics, with Inngest Cloud analytics as a complement for function-level failures.

It is the only option that turns the data already stored into product-level signals with no new infrastructure, and it reuses the existing notification delivery for alerting. Inngest Cloud's dashboards remain the place to inspect function/step executions.

## Rationale

The metric inputs are already persisted — the spec is about aggregation, storage of run records, and delivery. DB-derived keeps the data model closed (no third party sees review internals), reuses the org-scoped notification plumbing built for Spec 0004, and stays within the Postgres-only constraint of the Vercel + Neon deploy target. A minimal v1 set covers both specs' follow-ups (0001: verify duration + sandbox error rate; 0002: incremental run count, file delta, fallback rate) without building a general metrics platform.

## Feature design

**Data model sketch**:
- `IndexRun`: `repoId`, `runAt`, `kind` (`"incremental"` | `"full"`), `fileDelta` (number, nullable for full runs), `status` (`"success"` | `"failed"`), `error` (String, nullable), `durationMs` (number, nullable). Written by the incremental function per run.
- Verify metrics reuse the existing `Review.suggestions` JSON — no new schema. Prisma JSON extraction; percentiles computed in JS.

**API surface**:
| Surface | Trigger | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `getVerifyMetrics()` | admin dashboard load | window (7d) | p50/p95 duration, sandbox error rate, trend | admin | 401 unauthenticated |
| `getIndexingMetrics()` | admin dashboard load | window (7d) | run count, avg/max delta, fallback rate | admin | 401 unauthenticated |
| Alert check | scheduled (Inngest cron) or on-write | threshold config | Slack/Discord + email + notification | internal | 500 delivery failure |

**Key invariants**:
- Verify metrics derive only from the existing suggestions JSON (legacy + current shapes both parsed).
- `IndexRun` rows are written once per incremental run by the function; fallback rate = full runs / total runs.
- Alert delivery reuses `deliverToIntegrations` (org-scoped) and respects the `emailNotifications` preference.

**Security model**: Admin-only metric access; alert checks run server-side with no user input.

**Configuration required**:
- `METRICS_ALERT_SANDBOX_ERROR_RATE`: default `0.20`
- `METRICS_ALERT_VERIFY_P95_MS`: default `100000`
- `METRICS_ALERT_INDEXING_RATE`: default `0.20`

## Build plan

1. Add the `IndexRun` Prisma model and migrate, satisfies **AC-2**
2. Implement `getVerifyMetrics()` (p50/p95 `verifyDurationMs`, sandbox error rate, trailing 7d) in the admin module, satisfies **AC-1**
3. Implement `getIndexingMetrics()` (run count, avg/max file delta, fallback rate) from `IndexRun`, satisfies **AC-2**
4. Write an `IndexRun` row per incremental run in the Spec 0002 function, satisfies **AC-2**
5. Add threshold checks (scheduled or on-write) delivering via `deliverToIntegrations` + email + `Notification`, satisfies **AC-3**
6. Replace the `avgReviewTime: 0` placeholder with real p50/p95 + rates and add a metrics panel to the admin dashboard, satisfies **AC-4**

## Consequences

**Positive**:
- Review-pipeline health becomes visible and alertable.
- Reuses existing notification plumbing; no new infra.
- Fills the dashboard placeholder with real data.

**Negative / tradeoffs**:
- Percentile math over JSON lives in app code.
- A scheduled alert check adds one cron surface.

**Neutral**:
- Inngest Cloud analytics remain the function-level view.

## Follow-up

- [ ] Per-org surfacing of metrics on org dashboards (currently admin-only).
- [ ] Alert snoozing / routing per org.

## Migration plan

**Strategy**: additive — one new table; verify metrics read existing data
**Phases**:
1. Add `IndexRun` table and ship `getVerifyMetrics`/`getIndexingMetrics` behind admin auth.
2. Wire the Spec 0002 function to write `IndexRun` rows.
3. Enable alert checks and the dashboard panel.
**Rollback**: disable alert checks via config; remove the dashboard panel; `IndexRun` stays unused and safe.
**Risks**: JSON shape drift across review versions — mitigate by parsing legacy + current shapes defensively.
