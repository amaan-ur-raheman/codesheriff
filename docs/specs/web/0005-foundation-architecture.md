# Foundation Architecture Spec

**Date**: 2026-08-01
**Status**: Accepted
**Resolves**: [Target foundation architecture spec](https://github.com/amaan-ur-raheman/codesheriff/issues/40)

## Summary

This spec defines the target architecture for Code Sheriff's foundation phase. It covers VCS provider abstraction wiring, module decomposition, persisted device flow, and webhook delivery wiring — and how they compose into a single coherent foundation. It is the north star for the foundation phase; downstream tickets implement against this spec.

---

## 1. VCS Abstraction Wiring

### 1.1 Provider declaration on Repository

Add a `provider` field to the `Repository` model:

```prisma
model Repository {
  // ...existing fields...
  provider  String  @default("github")  // "github" | "gitlab" | "bitbucket"
  // ...
}
```

Each repository record stores its VCS provider at connection time. The review pipeline reads this field and calls `createVCSProvider(repository.provider, credentials)` to get the right provider. No inference from webhook headers or account lookups — the provider is explicit on the record.

### 1.2 Capability-based interface split

The current `VCSProvider` interface stays as the **base** — methods every provider implements:

```typescript
interface VCSProvider {
  name: string;
  listRepositories(page?, perPage?): Promise<VCSRepository[]>;
  getPullRequestDiff(owner, repo, prNumber): Promise<VCSPullRequest>;
  postReviewComment(owner, repo, prNumber, comment): Promise<void>;
  // Comment replies (threaded) — supported by GitHub, GitLab MR notes, Bitbucket PR comments
  postCommentReply(owner, repo, prNumber, body, inReplyToId, isReviewComment): Promise<void>;
  createWebhook(owner, repo, callbackUrl): Promise<any>;
  deleteWebhook(owner, repo, webhookId): Promise<void>;
  getRepoFileContents(owner, repo, path?): Promise<VCSFile[]>;
  getContributions(username): Promise<any>;
  searchPullRequests(query, perPage?): Promise<any>;
}
```

A new **optional extension** interface for providers that support advanced review features:

```typescript
interface ReviewCapableProvider extends VCSProvider {
  // Check runs (GitHub Checks API)
  createCheckRun(owner, repo, headSha): Promise<number | null>;
  updateCheckRun(owner, repo, checkRunId, status, conclusion, output, annotations?): Promise<void>;
  // Commit statuses
  updateCommitStatus(owner, repo, sha, state, description, targetUrl): Promise<void>;
  // Inline review comments
  postInlineComments(owner, repo, prNumber, comments: InlineComment[]): Promise<void>;
  // Loading/update/failure comment lifecycle
  postLoadingComment(owner, repo, prNumber): Promise<number | null>;
  updateComment(owner, repo, commentId, body): Promise<void>;
  updateCommentFailed(owner, repo, commentId, error): Promise<void>;
  // Thread fetching
  getReviewCommentThread(owner, repo, prNumber, commentId): Promise<ThreadMessage[]>;
  getIssueCommentThread(owner, repo, prNumber): Promise<ThreadMessage[]>;
  // Incremental diff
  getCompareDiff(owner, repo, before, after): Promise<string>;
}
```

The review pipeline checks capability at runtime:

```typescript
const provider = createVCSProvider(repo.provider, credentials);
const isReviewCapable = (p): p is ReviewCapableProvider => 'createCheckRun' in p;

if (isReviewCapable(provider)) {
  checkRunId = await provider.createCheckRun(owner, repo, headSha);
} else {
  // Graceful degradation: fall back to a plain review comment
  await provider.postReviewComment(owner, repo, prNumber, "Review in progress...");
}
```

GitLab and Bitbucket implement the base `VCSProvider` today. They can implement `ReviewCapableProvider` later (GitLab has MR notes/discussions; Bitbucket has PR comments) without changing the review pipeline.

### 1.3 Provider-specific auth resolution

Each provider module exports its own `resolveCredentials` function:

```typescript
// modules/vcs/github/auth.ts
export async function resolveGithubCredentials(repo: Repository, account: Account): Promise<Octokit> {
  // GitHub App auth (if env vars present + owner/repo available) → installation lookup
  // Fallback: user's OAuth access token from account.accessToken
  // Returns an authenticated Octokit instance
}

// modules/vcs/gitlab/auth.ts
export function resolveGitlabCredentials(account: Account): string {
  return account.accessToken; // GitLab uses bearer tokens
}

// modules/vcs/bitbucket/auth.ts
export function resolveBitbucketCredentials(account: Account): string {
  return account.accessToken; // Bitbucket uses basic auth (encoded)
}
```

The factory signature changes to accept resolved credentials, not a raw token:

```typescript
export function createVCSProvider(provider: VCSProviderType, credentials: unknown): VCSProvider
```

Each provider's constructor interprets the `credentials` it receives (GitHub gets an Octokit, GitLab/Bitbucket get a token string). The review pipeline calls the appropriate resolver based on `repo.provider` before calling the factory.

---

## 2. Module Decomposition

### 2.1 github.ts → modules/github/lib/ sub-modules

Split `github.ts` (853 lines) by concern into focused files under `modules/github/lib/`:

| File | Functions | Lines (approx) |
|------|-----------|----------------|
| `auth.ts` | `getGithubAccessToken`, `getOctokit` | ~90 |
| `diffs.ts` | `getPullRequestDiff`, `getCompareDiff`, `getValidDiffLines` | ~120 |
| `comments.ts` | `postReviewComment`, `postLoadingReviewComment`, `updateReviewComment`, `updateReviewCommentFailed`, `postInlineReviewComments`, `getReviewCommentThread`, `getIssueCommentThread` | ~250 |
| `check-runs.ts` | `createPRCheckRun`, `updatePRCheckRun`, `updatePRCommitStatus` | ~180 |
| `webhooks.ts` | `createWebhook`, `deleteWebhook` | ~60 |
| `contributions.ts` | `fetchUserContribution`, `getRepositories` | ~100 |
| `files.ts` | `getRepoFileContents` | ~95 |
| `index.ts` (barrel) | Re-exports all of the above | ~15 |

`github.ts` is replaced by `index.ts` as a barrel re-export. All existing imports (`from "@/modules/github/lib/github"`) continue to work via the barrel during migration. Consumers are updated incrementally to import from the specific sub-module.

### 2.2 review.ts → steps/ directory

Extract `review.ts` (740 lines) into a thin orchestrator + step functions:

```
inngest/functions/
  review.ts              # Thin orchestrator: defines the Inngest function, calls steps
  steps/
    fetch-pr-data.ts
    create-loading-comment.ts
    create-check-run.ts
    retrieve-context.ts
    generate-ai-review.ts
    parse-suggestions.ts
    verify-suggestions-sandbox.ts
    post-comment.ts
    post-inline-comments.ts
    save-review.ts
    send-notification.ts
    update-github-status.ts
    send-webhook-notifications.ts
  handle-comment-reply.ts  # Separate file for the comment reply function
```

Each step function is a pure async function that takes a typed `ReviewContext` object (built in `fetch-pr-data.ts`) and returns its output. The context holds `{ provider, owner, repo, prNumber, userId, before?, after?, diff, title, description, headSha }` — the resolved VCS provider (not a raw token) plus the PR metadata. The orchestrator calls the steps in sequence inside `step.run()` blocks, threading the context. Each step is independently testable. The orchestration logic in `review.ts` reads top-to-bottom as a clear pipeline.

`github.ts` decomposes into standalone functions (by concern, above) which remain the canonical GitHub implementation; `GitHubProvider` (in `modules/vcs/`) is a thin adapter that delegates to these functions. Non-review-pipeline consumers (dashboard, settings, review actions) keep importing from `modules/github/lib`. Migration is incremental: create the sub-modules + `index.ts` barrel, move functions one-by-one, update consumers over time — no consumer breaks at any step.

---

## 3. Persisted Device Flow

### 3.1 New Prisma model

```prisma
model DeviceCode {
  id         String   @id           // UUID device code (opaque token the CLI holds)
  userCode   String   @unique       // NORMALIZED: uppercase, no hyphen (e.g. "ABCDEFGH")
  status     String   @default("pending")  // "pending" | "verified"
  userId     String?
  apiKey     String?
  expiresAt  DateTime
  createdAt  DateTime @default(now())

  @@map("device_code")
}
```

`userCode` is stored **normalized** (uppercase, no hyphen) so the `verify` lookup is an exact, indexed `findUnique`. The display format `XXXX-XXXX` is derived at generation/echo time; the human enters it in any case/hyphenation and the input is normalized before lookup.

### 3.2 Action implementations

- **`initiate`**: generate UUID device code + a `XXXX-XXXX` user code, store the userCode **normalized** (uppercase, strip hyphen), `expiresAt: now + 10min`. Return `device_code`, `user_code` (display format), `verification_uri`.
- **`poll`**: `prisma.deviceCode.findUnique({ where: { id: deviceCode } })` — check expiry (delete expired row, return `expired_token`), check status. If `verified` with `apiKey` + `userId`, **delete the row** (one-time use) and return the token + user; else `authorization_pending`.
- **`verify`**: authenticate the browser session; normalize the entered user code; `findUnique({ where: { userCode } })`; check expiry. Then run a **Prisma `$transaction`**: (1) `apiKey.create` (mint `cs_` token), (2) `deviceCode.updateMany({ where: { id, status: "pending" }, data: { status: "verified", userId, apiKey } })`. If the updateMany matches 0 rows (already verified/consumed), abort and return an error — a code verifies **exactly once**, atomically.

### 3.3 Cleanup

**One-time use**: the DeviceCode row is deleted on successful poll (returned once). **Lazy cleanup**: expired codes are deleted when a poll/verify touches them (query-time). No scheduled cleanup job — stale codes are inert and cheap. Add an `expiresAt` index only if the table grows.

### 3.4 Migration

The `globalForDeviceCodes` Map is removed. The three actions become Prisma queries (with the transactional verify). The API contract (request/response shapes) stays identical so the CLI doesn't need changes.

---

## 4. Webhook Delivery Wiring

### 4.1 Repository-org linking at connection time

The `connectRepository` function gains an optional `orgId` parameter:

```typescript
export async function connectRepository(owner, repo, githubId, orgId?: string) {
  // ...existing logic...
  await prisma.repository.create({
    data: { ..., orgId: orgId || null },
  });
}
```

When a user connects a repo from within an organization's context (the org's repository page), `orgId` is passed. Personal repos connected from the dashboard stay unlinked (`orgId = null`).

