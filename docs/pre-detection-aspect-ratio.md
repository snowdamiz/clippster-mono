# Pre-detection Aspect Ratio — VOD Preset Editor System

Add a "Pre-Edit" button on Projects.vue that lets users configure aspect ratio, POI framing, layout overlays (borders/dividers), and watermark settings **before** clip detection — so every detected clip inherits those settings automatically. Templates are saveable and optionally tied to a creator profile. Includes video scrubbing for region selection and respects creator profile watermark restrictions.

---

## Concepts

| Term | What it is |
|------|-----------|
| **VOD Preset** | A saved template: aspect ratio + POI framing regions + layout overlays + watermark preference |
| **Layout Overlay** | An uploaded image (PNG) positioned in the target frame — e.g., a decorative bar between speakers. Part of the framing. |
| **Watermark** | Branding overlay from creator profile or custom upload. Separate from layout overlays; both can coexist. |
| **Creator Profile Restriction** | If a project has a creator profile attached, users CANNOT add custom watermarks — only use creator profile watermark or none. |

---

## Phase 1 — Database & Types

### 1a. New `vod_presets` table (SQLite migration)

```sql
CREATE TABLE IF NOT EXISTS vod_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  creator_profile_id TEXT,           -- nullable; if set, only shown for this creator
  target_aspect_ratio TEXT NOT NULL,  -- "9:16", "4:5", "1:1", "16:9"
  framing_config TEXT,               -- JSON: ManualFramingConfig (regions)
  layout_overlays TEXT,              -- JSON: LayoutOverlay[] (border/divider images)
  watermark_mode TEXT NOT NULL DEFAULT 'creator', -- 'creator' | 'custom' | 'none'
  custom_watermark_settings TEXT,    -- JSON: WatermarkSettings (when mode='custom')
  user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (creator_profile_id) REFERENCES creator_profiles(id) ON DELETE SET NULL
);
```

### 1b. New column on `projects` table

```sql
ALTER TABLE projects ADD COLUMN active_vod_preset_id TEXT;
ALTER TABLE projects ADD COLUMN active_vod_preset_config TEXT; -- JSON snapshot of applied preset
```

- `active_vod_preset_id`: Links to saved preset (for quick re-apply)
- `active_vod_preset_config`: Inline JSON snapshot so the build always has the exact config even if the preset is later edited

### 1c. TypeScript types (`client/src/types/index.ts`)

```ts
export interface LayoutOverlay {
  id: string;
  imagePath: string;           // Local file path to uploaded PNG
  x: number;                   // 0-100 percentage position (center-based)
  y: number;                   // 0-100 percentage position (center-based)
  width: number;               // 0-100 percentage of target frame width
  height: number;              // 0-100 percentage of target frame height
  opacity: number;             // 0-100
  rotation: number;            // degrees
  label?: string;              // "Speaker Divider", etc.
}

export interface VodPreset {
  id: string;
  name: string;
  creatorProfileId: string | null;
  targetAspectRatio: string;
  framingConfig: ManualFramingConfig | null;
  layoutOverlays: LayoutOverlay[];
  watermarkMode: 'creator' | 'custom' | 'none';
  customWatermarkSettings: WatermarkSettings | null;
  createdAt: number;
  updatedAt: number;
}

export interface ActiveVodPresetConfig {
  presetId: string | null;         // reference to saved preset (null if one-off)
  targetAspectRatio: string;
  framingConfig: ManualFramingConfig | null;
  layoutOverlays: LayoutOverlay[];
  watermarkMode: 'creator' | 'custom' | 'none';
  customWatermarkSettings: WatermarkSettings | null;
  // Note: If project has creator profile, watermarkMode is forced to 'creator' and cannot be changed
}
```

### 1d. Database service (`client/src/services/database/vod-presets.ts`)

CRUD operations:
- `createVodPreset(preset)` / `updateVodPreset(id, updates)` / `deleteVodPreset(id)`
- `getAllVodPresets()` — all presets for current user
- `getVodPresetsByCreator(creatorProfileId)` — presets tied to a creator
- `getVodPresetsUnlinked()` — presets not tied to any creator (global templates)
- `setProjectVodPreset(projectId, presetId, configSnapshot)` — apply to project
- `clearProjectVodPreset(projectId)` — remove from project
- `getProjectVodPresetConfig(projectId)` — read current config

---

## Phase 2 — VOD Preset Editor Dialog

### New component: `client/src/components/VodPresetEditor.vue`

A multi-section dialog opened from Projects.vue. Reuses existing POI components.

**Layout (3 sections in a single dialog):**

#### Section 1: Aspect Ratio & Template
- Aspect ratio selector: 16:9, 9:16, 1:1, 4:5
- Template picker: dropdown of saved presets (filtered by creator if project has one)
- "Save as Template" / "Update Template" buttons

#### Section 2: Framing (reuses POI components)
- Embeds `POISourcePanel` + `POITargetPanel` side-by-side (same layout as `ManualPOIEditor`)
- **Full video playback with scrubbing**: Users can scrub through several minutes of the source video to select regions accurately
- Source video loaded via the existing video server (same as ManualPOIEditor)
- User defines crop regions on source → positions them in the target aspect ratio
- For a simple "full frame in 9:16" use case, a single region covering the full source is enough

