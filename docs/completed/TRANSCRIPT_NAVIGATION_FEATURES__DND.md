---
name: Transcript_Navigation_Features
overview: Add time-based section headers using Whisper's natural speech segments, implement Find-style navigation with up/down arrows to jump between search matches, and ensure click-to-seek works correctly. Features will be added to both TranscriptPanel and TranscriptTab components.
todos:
  - id: section-headers-panel
    content: Add time-based section headers to TranscriptPanel using WhisperSegment data
    status: pending
  - id: find-nav-panel
    content: Add Find-style navigation (X of Y counter, up/down arrows) to TranscriptPanel
    status: pending
  - id: section-headers-tab
    content: Add time-based section headers to TranscriptTab for clip editor
    status: pending
    dependencies:
      - section-headers-panel
  - id: find-nav-tab
    content: Add Find-style navigation to TranscriptTab for clip editor
    status: pending
    dependencies:
      - find-nav-panel
---

# Transcript Navigation Features

## Overview

Enhance the transcript viewing experience with three key features:

1. **Time-based section headers** - Display natural speech segments from Whisper with timestamp headers
2. **Find navigation** - Add up/down arrows to cycle through search matches (like Microsoft Word)
3. **Click-to-seek** - Already implemented, just needs verification

## Current State

- [TranscriptPanel.vue](client/src/components/TranscriptPanel.vue) and [TranscriptTab.vue](client/src/components/clip-editor/tabs/TranscriptTab.vue) already have:
  - Search highlighting (`matchedPhraseIndices`)
  - Click-to-seek functionality (`onWordClick` -> `seekVideo`)
  - Word-level timestamp data (`start`, `end`)
- [useTranscriptData.ts](client/src/composables/useTranscriptData.ts) already parses `WhisperSegment` data with segment boundaries

## Implementation

### 1. Time-Based Section Headers

Group words by their natural Whisper segments and display timestamp headers:

```mermaid
flowchart TD
    A[transcriptData.whisperSegments] --> B[Group words by segment]
    B --> C[Render section header with timestamp]
    C --> D[Render words within section]
    D --> E[Next section...]
```

**Changes to both components:**

- Create computed property `segmentedWords` that groups words by their containing WhisperSegment
- Render each segment with a header showing `startTime - endTime` (e.g., "0:00 - 0:15")
- Clickable section headers also seek to that segment's start time

### 2. Find Navigation (Up/Down Arrows)

Add a search results toolbar showing match count and navigation:

```
[Search input] [2 of 5] [↑] [↓]
```

**Changes to both components:**

- Add `currentMatchIndex` state to track which match is focused
- Compute `matchGroups` - distinct phrase match positions (not individual word indices)
- Add "X of Y" display and up/down arrow buttons
- Scroll to and highlight the focused match differently from other matches
- Up arrow: go to previous match, wrap to last if at first
- Down arrow: go to next match, wrap to first if at last

### 3. Styling

- **Section headers**: Subtle divider with timestamp in muted text
- **Current search match**: Brighter highlight + ring (e.g., `bg-yellow-500/40 ring-2 ring-yellow-400`)
- **Other search matches**: Keep current style (`bg-yellow-500/20`)

## Files to Modify

| File | Changes |
|------|---------|
| [TranscriptPanel.vue](client/src/components/TranscriptPanel.vue) | Add section headers, find navigation UI, match tracking state |
| [TranscriptTab.vue](client/src/components/clip-editor/tabs/TranscriptTab.vue) | Same changes as TranscriptPanel |

