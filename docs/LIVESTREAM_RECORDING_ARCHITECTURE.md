# Livestream Recording Architecture

## Overview

This document describes the multi-session recording architecture used across all livestream platforms (Kick, Twitch, PumpFun). This architecture enables simultaneous recording sessions for the same channel/mint with different segment durations, allowing both smooth live-watching (4-second segments) and efficient auto-detection (5-minute segments) to coexist without conflicts.

## Core Principles

### 1. Session-Based Tracking

**All platforms track recordings by `session_id` instead of `channel_slug`/`channel_name`/`mint_id`.**

This is the fundamental design decision that enables multiple sessions per channel:

```rust
// ❌ OLD WAY (prevents multiple sessions)
static ACTIVE_RECORDINGS: HashMap<String, RecordingEntry> // Keyed by channel_slug

// ✅ NEW WAY (allows multiple sessions)
static ACTIVE_RECORDINGS: HashMap<String, RecordingEntry> // Keyed by session_id
```

### 2. Entry Structure

Each recording entry stores the channel/mint identifier to allow lookup:

```rust
struct RecordingEntry {
    stop_tx: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<()>,
    channel_slug: String, // Or channel_name/mint_id depending on platform
}
```

### 3. Separate Output Directories

Each session writes to its own directory based on `session_id`:

```
livestream_recordings/
├── kick-view-soljakey-1771709878089/     # Temp viewer session (4-sec segments)
│   ├── segment_0000.ts
│   ├── segment_0001.ts
│   └── playlist.m3u8
└── {database-uuid}/                       # Persistent auto-detect (5-min segments)
    ├── segment_0000.ts
    ├── segment_0001.ts
    └── playlist.m3u8
```

## Session Types

### Temporary Viewer Sessions

**Purpose**: Live-watching with low latency  
**Segment Duration**: 4 seconds (1 minute parameter → 4 sec in FFmpeg)  
**Session ID Format**: `{platform}-view-{channel}-{timestamp}`  
**Lifecycle**: Created when user clicks "Watch", cleaned up when viewer closes

### Persistent Auto-Detect Sessions

**Purpose**: Efficient clip detection  
**Segment Duration**: 5 minutes (300 seconds in FFmpeg)  
**Session ID Format**: Database-generated UUID  
**Lifecycle**: Created when auto-detect starts, managed by monitoring system

## Implementation Guide (For New Platforms)

When adding a new livestream platform, follow these steps:

### Step 1: Define Recording Entry Structure

```rust
#[derive(Debug)]
struct {Platform}RecordingEntry {
    stop_tx: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<()>,
    channel_identifier: String, // Store channel/mint ID for lookup
}

// Track recordings by session_id instead of channel identifier
// This enables both temp viewer sessions (4-sec segments) and persistent auto-detect sessions (5-min segments)
// to record the same channel simultaneously in different directories
static {PLATFORM}_ACTIVE_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, {Platform}RecordingEntry>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));
```

### Step 2: Implement Start Recording Command

