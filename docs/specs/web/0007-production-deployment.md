# 0007. Production deployment — Vercel + Inngest Cloud cutover

**Date**: 2026-08-07
**Status**: Approved — decisions locked by wayfinder grilling (2026-08-07)

## Summary

The review workflow today runs via ngrok + local `next dev` + `inngest dev`. The live domain `codesheriff.amaanurraheman.qzz.io` is **already a current Vercel deployment** serving the app's API surface (`/api/inngest`, `/api/webhooks/github`, `/api/repos` all live). This spec moves the *workflow* onto that deployment: provision the production env, verify end-to-end through the existing harness, then flip GitHub webhooks and Inngest to production. The cutover is **phased and verify-first** — the existing ngrok + local queue stays up as the test harness and rollback path.

## Context

The Vercel audit (research ticket, 2026-08-07) confirmed: the live domain serves current code; the repo has **no `vercel.json`/`.vercel`** (the deployment was created in the dashboard); ~20 env keys are referenced by code; `serve()` in `app/api/inngest/route.ts` is already the cloud pattern (dev → Cloud is env-only, zero code change); Inngest Cloud needs `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` with `INNGEST_DEV` unset in prod; Vercel Hobby caps functions at 300 s (keep `SANDBOX_TIMEOUT_MS` ≤ 120 s). The E2B research (2026-08-07) confirmed the sandbox can flip to no-egress after install — the posture decision below closes Spec 0001 AC-1's remaining gap in production.

## Requirements

**User stories**:
- As an operator, I want the review pipeline running against the live domain with production env, so that PRs are reviewed without a local tunnel.
- As an operator, I want to know the cutover is safe, so that a broken production review can be rolled back in minutes.
- As a repository owner, I want verify steps to run in an E2B sandbox with no network egress, so that Spec 0001's isolation promise holds in production.

**Acceptance criteria**:
- **AC-1**: The full production env surface is provisioned on the existing Vercel project; deploys flow from git push (repo linked).
- **AC-2**: A real PR is reviewed end-to-end through the existing harness before any production traffic is flipped.
- **AC-3**: GitHub webhooks are re-pointed to the live domain (same secret); Inngest runs on Cloud (`INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY`, `INNGEST_DEV` unset).
- **AC-4**: Verify runs in production via E2B (`SANDBOX_MODE=sandbox` + `E2B_API_KEY`) with graceful exec fallback (Spec 0001 AC-5), and E2B sandboxes deny outbound egress during the test phase (Spec 0001 AC-1).
- **AC-5**: A documented rollback path exists (webhook re-point back to ngrok + unset cloud keys) and takes minutes, not redeploys.

## Options considered

### Option 1: Phased, verify-first cutover (chosen)

Keep the existing Vercel project; provision env; verify end-to-end through the ngrok + local queue harness; then flip webhooks + Inngest Cloud. Rollback = flip webhooks back + unset cloud keys.

**Pros**: The live domain is preserved (no recreate risk); low-cost rollback; the current harness is the test bed.
**Cons**: Two-phase operation; the live domain stays inert until the flip.

### Option 2: Big-bang cutover

Re-point everything to the live domain immediately, then test.

**Pros**: One target, no parallel state.
**Cons**: No low-cost rollback if reviews break; recreating the Vercel project risks breaking the live domain.

### Option 3: Keep ngrok indefinitely

Stay on the tunneled local workflow.

**Pros**: Nothing to do.
**Cons**: Reviews depend on a local machine and tunnel; no production reliability.

## Decision

**Chosen option**: Option 1, phased verify-first cutover. Keep the existing Vercel project (never recreate — it would break the live domain); provision the full env surface; verify through the existing harness; then flip webhooks + Inngest Cloud.

**E2B network posture (closed with this spec)**: **flip to no-egress after install.** Clone + `npm install` run with egress allowed, then `updateNetwork()` denies all outbound traffic before running tests. The test phase — the phase that runs untrusted code — has zero egress, satisfying Spec 0001 AC-1 exactly where it matters. (Alternatives considered and rejected: permanent selective allow-list — more surface to maintain and leak; no policy — AC-1 stays unmet.)

## Rationale

The deployment already exists and serves current code; the gap is env + webhook + Inngest provisioning, not deploying the app. Keeping the project preserves the domain and its DNS, TLS, and existing deployment history. Keeping ngrok + the local queue up through verification means the first production reviews are proven against the same webhook → Inngest → review → comment path that works today, and the rollback is a webhook URL edit rather than a redeploy. The no-egress flip closes the last open isolation gap in production with a minimal, well-scoped change to the shipped runner.

