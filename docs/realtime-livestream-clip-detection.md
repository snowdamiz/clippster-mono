# Real-Time Livestream Clip Detection

Detect high-virality livestream moments within ~2 minutes of them happening using dual triggers (audio energy + keyword detection), Gemini video analysis, and auto-clip creation — all included in the standard 1 credit/minute stream cost. **Builds on top of the Enhanced Multimodal Clip Detection plan**, reusing its Gemini video detection, 480p extraction, transcript enrichment, keyword boosting, and signal fusion modules.

---

## Prerequisite: Enhanced Multimodal Plan

This plan assumes `enhanced-multimodal-clip-detection-69aaf5.md` is **already implemented**. The following components from that plan are reused here:

| Component (from Enhanced Multimodal) | How Real-Time Uses It |
|--------------------------------------|----------------------|
| `extract_video_chunk_for_analysis` (Rust) | Reused for 480p encoding of DVR extraction windows |
| `gemini_video_detection.ex` (Server) | Reused for Gemini Flash Pass 1 (visual spotter) on real-time windows |
| `transcript_enrichment.ex` (Server) | Reused for keyword boosting + speech rate on micro-transcripts |
| `signal_fusion.ex` (Server) | Reused for post-processing real-time clips (score boost, boundary snap) |
| `system_prompt.ex` (Server) | Already has signal instructions; add realtime-specific variant |
| `openrouter_api.ex` (Server) | Already has `generate_visual_annotations` for Gemini Flash |

**What this plan builds NEW** (not in enhanced multimodal):
- Browser-side live audio monitoring (`AnalyserNode` on LiveKit stream)
- DVR chunk concatenation for live extraction windows
- Rolling micro-transcription loop (15s Whisper calls)
- Real-time orchestration composable (dual triggers + adaptive window)
- Clip upgrade mechanism (real-time → full segment)
- Deduplication between real-time and segment-based clips
- `/clips/detect-realtime` endpoint (thin wrapper calling existing Gemini modules)
- `/clips/micro-transcribe` endpoint (Whisper-only, no LLM)

---

## Current Pipeline vs. Real-Time

| | Current (Segment-Based) | Real-Time |
|---|---------|-----------|
| **Trigger** | Segment finishes recording (5+ min) | Audio energy spike or keyword detected (~instant) |
| **Latency** | 6-7 minutes after moment | ~2 minutes after moment |
| **What's analyzed** | Full segment transcript + 7 local signals | Focused video + audio window via Gemini (reuses enhanced multimodal modules) |
| **Clip editing** | Full segment available immediately | Extracted window initially, upgraded to full segment when ready |
| **Extra cost** | — | None (included in 1 credit/min) |

---

## Credit Model

**No extra charge.** Real-time detection is included in the standard **1 credit per minute** that the user already pays for auto-detect livestream recording.

- User enables auto-detect → charged 1 credit/min for the duration of the stream
- Real-time detection runs automatically as part of that — no separate billing
- Credits are charged continuously while detection is active (stream running + auto-detect on)
- Stops charging when: stream ends, user stops detection, or credits run out
- The user sees: **"Auto-Detect: 1 credit/min"** — simple, predictable

**Why this works**: Real-time detection processes small windows (~2-5 min) that segment-based would have processed anyway. The API cost per trigger is ~$0.006 — negligible within our margins on 1 credit/min.

---

## Dual Trigger System

Real-time detection uses **two independent triggers** running simultaneously. Either one can fire the clip extraction pipeline:

### Trigger 1: Audio Energy Spike (Browser, Zero Cost)
Catches: **loud reactions, shouting, laughter, hype moments**

Tap into the LiveKit audio stream via Web Audio API:
```
LiveKit AudioTrack → AudioContext → AnalyserNode → RMS energy per second
```

- Rolling 120-second energy buffer, <1% CPU
- **Spike**: energy >6dB above rolling 30-second average
- **Sustained**: must last >3 seconds (filters single loud noises)
- **Cooldown**: 60 seconds between triggers

**Note**: This is a **live browser-side** `AnalyserNode`, different from the FFmpeg `astats` analysis in the enhanced multimodal plan (which runs on files). Both serve different purposes — `AnalyserNode` for real-time triggering, `astats` for post-hoc signal enrichment.

