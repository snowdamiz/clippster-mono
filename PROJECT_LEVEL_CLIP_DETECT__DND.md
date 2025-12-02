# Project-Level Clip Detection

## Overview

Add a "Detect Clips" button to project card hover overlays in `Projects.vue`. When clicked, it will prompt the user to select a detection prompt (reusing `ClipDetectionConfirmDialog`), then run clip detection across all segments of the root project.

## Key Files

- [`client/src/pages/Projects.vue`](client/src/pages/Projects.vue) - Add button, state, and detection orchestration
- [`client/src/components/ClipDetectionConfirmDialog.vue`](client/src/components/ClipDetectionConfirmDialog.vue) - Extend to support multi-segment mode

## Implementation

### 1. Extend ClipDetectionConfirmDialog for Multi-Segment Mode

- Add new optional props: `segments` (array of projects to detect) and `totalDuration` (sum of all segment durations)
- When in multi-segment mode, show segment count and total duration instead of single video duration
- Adjust credit calculation to use total duration across all segments
- Dialog already has prompt selection - no changes needed there

### 2. Add Detect Clips Button to Project Card Hover Overlay

- Add a new button (using `Sparkles` icon from lucide) between the Play/Folder and Edit buttons
- Only show the button for projects that have videos (direct or in children)
- Wire up click handler to open the detection dialog

### 3. Add State and Methods to Projects.vue

- Add state: `showProjectDetectDialog`, `projectToDetect`, `segmentsToDetect`
- Add method `startProjectDetection(project)` that:
- Gathers all child segments (or the project itself if no children)
- Calculates total video duration across segments
- Opens the detection confirmation dialog
- Add method `onProjectDetectClipsConfirmed(promptId, promptContent)` that:
- Iterates through segments sequentially
- Runs `detectClipsWithChunking` for each segment
- Shows progress feedback
- Handles errors gracefully (continue with remaining segments)

### 4. Add Progress Tracking

- Reuse existing toast system to show progress ("Detecting clips for segment 1/3...")
- Show summary toast on completion ("Detected X clips across Y segments")

## Technical Notes

- Reuse `useChunkedClipDetection` composable for actual detection (one call per segment)
- Sequential processing to avoid overwhelming the backend
- Each segment detection will charge credits based on its duration