#### Section 3: Layout Overlays
- Upload button to add overlay images (PNG/SVG) — e.g., a horizontal bar
- Each overlay gets positioned in the target preview via drag & drop
- Position/size/opacity controls per overlay
- Visual preview: overlays render on top of the POI target panel output
- These are composited into the FRAMING, not the watermark layer

#### Section 4: Watermark
- **Creator profile restriction**: If project has a creator profile attached, ONLY show:
  - Toggle: "Use creator profile watermark" (enabled by default, uses creator's settings, **CANNOT be disabled**)
  - **"No watermark" option is HIDDEN** when creator profile is attached
  - **Custom watermark option is HIDDEN** when creator profile is attached
- If NO creator profile attached, show all options:
  - Toggle: "Add custom watermark" (opens watermark upload/position UI)
  - Toggle: "No watermark"
- This is the BRANDING layer — separate from layout overlays
- If creator profile has per-ratio watermark settings, those are shown/editable but cannot be disabled

**Props:**
- `projectId` — to load video, thumbnail, creator profile
- `initialConfig` — existing `ActiveVodPresetConfig` if editing
- Emits `confirm(config: ActiveVodPresetConfig)` and `save-template(preset: VodPreset)`

---

## Phase 3 — Projects.vue Integration

### 3a. "Pre-Edit" button on project cards

Add a new hover action button (next to Transcribe) with a `Crop` or `Layout` icon:

```vue
<button
  v-if="hasDirectVideos(project.id) || hasChildren(project.id)"
  class="project-card__action-btn"
  :class="{ 'project-card__action-btn--active': hasVodPreset(project.id) }"
  title="Pre-Edit VOD"
  @click.stop="openVodPresetEditor(project)"
>
  <LayoutDashboard class="project-card__action-icon" />
</button>
```

- Button appears on any project with videos
- Highlighted/badged when a preset is active
- Also add to the folder dialog segment actions

### 3b. State & functions in Projects.vue

```ts
const showVodPresetEditor = ref(false);
const vodPresetProject = ref<Project | null>(null);
const vodPresetInitialConfig = ref<ActiveVodPresetConfig | null>(null);

function openVodPresetEditor(project: Project) { ... }
function onVodPresetConfirmed(config: ActiveVodPresetConfig) { ... }
function hasVodPreset(projectId: string): boolean { ... }
```

### 3c. Visual indicator on project card

When a project has an active VOD preset, show a small badge/chip on the card:
- "9:16 Pre-Edit" or similar
- Shows the configured aspect ratio

---

## Phase 4 — Build Pipeline Integration

### 4a. Auto-apply preset during clip build

When building a clip, check if the parent project has an `active_vod_preset_config`. If so:

1. **Aspect ratio**: Pre-select the preset's target ratio (user can still add/remove ratios)
2. **Framing**: Use the preset's `ManualFramingConfig` as the `manual_framing_configs` parameter
3. **Layout overlays**: Pass to FFmpeg as overlay filter inputs (same approach as sticker/watermark compositing)
4. **Watermark**: Apply based on `watermarkMode`:
   - `'creator'` → use creator profile watermark settings
   - `'custom'` → use `customWatermarkSettings`
   - `'none'` → no watermark

### 4b. ClipBuildSettingsDialog changes

- When opened, if project has a VOD preset, pre-populate all fields from the preset
- Show a note: "Using VOD Pre-Edit settings from [preset name]"
- User can override any setting per-clip (the preset is a default, not a lock)
- Add "layout overlays" display in the export/framing step

### 4c. Rust orchestrator changes

The `build_clip_internal_simple` function already accepts `manual_framing_configs` and `watermark_settings`. Need to add:

- New parameter: `layout_overlays: Option<Vec<LayoutOverlaySettings>>` — serializable struct with image path, position, size, opacity
- FFmpeg compositing: After framing/crop, overlay each layout image using the `overlay` filter (same pattern as sticker/watermark application)
- Order: Base video → Framing/crop → Layout overlays → Subtitles → Watermark (watermark always on top)

### 4d. New Rust types (`client/src-tauri/src/clips/types.rs`)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutOverlaySettings {
    pub image_path: String,
    pub x_percent: f64,      // 0-100
    pub y_percent: f64,      // 0-100
    pub width_percent: f64,  // 0-100
    pub height_percent: f64, // 0-100
    pub opacity: f64,        // 0-100
    pub rotation: f64,       // degrees
}
```

---

## Phase 5 — Batch Build Support

When a project has a VOD preset and the user builds multiple clips:

- All clips in the project default to the preset's settings
- The existing batch build flow in `Projects.vue` (`onProjectDetectClipsConfirmed`) passes preset config to each clip build
- `MediaPanel` / `ClipBuildSettingsDialog` should show the preset indicator

---

## Phase 6 — Aspect Ratio Display in Clip Views

### 6a. ClipsTab.vue aspect ratio display
When a project has an active VOD preset, clips should be displayed in the configured aspect ratio by default:

```ts
// In ClipsTab.vue, when loading clip preview
const previewAspectRatio = computed(() => {
  // Check if project has VOD preset
  const vodConfig = getProjectVodPresetConfig(props.projectId);
  if (vodConfig?.targetAspectRatio) {
    // Parse aspect ratio string like "9:16" → { width: 9, height: 16 }
    const [w, h] = vodConfig.targetAspectRatio.split(':').map(Number);
    return { width: w, height: h };
  }
  
  // Fallback to clip's built aspect ratio or 16:9
  return clipAspectRatio.value || { width: 16, height: 9 };
});
```

- Update clip preview containers to use `previewAspectRatio` instead of default 16:9
- Add a small indicator on clip cards showing the configured aspect ratio (e.g., "9:16 Preset")
- When user clicks "Build", the aspect ratios from the VOD preset are pre-selected but can still be changed

### 6b. ProjectWorkspaceDialog.vue aspect ratio display
The workspace dialog should respect the VOD preset aspect ratio:

```ts
// In ProjectWorkspaceDialog.vue
const selectedAspectRatio = ref({ width: 16, height: 9 });

