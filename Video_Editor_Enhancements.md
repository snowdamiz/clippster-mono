# Video Editor Timeline Enhancement Plan

## Current State Summary
The editor has solid foundations:
- Multi-track timeline with video, audio, text, stickers, watermarks
- Basic editing tools (Move, Razor, Ripple, Roll, Slip, Slide)
- Keyframe animation system
- Waveform visualization
- Manual region/framing configuration for aspect ratios
- Creator profile integration (intro/outro, watermarks)
- Undo/redo command system

---

## Phase 1: Timeline Interaction Improvements (High Priority)

### 1.1 Enhanced Snapping System
**Current:** Basic snap to playhead and segment edges on same track.
**Missing:**
- **Cross-track snapping** - Snap to cuts/edges on layers above/below (CapCut-style)
- **Magnetic timeline** - Segments attract to nearby edges within threshold
- **Snap indicators** - Visual vertical lines showing snap points across all tracks
- **Snap toggle per type** - Enable/disable snap to: playhead, segment edges, markers, grid

**Implementation:**
- Extend `getSnapTargets()` to collect edges from all tracks
- Add visual snap guide lines in timeline canvas
- Add snap preferences UI in toolbar

### 1.2 Smooth Playhead & Scrubbing
**Current:** Basic playhead movement, can be jerky during scrubbing.
**Missing:**
- **Inertial scrolling** - Smooth deceleration when releasing drag
- **Audio scrubbing** - Hear audio while dragging playhead (J-K-L style)
- **Frame-accurate scrubbing** - Snap to exact frames during slow drag
- **Auto-scroll timeline** - Smooth pan when playhead reaches edge

**Implementation:**
- Add `requestAnimationFrame` based smooth scrolling
- Implement audio context for scrub preview
- Add frame-snap mode toggle

### 1.3 Timeline Zoom & Navigation
**Current:** Basic zoom slider.
**Missing:**
- **Zoom to fit** - Auto-fit all content in view
- **Zoom to selection** - Focus on selected segment(s)
- **Pinch-to-zoom** - Trackpad gesture support
- **Minimap/overview** - Small timeline overview for long projects
- **Keyboard zoom** - `+`/`-` or scroll wheel with modifier

**Implementation:**
- Add zoom presets and fit-to-content calculation
- Implement wheel event handler with Ctrl modifier
- Create minimap component showing full timeline

---

## Phase 2: Advanced Editing Features (High Priority)

### 2.1 Freeze Frame
**Current:** Not implemented.
**Feature:**
- Right-click segment → "Add Freeze Frame"
- Creates a still image from current frame
- Insertable as new segment with configurable duration
- Option to freeze at playhead position or segment start/end

**Implementation:**
- Canvas frame capture from video element
- New segment type or use existing image handling
- Add to context menu and toolbar

### 2.2 Speed Ramping / Time Remapping
**Current:** Basic speed control (0.25x - 4x).
**Missing:**
- **Keyframeable speed** - Animate speed changes over time
- **Speed curve editor** - Bezier curves for smooth speed transitions
- **Reverse playback** - Negative speed values
- **Time freeze points** - Pause at specific moments

**Implementation:**
- Add speed keyframes to segment model
- Create speed curve UI (similar to keyframe inspector)
- Implement variable playback rate in preview

### 2.3 Multi-Select & Group Operations
**Current:** Single segment selection.
**Missing:**
- **Shift-click multi-select** - Select range of segments
- **Ctrl-click toggle select** - Add/remove from selection
- **Marquee/lasso selection** - Drag to select multiple items
- **Group/ungroup** - Treat multiple segments as one unit
- **Linked selection** - Auto-select linked audio when selecting video

**Implementation:**
- Add `selectedItems: Set<string>` state
- Implement selection rectangle rendering
- Add group data structure to project model

### 2.4 Copy/Paste/Duplicate
**Current:** Limited or not implemented.
**Missing:**
- **Copy segments** - Ctrl+C with all properties
- **Paste at playhead** - Ctrl+V inserts at current time
- **Paste in place** - Paste at original position
- **Duplicate** - Ctrl+D creates copy immediately after
- **Cross-track paste** - Paste to different track type

