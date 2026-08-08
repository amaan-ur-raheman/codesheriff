# 0001. Sandbox isolation hardening

**Date**: 2026-07-17
**Status**: Proposed

## Summary

Code Sheriff already verifies AI suggested fixes by running tests in a temporary checkout (modules/ai/lib/sandbox.ts, wired into the review Inngest function). Today that runs on the host process with the GitHub token placed in the clone URL and no timeout or network limit. This spec hardens that verify step into a real sandbox and shows the result to the user. The goal is safety and trust, not new behavior.

## Context

The review pipeline already calls verifySuggestionsInSandbox for every suggestion that changes code. The function clones the PR branch with a token injected into the URL (x-access-token:<token>@github.com), then runs `bun test` or `npm run test` via Node child_process exec in /tmp. Three problems follow. First, the repository token lives in a process argument and a URL that can be logged. Second, the test command runs with full network and host access, so a malicious or buggy suggestion can exfiltrate data or touch the host. Third, there is no timeout or memory limit, so a hanging test can pin the worker. The verify result is computed but never shown to the user on the PR comment or in the dashboard, so the verified promise is invisible. None of this blocks shipping, but it undermines the product's core safety claim.

## Requirements

**User stories**:
- As a repository owner, I want suggested fixes checked in an isolated environment so a bad suggestion cannot harm my system or leak my token.
- As a reviewer, I want to see whether a suggestion passed its sandbox check before I trust it.

**Acceptance criteria**:
- **AC-1**: Each suggestion verify runs with no network egress and no access to host secrets or the repository token.
- **AC-2**: The GitHub credential is supplied without ever appearing in a clone URL or process argument, and is never written to logs.
- **AC-3**: A verify run is timeboxed (default 120 seconds) and memory limited; an overrun is terminated and reported as a sandbox error, not a failed suggestion.
- **AC-4**: The verify outcome (verified, not verified with reason, or sandbox error, plus duration) is shown on the PR comment for that suggestion and in the dashboard review view.
- **AC-5**: If the sandbox environment is unavailable, the suggestion is still posted (unlabeled) and the infra failure is logged; the review never fails.
- **AC-6**: A feature flag selects the isolation mode (container or in-process fallback) so the feature runs where Docker is absent.

## Options considered

### Option 1: Run each verify in an ephemeral container

Each verify clones and tests inside a short lived container with network disabled, a read only code mount, a dropped token via git credential helper, and a hard timeout.

**Pros**:
- Real isolation; a malicious suggestion cannot reach the host or the network.
- Matches the product's stated isolated sandbox promise.

**Cons**:
- Requires the Inngest worker host to run containers (Docker or an equivalent).
- Adds an operational dependency to monitor and patch.

### Option 2: Harden the in-process exec

Keep child_process exec but add a timeout, run as an unprivileged user, disable network where available, and pass the token through a credential helper instead of the URL.

**Pros**:
- No new infrastructure; runs anywhere the worker runs.

**Cons**:
- Still shares the host kernel; isolation is weaker than a container.
- Token handling and network restriction are platform dependent and easy to get wrong.

### Option 3: Use a hosted sandbox service

Offload execution to a managed sandbox provider (for example E2B or Daytona).

**Pros**:
- Zero infrastructure to operate.

**Cons**:
- Sends customer code to a third party.
- Adds per run cost and a hard external dependency on review latency.

## Decision

**Chosen option**: Option 3, a **hosted sandbox service (E2B)**, with `SANDBOX_MODE` selecting between `sandbox` (E2B, the production default) and `exec` (hardened in-process, local-dev only).

**Chosen because the deploy target rules out the other options.** Code Sheriff's intended deploy target is Vercel (serverless) + Inngest Cloud (research ticket #42). Vercel Functions are AWS-Lambda-backed and **cannot run Docker** and **do not ship `git`/`bun`**, so Spec 0001's original Option 1 (ephemeral containers on the worker) is infeasible without introducing a second Docker-capable deploy target, and Option 2 (`exec`) cannot run `git clone`/`bun` on the Vercel runtime at all. A hosted sandbox (E2B) is called from the existing Inngest step over HTTP and satisfies AC-1/AC-2/AC-3/AC-4 directly. **E2B** specifically: its Hobby tier is perpetually free (no credit card, 20 concurrent sandboxes, 1-hour session cap — ample for verify volume), and its JS SDK is the most mature with many case studies in the git-clone→apply→test shape. The `SANDBOX_MODE` abstraction keeps E2B swappable to Daytona later if native git-credential fidelity ever matters more. `exec` remains a local-dev-only fallback (laptops have `git`/`bun`/Docker); it must **not** be relied on in production.

**Verify-loop structure**: one E2B sandbox per review. Clone the repo once (via a git credential helper, not a URL token), install dependencies once, then apply each suggestion's diff and run the test command within that same sandbox session, tearing the sandbox down at the end. This minimizes billable runtime, preserves per-suggestion verification results (AC-4), and keeps the whole verify under the 120 s timebox (AC-3).

