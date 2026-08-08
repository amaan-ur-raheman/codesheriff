# CodeSheriff — Domain Context

Glossary of core domain terms. Use these exact terms in issues, specs, refactors, and test names; don't drift to synonyms.

## Core entities

- **Review** — the persisted result of analyzing one pull request: `prNumber`, `prTitle`, markdown `review` body, `status` (`pending`/`completed`/`failed`), JSON `suggestions`, optional `healthScore`. Lives in the `Review` table.
- **Suggestion** — one actionable finding inside a Review's `suggestions` JSON: `filePath`, `startLine`/`endLine`, `severity` (`error`/`warning`/`info`), `title`, `description`, `originalCode`, `suggestedCode`, `applied` flag. A suggestion is **applied** when written back to the repo.
- **Repository** — a connected GitHub repository (`githubId`, `owner`, `name`, `fullName`, `url`). Optionally linked to an `Organization` via `orgId`. `ReviewConfig` and `CustomReviewRule` customize review behavior per repository.
- **Organization** — a workspace for developer groups (Spec 0003): `ownerId`, member roles (`owner`/`admin`/`member`), per-seat Polar billing, org-linked repo connections, Slack/Discord `IntegrationConfig`s.
- **Subscription tier** — `FREE` (5 repositories, 5 reviews per repository) or `PRO` (unlimited). Enforced via `UserUsage` counters; `subscriptionStatus` is `ACTIVE`/`CANCELLED`/`EXPIRED`. Billing is Polar-backed (`polarCustomerId`, `polarSubscriptionId`).
- **UserUsage** — running usage counters (`repositoryCount`, `reviewCounts` keyed by repositoryId) used for tier limit enforcement and 80% warning emails.
- **ApiKey** — hashed device token (`ch_…`) for CLI/API authorization; `expiresAt`, `lastUsed`.
- **IntegrationConfig** — org-level webhook delivery config: `type` (`slack`/`discord`), `config.webhookUrl`, `isActive`.

## Pipeline concepts

- **Review pipeline** — the Inngest-driven flow: webhook → fetch diff → RAG retrieval → AI generation → sandbox verification → comment/status write-back. Decomposed into typed steps with a thin orchestrator.
- **Sandbox verification** — executing a Suggestion's change in an isolated E2B sandbox (or exec fallback) and labeling it verified/failed before posting (Spec 0007).
- **Vector index** — Pinecone index (`codehorse-vector-embedding-v3`, 3072 dims) holding embedded repo files scoped by `repoId`, used for RAG context retrieval.
- **IndexRun** — a record of an incremental indexing run (Spec 0002): file deltas, fallback/failure rates.
- **Device flow** — CLI login via OAuth device code (`DeviceCode` model): initiate → poll → token.

## Platforms / providers

- **VCS provider** — abstraction over GitHub/GitLab/Bitbucket (`VCSProvider`, `ReviewCapableProvider`); webhooks signed with `GITHUB_WEBHOOK_SECRET`.
- **Polar** — billing provider for subscriptions and org seats.
- **Inngest** — background job orchestration for the review and indexing pipelines.

## Delivery

- **Notification** — in-app `Notification` rows plus optional email and webhook delivery on review completion/failure, usage warnings, subscription changes, comment replies.
