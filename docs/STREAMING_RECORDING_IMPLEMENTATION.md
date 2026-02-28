# OBS-Like Streaming & Recording Studio

Add professional streaming and recording capabilities to Clippster, enabling users to stream to multiple RTMP destinations and record content locally with full scene management, overlays, and auto-detection integration.

## Architecture Overview

**Integration into Existing Clippster App:**
- Studio features are **part of the main Clippster desktop app** (not a separate application)
- Added to sidebar navigation in the **Create** group, positioned after "AI Video Creator"
- Two new navigation items:
  - **"Stream Studio"** → `/studio/stream` - Live streaming with RTMP output
  - **"Recording Studio"** → `/studio/record` - Local recording (no streaming)

**Navigation Structure:**
```
Create Group:
├── VOD Library
├── Built Clips
├── Video Editor
├── AI Video Creator
├── Stream Studio      ← NEW
└── Recording Studio   ← NEW
```

**Implementation Approach:**
- **Build our own streaming engine** using Rust + FFmpeg (not embedding libobs)
- **Reference OBS architecture** as a guide for best practices (OBS is GPL v2 open source)
- **Avoid GPL licensing** by implementing our own solution inspired by OBS design patterns
- **Leverage existing Clippster infrastructure** (FFmpeg utils, HLS recording, video processing)

**Core Components:**
- **Scene Manager** - Multiple scenes with sources (camera, screen, overlays, browser sources)
- **Source Capture System** - Screen/window capture, webcam, audio devices, media files
- **Compositor** - Real-time video/audio mixing and rendering (inspired by OBS compositor)
- **Encoder Pipeline** - FFmpeg-based encoding with hardware acceleration
- **RTMP Output** - Multi-destination streaming
- **Recording Output** - Local file recording with HLS segmentation
- **Auto-Detection Integration** - Seamless integration with existing LiveClip workflow
- **Advanced Features** - Replay buffer, virtual camera, stream delay, audio filters, NDI, multi-track recording, analytics, voice-activated markers, templates

## Phase 1: Foundation & Architecture

### 1.1 Rust Backend - Source Capture

**New Files:**
- `client/src-tauri/src/studio/mod.rs` - Studio module root
- `client/src-tauri/src/studio/sources.rs` - Source capture (screen, camera, audio)
- `client/src-tauri/src/studio/compositor.rs` - Scene composition and mixing
- `client/src-tauri/src/studio/encoder.rs` - FFmpeg encoding pipeline
- `client/src-tauri/src/studio/rtmp.rs` - RTMP streaming output
- `client/src-tauri/src/studio/recorder.rs` - Local recording

**Screen Capture:**
- Use `scrap` crate for cross-platform screen capture
- Capture specific display or all displays
- 30-60 fps capture rate
- RGB24 format

**Window Capture:**
- Platform-specific window enumeration
- Capture specific application window
- Handle window resize/move

**Camera Capture:**
- Reuse existing `nokhwa` integration
- Multiple camera support
- Resolution/framerate selection

**Audio Capture:**
- Reuse existing `cpal` integration
- Desktop audio (system audio)
- Microphone input
- Multiple audio sources

### 1.2 Compositor - Scene Graph

**Architecture (Inspired by OBS):**
- Scene = Collection of sources with transforms
- Source = Video/audio input with properties
- Render pipeline: Sources → Transforms → Filters → Composite → Encode

**Scene Graph Structure:**
```rust
struct Scene {
    id: String,
    name: String,
    sources: Vec<SceneSource>,
}

struct SceneSource {
    id: String,
    source_type: SourceType,
    transform: Transform,
    filters: Vec<Filter>,
    visible: bool,
    locked: bool,
    z_index: i32,
}

struct Transform {
    position: (f32, f32),
    size: (f32, f32),
    rotation: f32,
    opacity: f32,
    crop: Crop,
}
```

**Rendering:**
- Render sources in z-index order (bottom to top)
- Apply transforms (position, scale, rotation, crop)
- Apply filters (chroma key, color correction)
- Composite to output canvas
- Send to encoder

