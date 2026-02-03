# Potential Editor Overhaul

Build a CapCut-style professional video editor for the Clippster desktop app using WebCodecs for hardware-accelerated playback, proxy workflows for smooth editing, and FFmpeg for export.

---

## Research Summary

**Date**: February 2026  
**Sources Consulted**: 15+ web sources including Chrome DevRel, MDN, Remotion, Bilibili, and GitHub

### Key Findings

1. **WebCodecs API** is the industry-standard solution for hardware-accelerated video playback in browsers
   - Uses native GPU decoders (NVDEC/VideoToolbox/VAAPI)
   - 10-100x faster than software decoding
   - Supported in all major browsers (Chrome, Edge, Firefox, Safari)

2. **Multi-format demuxing** requires a dedicated library
   - **web-demuxer** (Bilibili): Supports mov/mp4/mkv/webm/flv/avi/ts - WebCodecs-first design
   - **MP4Box.js**: MP4-only but mature and widely used

3. **Proxy workflow** is essential for professional editing
   - Edit with 720p H.264 proxies for instant playback
   - Export with original 1080p/4K sources via FFmpeg
   - CapCut and all major editors use this pattern

4. **Timeline architecture** should use:
   - Multi-track model (video, audio, text, stickers, effects)
   - Command pattern for undo/redo
   - Canvas rendering for video + DOM overlays for text/UI

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vue 3 Frontend                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Editor    │  │  Timeline   │  │       Inspector         │ │
│  │   Preview   │  │  Component  │  │       Panels            │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
│         │                │                      │               │
│  ┌──────┴────────────────┴──────────────────────┴─────────────┐│
│  │              Unified State Management (Pinia)              ││
│  │  - Timeline state    - Playback state    - Selection       ││
│  │  - Command history   - Tracks/items      - Project data    ││
│  └────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                      Playback Engine                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  web-demuxer (WASM) → WebCodecs VideoDecoder → Canvas      ││
│  │  - Multi-format demux   - GPU decode        - 60fps render ││
│  │  - Frame-level access   - Hardware accel    - Overlays     ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                      Tauri Backend (Rust)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │ Proxy Gen    │  │ FFmpeg       │  │ File I/O & Storage     ││
│  │ (FFmpeg)     │  │ Export       │  │ (SQLite)               ││
│  └──────────────┘  └──────────────┘  └────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Playback Engine (Week 1-2)

**Goal**: Hardware-accelerated video playback with proxy workflow

#### 1.1 WebCodecs Playback Engine
```typescript
// New composable: useWebCodecsEngine.ts
interface WebCodecsEngine {
  // Core playback
  load(proxyUrl: string): Promise<void>
  play(): void
  pause(): void
  seek(timeSeconds: number): void
  
  // State
  currentTime: Ref<number>
  duration: Ref<number>
  isPlaying: Ref<boolean>
  
  // Frame access
  getCurrentFrame(): VideoFrame | null
}
```

**Dependencies to add**:
```json
{
  "web-demuxer": "^1.x",
  "@aspect-ratio/resize-observer": "^1.x"
}
```

**Key implementation**:
- Use `web-demuxer` for multi-format demuxing (supports mp4/webm/mkv/avi/mov)
- Configure `VideoDecoder` with `hardwareAcceleration: 'prefer-hardware'`
- Frame buffer: Cache 150+ frames (~5 seconds at 30fps) for instant scrubbing
- RAF-driven render loop at 60fps

#### 1.2 Proxy Generation (Rust/FFmpeg)
```rust
// New Tauri command: generate_proxy
#[tauri::command]
async fn generate_proxy(
    source_path: String,
    output_path: String,
) -> Result<ProxyResult, String> {
    // Generate 720p H.264 proxy
    // -c:v libx264 -preset fast -crf 23 -vf scale=-2:720
}
```

**Proxy settings**:
- Resolution: 720p (scale=-2:720)
- Codec: H.264 (libx264)
- Preset: fast
- CRF: 23 (good balance of quality/size)

#### 1.3 Multi-Source Timeline Playback
- Track which source is active at current playhead position
- Pre-decode frames from upcoming sources during playback
- Handle transitions between sources without gaps

---

### Phase 2: Timeline Component (Week 2-3)

**Goal**: Professional timeline with multi-track editing