**Implementation:**
- Clipboard state management
- Serialize/deserialize segment data
- Add paste position logic

---

## Phase 3: Visual & UX Enhancements (Medium Priority)

### 3.1 Track Management
**Current:** Fixed track layout.
**Missing:**
- **Collapsible tracks** - Minimize tracks to save space
- **Track reordering** - Drag tracks to change z-order
- **Track locking** - Prevent accidental edits
- **Track solo/mute** - Quick audio isolation
- **Track colors** - Custom colors for organization
- **Track height adjustment** - Resize track heights

**Implementation:**
- Add track header controls
- Implement drag-to-reorder with visual feedback
- Add lock/mute/solo state to track model

### 3.2 Thumbnail Improvements
**Current:** Basic thumbnails on video segments.
**Missing:**
- **Filmstrip view** - Multiple thumbnails across segment length
- **Thumbnail density control** - Adjust based on zoom level
- **Audio-only visual** - Better representation for audio tracks
- **Loading placeholders** - Skeleton UI while generating

**Implementation:**
- Generate multiple thumbnails per segment
- Cache thumbnails efficiently
- Add density calculation based on zoom

### 3.3 Markers & Regions
**Current:** Not implemented.
**Missing:**
- **Timeline markers** - Named points for navigation
- **Marker colors** - Color-coded categories
- **In/Out points** - Define work area
- **Chapter markers** - For export metadata
- **Beat markers** - Auto-detect from audio

**Implementation:**
- Add markers array to project model
- Render markers in timeline ruler
- Add marker management UI

### 3.4 Improved Visual Feedback
**Current:** Basic hover/selection states.
**Missing:**
- **Ghost preview** - Show where item will land during drag
- **Ripple preview** - Visualize ripple effect before release
- **Collision indicators** - Highlight overlapping segments
- **Trim preview** - Show frame at trim point

**Implementation:**
- Add preview layer rendering
- Calculate and display affected segments
- Show frame thumbnail during trim

---

## Phase 4: Keyboard & Workflow (Medium Priority)

### 4.1 Professional Keyboard Shortcuts
**Current:** Basic shortcuts.
**Missing:**
- **J-K-L playback** - Industry-standard shuttle control
- **I/O for in/out** - Mark in/out points
- **Numpad navigation** - Frame-by-frame with numpad
- **Tool shortcuts** - V (move), C (razor), B (ripple), etc.
- **Customizable shortcuts** - User-defined bindings

**Implementation:**
- Comprehensive keydown handler
- Shortcut configuration storage
- Visual shortcut reference panel

### 4.2 Context Menus
**Current:** Basic context menu.
**Missing:**
- **Rich context menus** - More options per item type
- **Nested submenus** - Organized action groups
- **Recent actions** - Quick access to last used
- **Keyboard hints** - Show shortcuts in menu

**Implementation:**
- Expand context menu definitions
- Add submenu support
- Include shortcut labels

---

## Phase 5: Audio Enhancements (Medium Priority)

### 5.1 Audio Editing
**Current:** Basic volume, extract audio.
**Missing:**
- **Audio fade handles** - Drag corners for fade in/out
- **Crossfade between clips** - Automatic audio transitions
- **Audio ducking** - Auto-lower music under speech
- **Noise reduction** - Basic audio cleanup
- **Audio normalization** - Match levels across clips

**Implementation:**
- Add fade keyframes to audio segments
- Implement crossfade detection and rendering
- Integrate Web Audio API for processing

### 5.2 Waveform Enhancements
**Current:** Fixed waveform display.
**Missing:**
- **Stereo waveform** - Show L/R channels
- **Waveform zoom** - Vertical zoom for detail
- **Peak indicators** - Show clipping warnings
- **Spectral view** - Frequency visualization option

**Implementation:**
- Dual-channel waveform rendering
- Add vertical scale control
- Implement peak detection

---

