# Runbook: Production cutover — Vercel + Inngest Cloud

**Spec**: 0007 Production deployment — Vercel + Inngest Cloud cutover
**Live domain**: `https://codesheriff.amaanurraheman.qzz.io`
**Webhook endpoint**: `https://codesheriff.amaanurraheman.qzz.io/api/webhooks/github`
**Strategy**: phased, verify-first. The ngrok + local `next dev` + `inngest dev` harness stays up as the test bed **and** the rollback path until the flip is proven.

---

## Phase 0 — Preconditions (5 min)

- [ ] You are on the Vercel project for **codesheriff** (existing project — **never recreate it**; recreation breaks DNS/TLS/deployment history).
- [ ] You have an Inngest Cloud account (or can create one).
- [ ] Local harness is running and green: `ngrok` → `next dev` → `inngest dev`, and a test PR was reviewed end-to-end recently.
- [ ] This repo is linked to the Vercel project so deploys flow from `git push` (or the GitHub integration is connected).

## Phase 1 — Provision env on Vercel (AC-1, no traffic impact)

Add the full env surface to the Vercel project's **Production** environment. Use the same values as local where a secret is shared; replace dev URLs with the live domain where noted.

### Core app
| Key | Value source | Notes |
|---|---|---|
| `DATABASE_URL` | same as local | prod DB connection string |
| `BETTER_AUTH_URL` | `https://codesheriff.amaanurraheman.qzz.io` | **must be the live domain**, never localhost/ngrok |
| `BETTER_AUTH_SECRET` | same as local | |

### GitHub
| Key | Value source | Notes |
|---|---|---|
| `GITHUB_CLIENT_ID` | same as local | |
| `GITHUB_CLIENT_SECRET` | same as local | |
| `GITHUB_APP_ID` | same as local | |
| `GITHUB_APP_PRIVATE_KEY` | same as local | |
| `GITHUB_WEBHOOK_SECRET` | same as local | **kept identical** so webhook signatures keep validating during the flip |

### AI + retrieval
| Key | Value source | Notes |
|---|---|---|
| `OPENCODE_API_KEY` | same as local | |
| `OPENCODE_MODEL` | same as local | default `mimo-v2.5-free` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | same as local | Gemini fallback |
| `PINECONE_DB_API_KEY` | same as local | |

### Sandbox / verify (Spec 0001 + 0007 AC-4)
| Key | Value source | Notes |
|---|---|---|
| `E2B_API_KEY` | same as local | |
| `SANDBOX_MODE` | `sandbox` | production posture |
| `SANDBOX_TIMEOUT_MS` | `120000` | **≤ 120 s** — Vercel Hobby caps functions at 300 s |
| `SANDBOX_MAX_MEMORY_MB` | `512` | |

### Incremental indexing (Spec 0002) — found by code cross-check, missing from the original audit
| Key | Value source | Notes |
|---|---|---|
| `INCREMENTAL_INDEX_ENABLED` | `true` | feature flag for incremental runs |
| `INDEX_FULL_REINDEX_THRESHOLD` | *(leave unset → code default)* | |
| `INDEX_PUSH_BRANCHES` | *(leave unset → code default)* | |

### Webhook delivery (Spec 0004)
| Key | Value source | Notes |
|---|---|---|
| `WEBHOOK_DELIVERY_ENABLED` | `true` | |
| `WEBHOOK_DELIVERY_TIMEOUT_MS` | *(leave unset → code default)* | |

### Billing (Spec 0003)
| Key | Value source | Notes |
|---|---|---|
| `POLAR_ACCESS_TOKEN` | same as local | |
| `POLAR_WEBHOOK_SECRET` | same as local | |
| `POLAR_SUCCESS_URL` | `https://codesheriff.amaanurraheman.qzz.io/...` | live-domain success URL |
| `POLAR_ORG_PRODUCT_ID` | *(set if org seat pricing is enabled)* | found by code cross-check |