#### 2.1 Data Model
```typescript
// types/timeline.ts
interface TimelineProject {
  id: string
  name: string
  fps: number // 30
  resolution: { width: number; height: number } // 1080p
  duration: number
  tracks: Track[]
}

interface Track {
  id: string
  type: 'video' | 'audio' | 'text' | 'sticker' | 'effect'
  name: string
  items: TimelineItem[]
  locked: boolean
  visible: boolean
  muted: boolean // audio tracks
}

interface TimelineItem {
  id: string
  trackId: string
  startTime: number // timeline position
  duration: number
  type: ItemType
  
  // Source reference (for video/audio)
  sourceId?: string
  sourceStart?: number // trim start in source
  sourceEnd?: number // trim end in source
  
  // Properties (varies by type)
  properties: ItemProperties
}

type ItemType = 
  | 'video-segment'
  | 'audio-segment' 
  | 'text-overlay'
  | 'sticker'
  | 'watermark'
  | 'transition'
  | 'effect'
```

#### 2.2 Timeline UI Components
```
components/video-editor/
├── VideoEditor.vue              # Main editor container
├── EditorPreview.vue            # Canvas + overlays
├── EditorTimeline.vue           # Timeline container
├── EditorToolbar.vue            # Tools (select, cut, etc.)
├── EditorInspector.vue          # Properties panel
├── timeline/
│   ├── TimelineTrack.vue        # Single track row
│   ├── TimelineItem.vue         # Item on track
│   ├── TimelineRuler.vue        # Time ruler
│   ├── TimelinePlayhead.vue     # Current position indicator
│   └── TimelineZoom.vue         # Zoom controls
└── inspector/
    ├── VideoInspector.vue       # Video properties
    ├── AudioInspector.vue       # Audio properties
    ├── TextInspector.vue        # Text styling
    └── EffectInspector.vue      # Effect parameters
```

#### 2.3 Drag & Drop Operations
- Drag items between tracks
- Resize items (change duration)
- Split items at playhead
- Snap to playhead, other items, markers
- Multi-select and group operations

---

### Phase 3: Command System & Undo/Redo (Week 3)

**Goal**: Full undo/redo support for all operations

#### 3.1 Command Pattern Implementation
```typescript
// commands/base.ts
interface Command {
  id: string
  type: string
  execute(): void
  undo(): void
  description: string
}

// commands/timeline-commands.ts
class AddItemCommand implements Command {
  constructor(private track: Track, private item: TimelineItem) {}
  execute() { this.track.items.push(this.item) }
  undo() { this.track.items = this.track.items.filter(i => i.id !== this.item.id) }
}

class MoveItemCommand implements Command {
  constructor(
    private item: TimelineItem,
    private fromTime: number,
    private toTime: number
  ) {}
  execute() { this.item.startTime = this.toTime }
  undo() { this.item.startTime = this.fromTime }
}

class SplitItemCommand implements Command { /* ... */ }
class DeleteItemCommand implements Command { /* ... */ }
class TrimItemCommand implements Command { /* ... */ }
```

#### 3.2 History Manager
```typescript
// stores/history.ts
const useHistoryStore = defineStore('history', {
  state: () => ({
    undoStack: [] as Command[],
    redoStack: [] as Command[],
    maxHistory: 100
  }),
  actions: {
    execute(command: Command) {
      command.execute()
      this.undoStack.push(command)
      this.redoStack = [] // Clear redo on new action
    },
    undo() { /* ... */ },
    redo() { /* ... */ }
  }
})
```

---

### Phase 4: Media Import & Asset Management (Week 3-4)

**Goal**: Import videos, images, audio from various sources

#### 4.1 Import Sources
- **Local files**: Video (mp4/webm/mov/avi), Images (png/jpg/gif), Audio (mp3/wav/aac)
- **AI-detected clips**: From existing clip detection system
- **Uploaded videos**: User uploads to media library

#### 4.2 Media Library Store
```typescript
// stores/media-library.ts
interface MediaAsset {
  id: string
  type: 'video' | 'image' | 'audio'
  name: string
  path: string           // Original file
  proxyPath?: string     // 720p proxy (video only)
  thumbnail?: string     // Preview image
  duration?: number      // Video/audio
  metadata: MediaMetadata
}

const useMediaLibraryStore = defineStore('media-library', {
  state: () => ({
    assets: Map<string, MediaAsset>()
  }),
  actions: {
    async importFile(path: string): Promise<MediaAsset> { /* ... */ },
    async generateProxy(assetId: string): Promise<void> { /* ... */ },
    async importClip(clipId: string): Promise<MediaAsset> { /* ... */ }
  }
})
```

---

### Phase 5: Overlays & Effects (Week 4-5)

**Goal**: Text, stickers, watermarks, filters, transitions

#### 5.1 Text Overlays
- Rich text editing (font, size, color, alignment)
- Animations (fade in/out, typewriter, bounce)
- Positioning and scaling
- Render via DOM for preview, SVG/canvas for export