## Phase 6: Performance & Polish (Ongoing)

### 6.1 Performance Optimizations
- **Virtual scrolling** - Only render visible track portions
- **Thumbnail caching** - IndexedDB storage for thumbnails
- **Waveform caching** - Pre-compute and cache waveforms
- **Debounced updates** - Reduce re-renders during drag
- **Web Workers** - Offload heavy computations

### 6.2 Accessibility
- **Keyboard navigation** - Full keyboard control
- **Screen reader support** - ARIA labels
- **High contrast mode** - Visibility options
- **Focus indicators** - Clear focus states

---

## Implementation Priority Order

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 🔴 High | Cross-track snapping | Medium | High |
| 🔴 High | Smooth playhead/scrubbing | Medium | High |
| 🔴 High | Freeze frame | Low | Medium |
| 🔴 High | Multi-select | Medium | High |
| 🟡 Medium | Copy/paste/duplicate | Low | High |
| 🟡 Medium | Track management (collapse/lock) | Medium | Medium |
| 🟡 Medium | Markers system | Medium | Medium |
| 🟡 Medium | J-K-L playback | Low | Medium |
| 🟡 Medium | Audio fade handles | Medium | Medium |
| 🟢 Low | Speed ramping | High | Medium |
| 🟢 Low | Minimap | Medium | Low |
| 🟢 Low | Filmstrip thumbnails | Medium | Low |

---

## Preserved Features (No Changes Needed)
✅ Manual region configuration for aspect ratios
✅ Creator profile watermarks
✅ Intro/outro video handling
✅ Existing undo/redo command system
✅ Current track types and overlay system

---

## Implementation Progress

- [x] Phase 1.1: Enhanced Snapping System ✅
- [x] Phase 1.2: Smooth Playhead & Scrubbing ✅
- [x] Phase 1.3: Timeline Zoom & Navigation ✅
- [x] Phase 2.1: Freeze Frame ✅
- [x] Phase 2.2: Speed Ramping ✅
- [x] Phase 2.3: Multi-Select & Group Operations ✅
- [x] Phase 2.4: Copy/Paste/Duplicate ✅
- [x] Phase 3.1: Track Management ✅
- [x] Phase 3.2: Thumbnail Improvements (Filmstrip) ✅
- [x] Phase 3.3: Markers & Regions ✅
- [x] Phase 3.4: Improved Visual Feedback (Ghost Preview) ✅
- [x] Phase 4.1: Professional Keyboard Shortcuts ✅
- [x] Phase 4.2: Context Menus (Keyboard Hints) ✅
- [x] Phase 5.1: Audio Editing (Fade Handles) ✅
- [x] Phase 5.2: Waveform Enhancements (Peak Indicators) ✅
- [x] Phase 6.1: Performance Optimizations (Debounce/Throttle) ✅
- [x] Phase 6.2: Accessibility (ARIA Labels) ✅

### Additional Features Implemented
- [x] Marquee/Lasso Selection - Drag on empty timeline area to select multiple clips ✅
- [x] Timeline Minimap - Overview navigation when zoomed in (>1.5x) ✅
- [x] Reverse Playback - Negative speed values (-0.5x, -1x, -2x, -4x) ✅

### Phase 1 Full Implementation (Complete)
- [x] Cross-Track Snapping - Snap to cuts/edges on layers above/below (CapCut-style) ✅
- [x] Magnetic Timeline - Segments attract to nearby edges within threshold (20px) ✅
- [x] Snap Indicators - Visual vertical lines showing snap points across all tracks ✅
- [x] Snap Toggle UI - Per-type toggles (playhead, segment edges, markers, grid) ✅
- [x] Inertial Scrolling - Smooth deceleration when releasing playhead drag ✅
- [x] Audio Scrubbing - Hear audio preview while dragging playhead (J-K-L style) ✅
- [x] Frame-Accurate Scrubbing - Snap to exact frames during slow drag ✅
- [x] Auto-Scroll Timeline - Smooth pan when playhead reaches edge ✅
- [x] Zoom to Fit - Auto-fit all content in view (Z key) ✅
- [x] Zoom to Selection - Focus on selected segment(s) (Shift+Z) ✅
- [x] Pinch-to-Zoom - Trackpad gesture support via ctrlKey detection ✅
- [x] Timeline Minimap - Overview navigation when zoomed in (>1.5x) ✅
- [x] Keyboard Zoom - Scroll wheel with Ctrl modifier or +/- buttons ✅

