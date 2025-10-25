# Wallet Authentication - Quick Start

## Installation & Setup

### 1. Install Dependencies

```powershell
# Backend
cd server
mix deps.get

# Frontend
cd ../client
yarn install
```

### 2. Start Development Server

From the root directory:

```powershell
yarn dev:tauri
```

This starts both Phoenix server (port 4000) and Tauri app.

## Usage in Your App

### Add the Component to Your Vue App

In `client/src/App.vue` or any component:

```vue
<template>
  <div>
    <WalletAuth />
  </div>
</template>

<script setup>
import WalletAuth from './components/WalletAuth.vue'
</script>
```

### Use the Auth Store Programmatically

```javascript
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()

// Connect wallet
await authStore.authenticateWithWallet()

// Check authentication status
console.log(authStore.isAuthenticated)
console.log(authStore.walletAddress)

// Logout
authStore.logout()
```

### Make Authenticated API Requests

```javascript
import api from './services/api'

// Token automatically included
const response = await api.get('/user/profile')
```

## Files Created

### Backend
- `server/lib/clippster_server/auth/challenge_store.ex`
- `server/lib/clippster_server/auth/token_generator.ex`
- `server/lib/clippster_server_web/controllers/auth_controller.ex`

### Frontend
- `client/src/stores/auth.js`
- `client/src/services/api.js`
- `client/src/components/WalletAuth.vue`
- `client/public/wallet-auth.html`

### Configuration
- Updated `server/mix.exs` (added dependencies)
- Updated `server/config/dev.exs` (added auth config)
- Updated `server/lib/clippster_server_web/router.ex` (added routes)
- Updated `client/src-tauri/src/lib.rs` (added commands)
- Updated `client/src-tauri/tauri.conf.json` (updated settings)
- Updated `client/src/main.ts` (added Pinia)
- Updated `client/package.json` (added dependencies)

## API Endpoints

- `POST /api/auth/challenge` - Get authentication challenge
- `POST /api/auth/verify` - Verify signature and get JWT token

## Testing

1. Ensure Phantom wallet extension is installed in your browser
2. Run `yarn dev:tauri` from project root
3. Click "Connect Phantom Wallet" in the UI
4. Approve connection and signature in Phantom
5. Verify wallet address is displayed

## Security Notes

- JWT secret is set to a dev default - change for production!
- Generate production secret: `mix phx.gen.secret`
- Set via environment variable: `JWT_SECRET=your_secret`
- Current token expiry: 7 days
- Challenge TTL: 5 minutes

## Need More Details?

See `WALLET_AUTH_SETUP.md` for comprehensive documentation.