#### 5.2 Visual Effects
```typescript
type EffectType =
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'blur'
  | 'vignette'
  | 'color-correction'
  | 'speed-ramp'

interface Effect {
  type: EffectType
  startTime: number
  endTime: number
  parameters: Record<string, number>
  keyframes?: Keyframe[]
}
```

#### 5.3 Transitions
- Crossfade (default)
- Wipe (left/right/up/down)
- Slide
- Zoom
- Custom (via FFmpeg xfade filters)

---

### Phase 6: Audio Features (Week 5)

**Goal**: Audio mixing, waveforms, sync

#### 6.1 Audio Engine
- Web Audio API for playback mixing
- Multiple audio tracks support
- Volume control per track/item
- Fade in/out effects
- Audio ducking (lower music when voice present)

#### 6.2 Waveform Display
- Generate waveform data via Rust/FFmpeg
- Render on timeline canvas
- Zoom-responsive resolution

---

### Phase 7: Export Pipeline (Week 5-6)

**Goal**: High-quality FFmpeg export with all edits

#### 7.1 Export Configuration
```typescript
interface ExportSettings {
  resolution: '720p' | '1080p' | '4k'
  fps: 30 | 60
  codec: 'h264' | 'h265' | 'prores'
  quality: 'draft' | 'standard' | 'high'
  format: 'mp4' | 'mov' | 'webm'
}
```

#### 7.2 FFmpeg Filter Graph Generation
```rust
// Build complex filter graph from timeline
fn build_filter_graph(timeline: &Timeline) -> String {
    // 1. Video segments with trim/speed
    // 2. Transitions (xfade)
    // 3. Text overlays (drawtext/subtitles)
    // 4. Image overlays (overlay)
    // 5. Effects (eq, colorbalance, blur)
    // 6. Audio mixing (amix, adelay, afade)
}
```

#### 7.3 Export Progress
- Real-time progress via Tauri events
- Preview export (quick, lower quality)
- Final export (full quality)

---

## Technical Decisions

### Why WebCodecs over HTML5 Video?
| Feature | HTML5 Video | WebCodecs |
|---------|-------------|-----------|
| Multi-source | ❌ Black screen on switch | ✅ Seamless |
| Frame accuracy | ❌ ~100ms precision | ✅ Frame-perfect |
| Hardware accel | ⚠️ Limited control | ✅ Full control |
| Scrubbing | ❌ Stuttery | ✅ 60fps smooth |

### Why Proxy Workflow?
- **4K source @ 60fps** = 500+ MB/s decode bandwidth
- **720p H.264 proxy** = ~15 MB/s decode bandwidth
- **30x less** processing needed for preview
- Export uses original sources for full quality

### Why web-demuxer over MP4Box.js?
- Supports **all major formats** (mp4/webm/mkv/avi/mov/flv/ts)
- Designed specifically for **WebCodecs integration**
- Better handling of edge cases and metadata

---

## File Structure

```
client/src/
├── components/
│   └── video-editor/
│       ├── VideoEditor.vue
│       ├── EditorPreview.vue
│       ├── EditorTimeline.vue
│       ├── EditorToolbar.vue
│       ├── EditorInspector.vue
│       ├── EditorMediaPanel.vue
│       ├── timeline/
│       │   ├── TimelineTrack.vue
│       │   ├── TimelineItem.vue
│       │   ├── TimelineRuler.vue
│       │   └── TimelinePlayhead.vue
│       ├── inspector/
│       │   ├── VideoInspector.vue
│       │   ├── AudioInspector.vue
│       │   ├── TextInspector.vue
│       │   └── EffectInspector.vue
│       └── panels/
│           ├── MediaPanel.vue
│           ├── TextPanel.vue
│           ├── StickersPanel.vue
│           ├── EffectsPanel.vue
│           ├── TemplatesPanel.vue       # NEW: Template browser
│           └── SubtitlesPanel.vue       # NEW: Caption/subtitle editor
├── composables/
│   └── video-editor/
│       ├── useWebCodecsEngine.ts
│       ├── useTimelineState.ts
│       ├── useTimelineItems.ts
│       ├── usePlaybackControls.ts
│       ├── useAudioMixer.ts
│       ├── useOverlayRenderer.ts
│       ├── useTranscriptSubtitles.ts    # NEW: Load & render transcripts
│       ├── useTemplates.ts              # NEW: Template application
│       └── useExport.ts
├── stores/
│   ├── editor-project.ts
│   ├── editor-history.ts
│   └── media-library.ts
├── assets/
│   └── templates/                       # NEW: Pre-built templates
│       ├── text-styles.json
│       ├── transitions.json
│       ├── effects-presets.json
│       └── audio-effects.json
├── types/
│   └── video-editor/
│       ├── timeline.ts
│       ├── effects.ts
│       ├── templates.ts                 # NEW: Template type definitions
│       └── export.ts
└── commands/
    └── video-editor/
        ├── base.ts
        ├── item-commands.ts
        ├── track-commands.ts
        └── effect-commands.ts

client/src-tauri/src/
├── video_editor/
│   ├── mod.rs
│   ├── proxy.rs          # Proxy generation
│   ├── export.rs         # FFmpeg export
│   ├── waveform.rs       # Audio waveforms
│   └── filters.rs        # Filter graph building
```