## Rationale

The product's value is trust: it posts code changes on a customer's repository. Running that untrusted code with a token in the URL and open network on the same host is the failure mode the whole feature exists to prevent. A hosted E2B sandbox removes it directly — network disabled, token supplied via credential helper (never the URL), isolated VM disposed after each review. The `SANDBOX_MODE` flag (defaulting to `sandbox`) acknowledges that a sandbox provider could be unavailable, so the verify step degrades gracefully: a `sandbox_error` result is recorded and the review posts unlabeled (AC-5) rather than blocking. `exec` mode is retained only for local development where a real container runtime (Docker) is available on the developer's machine — it is never the production default.

## Feature design

**Data model sketch**:
No schema migration. The verify result is stored inside the existing `Review.suggestions` JSON field (already Json), one block per suggestion:
- `verified`: boolean or null (null = not checked, e.g. prose only or sandbox unavailable)
- `verifyStatus`: "verified" | "failed" | "sandbox_error"
- `verifyError`: string, nullable, short excerpt
- `verifyDurationMs`: number, nullable

**API surface**:
Internal only. The `verify-suggestions-sandbox` Inngest step gains a mode switch and returns results that flow into the existing comment and dashboard payloads. No new public endpoint.

**Key invariants**:
- The token is never in a URL or logged; it reaches git only through a credential helper or short lived env var cleared after clone.
- A verify overrun is a sandbox error (AC-3), never a failed suggestion.
- Review posting never depends on the sandbox succeeding (AC-5).

**Security model**: Network egress disabled in the E2B sandbox. No secrets, env files, or credentials mounted beyond the single-use clone token, which is scoped to the repo and revoked after the run. The sandbox VM is disposed after each review (one sandbox per review).

**Configuration required**:
- `SANDBOX_MODE`: `sandbox` (E2B, production default) or `exec` (hardened in-process, local-dev only)
- `SANDBOX_TIMEOUT_MS`: verify time limit, default `120000`
- `SANDBOX_MAX_MEMORY_MB`: sandbox memory cap, default `512`
- `E2B_API_KEY`: API key for the sandbox provider (production)

## Build plan

1. Add `SANDBOX_MODE`, `SANDBOX_TIMEOUT_MS`, `SANDBOX_MAX_MEMORY_MB` config and a `runVerifyInSandbox` path (E2B) that clones via a credential helper (no token in URL), disables network, enforces the timeout and memory cap, satisfies **AC-1**, **AC-2**, **AC-3**
2. Keep `runVerifyInProcess` as the hardened fallback (timeout, unprivileged, credential helper) used when `SANDBOX_MODE=exec`, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-6**
3. On container or runtime unavailability, return a `sandbox_error` result and let the review proceed unlabeled, satisfies **AC-5**
4. Write `verified`, `verifyStatus`, `verifyError`, `verifyDurationMs` into each suggestion object in `Review.suggestions`, satisfies **AC-4**
5. Render the verify status on the PR comment block and the dashboard review view from the suggestion object, satisfies **AC-4**

## Consequences

**Positive**:
- Untrusted suggestions can no longer reach the host or network during verification.
- The token is no longer exposed in URLs or logs.
- Users can see which suggestions were actually verified.

**Negative / tradeoffs**:
- Adds a dependency on a third-party sandbox provider (E2B) and per-sandbox runtime cost (negligible at current volume; E2B Hobby tier is free).
- Each verify adds a sandbox-create + clone latency to the review.

**Neutral**:
- No database migration; results live in the existing JSON column.

## Follow-up

- [x] Confirm the production Inngest worker host can run containers — **resolved: it cannot.** Vercel serverless has no Docker daemon and no `git`/`bun`; this is why the strategy is now a hosted sandbox (E2B), not in-process containers.
- [ ] Add a metric for verify duration and sandbox error rate.

## Migration plan

**Strategy**: feature-flagged (no database migration; behavior switch behind `SANDBOX_MODE`)
**Phases**:
1. Implement `runVerifyInSandbox` (E2B) behind the flag; `SANDBOX_MODE` defaults to `sandbox` in production, `exec` in local dev. Behavior changes only when the sandbox is available — otherwise a `sandbox_error` result (AC-5) and the review proceeds unlabeled.
2. Wire the `SANDBOX_MODE=sandbox` path to set `verified`/`verifyStatus`/`verifyError`/`verifyDurationMs` in `Review.suggestions`, and to render the verify status on the PR comment and dashboard (AC-4).
**Rollback**: set `SANDBOX_MODE=exec` to fall back to the in-process path with no deploy.
**Risks**: a sandbox-provider outage turns verifies into `sandbox_error` results (reviews still post, unlabeled); mitigate by surfacing the error in the dashboard and alerting on sandbox error rate.
