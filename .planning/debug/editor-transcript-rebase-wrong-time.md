---
status: investigating
trigger: "Investigate issue: editor-transcript-rebase-wrong-time"
created: 2026-03-10T04:37:40Z
updated: 2026-03-10T04:37:40Z
---

## Current Focus

hypothesis: Persisted transcript `segments[].words[]` sometimes use a local time basis while the parent segment `start/end` uses project-global time; `parseTranscriptToWords` fails to normalize these mismatches and therefore returns words from unrelated transcript segments.
test: Patch `parseTranscriptToWords` to detect segment/word time-basis mismatches and shift the words into the containing segment range, then verify against the live transcript row and targeted tests.
expecting: After normalization, the sample transcript range `206.72-221.94` will only contain the expected words from segments 84-89.
next_action: update `client/src/utils/timelineUtils.ts`, add regression coverage, and run focused verification

## Symptoms

expected: When a clip derived from a transcribed VOD is opened in the editor, the transcript tab should show the words that belong to that clip time range.
actual: The transcript tab shows transcript content, but the words are incorrect for the selected clip and appear pulled from the wrong VOD time range.
errors: Logs show transcript fallback path in project-loader.ts using stitched VOD transcript, parseTranscriptToWords producing 6484 words, filterAndRebase matching 121 words for segment range 206.7-221.9, and warnings from collectAudioClips about missing media assets.
reproduction: Detect clips using ProjectWorkspaceDialog, let the VOD transcript persist, then open one resulting clip in client/src/editor and check the transcript tab.
started: Current issue; user reports this is happening now during clip-to-editor flow.

## Eliminated

## Evidence

- timestamp: 2026-03-10T04:37:40Z
  checked: GitNexus repo context and debugging skill
  found: GitNexus index is available for `clippster-mono`; debugging workflow points to query, context, and process tracing for bug investigation.
  implication: Code graph tools are available for tracing the editor transcript flow safely.

- timestamp: 2026-03-10T04:37:40Z
  checked: GitNexus query for transcript fallback and editor transcript flow
  found: `client/src/editor/bridge/project-loader.ts:loadClippsterProject` is the main editor project load entry point surfaced by GitNexus for this bug.
  implication: The transcript bug likely occurs during project hydration into the editor, not only in the UI tab rendering.

- timestamp: 2026-03-10T04:37:40Z
  checked: ripgrep over editor transcript-related symbols
  found: Both `client/src/editor/bridge/project-loader.ts` and `client/src/editor/components/panels/assets/TranscriptView.vue` implement transcript fallback logic using `parseTranscriptToWords` plus local `filterAndRebase` helpers.
  implication: There are two independent places where time-basis mistakes can produce the wrong transcript words.

- timestamp: 2026-03-10T04:37:40Z
  checked: `client/src/services/video-editor-project-creator.ts` and `client/src/editor/bridge/project-loader.ts`
  found: The editor project is built from an extracted clip file with timeline trim values rebased to `0..clipDuration`, while transcript lookup still relies on `sourceClipStartTime`/`sourceClipEndTime` and `sourceClipId` to map back to the original VOD.
  implication: Any transcript fallback must be explicit about whether its inputs are clip-relative or VOD-global.

- timestamp: 2026-03-10T04:37:40Z
  checked: `client/src/services/database/clip-detection.ts`, `client/src/services/database/manual-clips.ts`, and `client/src/services/database/clip-segments.ts`
  found: `clip_segments.start_time` and `clip_segments.end_time` are persisted from clip detection/manual clip creation using source-project times, not clip-relative times.
  implication: Segment-aware filtering against the stitched VOD transcript should work if this path is used consistently.

- timestamp: 2026-03-10T04:37:40Z
  checked: `client/src/services/clipBuildEventHandler.ts`
  found: When clip-specific `transcript_raw_json` is generated, its word and segment times are rebased to `0` relative to the clip start.
  implication: Clip-specific transcript JSON and VOD stitched transcript operate on different time bases; mixing them without guarding will produce wrong words.

- timestamp: 2026-03-10T04:37:40Z
  checked: `client/src/services/database/transcripts.ts` plus transcript stitching code in `useChunkedClipDetection.ts` and `useTranscriptionOnly.ts`
  found: Project transcript lookup is keyed by `raw_videos.project_id`, and cached chunk stitching normalizes segment and word times to VOD-global `start`/`end` before saving.
  implication: If the displayed words are still wrong, the failure is more likely due to which transcript record is selected or how a specific clip’s persisted timings relate to that transcript.

- timestamp: 2026-03-10T04:37:40Z
  checked: Live database rows for clip `2d5c3aa8-93b5-4c9d-a114-0fd5858f1285` in project `5cbb44e9-bb03-4c14-8395-cccad9280b98`
  found: `clip_segments.transcript` and `transcript_segments` rows at `206.72-221.94` contain the expected text (`Oh, I got a dead control tower key. ... Best key in the game.`), while `transcript.raw_json` for the same project yields 121 words in that range including unrelated phrases like `Correct. You lose everything.` when parsed by `parseTranscriptToWords`.
  implication: The wrong transcript displayed in the editor is reproducible from `parseTranscriptToWords` on persisted project transcript JSON, not from clip segment selection.

- timestamp: 2026-03-10T04:37:40Z
  checked: Segment-level structure inside live `transcript.raw_json`
  found: Multiple segments far outside the clip range (for example segment `65` at `1076.88-1077.58` and segment `57` at `1946.72-1947.5`) contain words whose `start/end` values incorrectly fall around `206-221`, proving those word timings are not in the same time basis as their parent segments.
  implication: `parseTranscriptToWords` must normalize word timings relative to their containing segment when the word range does not overlap the segment range.

## Resolution

root_cause:
fix:
verification:
files_changed: []
