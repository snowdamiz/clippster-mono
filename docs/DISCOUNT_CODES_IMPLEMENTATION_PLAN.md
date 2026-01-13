# Discount Codes & Intro Pricing – Production Implementation Plan

## Goals & Scope
- Admins can create codes for 0–100% off, for N months (introductory duration), scoped to specific plans (starter/creator/pro).
- Codes can have limits (max redemptions, expiry), be activated/deactivated, and optionally single-use.
- Users can apply codes during checkout; Stripe subscriptions are created with recurring discounts for the specified months, then revert to full price automatically.
- Visibility: audit logs, usage stats, and user billing UI showing applied discounts and remaining discounted cycles.

## Current State Summary
- Backend (Elixir/Phoenix):
  - Subscriptions context (`subscriptions.ex`) manages tiers, creation, renewal, admin grants.
  - Stripe webhooks: checkout/session completed, subscription created/updated/deleted, invoice succeeded/failed.
  - Subscription history schema lacks discount/coupon fields.
- Frontend (Vue):
  - Billing page shows plans/status; no coupon input.
  - Admin Users page manages users/credits/subscriptions; no discount management.
- No coupon/promo data model or Stripe promotion code usage today.

## Database Schema (new)
### `promo_codes`
- `id` UUID (PK)
- `code` string, unique, uppercase, indexed
- `name` string
- `percent_off` int NOT NULL (0–100)
- `duration_kind` enum: `repeating | forever | once` (default `repeating`)
- `duration_months` int NULL (required for repeating; ignored for forever; 1 for once or NULL)
- `allowed_tiers` text[] NOT NULL (e.g., ["starter","creator"])
- `max_redemptions` int NULL
- `redeem_by` utc_datetime NULL
- `is_active` bool NOT NULL default true
- `created_by_admin_id` fk users(id)
- `stripe_coupon_id` string NULL
- `stripe_promo_code_id` string NULL
- `notes` text NULL
- timestamps
Indexes: unique(code); is_active/redeem_by; stripe_coupon_id; stripe_promo_code_id.

### `promo_redemptions`
- `id` UUID (PK)
- `promo_code_id` fk promo_codes(id)
- `user_id` fk users(id)
- `stripe_customer_id` string NULL
- `stripe_subscription_id` string NULL
- `stripe_invoice_id` string NULL
- `redeemed_at` utc_datetime
- `status` enum: `active | ended | cancelled`
- timestamps
Indexes: promo_code_id/status; user_id; stripe_subscription_id.

### Optional
- Add `promo_code_id` (nullable FK) to subscription history for reporting.

## Stripe Object Mapping
- Create `Stripe.Coupon`:
  - `percent_off`
  - `duration` = `repeating` + `duration_in_months`, or `forever`, or `once`
- Create `Stripe.PromotionCode`:
  - `code` (admin-entered)
  - `coupon` (from above)
  - `active` = `is_active`
  - `max_redemptions`
  - `expires_at` = `redeem_by`
- Store IDs on `promo_codes`. Deactivation: update promotion code `active=false`.

## Server-Side Validation (`validate_promo/3`)
Inputs: `code`, `tier`, `user_id`.
1) Normalize code uppercase; find promo by code.
2) Check `is_active`.
3) Check `redeem_by` not passed.
4) Check `allowed_tiers` includes `tier`.
5) Check `max_redemptions` not exceeded (count redemptions).
6) Return OK with `{promo_code_id, stripe_promo_code_id, percent_off, duration_kind, duration_months, message}` or error reason.
Rate-limit this endpoint.

## Checkout Creation Changes
- Endpoint `/subscriptions/checkout` accepts `promo_code`.
- Validate tier (existing) and promo (new). On error → 400 with reason.
- Stripe Checkout Session:
  - `mode: "subscription"`
  - existing `line_items`
  - `discounts: [%{promotion_code: stripe_promo_code_id}]` when valid
  - metadata: `user_id`, `subscription_tier`, `type=subscription`, `promo_code_id`, `promo_code`
- Return session URL.

## Webhook Handling
### `checkout.session.completed` (subscription)
- Read metadata `promo_code_id`, or infer via `session.total_details.breakdown.discounts[*].discount.coupon.id`.
- Create `promo_redemptions` row: status `active`, `redeemed_at`, `user_id`, `promo_code_id`, `stripe_customer_id`, `stripe_subscription_id`.
- Continue existing subscription creation flow.

### `customer.subscription.created/updated`
- If `subscription.discount` exists, ensure redemption row exists/active for that subscription.
- If discount absent but previously active redemption, consider marking `ended` (normally handled on invoice).

### `invoice.payment_succeeded`
- If invoice has discount: keep redemption `active`.
- If no discount and redemption exists: mark redemption `ended` (discount period over).

### `customer.subscription.deleted`
- Mark redemption `cancelled` (or `ended`) for that subscription.

