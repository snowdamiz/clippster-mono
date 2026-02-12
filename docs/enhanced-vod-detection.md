# Enhanced Multimodal Clip Detection — Implementation Plan

Replace the multi-model text ensemble with 7 free local signals (Standard) and two-pass Gemini video analysis (Enhanced), per the spec in `enhanced-multimodal-clip-detection-69aaf5.md`.

---

## Phase 1: Local Signal Extraction (Rust/FFmpeg) — Standard Mode

**New file:** `client/src-tauri/src/video_signal_analysis.rs`

Create a Tauri command `analyze_video_signals` that runs a single FFmpeg invocation combining:
- `astats=metadata=1:reset=1` → per-second RMS, peak, crest factor
- `ebur128` → EBU R128 perceptual loudness (momentary LUFS)
- `silencedetect=noise=-40dB:d=0.8` → silence regions
- `scdet=threshold=10` → scene change timestamps + confidence

Parse FFmpeg stderr output into structured JSON:
```rust
struct VideoSignalAnalysis {
    audio_frames: Vec<AudioAnalysisFrame>,  // per-second
    scene_changes: Vec<SceneChange>,
    silence_regions: Vec<SilenceRegion>,
}
```

**Modify:** `client/src-tauri/src/lib.rs`
- Add `mod video_signal_analysis;`
- Register `video_signal_analysis::analyze_video_signals` command

**Modify:** `client/src/composables/useChunkedClipDetection.ts`
- After getting `projectVideo`, invoke `analyze_video_signals` in parallel with transcription (non-blocking `Promise`)
- Store result in a local variable; pass to server alongside chunks