### Notifications + API
| Key | Value source | Notes |
|---|---|---|
| `RESEND_API_KEY` | same as local | |
| `NEXT_PUBLIC_APP_BASE_URL` | `https://codesheriff.amaanurraheman.qzz.io` | |
| `NEXT_PUBLIC_APP_URL` | `https://codesheriff.amaanurraheman.qzz.io` | |
| `CODESHERIFF_API_KEY` | same as local | |

### Inngest Cloud (AC-3) — created in Phase 3, paste here when ready
| Key | Value source | Notes |
|---|---|---|
| `INNGEST_EVENT_KEY` | Inngest Cloud → **Environment** → API keys | do **not** set yet (Phase 3) |
| `INNGEST_SIGNING_KEY` | Inngest Cloud → **Environment** → Signing keys | do **not** set yet (Phase 3) |

### Never set in Production
- `INNGEST_DEV` — must be **unset** (dev → Cloud is env-only; `serve()` needs no code change)
- `RUN_INTEGRATION_TESTS` — never
- `NEXT_PUBLIC_*` pointing at localhost/ngrok

**Verify (AC-1):** after saving, `https://codesheriff.amaanurraheman.qzz.io/api/repos` responds (200/401 per auth), and a fresh deploy from `git push` succeeds.

## Phase 2 — Verify through the harness (AC-2)

Keep ngrok + local queue receiving webhooks. Open a **real PR** on a connected repo and confirm the full path end-to-end:
webhook → review generation → comment posted → verify status rendered on the PR comment and the dashboard.

Only proceed to Phase 3 when this passes against the harness.

## Phase 3 — Flip (AC-3)

1. **GitHub webhook re-point**: GitHub App settings → webhook URL → `https://codesheriff.amaanurraheman.qzz.io/api/webhooks/github` (keep the existing secret). Deliveries should report 200.
2. **Inngest Cloud**:
   - Create a Cloud environment (e.g. `production`).
   - Copy `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` into the Vercel Production env.
   - Confirm `INNGEST_DEV` is **not** set.
3. Redeploy (push a commit or use Vercel's redeploy button).
4. Open a second real PR and confirm the review runs through the live domain (check Inngest Cloud run logs for the function executions).

## Phase 4 — Sandbox in prod (AC-4)

With `SANDBOX_MODE=sandbox` + `E2B_API_KEY` set, the review's verify step runs in E2B. Confirm:
- Suggestions with a test script produce `verified`/`failed` per the suite result.
- The runner's **no-egress posture** is active: `updateNetwork({ allowInternetAccess: false })` fires after clone+install and before any test command (deployed code, shipped in this ticket's commit).
- If E2B is unavailable, the **exec fallback** (Spec 0001 AC-5) labels suggestions `sandbox_error` and the review still completes — verify it never hard-fails the review.

## Phase 5 — Rollback (AC-5)

Rollback is a **config edit, not a redeploy** — minutes:

1. **Webhooks**: GitHub App → webhook URL → back to the ngrok URL (same secret).
2. **Inngest**: delete `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` from Vercel Production env (or set `INNGEST_DEV=true` for local dev behavior).
3. **Sandbox** (optional): set `SANDBOX_MODE=exec` to force the local-process fallback.
4. Redeploy. The harness (ngrok + local queue) was never torn down, so traffic resumes immediately.

**Triggers**: webhook signature mismatch, repeated review failures in Inngest Cloud, verify runs failing at unacceptable rates (Spec 0006 alerting covers this).

---

## Post-cutover checklist

- [ ] Confirm the exact deployed commit/branch from the Vercel dashboard (spec 0007 follow-up).
- [ ] Confirm the Vercel plan (Hobby 300 s vs Pro 800 s) — adjust `SANDBOX_TIMEOUT_MS` if needed.
- [ ] Spec 0006 alerting is live on the production environment.