---

## Dependencies

### Frontend (package.json)
```json
{
  "dependencies": {
    "web-demuxer": "^1.0.0",
    "mp4box": "^0.5.0" // Fallback for MP4
  }
}
```

### Backend (Cargo.toml)
```toml
# Already present:
# - tauri, tauri-plugin-shell (for FFmpeg sidecar)
# - serde, tokio, regex
# No new Rust dependencies needed
```

---

## Migration Notes

### From Existing Clip Editor
The current clip editor code in `components/clip-editor/` can be:
1. **Archived** to `components/clip-editor-legacy/`
2. **Selectively reused**:
   - Command pattern structure (`commands/`)
   - Inspector panel layouts
   - Some composables (formatters, zoom logic)
3. **Completely replaced**:
   - Playback engine (WebCodecs replaces current approach)
   - Timeline rendering (new track-based model)

---

## Success Criteria

- [ ] **Playback**: Instant play (< 16ms latency), smooth 60fps scrubbing
- [ ] **Multi-source**: Seamless transitions between different video files
- [ ] **Timeline**: Multi-track with drag-drop, split, trim operations
- [ ] **Undo/Redo**: Full history for all operations
- [ ] **Text**: Rich text overlays with animations
- [ ] **Effects**: Filters, transitions, speed changes (preview = export)
- [ ] **Subtitles**: Word-level captions from transcripts with custom fonts
- [ ] **Templates**: Pre-built text styles, transitions, effects presets
- [ ] **Export**: FFmpeg export with all edits + watermark + intro/outro
- [ ] **Cross-platform**: Works identically on Windows and macOS

---

## Estimated Timeline

| Phase | Description | Duration |
|-------|-------------|----------|
| 1 | Core Playback Engine (WebCodecs + Canvas) | 2 weeks |
| 2 | Timeline Component (multi-track) | 1.5 weeks |
| 3 | Command System (undo/redo) | 0.5 weeks |
| 4 | Media Import & Proxy Workflow | 1 week |
| 5 | Effects & Transitions (preview ↔ FFmpeg parity) | 1.5 weeks |
| 6 | Subtitles & Transcript Integration | 1 week |
| 7 | Templates Library | 1 week |
| 8 | Audio Features | 1 week |
| 9 | Export Pipeline (watermark, intro/outro) | 1 week |
| **Total** | | **10-11 weeks** |

---

## Creator Profile Integration (REQUIRED)

The video editor **must** integrate with the existing creator profile system. Clips opened from Projects.vue already come from projects that may have an assigned creator profile.

### Existing Data Flow (Preserve This)

```
Projects.vue
  └── Project has creator_profile_id
        └── CreatorProfile contains:
              - watermark_id (reference to watermark asset)
              - watermark_settings (JSON with per-ratio positioning)
              - intro_id (reference to IntroOutro asset)
              - outro_id (reference to IntroOutro asset)
        └── ClipEditorDialog receives:
              - creatorWatermarkId
              - creatorWatermarkSettings
              - creatorDefaultIntro
              - creatorDefaultOutro
```

### Required Behavior

#### 1. Watermark in Preview
- **Already implemented** in current `ClipEditorPreview.vue`
- Watermark shows as overlay during playback
- Respects per-aspect-ratio settings (16:9, 9:16, 1:1, 4:5)
- Supports both positioned watermarks and full-frame overlays
- **New editor must preserve this pattern**

#### 2. Watermark Burn on Export
- FFmpeg filter: `overlay=x:y` with opacity
- Position calculated from `WatermarkSettings.positionX/Y/scale`
- Per-ratio: Use correct watermark image for output aspect ratio
- Full-frame overlays: `overlay=0:0` at 100% scale