### 1.3 Encoder Pipeline

**FFmpeg Integration:**
- Reuse existing `ffmpeg-the-third` bindings
- Hardware acceleration detection (NVENC, QSV, VideoToolbox, AMF)
- Quality presets (Low, Medium, High, Ultra)

**Encoding Settings:**
- Resolution: 1920x1080, 1280x720, 3840x2160
- Framerate: 30fps, 60fps
- Bitrate: 2500-6000 kbps (configurable)
- Codec: H.264 (hardware if available, software fallback)
- Audio: AAC 128-320 kbps

**Output Formats:**
- RTMP (for streaming)
- MP4 (for recording)
- HLS (for auto-detection during streaming)

## Phase 2: Frontend UI

### 2.1 Studio Pages

**New Pages:**
- `client/src/pages/StudioStream.vue` - Streaming interface
- `client/src/pages/StudioRecord.vue` - Recording interface

**Shared Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Top Bar: [Scene Selector] [Start/Stop] [Settings]  │
├──────────────────┬──────────────────────────────────┤
│                  │                                  │
│  Scene List      │     Preview Canvas               │
│  Source List     │     (Live Output)                │
│  (Left Panel)    │                                  │
│                  │                                  │
├──────────────────┴──────────────────────────────────┤
│ Bottom Bar: [Audio Mixer] [Stats] [Recording Time] │
└─────────────────────────────────────────────────────┘
```

**Components:**
- `client/src/components/studio/SceneManager.vue` - Scene list + controls
- `client/src/components/studio/SourcePanel.vue` - Source list + add source
- `client/src/components/studio/PreviewCanvas.vue` - Live preview
- `client/src/components/studio/ControlBar.vue` - Start/stop controls
- `client/src/components/studio/SettingsPanel.vue` - Encoder settings
- `client/src/components/studio/RtmpDestinations.vue` - RTMP destination management
- `client/src/components/studio/SourceProperties.vue` - Source transform controls

### 2.2 Scene Management

**Composables:**
- `client/src/composables/studio/useSceneManager.ts`
  - `scenes` - Reactive scene list
  - `activeScene` - Current scene
  - `createScene()`, `deleteScene()`, `switchScene()`
  - `addSourceToScene()`, `removeSourceFromScene()`
  - `updateSourceTransform()`

**Scene Switching & Transitions:**

**How OBS Does It:**
- OBS has a global transition setting (applies to all scene switches)
- Users can override per-scene with custom transitions
- Transition types: Cut (instant), Fade, Swipe, Slide, Stinger (video overlay)
- Transition duration configurable (100ms - 3000ms)
- Studio Mode: Preview next scene before transitioning

**Clippster Implementation:**
- **User-Selectable Transitions** (Settings Panel)
  - Transition Type dropdown: Cut, Fade, Slide Left, Slide Right, Slide Up, Slide Down
  - Duration slider: 100ms - 2000ms
  - Per-scene override option (advanced)
  
- **Transition Rendering:**
  - **Cut**: Instant switch (no compositor work)
  - **Fade**: Crossfade between scenes using opacity
    - Render both scenes simultaneously
    - Fade out old scene (opacity 1.0 → 0.0)
    - Fade in new scene (opacity 0.0 → 1.0)
    - Linear interpolation over transition duration
  - **Slide**: Translate position of both scenes
    - Old scene slides out (position 0 → -width/height)
    - New scene slides in (position width/height → 0)
    - Easing function for smooth motion

- **Implementation Details:**
  - Compositor handles transition rendering
  - During transition: composite both scenes with transform/opacity
  - After transition: switch to new scene only
  - Hotkey support via `tauri-plugin-global-shortcut`
  - Scene preview thumbnails

### 2.3 Multi-Source Scene Composition

**Core Concept:**
- Each scene can contain **unlimited sources**
- Sources are **layered** (z-index ordering)
- Each source has **independent transform controls**
- **Drag-and-drop** positioning in preview canvas
- **Real-time preview** of all changes

**Source Types:**
1. **Screen Capture** - Select from available displays (full screen or specific monitor)
2. **Window Capture** - Select from running windows (e.g., game window)
3. **Camera** - Select from webcams (e.g., facecam)
4. **Image** - Static image overlay (logos, graphics)
5. **Browser Source** - Embedded webpage (alerts, timers, widgets)
6. **Text** - Customizable text overlay (labels, countdowns)
7. **Audio Input** - Microphone
8. **Audio Output** - Desktop audio (game sound, music)
9. **Media File** - Video/audio files (intros, outros)
10. **Color Source** - Solid color background

**Transform Controls (Per Source):**
- **Position** (x, y) - Drag to move or enter exact coordinates
- **Size** (width, height) - Resize handles or enter dimensions
- **Scale** - Maintain aspect ratio or free transform
- **Rotation** - 0-360 degrees
- **Opacity** - 0-100% transparency
- **Crop** - Top, bottom, left, right pixel crop
- **Alignment** - Snap to edges, center, grid

**Layering & Ordering:**
- Sources render in **stack order** (bottom to top)
- Drag sources in list to reorder layers
- "Bring to Front" / "Send to Back" shortcuts
- Lock source to prevent accidental moves

**Common Use Cases:**

**Example 1: Gaming Stream**
```
Scene: "Gameplay"
├── Layer 1 (Bottom): Game Window Capture (1920x1080, fullscreen)
├── Layer 2: Webcam (320x240, bottom-right corner)
├── Layer 3: Logo Image (100x100, top-left corner)
└── Layer 4 (Top): Text "Twitch.tv/Username" (bottom-center)
```

**Example 2: Podcast/Interview**
```
Scene: "Two Hosts"
├── Layer 1 (Bottom): Color Source (background)
├── Layer 2: Host 1 Webcam (960x1080, left half)
├── Layer 3: Host 2 Webcam (960x1080, right half)
└── Layer 4 (Top): Podcast Logo (top-center)
```

**Example 3: Tutorial/Demo**
```
Scene: "Screen + Facecam"
├── Layer 1 (Bottom): Screen Capture (1920x1080, fullscreen)
└── Layer 2 (Top): Webcam (400x300, bottom-right, circular crop)
```

**Source Filters (Per Source):**
- **Chroma Key** (green screen removal)
- **Color Correction** (brightness, contrast, saturation, hue)
- **Blur** - Gaussian blur
- **Sharpen** - Edge enhancement
- **Crop/Pad** - Advanced cropping
- **Scaling Filter** - Bilinear, Bicubic, Lanczos (quality vs performance)

### 2.4 Preview Canvas

**Implementation:**
- HTML5 `<canvas>` element
- WebSocket connection to Rust compositor
- Receive JPEG/PNG frames at 30fps
- Display composited output in real-time
- Overlay: FPS, bitrate, recording time

**Interaction:**
- Click to select source
- Drag to move source
- Resize handles to scale source
- Right-click for context menu (properties, filters, delete)

## Phase 3: Multi-Destination Streaming (Stream Studio)

### 3.1 RTMP Multi-Streaming

**Architecture:**
- Single encode, multiple outputs
- Spawn separate FFmpeg process per destination
- Share encoded stream via pipe/memory
- Monitor connection status per destination
- Auto-reconnect on failure

**Frontend:**
- Show connection status per destination
- Display bitrate, dropped frames
- Enable/disable destinations on the fly

### 3.2 Stream Studio Recording (WITH Segments for Auto-Detection)

**Key Difference from Recording Studio:**
- **Stream Studio CAN record while streaming** with HLS segments for auto-detection
- **Recording Studio does NOT use segments** - just a single file

**Stream Studio Recording:**
- **HLS Segments** (for auto-detection during stream)
  - User-configurable segment length (e.g., 5 minutes, 10 minutes)
  - Saved to `recordings/{session_id}/segments/`
  - Allows auto-detection DURING the stream
  - Reuses existing `hls.rs` infrastructure
- **Final MP4** (for upload/editing)
  - After stream ends, remux segments to single MP4
  - Saved to `recordings/{session_id}/recording.mp4`
  - Appears in VOD Library (Projects page)

**Workflow:**
1. User starts streaming in Stream Studio
2. Optionally enables "Record" toggle
3. Stream goes to RTMP destinations + HLS segments saved locally
4. User can run auto-detection on segments DURING stream
5. Stream ends → Segments remuxed to single MP4
6. MP4 appears in VOD Library

## Phase 4: Local Recording (Recording Studio)

### 4.1 Recording Output - Single File Strategy

**Key Difference from Streaming:**
- **NO SEGMENTS** - Recording Studio creates a single continuous recording
- **NO auto-detection during recording** - Users run auto-detection AFTER recording completes
- **Simple workflow** - Record → Save as Project → Use like any downloaded VOD

**How OBS Does It:**
- OBS records to **Fragmented MP4** (or MKV) during live recording for crash resilience
- Uses FFmpeg flags: `-movflags frag_keyframe+empty_moov+default_base_moof`
- Fragmented MP4 writes self-contained chunks but in a single file
- After recording stops, OBS can **remux** to standard MP4 for maximum compatibility
- Remuxing is instant (stream copy, no re-encoding) - just reorganizes the container

**Clippster Recording Studio Approach:**

**During Recording:**
1. **Fragmented MP4** (crash-resistant single file)
   - FFmpeg flags: `-movflags frag_keyframe+empty_moov+default_base_moof`
   - Saved to `recordings/{session_id}/recording.fmp4`
   - Crash-resistant (fragments are self-contained)
   - **No HLS segments** - just one continuous file

**After Recording Stops:**
2. **Automatic Remux to Standard MP4**
   - Fast remux (like existing `remux_with_faststart` in `downloads.rs`)
   - Adds `-movflags +faststart` for web compatibility
   - Output: `recordings/{session_id}/recording.mp4`
   - Delete fragmented MP4 after successful remux
   - Takes 5-15 seconds even for 2+ hour recordings

**Why This Works:**
- ✅ Single MP4 file (no segments to manage)
- ✅ Upload-ready (YouTube, TikTok, Twitter, etc.)
- ✅ Works in video editor (OpenCut port)
- ✅ Crash-resistant during recording (fragmented MP4)
- ✅ No re-encoding (fast remux)
- ✅ Treated exactly like downloaded VODs

**Database Integration:**
- Auto-create project in `projects` table when recording stops
- Store final MP4 path in `file_path` column
- Set `source` = 'studio_recording'
- Set `platform` = 'local'
- Recording appears in VOD Library (Projects page)

### 4.2 Post-Recording Workflow

**After Recording Completes:**
1. Recording stops → Auto-remux to MP4
2. **Project created** in VOD Library (Projects page)
3. User can then:
   - **Run auto-detection** (same as downloaded VODs)
   - **Download** the recording
   - **Upload to YouTube/Twitter** directly
   - **Open in Video Editor** for manual editing
   - **Delete** if not needed

**No Auto-Detection During Recording:**
- Recording Studio is for **simple recording only**
- Auto-detection runs **after** recording completes
- User selects segment length when running auto-detection (just like downloaded VODs)
- Reuses existing auto-detection infrastructure

**Seamless Integration:**
- Recording treated exactly like a downloaded VOD
- All existing VOD features work (auto-detect, edit, upload, download)
- No special handling needed in frontend

## Phase 5: Advanced Features

### 5.1 Browser Sources

**Implementation:**
- Embed Chromium via `tauri-plugin-webview`
- Capture webpage as video source
- Use cases: Stream alerts, chat overlays, timers

### 5.2 Chroma Key (Green Screen)

**Implementation:**
- Color-based keying algorithm
- Adjustable threshold, spill suppression
- Apply to camera sources

### 5.3 Audio Mixing

**Multi-Track Audio:**
- Desktop audio (game/music)
- Microphone input
- Per-source volume control
- Audio filters: Noise suppression, compressor

**Audio Monitoring (Optional):**
- **How OBS Does It:**
  - Users can enable "Monitor and Output" on audio sources
  - Hear their own audio through speakers/headphones while streaming
  - Separate volume control for monitoring vs output
  - Prevents feedback loops with proper routing

- **Clippster Implementation:**
  - Toggle per audio source: "Monitor Off", "Monitor Only", "Monitor and Output"
  - Monitoring volume slider (independent from output volume)
  - Audio routing through system audio API (`cpal`)
  - Default: Monitor Off (to avoid confusion/feedback)
  - Settings panel checkbox: "Enable Audio Monitoring"

### 5.4 Hotkeys

**Global Shortcuts:**
- Scene switching (F1-F12)
- Start/stop streaming (Ctrl+Shift+S)
- Start/stop recording (Ctrl+Shift+R)
- Mute microphone (Ctrl+Shift+M)

**Implementation:**
- Use `tauri-plugin-global-shortcut`
- Configurable in settings

## Integration with Existing Features

### Auto-Detection

**Stream Studio (WITH Auto-Detection During Stream):**
1. User starts streaming with "Record" enabled
2. HLS segments saved locally (user-configurable length)
3. User clicks "Auto-Detect" button in Stream Studio
4. Opens LiveClip-style interface
5. Segments processed in real-time
6. Detected clips appear in Clips page

**Recording Studio (Auto-Detection AFTER Recording):**
1. User records video in Recording Studio
2. Recording saved as single MP4 in VOD Library
3. User navigates to Projects page
4. Clicks "Auto-Detect" on the recording (same as downloaded VODs)
5. User selects segment length for processing
6. Segments created on-the-fly for detection
7. Detected clips appear in Clips page

### VOD Library Integration

**Projects Page:**
- Studio recordings appear alongside downloaded VODs
- Same UI/UX for managing recordings
- Filter by source: "Studio Recording"

**Actions Available:**
- Download (save to disk)
- Upload to YouTube/Twitter
- Open in Video Editor
- Run Auto-Detection
- Delete

## Database Schema

```sql
-- Scenes
CREATE TABLE studio_scenes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Sources in scenes
CREATE TABLE studio_scene_sources (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'screen', 'window', 'camera', 'image', etc.
  source_config TEXT NOT NULL, -- JSON config
  transform TEXT NOT NULL, -- JSON transform data
  filters TEXT, -- JSON filters array
  z_index INTEGER NOT NULL,
  visible INTEGER DEFAULT 1,
  locked INTEGER DEFAULT 0,
  FOREIGN KEY (scene_id) REFERENCES studio_scenes(id) ON DELETE CASCADE
);

