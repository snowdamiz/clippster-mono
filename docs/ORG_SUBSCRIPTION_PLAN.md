# Subscription Gate + Solo Tier + Admin Org Subscription Management

Gate newly-approved organizations behind a subscription paywall, add a "Solo" tier ($149.99/mo), allow admin to grant subscriptions with zero credits, and support discount codes during checkout.

## Current State

- **No subscription enforcement**: Approved orgs get full dashboard access with no subscription.
- **Existing tiers**: Enterprise Base ($300, 5 seats), Enterprise AI ($500, 5 seats + 20k credits), Enterprise Unlimited ($1800, unlimited seats + 100k credits).
- **Promo codes exist**: Full system with `validate_org_promo`, percent-off, Stripe integration, per-org redemption tracking.
- **`subscription_status` on org**: `none | active | cancelled | expired` — new orgs default to `"none"`.
- **Admin org panel** (`client/src/pages/admin/AdminOrganizations.vue`): Lists orgs, has "Set Credits" dialog. No subscription management.
- **Admin user subscription**: Endpoints exist for granting/extending/changing user subscriptions (`admin_grant_subscription`), but nothing equivalent for org subscriptions.
- **Credit removal**: Admin can already set org credits to 0 via `PUT /admin/organizations/:id/credits` with `hours_remaining: 0`. The UI for this exists in `AdminOrganizations.vue`.

---

## Bug Fixes

Fix tier key mismatches and parameter bugs discovered during review.

### `server/lib/clippster_server/promo_codes/promo_code.ex` — `valid_org_tiers` mismatch (line 135)
- `"enterprise"` → `"enterprise_base"` (matches `@org_subscription_tiers` key)
- `"addon_5_seats"` → `"seats_5"`
- `"addon_5_seats_ai"` → `"seats_5_ai"`
- `"addon_10_seats"` → `"seats_10"`
- `"addon_10_seats_ai"` → `"seats_10_ai"`
- Add `"seats_20"` and `"seats_20_ai"` (missing entirely)
- Add `"solo"` (new tier)

### `landing/src/components/organization/SubscribeDialog.tsx` — wrong param key (line 59)
- `tier_id: plan.id` → `tier: plan.id` (backend expects `"tier"`)

---

## Part 1: New "Solo" Tier

| Field | Value |
|---|---|
| Key | `"solo"` |
| Price | $149.99/mo |
| Seats | `nil` (unlimited invites/hires) |
| Monthly Credits | 0 |
| Notes | Can do everything **except** `create_member_account` (org-created accounts). Can invite/hire existing users. Can purchase credits separately and distribute them. |

### Changes
- **`server/lib/clippster_server/organization_subscriptions.ex`** — Add `"solo"` to `@org_subscription_tiers`
- **`server/lib/clippster_server/organizations/organization.ex`** — Add `"solo"` to `validate_inclusion` in `subscription_changeset` (line 91)
- **`server/lib/clippster_server/promo_codes/promo_code.ex`** — Add `"solo"` to `valid_org_tiers` (line 135)
- **`server/lib/clippster_server/organizations.ex`** — In `create_member_account`, add check: if `org.subscription_tier == "solo"`, return `{:error, :solo_tier_no_accounts}`. Invites/hires still work since `max_seats: nil` means unlimited.

---

## Part 2: Admin Grant Org Subscription (with zero-credit option)

Admin can grant any subscription tier to an org with a `grant_credits: false` flag, so the org gets the tier's access level but zero AI credits.

### Backend
- **`server/lib/clippster_server/organization_subscriptions.ex`**
  - New function `admin_grant_subscription(organization_id, tier, days \\ 30, grant_credits \\ true)`
    - Sets `subscription_status: "active"`, `subscription_tier`, `subscription_renewal_method: "admin"`
    - Sets `max_seats` from tier info
    - Only grants `monthly_credits` if `grant_credits == true`
  - New function `admin_set_seats(organization_id, max_seats)` — directly sets seat count
