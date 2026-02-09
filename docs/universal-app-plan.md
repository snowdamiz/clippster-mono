# Implementation Plan - Universal Web & Desktop Support

This plan outlines the steps required to make the Clippster client "Universal," allowing it to run in both a standard web browser (for Organization/Messaging access) and the Tauri desktop shell, without affecting the existing desktop user experience.

## User Review Required

> [!IMPORTANT]
> **No Desktop Parity for Video Editing**: Standard web browsers cannot access the local file system or GPU with the same level of performance as the desktop app. As a result, the **Video Editor** and **Local Projects** will be hidden when accessed via a browser. Browser users will primarily use Clippster for Management (Organizations), Chatting (Messaging), and Campaign tracking.

> [!WARNING]
> **Authentication Redirects**: Browser-based login will use standard redirects (`window.location.href`) instead of the custom Tauri "Auth Window." This requires a small change to how the server handles callback URLs.

## Proposed Changes

### 1. Environment Detection Layer
Create a global utility to detect the environment reliably across all components.

#### [NEW] [env.ts](file:///c:/Users/brand/Documents/Dev/clippster-mono/client/src/utils/env.ts)
- Implement `isTauri()`: Returns `true` if `window.__TAURI_INTERNALS__` exists.
- Implement `isWeb()`: Returns `!isTauri()`.
- Export constants for easy use in Vue templates.

---

### 2. Authentication Refactor
Update `auth.js` to support browser-native OAuth flows.

#### [MODIFY] [auth.js](file:///c:/Users/brand/Documents/Dev/clippster-mono/client/src/stores/auth.js)
- **authenticateWithGoogle**: If `isWeb()`, redirect the current window to the Google Auth URL instead of invoking a Tauri window.
- **authenticateWithWallet**: If `isWeb()`, use standard browser wallet adapters (like Phantom/Solana) or redirect to a standalone auth portal.
- **checkAuth**: Ensure `setUserContext` (which calls Tauri commands) is only invoked if `isTauri()`.

---

### 3. Navigation & Feature Gating
Hide desktop-only features when running in a browser to prevent errors.

#### [MODIFY] [navigation.ts](file:///c:/Users/brand/Documents/Dev/clippster-mono/client/src/config/navigation.ts)
- Add a `tauriOnly` property to the `NavigationItem` interface.
- Mark `Projects`, `Built Clips`, `Video Editor`, and `Stream VODs` as `tauriOnly: true`.

#### [MODIFY] [DashboardSidebar.vue](file:///c:/Users/brand/Documents/Dev/clippster-mono/client/src/components/DashboardSidebar.vue)
- Update `getVisibleGroupItems` to filter out `tauriOnly` items if `isWeb()`.

---

### 4. Asset Management Compatibility
Fix the file selection logic in `OrganizationAssets.vue` for browser users.

#### [MODIFY] [OrganizationAssets.vue](file:///c:/Users/brand/Documents/Dev/clippster-mono/client/src/pages/organization/OrganizationAssets.vue)
- Add a hidden `<input type="file" ref="webFileInput">` to the template.
- **selectFileForUpload**: 
    - If `isTauri()`, keep the existing `@tauri-apps/plugin-dialog` logic.
    - If `isWeb()`, trigger `webFileInput.click()`.
- Add a change handler for standard browser uploads.

---

### 5. Routing & Guards
Handle the OAuth callback when returning from a browser redirect.

#### [NEW] [AuthCallback.vue](file:///c:/Users/brand/Documents/Dev/clippster-mono/client/src/pages/AuthCallback.vue)
- Create a route `/auth-callback` that parses the token from the URL, saves it to `localStorage`, and redirects the user to their dashboard.

## Verification Plan

### Automated Tests
- Run `npm run build` (standard Vite build) and verify that no Tauri imports break the build process.

### Manual Verification
1. **Desktop Test**: Open the Tauri app. Verify all features (Editor, Projects) are visible and functionality is unchanged.
2. **Browser Test**: Run `npm run dev` and open in Chrome.
    - Verify that "Local Projects" and "Video Editor" are hidden from the sidebar.
    - Verify that "Organizations" and "Messages" are visible and fully functional.
    - Trigger a login to verify the browser redirect flow.
    - Upload an asset to verify the standard web file picker.
