# 0004. Review event webhook delivery

**Date**: 2026-07-17
**Status**: In Progress

## Summary

Code Sheriff can store Slack and Discord integrations and test them, but review completed and failed events are never sent to those webhooks. This spec wires review events to the configured integrations so teams get notified where they work.

## Context

modules/notifications/actions/index.ts sends in-app notifications and email on review completion and failure, and modules/integrations/actions/index.ts manages Slack and Discord `IntegrationConfig` records plus a test send. But the notification functions never read `IntegrationConfig`, so configured webhooks are silent except when a user clicks test. Integrations are org scoped (`IntegrationConfig.organizationId`), yet a `Review` connects to a `Repository` which connects to a `User` and has no organization link today. So delivery needs to know which org (if any) owns the review.

## Requirements

**User stories**:
- As a team, I want review results posted to our Slack or Discord when they are ready.
- As a reviewer, I want failures surfaced in the same channel.

**Acceptance criteria**:
- **AC-1**: When a review completes or fails, active Slack and Discord integrations for the owning org receive the event.
- **AC-2**: Webhook delivery never blocks or delays the review; a delivery failure is retried with backoff, then logged and dropped.
- **AC-3**: Webhook URLs and tokens are not written to logs; delivery uses the existing `sendSlackWebhook` / `sendDiscordWebhook` helpers.
- **AC-4**: A review for a repository with no linked org falls back to no external delivery (in-app and email still send), or to user level integrations if added later.
- **AC-5**: Delivery is behind a feature flag and can be disabled per integration (existing `isActive`).

## Options considered

### Option 1: Fan out from the notification layer

When sendReviewCompletedNotification / sendReviewFailedNotification run, also load the owning org's active IntegrationConfigs and POST to each.

**Pros**:
- Reuses the existing webhook helpers and integration CRUD; minimal new code.
- Delivers exactly where notifications already fire.

**Cons**:
- Couples notifications to integrations (acceptable, both are notification paths).

### Option 2: Separate Inngest function for delivery

Subscribe a new function to review events and deliver independently.

**Pros**:
- Cleaner separation of concerns.

**Cons**:
- Extra function and event wiring for behavior that belongs with notifications.

### Option 3: Manual only

Keep the test button; never auto deliver.

**Pros**:
- Nothing to build.

**Cons**:
- The integration is decorative; users do not get notified.

## Decision

**Chosen option**: Option 1, fan out from the notification layer, after linking repositories to organizations so delivery has an owner.

It is the smallest change that delivers real value and reuses what exists. Linking repos to orgs is a small, shared prerequisite that feature 0003 also relies on.

## Rationale

The webhook helpers and integration storage are already built; only the call is missing. Firing it from the notification functions puts delivery next to the in-app and email paths it mirrors. Linking a repo to its org gives delivery a clear owner and aligns with the B2B direction in 0003.

## Feature design

**Data model sketch**:
- `Repository.orgId`: String, nullable, new column, indexed. Backfilled null (personal repos). A non null value links the repo to an `Organization`.

No change to `IntegrationConfig` (already has `organizationId` and `isActive`).

**API surface**:
Internal only. The notification functions call a new `deliverToIntegrations(orgId, payload)` that reads active `IntegrationConfig` rows and POSTs via the existing helpers. No new public endpoint.

**Key invariants**:
- Delivery is fire and forget from the review path; failures retry then drop.
- Only `isActive` integrations for the owning org are used.
- Webhook URLs are never logged.

**Security model**:
Delivery reads only integrations owned by the review's org. Webhook URLs are treated as secrets: not logged, and stored encrypted (see Follow-up). Org scoping prevents cross tenant delivery.

**Configuration required**:
- `WEBHOOK_DELIVERY_ENABLED`: feature flag, default `true`
- `WEBHOOK_DELIVERY_TIMEOUT_MS`: per post timeout, default `5000`

## Build plan

1. Add nullable `orgId` to `Repository`, indexed; migrate (no backfill), satisfies **AC-4**
2. Add `deliverToIntegrations(orgId, payload)` that loads active `IntegrationConfig` for the org and POSTs via `sendSlackWebhook` / `sendDiscordWebhook`, satisfies **AC-1**, **AC-3**
3. Call it from `sendReviewCompletedNotification` and `sendReviewFailedNotification` with the review's repo orgId, guarded by `WEBHOOK_DELIVERY_ENABLED`, satisfies **AC-1**, **AC-5**
4. Wrap delivery in try/retry with backoff; on exhaustion log and continue so the review is unaffected, satisfies **AC-2**
5. Skip delivery when `orgId` is null (personal repo) and keep in-app plus email, satisfies **AC-4**

## Consequences

**Positive**:
- Configured Slack and Discord integrations actually notify teams.
- No new public surface; reuses existing helpers.

**Negative / tradeoffs**:
- Notifications now depend on integration reads; kept non blocking.
- Requires linking repos to orgs for delivery ownership.

**Neutral**:
- Integrations UI already exists; no new settings screen needed.

## Follow-up

- [ ] Encrypt webhook URLs in `IntegrationConfig.config` at rest rather than storing plaintext.
- [ ] Consider user level integrations for personal repos (today delivery needs an org link).

## Migration plan

**Strategy**: feature-flagged, one safe column add
**Phases**:
1. Add nullable `Repository.orgId`; ship delivery behind `WEBHOOK_DELIVERY_ENABLED=false`.
2. Link repositories to orgs where applicable, then enable delivery.
**Rollback**: disable `WEBHOOK_DELIVERY_ENABLED` to stop external delivery; in-app and email unaffected.
**Risks**: a mislinked org could deliver to the wrong team; mitigate by gating on the explicit `orgId` and `isActive`.
