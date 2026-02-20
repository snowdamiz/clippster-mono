---
phase: 05-web-admin-dashboard-parity
plan: 01
subsystem: landing/admin-web
tags: [admin, web-dashboard, parity, routing, react]

dependency_graph:
  requires:
    - phase: 04-02
      provides: "Completed prior roadmap phase; project ready for phase 05"
  provides:
    - "Native React admin route surface in landing"
    - "Admin/moderator route guard in landing"
    - "Deep-link parity across /admin/* and /dashboard/admin/*"
    - "Expanded admin API coverage and native page implementations"
  affects:
    - "Website admins use admin tools directly in browser without iframe/Tauri dependencies"
    - "Admin behavior remains aligned with existing backend APIs used by app admin"

key_files:
  created:
    - path: "landing/src/components/AdminRoute.tsx"
      exports: ["AdminRoute"]
    - path: "landing/src/components/admin/AdminSidebar.tsx"
      exports: ["AdminSidebar"]
    - path: "landing/src/layouts/AdminLayout.tsx"
      exports: ["AdminLayout"]
  modified:
    - path: "landing/src/main.tsx"
      change: "Added native admin routes and deep-link coverage for /admin/* and /dashboard/admin/*"
    - path: "landing/src/services/adminApi.ts"
      change: "Expanded admin API client coverage for all admin pages"
    - path: "landing/src/pages/admin/*.tsx"
      change: "Implemented native React admin pages and table/action workflows"

metrics:
  tasks_completed: 2
  files_created: 3
  files_modified: 20
  tests_added: 0
  completed_date: "2026-02-20"

verification:
  - "landing: yarn build (pass)"
---

# Phase 05 Plan 01 Summary

Implemented native React admin dashboard parity in `landing` and removed reliance on embedded app/Tauri runtime behavior in browser.

## What shipped

- Added website admin route guard (`AdminRoute`) for authentication and role checks (`is_admin` / `is_moderator`).
- Added full native admin route map under `/admin/*`.
- Added mirrored deep-link support under `/dashboard/admin/*` using the same route children.
- Added admin shell components (`AdminLayout`, `AdminSidebar`) and consistent navigation behavior.
- Expanded `landing` admin API service coverage for users, organizations, bug reports, analytics, settings, applications, affiliates, support, staff messaging, and mod logs.
- Replaced placeholder admin surfaces with native React admin pages wired to backend endpoints.
- Added higher-parity list actions on users and organizations (role updates, credits, subscription operations, org account management helpers).

## Build/validation

- `landing`: `yarn build` passed

## Notes

This implementation keeps admin functionality browser-native while reusing the same backend API contract as the app admin dashboard.