### 4.2 Delivery path

The `deliverToIntegrations(orgId, payload)` function already exists in `notifications/actions/index.ts` and is already called from `sendReviewCompletedNotification` and `sendReviewFailedNotification`. The wiring is:

1. Review completes/fails → `sendReviewCompletedNotification(reviewId)` / `sendReviewFailedNotification(reviewId, error)`
2. These functions load the review with `repository.orgId`
3. If `orgId` is non-null, `deliverToIntegrations(orgId, payload)` loads active `IntegrationConfig` rows for that org
4. For each config, POST to the webhook URL via `sendSlackWebhook` / `sendDiscordWebhook` with timeout + retry
5. If `orgId` is null (personal repo), skip external delivery — in-app + email still fire

### 4.3 Feature flag

`WEBHOOK_DELIVERY_ENABLED` (default `true`) and `WEBHOOK_DELIVERY_TIMEOUT_MS` (default `5000`) already exist in the code. The delivery is already guarded by these. No new configuration needed.

---

## 5. How They Compose

### 5.1 Implementation order

The four concerns are implemented sequentially, each independently shippable:

1. **Schema migration** (prerequisite): Add `Repository.provider` field + `DeviceCode` model. One Prisma migration.
2. **VCS interface split**: Define `ReviewCapableProvider` extension interface in `modules/vcs/types.ts`. Update `GitHubProvider` to implement it. No review pipeline changes yet.
3. **Decompose github.ts**: Split into sub-modules under `modules/github/lib/`. Barrel re-export preserves all existing imports. No consumer changes.
4. **Wire review pipeline through VCS factory**: Change `review.ts` (now thin orchestrator + steps/) to call through `createVCSProvider(repo.provider, credentials)` instead of importing directly from `modules/github/lib/github`. Use capability check for advanced features.
5. **Device flow migration**: Replace `globalForDeviceCodes` Map with `DeviceCode` Prisma model. Update the three actions in `app/api/auth/device/route.ts`.
6. **Webhook delivery wiring**: Add `orgId` parameter to `connectRepository`. Add org-context repo connection UI. The delivery path already works — just needs repos to be linked.

