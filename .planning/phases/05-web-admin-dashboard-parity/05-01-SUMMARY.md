---
phase: 05-web-admin-dashboard-parity
plan: 01
subsystem: landing/admin-web
tags: [admin, web-dashboard, parity, routing, auth-sync]

dependency_graph:
  requires:
    - phase: 04-02
      provides: "Completed prior roadmap phase; project ready for phase 05"
  provides:
    - "Admin-only web routes (/admin/*, /dashboard/admin/*)"
    - "Admin/moderator route guard in landing"
    - "Embedded app-admin UI in website shell"
    - "PostMessage auth sync from landing -> client app iframe"
  affects:
    - "Website admins can access identical app admin interface"
    - "Future web-admin work can remain single-source in client admin pages"

key_files:
  created:
    - path: "landing/src/components/AdminRoute.tsx"
      exports: ["AdminRoute"]
    - path: "landing/src/pages/admin/AdminDashboardEmbed.tsx"
      exports: ["AdminDashboardEmbed"]
    - path: ".planning/phases/05-web-admin-dashboard-parity/05-01-PLAN.md"
      change: "Phase plan created"
  modified:
    - path: "landing/src/main.tsx"
      change: "Added admin web routes and lazy-loaded embed page"
    - path: "landing/src/pages/dashboard/DashboardIndex.tsx"
      change: "Admins/moderators redirect to /admin"
    - path: "landing/src/types/auth.ts"
      change: "Added is_moderator to auth user typing"
    - path: "client/src/main.ts"
      change: "Added clippster-auth-sync message listener"

metrics:
  tasks_completed: 2
  files_created: 3
  files_modified: 4
  tests_added: 0
  completed_date: "2026-02-20"

verification:
  - "landing: yarn build (pass)"
  - "client: yarn build (pass)"
---

# Phase 05 Plan 01 Summary

Implemented a web-admin parity route by embedding the existing app admin dashboard inside the website, guarded by admin/moderator access and backed by auth sync for iframe context.

## What shipped

- Added `AdminRoute` access control in landing:
  - unauthenticated -> `/login`
  - authenticated non-admin/non-moderator -> `/dashboard`
- Added website admin routes:
  - `/admin/*`
  - `/dashboard/admin/*`
- Added admin embed page (`AdminDashboardEmbed`) that:
  - resolves target client admin URL from `VITE_CLIENT_APP_URL`
  - maps nested route paths to matching app admin paths
  - renders full-height iframe for exact UI/functionality parity
  - includes "Open full admin app" link fallback
- Added cross-app auth sync:
  - landing posts `clippster-auth-sync` token/user/provider to iframe
  - client listens for allowed origins, persists auth values, and refreshes auth state
- Updated dashboard index routing so admins/moderators land on `/admin`.

## Build/validation

- `landing`: `yarn build` passed
- `client`: `yarn build` passed

## Config required for production

Set `VITE_CLIENT_APP_URL` in `landing` so `/admin/*` can embed the web-served client app admin routes.

Example:

```bash
VITE_CLIENT_APP_URL=https://app.your-domain.com
```

## Notes

This implementation keeps admin UI and behavior identical by using the same source admin pages from `client/src/pages/admin/*` rather than duplicating a second admin implementation in landing.