**Modify:** `client/src/composables/useChunkedTranscriptCache.ts`
- No schema change needed — signal data is sent per-request, not cached in SQLite (it's fast enough to re-run: ~15s)

---

## Phase 2: Transcript Enrichment (Server) — Standard Mode

**New file:** `server/lib/clippster_server/ai/transcript_enrichment.ex`

Pure Elixir module that derives 4 additional signals from Whisper data + local analysis:
1. **Speech rate variation** — words-per-minute delta between adjacent segments, flag >30% changes
2. **Silence→spike detection** — cross-reference silence regions with audio energy spikes
3. **Keyword boosting** — scan transcript for viral indicator phrases ("oh my god", "no way", "let's go", etc.)
4. **Energy-transcript sync** — cross-reference energy spikes with exclamation marks / emphasis words

Input: chunk transcript + `VideoSignalAnalysis` JSON from client
Output: enriched transcript with per-segment annotations

**Modify:** `server/lib/clippster_server/ai/system_prompt.ex`
- Append a new section to `@system_prompt` instructing the AI about all 7 signals:
  - Audio energy spikes → likely highlight moments
  - Scene changes → natural clip boundaries
  - Silence→spike → punchlines/reactions
  - Keyword matches → viral potential
  - Speech rate changes → emotional moments
  - High loudness (LUFS) → audience engagement
  - Energy-transcript sync → high-confidence moments

**Modify:** `server/lib/clippster_server_web/controllers/clips_controller.ex`
- In `execute_chunked_clip_detection/6`: parse `signal_data` from params
- Before AI call, run `TranscriptEnrichment.enrich/2` on each chunk
- Pass enriched transcript to `OpenRouterAPI.generate_clips/4` instead of raw transcript
- Same for `process_chunks_parallel_normal/5`

**Modify:** `server/lib/clippster_server/ai/openrouter_api.ex`
- Update `build_user_prompt/3` to include signal annotations section when present in transcript data

---

## Phase 3: Video Chunk Extraction (Rust/FFmpeg) — Enhanced Mode

**New file:** `client/src-tauri/src/video_chunk_extraction.rs`

Tauri command `extract_video_chunk_for_analysis`:
- Input: `video_path`, `start_time`, `end_time`
- FFmpeg: extract segment → scale to 480p → re-encode H.264 low bitrate (~500kbps) → output to temp file
- Return: base64-encoded MP4 string
- Pipelined: client extracts chunk N+1 while server processes chunk N

**Modify:** `client/src-tauri/src/lib.rs`
- Add `mod video_chunk_extraction;`
- Register `video_chunk_extraction::extract_video_chunk_for_analysis` command

**Modify:** `client/src/composables/useChunkedClipDetection.ts`
- When Enhanced mode (`currentMultimodal`): extract 480p video chunks in parallel with transcription
- Send base64 video chunks to server alongside transcript chunks
- Pipeline: extract chunk N+1 while waiting for server response on chunk N
- Update progress messages: "Extracting video chunk 3/5..."

---

## Phase 4: Two-Pass Gemini Detection (Server) — Enhanced Mode

**New file:** `server/lib/clippster_server/ai/gemini_video_detection.ex`

Two-pass detection module:

**Pass 1 — Visual Spotter (Gemini Flash):**
- Receive base64 video chunk from client
- Send to Gemini Flash via OpenRouter using `video_url` content type (inline base64 data URI)
- Prompt: identify visual moments (reactions, gameplay highlights, chat popups, donations, scene changes)
- Returns: `[{timestamp, description, visual_type}]` annotations
- ~30s per chunk, ~$0.012/chunk

**Pass 2 — Clip Editor (Gemini Pro or Claude):**
- Receives: full enriched transcript + all 7 local signals + Pass 1 visual annotations
- Uses the existing system prompt + signal instructions from Phase 2
- Makes final clip decisions with precise start/end boundaries
- ~30-60s per chunk, ~$0.02/chunk

**Modify:** `server/lib/clippster_server/ai/openrouter_api.ex`
- Add `generate_visual_annotations/4` — Pass 1 API call with video content
- Add `generate_clips_with_visual_context/5` — Pass 2 API call with enriched context

**Modify:** `server/lib/clippster_server_web/controllers/clips_controller.ex`
- Replace `process_chunks_parallel_multimodal/5` call path with two-pass Gemini detection
- Route: if `multimodal` → call `GeminiVideoDetection.process_chunk_two_pass/7` per chunk
- Keep parallel chunk processing (max 4 concurrent)

**Gut:** `server/lib/clippster_server/ai/multimodal_clip_detection.ex`
- Remove multi-model ensemble logic (4 models + decider + consensus)
- Replace with thin wrapper that delegates to `GeminiVideoDetection`
- Keep `get_detection_models/0` and `get_decider_model/0` for backwards compat (return new model names)

---

## Phase 5: Signal Fusion Post-Processing (Server) — Both Modes

**New file:** `server/lib/clippster_server/ai/signal_fusion.ex`

Lightweight post-processing that runs after AI returns clips:
- Clips containing energy spikes → boost virality score (+5-15)
- Clips during sustained silence → penalize (-10)
- Clips with silence→spike pattern → boost (+10, punchline detection)
- Adjust clip boundaries to snap to nearest scene change (within 2s)
- Clips with high speech rate variation → boost (+5)
- Clips with keyword matches → boost (+5)

Input: AI clips + `VideoSignalAnalysis` + enrichment data
Output: re-scored and boundary-adjusted clips

**Modify:** `server/lib/clippster_server_web/controllers/clips_controller.ex`
- After clip detection (both Standard and Enhanced), call `SignalFusion.post_process/3`
- Before validation step, after merge step

---

## Phase 6: UI Updates — Client

**Modify:** `client/src/components/ClipDetectionConfirmDialog.vue`
- Change toggle label: "Enhanced Detection" → "AI Video Analysis"
- Change description: "Uses 3 AI models in parallel..." → "AI watches your video for visual moments (2x Credits)"
- Keep 2x credit multiplier logic unchanged

**Modify:** `client/src/composables/useChunkedClipDetection.ts`
- Add new progress stage: `'analyzing_signals'`
- Update progress messages:
  - "Analyzing audio & scene data..." (during local signal extraction)
  - "Enriching transcript with audio signals..." (during server enrichment)
  - "AI watching video chunk 3/5..." (Enhanced Pass 1)
  - "AI selecting best clips from chunk 3/5..." (Enhanced Pass 2)

**Modify:** `client/src/composables/useChunkedClipDetection.ts` (DetectionProgress type)
- Add `'analyzing_signals'` to the `stage` union type

---

## Data Flow

### Standard Mode
```
Video → [FFmpeg signal analysis (parallel)] → signal_data
Video → [Audio chunking → Whisper transcription] → transcript chunks
(signal_data + transcript) → [Server: TranscriptEnrichment] → enriched chunks
enriched chunks → [Server: OpenRouter AI] → raw clips
raw clips + signal_data → [Server: SignalFusion] → final clips
```

### Enhanced Mode
```
Video → [FFmpeg signal analysis (parallel)] → signal_data
Video → [Audio chunking → Whisper transcription] → transcript chunks
Video → [FFmpeg 480p extraction (pipelined)] → video chunks (base64)
(signal_data + transcript) → [Server: TranscriptEnrichment] → enriched chunks
video chunks → [Server: Gemini Flash Pass 1] → visual annotations
(enriched chunks + visual annotations) → [Server: Gemini Pro Pass 2] → raw clips
raw clips + signal_data → [Server: SignalFusion] → final clips
```

---

## File Summary

### New Files (5)
| File | Purpose |
|------|---------|
| `client/src-tauri/src/video_signal_analysis.rs` | FFmpeg audio+scene signal extraction |
| `client/src-tauri/src/video_chunk_extraction.rs` | 480p video chunk extraction for Gemini |
| `server/lib/clippster_server/ai/transcript_enrichment.ex` | Speech rate, silence→spike, keywords, energy sync |
| `server/lib/clippster_server/ai/gemini_video_detection.ex` | Two-pass Gemini video analysis |
| `server/lib/clippster_server/ai/signal_fusion.ex` | Post-processing score boost + boundary snap |

### Modified Files (8)
| File | Change |
|------|--------|
| `client/src-tauri/src/lib.rs` | Register 2 new commands |
| `client/src/composables/useChunkedClipDetection.ts` | Signal analysis, video extraction, progress messages, new stage type |
| `client/src/components/ClipDetectionConfirmDialog.vue` | Toggle label/description update |
| `server/lib/clippster_server/ai/system_prompt.ex` | Add 7-signal instructions |
| `server/lib/clippster_server/ai/openrouter_api.ex` | Add visual annotation + visual context API calls |
| `server/lib/clippster_server_web/controllers/clips_controller.ex` | Parse signals, call enrichment/fusion, route Enhanced to Gemini |
| `server/lib/clippster_server/ai/multimodal_clip_detection.ex` | Gut ensemble, delegate to Gemini detection |

### Implementation Order
1. Phase 1 (Rust signal extraction) — can be tested standalone
2. Phase 2 (Server enrichment) — depends on Phase 1 data format
3. Phase 5 (Signal fusion) — depends on Phase 2 data format, simple module
4. Phase 3 (Rust video extraction) — independent of 1-2
5. Phase 4 (Gemini detection) — depends on Phase 3 data format
6. Phase 6 (UI) — last, after all backend work