```rust
#[tauri::command]
pub async fn start_{platform}_recording(
    app: tauri::AppHandle,
    channel_identifier: String,
    streamer_id: String,
    session_id: String,
    segment_duration_minutes: Option<u32>,
) -> Result<(), String> {
    // Check if this specific session is already recording
    // Allow multiple sessions per channel (e.g., temp viewer + persistent auto-detect)
    if {PLATFORM}_ACTIVE_RECORDINGS.lock().unwrap().contains_key(&session_id) {
        println!("[{Platform}] Session {} already recording, skipping duplicate start", session_id);
        return Ok(());
    }

    // Create session directory
    let output_dir = storage::get_livestream_recordings_dir()
        .map_err(|e| format!("Failed to get recordings directory: {}", e))?;
    
    let session_dir = output_dir.join(&session_id);
    std::fs::create_dir_all(&session_dir)
        .map_err(|e| format!("Failed to create session directory: {}", e))?;

    let segment_duration = segment_duration_minutes.unwrap_or(5);
    
    // Create stop channel
    let (stop_tx, stop_rx) = oneshot::channel();

    // Clone values for the async task
    let session_for_cleanup = session_id.clone();
    let task = tokio::spawn(async move {
        if let Err(err) = run_{platform}_recorder(
            app_handle,
            channel_clone,
            streamer_clone,
            session_clone,
            output_str,
            segment_duration,
            stop_rx,
        )
        .await
        {
            eprintln!("[{Platform}Recorder] {}", err);
        }
        // Clean up the recording entry when the task exits (success or error)
        // Remove by session_id (not channel) since we track by session now
        {PLATFORM}_ACTIVE_RECORDINGS.lock().unwrap().remove(&session_for_cleanup);
        println!("[{Platform}Recorder] Cleaned up recording entry for session {}", session_for_cleanup);
    });

    // Insert by session_id (not channel_identifier) to allow multiple sessions per channel
    {PLATFORM}_ACTIVE_RECORDINGS.lock().unwrap().insert(
        session_id.clone(),
        {Platform}RecordingEntry {
            stop_tx: Some(stop_tx),
            task,
            channel_identifier: channel_identifier.clone(),
        },
    );

    Ok(())
}
```

### Step 3: Implement Stop Recording Command

**CRITICAL**: The stop command must handle multiple sessions per channel and avoid holding locks across await points.

```rust
/// Stop recording a {Platform} livestream
/// Stops ALL sessions recording this channel (both temp viewer and persistent auto-detect)
#[tauri::command]
pub async fn stop_{platform}_recording(channel_identifier: String) -> Result<(), String> {
    // Find all sessions recording this channel and collect their entries
    // We need to collect entries (not just IDs) to avoid holding the lock across await
    let entries: Vec<(String, {Platform}RecordingEntry)> = {
        let mut recordings = {PLATFORM}_ACTIVE_RECORDINGS.lock().unwrap();
        let session_ids: Vec<String> = recordings
            .iter()
            .filter(|(_, entry)| entry.channel_identifier == channel_identifier)
            .map(|(session_id, _)| session_id.clone())
            .collect();
        
        session_ids
            .into_iter()
            .filter_map(|session_id| {
                recordings.remove(&session_id).map(|entry| (session_id, entry))
            })
            .collect()
    }; // Lock is dropped here
    
    // Stop each session (no lock held during await)
    for (session_id, entry) in entries {
        if let Some(tx) = entry.stop_tx {
            let _ = tx.send(());
        }
        if let Err(err) = entry.task.await {
            eprintln!("[{Platform}Recorder] Join error for session {}: {}", session_id, err);
        }
    }
    
    Ok(())
}
```

### Step 4: Update Helper Functions

```rust
/// Check if a {Platform} recording is currently active for a channel
#[tauri::command]
pub fn is_{platform}_recording_active(channel_identifier: String) -> bool {
    // Check if any session is recording this channel
    {PLATFORM}_ACTIVE_RECORDINGS
        .lock()
        .unwrap()
        .values()
        .any(|entry| entry.channel_identifier == channel_identifier)
}
```

## Segment Duration Mapping

The `segment_duration_minutes` parameter maps to actual segment lengths:

| Parameter Value | Actual Segment Duration | Use Case |
|----------------|------------------------|----------|
| `1` | 4 seconds | Temp viewer sessions (low latency) |
| `5` | 5 minutes (300 seconds) | Persistent auto-detect (efficient) |
| `0` | Infinite (single file) | Special cases |

**Implementation in FFmpeg**:

```rust
let hls_segment_seconds = if segment_duration_minutes <= 1 {
    4 // Low-latency mode for live watching
} else {
    segment_duration_minutes * 60 // Convert minutes to seconds for recording
};
```

## Frontend Integration

### Starting a Session

```typescript
// Temp viewer session (4-second segments)
await startKickRecording(
    channelSlug,
    streamerId,
    `kick-view-${channelSlug}-${Date.now()}`, // Temp session ID
    1 // 1 minute = 4 seconds
);

// Persistent auto-detect session (5-minute segments)
await startKickRecording(
    channelSlug,
    streamerId,
    sessionInfo.sessionId, // Database UUID
    5 // 5 minutes
);
```

