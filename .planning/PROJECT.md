# Clippster

## What This Is

A desktop application for automated long-form to short-form video clip generation and editing. Built as a Tauri + Phoenix monorepo, Clippster combines AI-powered video processing with professional timeline editing, multi-platform authentication, and team collaboration features for content creators and organizations.

## Core Value

Content creators can generate, edit, and distribute short-form clips from long-form video with minimal manual effort.

## Current Milestone: v1.1 Admin Dashboard Web Parity

**Goal:** Deliver a browser-accessible admin dashboard with the same interface and behavior as the app admin dashboard.

**Target features:**
- Web route surface for admin (`/admin/*`) aligned with app route structure
- Admin/moderator-only access control on website admin routes
- Identical admin UI/behavior rendered in website context
- Session continuity between website auth and admin dashboard context

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

- [ ] Web admin route parity (`/admin/*`)
- [ ] Website admin/moderator route guard
- [ ] Embedded app-admin rendering in website with auth sync bridge
- [ ] Verify full admin page coverage from website deep links

### Out of Scope

- Rewriting admin pages into a second independently maintained frontend surface
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
- **Operational safety**: Avoid duplicating 20+ complex admin pages into divergent implementations
- **Config**: Website must resolve client app URL for embedded admin rendering

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Render app admin UI in website via embedded route | Guarantees exact UI/behavior parity without maintaining a second admin codebase | Adopted |
| Add explicit website admin route guard | Keeps permissions enforcement aligned with app admin access rules | Adopted |
| Add cross-context auth sync message (`clippster-auth-sync`) | Ensures embedded admin remains authenticated in website flow | Adopted |

---
*Last updated: 2026-02-20 after milestone v1.1 started*
