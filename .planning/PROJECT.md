# Clippster

## What This Is

A desktop application for automated long-form to short-form video clip generation and editing. Built as a Tauri + Phoenix monorepo, Clippster combines AI-powered video processing with professional timeline editing, multi-platform authentication, and team collaboration features for content creators and organizations.

## Core Value

Content creators can generate, edit, and distribute short-form clips from long-form video with minimal manual effort.

## Current Milestone: v1.0 Official X API Posting

**Goal:** Add direct posting to X (Twitter) via the official X API v2, matching Instagram's integration depth — OAuth for org and personal accounts, immediate and scheduled posting, media upload.

**Target features:**
- X OAuth 2.0 with PKCE for organization accounts
- X OAuth 2.0 with PKCE for personal/clipper accounts
- Tweet creation with media (images and video)
- Scheduled posting via existing scheduling infrastructure
- Platform-specific validation (280 char limit, media constraints)

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

### Active

- [ ] X OAuth 2.0 with PKCE (org accounts)
- [ ] X OAuth 2.0 with PKCE (personal/clipper accounts)
- [ ] Tweet creation with media upload via official X API v2
- [ ] Scheduled X posting via existing scheduling system
- [ ] Platform-specific caption validation for X

### Out of Scope

- Replacing twitterapi.io for analytics — current read-only stats work fine
- TikTok API integration — future milestone
- YouTube API integration — future milestone
- X Premium features (long tweets, extended video) — v1.0 targets standard limits

## Context

- Instagram integration is fully operational and serves as the reference implementation
- The `Platform` behavior pattern (`authorize_url`, `exchange_code`, `refresh_tokens`, `get_user_profile`, `publish_media`, `get_insights`) provides the contract
- Existing scheduling worker, token refresh worker, and analytics sync worker are platform-agnostic
- Client-side PublishDialog and ScheduledPostsList already support platform selection
- X API v2 uses OAuth 2.0 with PKCE (different from Instagram's server-side OAuth)
- X media upload uses the v1.1 upload endpoint (`upload.twitter.com`) even with v2 tweet creation
- twitterapi.io remains for external post analytics (separate concern)

## Constraints

- **Tech stack**: Must follow existing Platform behavior pattern — no one-off implementations
- **Auth**: X OAuth 2.0 with PKCE (required by X API v2 for user-context endpoints)
- **Token storage**: Must use existing `TokenEncryption` module and encrypted columns
- **Character limit**: 280 characters for standard accounts (not Premium)
- **Media**: v1.1 upload endpoint for media, v2 for tweet creation
- **Existing infra**: Reuse scheduling worker, token refresh worker, post_submissions table

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep twitterapi.io for analytics | Works for external submissions, separate concern from posting | -- Pending |
| Follow Instagram pattern exactly | Proven architecture, minimal new abstractions needed | -- Pending |
| Standard account limits only | Simpler scope, Premium features can be added later | -- Pending |

---
*Last updated: 2026-02-09 after milestone v1.0 started*