### Phase 2 Full Implementation (Complete)
- [x] Freeze Frame - Right-click source → Add Freeze Frame at playhead position ✅
- [x] Speed Keyframes - addSpeedKeyframe/updateSpeedKeyframe/deleteSpeedKeyframe events ✅
- [x] Speed Curve Editor - Visual bezier curve UI for speed transitions (SpeedCurveEditor.vue) ✅
- [x] Reverse Playback - J-K-L controls with negative speeds (-1x to -4x) ✅
- [x] Time Freeze Points - addFreezePoint/updateFreezePoint/deleteFreezePoint events ✅
- [x] Shift-Click Multi-Select - Select range of segments ✅
- [x] Ctrl-Click Toggle Select - Add/remove from selection ✅
- [x] Marquee/Lasso Selection - Drag on empty timeline to select multiple items ✅
- [x] Group/Ungroup - Ctrl+G to group, Ctrl+Shift+G to ungroup selected items ✅
- [x] Linked Selection - Auto-select linked audio when selecting video source ✅
- [x] Copy Segments - Ctrl+C with all properties ✅
- [x] Paste at Playhead - Ctrl+V inserts at current time ✅
- [x] Paste in Place - Ctrl+Shift+V pastes at original position ✅
- [x] Duplicate - Ctrl+D creates copy immediately after ✅
- [x] Cross-Track Paste - pasteItemsToTrack event for different track types ✅

### Phase 3 Full Implementation (Complete)
- [x] Collapsible Tracks - toggleTrackCollapse(), isTrackCollapsed() for minimizing tracks ✅
- [x] Track Reordering - Drag handle on audio tracks to change z-order ✅
- [x] Track Locking - Lock video/audio tracks to prevent accidental edits ✅
- [x] Track Solo/Mute - isSolo property, toggleTrackSolo() in AudioMixerTab ✅
- [x] Track Height Adjustment - getTrackHeight(), setTrackHeight(), resize handlers (32-200px) ✅
- [x] Track Colors - getTrackColor(), setTrackColor(), DEFAULT_TRACK_COLORS palette ✅
- [x] Filmstrip Thumbnails - getFilmstripThumbnails() for multiple thumbnails per segment ✅
- [x] Thumbnail Caching - thumbnailCache with zoom/container invalidation ✅
- [x] Adaptive Thumbnail Density - getAdaptiveThumbnailWidth() based on zoom level ✅
- [x] Loading Placeholders - Skeleton UI with animate-pulse while thumbnails load ✅
- [x] Marker Colors - Dynamic color support for color-coded marker categories ✅
- [x] In/Out Points - setInPoint, setOutPoint, clearInOutPoints events ✅
- [x] Chapter Markers - addChapterMarker, updateChapterMarker, deleteChapterMarker events ✅
- [x] Beat Markers - detectBeatMarkers, clearBeatMarkers events for audio analysis ✅
- [x] Regions/Ranges - addRegion, updateRegion, deleteRegion events for work areas ✅
- [x] Ghost Preview - getGhostPreviewStyle() shows original position during drag ✅
- [x] Trim Preview Tooltip - trimPreviewInfo shows IN/OUT time during resize ✅
- [x] Snap Guides - Snap indicator line with activeSnapTime ✅
- [x] Ripple Preview - rippleAffectedIds highlights segments affected by ripple edit ✅