### `promotion_code.updated` (optional)
- If Stripe deactivates, set `promo_codes.is_active=false`.

## Admin APIs (RBAC: admin-only)
- `POST /admin/promos`
  - Body: `{code?, name, percent_off, duration_kind, duration_months?, allowed_tiers[], max_redemptions?, redeem_by?, is_active?, notes?}`
  - Generates code if missing; creates Stripe coupon + promotion code; stores IDs; audit log.
- `PATCH /admin/promos/:id`
  - Toggle `is_active`, edit limits/expiry/notes/name; update Stripe promotion code/coupon accordingly; audit log.
- `GET /admin/promos`
  - Filters: `is_active`, `tier`, `expired`, `search`; includes usage stats (`redemptions_used`, `max_redemptions`, `last_redeemed_at`).
- `GET /admin/promos/:id`
  - Detail + paginated usage list.

## Public Endpoints
- `POST /billing/promo/validate`: `{code, tier}` → `{applicable, message, percent_off, duration_kind, duration_months, allowed_tiers, promo_code_id?, stripe_promo_code_id?}`
- `POST /subscriptions/checkout`: `{tier, promo_code?}` → Stripe session URL (server validates code, attaches promotion_code).

## Subscription Status Payload Extension
- Add `discount` object: `code`, `percent_off`, `duration_kind`, `duration_months`, `remaining_cycles?` (optional), `stripe_coupon_id`, `promo_code_id`.
- History entries include `promo_code` when present.

## Frontend Changes
### Billing Page
- “Have a code?” input + Apply → call validate endpoint.
- Show summary (“50% off Creator for 3 months”), store applied code, pass to checkout request.
- Display on current plan card: discount badge + “X discounted renewals remaining” (if provided).
- Error states for invalid/expired/wrong-tier/maxed-out codes.

### Admin Discount Codes Page
- Form: code (auto-generate), name, percent_off, duration_kind (once/repeating/forever), duration_months (if repeating), allowed tiers (checkboxes), max redemptions, expiry datetime, active toggle, notes.
- Table: code, percent_off, duration, tiers, used/max, expires_at, status, created_by, actions (copy, edit, activate/deactivate).
- Filters: active/expired/exhausted, tier, search by code/name.

### Admin Users Page
- Show badge if user subscription is discounted (code).
- Optional: quick action to create single-use code scoped to this user (allowed_tiers=tier, max_redemptions=1).

## Business Rules & Edge Cases
- Percent off 0–100 (100% allowed).
- Duration:
  - repeating N months → Stripe coupon `duration_in_months`.
  - forever → `duration=forever`.
  - once → `duration=once` (single invoice).
- Plan enforcement: block checkout if tier not allowed; block or warn on tier change if discount doesn’t apply.
- Max redemptions: enforce locally + Stripe `max_redemptions`.
- Expiry: enforce locally + Stripe `expires_at`.
- Single-use: `max_redemptions=1`.
- Proration/tier change: default Stripe behavior unless tier-change endpoint adds explicit `proration_behavior`.

## Testing Matrix
### Unit (Elixir)
- validate_promo: active flag, expiry, tier mismatch, max redemptions, duration kinds, code normalization.
- Stripe creation payloads for coupon/promotion code per duration kind and percent_off.

### Integration
- Checkout with valid/invalid code; discount attached.
- Webhooks: discount applied on creation; ends after N months (simulate invoices); cancellation; expired code rejection; max redemptions exhaustion.
- Stripe sync job reconciling deactivated promotion code.

### E2E (Frontend)
- Apply code → discounted price → checkout → status/history shows code.
- Admin create/deactivate code; user cannot use deactivated/expired/wrong-tier code.

## Observability & Audit
- Audit log for admin create/update/deactivate (admin_id, before/after).
- Metrics: promo validation success/fail by reason; redemptions created; webhook errors; Stripe API errors.
- Alerts: webhook failure rate; Stripe error spikes; coupon creation failures.
- Admin UI indicator if Stripe/DB divergence detected.

## Ops & Maintenance
- Nightly `sync_stripe_promos` job: pull Stripe promotion codes/coupons, update `is_active`, `max_redemptions`, `expires_at`.
- Rate-limit `promo/validate`.
- Bulk deactivate tool for compromised codes.

## Delivery Order (Milestones)
1) Migrations for `promo_codes`, `promo_redemptions` (+ optional FK on subscription history).
2) Stripe helpers for coupon/promotion code create/deactivate.
3) Admin promo APIs with RBAC + audit logging.
4) Public validate endpoint + enhanced checkout accepting `promo_code`.
5) Webhook updates to record redemptions lifecycle.
6) Frontend: Billing coupon input & display; Admin Discount Codes page; Admin Users badge.
7) Tests (unit, integration, e2e) + webhook fixtures.
8) Observability (metrics, alerts) + nightly sync job.
