# Clippster Project Documentation

## Project Overview

**Clippster** is a sophisticated desktop application that serves as an automated long-form to short-form video clip generator and editor. Built as a Tauri + Phoenix monorepo, it provides wallet-authenticated content management with AI-powered video processing capabilities. Users can import long-form videos (YouTube, Twitch, Kick, etc.), automatically transcribe and analyze them using AI, then generate engaging short-form clips through an intuitive timeline-based editor with wallet-based authentication.

The application combines modern web technologies with native desktop performance to create a professional video editing experience that leverages AI for automated content detection, transcription, and intelligent clip suggestions.

## Architecture & Technology Stack

### Monorepo Structure
```
clippster/
├── client/               # Tauri + Vue frontend (1500x950 desktop app)
│   ├── src/             # Vue 3 + TypeScript application
│   ├── src-tauri/       # Rust backend for desktop functionality
│   └── package.json     # Frontend dependencies
├── server/              # Phoenix API server (localhost:4000)
│   ├── lib/             # Elixir application code
│   ├── config/          # Configuration files
│   └── priv/repo/       # PostgreSQL database migrations
└── package.json         # Root monorepo scripts
```

### Frontend Technology Stack
- **Tauri 2.x** - Lightweight desktop application framework
- **Vue 3 + TypeScript** - Modern UI framework with full type safety
- **Vite** - Fast build tool and development server
- **Tailwind CSS v4** - Utility-first styling framework
- **Pinia** - Vue state management
- **Radix Vue + Reka UI** - Headless component libraries
- **Solana Web3.js** - Wallet integration

### Backend Technology Stack
- **Phoenix 1.8** - High-performance web framework
- **Ecto 3.13** - Database ORM and query language
- **PostgreSQL** - Primary database
- **JWT (Joken)** - Authentication tokens with 7-day expiration
- **ED25519** - Solana wallet signature verification
- **Node.js integration** - Cross-platform Solana signature verification

### Desktop Integration
- **SQLite** - Local storage via Tauri SQL plugin
- **FFmpeg** - Media processing (bundled as external binary)
- **Custom window controls** - Frameless window with titlebar

## Core Features

### 1. Video Import & Processing
- **Multi-Platform Support**: Import from YouTube, Twitch, Kick, and local files
- **AI-Powered Analysis**: Automatic transcription using Whisper API
- **Content Detection**: Intelligent segment identification for engaging moments
- **Real-time Progress**: WebSocket updates during processing
- **Chunked Processing**: Efficient handling of long-form videos

### 2. Advanced Timeline Editor
- **Professional Timeline Component** (`Timeline.vue`): 2,300+ lines of sophisticated video editing functionality
- **Multi-track Timeline**: Video tracks with multiple clip segments
- **Interactive Features**:
  - Drag-and-drop clip repositioning with real-time constraints
  - Resize handles for precise clip boundary adjustments
  - Cut tool for splitting segments at any point with transcript preview
  - Multi-segment selection (Ctrl/Cmd) and batch operations
  - Real-time transcript synchronization with hover tooltips
  - Smooth zoom controls (up to 10x) with pan functionality
  - Professional keyboard shortcuts (arrows for seeking, J for merge, X for cut, Backspace for delete)
  - Visual feedback for clip collisions and constraints

### 3. Wallet Authentication System
- **Challenge-Response Flow**: Server generates cryptographic challenge → Client signs with Solana wallet → Server verifies ED25519 signature → JWT token issued
- **Security**: Prevents replay attacks with nonce-based challenges
- **Cross-Platform Verification**: Node.js script ensures consistent Solana signature verification across Windows/Mac/Linux
- **Admin System**: First registered user automatically becomes admin
- **7-Day JWT Tokens**: Automatic refresh with secure token management

### 4. Content Management
- **Projects**: Organize multiple video sources and AI processing jobs
- **Clips**: Individual video segments with rich metadata and timestamps
- **Prompts**: AI system prompts for customizable content generation
- **Assets**: Local media file management with SQLite storage
- **Credit System**: Usage-based AI processing credits with payment integration

### 5. AI Integration
- **Whisper API**: High-accuracy video transcription and processing
- **OpenRouter API**: AI-powered content analysis and clip suggestions
- **System Prompts**: Configurable AI behaviors for different content types
- **Progress Tracking**: Real-time processing status via Phoenix channels
- **Smart Detection**: Automated identification of engaging moments and optimal clip boundaries

## Database Schema

### Users Table
```sql
users:
- wallet_address (string, unique) - Solana wallet address
- is_admin (boolean) - Admin privileges
- created_at/updated_at - UTC timestamps
```

### Additional Tables
- **user_credits**: User credit balances and consumption tracking
- **credit_transactions**: Credit usage history with payment records
- **processing_jobs**: AI processing job status and progress tracking
- **bug_reports**: User feedback and bug tracking with admin management

## API Endpoints

### Authentication (Public)
- `POST /api/auth/challenge` - Get cryptographic challenge
- `POST /api/auth/verify` - Verify wallet signature and get JWT

### Protected Routes (JWT Required)
- `POST /api/clips/detect` - Video content detection and analysis
- `POST /api/clips/detect-chunked` - Chunked video processing for long-form content
- `POST /api/bug-reports` - Submit bug reports

### Payment & Credits
- `GET /api/pricing` - Get pricing information
- `GET /api/credits/balance` - Get user credit balance
- `POST /api/payments/quote` - Get payment quote
- `POST /api/payments/confirm` - Confirm payment

