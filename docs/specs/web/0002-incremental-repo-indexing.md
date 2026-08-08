# 0002. Incremental repo indexing

**Date**: 2026-07-17
**Status**: Approved — decisions locked by wayfinder grilling (2026-08-07), see Implementation Decisions

## Summary

Today Code Sheriff embeds a repository only once, when it is connected, and never updates it. This spec makes indexing incremental: when code changes, only changed files are re-embedded and removed files are deleted from the vector store. This keeps retrieval context fresh and cuts embedding cost.

## Context

`indexCodebase` in modules/ai/lib/rag.ts upserts a full file list into Pinecone and is called only from the connect flow (inngest/functions/index.ts). The GitHub webhook handles `pull_request`, `issue_comment`, and `pull_request_review_comment` but never `push`. So after the first import, the RAG context goes stale as the codebase changes, and removed files leave orphan vectors that can be retrieved as context. For an AI reviewer whose value depends on current code, stale context is a quiet correctness bug, and full re-embedding on every change would be costly at scale.

## Requirements

**User stories**:
- As a repository owner, I want my review context to reflect the current code without re-embedding everything.
- As an operator, I want embedding cost proportional to what changed.

**Acceptance criteria**:
- **AC-1**: On a push to a watched branch, only added and modified files are re-embedded; removed files are deleted from the index.
- **AC-2**: Indexing is idempotent per commit: re-delivering the same push does not create duplicate or conflicting vectors.
- **AC-3**: The last indexed commit SHA is recorded per repository so a missed or retried run can resume.
- **AC-4**: A push that changes more than a threshold of files (for example 200) falls back to a full re-index rather than many small upserts.
- **AC-5**: If embedding or Pinecone fails mid run, the run is retried; partial progress is not left inconsistent (the last indexed SHA advances only on full success).

## Options considered

### Option 1: Push triggered incremental index

Subscribe to `push` webhooks, compute the changed file list via the GitHub compare API, upsert changed files, and delete removed ones by their stable vector id.

**Pros**:
- Cost and latency scale with the diff, not the repo.
- Context stays fresh automatically.

**Cons**:
- Requires subscribing to push events and handling compare API rate limits.
- Very large pushes need a full re-index fallback.

### Option 2: Scheduled full re-index

Periodically re-embed the whole repository on a cron.

**Pros**:
- Simple to build; always eventually consistent.

**Cons**:
- Wasteful and laggy; cost grows with repo size regardless of change.

### Option 3: No change

Keep full indexing on connect only.

**Pros**:
- Nothing to build.

**Cons**:
- Context goes stale; orphan vectors accumulate.

## Decision

**Chosen option**: Option 1, push triggered incremental indexing.

It is the only option that keeps context fresh at proportional cost. The full re-index fallback handles the rare large push.

## Rationale

The reviewer's quality depends on current code. Incremental indexing makes that true without the blanket cost of re-embedding on every change. The stable vector id (repoId plus file path) makes deletion exact, and recording the last commit SHA makes the run safe to retry.

## Feature design

**Data model sketch**:
- `Repository.lastIndexedCommitSha`: String, nullable, new column. Backfilled as null; a null value means full index on next run.

Vector id rule (unchanged from today): `${repoId}-${filePath.replace(/\//g, "_")}`. Deletion uses `pineconeIndex.delete` with these ids, filtered by `repoId`.

**API surface**:
| Surface | Trigger | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `index-repo-incremental` Inngest function | push event | repoId, baseSha, headSha | upserted/deleted counts | GitHub webhook signature | 401 invalid signature, 429 GitHub rate limit |
| `POST /api/webhooks/github` (new `push` case) | GitHub push | delivery + payload | 202 accepted | webhook secret | 400 malformed |

**Key invariants**:
- Vector id is deterministic from repoId and filePath, so upsert and delete stay in sync.
- `lastIndexedCommitSha` advances only after a fully successful run.
- One in-flight index run per repository (Inngest concurrency key on repoId).

**Security model**:
Read only GitHub access using the existing token. Pinecone writes are scoped by `repoId` metadata, preserving tenant isolation already in place.

**Configuration required**:
- `INCREMENTAL_INDEX_ENABLED`: feature flag, default `true`
- `INDEX_PUSH_BRANCHES`: comma list of branches that trigger indexing, default the repo default branch
- `INDEX_FULL_REINDEX_THRESHOLD`: file change count above which a full re-index runs, default `200`

## Build plan

1. Add `lastIndexedCommitSha` nullable column to `Repository` and migrate (safe add, nullable), satisfies **AC-3**
2. Extend `indexCodebase` to accept an upsert/delete mode and to delete removed file vectors by id, satisfies **AC-1**
3. Subscribe the GitHub webhook route to `push`, verify signature, and emit an `index-repo-incremental` Inngest event, satisfies **AC-1**
4. Implement the incremental function: compare base..head, embed changed, delete removed, set Inngest concurrency key by repoId, satisfies **AC-1**, **AC-2**
5. Record `lastIndexedCommitSha` only after full success; retry on failure without advancing it, satisfies **AC-3**, **AC-5**
6. Add the large diff fallback to full re-index using `INDEX_FULL_REINDEX_THRESHOLD`, satisfies **AC-4**

## Consequences

**Positive**:
- Review context reflects current code.
- Embedding cost tracks the diff size.
- Orphan vectors from deleted files are cleaned up.

**Negative / tradeoffs**:
- Adds push webhook handling and compare API calls (rate limit surface).
- Large pushes still cost a full re-index.

**Neutral**:
- No change to the query path; retrieval is unchanged.

## Implementation Decisions (locked 2026-08-07)

1. **Force-push → full re-index.** A force-push is detected when the stored `lastIndexedCommitSha` no longer exists (compare API returns **404**) or shares no ancestry with the new head (`status: "diverged"`). Both fall back to a full re-index. Rare + correctness-critical (prevents stale context and orphan vectors); cost bounded by the threshold fallback. Live-probed against the compare API to confirm the 404/diverged signatures.
2. **Default branch only.** `INDEX_PUSH_BRANCHES` semantics: only pushes to the repo default branch trigger indexing; other branches do not. Keeps RAG context aligned with what reviewers see merged; avoids duplicate vectors and Pinecone cost. The env var remains configurable for repos that want more.
3. **File-count threshold only (200).** `INDEX_FULL_REINDEX_THRESHOLD` stays a file-count trigger (default 200), the direct driver of embedding calls. No byte-size threshold in v1.
4. **Manual "index now" button untouched.** It remains the full-re-index escape hatch and the backfill path for repos with `lastIndexedCommitSha = null`. Incremental runs are invisible background work.
5. **Metrics** (run count, file delta, full-reindex fallback rate) are specified separately in **Spec 0006** — the incremental function writes an `IndexRun` row per run.

## Follow-up

- [x] Decide whether force-push (history rewrite) should trigger a full re-index — **resolved: full re-index on 404/diverged.**
- [x] Add a metric for incremental run count, file delta, and fallback rate — **resolved: see Spec 0006 (IndexRun table).**

## Migration plan

**Strategy**: feature-flagged plus one safe column add
**Phases**:
1. Add nullable `lastIndexedCommitSha` (no backfill needed; null means full on next run). Ship behind `INCREMENTAL_INDEX_ENABLED=false`.
2. Enable the push webhook and incremental function; keep full-index-on-connect as the baseline.
**Rollback**: set `INCREMENTAL_INDEX_ENABLED=false` to stop push indexing; connect-time full index remains.
**Risks**: compare API rate limits on busy repos; mitigate with concurrency key and retry with backoff.
