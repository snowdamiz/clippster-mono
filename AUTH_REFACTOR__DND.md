# Client-Side Authentication Refactor Plan

## Overview

Transform the app from authentication-required to open-access with credit-based gating for specific operations. Users can explore the app and work with local data without authentication, but need to authenticate and purchase credits for AI-powered clip detection.

## Core Changes

### 1. Router Configuration (`client/src/router/index.ts`)

- Remove `meta: { requiresAuth: true }` from all routes except `/admin`
- Update the global navigation guard to only check admin access, not general auth
- Keep redirect from authenticated users away from `/login` page
- Default route `/` should redirect to `/projects` without auth check

**Routes to make public:**

- `/projects`, `/clips`, `/videos`, `/assets`, `/prompts`, `/pricing`, `/pumpfun`, `/kick`, `/twitch`, `/youtube`

**Routes to keep protected:**

- `/admin` (requires auth + admin status)

### 2. App Initialization (`client/src/App.vue`)

- Keep the `checkAuth()` call on mount (to restore session if available)
- Don't block app loading if auth check fails
- App should work fully without authentication

### 3. Sidebar Credit Display (`client/src/components/DashboardSidebar.vue`)

- Check if user is authenticated before showing credit balance
- If not authenticated: show "Sign in to view credits" message with link to login
- If authenticated: show current balance as before
- Make the entire credit card clickable to either login or view pricing

### 4. Clip Detection Authorization (`client/src/components/ProjectWorkspaceDialog.vue` & `ClipDetectionConfirmDialog.vue`)

**In ProjectWorkspaceDialog.vue:**

- Before showing `ClipDetectionConfirmDialog`, check if user is authenticated
- If not authenticated, show auth modal/redirect to login
- After successful auth, check credits and show detection dialog

**In ClipDetectionConfirmDialog.vue:**

- Add auth check when dialog opens
- If not authenticated when trying to confirm, show error and redirect to login
- Keep existing credit balance checks for authenticated users

### 5. Credit Balance Composable (`client/src/composables/useCreditBalance.ts`)

- Handle unauthenticated state gracefully (return null/0 instead of error)
- Don't throw error when token is missing, just return appropriate state
- Add `isAuthenticated` computed property to expose auth state

### 6. Pricing Page (`client/src/pages/Pricing.vue`)

- Make balance fetching optional (only if authenticated)
- Show pricing packs to everyone (public access)
- Show "Sign in to purchase" if not authenticated
- If authenticated with 0 credits, show normal purchase flow
- Balance display should handle unauthenticated state

### 7. API Interceptor (`client/src/services/api.ts`)

- Keep the 401 response handler
- Don't auto-logout on 401 for operations that might be called without auth
- Dispatch 'auth-required' event for components to handle individually

### 8. Navigation Guard Enhancement

- Create a composable `useAuthGuard` for components to check auth before credit operations
- This can be reused across any component that needs to gate features behind auth

## Implementation Order

1. Update router to remove auth requirements
2. Update `useCreditBalance` to handle unauthenticated state
3. Update sidebar to show "Sign in" message when not authenticated
4. Update pricing page to be publicly accessible
5. Update clip detection flow to check auth before showing dialog
6. Test all flows: unauthenticated browsing, auth flow, clip detection, credit purchase

## Key Behaviors

**Unauthenticated Users Can:**

- Browse all pages (projects, clips, videos, etc.)
- View their local SQLite data
- Create projects and upload videos
- See the pricing page
- Edit prompts and assets

**Unauthenticated Users Cannot:**

- Detect clips (AI processing)
- See their credit balance
- Purchase credits (must auth first)
- Access admin panel

**When Attempting Clip Detection Without Auth:**

1. Show authentication dialog
2. After successful auth, check credit balance
3. If balance is 0, show option to go to pricing
4. If balance is sufficient, proceed with detection