## Feature design

**API surface**: No new endpoints. The cutover touches configuration, webhook URL, and the E2B runner behavior:

| Surface | Change |
|---|---|
| Vercel project env | Provision ~20 keys (below); never `RUN_INTEGRATION_TESTS` |
| GitHub webhook URL | ngrok URL → `https://codesheriff.amaanurraheman.qzz.io/api/webhooks/github`, same `GITHUB_WEBHOOK_SECRET` |
| Inngest | `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` set; `INNGEST_DEV` unset. `serve()` unchanged |
| E2B runner | `updateNetwork()` deny-all after clone + install, before tests |

**Env surface (from the Vercel audit)**:
`DATABASE_URL`, `BETTER_AUTH_URL` (live domain), `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, `GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `PINECONE_DB_API_KEY`, `OPENCODE_API_KEY`/`OPENCODE_MODEL`, `GOOGLE_GENERATIVE_AI_API_KEY`, `E2B_API_KEY`, `SANDBOX_MODE=sandbox`, `SANDBOX_TIMEOUT_MS` (≤ 120 s), `SANDBOX_MAX_MEMORY_MB`, `WEBHOOK_DELIVERY_ENABLED`/`WEBHOOK_DELIVERY_TIMEOUT_MS`, `POLAR_ACCESS_TOKEN`/`POLAR_WEBHOOK_SECRET`/`POLAR_SUCCESS_URL`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_BASE_URL`/`NEXT_PUBLIC_APP_URL` (live domain), `CODESHERIFF_API_KEY`.

**Key invariants**:
- The live domain is never recreated.
- `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_*` point at the live domain, never localhost/ngrok.
- E2B sandboxes have zero egress during the test phase.
- Rollback is webhook re-point + key unset, not a redeploy.

**Security model**: Same secrets as today (webhook secret unchanged); E2B sandbox has no egress during tests; no token ever placed in a clone URL (Spec 0001 AC-2).

**Configuration required**: Full env surface above; `SANDBOX_MODE=sandbox`; Inngest Cloud keys.

## Build plan

1. **Provision (no traffic impact):** keep the Vercel project; add the full env surface in the dashboard; link the repo (vercel link / GitHub integration) so deploys flow from git push. **(AC-1)**
2. **Verify through the harness:** keep ngrok + local `next dev` + `inngest dev` receiving webhooks; open a real PR and confirm webhook → review → comment → verify status end-to-end. **(AC-2)**
3. **Flip:** re-point the GitHub webhook to the live domain (same secret); set `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY`, ensure `INNGEST_DEV` unset. **(AC-3)**
4. **Sandbox in prod:** confirm E2B verifies run (`SANDBOX_MODE=sandbox` + `E2B_API_KEY`) and the exec fallback behaves (AC-5). **(AC-4)**
5. **E2B posture:** update `packages/web/modules/ai/lib/sandbox/e2b-runner.ts` — clone + install with egress, then `updateNetwork()` deny-all before tests. **(AC-4)**
6. **Rollback runbook:** document webhook re-point back to ngrok + unset cloud keys. **(AC-5)**

## Consequences

**Positive**:
- Reviews run against the live domain with production env.
- The last open isolation gap (no-egress) closes in production.
- Inngest Cloud analytics become available for Spec 0006's function-level view.

**Negative / tradeoffs**:
- Webhook + Inngest Cloud are operational dependencies to monitor.
- E2B cost per verify run (free at current volume on Hobby).

**Neutral**:
- No schema migration.

## Follow-up

- [ ] Confirm the live Vercel plan (Hobby vs Pro) affects the 300 s vs 800 s duration cap — verify in the dashboard at cutover.
- [ ] Verify the exact deployed commit/branch once the repo is linked.

## Migration plan

**Strategy**: phased feature-flagged cutover, no schema change
**Phases**:
1. Provision env + link repo (no traffic impact).
2. Verify through the existing harness.
3. Flip webhooks + Inngest Cloud; enable E2B no-egress posture.
**Rollback**: re-point webhooks back to ngrok + unset cloud keys — minutes.
**Risks**: webhook signature mismatch (same secret, low risk); E2B outage (covered by exec fallback, AC-5); Vercel duration cap (mitigated by ≤ 120 s sandbox timeout).
