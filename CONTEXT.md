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

## Design language

Terms for the UI redesign effort (map issue 73). Use these exactly in issues, tickets, and specs.

- **Surface** — one named UI area of the product, redesigned as a unit: landing + marketing, auth/login, the dashboard shell, each dashboard page (dashboard, repository, reviews, integrations, organizations, subscriptions, settings, admin, device), and the CLI.
- **Design system** — the locked token layer (color, type, spacing, radius, motion) every Surface builds on, being defined under the **Editorial Paper** direction (ADR-0001, revised iteration 4).
- **Brand pass** — the full identity refresh: icon, wordmark, color, and voice.
- **Direction** — the chosen aesthetic for the redesign. Currently **Editorial Paper** (ADR-0001): light-first print editorial, warm paper `#F7F4EE` + ink `#231D15`, signal-orange accent (`#FC4C02` display / `#B33900` small text / `#FDE6D6` tint), dark pair `#17130D` / `#EFE9DD`; Fraunces display + Geist body + Geist Mono outlier; hairline rules, asymmetric composition, quiet motion. Replaced the three rejected dark+accent directions (Signal orange, Dispatch emerald, Cyber Noir magenta).
- **Definition of done** — the per-Surface acceptance bar of the redesign (ADR-0002): computed AA contrast, Lighthouse ≥ 90 perf + a11y, both themes, design-skill pre-flight, states + reduced-motion, zero behavior change.
