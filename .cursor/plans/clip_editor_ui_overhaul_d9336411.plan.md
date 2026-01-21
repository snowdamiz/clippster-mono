---
name: Clip Editor UI Overhaul
overview: Redesign the ClipEditorDialog and its child components with a professional CapCut-inspired aesthetic using the app's teal/cyan color scheme, improving layout, visual hierarchy, and overall user experience.
todos:
  - id: css-variables
    content: Add editor-specific CSS variables to style.css for consistent theming
    status: pending
  - id: dialog-layout
    content: Redesign ClipEditorDialog with new three-column layout structure
    status: pending
    dependencies:
      - css-variables
  - id: header-redesign
    content: Redesign ClipEditorHeader with teal accents and slimmer profile
    status: pending
    dependencies:
      - css-variables
  - id: sidebar-redesign
    content: Restructure ClipEditorSidebar to icon-only with tooltips
    status: pending
    dependencies:
      - css-variables
  - id: preview-redesign
    content: Redesign ClipEditorPreview with better controls and styling
    status: pending
    dependencies:
      - css-variables
  - id: inspector-redesign
    content: Make ClipEditorInspector collapsible with refined styling
    status: pending
    dependencies:
      - css-variables
  - id: timeline-redesign
    content: Redesign ClipEditorTimeline with teal playhead and better tracks
    status: pending
    dependencies:
      - css-variables
  - id: toolbar-redesign
    content: Redesign ClipEditorToolbar with better grouping
    status: pending
    dependencies:
      - css-variables
  - id: panels-update
    content: Update all panel components with consistent teal theme
    status: pending
    dependencies:
      - sidebar-redesign
  - id: inspectors-update
    content: Update all inspector components with consistent styling
    status: pending
    dependencies:
      - inspector-redesign
---

# Professional Clip Editor UI/UX Overhaul

## Current State Analysis

The existing clip editor uses a purple/violet accent color scheme that doesn't match the app's established teal/cyan theme (`--sidebar-accent: #0ea5e9`). The layout is functional but lacks the polished, professional feel of modern video editors like CapCut.**Key Issues:**

- Purple accents (`#a78bfa`, `rgba(139, 92, 246, ...)`) clash with app's teal theme
- Generic dark backgrounds without visual depth
- Sidebar tabs take up too much vertical space
- Inspector panel always visible even when empty
- Timeline lacks professional polish

## Design Direction

**Color Palette (matching app theme):**

- Primary accent: `#0ea5e9` (sky-500) / `#06b6d4` (cyan-500)
- Surface colors: `#0a0a0b`, `#111113`, `#18181b`
- Borders: `rgba(255, 255, 255, 0.06-0.12)`
- Track colors: Distinct but cohesive (teal for video, emerald for audio, amber for text)

**Layout Restructure:**

- Compact icon-only sidebar with tooltips (like CapCut)
- Collapsible inspector that only shows when item selected
- Larger preview area with better aspect ratio handling
- More prominent timeline with better visual hierarchy

---

## Implementation Plan

### 1. Update Global Editor CSS Variables

Add editor-specific CSS variables to [`client/src/style.css`](client/src/style.css) for consistent theming:

```css
/* Video Editor theme variables */
--editor-bg: #0a0a0b;
--editor-surface: #111113;
--editor-surface-elevated: #18181b;
--editor-border: rgba(255, 255, 255, 0.08);
--editor-accent: #0ea5e9;
--editor-accent-hover: #38bdf8;
--editor-text: #fafafa;
--editor-text-muted: #71717a;
```



### 2. Redesign ClipEditorDialog Layout

**File:** [`client/src/components/clip-editor/ClipEditorDialog.vue`](client/src/components/clip-editor/ClipEditorDialog.vue)Changes:

- Full-screen immersive layout (no rounded corners on overlay)
- Three-column layout: compact sidebar (56px) | preview (flex) | inspector (280px, collapsible)
- Refined header with better spacing and teal accents
- Bottom timeline area with clear visual separation

### 3. Redesign ClipEditorHeader

**File:** [`client/src/components/clip-editor/ClipEditorHeader.vue`](client/src/components/clip-editor/ClipEditorHeader.vue)Changes:

- Slimmer height (48px)
- Teal accent for export button
- Better visual grouping of undo/redo
- Subtle gradient background for depth

### 4. Redesign ClipEditorSidebar (Icon-Only)

**File:** [`client/src/components/clip-editor/ClipEditorSidebar.vue`](client/src/components/clip-editor/ClipEditorSidebar.vue)Major restructure:

- Narrow icon-only tab bar (56px wide)
- Tooltips on hover for labels
- Panel content slides out/overlays when active
- Teal highlight for active tab
- Clean icon grid layout

### 5. Redesign ClipEditorPreview

**File:** [`client/src/components/clip-editor/ClipEditorPreview.vue`](client/src/components/clip-editor/ClipEditorPreview.vue)Changes:

- Centered video with subtle checkerboard pattern background
- Refined playback controls with teal accents
- Better aspect ratio selector styling
- Cleaner overlay rendering

### 6. Redesign ClipEditorInspector (Collapsible)

**File:** [`client/src/components/clip-editor/ClipEditorInspector.vue`](client/src/components/clip-editor/ClipEditorInspector.vue)Changes:

- Auto-collapse when no item selected
- Smooth expand/collapse animation
- Better section organization
- Teal accent for headers

### 7. Redesign ClipEditorTimeline

**File:** [`client/src/components/clip-editor/ClipEditorTimeline.vue`](client/src/components/clip-editor/ClipEditorTimeline.vue)Changes:

- Refined ruler with better time markers
- Teal playhead instead of red
- Better track colors with visual hierarchy
- Cleaner segment styling with rounded corners
- Improved waveform visualization

### 8. Redesign ClipEditorToolbar

**File:** [`client/src/components/clip-editor/ClipEditorToolbar.vue`](client/src/components/clip-editor/ClipEditorToolbar.vue)Changes:

- Integrated into timeline header area
- Better button grouping
- Teal accents for active states

### 9. Update Panel Components

**Files:**

- [`client/src/components/clip-editor/panels/AudioPanel.vue`](client/src/components/clip-editor/panels/AudioPanel.vue)
- [`client/src/components/clip-editor/panels/TextPanel.vue`](client/src/components/clip-editor/panels/TextPanel.vue)
- Other panels

Changes:

- Consistent teal accent colors
- Better spacing and typography
- Refined input/slider styling

### 10. Update Inspector Components

**Files:**

- [`client/src/components/clip-editor/inspector/AudioInspector.vue`](client/src/components/clip-editor/inspector/AudioInspector.vue)
- [`client/src/components/clip-editor/inspector/TextInspector.vue`](client/src/components/clip-editor/inspector/TextInspector.vue)
- [`client/src/components/clip-editor/inspector/StickerInspector.vue`](client/src/components/clip-editor/inspector/StickerInspector.vue)

Changes:

- Consistent styling with new theme
- Better form controls
- Teal focus states

---

## Visual Reference (CapCut-Inspired)

```javascript
+----------------------------------------------------------+
| [Undo][Redo]  Project Name              [Export] [Close] |  <- Header (48px)
+------+-------------------------------------------+-------+
|  []  |                                           |       |
|  []  |                                           | Insp- |
|  []  |          VIDEO PREVIEW                    | ector |
|  []  |           (centered)                      |       |
|  []  |                                           | (col- |
|  []  |                                           | laps- |
+------+-------------------------------------------+ ible) |
| [Zoom] [Time]           [Split][Delete][Detach] |       |
+----------------------------------------------------------+
|  V1  |████████████████████████████████████████████████   |
|  A1  |  ████████████                                     |  <- Timeline
|  T1  |      ████████                                     |
+----------------------------------------------------------+
```

---

## Files to Modify

1. [`client/src/style.css`](client/src/style.css) - Add editor CSS variables
2. [`client/src/components/clip-editor/ClipEditorDialog.vue`](client/src/components/clip-editor/ClipEditorDialog.vue) - Main layout
3. [`client/src/components/clip-editor/ClipEditorHeader.vue`](client/src/components/clip-editor/ClipEditorHeader.vue) - Header redesign
4. [`client/src/components/clip-editor/ClipEditorSidebar.vue`](client/src/components/clip-editor/ClipEditorSidebar.vue) - Icon-only sidebar
5. [`client/src/components/clip-editor/ClipEditorPreview.vue`](client/src/components/clip-editor/ClipEditorPreview.vue) - Preview area
6. [`client/src/components/clip-editor/ClipEditorInspector.vue`](client/src/components/clip-editor/ClipEditorInspector.vue) - Collapsible inspector
7. [`client/src/components/clip-editor/ClipEditorTimeline.vue`](client/src/components/clip-editor/ClipEditorTimeline.vue) - Timeline
8. [`client/src/components/clip-editor/ClipEditorToolbar.vue`](client/src/components/clip-editor/ClipEditorToolbar.vue) - Toolbar