### Trigger 2: Rolling Micro-Transcription (Server, ~$0.14/3hr stream)
Catches: **"clip that", "W clip", "clip this", chat callouts, calm but important moments**

Every 15 seconds, extract last 20 seconds of audio from DVR chunks → send to server:
```
DVR audio chunks → extract last 20s → Whisper (~3-5s) → keyword scan
```

**Trigger keywords** (configurable, case-insensitive):
- `"clip that"`, `"clip this"`, `"clip it"`
- `"W clip"`, `"that's a clip"`, `"someone clip"`
- `"that was insane"`, `"oh my god"`, `"no way"`
- `"chat clip"`, `"clip the stream"`
- Custom keywords the user can add per streamer/prompt

**Reuses**: The keyword list overlaps with the `keyword_boosting` signal from `transcript_enrichment.ex` (enhanced multimodal). The micro-transcription endpoint uses the same keyword list, just applied to a 20-second window instead of a full chunk.

**Cost**: Whisper for 20s = ~$0.0002 per call. Every 15s for 3 hours = 720 calls = **~$0.14 total**. Well within the 1 credit/min margin.

### How Triggers Work Together

```
┌─────────────────────────────────────────────────┐
│ Trigger 1: Energy Spike                         │
│   Audio energy > threshold for > 3 seconds      │──┐
│   (loud reactions, shouting, laughter)           │  │
└─────────────────────────────────────────────────┘  │
                                                     ├──→ EITHER fires extraction
┌─────────────────────────────────────────────────┐  │
│ Trigger 2: Keyword Detection                    │  │
│   Micro-transcript contains trigger keyword     │──┘
│   ("clip that", "W clip", etc.)                 │
└─────────────────────────────────────────────────┘
```

If **both** triggers fire within 30 seconds of each other → merged into one extraction (higher confidence). If only one fires → still triggers extraction. The 85% virality threshold is Gemini's decision, not ours — Gemini sees the video and decides if it's actually clip-worthy.

---

## Adaptive Extraction Window

Once a trigger fires, the extraction window adapts to the moment's length:

```
Energy Timeline:
    ___          ___________________________
   |   |        |                           |
   |   |        |   SUSTAINED HIGH ENERGY   |
___|   |________|                           |_________
                ^                           ^
           trigger fires            energy drops back
           (start window)           (end window + 30s padding)
```

1. **Trigger fires** at timestamp T
2. **Start window** at T - 30s (context before the moment)
3. **Keep monitoring** — don't extract yet
4. **Energy drops** back below threshold OR 30s passes after keyword trigger with no energy spike
5. **Wait 30s** padding (capture aftermath/reaction)
6. **Close window** and extract

| Moment Length | Extraction Window | Notes |
|---------------|-------------------|-------|
| 10 seconds | ~70s (30 pre + 10 + 30 post) | Quick reaction/highlight |
| 1 minute | ~2 min (30 pre + 60 + 30 post) | Standard viral moment |
| 2 minutes | ~3 min (30 pre + 120 + 30 post) | Extended rant/sequence |
| 5 minutes | 5 min (capped) | Max window, segment-based handles the rest |

For **keyword-only triggers** (no energy spike — e.g., streamer calmly says "clip that"): extract a fixed 90-second window (30s before + 60s after the keyword timestamp).

---

## Extraction + Detection Pipeline

### Step 1: DVR Extraction (Rust/FFmpeg, ~10 seconds)
When the extraction window closes:

- Grab relevant DVR chunks (4-second WebM files already on disk)
- FFmpeg concat → single file
- **Reuse** `extract_video_chunk_for_analysis` (from enhanced multimodal) for 480p encoding
- Extract audio separately for Whisper
- Return: `{ videoPath, video480pBase64, audioBase64, startTime, endTime }`

The only new Rust code is the **DVR chunk concatenation** — finding and joining the right 4-second WebM files by timestamp. The 480p encoding reuses the existing command.

### Step 2: Server Detection (Server, ~45 seconds)
Send to `/clips/detect-realtime` endpoint, which internally:

