# LemonSqueezy Payment Provider — Setup Guide

LemonSqueezy is integrated as a **fallback payment provider** alongside Stripe. Both providers coexist — you can switch between them at any time from the Admin Settings page without code changes. This guide walks you through the full setup: from creating your LemonSqueezy account to going live in production.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [1. Create Your LemonSqueezy Store](#1-create-your-lemonsqueezy-store)
- [2. Create Products & Variants](#2-create-products--variants)
  - [Individual Subscription Tiers](#individual-subscription-tiers)
  - [Organization Base Tiers](#organization-base-tiers)
  - [Organization Add-On Tiers](#organization-add-on-tiers)
- [3. Get Your API Key](#3-get-your-api-key)
- [4. Configure Environment Variables](#4-configure-environment-variables)
- [5. Set Up Webhooks](#5-set-up-webhooks)
- [6. Activate LemonSqueezy as Payment Provider](#6-activate-lemonsqueezy-as-payment-provider)
- [7. Promo Code Sync](#7-promo-code-sync)
- [Architecture Overview](#architecture-overview)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- A [LemonSqueezy](https://www.lemonsqueezy.com/) account (free to create)
- Your Clippster server running (`mix phx.server`)
- Admin access to the application (to toggle the payment provider)
- Your deployment domain (for webhook URL in production)

---

## 1. Create Your LemonSqueezy Store

1. Go to [LemonSqueezy Dashboard](https://app.lemonsqueezy.com/) and sign in
2. If you don't have a store yet, create one:
   - Click **"Create Store"**
   - Enter your store name (e.g. "Clippster")
   - Complete the onboarding (payout details, etc.)
3. Note your **Store ID** — find it in **Settings → General → Store ID** (a numeric ID like `12345`)

---

## 2. Create Products & Variants

You need to create products in LemonSqueezy that correspond to each subscription tier in Clippster. Each tier maps to a **Variant ID** in LemonSqueezy.

> [!IMPORTANT]
> All products must be created as **Subscription** type with **Monthly** billing interval to match the application's 30-day subscription cycle.

### Individual Subscription Tiers

Create 3 products (or 1 product with 3 variants) for individual user subscriptions:

| Tier | Product Name | Price (USD/mo) | Monthly Credits | Env Variable |
|------|-------------|----------------|-----------------|--------------|
| `starter` | Starter | $24.99 | 600 | `LEMONSQUEEZY_VARIANT_STARTER` |
| `creator` | Creator | $49.99 | 1,800 | `LEMONSQUEEZY_VARIANT_CREATOR` |
| `pro` | Pro | $199.99 | 9,000 | `LEMONSQUEEZY_VARIANT_PRO` |

### Organization Base Tiers

Create 3 products for organization-level base subscriptions:

| Tier | Product Name | Price (USD/mo) | Seats | Credits/mo | Env Variable |
|------|-------------|----------------|-------|------------|--------------|
| `enterprise_base` | Enterprise Base | $300.00 | 5 | 0 | `LEMONSQUEEZY_VARIANT_ENTERPRISE_BASE` |
| `enterprise_ai` | Enterprise AI | $500.00 | 5 | 20,000 | `LEMONSQUEEZY_VARIANT_ENTERPRISE_AI` |
| `enterprise_unlimited` | Enterprise Unlimited | $1,800.00 | ∞ | 100,000 | `LEMONSQUEEZY_VARIANT_ENTERPRISE_UNLIMITED` |

### Organization Add-On Tiers

Create 6 products for seat add-ons (these require an active base subscription):

**With AI Credits:**

| Tier | Product Name | Price (USD/mo) | Seats | Credits/mo | Env Variable |
|------|-------------|----------------|-------|------------|--------------|
| `seats_5_ai` | 5 Seats + AI | $250.00 | 5 | 10,000 | `LEMONSQUEEZY_VARIANT_SEATS_5_AI` |
| `seats_10_ai` | 10 Seats + AI | $400.00 | 10 | 20,000 | `LEMONSQUEEZY_VARIANT_SEATS_10_AI` |
| `seats_20_ai` | 20 Seats + AI | $575.00 | 20 | 40,000 | `LEMONSQUEEZY_VARIANT_SEATS_20_AI` |

**Without AI Credits:**

| Tier | Product Name | Price (USD/mo) | Seats | Credits/mo | Env Variable |
|------|-------------|----------------|-------|------------|--------------|
| `seats_5` | 5 Seats | $150.00 | 5 | 0 | `LEMONSQUEEZY_VARIANT_SEATS_5` |
| `seats_10` | 10 Seats | $200.00 | 10 | 0 | `LEMONSQUEEZY_VARIANT_SEATS_10` |
| `seats_20` | 20 Seats | $350.00 | 20 | 0 | `LEMONSQUEEZY_VARIANT_SEATS_20` |

### How to Get Variant IDs

After creating each product:

1. Go to **Products** in your LemonSqueezy dashboard
2. Click on the product
3. Click **Variants** tab (or check the single default variant)
4. The **Variant ID** is displayed in the variant details (a numeric ID like `67890`)
5. Copy this ID — you'll need it for the environment variables

> [!TIP]
> You can also find variant IDs via the LemonSqueezy API:
> ```bash
> curl -s "https://api.lemonsqueezy.com/v1/variants?filter[product_id]=YOUR_PRODUCT_ID" \
>   -H "Authorization: Bearer YOUR_API_KEY" \
>   -H "Accept: application/vnd.api+json" | jq '.data[].id'
> ```

---

## 3. Get Your API Key

1. In LemonSqueezy Dashboard → **Settings → API**
2. Click **"Create New API Key"**
3. Name it something descriptive (e.g. "Clippster Production")
4. Copy the API key immediately — it won't be shown again

---

## 4. Configure Environment Variables

Add the following to your `.env` file (reference `.env.example` for the full list):

```bash
# Core LemonSqueezy config
LEMONSQUEEZY_API_KEY=your_api_key_here
LEMONSQUEEZY_STORE_ID=your_store_id_here
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_signing_secret

# Individual subscription variant IDs
LEMONSQUEEZY_VARIANT_STARTER=variant_id_for_starter
LEMONSQUEEZY_VARIANT_CREATOR=variant_id_for_creator
LEMONSQUEEZY_VARIANT_PRO=variant_id_for_pro

# Organization base tier variant IDs
LEMONSQUEEZY_VARIANT_ENTERPRISE_BASE=variant_id_for_enterprise_base
LEMONSQUEEZY_VARIANT_ENTERPRISE_AI=variant_id_for_enterprise_ai
LEMONSQUEEZY_VARIANT_ENTERPRISE_UNLIMITED=variant_id_for_enterprise_unlimited

# Organization add-on tier variant IDs
LEMONSQUEEZY_VARIANT_SEATS_5_AI=variant_id_for_5_seats_ai
LEMONSQUEEZY_VARIANT_SEATS_10_AI=variant_id_for_10_seats_ai
LEMONSQUEEZY_VARIANT_SEATS_20_AI=variant_id_for_20_seats_ai
LEMONSQUEEZY_VARIANT_SEATS_5=variant_id_for_5_seats
LEMONSQUEEZY_VARIANT_SEATS_10=variant_id_for_10_seats
LEMONSQUEEZY_VARIANT_SEATS_20=variant_id_for_20_seats

# Optional: Override redirect URLs (defaults shown)
LEMONSQUEEZY_SUCCESS_URL=http://localhost:1420/ls-success
LEMONSQUEEZY_CANCEL_URL=http://localhost:1420/ls-cancel
```

> [!NOTE]
> These variables are loaded in `server/config/runtime.exs` under the `:lemonsqueezy` config key. The variant ID lookup is dynamic — tier name `"starter"` maps to config key `:variant_starter`, which reads `LEMONSQUEEZY_VARIANT_STARTER`.

---

## 5. Set Up Webhooks

LemonSqueezy webhooks notify your server when subscriptions are created, renewed, or cancelled.

### Webhook URL

Your webhook endpoint is:

```
https://your-domain.com/api/webhooks/lemonsqueezy
```

For local development with a tunnel (e.g. ngrok):

```
https://your-ngrok-id.ngrok.io/api/webhooks/lemonsqueezy
```

### Configure in LemonSqueezy Dashboard

1. Go to **Settings → Webhooks**
2. Click **"Add Webhook"**
3. Set the **Callback URL** to your webhook endpoint above
4. Set a **Signing secret** — copy this value, its what you'll use for `LEMONSQUEEZY_WEBHOOK_SECRET`
5. Select the following events:
   - ✅ `subscription_created`
   - ✅ `subscription_payment_success`
   - ✅ `subscription_cancelled`
   - ✅ `subscription_updated` (optional, for future use)
6. Click **Save**

> [!CAUTION]
> The **Signing Secret** you set here must exactly match `LEMONSQUEEZY_WEBHOOK_SECRET` in your environment. Mismatched secrets will cause all webhook events to be rejected with a 401 response.

### Webhook Events Handled

| Event | What it Does |
|-------|-------------|
| `subscription_created` | Creates a new subscription (user or org base/addon) based on checkout custom_data |
| `subscription_payment_success` | Renews the subscription period for the user or organization |
| `subscription_cancelled` | Marks the subscription as cancelled |

### How the Server Identifies Context

The webhook handler reads `custom_data` (set during checkout) to decide what to do:

- **Individual user subscription**: `custom_data` contains `user_id` and `tier`
- **Organization base subscription**: `custom_data` contains `organization_id`, `tier`, and `subscription_type: "base"`
- **Organization add-on**: `custom_data` contains `organization_id`, `tier`, and `subscription_type: "addon"`

---

## 6. Activate LemonSqueezy as Payment Provider

Once everything is configured, switch the active payment provider:

### Option A: Admin Settings UI (Recommended)

1. Log in as an admin user
2. Navigate to **Admin → Settings**
3. In the **Payment Provider** section, select **LemonSqueezy**
4. The change takes effect immediately — all new checkouts will use LemonSqueezy

### Option B: API Call

```bash
curl -X PUT https://your-domain.com/api/admin/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "payment_provider", "value": "lemonsqueezy"}'
```

### Switching Back to Stripe

Simply select **Stripe** in the Admin Settings UI or set the value to `"stripe"` via API. Existing subscriptions are not affected — the provider setting only controls which checkout system is used for **new** subscriptions.

> [!WARNING]
> Switching providers does **not** migrate existing subscriptions. Users with active LemonSqueezy subscriptions will continue to be billed through LemonSqueezy, and vice versa for Stripe. Both webhook endpoints remain active regardless of the current provider setting.

---

## 7. Promo Code Sync

Promo codes are dual-synced between Stripe and LemonSqueezy automatically:

- When you **create a promo code** in the admin panel, it's automatically created as a discount in both Stripe and LemonSqueezy
- When you **toggle a promo code** active/inactive, the corresponding LemonSqueezy discount is deleted or recreated
- Promo codes are applied at the checkout level — LemonSqueezy calls them "discount codes"

The sync uses the `ls_discount_id` field on the `PromoCode` schema to track the LemonSqueezy-side discount ID.

> [!NOTE]
> If you need to manually sync a promo code, you can delete and recreate it from the admin panel. The system will automatically create corresponding discounts in both payment providers.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Vue)                           │
│                                                                 │
│  SubscribeDialog.vue ──▶ POST /subscription/checkout            │
│                          POST /organizations/:id/sub/checkout   │
│                          POST /organizations/:id/sub/addons/... │
│                                                                 │
│  AdminSettings.vue ───▶ PUT /admin/settings (payment_provider)  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Elixir)                             │
│                                                                 │
│  Controllers check AppSettings.get_payment_provider():          │
│                                                                 │
│    "stripe"       → Stripe API (existing)                       │
│    "lemonsqueezy" → LemonSqueezy.create_checkout/3              │
│                     LemonSqueezy.create_org_checkout/5           │
│                                                                 │
│  Webhook Endpoints (both always active):                        │
│    POST /webhooks/stripe        → StripeController.webhook      │
│    POST /webhooks/lemonsqueezy  → LemonSqueezyController.webhook│
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Context Modules                               │
│                                                                 │
│  Subscriptions.create_lemonsqueezy_subscription/3               │
│  OrganizationSubscriptions.create_lemonsqueezy_subscription/3   │
│  OrganizationSubscriptions.add_addon_lemonsqueezy/3             │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `server/config/runtime.exs` | LemonSqueezy config (API key, store ID, variant IDs) |
| `server/lib/clippster_server/lemonsqueezy.ex` | Core LS context: checkout creation, discount management, webhook verification |
| `server/lib/clippster_server_web/controllers/lemonsqueezy_controller.ex` | Webhook handler + user checkout endpoint |
| `server/lib/clippster_server_web/controllers/organization_subscription_controller.ex` | Org checkout with provider branching |
| `server/lib/clippster_server/subscriptions.ex` | User subscription management |
| `server/lib/clippster_server/organization_subscriptions.ex` | Org subscription management |
| `server/lib/clippster_server/app_settings.ex` | Payment provider toggle |

---

## Troubleshooting

### "LemonSqueezy is not configured"

**Cause:** `LEMONSQUEEZY_API_KEY` or `LEMONSQUEEZY_STORE_ID` is missing or empty.

**Fix:** Ensure both environment variables are set and the server is restarted.

### "Subscription tier not configured for LemonSqueezy"

**Cause:** The variant ID for the selected tier is missing. For example, if a user tries to subscribe to `"creator"` but `LEMONSQUEEZY_VARIANT_CREATOR` is empty.

**Fix:** Set the corresponding `LEMONSQUEEZY_VARIANT_*` env var with the correct variant ID from your LS dashboard.

### Webhooks returning 401

**Cause:** The webhook signing secret doesn't match.

**Fix:** Ensure `LEMONSQUEEZY_WEBHOOK_SECRET` exactly matches the signing secret configured in LemonSqueezy Dashboard → Settings → Webhooks.

### Webhooks not arriving

**Possible causes:**
1. Webhook URL is incorrect or unreachable from the internet
2. The required events aren't selected in the webhook configuration
3. Firewall or reverse proxy is blocking the requests

**Debug:** Check server logs for `[LemonSqueezy]` prefixed messages. Enable debug logging if needed.

### Checkouts succeed but subscription not created

**Cause:** Webhook event isn't being processed. The checkout redirects the user before the webhook arrives.

**Fix:**
1. Verify webhooks are configured and arriving (check server logs)
2. Ensure `subscription_created` event is selected in the webhook configuration
3. Check that the correct custom_data is being passed (look for `organization_id`, `tier`, `subscription_type` in logs)

### Promo codes not applying at checkout

**Cause:** The discount code doesn't exist in LemonSqueezy, or the `ls_discount_id` is not set on the promo code.

**Fix:** Delete and recreate the promo code from the admin panel to trigger a fresh sync to both Stripe and LemonSqueezy.
