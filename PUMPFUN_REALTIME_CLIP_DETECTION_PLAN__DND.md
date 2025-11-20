# PumpFun Live Clipping - Real-Time Implementation

## Overview

Implement TRUE real-time clip detection where PumpFun livestreams are recorded in 15-minute segments WHILE LIVE and processed immediately after each segment completes. Clips are detected and displayed while the stream is still ongoing.

## Real-Time Architecture

**No Waiting for Stream End - Process While Live**

1. **Monitor** - Poll API every 30s to detect when streamers go live
2. **Record Live** - Start LiveKit recorder that captures 15-min segments in real-time
3. **Process Immediately** - As each segment completes (stream still live), process it
4. **Continue** - Move to next segment while stream continues
5. **Final Segment** - Process remaining segment when stream ends

### Technology

- **LiveKit WebRTC** - Connect to live stream via `@livekit/rtc-node`
- **Node.js Recorder** - Service that records segments from WebRTC
- **FFmpeg** - Split recording into 15-minute files
- **Existing Pipeline** - Use Whisper + OpenRouter for each segment

## Database Schema

Create `client/src-tauri/migrations/015_add_livestream_monitoring.sql`:

```sql
-- Monitored PumpFun streamers
CREATE TABLE IF NOT EXISTS monitored_streamers (
  id TEXT PRIMARY KEY,
  mint_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  last_check_timestamp INTEGER,
  is_currently_live INTEGER DEFAULT 0,
  current_session_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Live recording sessions (created when stream starts)
CREATE TABLE IF NOT EXISTS livestream_sessions (
  id TEXT PRIMARY KEY,
  monitored_streamer_id TEXT NOT NULL,
  mint_id TEXT NOT NULL,
  stream_start_time INTEGER NOT NULL,
  stream_end_time INTEGER,
  is_recording INTEGER DEFAULT 1,
  total_segments INTEGER DEFAULT 0,
  processed_segments INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (monitored_streamer_id) REFERENCES monitored_streamers(id) ON DELETE CASCADE
);

-- 15-minute segments (created as they're recorded)
CREATE TABLE IF NOT EXISTS livestream_segments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  segment_number INTEGER NOT NULL,
  start_time_offset REAL NOT NULL, -- Seconds from stream start
  duration REAL NOT NULL,
  raw_video_id TEXT, -- Links to raw_videos table
  status TEXT DEFAULT 'recording', -- recording, ready, processing, completed, error
  clips_detected INTEGER DEFAULT 0,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES livestream_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (raw_video_id) REFERENCES raw_videos(id) ON DELETE SET NULL
);

CREATE INDEX idx_monitored_streamers_mint ON monitored_streamers(mint_id);
CREATE INDEX idx_livestream_sessions_streamer ON livestream_sessions(monitored_streamer_id);
CREATE INDEX idx_livestream_segments_session ON livestream_segments(session_id);
CREATE INDEX idx_livestream_segments_status ON livestream_segments(status);
```

## Node.js LiveKit Recorder

Create `client/src-tauri/pumpfun-service/record-livestream.mjs`:

**Purpose:** Record live WebRTC stream in 15-minute segments

**Key Features:**

- Connect to PumpFun LiveKit room with JWT auth
- Record video/audio tracks to MP4 files
- Auto-rotate files every 15 minutes
- Emit JSON events on stdout for each completed segment
- Handle reconnections and errors

**Flow:**

```javascript
// 1. Get livestream info
const info = await fetch(`https://livestream-api.pump.fun/livestream?mintId=${mintId}`)

// 2. Join stream to get JWT token
const { token } = await fetch('https://livestream-api.pump.fun/livestream/join', {
  method: 'POST',
  body: JSON.stringify({ mintId, viewer: true })
})

// 3. Connect to LiveKit
const room = await LiveKit.connect(liveKitUrl, token)

// 4. Subscribe to tracks and pipe to FFmpeg with segment rotation
room.on('trackSubscribed', (track) => {
  const ffmpeg = spawn('ffmpeg', [
    '-f', 'segment',
    '-segment_time', '900', // 15 minutes
    '-reset_timestamps', '1',
    output_pattern
  ])
  
  track.pipe(ffmpeg.stdin)
})

// 5. On segment complete, emit event
ffmpeg.on('segment', (segmentPath) => {
  console.log(JSON.stringify({
    type: 'segment_complete',
    segment: segmentNumber,
    path: segmentPath,
    duration: 900
  }))
})
```

## Rust Integration

Add to `client/src-tauri/src/pumpfun.rs`:

```rust
use tokio::process::Command;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tokio::io::{BufReader, AsyncBufReadExt};

// Track active recordings
static ACTIVE_RECORDINGS: Lazy<Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

