# 0003. Per seat org billing and invites

**Date**: 2026-07-17
**Status**: Approved — decisions locked by wayfinder grilling (2026-08-07), see Implementation Decisions

## Summary

The organization feature already supports create, roles, and inviting users who already have accounts. This spec adds two missing pieces: billing that is per seat through Polar, and invites that work for people who do not yet have an account (email invite link). Together they make orgs a real B2B unit.

## Context

modules/organization/actions/index.ts implements createOrganization, getOrganizations, inviteMember (by existing user email only), removeMember, updateMemberRole, and deleteOrganization, with owner, admin, and member roles enforced in code. The data model has Organization, OrganizationMember, and IntegrationConfig. But billing today is per user (User.subscriptionTier, User.polarCustomerId), not per organization, so a team cannot be billed as one unit. And inviteMember fails unless the invited email already maps to a User, so bringing in a new teammate is impossible. Both gaps block Code Sheriff from serving teams the way the Organizations UI implies.

## Requirements

**User stories**:
- As an org owner, I want to be billed once per seat so adding a teammate is one action, not a per person checkout.
- As a team lead, I want to invite a colleague by email even if they have never signed up, and have them join when they accept.

**Acceptance criteria**:
- **AC-1**: An organization can have a Polar customer and subscription; seat count equals active member count.
- **AC-2**: Inviting an email that has no account creates a pending membership and sends an invite link; accepting activates the membership and attaches the account.
- **AC-3**: Adding or accepting a member beyond the plan seat limit triggers a Polar checkout to add seats rather than silently exceeding the plan.
- **AC-4**: Org scoping is enforced on every member, invite, role, and billing action (no cross org access).
- **AC-5**: An invite token expires (default 7 days) and cannot be reused after acceptance or removal.
- **AC-6**: Removing the last owner is blocked; ownership transfer to another member is supported.

## Options considered

### Option 1: Polar subscription per organization with pending invites

Create a Polar customer and subscription per org, bill per seat, and add a pending membership plus signed invite token for outsiders.

**Pros**:
- Matches how B2B teams expect to be billed and onboarded.
- Reuses the existing Polar integration and org role model.

**Cons**:
- Migration from per-user billing; needs seat limit enforcement wired to Polar.
- Invite tokens and email sending add surface area.

### Option 2: Keep per-user billing, orgs as grouping only

Leave billing on the user and treat orgs as a label.

**Pros**:
- No billing change.

**Cons**:
- No real per-seat control; teams cannot be billed as a unit.

### Option 3: Usage based billing per org

Bill by review or token volume per org instead of seats.

**Pros**:
- Aligns cost with consumption.

**Cons**:
- More complex to explain and to enforce; not what the UI implies.

## Decision

**Chosen option**: Option 1, Polar per organization with pending email invites.

It is the smallest change that makes orgs a real billing and onboarding unit, reusing what exists. Per-user billing stays for personal use.

## Rationale

The org module is built except for the two things that make it useful to a team: paying together and inviting newcomers. Polar already integrates per user, so pointing it at the org and gating seats is a contained change. Pending invites with a signed token are the standard, safe way to onboard outsiders.

## Feature design

**Data model sketch**:
- `Organization.polarCustomerId`: String, nullable, new
- `Organization.polarSubscriptionId`: String, nullable, new
- `OrganizationMember.status`: String, default `"active"`, new (values: `active`, `pending`)
- `OrganizationMember.invitedEmail`: String, nullable, new
- `OrganizationMember.inviteToken`: String, nullable, unique, new
- `OrganizationMember.invitedAt`: DateTime, nullable, new

Existing `@@unique([organizationId, userId])` stays; a pending member has a userId only after acceptance, so uniqueness holds per state.

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| /api/orgs/[id]/invites | POST | email, role | pending membership + invite sent | owner/admin | 403 not owner/admin, 409 already member |
| /api/orgs/invite/[token] | GET | token | org + accept prompt | public (then login) | 404 invalid, 410 expired |
| /api/orgs/invite/[token]/accept | POST | token | active membership | authenticated | 404 invalid, 410 expired |
| /api/orgs/[id]/billing | POST | seats | Polar checkout session | owner | 403 not owner |
| Polar webhook | POST | event | updated seat/subscription | Polar signature | 401 bad signature |