1. **Whisper transcription** of full window (~15s) — same as existing segment-based
2. **Transcript enrichment** — **reuses** `transcript_enrichment.ex` (keyword boosting, speech rate, silence→spike)
3. **Gemini Flash** — **reuses** `gemini_video_detection.ex` Pass 1 (visual spotter):
   - `video_url`: base64 480p MP4
   - `text`: enriched transcript + trigger context ("keyword 'clip that' at 0:42" or "energy spike at 0:32, sustained 8s")
4. **Signal fusion** — **reuses** `signal_fusion.ex` for score boosting and boundary snapping
5. Returns clips with virality scores

**Keyword triggers get a boost**: If the trigger was a keyword ("clip that"), Gemini is told the streamer explicitly requested a clip. This biases the virality score upward.

### Step 3: Instant Clip Creation (Client)
If Gemini returns a clip with **virality score ≥ 85%**:

1. **Auto-create clip** in the project database (same as segment-based clips)
2. **Generate thumbnail** at the clip's midpoint
3. **Show toast**: "⚡ Viral moment detected! [clip title]"
4. **Clip appears** in the clips panel immediately with an "⚡ Instant" badge
5. If virality < 85%: discard — segment-based will catch it later if worthy

---

## Clip Editing & Duration Extension

### The Problem
Real-time clips initially reference a small extracted file (e.g., 2-3 minutes). The user can't extend the clip beyond that file's boundaries. But with segment-based clips, the user can extend within the full 5+ minute segment.

### The Solution: Automatic Clip Upgrade

When the full segment finishes recording (the normal 5-min segment that covers the same time window), the real-time clip is **silently upgraded**:

```
IMMEDIATELY (real-time):
  Clip → references extracted 2-min file
  User can trim within 2-min window ✓
  User cannot extend beyond 2-min window ✗

~5 MINUTES LATER (segment finishes):
  Clip → upgraded to reference full 5-min segment file
  startTime/endTime adjusted to segment-relative offsets
  User can now extend to anywhere in the 5-min segment ✓
```

**How it works technically**:
1. Real-time clip is created with `file_path` = extracted window file, `startTime`/`endTime` relative to that file
2. Clip also stores `stream_offset_start` and `stream_offset_end` (absolute time in the stream)
3. When segment-based processing runs, it finds real-time clips whose stream offsets fall within the segment
4. Updates the clip's `file_path` to the full segment file, recalculates `startTime`/`endTime` relative to the segment
5. The clip is now fully editable within the segment bounds

**User experience**: Clip appears fast → user can immediately watch/share it → a few minutes later, the extend handles silently unlock. No UI change needed, no notification — it just works.

### Deduplication with Segment-Based Detection
When segment-based detection runs on a segment that overlaps with a real-time clip:
- Check if any real-time clips exist for this time window
- If a real-time clip already covers a moment, **skip** that moment in segment-based results
- If segment-based finds a moment that real-time missed (lower energy, subtle), create it normally
- Net result: no duplicate clips, best of both systems

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│ Browser (Tauri WebView)                                      │
│                                                              │
│  LiveKit Room                                                │
│    ├── Video Track → Canvas → MediaRecorder (DVR chunks)     │
│    └── Audio Track ─┬→ MediaRecorder (DVR, existing)         │
│                     └→ [NEW] AudioContext                    │
│                          └→ AnalyserNode                     │
│                              └→ RMS Energy Buffer (120s)     │
│                                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │ Trigger 1:          │  │ Trigger 2:                   │  │
│  │ Energy Spike        │  │ Micro-Transcription          │  │
│  │ (>6dB, >3s)         │  │ (20s audio → Whisper → scan) │  │
│  │ [Browser, free]     │  │ [Server, every 15s]          │  │
│  └────────┬────────────┘  └──────────────┬───────────────┘  │
│           │                              │                   │
│           └──────────┬───────────────────┘                   │
│                      │ EITHER triggers                       │
│                      ▼                                       │
│           Adaptive window monitoring                         │
│           (wait for moment to complete)                      │
│                      │                                       │
│                      ▼                                       │
│           Concat DVR chunks + reuse                          │
│           extract_video_chunk_for_analysis (480p)            │
│           + extract audio (~10s)                             │
│                      │                                       │
└──────────────────────│───────────────────────────────────────┘
                       │
