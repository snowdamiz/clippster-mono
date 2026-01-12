# Segment Speed Control Implementation Plan

Per-segment speed control allowing users to speed up or slow down individual video segments, similar to CapCut.

## Data Model Changes

### 1. Segment Speed Property
Add a `speed` property to video segments in the timeline model:
- Default value: `1.0` (normal speed)
- Range: `0.1x` to `16x` (or similar bounds)
- Store as a multiplier (e.g., `2.0` = 2x speed, `0.5` = half speed)

### 2. Files to Modify
- `client/src/components/clip-editor/timeline-model.ts` - Add `speed` field to segment interface
- Database migration if segments are persisted with speed data

---

## UI/UX Implementation

### 3. Segment Inspector Panel
When a segment is selected, show speed controls in the inspector:
- **Speed slider** (0.1x - 16x with common presets)
- **Preset buttons**: 0.5x, 1x, 2x, 4x
- **Manual input** for precise values
- **Duration preview** showing resulting segment length

### 4. Visual Feedback on Timeline
- Display speed indicator badge on sped-up/slowed segments (e.g., "2x" overlay)
- Optionally show a different color tint for modified segments
- Segment width should reflect the **output duration** (not source duration)

### 5. Right-Click Context Menu
Add "Speed" option to segment context menu with quick presets

---

## Timeline Logic Changes

### 6. Duration Calculations
- **Output duration** = Source duration / speed
- When speed changes, segment visual width must update
- Adjacent segments may need repositioning if gaps/overlaps occur

### 7. Playback Synchronization
- Preview player must apply speed multiplier during playback
- Audio pitch handling:
  - Option A: Pitch-corrected (maintain pitch)
  - Option B: Natural pitch shift (chipmunk/slow effect)

---

## Build/Export Integration

### 8. FFmpeg Command Generation
- Use `setpts` filter for video: `setpts=PTS/2.0` (for 2x speed)
- Use `atempo` filter for audio (chains needed for >2x): `atempo=2.0`
- For pitch-corrected audio, may need `rubberband` filter

### 9. Files to Modify
- `client/src-tauri/src/clips/` - Rust build pipeline
- FFmpeg filter graph construction logic

---

## Implementation Phases

| Phase | Description | Complexity |
|-------|-------------|------------|
| **1** | Data model + UI controls in inspector | Low |
| **2** | Timeline visual updates (width, badges) | Medium |
| **3** | Preview playback with speed | Medium |
| **4** | FFmpeg export integration | Medium-High |
| **5** | Audio pitch correction option (optional) | High |

---

## Key Considerations

- **Undo/Redo**: Speed changes should integrate with existing command system
- **Keyframes**: Speed is typically per-segment, not keyframeable (like CapCut)
- **Audio sync**: If segment has linked audio, both must speed-change together
- **Transitions**: Speed affects transition timing calculations

---

## Technical Notes

### Preview Playback
Phase 3 ensures the video player preview respects segment speed by adjusting playback rate during those time ranges.

### Export
Phase 4 integrates speed into the FFmpeg build pipeline using `setpts` (video) and `atempo` (audio) filters, so the final exported file has the speed changes baked in.

### Audio Pitch Correction
Without Phase 5 (pitch correction), sped-up audio will sound higher-pitched (chipmunk effect). This is acceptable for many use cases but some users prefer pitch-preserved speed changes using the `rubberband` filter.
