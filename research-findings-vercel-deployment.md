# Research Findings: Live Vercel Deployment & Production Config

**Ticket**: Research: Audit the live Vercel deployment and production config
**Date**: 2026-08-07
**Repo**: `amaan-ur-raheman/codesheriff`
**Scope**: Informs the production cutover grilling (map's deploy capstone).

---

## TL;DR / Headline answer

The live domain **`codesheriff.amaanurraheman.qzz.io` is a live, current Vercel deployment** of this app — confirmed `server: Vercel`, HTTP 200 on `/`. All three key API routes are **already deployed and live**: `/api/inngest` (returns `401 {"message":"Unauthorized"}` — the `serve()` handler is present and enforcing auth), `/api/webhooks/github` (405 on GET, `401 {"error":"Missing signature"}` on unsigned POST — the webhook route is live and verifying signatures), and `/api/repos` (401 — auth-gated). **The gap is not "deploy the app"; it's provisioning env vars, pointing GitHub webhooks at the live domain, and moving Inngest from local `inngest dev` to Inngest Cloud.**

The repo itself has **no `vercel.json` and no `.vercel/` directory** — the deployment was created outside the repo (Vercel dashboard/CLI link). The review workflow currently operates via ngrok + local `next dev` + `inngest dev`, but the live deployment already serves the current code.

## 1. What's deployed

- `GET /` → 200, `server: Vercel`, Next.js headers (`x-powered-by: Next.js`, `x-matched-path: /`), RSC/streaming headers. A real Next.js 16 App Router build.
- `GET /api/inngest` → 401 `{"message":"Unauthorized"}` — the Inngest `serve()` handler is deployed and rejects unsigned requests.
- `POST /api/inngest` (empty JSON) → 401 `{"message":"Unauthorized"}` — same.
- `GET /api/webhooks/github` → 405 — route exists (method not allowed).
- `POST /api/webhooks/github` (no signature) → 401 `{"error":"Missing signature"}` — signature verification is live (matches `modules/webhooks.ts` behavior).
- `GET /api/repos` → 401 — auth-gated API live.

**Conclusion**: the deployed build includes the current API surface. "Current main" is likely deployed; the exact commit/branch cannot be verified without Vercel dashboard access (no `vercel.json`/`.vercel` link metadata in the repo).

## 2. Env-var surface needed for production

Keys referenced by code (`grep -rhoE 'process\.env\.[A-Z_]+' packages/web`):

| Key | Needed for |
|---|---|
| `DATABASE_URL` | Prisma (PostgreSQL/Neon) |
| `BETTER_AUTH_URL` | Better Auth (must be the live domain, not localhost) |
| `BETTER_AUTH_SECRET` | session signing |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth login |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` | GitHub App auth (check runs, comments) |
| `GITHUB_WEBHOOK_SECRET` | webhook signature verification |
| `PINECONE_DB_API_KEY` | vector store |
| `OPENCODE_API_KEY` / `OPENCODE_MODEL` | default AI provider (OpenCode Zen) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini fallback provider |
| `E2B_API_KEY` | sandbox verification (`SANDBOX_MODE=sandbox`) |
| `SANDBOX_MODE` | `sandbox` (default) vs `exec` |
| `SANDBOX_TIMEOUT_MS` / `SANDBOX_MAX_MEMORY_MB` | sandbox tuning |
| `WEBHOOK_DELIVERY_ENABLED` | Slack/Discord delivery flag |
| `WEBHOOK_DELIVERY_TIMEOUT_MS` | delivery timeout |
| `POLAR_ACCESS_TOKEN` / `POLAR_WEBHOOK_SECRET` / `POLAR_SUCCESS_URL` | billing |
| `RESEND_API_KEY` | email notifications |
| `NEXT_PUBLIC_APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` | public base URLs (must be live domain) |
| `CODESHERIFF_API_KEY` | CLI/API auth |
| `RUN_INTEGRATION_TESTS` | test-only flag (do not set in prod) |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Inngest Cloud (see §4) |

## 3. What breaks when moving from ngrok to the live domain

- **`BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_*`**: must be the live domain; auth cookies/redirects and public API calls otherwise point at `localhost:3000` or the ngrok URL (the research-findings for deploy-target-isolation noted `.env` currently sets `NEXT_PUBLIC_APP_BASE_URL` to an ngrok tunnel).
- **GitHub webhook URL**: webhooks currently deliver to the ngrok tunnel; must be re-pointed to `https://codesheriff.amaanurraheman.qzz.io/api/webhooks/github` (same secret).
- **Inngest**: local `inngest dev` drives the local queue; production needs Inngest Cloud (see §4).
- **Sandbox**: `SANDBOX_MODE=sandbox` + `E2B_API_KEY` must be set in Vercel env; otherwise verifies silently report `sandbox_error` and suggestions post unlabeled (graceful, per Spec 0001 AC-5).
- **Function duration**: Vercel Hobby caps at 300 s per invocation — the verify step runs inside one Inngest step (one HTTP request to Vercel), so `SANDBOX_TIMEOUT_MS` should stay ≤ 120 s (spec default) and Vercel `maxDuration` should be raised for `/api/inngest` if needed.

## 4. Inngest Cloud on Vercel (from Inngest docs)

- **Env vars**: `INNGEST_EVENT_KEY` (dashboard → environment → Event keys; authenticates `inngest.send()`) and `INNGEST_SIGNING_KEY` (dashboard → Signing Key tab; authenticates bidirectional comms with your `/api/inngest` endpoint). Optional: `INNGEST_SIGNING_KEY_FALLBACK` (zero-downtime key rotation), `INNGEST_SERVE_ORIGIN` (override the inferred Vercel URL when using a custom domain), `INNGEST_BASE_URL` (custom API endpoint, advanced).
- **Signing mechanism**: Inngest Cloud signs every HTTP call to `/api/inngest` with the environment's signing key; the SDK's `serve()` handler verifies the signature + timestamp (rejects old requests → replay protection). Outbound calls from the app to Inngest use the event key.
- **serve() pattern** (`app/api/inngest/route.ts`): `export const { GET, POST, PUT } = serve({ client: inngest, functions })`. This is already what the repo does — no code change needed to go from dev to cloud; just set the env vars.
- **`INNGEST_DEV`**: must NOT be set (or be falsy) in production; `inngest dev` runs a local dev server UI and bypasses signing-key checks.
- **Vercel gotchas**: function max duration applies to each step call; Inngest retries steps on non-2xx/timeouts, so a Vercel timeout becomes a retryable step failure. Recommend raising `maxDuration` on `/api/inngest` if the verify step approaches the cap.

## 5. Metrics / observability (Inngest Cloud)

Inngest Cloud provides built-in analytics in the dashboard: function run statuses (success/failure/running/cancelled), step-by-step execution durations and latency, execution logs, error payloads, and retry attempts. **This satisfies the "verify duration + sandbox error rate" observability need at zero infra** — relevant to the metrics grilling.

## Open questions / ambiguities

- Exact deployed commit/branch requires Vercel dashboard access (no repo-side link metadata).
- Whether the live domain is Hobby or Pro plan is unknown (affects the 300 s vs 800 s duration cap) — verify in the Vercel dashboard during cutover.
- Webhook secret value is unknown to this research (env-only) — must be available during cutover to re-point webhooks.

## Sources

- Live HTTP probes of `codesheriff.amaanurraheman.qzz.io` (2026-08-07): `/`, `/api/inngest`, `/api/webhooks/github`, `/api/repos`.
- Repo grep of `process.env.*` keys across `packages/web`.
- Inngest docs: `inngest.com/docs/events/creating-an-event-key`, `inngest.com/docs/platform/signing-keys`, `inngest.com/docs/deploy/vercel`, `inngest.com/docs/learn/security`.
- Prior art: `research-findings-deploy-target-isolation.md` (deploy-target constraints).