### 5.2 Cross-cutting concerns

- **Schema migration** (step 1) is the shared prerequisite for both the VCS work (Repository.provider) and the device flow (DeviceCode model). It should be a single migration.
- **The barrel re-export** in step 3 ensures steps 2 and 4 can proceed without updating all consumers simultaneously. Consumers migrate incrementally.
- **The capability check** in step 4 means the review pipeline degrades gracefully for non-GitHub providers. No conditional logic based on provider name — just interface checks.
- **The device flow** (step 5) and **webhook delivery** (step 6) are fully independent of the VCS work. They can proceed in parallel with steps 2-4 if desired.

### 5.3 What this enables

After the foundation phase:
- GitLab and Bitbucket repos can be connected and reviewed (base VCSProvider) — check runs and inline comments degrade to plain review comments
- The review pipeline is provider-agnostic — adding a new VCS provider means implementing the interface, not touching the review function
- The CLI device flow survives serverless cold starts and multi-instance deploys
- Slack/Discord integrations fire when reviews complete for org-linked repos
- github.ts is decomposed into focused, testable modules
- review.ts is a thin orchestrator with independently testable step functions

### 5.4 What this does NOT change

- The AI review generation logic (prompt, RAG, sandbox verification) stays as-is — the sandbox isolation strategy is a separate decision (ticket #44)
- The frontend components and pages stay as-is — this is a backend/module architecture change
- The Prisma client generation path stays as-is (just adds the new model + field)
- The Inngest event names and function IDs stay as-is — only the internal implementation changes
