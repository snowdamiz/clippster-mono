# Wallet Authentication Setup Guide

## Overview

This guide documents the Phantom wallet authentication implementation for Clippster. The system uses a secure challenge-response mechanism with Ed25519 signature verification.

## What Was Implemented

### Backend (Phoenix/Elixir)

1. **Dependencies Added** (`server/mix.exs`)
   - `joken` - JWT token generation and verification
   - `ed25519` - Signature verification
   - `base58` - Solana address encoding/decoding
   - `cors_plug` - CORS support for Tauri

2. **Challenge Store** (`server/lib/clippster_server/auth/challenge_store.ex`)
   - GenServer-based challenge management
   - 5-minute TTL for challenges
   - Automatic cleanup of expired challenges
   - ETS-based storage for performance

3. **Auth Controller** (`server/lib/clippster_server_web/controllers/auth_controller.ex`)
   - `POST /api/auth/challenge` - Generate authentication challenge
   - `POST /api/auth/verify` - Verify wallet signature and issue JWT

4. **Token Generator** (`server/lib/clippster_server/auth/token_generator.ex`)
   - JWT token generation with 7-day expiry
   - Token verification for protected routes

5. **Router Updates** (`server/lib/clippster_server_web/router.ex`)
   - Added auth endpoints
   - Configured CORS for Tauri and localhost

### Frontend (Vue/Tauri)

1. **Tauri Configuration** (`client/src-tauri/tauri.conf.json`)
   - Updated window size and CSP policy
   - Enabled global Tauri access

2. **Rust Commands** (`client/src-tauri/src/lib.rs`)
   - `open_wallet_auth_window` - Opens wallet connection window
   - `close_auth_window` - Closes auth window after completion

3. **Pinia Auth Store** (`client/src/stores/auth.js`)
   - State management for authentication
   - Wallet connection flow
   - Token and wallet address persistence

4. **Wallet Bridge Page** (`client/public/wallet-auth.html`)
   - Standalone HTML page for Phantom wallet interaction
   - Challenge retrieval and signature generation
   - Event-based communication with main window

5. **WalletAuth Component** (`client/src/components/WalletAuth.vue`)
   - User interface for wallet connection
   - Shows connection status and wallet address
   - Disconnect functionality

6. **API Service** (`client/src/services/api.js`)
   - Axios interceptors for automatic token injection
   - 401 error handling and auto-logout

## Setup Instructions

### 1. Install Backend Dependencies

```powershell
cd server
mix deps.get
```

### 2. Install Frontend Dependencies

```powershell
cd client
yarn install
```

### 3. Environment Configuration

Create or update `server/config/dev.exs`:

```elixir
config :clippster_server,
  domain: "localhost",
  jwt_secret: "your-secure-secret-key-here"  # Generate with: mix phx.gen.secret
```

For production, set these as environment variables:
```bash
export JWT_SECRET="your-production-secret"
export APP_DOMAIN="yourdomain.com"
```

### 4. Database Setup (if needed)

```powershell
cd server
mix ecto.create
mix ecto.migrate
```

### 5. Start the Development Environment

From the root directory:

```powershell
yarn dev:tauri
```

This will start both the Phoenix server and the Tauri app.

## Usage

### Using the WalletAuth Component

In any Vue component:

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

### Programmatic Authentication

```javascript
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()

// Connect wallet
const result = await authStore.authenticateWithWallet()
if (result.success) {
  console.log('Authenticated!', authStore.walletAddress)
}

// Check if authenticated
await authStore.checkAuth()

// Logout
authStore.logout()
```

### Making Authenticated API Calls

```javascript
import api from './services/api'

// Token is automatically added to headers
const response = await api.get('/user/profile')
```

## Security Considerations

### Production Checklist

- [ ] Set secure `JWT_SECRET` environment variable (use `mix phx.gen.secret`)
- [ ] Configure production domain in environment
- [ ] Enable HTTPS/TLS
- [ ] Update CORS origins to production URLs
- [ ] Consider adding rate limiting (Hammer.Plug)
- [ ] Implement token refresh mechanism
- [ ] Add proper logging and monitoring
- [ ] Review CSP policy for production

### Current Security Features

1. **Challenge-Response Authentication**
   - Unique nonce for each authentication attempt
   - 5-minute challenge expiry
   - One-time use challenges

2. **Ed25519 Signature Verification**
   - Cryptographic proof of wallet ownership
   - Message includes domain, nonce, and timestamp

3. **JWT Token Security**
   - HS256 signing algorithm
   - 7-day expiration
   - Automatic token injection and validation

4. **CORS Protection**
   - Restricted origins (Tauri and localhost)
   - Prevents unauthorized cross-origin requests

## Testing

### Manual Testing Flow

1. Install Phantom wallet browser extension
2. Start the dev environment
3. Click "Connect Phantom Wallet" in the app
4. Approve the connection in Phantom
5. Sign the authentication message
6. Verify successful authentication and token storage

### Backend Testing

Test challenge generation:
```bash
curl -X POST http://localhost:4000/api/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"client_id": "test-client-123"}'
```

## Troubleshooting

### Common Issues

**1. Phantom not detected**
- Ensure Phantom wallet extension is installed
- Check that the wallet bridge page is served correctly
- Verify CSP allows extension injection

**2. Signature verification fails**
- Check message format matches exactly (including newlines)
- Verify base58 encoding/decoding is correct
- Ensure proper byte array handling in Elixir

**3. CORS errors**
- Verify `tauri://localhost` is in allowed origins
- Check that CORS headers are properly set
- Ensure preflight requests are handled

**4. Challenge expiration**
- Adjust TTL in ChallengeStore if needed
- Check system clock synchronization
- Verify challenge cleanup is working

**5. Token not persisting**
- Check localStorage is available
- Verify token is being saved in auth store
- Check browser console for errors

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Tauri App     │────▶│   Webview        │────▶│  Phantom Wallet │
│   (Vue Native)  │◀────│  (Bridge Page)   │◀────│   (Extension)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                                                 
         │ JWT Token                                      
         ▼                                                
┌─────────────────┐                                      
│ Phoenix Server  │                                      
│   (Elixir)      │                                      
└─────────────────┘                                      
```

## Authentication Flow

1. User clicks "Connect Wallet"
2. Tauri opens wallet-auth.html in new window
3. Bridge page detects Phantom and requests challenge from server
4. Server generates nonce and returns challenge
5. Bridge constructs message and requests signature from Phantom
6. User approves signature in Phantom extension
7. Bridge sends signature + message to server for verification
8. Server verifies signature and issues JWT token
9. Token stored in localStorage and Pinia store
10. Auth window closes, user is authenticated

## Next Steps

### Optional Enhancements

1. **Token Refresh**
   - Implement refresh token mechanism
   - Add silent token renewal before expiry

2. **Protected Routes**
   - Create authentication middleware/guard
   - Add route protection in Vue Router

3. **User Profile**
   - Store additional user data
   - Link wallet to user account

4. **Multiple Wallets**
   - Support for other Solana wallets
   - Wallet adapter integration

5. **Analytics**
   - Track authentication events
   - Monitor wallet connection success rates

## Resources

- [Phantom Wallet Documentation](https://docs.phantom.app/)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Tauri API](https://tauri.app/v1/api/)
- [Phoenix Authentication](https://hexdocs.pm/phoenix/authentication.html)
- [Joken Documentation](https://hexdocs.pm/joken/)
