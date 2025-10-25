# Phantom Wallet Authentication Fix

## Problem
The authentication flow was opening a new Tauri webview window which doesn't have access to browser extensions like Phantom wallet. This caused the "Phantom wallet not detected" error.

## Solution
Changed the authentication flow to open the user's default browser (where Phantom is installed) instead of a Tauri webview window.

## Implementation Details

### 1. Local Callback Server (Rust)
**File**: `client/src-tauri/src/lib.rs`

- Added a local HTTP server running on port 48274
- Serves the `wallet-auth.html` page at `http://localhost:48274/wallet-auth`
- Provides `/auth-callback` endpoint to receive authentication results from the browser
- Emits Tauri events when authentication is complete
- Stores auth results that can be polled by the frontend

**New Dependencies** (`Cargo.toml`):
- `tokio` - Async runtime for the server
- `warp` - HTTP server framework
- `once_cell` - Static initialization

### 2. Browser-Based Authentication Page
**File**: `client/public/wallet-auth.html`

- Opens in the user's default browser (not a Tauri webview)
- Has access to Phantom wallet extension
- After successful authentication, sends results to `http://localhost:48274/auth-callback`
- Shows clear success message telling user they can close the tab

### 3. Updated Frontend Store
**File**: `client/src/stores/auth.js`

- Opens browser via `invoke('open_wallet_auth_window')`
- Listens for Tauri events from the Rust backend
- Polls for auth results as a fallback (every 1 second)
- Increased timeout to 5 minutes
- Properly cleans up listeners and intervals

## Authentication Flow

```
1. User clicks "Connect Wallet" in Tauri app
   ↓
2. Tauri app starts local HTTP server (if not already running)
   ↓
3. Opens default browser to http://localhost:48274/wallet-auth
   ↓
4. User sees wallet-auth.html in their browser (has Phantom extension)
   ↓
5. User clicks "Connect Wallet" button
   ↓
6. Phantom extension prompts for connection and signature
   ↓
7. Browser page sends auth result to http://localhost:48274/auth-callback
   ↓
8. Rust server receives callback, stores result, emits Tauri event
   ↓
9. Frontend receives event (or polls for result) and continues auth flow
   ↓
10. Backend verifies signature and issues JWT token
   ↓
11. User is authenticated in the Tauri app
```

## Testing Steps

1. **Install dependencies**:
   ```bash
   cd client/src-tauri
   cargo build
   ```

2. **Run the app**:
   ```bash
   cd client
   npm run tauri dev
   ```

3. **Test authentication**:
   - Click "Connect Wallet" button
   - Browser should open to localhost:48274/wallet-auth
   - Phantom should detect and show "Connect Wallet" option
   - Approve connection and signature in Phantom
   - Browser page should show "✓ Authentication complete!"
   - Tauri app should show connected wallet address

## Benefits

✅ Works with browser extensions (Phantom, Backpack, etc.)
✅ No complex deep linking required
✅ Works across Windows, macOS, and Linux
✅ Fallback polling mechanism for reliability
✅ Clear user feedback in browser and app
✅ Secure localhost-only communication

## Files Changed

1. `client/src-tauri/Cargo.toml` - Added dependencies
2. `client/src-tauri/src/lib.rs` - Implemented local server
3. `client/public/wallet-auth.html` - Updated callback mechanism
4. `client/src/stores/auth.js` - Updated event handling and polling

## Security Notes

- Server only listens on localhost (127.0.0.1)
- CORS allows any origin (safe for localhost development)
- Auth results are cleared after retrieval
- Browser-to-app communication is localhost-only
- No sensitive data stored in browser beyond the auth session
