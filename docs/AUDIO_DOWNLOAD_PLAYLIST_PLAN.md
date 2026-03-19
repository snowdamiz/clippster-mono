# Download Audio, Audio Library & Playlist System Implementation Plan

Add "Download Audio" page, "Audio Library" page for downloading/managing MP3 files from YouTube and X Spaces, plus a global playlist system with persistent audio player controls visible throughout the entire app.

## Overview

**Three major features:**
1. **Download Audio** (`/download-audio`) - Clone of StreamVods.vue, downloads MP3 instead of video, navigates to Audio Library on download start
2. **Audio Library** (`/audio-library`) - Clone of Projects.vue, shows active audio downloads + downloaded audio files with playback and playlist management
3. **Global Playlist System** - Create playlists from downloaded audio, play them anywhere in the app with persistent controls (play/pause/next/back/volume)

## Key Behavior (Exact Match to VOD Flow)

**Download Flow:**
1. User pastes YouTube/X Spaces URL in Download Audio page
2. Clicks download → starts audio download
3. **Immediately navigates to `/audio-library`** (just like VODs → `/projects`)
4. Audio Library shows active download progress in real-time
5. When complete, audio file appears in library grid

**Batch Downloads:**
- Multi-select audio items → download all
- Queue system (1 concurrent download max)
- Navigate to Audio Library after first download starts

## Architecture

### Frontend Pages

**1. DownloadAudio.vue** (`client/src/pages/DownloadAudio.vue`)
- **Clone StreamVods.vue completely** - exact layout, styling, and structure
- Only support YouTube and X Spaces (Twitter) platforms
- Remove Kick, Twitch, PumpFun, Rumble detection
- Change download action to call audio download commands
- Navigate to `/audio-library` instead of `/projects` after download starts
- Same UI: search input, platform detection, VOD grid, download dialog
- **Use CustomDropdown component** for all dropdowns (matches app-wide styling)
- **All dialogs must use BugReportDialog.vue styling pattern**:
  - `.bug-dialog__overlay` with backdrop-filter blur
  - `.bug-dialog__accent` top accent bar
  - `.bug-dialog__header` with icon, title, subtitle
  - `.bug-dialog__content` for form/content area
  - `.bug-dialog__footer` for action buttons
  - `.bug-dialog__btn--primary` and `.bug-dialog__btn--secondary` button styles
  - Use `var(--sidebar-surface)`, `var(--sidebar-border)`, etc. CSS variables

**2. AudioLibrary.vue** (`client/src/pages/AudioLibrary.vue`)
- **Clone Projects.vue completely** - exact layout, styling, and structure
- Show active audio downloads section (like active VOD downloads)
- Show downloaded audio files grid (like projects grid)
- Use `useAudioDownloads` composable (clone of `useDownloads`)
- Same UI: search, filters, selection, delete, pagination
- Audio playback controls in cards (instead of video thumbnail)
- **Audio file upload functionality**:
  - "Upload Audio" button in header (like "New Project" in Projects.vue)
  - File picker for MP3, M4A, WAV, FLAC, OGG audio files
  - Upload progress indicator
  - Save uploaded files to `downloaded_audio` table and storage
- **Match Projects.vue styling exactly**:
  - `.projects-header-actions` for header controls
  - `.projects__grid` for card grid layout
  - `.project-card` styling for audio file cards
  - `.projects__section-header` for section titles
  - Use same color scheme, spacing, borders, shadows
- **Use CustomDropdown component** for all dropdowns (status, sort, etc.)
- **All dialogs must use BugReportDialog.vue styling pattern**

### Backend (Rust/Tauri)

**New Commands** (`client/src-tauri/src/audio_download.rs`)
- `download_youtube_audio` - yt-dlp with `-x --audio-format mp3 --audio-quality 0`
- `download_twitter_space_audio` - yt-dlp for X Spaces audio extraction
- `upload_audio_file` - Copy user-selected audio file to storage directory
  - Accept file path from file picker dialog
  - Validate file format (MP3, M4A, WAV, FLAC, OGG)
  - Extract metadata (duration, file size, sample rate, channels) using FFmpeg
  - Copy to `downloaded_audio/` directory with sanitized filename
  - Return file info for database storage
- Emit `download-progress` and `download-complete` events (same as video downloads)
- Store files in `downloaded_audio/` directory

### Database