#### 3. Intro/Outro Burn on Export
```
[intro] → [main content] → [outro]
```
- Concat filter: `[intro][main][outro]concat=n=3:v=1:a=1`
- If no intro/outro: Skip those segments
- Intro/outro videos stored in `intro_outros` table with `file_path`

### Key Types (from `@/services/database/types.ts`)

```typescript
interface WatermarkSettings {
  enabled: boolean;
  watermarkId: string | null;
  positionX: number;  // 0-100 percentage
  positionY: number;  // 0-100 percentage
  scale: number;      // 0-100 percentage
  opacity: number;    // 0-100 percentage
  isFullFrameOverlay?: boolean;
  perRatioSettings?: CreatorWatermarkSettings | null;
}

interface CreatorWatermarkSettings {
  '16:9': CreatorWatermarkRatioConfig | null;
  '9:16': CreatorWatermarkRatioConfig | null;
  '1:1': CreatorWatermarkRatioConfig | null;
  '4:5': CreatorWatermarkRatioConfig | null;
}

interface IntroOutro {
  id: string;
  type: 'intro' | 'outro';
  name: string;
  file_path: string;
  duration: number | null;
}
```

### Export FFmpeg Filter Graph (with Creator Profile)

```
# 1. Prep intro (if exists)
[0:v]scale=1920:1080,setsar=1[intro_v]
[0:a]aformat=sample_rates=48000:channel_layouts=stereo[intro_a]

# 2. Main content with all edits + watermark overlay
[1:v]...<all video edits>...[main_edited]
[main_edited][watermark]overlay=x:y:format=auto,format=yuv420p[main_v]
[1:a]...<all audio edits>...[main_a]

# 3. Prep outro (if exists)
[2:v]scale=1920:1080,setsar=1[outro_v]
[2:a]aformat=sample_rates=48000:channel_layouts=stereo[outro_a]

# 4. Concat all
[intro_v][intro_a][main_v][main_a][outro_v][outro_a]concat=n=3:v=1:a=1[outv][outa]
```

---

## Final Design Decisions

### 1. Export Formats
- **Default by OS**: mp4 for Windows, mov for macOS
- **User can override**: Dropdown to select mp4/mov/webm
- **Codec**: H.264 for broad compatibility, hardware-accelerated encoding

### 2. Effects & Transitions
- **Critical Rule**: Every effect MUST work in both preview AND export
- **Implementation**: Map each effect to FFmpeg filter equivalent
- **No preview-only effects**: If FFmpeg can't do it, don't show it in preview

| Effect Type | Preview (Canvas/CSS) | Export (FFmpeg) |
|-------------|---------------------|-----------------|
| Color adjustment | CSS filters | `eq`, `colorbalance` |
| Blur | CSS `blur()` | `boxblur`, `gblur` |
| Transitions | Canvas animation | `xfade` filter |
| Speed change | Playback rate | `setpts`, `atempo` |
| Crop/zoom | Canvas transform | `crop`, `scale` |

### 3. Subtitles & Transcripts
- **Clips from Projects.vue**: Already have transcripts (via Whisper API)
- **Uploaded videos**: Generate transcript using existing `useChunkedClipDetection` flow
- **Word-level timing**: Use `transcript_segments` table (already has `start_time`, `end_time`, `text`)
- **Custom fonts**: User can upload .ttf/.otf fonts for subtitles and text overlays
- **Export**: FFmpeg `drawtext` filter with font embedding

### 4. Templates Library (v1)
Include pre-built templates like CapCut:

| Category | Examples |
|----------|----------|
| **Text styles** | Title cards, lower thirds, captions, social handles |
| **Transitions** | Swipe, zoom, fade, glitch, spin |
| **Effects presets** | Cinematic, vintage, VHS, neon, B&W |
| **Audio effects** | Bass boost, reverb, echo |

**Storage**: JSON definitions in `client/src/assets/templates/`

---

## Transcript Integration

Existing transcript system to leverage:

```typescript
// Database tables
transcripts: { id, raw_video_id, raw_json, text, language, duration }
transcript_segments: { id, transcript_id, start_time, end_time, text, segment_index }

// Key functions (services/database/transcripts.ts)
getTranscriptByRawVideoId(rawVideoId)
getTranscriptByProjectId(projectId)
getTranscriptSegments(transcriptId)

// For uploaded videos without transcript
useChunkedClipDetection() → Whisper API → transcript
```

### Subtitle Workflow in Editor

1. **Load**: Fetch transcript segments for clip's raw_video_id
2. **Display**: Render word-level captions synced to playback
3. **Style**: Apply user's font, size, color, position
4. **Export**: Generate FFmpeg `drawtext` filter chain with embedded font