-- RTMP Destinations
CREATE TABLE rtmp_destinations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  server_url TEXT NOT NULL,
  stream_key TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- Studio Recordings (links to projects table)
CREATE TABLE studio_recordings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_start INTEGER NOT NULL,
  session_end INTEGER,
  scene_changes TEXT, -- JSON array of scene change timestamps
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

## Dependencies

**Rust Crates (add to `client/src-tauri/Cargo.toml`):**

```toml
[dependencies]
# Already have:
# - ffmpeg-the-third (FFmpeg bindings)
# - nokhwa (camera capture)
# - cpal (audio capture)
# - tauri-plugin-sql (database)

# New dependencies for core streaming:
scrap = "0.5"              # Screen capture
screenshots = "0.6"        # Cross-platform screenshots

# Advanced features:
vosk = "0.3"               # Offline speech recognition (voice-activated markers)
ndi = "0.2"                # NDI SDK bindings (Network Device Interface)
ringbuf = "0.3"            # Ring buffer for replay buffer
dasp = "0.11"              # Digital audio signal processing (audio filters)
```

**Frontend Packages:**
```json
{
  "dependencies": {
    // Already have all needed dependencies
  }
}
```

## Implementation Order

**Parallel Development Strategy:**

### Track A: Core Foundation (Both Stream & Record)
1. **Phase 1.1** - Source capture (screen, camera, audio) - 3-4 days
2. **Phase 1.2** - Compositor (scene graph, mixing, transitions) - 4-5 days
3. **Phase 2** - Frontend UI (pages, components, shared) - 4-5 days