**New Table: `downloaded_audio`**
```sql
CREATE TABLE downloaded_audio (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL, -- 'youtube', 'twitter', or 'upload'
  platform TEXT, -- 'YouTube' or 'twitter' (null for uploads)
  source_url TEXT, -- Original URL (null for uploads)
  file_path TEXT NOT NULL,
  duration REAL,
  file_size INTEGER,
  sample_rate INTEGER,
  channels INTEGER,
  thumbnail_url TEXT,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

**New File: `client/src/services/database/downloaded-audio.ts`**
- CRUD functions matching `raw-videos.ts` pattern

### Composables

**New: `useAudioDownloads.ts`** (clone of `useDownloads.ts`)
- Track active/queued audio downloads
- Listen to `download-progress` and `download-complete` events
- Save completed downloads to `downloaded_audio` table
- Same queue system (1 concurrent max)

## Implementation Steps

### Phase 1: Backend Foundation
1. Create `client/src-tauri/src/audio_download.rs`
2. Add commands: `download_youtube_audio`, `download_twitter_space_audio`
3. Register commands in `lib.rs`
4. Add `downloaded_audio/` directory to `storage.rs`

### Phase 2: Database
1. Create migration for `downloaded_audio` table
2. Create `client/src/services/database/downloaded-audio.ts`
3. Export functions in `database/index.ts`
4. Add `DownloadedAudio` type to `types.ts`

### Phase 3: Download Audio Page
1. Copy `StreamVods.vue` → `DownloadAudio.vue`
2. Remove Kick/Twitch/PumpFun/Rumble platform detection
3. Keep only YouTube and Twitter (Spaces) detection
4. Change download action to use audio commands
5. Navigate to `/audio-library` instead of `/projects`
6. Update page title/description to "Download Audio"

### Phase 4: Audio Library Page
1. Copy `Projects.vue` → `AudioLibrary.vue`
2. Create `useAudioDownloads.ts` (clone of `useDownloads.ts`)
3. Replace video-specific logic with audio logic
4. Use `DownloadCard` for active downloads (no changes needed)
5. Create audio file cards with playback controls
6. Add delete functionality (delete from DB + file system)
7. Add "Upload Audio" button in header
8. Implement file picker for audio files (MP3, M4A, WAV, FLAC, OGG)
9. Call `upload_audio_file` Tauri command on file selection
10. Show upload progress and save to database on completion

### Phase 5: Navigation & Routing
1. Add "Download Audio" to `navigation.ts` (Browse group, after Search VODs)
2. Add "Audio Library" to `navigation.ts` (Create group, after Built Clips)
3. Add routes to `router/index.ts`

### Phase 6: Testing
1. Test YouTube audio download
2. Test X Spaces audio download
3. Test batch downloads
4. Test audio file upload (MP3, M4A, WAV, FLAC, OGG)
5. Test navigation flow (Download Audio → Audio Library)
6. Test active download progress display
7. Test audio playback in library
8. Test delete functionality (both downloaded and uploaded files)

## Files to Create

**Frontend:**
- `client/src/pages/DownloadAudio.vue` (clone of StreamVods.vue)
- `client/src/pages/AudioLibrary.vue` (clone of Projects.vue)
- `client/src/composables/useAudioDownloads.ts` (clone of useDownloads.ts)
- `client/src/services/database/downloaded-audio.ts`
- `client/src/services/database/migrations/0XX_create_downloaded_audio.ts`

**Backend:**
- `client/src-tauri/src/audio_download.rs`

## Files to Modify

**Frontend:**
- `client/src/config/navigation.ts` - Add 2 nav items
- `client/src/router/index.ts` - Add 2 routes
- `client/src/services/database/index.ts` - Export audio functions
- `client/src/services/database/types.ts` - Add DownloadedAudio type

**Backend:**
- `client/src-tauri/src/lib.rs` - Register audio commands
- `client/src-tauri/src/storage.rs` - Add audio directory
- `client/src-tauri/src/commands/mod.rs` - Add audio_download module

## Technical Notes

**yt-dlp Audio Download:**
- Uses yt-dlp (same binary as video downloads)
- Flags: `-x --audio-format mp3 --audio-quality 0`
- `-x` extracts audio stream directly (no MP4 → MP3 conversion)
- `--audio-format mp3` ensures MP3 output format
- `--audio-quality 0` = best quality available
- `--newline --progress` for progress updates (same as video)
- Same progress parsing logic as `download_youtube_vod`

**Batch Downloads (Exact Match to StreamVods.vue):**
1. User selects multiple items (checkboxes)
2. Clicks "Download Selected" button
3. Creates download queue array
4. Sets `isProcessingQueue = true`
5. Starts first download → navigates to `/audio-library`
6. On completion, automatically starts next in queue
7. Shows progress for current download
8. When queue empty, cleanup and stay on Audio Library page

**X Spaces:**
- URL format: `https://twitter.com/i/spaces/{space_id}`
- yt-dlp handles extraction automatically
- May require cookies for private spaces (future enhancement)

