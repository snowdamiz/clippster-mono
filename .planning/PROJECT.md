# Clippster

## What This Is

A desktop application for automated long-form to short-form video clip generation and editing. Built as a Tauri + Phoenix monorepo, Clippster combines AI-powered video processing with professional timeline editing, multi-platform authentication, and team collaboration features for content creators and organizations.

## Core Value

Content creators can generate, edit, and distribute short-form clips from long-form video with minimal manual effort.

## Current Milestone: v1.2 Stripe to Paddle Migration

**Goal:** Replace all Stripe payment infrastructure with Paddle — subscriptions, one-time credit purchases, webhooks, coupons/promo codes, affiliate discounts, org billing, admin discounts — with zero functionality degradation.

**Target features:**
- Paddle SDK integration replacing Stripity Stripe library
- Subscription management (create, upgrade, downgrade, cancel, renew) via Paddle
- One-time credit pack purchases via Paddle Checkout
- Webhook handling for full subscription lifecycle (Paddle notification events)
- Promo code / coupon system via Paddle discounts
- Affiliate discount and commission tracking via Paddle
- Organization subscription and add-on billing via Paddle
- Admin discount application via Paddle
- Desktop (Tauri) and web checkout flow support
- Removal of all Stripe code, config, and dependencies

## Requirements

### Validated

- AI clip detection from YouTube, Twitch, Kick, local files
- Professional timeline video editor with multi-track editing
- Whisper transcription with word-level timestamps
- Livestream DVR recording (Kick, Twitch, YouTube)
- Organization workspaces with roles, permissions, invitations
- Clipping campaigns with budgets, submissions, leaderboards
- Instagram OAuth + posting + scheduling (org and personal accounts)
- Twitter/X analytics via twitterapi.io (read-only, external submissions)
- Multi-method auth (Solana wallet, Google OAuth, email/password)
- Stripe subscriptions and credit system
- Team messaging (Telegram-style, real-time via Phoenix Channels)
- Organization asset management (fonts, images, audio, watermarks)
- Clipper profiles with portfolios and performance metrics
- Social media scheduling with retry logic
- Encrypted token storage with auto-refresh
- Official X API posting (OAuth PKCE, media upload, scheduling, reliability hardening)

### Active

- [ ] Paddle SDK backend integration (replace Stripity Stripe)
- [ ] Subscription lifecycle via Paddle (create, upgrade, downgrade, cancel, renew)
- [ ] One-time credit pack purchases via Paddle Checkout
- [ ] Paddle webhook/notification handling for all billing events
- [ ] Promo codes and discounts via Paddle
- [ ] Affiliate discount and commission tracking via Paddle
- [ ] Organization billing (base subscriptions + add-ons) via Paddle
- [ ] Admin/moderator discount system via Paddle
- [ ] Frontend checkout flows updated for Paddle (desktop + web)
- [ ] Complete removal of Stripe code, config, and dependencies

### Out of Scope

- Running the Tauri/Vue admin app inside the website via iframe/embed
- New admin backend APIs (reuse existing `/api/admin/*` endpoints)
- Organization dashboard redesign (scope is admin web parity only)
- TikTok/YouTube net-new platform integrations

## Context

- App admin dashboard already exists and is feature-complete in `client/src/pages/admin/*`
- Website currently supports org dashboards but lacks admin parity routes
- Website and app auth both rely on shared JWT/user local storage conventions
- Backend admin APIs and permissions are already in place and production-used by app admin

## Constraints

- **Parity requirement**: UI and behavior must match app admin implementation
- **Access control**: Admin routes must enforce `is_admin` and allow moderator scope parity
- **No backend churn**: Reuse existing `/api/admin/*` and support endpoints
- **Operational safety**: Keep one backend contract and preserve app parity as admin screens evolve

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Recreate app admin dashboard natively in landing React | Required by product direction; avoids browser execution of Tauri-specific runtime code | Adopted |
| Add explicit website admin route guard | Keeps permissions enforcement aligned with app admin access rules | Adopted |
| Support both `/admin/*` and `/dashboard/admin/*` route surfaces | Preserves deep-link compatibility while keeping one native React admin surface | Adopted |

---
*Last updated: 2026-03-04 after milestone v1.2 started*
