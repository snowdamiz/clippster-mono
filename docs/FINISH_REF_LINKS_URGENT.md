# FINISH_REF_LINKS_URGENT

## Problem

The affiliate referral link flow (`https://clippster.app/?ref=BRANDOCLIPS`) does **NOT** track users end-to-end. The `?ref=` parameter is lost when the user transitions from the landing website to the downloaded desktop app.

### Current Broken Flow

1. User clicks `https://clippster.app/?ref=BRANDOCLIPS` → lands on **website** (landing app)
2. Landing page has **no code** to capture the `?ref=` query parameter
3. User downloads the desktop app from the landing page
4. User opens app, signs in with Google OAuth
5. `?ref=` parameter is **gone** — it was on the landing site URL, not in the app
6. User's `referred_by_affiliate_id` is **never set** → affiliate gets no credit

### Where Referral Capture Exists (But Doesn't Help)

- `client/src/components/AuthModal.vue` (lines 408-417) captures `?ref=` from route query and stores in `localStorage`
- This only works if the user navigates to a `?ref=` URL **inside the desktop app**, which never happens in the real-world flow
- The server-side auth controller (`auth_controller.ex`) correctly passes `referral_code` through Google OAuth state and sets `referred_by_affiliate_id` on user creation — but only if the client sends it

### What Currently Works

- Entering an affiliate code in the **promo code field at checkout** — this was just fixed to both apply the discount AND link the user to the affiliate for commission tracking (see `stripe_controller.ex` → `handle_subscription_checkout` → `Affiliates.link_user_to_affiliate`)

## TODO

### Option A: Cookie-Based Persistence (Recommended)

- [ ] **Landing page**: Capture `?ref=` from URL on page load, store in a cookie (e.g., `clippster_ref`, 30-day expiry)
- [ ] **Landing page**: When user clicks download, append `?ref=CODE` to the download URL or store in a server-side session
- [ ] **Desktop app**: On first launch, check if there's a way to retrieve the referral code (deep link, clipboard, or manual entry prompt)
- [ ] Alternative: Add a "Referral Code" input field to the sign-in screen in the desktop app so users can manually enter it

### Option B: Deep Link / Custom Protocol

- [ ] Register a custom protocol (e.g., `clippster://ref/BRANDOCLIPS`)
- [ ] Landing page detects if app is installed and opens via deep link with referral code
- [ ] Desktop app handles the deep link and stores the referral code before auth

### Option C: Web-Based Auth with Referral Persistence (Simplest)

- [ ] Landing page stores `?ref=` in `localStorage`
- [ ] If the landing app has a web-based login/signup flow (not just download), pass referral code through that flow
- [ ] The Google OAuth redirect on the landing site already goes through the server which supports `referral_code` in OAuth state — just need to wire it up

### Minimum Viable Fix

- [ ] At minimum, add a **referral code input field** to the desktop app's auth screen (`AuthModal.vue`) so users can paste the code they saw on the affiliate's page
- [ ] This is the lowest-effort fix that enables the flow without requiring deep links or cross-app state

## Files Involved

| File | Role |
|------|------|
| `landing/src/App.tsx` or root component | Needs to capture `?ref=` from URL |
| `landing/src/pages/PricingPage.tsx` | Download buttons — could append ref to URL |
| `client/src/components/AuthModal.vue` | Already has referral capture, needs UI for manual entry |
| `server/lib/clippster_server_web/controllers/auth_controller.ex` | Already supports `referral_code` in OAuth flow |
| `server/lib/clippster_server/accounts.ex` | `maybe_set_referral` already links users to affiliates at signup |

## Priority

**URGENT** — Affiliate referral links are being shared but provide zero tracking. The only working path is entering the code at checkout (just fixed). The referral link flow needs to work end-to-end.