- **`server/lib/clippster_server_web/controllers/admin_controller.ex`**
  - New action `grant_org_subscription(conn, %{"organization_id" => id, "tier" => tier, "days" => days, "grant_credits" => bool})`
  - New action `set_org_seats(conn, %{"organization_id" => id, "max_seats" => count})`
  - New action `cancel_org_subscription(conn, %{"organization_id" => id})`
- **`server/lib/clippster_server_web/router.ex`** — Add admin routes:
  - `post "/admin/organizations/:organization_id/subscription"` → `grant_org_subscription`
  - `post "/admin/organizations/:organization_id/subscription/cancel"` → `cancel_org_subscription`
  - `put "/admin/organizations/:organization_id/seats"` → `set_org_seats`

### Frontend (Tauri Admin Panel)
- **`client/src/pages/admin/AdminOrganizations.vue`**
  - Add subscription info column to the org table (tier, status, seats)
  - Add "Grant Subscription" button per org → opens dialog with:
    - Tier dropdown (Solo, Enterprise Base, Enterprise AI, Enterprise Unlimited)
    - Days input (default 30)
    - "Grant AI Credits" checkbox (default unchecked)
  - Add "Set Seats" button → opens dialog with seat count input
  - Add "Cancel Subscription" button for orgs with active subscriptions
  - Show subscription status badge per org row

---

## Part 3: Subscription Gate

Block org dashboard access until subscription is active.

### Backend
- **`server/lib/clippster_server_web/plugs/ensure_org_subscription.ex`** (new)
  - Plug that checks `org.subscription_status in ["active", "cancelled"]`
  - `"cancelled"` still has access until `end_date` (standard Stripe behavior)
  - Returns `403` with `%{success: false, error: "subscription_required"}` if `"none"` or `"expired"`
  - Exempts subscription-related endpoints (tiers, checkout, promo validate, status, cancel, crypto)
  - **Grandfathers legacy orgs**: Orgs with `subscription_status: "none"` AND `inserted_at` before the migration date are exempt
- **`server/lib/clippster_server_web/router.ex`** — Apply plug to org-scoped routes (not subscription routes)
- **Org API response** — Include `subscription_status` in org data so frontend can gate client-side

### Landing App
- **`landing/src/pages/dashboard/OrgSubscriptionRequired.tsx`** (new) — Full-page subscription selection:
  - Shows available tiers with pricing
  - Promo code input + validate button
  - Stripe checkout button
  - Styled consistently with existing dashboard pages
- **`landing/src/main.tsx`** — Add route `/dashboard/org/:id/subscribe`
- **`landing/src/layouts/DashboardLayout.tsx`** — Check `subscription_status`; if `"none"` or `"expired"`, redirect to `/dashboard/org/:id/subscribe`
  - **Exempt the billing/subscribe page itself** from the gate so orgs can actually subscribe
  - Flow: org approved → user redirected to `/dashboard/org/:id` → `DashboardLayout` checks subscription → redirects to subscribe page → user subscribes → redirected back to hub

### Tauri App
- **`client/src/router/index.ts`** — Add `beforeEnter` guard on `/organization/:id` routes; redirect to `/organization/:id/billing` if no active subscription
  - **Exempt the billing page itself** from the guard

---

## Part 4: Admin Org List — Show Subscription Info

The `GET /admin/organizations` endpoint currently returns `id, name, description, member_count, credits, created_at`. Need to add subscription fields.

### Backend
- **`server/lib/clippster_server_web/controllers/admin_controller.ex`** — In `list_organizations`, include `subscription_status`, `subscription_tier`, `max_seats`, `subscription_end_date` in the response

---

## Part 5: Subscription Changes (Cancel, Upgrade, Downgrade)

Orgs can cancel, upgrade, or downgrade their subscription at any time. Cancellation continues until period end. Upgrades are prorated immediately. Downgrades take effect at next billing cycle.

