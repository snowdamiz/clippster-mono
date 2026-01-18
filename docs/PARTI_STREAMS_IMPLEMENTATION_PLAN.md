# Parti Streams Implementation Plan

## Overview

Implement Parti stream support using the same approach as Twitch - no API required. yt-dlp already has native Parti extractors (`parti:livestream` and `parti:video`), so we can use the identical yt-dlp → FFmpeg → HLS pipeline.

## Architecture Comparison

| Component | Twitch | Parti (Copy Pattern) |
|-----------|--------|---------------------|
| **Live Status** | Twitch GQL endpoint | yt-dlp `--dump-json` to check if live |
| **Recording** | yt-dlp → FFmpeg → HLS | yt-dlp → FFmpeg → HLS (identical) |
| **VODs** | yt-dlp `--dump-json` | yt-dlp `--dump-json` (identical) |

## Files to Create/Modify

### 1. Create `parti.rs` (Rust Backend)

**Location:** `client/src-tauri/src/parti.rs`

Copy `twitch.rs` and adapt:

```rust
// Key functions needed:
- check_parti_livestream(channel: String) -> PartiLiveStatus
- get_parti_vods(channel: String, limit: u32) -> Vec<PartiVod>
- start_parti_recording(channel, streamerId, sessionId, segmentDuration)
- stop_parti_recording(channel)
- stop_all_parti_recordings()
- normalize_channel_name() // Handle parti.com/username URLs
```

**Live Status Check (using yt-dlp):**
```rust
// Check if Parti channel is live using yt-dlp
let output = Command::new("yt-dlp")
    .arg("--dump-json")
    .arg("--no-download")
    .arg(format!("https://parti.com/{}", channel))
    .output();
// If it returns valid JSON with is_live: true, stream is live
```

### 2. Update `lib.rs`

**Location:** `client/src-tauri/src/lib.rs`

```rust
mod parti;

// In the invoke_handler, add:
parti::check_parti_livestream,
parti::get_parti_vods,
parti::start_parti_recording,
parti::stop_parti_recording,
parti::stop_all_parti_recordings,
parti::get_parti_session_output_dir,
```

### 3. Create `parti.ts` (Frontend Service)

**Location:** `client/src/services/parti.ts`

Copy `twitch.ts` and adapt:

```typescript
export interface PartiLiveStatus {
  isLive: boolean;
  channelId?: string;
  channelName?: string;
  displayName?: string;
  profileImageUrl?: string;
  streamTitle?: string;
  viewerCount?: number;
  startedAt?: string;
}

export interface PartiVod {
  vodId: string;
  title?: string;
  duration?: number;
  viewCount?: number;
  thumbnailUrl?: string;
  createdAt?: string;
  url: string;
}

export function extractChannelName(input: string): string | null
export async function checkPartiLivestream(channel: string): Promise<PartiLiveStatus>
export async function getPartiVods(channel: string, limit?: number): Promise<PartiVod[]>
export async function startPartiRecording(...)
export async function stopPartiRecording(...)
```

### 4. Update Type Definitions

**Location:** `client/src/types/livestream.ts`

```typescript
export type SupportedLivestreamPlatform = 'PumpFun' | 'Youtube' | 'Twitch' | 'Kick' | 'Parti';
```

### 5. Update Platform Config

**Location:** `client/src/config/platforms.ts`

```typescript
parti: {
  id: 'parti',
  name: 'Parti',
  description: 'Download streams from Parti',
  icon: '/parti.svg',
  searchPlaceholder: 'Channel name or Parti URL',
  searchLabel: 'Channel',
  emptyStateTitle: 'Search for VODs',
  emptyStateDescription: 'Search for VODs by channel name or Parti URL.',
  isComingSoon: false,
  provider: 'parti',
  localStorageKey: 'parti_recent_searches',
}
```

### 6. Update Monitoring Composable

**Location:** `client/src/composables/useLivestreamMonitoring.ts`

Add:
- `fetchPartiLiveStatus()` function
- `case 'Parti':` in `fetchLiveStatus()` switch
- Parti handling in `handleStreamEnd()`
- Parti handling in `startDvrRecordingForStreamer()`
- Parti DVR session tracking (similar to Twitch/Kick)

### 7. Add Parti Icon

**Location:** `client/public/parti.svg`

Add Parti logo SVG file.

## Implementation Notes

### Why This Works

yt-dlp has native Parti extractors:
- `parti:livestream` - For live streams
- `parti:video` - For VODs

This means:
1. **No API reverse-engineering needed** - yt-dlp handles authentication/extraction
2. **Recording works identically to Twitch** - yt-dlp output piped to FFmpeg for HLS segments
3. **VOD listing works identically** - yt-dlp `--dump-json` returns video metadata

### URL Normalization

Handle various Parti URL formats:
- `username`
- `parti.com/username`
- `https://parti.com/username`
- `https://parti.com/username/live`

### Live Status Detection

Unlike Twitch (which has a public GQL endpoint), Parti live status is checked via yt-dlp:

```bash
yt-dlp --dump-json --no-download "https://parti.com/channelname"
```

If the channel is live, this returns JSON with stream metadata. If offline, it may error or return different data.

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Rust backend (`parti.rs`) | 2-3 hours |
| Frontend service (`parti.ts`) | 1 hour |
| Monitoring integration | 1-2 hours |
| Platform config + types | 30 min |
| UI updates | 30 min |
| Testing | 2 hours |

**Total: ~7-9 hours**

## Testing Checklist

- [ ] Live status check works for online/offline channels
- [ ] VOD listing returns correct metadata
- [ ] Recording starts and produces HLS segments
- [ ] Segments emit events correctly for clip detection
- [ ] Recording stops cleanly
- [ ] DVR/Watch mode works
- [ ] Platform appears in UI dropdowns
- [ ] URL normalization handles all formats