### Track B: Streaming Features (Parallel with Track C)
4. **Phase 1.3a** - Encoder & RTMP output - 2-3 days
5. **Phase 3** - RTMP multi-streaming - 2 days

### Track C: Recording Features (Parallel with Track B)
4. **Phase 1.3b** - Dual-format recording (HLS + Fragmented MP4) - 2-3 days
5. **Phase 4** - Auto-detection integration + MP4 remux - 2 days

### Track D: Advanced Features (After A, B, C)
6. **Phase 5** - Core advanced features - 4-5 days
   - Replay buffer (ring buffer implementation)
   - Virtual camera output (platform-specific drivers)
   - Stream delay (frame/audio buffering)
   - Advanced audio filters (noise suppression, gate, compressor, EQ)

7. **Phase 6** - Pro features - 3-4 days
   - NDI support (send/receive)
   - Multi-track recording
   - Stream analytics dashboard
   - Voice-activated clip markers (vosk-rs integration)

8. **Phase 7** - Settings & Templates - 2-3 days
   - Stream templates/presets (save/load/share)
   - Scene transitions (user-selectable)
   - Quality presets
   - Hotkey configuration

9. **Phase 8** - Testing & polish - 2-3 days

### Track E: Remote Guest Collaboration (Optional Future Phase)
10. **Phase 9** - Remote guest system (WebRTC-based) - 5-7 days