**Key invariants**:
- Seat count equals active member count; exceeding the plan blocks or upgrades.
- Invite token is single use and expires.
- Only owners manage billing and roles; only owners and admins invite.
- Last owner cannot be removed; ownership transfer requires a target member.

**Security model**:
Invite tokens are signed and stored as opaque random strings; they grant membership only for the encoded org and role. All member, invite, and billing actions check org membership and role. Billing actions are owner only.

**Configuration required**:
- Existing `POLAR_*` keys already present; add org product and price IDs: `POLAR_ORG_PRODUCT_ID`, `POLAR_ORG_PRICE_ID`
- `INVITE_TOKEN_TTL_DAYS`: default `7`

## Build plan

1. Add `polarCustomerId`, `polarSubscriptionId` to `Organization` and `status`, `invitedEmail`, `inviteToken`, `invitedAt` to `OrganizationMember`; migrate (nullable adds, backfill existing members to `active`), satisfies **AC-1**, **AC-2**, **AC-5**
2. On organization create, provision a Polar customer for the org, satisfies **AC-1**
3. Replace inviteMember's existing-user-only path with a pending membership plus signed token and a Resend invite email; accept route activates the membership, satisfies **AC-2**, **AC-5**
4. Enforce seat limit on invite and accept: if it would exceed the plan, open a Polar checkout for added seats, satisfies **AC-3**
5. Add the billing endpoint and a Polar webhook handler that syncs seat count and subscription state, satisfies **AC-1**, **AC-3**
6. Block removing the last owner and add ownership transfer, satisfies **AC-6**
7. Enforce org scoping on all member, invite, and billing actions (audit existing queries), satisfies **AC-4**

## Consequences

**Positive**:
- Teams are billed and onboarded as units.
- Outsiders can join via email invite.

**Negative / tradeoffs**:
- Migration from per-user to per-org billing needs a cutover plan for existing paid users.
- More webhook and email surface to operate.

**Neutral**:
- Per-user billing remains for personal repositories.

## Implementation Decisions (locked 2026-08-07)

Hybrid billing model: per-user billing for solo users; org-based billing when a user is a member of an org — both coexist.

1. **Precedence — keep both, scope by repo.** Org billing governs **org-linked repositories** (org pays per seat); a member's personal subscription stays intact and covers their own personal repos. Non-destructive; no forced cancellations; matches the existing repo-with-`orgId` model. A member's personal PRO does **not** exempt the org from paying that seat.
2. **Seats = active members.** Seat = active membership count (`OrganizationMember` where `status='active'`). A member with a personal plan still consumes an org seat. Matches Polar's seat webhooks (`customer_seat.assigned/claimed/revoked`) and AC-1.
3. **Additive cutover, no migration.** Joining/creating an org bills a fresh org seat; the personal subscription is untouched. No existing paid users are migrated.
4. **Repos stay user-owned** with the existing `orgId` link — no ownership migration. Org billing applies through the link, not through ownership transfer.
5. **Webhook-driven seat sync.** Leaving/removal emits `customer_seat.revoked`; the Polar webhook handler reconciles seat count and subscription state. See the Polar findings (`research-findings-polar-org-billing.md`): `ProductPriceSeatBased`, checkout `quantity`, `POLAR_ORG_PRODUCT_ID`/`POLAR_ORG_PRICE_ID` with a seat-based price.

## Follow-up

- [x] Define the per-user to per-org billing cutover for existing paid users — **resolved: additive, no migration (decision 3).**
- [x] Decide whether repositories move under an org or stay per user — **resolved: repos stay user-owned with `orgId` link (decision 4).**

## Migration plan

**Strategy**: strangler, feature-flagged
**Phases**:
1. Add nullable columns; backfill existing members to `active`. Ship pending invites behind a flag, off.
2. Provision Polar customers for new orgs; keep per-user billing for existing.
3. Enable invites and per-seat billing; migrate existing paid users per the cutover plan.
**Rollback**: disable the invite and billing flags to revert to existing-user-only invites and per-user billing; columns stay nullable and unused.
**Risks**: seat limit and Polar webhook drift could let usage exceed plan; mitigate with the seat check on invite/accept and webhook reconciliation.
