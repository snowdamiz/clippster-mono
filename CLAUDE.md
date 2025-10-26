# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clippster** is a desktop application built as a Tauri + Phoenix monorepo that provides wallet-authenticated content management and AI tool platform. Users can manage AI-generated content including clips, projects, and prompts using Solana wallet-based authentication.

## Development Commands

### Full Stack Development
```bash
# Start both server and Tauri desktop app (recommended)
yarn dev
yarn dev:tauri

# Setup entire project from scratch
yarn setup
```

### Individual Services
```bash
# Start Phoenix API server only (runs on localhost:4000)
yarn server

# Start Vue development server only (runs on localhost:1420)
yarn client

# Start Tauri desktop app only
yarn tauri
```

### Setup and Dependencies
```bash
# Install all dependencies (client + server)
yarn install:all

# Build Vue frontend
yarn build
```

### Backend (Elixir/Phoenix)
```bash
cd server

# Setup database and dependencies
mix setup

# Database operations
mix ecto.create
mix ecto.migrate
mix ecto.reset

# Run tests
mix test

# Pre-commit checks (compile, format, test)
mix precommit
```

### Frontend (Vue/Tauri)
```bash
cd client

# Development server
yarn dev

# Build for production
yarn build

# Tauri development
yarn tauri dev
```

## Architecture

### Monorepo Structure
```
clippster/
├── client/               # Tauri + Vue frontend
│   ├── src/             # Vue application source
│   ├── src-tauri/       # Rust Tauri backend
│   └── package.json     # Frontend dependencies
├── server/              # Phoenix API server
│   ├── lib/             # Elixir application code
│   ├── config/          # Configuration files
│   └── priv/repo/       # Database migrations
└── package.json         # Root monorepo scripts
```

### Technology Stack

**Frontend:**
- Tauri 2.x - Desktop application framework
- Vue 3 + TypeScript - UI framework
- Vite - Build tool and dev server
- Tailwind CSS v4 - Styling
- Pinia - State management
- Radix Vue + Reka UI - Headless components

**Backend:**
- Phoenix 1.8 - Web framework
- Ecto 3.13 - Database ORM
- PostgreSQL - Primary database
- JWT (Joken) - Authentication tokens
- ED25519 - Solana wallet signature verification

**Desktop:**
- SQLite - Local storage via Tauri SQL plugin
- FFmpeg - Media processing

## Key Systems

### Wallet Authentication
- **Flow**: Challenge-response using Solana wallet signatures
- **Process**: Server generates challenge → Client signs with wallet → Server verifies signature → JWT token issued
- **Token**: 7-day expiration JWT
- **Admin**: First registered user becomes admin automatically

### Database Schema
```sql
users:
- wallet_address (string, unique) - Solana wallet
- is_admin (boolean) - Admin privileges
- created_at/updated_at - Timestamps
```

### API Endpoints
- `POST /api/auth/challenge` - Get authentication challenge
- `POST /api/auth/verify` - Verify wallet signature
- `GET /api/auth/me` - Get current user info

### Frontend State Management
- **Auth Store**: Handles authentication flow and user state
- **Router Guards**: Protect routes requiring authentication
- **Local Storage**: Persistent auth tokens

## Development Environment

### URLs
- Frontend: `http://localhost:1420`
- Backend API: `http://localhost:4000`
- Phoenix Live Dashboard: Available in dev mode

### Database
- Development: PostgreSQL on localhost:5432
- Credentials: postgres/postgres
- Database: clippster_server_dev

### Configuration
- Server config: `server/config/dev.exs`
- JWT secret: Configure via `JWT_SECRET` env var
- Domain: Set to "localhost" for development

## Security Notes
- Challenge-response prevents replay attacks
- ED25519 signature verification for Solana wallets
- CORS configured for Tauri and development servers
- JWT tokens with expiration

## Testing
```bash
# Backend tests
cd server && mix test

# Frontend type checking
cd client && vue-tsc --noEmit
```

## Common Patterns

### Adding New API Endpoints
1. Define route in `server/lib/clippster_server_web/router.ex`
2. Create controller in `server/lib/clippster_server_web/controllers/`
3. Add context functions in `server/lib/clippster_server/`

### Adding New Frontend Pages
1. Create page component in `client/src/pages/`
2. Add route in `client/src/router/index.ts`
3. Add authentication guard if needed

### State Management
- Use Pinia stores for shared state
- Auth store handles user session
- Local storage for persistence