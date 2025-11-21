# Clippster

A modern desktop application built as a Tauri + Phoenix monorepo that provides wallet-authenticated content management and AI tool platform. Users can manage AI-generated content including clips, projects, and prompts using Solana wallet-based authentication.

## Overview

**Clippster** is a comprehensive content creation platform that combines the power of desktop application performance with modern web technologies. It features AI-powered content generation, wallet-based authentication, and a rich user interface for managing creative projects.

## Architecture

This monorepo contains three main applications:

- **`client/`** - Tauri + Vue 3 desktop application (frontend)
- **`server/`** - Phoenix API backend (Elixir/Erlang)
- **`landing/`** - Vue 3 marketing landing page

### Technology Stack

**Frontend (Client):**
- Tauri 2.x - Desktop application framework
- Vue 3 + TypeScript - Modern UI framework
- Vite - Fast build tool and dev server
- Tailwind CSS v4 - Utility-first styling
- Pinia - State management
- Radix Vue + Reka UI - Headless components
- Solana Web3.js - Wallet authentication

**Backend (Server):**
- Phoenix 1.8 - Modern web framework
- Ecto 3.13 - Database ORM
- PostgreSQL - Primary database
- Bandit 1.5 - High-performance HTTP server
- JWT (Joken) - Token-based authentication
- ED25519 - Solana wallet signature verification

**Landing Page:**
- Vue 3 + TypeScript
- Vite + Tailwind CSS v4
- Radix Vue components

## Quick Start

### Prerequisites

- Node.js (v18+)
- Yarn package manager
- Elixir 1.15+ and Erlang/OTP 25+
- PostgreSQL 12+
- Rust and Cargo (for Tauri development)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd clippster

# Install all dependencies (client + server + landing)
yarn install:all

# Or install dependencies individually
cd client && yarn install
cd ../server && mix deps.get
cd ../landing && yarn install
```

### Development

```bash
# Start both server and Tauri desktop app (recommended)
yarn dev

# Start individual services
yarn server      # Phoenix API server only (localhost:4000)
yarn client      # Vue development server only (localhost:1420)
yarn tauri       # Tauri desktop app only
yarn landing     # Landing page development server
```

### Build Commands

```bash
# Build Vue frontend
yarn build

# Build Tauri desktop application
cd client && yarn tauri build

# Build landing page
cd landing && yarn build
```

## Project Structure

```
clippster/
├── client/                    # Tauri + Vue desktop application
│   ├── src/                  # Vue application source
│   ├── src-tauri/            # Rust Tauri backend
│   ├── package.json          # Frontend dependencies
│   └── README.md             # Client-specific documentation
├── server/                    # Phoenix API server
│   ├── lib/                  # Elixir application code
│   ├── config/               # Configuration files
│   ├── priv/repo/            # Database migrations
│   └── README.md             # Server-specific documentation
├── landing/                   # Vue marketing landing page
│   ├── src/                  # Landing page source
│   ├── package.json          # Landing page dependencies
│   └── README.md             # Landing page documentation
├── scripts/                   # Build and setup scripts
│   └── setup-binaries.js     # FFmpeg and binary setup
├── .husky/                    # Git hooks
├── .gitignore                 # Git ignore rules
├── package.json               # Root monorepo scripts
└── README.md                  # This file
```

## Available Scripts

### Root Level Scripts

```bash
# Development
yarn dev              # Start server + Tauri app concurrently
yarn server           # Start Phoenix API server
yarn client           # Start Vue development server
yarn tauri            # Start Tauri desktop app
yarn landing          # Start landing page dev server

# Setup
yarn setup:binaries   # Download FFmpeg and required binaries
yarn install:all      # Install all project dependencies

# Code Quality
yarn format           # Format client code
yarn format:check     # Check code formatting
yarn type-check       # Type check Vue application
```

### Environment Configuration

#### Development URLs
- **Frontend**: http://localhost:1420
- **Backend API**: http://localhost:4000
- **Landing Page**: http://localhost:5173 (development)

#### Database
- **Development**: PostgreSQL on localhost:5432
- **Credentials**: postgres/postgres
- **Database**: clippster_server_dev

#### Environment Variables

Required for server:
- `JWT_SECRET` - JWT token signing secret
- `DOMAIN` - Application domain (defaults to "localhost")

Optional:
- `PAYMENT_ADDRESS` - Solana wallet for payments
- `ALCHEMY_API_KEY` - Alchemy price service API key
- `SOLANA_RPC_URL` - Custom Solana RPC endpoint

## Key Features

### Wallet Authentication
- **Solana Integration**: ED25519 signature verification
- **Challenge-Response**: Prevents replay attacks
- **JWT Tokens**: 7-day expiration for authenticated sessions
- **Auto-Admin**: First registered user becomes admin

### Content Management
- **AI-Powered Clips**: Automated content generation
- **Project Organization**: Hierarchical content management
- **Version Control**: Track content changes and history
- **Asset Management**: File upload and media processing

### Desktop Integration
- **Native Performance**: Tauri's lightweight runtime
- **File System Access**: Native file operations
- **Custom Windowing**: Transparent, frameless design
- **Media Processing**: FFmpeg integration for video/audio

### Real-time Features
- **Live Updates**: Phoenix channels for real-time sync
- **Progress Tracking**: Async operation monitoring
- **Credit System**: Usage-based billing integration

## Development Workflow

### Setting Up Development Environment

1. **Install Prerequisites**
   ```bash
   # Install Elixir/Erlang
   # Install PostgreSQL and create database
   # Install Node.js and Yarn
   # Install Rust (for Tauri)
   ```

2. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd clippster
   yarn install:all
   ```

3. **Database Setup**
   ```bash
   cd server
   mix ecto.create
   mix ecto.migrate
   ```

4. **Start Development**
   ```bash
   # Root level - starts both server and client
   yarn dev
   ```

### Code Quality Tools

- **Pre-commit Hooks**: Husky + lint-staged for automatic formatting
- **Prettier**: Code formatting for Vue/TypeScript files
- **TypeScript**: Static type checking
- **Mix Format**: Elixir code formatting

### Testing

```bash
# Backend tests
cd server && mix test

# Frontend type checking
cd client && vue-tsc --noEmit

# Frontend format checking
cd client && yarn format:check
```

## Security

- **CORS Configuration**: Properly configured for Tauri and development
- **Input Validation**: Comprehensive parameter validation
- **Authentication Guards**: JWT-based route protection
- **Rate Limiting**: Challenge-based authentication prevents abuse
- **Asset Scoping**: Secure file system access via Tauri

## Build and Deployment

### Development Build
```bash
# Development (hot reload)
yarn dev

# Production build
cd client && yarn tauri build
```

### Production Considerations
- Use environment variables for all secrets
- Configure production database connection
- Set up proper JWT secrets
- Use reverse proxy for SSL termination
- Configure proper logging and monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and code quality checks
5. Submit a pull request

### Code Standards
- Follow Prettier configuration for frontend code
- Use Mix Format for Elixir code
- Write tests for new features
- Update documentation as needed

## Support

- **Client Documentation**: See `client/README.md`
- **Server Documentation**: See `server/README.md`
- **Landing Page**: See `landing/README.md`
- **Issues**: Report bugs and feature requests via GitHub issues

## License

[Add your license information here]

## Related Technologies

- [Tauri Documentation](https://tauri.app/)
- [Phoenix Framework](https://www.phoenixframework.org/)
- [Vue 3 Documentation](https://vuejs.org/)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Tailwind CSS](https://tailwindcss.com/)