**Navigation Flow:**
- Single download: Click download → navigate to `/audio-library` immediately
- Batch download: Click "Download Selected" → navigate to `/audio-library` immediately
- Audio Library shows active download(s) with real-time progress
- On complete, audio file(s) appear in library grid

## Playlist System

### Playlist Management

**Database Table: `audio_playlists`**
```sql
CREATE TABLE audio_playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

**Database Table: `audio_playlist_items`**
```sql
CREATE TABLE audio_playlist_items (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  audio_id TEXT NOT NULL, -- references downloaded_audio.id
  position INTEGER NOT NULL, -- order in playlist
  created_at INTEGER NOT NULL,
  FOREIGN KEY (playlist_id) REFERENCES audio_playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (audio_id) REFERENCES downloaded_audio(id) ON DELETE CASCADE
)
```

**Playlist Features in Audio Library:**
- Playlists displayed as **separate folders** in Audio Library (like Projects folder view)
- "Create Playlist" button creates new playlist folder
- **Drag audio files into playlist folders** to add them (copies reference, not file)
- Drag-and-drop to reorder tracks within playlist
- Remove tracks from playlist
- Rename/delete playlists
- Play entire playlist with one click
- Playlists are **strictly for in-app listening** (not exported)

**UI Structure:**
- Audio Library has two main sections:
  1. **Downloaded Audio** - All downloaded audio files (grid view)
  2. **Playlists** - Folder-based view of playlists
- Drag audio from "Downloaded Audio" section → drop into playlist folder
- Click playlist folder → shows tracks in that playlist
- Each playlist has "Play All" button

### Global Audio Player

**Component: `GlobalAudioPlayer.vue`**
- Fixed position player bar at bottom of app (above all content)
- Always visible regardless of current page/route
- Persists across navigation (doesn't unmount)
- Shows current track info (title, platform badge, thumbnail if available)
- Playback controls: Play/Pause, Previous, Next
- **Shuffle button** - randomize playback order
- **Repeat button** - repeat playlist (off/all/one)
- Volume slider with mute toggle
- Progress bar with seek capability
- Current time / Total duration display
- Minimalist design with essential controls
- **Styling must match app design system**:
  - Background: `var(--sidebar-surface)`
  - Border: `var(--sidebar-border)`
  - Text: `var(--sidebar-text)`
  - Accent: `var(--accent-primary)`
  - Use same button hover states as other components
  - Match spacing/padding from existing UI elements

**Store: `useAudioPlayer.ts` (Pinia store)**
- Global state for current playlist
- Current track index
- Playback state (playing/paused)
- Volume level
- **Shuffle mode** (on/off) - randomizes track order
- **Repeat mode** (off/all/one) - controls loop behavior
- Queue management (handles shuffle order)
- HTML5 Audio element management
- Auto-advance to next track on completion
- Persist playback state to localStorage (volume, shuffle, repeat)

**Integration Points:**
- Mount `GlobalAudioPlayer.vue` in `DashboardLayout.vue` (outside router-view)
- Audio Library page can trigger playlist playback
- Any page can control playback via store
- Player state persists across page navigation

**Player Behavior:**
- Click "Play Playlist" in Audio Library → loads playlist into player, starts playback
- Player continues playing while user navigates to other pages
- Next/Previous buttons cycle through playlist
- When playlist ends, stop (or loop if repeat enabled)
- Volume persists across sessions (localStorage)

## Updated Implementation Steps

### Phase 1: Backend Foundation (Audio Downloads)
1. Create `client/src-tauri/src/audio_download.rs`
2. Add commands: `download_youtube_audio`, `download_twitter_space_audio`
3. Register commands in `lib.rs`
4. Add `downloaded_audio/` directory to `storage.rs`

### Phase 2: Database (Audio + Playlists)
1. Create migration for `downloaded_audio` table
2. Create migration for `audio_playlists` table
3. Create migration for `audio_playlist_items` table
4. Create `client/src/services/database/downloaded-audio.ts`
5. Create `client/src/services/database/audio-playlists.ts`
6. Export functions in `database/index.ts`
7. Add types to `types.ts`

### Phase 3: Download Audio Page
1. Copy `StreamVods.vue` → `DownloadAudio.vue`
2. Remove Kick/Twitch/PumpFun/Rumble platform detection
3. Keep only YouTube and Twitter (Spaces) detection
4. Change download action to use audio commands
5. Navigate to `/audio-library` instead of `/projects`
6. Update page title/description to "Download Audio"

### Phase 4: Audio Library Page
1. Copy `Projects.vue` → `AudioLibrary.vue`
2. Create `useAudioDownloads.ts` (clone of `useDownloads.ts`)
3. Replace video-specific logic with audio logic
4. Use `DownloadCard` for active downloads (no changes needed)
5. Create audio file cards with playback preview
6. Add delete functionality (delete from DB + file system)
7. Add playlist management UI (create, add to playlist, manage)
8. Add "Play Playlist" button for each playlist

### Phase 5: Global Audio Player
1. Create `client/src/stores/audioPlayer.ts` (Pinia store)
2. Create `client/src/components/GlobalAudioPlayer.vue`
3. Add player to `DashboardLayout.vue` (fixed at bottom)
4. Implement playback controls (play/pause/next/prev)
5. Implement volume control with persistence
6. Implement progress bar with seek
7. Implement auto-advance on track completion
8. Add current track display with metadata
9. Handle playlist loading from Audio Library

### Phase 6: Navigation & Routing
1. Add "Download Audio" to `navigation.ts` (Browse group, after Search VODs)
2. Add "Audio Library" to `navigation.ts` (Create group, after Built Clips)
3. Add routes to `router/index.ts`

### Phase 7: Testing
1. Test YouTube audio download
2. Test X Spaces audio download
3. Test batch downloads
4. Test navigation flow (Download Audio → Audio Library)
5. Test active download progress display
6. Test playlist creation and management
7. Test global audio player on different pages
8. Test playback controls (play/pause/next/prev/volume)
9. Test playlist auto-advance
10. Test state persistence across navigation

## Files to Create

**Frontend:**
- `client/src/pages/DownloadAudio.vue` (clone of StreamVods.vue)
- `client/src/pages/AudioLibrary.vue` (clone of Projects.vue)
- `client/src/composables/useAudioDownloads.ts` (clone of useDownloads.ts)
- `client/src/components/GlobalAudioPlayer.vue`
- `client/src/stores/audioPlayer.ts` (Pinia store)
- `client/src/services/database/downloaded-audio.ts`
- `client/src/services/database/audio-playlists.ts`
- `client/src/services/database/migrations/0XX_create_downloaded_audio.ts`
- `client/src/services/database/migrations/0XX_create_audio_playlists.ts`
- `client/src/services/database/migrations/0XX_create_audio_playlist_items.ts`

**Backend:**
- `client/src-tauri/src/audio_download.rs`

## Files to Modify

**Frontend:**
- `client/src/layouts/DashboardLayout.vue` - Add GlobalAudioPlayer component
- `client/src/config/navigation.ts` - Add 2 nav items
- `client/src/router/index.ts` - Add 2 routes
- `client/src/services/database/index.ts` - Export audio and playlist functions
- `client/src/services/database/types.ts` - Add types (DownloadedAudio, AudioPlaylist, AudioPlaylistItem)

**Backend:**
- `client/src-tauri/src/lib.rs` - Register audio commands
- `client/src-tauri/src/storage.rs` - Add audio directory
- `client/src-tauri/src/commands/mod.rs` - Add audio_download module

## Design & Styling Requirements

### Critical: Match Existing Components

**AudioLibrary.vue MUST match Projects.vue:**
- Exact same layout structure and grid system
- Same header with search, filters, sort controls
- Same card styling (`.project-card` classes)
- Same section headers (`.projects__section-header`)
- Same color scheme, spacing, borders, shadows
- Same selection/delete/pagination UI

**DownloadAudio.vue MUST match StreamVods.vue:**
- Exact same layout structure
- Same search input and platform detection UI
- Same VOD grid display
- Same download dialog flow
- Same color scheme and styling

**All Dialogs MUST use BugReportDialog.vue pattern:**
- Structure: overlay → dialog → accent bar → header → content → footer
- Classes: `.bug-dialog__overlay`, `.bug-dialog__accent`, `.bug-dialog__header`, etc.
- Buttons: `.bug-dialog__btn--primary`, `.bug-dialog__btn--secondary`
- CSS Variables: `var(--sidebar-surface)`, `var(--sidebar-border)`, `var(--sidebar-text)`, `var(--accent-primary)`
- Backdrop filter blur on overlay
- Consistent transitions and animations

**All Dropdowns MUST use CustomDropdown component:**
- No custom dropdown implementations
- Use existing `CustomDropdown.vue` component
- Pass `trigger-class` for custom trigger styling if needed
- Maintains app-wide dropdown consistency

**GlobalAudioPlayer styling:**
- Use CSS variables for all colors
- Match button styles from existing components
- Consistent spacing with app design system
- Fixed position at bottom with proper z-index
- Minimalist, non-intrusive design