### Backend
- **`server/lib/clippster_server/organization_subscriptions.ex`**
  - `cancel_subscription/1` already exists — sets status to `"cancelled"`, access continues until `end_date`. No changes needed.
  - New function `change_subscription_tier(organization_id, new_tier)`:
    - **Upgrade** (new tier price > current): Calls `Stripe.Subscription.update` with `proration_behavior: "create_prorations"` and new price. Stripe charges the prorated difference immediately. Updates org's `subscription_tier`, `max_seats`, `monthly_credits` right away.
    - **Downgrade** (new tier price < current): Calls `Stripe.Subscription.update` with the new price scheduled at period end (`proration_behavior: "none"` + Stripe subscription schedule or `billing_cycle_anchor: "unchanged"`). Stores `pending_subscription_tier` on org so the UI can show "Downgrading to X at end of period." Actual tier change happens when `customer.subscription.updated` webhook fires at renewal.
  - New function `get_pending_tier_change(organization_id)` — returns pending downgrade info if any
- **`server/lib/clippster_server/organizations/organization.ex`**
  - Add field `pending_subscription_tier` (string, nullable) — stores the tier the org is downgrading to at period end
  - Add to `subscription_changeset`
- **`server/lib/clippster_server_web/controllers/organization_subscription_controller.ex`**
  - New action `change_tier(conn, %{"id" => org_id, "tier" => new_tier})` — validates tier, determines upgrade vs downgrade, calls appropriate function
  - New action `proration_preview(conn, %{"id" => org_id, "tier" => new_tier})` — calls Stripe API to get upcoming invoice preview with the new price, returns `%{proration_amount: X, new_price: Y, effective_date: Z}`
- **`server/lib/clippster_server_web/router.ex`**
  - Add route: `put "/organizations/:id/subscription/tier"` → `change_tier`
  - Add route: `get "/organizations/:id/subscription/proration-preview"` → `proration_preview`
- **`server/lib/clippster_server_web/controllers/stripe_controller.ex`**
  - Update `customer.subscription.updated` handler to also check org subscriptions (currently only checks user subscriptions)
  - If no user found via `Subscriptions.get_user_by_stripe_subscription`, fallback: check `OrganizationSubscriptions.get_by_stripe_subscription`
  - Handle org cases:
    - `cancel_at_period_end == true` → call `OrganizationSubscriptions.cancel_subscription(org.id)`
    - `status in ["canceled", "unpaid", "incomplete_expired"]` → call `OrganizationSubscriptions.expire_subscription(org.id)`
    - If org has `pending_subscription_tier`, apply the tier change on renewal: update `subscription_tier`, `max_seats`, `monthly_credits`, clear `pending_subscription_tier`

### Frontend
- **`landing/src/pages/dashboard/OrgBilling.tsx`**
  - Add "Change Plan" button next to current subscription
  - Show tier selection with upgrade/downgrade labels and price differences
  - Show proration preview for upgrades ("You'll be charged $X now for the remainder of this period")
  - Show pending downgrade notice if `pending_subscription_tier` is set
- **`client/src/pages/organization/OrganizationBilling.vue`**
  - Same "Change Plan" UI as landing app
- **`client/src/composables/useOrganization.ts`** — add `pending_subscription_tier?: string | null` to `OrganizationSubscription` interface
- **`landing/src/types/organization.ts`** — add `pending_subscription_tier?: string | null` to `OrganizationSubscription` interface
- **`landing/src/hooks/useOrganization.ts`** — expose `pending_subscription_tier` from subscription state (already available via `state.subscription`)

### Database Migration
- Add `pending_subscription_tier` column to `organizations` table (string, nullable)

---

## Design Decisions (Resolved)

1. **Solo seats**: `max_seats: nil` (unlimited invites/hires), but `create_member_account` blocked. Solo orgs can invite existing users and hire clippers, just can't create new accounts under them.
2. **Legacy orgs**: Grandfathered in — existing orgs (created before migration) are exempt from the subscription gate.
3. **Cancelled sub**: Access continues until `end_date`. Gate only blocks `"none"` and `"expired"`.
4. **Extra seats**: The existing add-on system (`seats_5`, `seats_10`, `seats_20`, etc.) remains as-is. No separate $20/seat subscriptions.
5. **Crypto payments**: Remain disabled ("Coming Soon") until further notice.