**Total Estimate: 33-44 days** (with parallel work reducing calendar time to ~26-34 days)
**With Remote Guests: 38-51 days**

## Phase 8: Remote Guest Collaboration (Future Enhancement)

### 8.1 Overview - StreamLabs Collab Cam Approach

**How StreamLabs Does It:**
- **Browser-based guest joining** - No software installation required
- **Link-based invitations** - Generate unique link, send via DM/email
- **WebRTC peer-to-peer** - Low latency video/audio streaming
- **Host approval system** - Guest requests to join, host approves before showing on stream
- **Multi-guest support** - Up to 11 guests (1 free, 11 with Ultra subscription)
- **Platform agnostic** - Guests join from PC, Mac, or mobile browser
- **Security features** - Link regeneration, hide/disconnect guests on the fly

**Competitive Landscape:**
- **VDO.Ninja (OBS.Ninja)** - Free, open-source, WebRTC-based remote guests
- **StreamYard** - Browser-based studio with built-in guest management
- **Restream Studio** - Cloud-based with remote guest support
- **Riverside.fm** - High-quality local recording per participant

### 8.2 Architecture - WebRTC Guest System

**Backend (Rust/Tauri):**
- **Signaling Server** (Elixir/Phoenix)
  - WebSocket-based signaling for WebRTC handshake
  - Room management (session ID = room)
  - Guest authentication via unique tokens
  - Host controls (approve, hide, disconnect guests)