┌──────────────────────│───────────────────────────────────────┐
│ Server (Phoenix)     ▼                                       │
│                                                              │
│  /clips/detect-realtime endpoint                             │
│    1. Whisper full-window transcription (~15s)               │
│    2. transcript_enrichment.ex (REUSED) — keyword boost,     │
│       speech rate, silence→spike                             │
│    3. gemini_video_detection.ex (REUSED) — Gemini Flash      │
│       Pass 1 with trigger context                            │
│    4. signal_fusion.ex (REUSED) — score boost, boundary snap │
│    5. Return clips with virality scores                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                       │
              virality ≥ 85%?
              ├── YES → Auto-create clip + notify user
              └── NO  → Discard (segment-based handles it)

              ~5 min later, segment finishes:
              → Upgrade clip to full segment file
              → User can now extend clip duration
```

---

## Watching While Auto-Detecting

The user can watch the livestream and have real-time detection running simultaneously. No conflict:

- **PumpFun**: Auto-detect uses DVR recording (MediaRecorder → 4s WebM chunks). The viewer starts a separate HLS recording (via yt-dlp) for video playback. The real-time audio monitor taps into the same LiveKit `audioTrack.mediaStreamTrack` that DVR already captures — `AnalyserNode` is read-only and doesn't interfere with either recording or playback.
- **Kick**: Both auto-detect and viewing use the same yt-dlp HLS recording. The real-time audio monitor routes the `<video>` element's audio through an `AudioContext` → `AnalyserNode`.

All three systems (DVR recording, HLS playback, real-time audio monitoring) can share the same audio track simultaneously.

---

## Coexistence with Segment-Based Detection

Real-time detection **does not replace** segment-based detection. They run in parallel:

| Detection Mode | What It Catches | When It Runs |
|---|---|---|
| **Real-time (new)** | High-energy spikes + keyword triggers | Continuously during stream |
| **Segment-based (existing)** | Everything else (story arcs, conversations, subtle moments) | Every N minutes |

Real-time catches the **obvious viral moments** fast. Segment-based catches the **nuanced content** that requires full context. Together they cover everything.

---

## Implementation Plan

### Phase 1: Audio Energy Monitor
**New composable**: `useRealtimeAudioMonitor.ts`

- Hooks into the existing LiveKit audio track from `useDvrRecording`
- Creates `AudioContext` → `AnalyserNode` pipeline
- Computes per-second RMS energy
- Maintains rolling 120-second energy buffer
- Spike detection with adaptive window (threshold + sustained + cooldown)
- Exposes: `currentEnergy`, `averageEnergy`, `isSpike`, `spikeTimestamp`, `windowEnd`

**Files**:
- Create: `client/src/composables/useRealtimeAudioMonitor.ts`

### Phase 2: Rolling Micro-Transcription + Keyword Detection
**Integrated into `useRealtimeClipDetection.ts`**

- Every 15 seconds, extract last 20 seconds of audio from DVR chunks
- Send to server micro-transcription endpoint (Whisper only, ~3-5s)
- Scan returned transcript for trigger keywords (client-side, configurable list)
- **Reuses** keyword list from `transcript_enrichment.ex` keyword boosting
- If keyword found → fire trigger with keyword timestamp and context
- Merge with energy spike if both fire within 30 seconds

**New server endpoint**: `POST /clips/micro-transcribe`
- Accepts: 20-second audio clip
- Runs Whisper, returns transcript text only (no LLM, no clip detection)
- Fast and cheap (~$0.0002 per call)

**Files**:
- Modify: `server/lib/clippster_server_web/router.ex` — Add `/clips/micro-transcribe` route
- Modify: `server/lib/clippster_server_web/controllers/clips_controller.ex` — Add `micro_transcribe` action

### Phase 3: DVR Extraction Command (Rust)
**New Tauri command**: `extract_realtime_clip_from_dvr`

- Input: session output dir, window start/end timestamps
- Finds relevant DVR chunks (4-second WebM files) by timestamp
- FFmpeg concat → single file
- **Reuses** `extract_video_chunk_for_analysis` (from enhanced multimodal) for 480p encoding
- Extract audio separately
- Return: `{ videoPath, video480pBase64, audioBase64, startTime, endTime }`

**Files**:
- Create: `client/src-tauri/src/commands/realtime_clip_commands.rs` — DVR chunk concat only (480p reuses existing command)
- Modify: `client/src-tauri/src/lib.rs` — Register command

### Phase 4: Server Detection Endpoint
**New endpoint**: `POST /clips/detect-realtime`

Thin wrapper that orchestrates existing enhanced multimodal modules:
1. Whisper transcription (existing)
2. `transcript_enrichment.ex` (REUSED) — keyword boost, speech rate, silence→spike
3. `gemini_video_detection.ex` (REUSED) — Gemini Flash Pass 1 with trigger context appended
4. `signal_fusion.ex` (REUSED) — post-processing
5. Returns clips with virality scores

**Keyword triggers**: Append "Streamer said 'clip that' — bias toward clipping" to the Gemini prompt context.

**Files**:
- Modify: `server/lib/clippster_server_web/router.ex` — Add `/clips/detect-realtime` route
- Modify: `server/lib/clippster_server_web/controllers/clips_controller.ex` — Add `detect_realtime` action (calls existing modules)
- Modify: `server/lib/clippster_server/ai/system_prompt.ex` — Add realtime-specific prompt variant

### Phase 5: Orchestration + Clip Creation
**New composable**: `useRealtimeClipDetection.ts`

- Orchestrates both triggers: energy monitor + micro-transcription loop
- Manages adaptive window: waits for moment to complete before extracting
- On trigger with virality ≥ 85%:
  1. Create clip in project database (same as segment-based)
  2. Store `stream_offset_start`/`stream_offset_end` for later upgrade
  3. Generate thumbnail, show toast notification
- Manages deduplication with segment-based results
- Configurable keyword list (defaults + user custom keywords)

**Files**:
- Create: `client/src/composables/useRealtimeClipDetection.ts`
- Modify: `client/src/composables/useDvrRecording.ts` — Expose audio track for monitoring
- Modify: `client/src/composables/useLivestreamMonitoring.ts` — Initialize realtime detection with auto-detect

### Phase 6: Clip Upgrade on Segment Completion
When segment-based processing runs:

- Check for real-time clips whose `stream_offset` falls within this segment
- Update clip's `file_path` to the full segment file
- Recalculate `startTime`/`endTime` relative to the segment
- Skip duplicate moments in segment-based detection results

**Files**:
- Modify: `client/src/composables/useLivestreamSegmentProcessing.ts` — Clip upgrade + deduplication logic
- Modify: `client/src/services/database/clip-detection.ts` — Add `stream_offset` fields to clip creation

### Phase 7: UI Integration
- **Credit cost disclosure**: When the user enables auto-detect, clearly display **"1 credit per minute while the livestream is running"**. This must be visible before they start — not buried in settings. Show a running credit counter during the stream so the user always knows what they're spending.
- "⚡ Instant" badge on real-time clips in the clips panel
- Toast notifications: "⚡ Viral moment detected! [clip title]"
- Activity log entries for realtime detections
- Energy level indicator on stream monitoring card (optional, nice-to-have)
- Keyword configuration UI (add/remove trigger keywords per streamer)

**Files**:
- Modify: Monitoring UI components (streamer cards, clips panel, settings, auto-detect toggle)

---

## Spike Detection Tuning

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `spikeThresholdDb` | 6 | dB above rolling average to trigger |
| `sustainedDurationMs` | 3000 | Spike must last this long |
| `cooldownMs` | 60000 | Minimum time between triggers |
| `rollingWindowSeconds` | 30 | Window for computing baseline average |
| `energyDropDurationMs` | 10000 | Energy must stay below threshold this long to close window |
| `viralityThreshold` | 85 | Minimum virality score to auto-create clip |
| `preSpikePadding` | 30 | Seconds before spike to include |
| `postDropPadding` | 30 | Seconds after energy drops to include |
| `maxWindowSeconds` | 300 | Maximum extraction window (5 min cap) |

---

## Performance & Cost

### Performance Impact
| Resource | Impact | Notes |
|----------|--------|-------|
| CPU | <1% continuous | AnalyserNode is hardware-optimized |
| RAM | ~1MB per stream | 120s rolling buffer of float values |
| Network | ~50KB every 15s | Micro-transcription uploads (20s audio compressed) |
| Disk | Zero extra | DVR chunks already being written |

### API Cost Breakdown (3-hour stream)
| Component | Cost | Notes |
|-----------|------|-------|
| Rolling micro-transcription | ~$0.14 | 720 calls × $0.0002 (20s audio every 15s) |
| Per-trigger Whisper (full window) | ~$0.02 | ~15 triggers × 2-min window × $0.0014 |
| Per-trigger Gemini Flash | ~$0.08 | ~15 triggers × reuses `gemini_video_detection.ex` |
| **Total for 3-hour stream** | **~$0.24** | Well within 180 credits (1/min) margin |

### Per-Trigger Cost (2-min window)
| Step | Cost | Time |
|------|------|------|
| DVR concat + 480p encode (reuses existing) | $0 | ~10s |
| Whisper (2 min full transcript) | $0.0014 | ~15s |
| Gemini Flash + enrichment + fusion (all reused) | $0.005 | ~30s |
| **Total per trigger** | **~$0.006** | **~55s processing** |

---

## Edge Cases

1. **Stream just started** (<60s recorded): Skip real-time detection until enough DVR buffer exists
2. **Long moments (>5 min)**: Cap at 5-min window. Segment-based handles the full context
3. **Multiple rapid spikes during cooldown**: Extend the current window instead of triggering a new one
4. **False positives** (music, game audio): 85% virality threshold + Gemini seeing the actual video filters these out
5. **DVR chunks missing/corrupt**: Fall back to segment-based detection. Don't crash
6. **Stream reconnection**: Reset energy baseline (audio levels may change)
7. **Credit exhaustion**: Disable all detection (real-time + segment-based), fall back to recording-only
8. **Clip upgrade race condition**: If user edits clip before segment finishes, preserve user edits during upgrade

---

## File Summary

### New Files (3)
| File | Purpose |
|------|---------|
| `client/src/composables/useRealtimeAudioMonitor.ts` | Web Audio API energy monitoring + adaptive spike detection |
| `client/src/composables/useRealtimeClipDetection.ts` | Orchestrates dual triggers → extract → detect → create → upgrade pipeline + micro-transcription loop + keyword config |
| `client/src-tauri/src/commands/realtime_clip_commands.rs` | DVR chunk concatenation (480p encoding reuses `extract_video_chunk_for_analysis`) |

### Modified Files (7)
| File | Change |
|------|--------|
| `client/src-tauri/src/lib.rs` | Register `extract_realtime_clip_from_dvr` + `extract_micro_audio` commands |
| `client/src/composables/useDvrRecording.ts` | Expose audio track reference for real-time monitoring |
| `client/src/composables/useLivestreamMonitoring.ts` | Initialize realtime detection alongside auto-detect |
| `client/src/composables/useLivestreamSegmentProcessing.ts` | Clip upgrade + deduplication logic |
| `client/src/services/database/clip-detection.ts` | Add `stream_offset` fields to clip creation |
| `server/lib/clippster_server_web/controllers/clips_controller.ex` | Add `detect_realtime` + `micro_transcribe` actions (both call existing modules) |
| `server/lib/clippster_server_web/router.ex` | Add `/clips/detect-realtime` + `/clips/micro-transcribe` routes |

### Reused from Enhanced Multimodal (0 new code needed)
| Component | Reused For |
|-----------|-----------|
| `extract_video_chunk_for_analysis` (Rust) | 480p encoding of extraction windows |
| `gemini_video_detection.ex` (Server) | Gemini Flash visual analysis on real-time windows |
| `transcript_enrichment.ex` (Server) | Keyword boosting + speech rate + silence→spike |
| `signal_fusion.ex` (Server) | Score boosting + boundary snapping |
| `system_prompt.ex` (Server) | Signal instructions (already updated) |
| `openrouter_api.ex` (Server) | Gemini Flash API calls |