#[tauri::command]
pub async fn check_pumpfun_livestream(mint_id: String) -> Result<String, String> {
    // GET https://livestream-api.pump.fun/livestream?mintId={mint_id}
    let url = format!("https://livestream-api.pump.fun/livestream?mintId={}", mint_id);
    let response = reqwest::get(&url).await
        .map_err(|e| format!("Request failed: {}", e))?;
    let body = response.text().await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    Ok(body)
}

#[tauri::command]
pub async fn start_livestream_recording(
    app: tauri::AppHandle,
    mint_id: String,
    session_id: String
) -> Result<(), String> {
    let app_clone = app.clone();
    let mint_clone = mint_id.clone();
    let session_clone = session_id.clone();
    
    // Spawn recorder process
    let task = tokio::spawn(async move {
        let script_path = /* resolve record-livestream.mjs path */;
        let output_dir = /* get storage path */;
        
        let mut child = Command::new("node")
            .arg(script_path)
            .arg(&mint_clone)
            .arg(&output_dir)
            .arg("15") // segment duration in minutes
            .stdout(Stdio::piped())
            .spawn()
            .expect("Failed to spawn recorder");
        
        let stdout = child.stdout.take().unwrap();
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        
        // Parse stdout for segment completion events
        while let Some(line) = lines.next_line().await.unwrap() {
            if let Ok(event) = serde_json::from_str::<RecorderEvent>(&line) {
                match event.event_type.as_str() {
                    "segment_complete" => {
                        // Emit Tauri event for frontend
                        app_clone.emit("segment-ready", event).ok();
                    }
                    "stream_ended" => {
                        app_clone.emit("stream-ended", event).ok();
                        break;
                    }
                    _ => {}
                }
            }
        }
    });
    
    // Store task handle
    ACTIVE_RECORDINGS.lock().unwrap().insert(mint_id, task);
    Ok(())
}

#[tauri::command]
pub async fn stop_livestream_recording(mint_id: String) -> Result<(), String> {
    if let Some(task) = ACTIVE_RECORDINGS.lock().unwrap().remove(&mint_id) {
        task.abort();
    }
    Ok(())
}
```

Register commands in `client/src-tauri/src/lib.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    pumpfun::check_pumpfun_livestream,
    pumpfun::start_livestream_recording,
    pumpfun::stop_livestream_recording,
])
```

## Frontend Composables

### 1. Stream Monitoring (`useLivestreamMonitoring.ts`)

```typescript
export function useLivestreamMonitoring() {
  const activeSessions = ref<Map<string, LiveSession>>(new Map())
  let pollingInterval: number | null = null
  
  async function startMonitoring(streamers: MonitoredStreamer[]) {
    pollingInterval = setInterval(async () => {
      for (const streamer of streamers) {
        const status = await checkLiveStatus(streamer.mintId)
        
        if (status.isLive && !activeSessions.has(streamer.id)) {
          // Stream just went live!
          await handleStreamStart(streamer, status)
        } else if (!status.isLive && activeSessions.has(streamer.id)) {
          // Stream ended
          await handleStreamEnd(streamer)
        }
      }
    }, 30000) // Poll every 30 seconds
  }
  
  async function handleStreamStart(streamer: MonitoredStreamer, status: LiveStatus) {
    // 1. Create database session
    const sessionId = await createLivestreamSession(streamer.id, streamer.mintId)
    
    // 2. Start recording
    await invoke('start_livestream_recording', {
      mintId: streamer.mintId,
      sessionId
    })
    
    // 3. Listen for segment completion events
    listen('segment-ready', (event) => handleSegmentReady(sessionId, event))
    
    // 4. Update UI
    activeSessions.set(streamer.id, { sessionId, startTime: Date.now() })
  }
  
  return { startMonitoring, stopMonitoring, activeSessions }
}
```

### 2. Segment Processing (`useLivestreamSegmentProcessing.ts`)

```typescript
export function useLivestreamSegmentProcessing() {
  const queue = ref<SegmentJob[]>([])
  const isProcessing = ref(false)
  
  async function handleSegmentReady(sessionId: string, event: SegmentEvent) {
    // Event contains: { segment: number, path: string, duration: number }
    
    // 1. Create segment record in database
    const segmentId = await createLivestreamSegment(sessionId, {
      segmentNumber: event.segment,
      startTimeOffset: (event.segment - 1) * 900,
      duration: event.duration,
      status: 'ready'
    })
    
    // 2. Add to processing queue
    queue.value.push({
      sessionId,
      segmentId,
      filePath: event.path
    })
    
    // 3. Start processing if not already running
    if (!isProcessing.value) {
      processQueue()
    }
  }
  
  async function processQueue() {
    isProcessing.value = true
    
    while (queue.value.length > 0) {
      const job = queue.value.shift()!
      await processSegment(job)
    }
    
    isProcessing.value = false
  }
  
  async function processSegment(job: SegmentJob) {
    try {
      // Update status
      await updateSegmentStatus(job.segmentId, 'processing')
      
      // 1. Create raw_video record
      const rawVideoId = await createRawVideo(job.filePath, {
        isSegment: true,
        segmentNumber: job.segmentNumber
      })
      
      // 2. Extract audio
      const [filename, audioBase64] = await invoke('extract_audio_from_video', {
        videoPath: job.filePath,
        outputPath: `segment_${job.segmentId}_audio.ogg`
      })
      
      // 3. Create audio file for upload
      const audioBlob = base64ToBlob(audioBase64)
      const audioFile = new File([audioBlob], filename, { type: 'audio/ogg' })
      
      // 4. Call clip detection API
      const formData = new FormData()
      formData.append('project_id', job.sessionId)
      formData.append('prompt', DEFAULT_LIVE_PROMPT)
      formData.append('audio', audioFile)
      
      const response = await api.post('/clips/detect', formData)
      
      // 5. Store results
      if (response.data.success) {
        await updateSegmentStatus(job.segmentId, 'completed')
        // Clips are automatically stored by backend
      }
      
    } catch (error) {
      await updateSegmentStatus(job.segmentId, 'error', error.message)
    }
  }
  
  return { queue, isProcessing, handleSegmentReady }
}
```

## Update LiveClip.vue

**Remove simulation, wire real functionality:**

```typescript
<script setup lang="ts">
import { useLivestreamMonitoring } from '@/composables/useLivestreamMonitoring'
import { useLivestreamSegmentProcessing } from '@/composables/useLivestreamSegmentProcessing'
import { getAllMonitoredStreamers, createMonitoredStreamer, deleteMonitoredStreamer } from '@/services/database/livestream-monitoring'