**Frontend (Vue):**
- **Host Interface** (`StudioStream.vue`, `StudioRecord.vue`)
  - "Add Remote Guest" button → generates invite link
  - Guest preview panel (shows pending/connected guests)
  - Per-guest controls: Show/Hide, Volume, Disconnect
  - Guest video/audio feeds as compositor sources

- **Guest Interface** (Standalone page `/studio/guest/:token`)
  - Browser-based (no app installation)
  - Device selection (camera, microphone, speakers)
  - Name input
  - "Join" button → WebRTC connection to host
  - Minimal UI (just camera preview + connection status)

**WebRTC Implementation:**
```typescript
// Use simple-peer or native RTCPeerConnection
// Guest → Signaling Server → Host
// 1. Guest requests to join (sends offer)
// 2. Host receives notification
// 3. Host approves → sends answer
// 4. WebRTC peer connection established
// 5. Guest video/audio streams to host
```

### 8.3 Guest Workflow

**Host Side:**
1. Click "Add Remote Guest" in Studio
2. System generates unique invite link: `https://clippster.app/studio/guest/{token}`
3. Copy link, send to guest via Discord/email/DM
4. Guest joins → Host receives notification with preview
5. Host clicks "Show on Stream" → Guest video appears in compositor
6. Host can adjust guest position, scale, volume
7. Host can hide or disconnect guest at any time