### Phase 4 Full Implementation (Complete)
- [x] J-K-L Playback - Industry-standard shuttle control with jklPlaybackSpeed ✅
- [x] I/O In/Out Points - Set in/out points with I and O keys ✅
- [x] Tool Shortcuts - V (move), C (razor), B (ripple), N (roll), Y (slip), U (slide) ✅
- [x] Arrow Key Navigation - Frame-by-frame seeking with ArrowLeft/ArrowRight ✅
- [x] Numpad Navigation - Numpad 4/6 (1 frame), 1/3 (10 frames), 7/9 (1 second), 5/0 (start/end), 2/8 (in/out) ✅
- [x] Customizable Shortcuts - useKeyboardShortcuts composable with localStorage persistence ✅
- [x] Rich Context Menus - Source and segment context menus with full options ✅
- [x] Nested Submenus - Speed submenu with reverse/forward options ✅
- [x] Keyboard Hints - Shortcuts displayed in context menu items ✅
- [x] Recent Actions - trackRecentAction(), executeRecentAction() for quick access ✅

### Phase 5 Full Implementation (Complete)
- [x] Audio Fade Handles - Drag corners for fade in/out with visual overlays ✅
- [x] Crossfade Between Clips - Full crossfade animation system with smooth transitions ✅
- [x] Audio Ducking - enableAudioDucking(), disableAudioDucking() with threshold/reduction/attack/release ✅
- [x] Noise Reduction - applyNoiseReduction() with strength and sensitivity options ✅
- [x] Audio Normalization - normalizeAudio(), normalizeAllAudio() with target level ✅
- [x] Stereo Waveform - waveformDisplayMode ('mono'/'stereo'), toggleStereoWaveform() ✅
- [x] Waveform Vertical Zoom - waveformVerticalZoom (0.5-3.0), setWaveformVerticalZoom() ✅
- [x] Peak Indicators - Clipping warnings with color coding (red/orange thresholds) ✅
- [x] Spectral View - waveformViewMode ('waveform'/'spectral'), toggleSpectralView() ✅

### Phase 6 Full Implementation (Complete)
- [x] Thumbnail Caching - thumbnailCache in SourcesTab, StickersTab, WatermarkTab, Timeline ✅
- [x] Waveform Caching - getCachedSourceWaveform() with database storage ✅
- [x] Debounced Updates - debounce(), throttle(), debouncedRenderWaveforms, throttledSeek ✅
- [x] Virtual Scrolling - virtualScrollState, isItemVisible(), updateVisibleTimeRange() ✅
- [x] Web Workers - audioProcessingWorker.ts for offloading heavy computations ✅
- [x] useAudioWorker Composable - processWaveform, analyzeAudio, detectBeats, calculatePeaks ✅
- [x] ARIA Labels - aria-label, aria-selected on video/audio clips ✅
- [x] Keyboard Focus - tabindex, focus:ring styles for accessibility ✅
- [x] Screen Reader Announcements - announceToScreenReader(), screenReaderAnnouncement ✅
- [x] High Contrast Mode - highContrastMode, toggleHighContrastMode(), getHighContrastColor() ✅

---

## Keyboard Shortcuts Implemented

| Key | Action |
|-----|--------|
| `J` | Play backward / decrease speed |
| `K` | Pause/stop |
| `L` | Play forward / increase speed |
| `Space` | Toggle play/pause |
| `M` | Add marker at playhead |
| `I` | Set in point |
| `O` | Set out point |
| `+`/`=` | Zoom in |
| `-` | Zoom out |
| `Z` | Zoom to fit |
| `Shift+Z` | Zoom to selection |
| `Ctrl+C` | Copy selected items |
| `Ctrl+V` | Paste at playhead |
| `Ctrl+D` | Duplicate selected items |
| `V` | Move tool |
| `C` | Razor tool |
| `B` | Ripple edit tool |
| `N` | Roll edit tool |
| `Y` | Slip edit tool |
| `U` | Slide edit tool |
| `Delete`/`Backspace` | Delete selected item |
| `X` or `Ctrl+K` | Cut at playhead |
| `Escape` | Deactivate tool / return to move |
| `Ctrl+G` | Group selected items |
| `Ctrl+Shift+G` | Ungroup selected group |