### Stopping Sessions

```typescript
// Stops ALL sessions for this channel (both temp and persistent)
await stopKickRecording(channelSlug);
```

## Cleanup Logic

### Temp Viewer Sessions

Cleaned up when:
1. Stream ends AND viewer is closed
2. User explicitly closes viewer after stream ends

**NOT cleaned up when**:
- Stream ends but viewer is still open (user may be watching behind live edge)

### Persistent Auto-Detect Sessions

Managed by the monitoring system, not cleaned up automatically when stream ends.

## Common Pitfalls

### ❌ DON'T: Track by channel identifier

```rust
// This prevents multiple sessions per channel
if ACTIVE_RECORDINGS.lock().unwrap().contains_key(&channel_slug) {
    return Err("Recording already active".to_string());
}
```

### ✅ DO: Track by session_id

```rust
// This allows multiple sessions per channel
if ACTIVE_RECORDINGS.lock().unwrap().contains_key(&session_id) {
    println!("Session {} already recording, skipping duplicate start", session_id);
    return Ok(());
}
```

### ❌ DON'T: Hold lock across await

```rust
// This causes "future not Send" errors
let entry = ACTIVE_RECORDINGS.lock().unwrap().remove(&session_id);
if let Some(entry) = entry {
    entry.task.await; // ❌ Lock still held!
}
```

### ✅ DO: Collect entries before awaiting

```rust
// Collect all entries first, then drop lock before awaiting
let entries: Vec<(String, RecordingEntry)> = {
    let mut recordings = ACTIVE_RECORDINGS.lock().unwrap();
    // ... collect entries ...
}; // Lock dropped here

for (session_id, entry) in entries {
    entry.task.await; // ✅ No lock held
}
```

### ❌ DON'T: Reuse segment numbers across sessions

Each session starts at segment 0, which is correct. Don't try to continue segment numbering from a previous session.

### ✅ DO: Let each session manage its own segments

```
kick-view-soljakey-1771709878089/
├── segment_0000.ts  ← Starts at 0
├── segment_0001.ts
└── segment_0002.ts

{database-uuid}/
├── segment_0000.ts  ← Also starts at 0 (different directory)
├── segment_0001.ts
└── segment_0002.ts
```

## Platform-Specific Notes

### Kick

- Uses yt-dlp + FFmpeg for HLS recording
- Channel identifier: `channel_slug` (lowercase)
- Normalization: Strips protocol, domain, paths, query params

### Twitch

- Uses yt-dlp + FFmpeg for HLS recording
- Channel identifier: `channel_name` (lowercase)
- Normalization: Strips protocol, domain, paths, query params

### PumpFun

- Uses Node.js sidecar with LiveKit for browser-based recording
- Channel identifier: `mint_id` (Solana mint address)
- No normalization needed (mint addresses are already normalized)

## Testing Checklist

When implementing a new platform or modifying existing platforms:

- [ ] Multiple sessions can record the same channel simultaneously
- [ ] Each session writes to its own directory based on `session_id`
- [ ] Temp viewer sessions use 4-second segments
- [ ] Persistent auto-detect sessions use 5-minute segments
- [ ] Stopping by channel identifier stops ALL sessions for that channel
- [ ] No "Recording already active" errors when starting multiple sessions
- [ ] Segment numbering starts at 0 for each session independently
- [ ] Cleanup happens correctly when tasks exit
- [ ] No deadlocks or "future not Send" errors

## References

- Kick implementation: `client/src-tauri/src/kick.rs`
- Twitch implementation: `client/src-tauri/src/twitch.rs`
- PumpFun implementation: `client/src-tauri/src/pumpfun.rs`
- Frontend viewer: `client/src/composables/useLivestreamViewer.ts`
- Frontend monitoring: `client/src/composables/useLivestreamMonitoring.ts`