**Guest Side:**
1. Click invite link → Opens in browser
2. Enter name, select camera/microphone
3. Click "Join"
4. Wait for host approval
5. Once approved, camera/mic streams to host
6. Guest sees "Connected - You're live!" message
7. Guest can mute/unmute themselves

### 8.4 Security & Privacy

**Link Security:**
- Unique token per guest (UUID)
- Token expires after session ends
- "Generate New Link" button invalidates old token
- Don't show link on stream (prevents random joins)

**Host Controls:**
- Approve before showing guest on stream
- Hide guest video/audio without disconnecting
- Disconnect guest (kicks from session)
- Mute guest audio (host-side)

**Guest Privacy:**
- Guest controls own camera/mic mute
- Guest can leave session at any time
- No recording on guest side (only host records)

### 8.5 Technical Implementation

**New Files:**

**Backend (Elixir/Phoenix):**
- `server/lib/clippster_server_web/channels/studio_channel.ex` - WebRTC signaling
- `server/lib/clippster_server/studio/guest_session.ex` - Guest session management
- `server/lib/clippster_server_web/controllers/studio_guest_controller.ex` - Guest token generation

**Frontend (Vue):**
- `client/src/pages/StudioGuest.vue` - Guest join page
- `client/src/components/studio/GuestPanel.vue` - Host guest management UI
- `client/src/composables/studio/useRemoteGuests.ts` - WebRTC connection management
- `client/src/composables/studio/useGuestSignaling.ts` - Phoenix channel signaling