### Admin Only
- `GET /api/admin/users` - List all users
- `POST /api/admin/users/:user_id/promote` - Promote user to admin
- `PUT /api/admin/users/:user_id/credits` - Update user credits
- `GET /api/admin/bug-reports` - Manage user bug reports

## Development Environment

### URLs & Ports
- **Frontend Dev**: `http://localhost:1420`
- **Backend API**: `http://localhost:4000`
- **Tauri Dev**: Uses Vite dev server
- **Database**: PostgreSQL on localhost:5432

### Development Commands
```bash
# Start full stack (recommended)
yarn dev              # Both Phoenix server + Tauri desktop app
yarn dev:tauri        # Alternative full stack command

# Individual services
yarn server           # Phoenix API only
yarn client           # Vue dev server only
yarn tauri           # Tauri desktop app only

# Setup and database
yarn setup            # Install dependencies and setup database
cd server && mix ecto.create
cd server && mix ecto.migrate
cd server && mix test

# Code quality
yarn format           # Format frontend code
yarn format:check      # Check formatting without changes
cd server && mix precommit  # Compile, format, and test backend
```

## Security Considerations

### Authentication Security
- **Cryptographic Challenges**: Prevents replay attacks with unique nonces
- **ED25519 Verification**: Secure Solana wallet signature validation
- **JWT Expiration**: 7-day token expiration with automatic refresh
- **CORS Configuration**: Properly configured for Tauri and development origins
- **Cross-Platform Node.js Verification**: Ensures consistent signature verification across operating systems

### Desktop Security
- **CSP Configuration**: Content Security Policy for secure resource loading
- **Asset Protocol Scope**: Local file access restricted to app data directory
- **FFmpeg Integration**: Secure binary execution with proper validation
- **Tauri Capabilities**: Fine-grained permission system for system access

## Advanced Features

### Timeline Component Deep Dive
The `Timeline.vue` component represents a professional video editing interface with:

**Advanced Drag Operations:**
- Real-time constraint calculation to prevent clip overlap
- Visual collision detection with red highlighting
- Smooth animations and snap-to-boundary behavior
- Multi-segment selection with Ctrl/Cmd modifiers

**Transcript Integration:**
- Real-time transcript display in hover tooltips
- Segment-based transcript alignment
- Intelligent word centering for optimal readability
- Smooth transcript updates during clip manipulation

**Performance Optimizations:**
- Debounced database updates during drag operations
- Efficient memory management with proper cleanup
- ResizeObserver integration for responsive behavior
- Virtual scrolling capabilities for large timelines

**Keyboard Shortcuts:**
- Arrow keys: Frame-by-frame seeking (0.25s increments)
- X: Toggle cut tool with visual preview
- J: Merge selected segments (with validation)
- Backspace: Delete selected segments (with confirmation)
- Ctrl/Cmd + Click: Multi-segment selection
- Space: Play/pause video playback

### Tauri Integration Highlights
- **Custom Titlebar**: Platform-aware window controls with macOS/Linux support
- **File System Access**: Local database and media file management with sandboxing
- **Process Communication**: Rust-Vue interop for desktop features
- **Window Management**: Smooth show/hide transitions after initialization
- **Plugin Architecture**: Modular SQL, dialog, and opener plugins

### WebSocket Architecture
- **Real-time Updates**: Processing progress via Phoenix channels
- **Connection Management**: Automatic reconnection and error handling
- **Scalable Architecture**: PubSub-based message broadcasting
- **Progress Tracking**: Granular processing status updates
- **Error Handling**: Graceful degradation with user feedback

## Production Deployment

### Build Configuration
- **Frontend**: Vite production build with TypeScript compilation and tree-shaking
- **Desktop**: Tauri bundler for cross-platform distribution
- **Backend**: Mix release with PostgreSQL database optimizations
- **Asset Management**: Automated FFmpeg binary bundling

### Platform Support
- **Desktop**: Windows, macOS, Linux via Tauri
- **Database**: PostgreSQL production configuration with connection pooling
- **Assets**: FFmpeg binaries bundled for cross-platform video processing
- **Distribution**: Auto-updates and code signing for security

### Performance Optimizations
- **Database Connection Pooling**: Efficient PostgreSQL connection management
- **Media Processing**: Optimized FFmpeg settings for different video formats
- **Memory Management**: Proper cleanup of video elements and event listeners
- **Network Optimization**: Chunked uploads and intelligent caching

## Video Processing Pipeline

### Import & Analysis
1. **URL Import**: Support for YouTube, Twitch, Kick, and local files
2. **Download & Preprocessing**: FFmpeg-based format normalization
3. **Chunked Processing**: Divide long videos into manageable chunks
4. **AI Transcription**: Whisper API for accurate speech-to-text
5. **Content Analysis**: OpenRouter API for engaging moment detection
6. **Clip Suggestions**: AI-powered optimal segment identification

### Timeline Editing
1. **Visual Timeline**: Multi-track representation with waveforms
2. **Transcript Sync**: Real-time transcript alignment with video
3. **Smart Cutting**: Intelligent split points based on content boundaries
4. **Preview System**: Real-time preview of edited clips
5. **Export**: Multiple format support for social media platforms

This project represents a production-ready, professional video editing application that combines modern web technologies with native desktop performance, secure blockchain authentication, and sophisticated AI-powered video processing features specifically designed for long-form to short-form content creation.