const streamers = ref<MonitoredStreamer[]>([])
const { activeSessions, startMonitoring, stopMonitoring } = useLivestreamMonitoring()
const { queue, handleSegmentReady } = useLivestreamSegmentProcessing()

// Load streamers from database
onMounted(async () => {
  streamers.value = await getAllMonitoredStreamers()
  
  // Setup event listeners
  listen('segment-ready', (event) => {
    handleSegmentReady(event.payload.sessionId, event.payload)
    addActivityLog({
      streamerId: event.payload.streamerId,
      message: `Segment ${event.payload.segment} ready, processing...`,
      status: 'loading'
    })
  })
})

async function addStreamer() {
  const mintId = extractMintId(inputValue.value)
  const streamerId = await createMonitoredStreamer(mintId, inputValue.value)
  streamers.value = await getAllMonitoredStreamers()
  inputValue.value = ''
}

async function toggleDetection() {
  if (isDetectingAny.value) {
    await stopMonitoring()
  } else {
    const selected = streamers.value.filter(s => s.selected)
    await startMonitoring(selected)
  }
}
</script>
```

## Processing Flow Timeline

**Example: 60-minute live stream**

```
00:00 - Stream starts, recording begins → Segment 1 starts recording
15:00 - Segment 1 complete (stream still live) → Start processing Segment 1
        - Extract audio (2 min)
        - Transcribe (3 min)
        - Detect clips (2 min)
        - Total: ~7 minutes
        
        Segment 2 recording (started at 15:00)
        
22:00 - Segment 1 processing complete → Display clips in UI
30:00 - Segment 2 complete (stream still live) → Start processing Segment 2
37:00 - Segment 2 processing complete → Display clips in UI
        
        Segment 3 recording (started at 30:00)
        
45:00 - Segment 3 complete (stream still live) → Start processing Segment 3
52:00 - Segment 3 processing complete → Display clips in UI
        
        Segment 4 recording (started at 45:00)
        
60:00 - Stream ends
        Segment 4 (15 min) complete → Start processing Segment 4
67:00 - Segment 4 processing complete → All clips available
```

**Key Point:** Segments are processed WHILE the stream is still live, with only ~7 minute delay between recording and clip detection.

## Files to Create

1. `client/src-tauri/migrations/015_add_livestream_monitoring.sql`
2. `client/src-tauri/pumpfun-service/record-livestream.mjs` 
3. `client/src-tauri/pumpfun-service/package.json` (add @livekit/rtc-node)
4. `client/src/services/database/livestream-monitoring.ts`
5. `client/src/composables/useLivestreamMonitoring.ts`
6. `client/src/composables/useLivestreamSegmentProcessing.ts`
7. `client/src/types/livestream.ts`

## Files to Modify

1. `client/src-tauri/src/pumpfun.rs` - Add recording commands
2. `client/src-tauri/src/lib.rs` - Register commands
3. `client/src/pages/LiveClip.vue` - Remove simulation, use real data
4. `client/src/services/database/index.ts` - Export new functions