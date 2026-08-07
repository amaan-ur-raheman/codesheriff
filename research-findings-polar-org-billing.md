# Research Findings: Polar Per-Organization & Per-Seat Billing (Spec 0003)

**Ticket**: Research: Polar per-organization subscription and seat-based billing API
**Date**: 2026-08-07
**Repo**: `amaan-ur-raheman/codesheriff`
**Scope**: Informs the hybrid org billing grilling (Spec 0003) and the 0003 execution phase.

---

## TL;DR / Headline answer

Polar **natively supports everything Spec 0003 needs**: customers can be attached to an organization (`Customer.organization_id`), **per-seat pricing is a first-class price type (`ProductPriceSeatBased` with `seat_tiers`)**, checkout accepts a **quantity**, and Polar emits **dedicated seat webhooks** (`customer_seat.assigned/claimed/revoked`) plus full subscription lifecycle events. The hybrid model (per-user for solo users, per-org for members) maps cleanly: a solo user is a plain customer; an org gets its own customer record (with `organization_id`), a seat-based product, and a subscription whose quantity == active member count.

## 1. Organization-level customers & subscriptions

- The `Customer` object carries an **`organization_id`** field (nullable) — a customer record can be attached to an org rather than a bare user. The existing `@polar-sh/better-auth` integration creates per-user customers; org billing means creating a **second, org-scoped customer** for the org.
- `POST /v1/subscriptions` creates a subscription programmatically on **free products only**; for paid products Polar requires the **checkout flow** (per the Create Subscription endpoint docs). So paid org subscriptions start via checkout.

## 2. Per-seat / quantity pricing

- **`ProductPriceSeatBased`** is a real price type with `seat_tiers` (and `amount_type`, `price_currency`, `tax_behavior`); `ProductPriceSeatBasedCreate` is the creation input. Seat tiers define per-seat prices (e.g. $X/seat/mo, possibly tiered).
- Checkout schemas carry **`quantity`** (and seat-related fields): `CheckoutProductCreate`, `CheckoutProductsCreate`, `Checkout`, `CheckoutLink*`, `CheckoutUpdate*` all expose quantity/seats props. So a checkout session can be created with a quantity (seat count).
- Seat count changes after purchase are handled through seat assignment/claim/revoke (see webhooks) — Polar tracks seats on the customer.

## 3. Webhook events

From `WebhookEventType` (OpenAPI enum), the relevant events:

- **Seats**: `customer_seat.assigned`, `customer_seat.claimed`, `customer_seat.revoked` (payloads `WebhookCustomerSeat*Payload` with `data`/`timestamp`/`type`).
- **Subscription lifecycle**: `subscription.created`, `subscription.updated`, `subscription.active`, `subscription.canceled`, `subscription.uncanceled`, `subscription.cycled`, `subscription.revoked`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`.
- **Checkout**: `checkout.created`, `checkout.updated`, `checkout.expired`.
- **Org/customer**: `organization.updated`, `customer.created/updated/deleted`, `customer.state_changed`.
- **Endpoints**: `POST /v1/webhooks/endpoints` (+ `/secret`, `/deliveries`, redeliver) manage webhook endpoints; webhook payloads are signed/verifiable via the existing `POLAR_WEBHOOK_SECRET` pattern.

## 4. SDK surface (`@polar-sh/sdk`)

- New-style import: `import { createPolar } from "@polar-sh/sdk/2026-04"` → `polar.subscriptions.create({ product_id, customer_id })`; the SDK is versioned (`/2026-04` paths). The repo's current `@polar-sh/sdk` + `@polar-sh/better-auth` wiring (per-user checkout + webhook verification in `modules/payment/`) extends by adding org customer + seat product + checkout-with-quantity.
- Checkout sessions: `POST /v1/checkouts/` (create), `/v1/checkouts/{id}`, client-confirm variants, `checkout-links` for shareable links.

## 5. Constraints / notes

- Programmatic subscription creation is **free-products only** — paid seats must go through checkout (so "invite beyond seat limit → open Polar checkout for added seats" (AC-3) is the correct shape, and seat adds after purchase flow through seat webhooks, not a second subscription).
- Seat-based prices are defined by `seat_tiers` — the org product/price to provision in the Polar dashboard (`POLAR_ORG_PRODUCT_ID`, `POLAR_ORG_PRICE_ID`) should use the seat-based price type.
- Proration behavior for seat adds/removes is implied by seat tier + subscription cycle semantics; confirm exact proration on the Polar dashboard/checkout during implementation.

## Open questions

- Exact `seat_tiers` schema semantics (per-tier pricing thresholds) — inspect `ProductPriceSeatBased.seat_tiers` in the OpenAPI spec during implementation.
- Whether org checkout can be initiated with a `customer_id` bound to the org in one call (vs create-customer-then-checkout) — the `CheckoutProductCreate`/`Checkout` schemas' `customer`/`customer_id` props should confirm.

## Sources

- Polar OpenAPI spec: `https://api.polar.sh/openapi.json` (fetched 2026-08-07; `ProductPriceSeatBased`, `ProductPriceSeatBasedCreate`, `WebhookEventType`, `Customer.organization_id`, `WebhookCustomerSeat*Payload`, `/v1/checkouts/`, `/v1/subscriptions`, `/v1/webhooks/endpoints`).
- Polar docs: `polar.sh/docs/api-reference/subscriptions/create-subscription` (paid products require checkout).
- Repo: `packages/web/modules/payment/` (existing per-user Polar integration), `docs/specs/web/0003-per-seat-org-billing-invites.md`.
