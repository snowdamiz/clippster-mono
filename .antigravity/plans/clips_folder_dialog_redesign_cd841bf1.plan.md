---
name: Clips Folder Dialog Redesign
overview: Refactor the folder dialog in Clips.vue to match the polished design pattern used in Projects.vue, including Teleport/transitions, BEM-style CSS, accent bar, and improved visual styling.
todos:
  - id: template-structure
    content: Restructure template with Teleport, Transitions, and BEM-style class names
    status: completed
  - id: header-redesign
    content: Redesign header with accent bar, icon background, and improved selection controls
    status: completed
  - id: content-grid
    content: Update content grid with new CSS classes and card wrapper structure
    status: completed
  - id: computed-size
    content: Add folderDialogSizeClass computed property for dynamic dialog width
    status: completed
  - id: css-styles
    content: Add scoped CSS styles matching Projects.vue folder dialog design
    status: completed
  - id: transitions
    content: Add CSS transition definitions for modal and dialog animations
    status: completed
---

# Clips.vue Folder Dialog Redesign

## Overview

Refactor the folder dialog in [client/src/pages/Clips.vue](client/src/pages/Clips.vue) to match the design system established in [client/src/pages/Projects.vue](client/src/pages/Projects.vue). The current implementation uses inline Tailwind utility classes while the target uses a structured BEM-style CSS approach with transitions and a more polished UI.

## Current State (Clips.vue)

The folder dialog (lines 313-486) currently uses:

- Inline Tailwind utility classes throughout
- No `<Teleport>` - renders inline in component
- No transitions/animations
- Simple grid layout with BuildCard components
- Basic header with folder icon and name
- Aspect ratio filter tabs in header
- Selection checkboxes with basic styling

## Target Design (Projects.vue)

The folder dialog in Projects.vue (lines 406-819) features:

- `<Teleport to="body">` for proper z-index layering
- Vue `<Transition>` components (`name="modal"` and `name="dialog"`)
- BEM-style CSS classes (`.folder-dialog__*`)
- Accent bar at top of dialog
- Refined header with icon background
- Custom scrollbar styling
- ARIA attributes for accessibility
- Dynamic width based on content count

## Implementation Plan

### 1. Template Structure Changes

Replace the current template (lines 313-486) with the new structure:

```vue
<Teleport to="body">
  <Transition name="modal">
    <div v-if="showFolderDialog && folderProject" 
         class="folder-dialog__overlay" 
         @click.self="showFolderDialog = false">
      <Transition name="dialog" appear>
        <div class="folder-dialog" :class="folderDialogSizeClass" role="dialog" aria-modal="true">
          <!-- Accent bar -->
          <div class="folder-dialog__accent"></div>
          <!-- Header, Content, Footer -->
        </div>
      </Transition>
    </div>
  </Transition>
</Teleport>
```

### 2. Key Template Components to Update

- **Header**: Add `.folder-dialog__header` with icon styling, selection controls, and close button
- **Content Grid**: Convert grid to use `.folder-dialog__segments-grid` pattern with responsive column classes
- **Build Cards**: Wrap BuildCard components in `.folder-dialog__segment-card` containers with selection checkbox styling
- **Pagination Footer**: Wrap in conditional `.folder-dialog__footer` div

### 3. Add Computed Property for Dynamic Width

```typescript
const folderDialogSizeClass = computed(() => {
  const buildCount = paginatedFolderBuilds.length;
  if (buildCount <= 1) return 'folder-dialog--sm';
  if (buildCount === 2) return 'folder-dialog--md';
  return 'folder-dialog--lg';
});
```

### 4. CSS Styles to Add

Add a `<style scoped>` section with all `.folder-dialog__*` classes matching Projects.vue styling:

- Overlay with backdrop blur
- Dialog container with responsive widths (sm/md/lg)
- Accent bar gradient
- Header with icon container
- Selection controls styling
- Content area with custom scrollbars
- Grid layout variations
- Segment card with hover states
- Checkbox styling
- Transitions for modal and dialog

### 5. Files to Modify

- **[client/src/pages/Clips.vue](client/src/pages/Clips.vue)**: Main file to refactor

### 6. Aspects to Preserve

- Aspect ratio filter functionality in header
- BuildCard component usage (just wrap in new structure)
- Multi-select functionality for bulk deletion
- Date grouping of builds
- Pagination functionality
- All existing event handlers and data flow