**Database Schema:**
```sql
CREATE TABLE studio_guest_sessions (
  id TEXT PRIMARY KEY,
  host_user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  guest_token TEXT UNIQUE NOT NULL,
  guest_name TEXT,
  status TEXT NOT NULL, -- 'pending', 'connected', 'disconnected'
  created_at INTEGER NOT NULL,
  connected_at INTEGER,
  disconnected_at INTEGER,
  FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 8.6 Compositor Integration

**Guest as Source:**
- Each connected guest = new video source in compositor
- Guest audio mixed into final audio output
- Host can position/scale guest video like any other source
- Guest video appears in scene alongside screen capture, camera, etc.

**Multi-Guest Layout:**
- Grid layout (2x2, 3x3)
- Side-by-side
- Picture-in-picture
- Custom positioning

### 8.7 Bandwidth & Quality

**Adaptive Bitrate:**
- Start at 720p30 for guests
- Downgrade to 480p if bandwidth limited
- Audio: 64-128 kbps Opus

**Network Requirements:**
- Host upload: 2-5 Mbps per guest
- Guest upload: 1-3 Mbps
- Guest download: 100-500 kbps (for monitoring)

### 8.8 Limitations & Future Enhancements

**Initial Limitations:**
- Max 4 guests (free), 11 guests (paid tier)
- Browser-based only (no mobile app)
- No guest-side recording (ISO tracks)
- No screen sharing from guests

**Future Enhancements:**
- Guest screen sharing
- ISO recording (separate track per guest)
- Virtual backgrounds for guests
- Guest-side effects/filters
- Mobile app for guests
- SFU (Selective Forwarding Unit) for scaling beyond 11 guests

## Advanced Features (All Included)

Based on professional streaming software capabilities, the following features will be implemented:

### 1. **Replay Buffer** (Like OBS)
- Continuously buffer last 30-60 seconds of stream
- Hotkey to save buffer as clip
- Instant clip creation without stopping stream
- Perfect for "did you see that?!" moments
- **Implementation**: Ring buffer in memory, save to disk on hotkey

### 2. **Virtual Camera Output**
- Output studio composition as virtual webcam
- Use Clippster in Zoom, Discord, Google Meet, etc.
- **Implementation**: Virtual camera driver (Windows: obs-virtualcam, macOS: CoreMediaIO)

### 3. **Stream Delay**
- Configurable delay (0-60 seconds)
- Allows time to censor/cut content before it goes live
- **Implementation**: Buffer frames/audio before sending to RTMP

### 4. **Advanced Audio Filters**
- Noise suppression (RNNoise)
- Noise gate
- Compressor
- EQ (equalizer)
- **Implementation**: Audio processing pipeline using `cpal` + DSP libraries

### 5. **NDI Support**
- Network Device Interface for pro video workflows
- Send/receive video over local network
- Use Clippster as NDI source or receive NDI sources
- **Implementation**: NDI SDK integration

### 6. **Multi-Track Recording**
- Record each audio source to separate track
- Allows post-production mixing
- **Implementation**: Multiple audio outputs in FFmpeg

### 7. **Stream Analytics Dashboard**
- Real-time viewer count (if platform API available)
- Bitrate graph
- Dropped frames
- CPU/GPU usage
- Stream health score
- **Implementation**: Stats collection + Vue dashboard

### 8. **Voice-Activated Clip Markers**
- **Voice commands** for hands-free clip creation during stream/recording
- **"Clip this"** → Create 3-minute clip from current point **forward**
  - Marks timestamp, continues recording for 3 minutes
  - Auto-saves clip after 3 minutes
- **"Clip that"** → Create 3-minute clip from current point **backward**
  - Uses replay buffer (last 3 minutes)
  - Instantly saves clip from buffer
- **Manual hotkey markers** - Press hotkey to mark moment
- **Post-stream processing** - Auto-create clips at all markers
- **Implementation**:
  - Voice recognition using `vosk-rs` (offline speech recognition)
  - Keyword detection for "clip this" and "clip that"
  - Ring buffer for backward clips (requires Replay Buffer feature)
  - Timestamp array with marker type (forward/backward/manual)
  - Post-stream clip generation from markers

**Voice Recognition Setup:**
- Lightweight offline model (no internet required)
- Runs in background thread
- Low CPU overhead (~2-5%)
- Configurable activation threshold
- Optional push-to-talk mode

### 9. **Stream Templates/Presets**
- Save entire studio setup (scenes, sources, settings)
- Quick load for different stream types
- Share templates with community
- **Implementation**: JSON export/import of studio config

**Note:** Chat integration (#10) is **excluded** as it requires platform-specific APIs (Twitch, YouTube, Kick) which we want to avoid.

## Design Decisions (Confirmed)

1. **Scene Transitions**: ✅ User-selectable (Cut, Fade, Slide variants) with configurable duration
   - Based on OBS implementation
   - Global setting with per-scene override option
   - Compositor handles transition rendering

2. **Recording Format**: ✅ Different strategies for Stream Studio vs Recording Studio
   - **Stream Studio**: HLS segments (user-configurable length) for auto-detection during stream + final MP4
   - **Recording Studio**: Single fragmented MP4 → remux to standard MP4 (no segments)
   - Auto-remux to standard MP4 after recording (upload-ready)

3. **Audio Monitoring**: ✅ Optional feature
   - Per-source toggle: Monitor Off, Monitor Only, Monitor and Output
   - Independent monitoring volume control
   - Default: Off (to avoid confusion)

4. **Development Approach**: ✅ Parallel implementation
   - Core foundation first (sources, compositor, UI)
   - Streaming and recording features in parallel
   - Advanced features and polish last

5. **Future Enhancements** (Not in Initial Scope):
   - Virtual Camera output
   - Cloud recording uploads
   - Embedded browser sources (start with window capture)
   - Stinger transitions (video overlay transitions)

## Success Criteria

- ✅ Users can capture screen + webcam simultaneously
- ✅ Users can stream to Twitch/YouTube/Kick via RTMP
- ✅ Users can stream to multiple destinations at once
- ✅ Users can record locally without streaming
- ✅ Recordings appear in Projects page for auto-detection
- ✅ Scene switching works with hotkeys
- ✅ Hardware encoding works on NVIDIA/AMD/Intel
- ✅ Chroma key (green screen) works
- ✅ Audio mixing with multiple sources
- ✅ Browser sources for overlays
- ✅ All 9 advanced features implemented (replay buffer, virtual camera, stream delay, audio filters, NDI, multi-track, analytics, voice markers, templates)