// Load VOD preset aspect ratio when project loads
watch(() => props.project?.id, async (projectId) => {
  if (projectId) {
    const vodConfig = await getProjectVodPresetConfig(projectId);
    if (vodConfig?.targetAspectRatio) {
      const [w, h] = vodConfig.targetAspectRatio.split(':').map(Number);
      selectedAspectRatio.value = { width: w, height: h };
    }
  }
});
```

- VideoPlayer component already accepts `aspectRatio` prop, so just pass the VOD preset aspect ratio
- Add a visual indicator in the workspace header showing the active preset aspect ratio
- Allow users to temporarily override the aspect ratio for preview (but build still uses preset defaults)

### 6c. Clip preview thumbnail aspect ratio
When generating clip thumbnails for display in ClipsTab:

- If project has VOD preset, render thumbnails in the preset's aspect ratio
- This gives users accurate visual feedback of how clips will look
- Store aspect ratio info with clip metadata for quick display

---

## Phase 7 — Template Management

### 7a. Template save/load in VodPresetEditor

- "Save as Template" button → prompts for name + optional creator attachment
- "Load Template" dropdown → shows saved presets filtered by:
  - Templates attached to the project's creator profile
  - Global templates (no creator)
- "Update Template" → overwrites existing preset

### 7b. Templates accessible from Creator Profile settings

- In the creator profile management UI, add a "VOD Presets" section
- Shows templates attached to that creator
- Can create/edit/delete from there too

---

## File Changes Summary

| File | Change |
|------|--------|
| `client/src/services/database/migrations/` | New migration for `vod_presets` table + `projects.active_vod_preset_id/config` columns |
| `client/src/services/database/vod-presets.ts` | **NEW** — CRUD for vod_presets |
| `client/src/services/database/projects.ts` | Add `setProjectVodPreset`, `getProjectVodPresetConfig` |
| `client/src/services/database/index.ts` | Export new service |
| `client/src/types/index.ts` | Add `LayoutOverlay`, `VodPreset`, `ActiveVodPresetConfig` types |
| `client/src/components/VodPresetEditor.vue` | **NEW** — Main editor dialog with video scrubbing |
| `client/src/components/VodPresetOverlayPanel.vue` | **NEW** — Layout overlay upload/position UI |
| `client/src/components/poi/POITargetPanel.vue` | Add layout overlay rendering in preview |
| `client/src/pages/Projects.vue` | Add Pre-Edit button, dialog state, indicator badge |
| `client/src/components/ClipsTab.vue` | Load preset aspect ratio for clip previews, add preset indicators |
| `client/src/components/ClipBuildSettingsDialog.vue` | Pre-populate from VOD preset, show overlays |
| `client/src/components/ProjectWorkspaceDialog.vue` | Load preset aspect ratio for video player, add preset indicator |
| `client/src/components/MediaPanel.vue` | Show preset indicator, pass to build |
| `client/src-tauri/src/clips/types.rs` | Add `LayoutOverlaySettings` struct |
| `client/src-tauri/src/clips/orchestrator.rs` | Accept + apply layout overlays in build pipeline |
| `client/src-tauri/src/clips/video_processor.rs` | FFmpeg overlay filter for layout images |

---

## Implementation Order

1. **Phase 1** — Database + Types (foundation)
2. **Phase 2** — VodPresetEditor dialog (UI, reuses POI components with video scrubbing)
3. **Phase 3** — Projects.vue button + state wiring
4. **Phase 4** — Build pipeline (Rust + frontend auto-apply)
5. **Phase 5** — Batch build support
6. **Phase 6** — Aspect ratio display in ClipsTab + ProjectWorkspaceDialog
7. **Phase 7** — Template management & creator profile integration

Estimated: ~17-22 files touched, ~2500-3500 lines of new code.
