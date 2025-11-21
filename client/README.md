# Clippster Client

A modern desktop application built with Tauri + Vue 3 + TypeScript that provides wallet-authenticated content management and AI tool platform. This is the frontend client for the Clippster platform.

## Overview

**Clippster** is a desktop application that allows users to manage AI-generated content including clips, projects, and prompts using Solana wallet-based authentication. The client provides a rich UI for content creation, editing, and management.

## Technology Stack

- **Tauri 2.x** - Desktop application framework with Rust backend
- **Vue 3** - Progressive JavaScript framework with Composition API
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and development server
- **Tailwind CSS v4** - Utility-first CSS framework
- **Pinia** - State management
- **Vue Router 4** - Client-side routing
- **Radix Vue + Reka UI** - Headless UI components

### Key Dependencies

- **@solana/web3.js** - Solana blockchain integration for wallet authentication
- **@tauri-apps/api** - Tauri APIs for desktop functionality
- **axios** - HTTP client for API communication
- **phoenix** - Real-time communication with Phoenix backend
- **md-editor-v3** - Markdown editing capabilities
- **lucide-vue-next** - Icon library

## Development

### Prerequisites

- Node.js (v18+)
- Yarn package manager
- Rust and Cargo (for Tauri development)

### Getting Started

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Start Tauri desktop app in development mode
yarn tauri dev
```

### Available Scripts

```bash
# Development
yarn dev              # Start Vite development server (localhost:1420)
yarn tauri dev        # Start Tauri desktop app with hot reload

# Building
yarn build            # Build for production (runs type checking first)
yarn tauri build      # Build desktop application

# Code Quality
yarn format           # Format code with Prettier
yarn format:check     # Check code formatting
```

## Project Structure

```
client/
├── src/                    # Vue application source
│   ├── components/         # Reusable Vue components
│   ├── composables/        # Vue composition functions
│   ├── config/            # Configuration files
│   ├── constants/         # Application constants
│   ├── layouts/           # Layout components
│   ├── lib/               # Utility libraries
│   ├── pages/             # Page components
│   ├── router/            # Vue Router configuration
│   ├── services/          # API and external services
│   ├── stores/            # Pinia state management
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── src-tauri/             # Rust Tauri backend
├── public/                # Static assets
└── dist/                  # Build output
```

## Configuration

- **Development URL**: http://localhost:1420
- **Backend API**: http://localhost:4000
- **Window Configuration**: 1400x850, transparent, custom title bar
- **Database**: SQLite via Tauri SQL plugin

## Key Features

### Wallet Authentication

- Solana wallet integration using ED25519 signature verification
- Challenge-response authentication flow
- JWT token management with 7-day expiration

### Content Management

- AI-powered clip generation and editing
- Project organization and management
- Markdown editing capabilities
- Asset upload and management

### Desktop Integration

- Native file system access
- Custom window decorations
- FFmpeg integration for media processing
- Local SQLite storage

## Development Environment

### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

### Environment Variables

Development configuration is handled through the Tauri configuration files and the Phoenix backend connection settings.

## Security

- Content Security Policy (CSP) configured for secure resource loading
- Wallet signature verification prevents unauthorized access
- Asset protocol scoping for secure file access
- CORS configuration for API communication

## Build and Distribution

The application builds to native desktop executables for Windows, macOS, and Linux through Tauri's bundling system. FFmpeg binaries and required resources are bundled with the application.

## Testing

```bash
# Type checking
vue-tsc --noEmit

# Code formatting
yarn format:check
```

## Related Repositories

- **Backend**: Phoenix API server (located in `../server/`)
- **Monorepo**: Root project configuration and scripts
