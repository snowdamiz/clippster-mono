---
name: VideoEditor Search Palette
overview: Add a SearchPalette modal to the VideoEditor.vue page, following the established patterns from Clips.vue and Projects.vue, while adapting to VideoEditor's data structures where projects contain multiple sources and edit elements.
todos:
  - id: update-search-input
    content: Make search input readonly and add focus handler to open palette
    status: completed
  - id: add-palette-state
    content: Add search palette state variables and tab definitions
    status: completed
  - id: add-computed-props
    content: Add computed properties for tab badges and filtered results
    status: completed
  - id: add-palette-functions
    content: Implement open/close/tab-change/select functions
    status: completed
  - id: add-palette-template
    content: Add SearchPalette component with result list template
    status: completed
  - id: add-palette-styles
    content: Add CSS styles for palette content (reuse from Clips.vue)
    status: completed
---

# VideoEditor Search Palette Implementation

## Overview

Implement a command palette for the VideoEditor page that allows users to search and filter editor projects. The palette will follow the established pattern from [`client/src/pages/Clips.vue`](client/src/pages/Clips.vue) and [`client/src/pages/Projects.vue`](client/src/pages/Projects.vue), using the reusable [`SearchPalette`](client/src/components/SearchPalette.vue) component.

## Data Structures

VideoEditor has unique data that differs from Clips and Projects:

- **VideoEditorProject**: Projects with name, description, total_duration, thumbnail
- **VideoEditorSource[]**: Multiple sources per project (clips, raw_videos, imported files)
- **ProjectEditInfo**: Metadata about edits (hasAudio, hasText, hasStickers, hasWatermarks, hasEffects)

## Proposed Tabs

| Tab | Description | Badge ||-----|-------------|-------|| Search All | Search projects by name/description | - || With Sources | Filter projects that have video sources added | Count of projects with sources || Has Edits | Filter projects with text/stickers/audio overlays | Count of projects with edits |

## Implementation Steps

### 1. Update Search Input to Open Palette

Modify the existing search input in the header to:

- Make it readonly
- Add `@focus="openSearchPalette"` handler
```vue
<Input
  v-model="searchQuery"
  placeholder="Search projects..."
  class="videoeditor-header__search-input"
  @focus="openSearchPalette"
  readonly
/>
```




### 2. Add Search Palette State Variables

Add to the script section:

```typescript
// Search palette state
const showSearchPalette = ref(false);
const paletteSearchQuery = ref('');
const paletteActiveTab = ref<'search' | 'with_sources' | 'has_edits'>('search');
```



### 3. Add Computed Properties for Tabs and Results

- `videoEditorPaletteTabs`: Define tabs with icons and badges
- `projectsWithSourcesCount`: Count projects with at least one source
- `projectsWithEditsCount`: Count projects with any edit (audio/text/stickers/watermarks/effects)
- `paletteSearchResults`: Filter projects based on active tab and search query

### 4. Add Palette Functions

- `openSearchPalette()`: Open palette, sync search query
- `closeSearchPalette()`: Close and reset state
- `onPaletteTabChange(tabId)`: Handle tab switches
- `selectPaletteResult(project)`: Close palette and open selected project

### 5. Add SearchPalette Component to Template

Insert after the existing dialogs, using slots for:

- Default slot: Search results list with project thumbnails, names, source counts, and edit badges
- No footer slot needed (unlike Clips.vue which has "apply filter" functionality)

### 6. Add Palette Content Styles

Reuse the existing `search-palette__*` CSS classes from Clips.vue for consistency:

- Results header and list styling
- Item rows with thumbnails
- Badge indicators for sources/edits
- Empty state styling

## Key Files to Modify

- [`client/src/pages/VideoEditor.vue`](client/src/pages/VideoEditor.vue) - Add SearchPalette component and related logic

## Result Preview Item Structure

Each search result will display:

- Thumbnail (from first source or project thumbnail)
- Project name
- Source count badge (e.g., "3 Sources")