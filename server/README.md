# Clippster Server

A Phoenix API server that provides wallet-authenticated content management and AI tool platform backend services. This is the server component for the Clippster desktop application.

## Overview

**Clippster Server** is a Phoenix 1.8 API backend that handles user authentication via Solana wallet signatures, content management, AI service integration, and credit system management. It serves as the backend for the Clippster desktop application.

## Technology Stack

- **Phoenix 1.8** - Modern web framework for Elixir
- **Ecto 3.13** - Database ORM and query layer
- **PostgreSQL** - Primary database for user data and application state
- **Bandit 1.5** - High-performance HTTP server
- **JWT (Joken)** - Token-based authentication
- **ED25519** - Cryptographic signature verification for Solana wallets

### Key Dependencies

- **joken** - JWT token generation and validation
- **ed25519** - Solana wallet signature verification
- **base58** - Solana address encoding/decoding
- **cachex** - In-memory caching for challenges and sessions
- **cors_plug** - Cross-origin resource sharing
- **httpoison/finch** - HTTP clients for external API calls
- **swoosh** - Email sending capabilities
- **dotenvy** - Environment variable management

## Development

### Prerequisites

- Elixir 1.15+
- Erlang/OTP 25+
- PostgreSQL 12+
- Node.js (for assets, if needed)

### Getting Started

```bash
# Install dependencies and setup database
mix setup

# Start Phoenix endpoint (http://localhost:4000)
mix phx.server

# Or start with interactive shell
iex -S mix phx.server
```

### Available Commands

```bash
# Database operations
mix ecto.create          # Create database
mix ecto.migrate         # Run migrations
mix ecto.reset          # Drop and recreate database

# Development
mix phx.server          # Start development server
mix test                # Run tests
mix precommit           # Run pre-commit checks (compile, format, test)

# Code Quality
mix format              # Format code
mix deps.clean --unused # Clean unused dependencies
```

## Configuration

### Database

- **Development**: PostgreSQL on localhost:5432
- **Credentials**: postgres/postgres
- **Database**: clippster_server_dev

### Environment Variables

Required environment variables:

- `JWT_SECRET` - Secret key for JWT token signing (development fallback provided)
- `DOMAIN` - Application domain (defaults to "localhost" in development)

Optional environment variables:

- `PAYMENT_ADDRESS` - Solana wallet address for receiving payments
- `ALCHEMY_API_KEY` - API key for Alchemy price service
- `SOLANA_RPC_URL` - Solana RPC endpoint URL (defaults to public mainnet)

**Note**: The public Solana RPC endpoint has rate limits. For production, use dedicated providers like:
- Helius (https://helius.dev)
- Alchemy (https://alchemy.com)
- QuickNode (https://quicknode.com)

## Project Structure

```
server/
├── lib/
│   ├── clippster_server/           # Main application modules
│   │   ├── accounts/              # User account management
│   │   ├── auth/                  # Authentication utilities
│   │   ├── ai/                    # AI service integrations
│   │   ├── credits/               # Credit system
│   │   └── web/                   # Web interface layer
│   │       ├── controllers/       # API controllers
│   │       ├── plugs/            # Authentication and authorization plugs
│   │       └── router.ex         # API routing configuration
├── priv/
│   └── repo/
│       └── migrations/            # Database schema migrations
├── config/                       # Configuration files
└── test/                         # Test files
```

## API Endpoints

### Authentication
- `POST /api/auth/challenge` - Generate authentication challenge
- `POST /api/auth/verify` - Verify wallet signature and issue JWT
- `GET /api/auth/me` - Get current user information

### Credits & Payments
- `GET /api/credits/balance` - Get user credit balance
- `POST /api/payment/solana` - Process Solana payments

### Clips & Content
- `GET /api/clips` - List user clips
- `POST /api/clips` - Create new clip
- `PUT /api/clips/:id` - Update clip
- `DELETE /api/clips/:id` - Delete clip

### Administration
- `GET /api/admin/users` - List all users (admin only)
- `POST /api/bug-reports` - Submit bug reports

## Core Systems

### Wallet Authentication
- **Challenge-Response**: Server generates nonce challenge → Client signs with Solana wallet → Server verifies ED25519 signature
- **JWT Tokens**: 7-day expiration tokens for authenticated sessions
- **Security**: Prevents replay attacks with time-bound challenges

### Credit System
- **User Credits**: Track usage credits for AI services
- **Transactions**: Record credit purchases and consumption
- **Processing Jobs**: Track async operations that consume credits

### AI Integration
- **OpenRouter API**: AI model integration for content generation
- **Whisper API**: Audio transcription services
- **System Prompts**: Configurable AI behavior and responses

### Content Validation
- **Clip Validation**: Comprehensive validation for generated content
- **Asset Processing**: Handle file uploads and media processing

## Security Features

- **CORS Configuration**: Configured for Tauri and development origins
- **Request Size Limits**: Bandit configured for large file uploads
- **Authentication Guards**: Protected routes require valid JWT tokens
- **Authorization**: Role-based access control for admin functions
- **Input Validation**: Comprehensive parameter validation

## Development Features

- **Live Dashboard**: Phoenix Live Dashboard for monitoring
- **Hot Reloading**: Automatic code reloading in development
- **Debug Mode**: Enhanced error reporting and debugging
- **WebSocket Support**: Real-time communication capabilities

## Testing

```bash
# Run all tests
mix test

# Run specific test files
mix test test/clippster_server/accounts_test.exs

# Run with coverage
mix test --cover
```

## Production Deployment

- Use environment variables for all sensitive configuration
- Ensure proper JWT secret is set
- Configure production database connection
- Set up proper logging and monitoring
- Use reverse proxy (nginx/caddy) for SSL termination

## Related Repositories

- **Frontend**: Tauri + Vue desktop client (located in `../client/`)
- **Monorepo**: Root project configuration and scripts

## Learn More

- **Phoenix Framework**: https://www.phoenixframework.org/
- **Phoenix Docs**: https://hexdocs.pm/phoenix
- **Ecto Docs**: https://hexdocs.pm/ecto
- **Elixir Forum**: https://elixirforum.com/c/phoenix-forum
