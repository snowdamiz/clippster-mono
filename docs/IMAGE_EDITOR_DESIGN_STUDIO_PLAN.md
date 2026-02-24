# Image Editor & Design Studio

Full-featured image editor ("Design Studio") added as a new sidebar tab under AI Video, reusing the OpenCut canvas renderer, with deep integrations into clips, campaigns, creator profiles, the video editor, and the landing web app.

---

## Architecture Decision

**Reuse the OpenCut `EditorCore` + `CanvasRenderer`** in a static-image mode. The editor already handles images, text (28 presets, bubbles, gradients, glow, stroke), stickers (Iconify), filters, effects, color adjustments, chromakey, keyframes, and interactive preview manipulation (drag/resize/rotate). We create a thin wrapper that:

- Initializes `EditorCore` with a single-frame project (no playback/audio managers active)
- Sets `canvasSize` from chosen aspect ratio or custom dimensions
- Exposes the same `AssetsPanel` tabs (text, stickers, filters, effects, adjustments) plus new image-specific tabs (templates, brand kit, AI tools)
- Renders to canvas at time=0 (static frame)
- Exports via `canvas.toBlob()` for PNG/SVG/WebP instead of FFmpeg

This gives us **all existing editor features for free** — text effects, stickers, filters, color adjustments, chromakey, interactive preview overlay — without duplicating rendering logic.

---

## Phases

### Phase 1: Core Image Editor Page & Navigation

**Goal**: Standalone image editor page accessible from sidebar, can create/edit images with all existing editor tools.

**Files to create:**
- `client/src/pages/ImageEditor.vue` — Main page (like `OpenCutEditor.vue` but static-image mode)
- `client/src/editor/bridge/image-project-loader.ts` — Creates an EditorCore project in image mode (no video tracks, single image track, time=0)
- `client/src/editor/composables/useImageMode.ts` — Composable that adapts EditorCore for static image editing (disables playback, timeline scrubbing, audio; exposes export-as-image)

**Files to modify:**
- `client/src/config/navigation.ts` — Add "Design Studio" item with `ImageIcon` under create group, positioned after AI Video
- `client/src/router/index.ts` — Add `/design-studio` route
- `client/src/editor/core/index.ts` — Add `imageMode` flag so playback/audio managers skip initialization
- `client/src/editor/components/EditorLayout.vue` — Conditionally hide timeline panel when in image mode
- `client/src/editor/components/EditorHeader.vue` — Show "Export Image" instead of "Export Video" in image mode; add format selector (PNG/SVG/WebP)
- `client/src/editor/components/panels/assets/SettingsView.vue` — Add image-specific canvas presets (YouTube Thumbnail 1280×720, Instagram Post 1080×1080, TikTok Cover 1080×1920, Twitter Banner 1500×500, Twitch Offline 1920×1080, Custom)

**Canvas presets for images:**
| Preset | Dimensions | Use Case |
|--------|-----------|----------|
| YouTube Thumbnail | 1280×720 | Video thumbnails |
| Instagram Post | 1080×1080 | Square social posts |
| Instagram Story | 1080×1920 | Stories/Reels covers |
| TikTok Cover | 1080×1920 | TikTok video covers |
| Twitter/X Banner | 1500×500 | Profile banners |
| Twitch Offline | 1920×1080 | Stream offline screens |
| Stream Poster | 1080×1350 | 4:5 promotional |
| Custom | User-defined | Anything |

### Phase 2: Image Import & Frame Extraction

**Goal**: Users can upload images, pull thumbnails from clips, or extract frames from any video.

**Files to create:**
- `client/src/editor/components/panels/assets/ImageSourcesView.vue` — New asset panel tab for image sources: Upload, From Clip, From Video Frame, From URL
- `client/src/composables/useFrameExtractor.ts` — Extract a frame at a specific timestamp from a video file (reuse existing Tauri `get_video_frame` command or canvas capture)

**Files to modify:**
- `client/src/editor/components/panels/AssetsPanel.vue` — Add "Sources" tab for image imports
- `client/src/services/database/image-assets.ts` — Add `source_type` field (upload/clip_thumbnail/frame_extract/generated), `source_clip_id`, `source_project_id` columns
- `client/src/services/database/types.ts` — Update `ImageAsset` type with new fields

**SQLite migration:**
- Add `source_type`, `source_clip_id`, `source_project_id`, `canvas_width`, `canvas_height`, `export_format` columns to `image_assets` table

### Phase 3: Template Library

**Goal**: Pre-built templates for common use cases. Users pick a template and customize.

**Files to create:**
- `client/src/editor/components/panels/assets/TemplatesView.vue` — Template browser with category tabs and preview grid
- `client/src/editor/constants/image-template-constants.ts` — Template definitions (JSON project snapshots with placeholder text/images)
- `client/src/editor/lib/template-loader.ts` — Loads a template into EditorCore, replacing placeholder content

**Template categories:**
- **Thumbnails** — YouTube, TikTok, Instagram (bold text + background image)
- **Stream Graphics** — Going Live, BRB, Offline screens, Starting Soon
- **Social Banners** — Twitter/X header, YouTube channel art, Twitch panels
- **Campaign Assets** — Logo placements, promotional banners, event posters
- **Watermarks/Overlays** — Corner logos, full-frame overlays, lower thirds

Each template is a serialized EditorCore project JSON with tagged placeholder elements (e.g., `{{TITLE}}`, `{{SUBTITLE}}`, `{{LOGO}}`).

### Phase 4: Brand Kit Integration

**Goal**: When editing under an org context, auto-load org brand assets (logos, colors, fonts, watermarks).

**Files to create:**
- `client/src/editor/components/panels/assets/BrandKitView.vue` — Shows org logos, color palette, fonts, watermarks; drag-to-canvas
- `client/src/editor/composables/useBrandKit.ts` — Fetches org assets via `organizationsApi`, caches locally, provides reactive brand data

**Files to modify:**
- `client/src/editor/components/panels/AssetsPanel.vue` — Add "Brand" tab (only visible when org context active)
- `client/src/services/database/organization-assets.ts` — Reuse existing org asset fetching

### Phase 5: Image Gallery ("My Images")

**Goal**: Dedicated gallery page for all created images, filterable by type.

**Files to create:**
- `client/src/pages/ImageGallery.vue` — Grid view of all saved images with filters (type, date, size), preview, re-edit, delete
- `client/src/components/ImageCard.vue` — Card component for image gallery (thumbnail, name, dimensions, type badge)

**Files to modify:**
- `client/src/config/navigation.ts` — Could be a sub-section of Design Studio or separate "My Images" under create group
- `client/src/router/index.ts` — Add route
- `client/src/services/database/image-assets.ts` — Add `image_type` field (thumbnail/watermark/overlay/banner/poster/logo/custom), filtering queries

### Phase 6: Clip Cover Image Integration

**Goal**: Apply created images as cover thumbnails to built clips. Free tier: 2 per 24 hours.

**Files to modify:**
- `client/src/pages/Clips.vue` — Add "Set Cover" action to `BuildCard` context menu; opens image picker dialog
- `client/src/components/BuildCard.vue` — Add cover image overlay on thumbnail, "Set Cover" button
- `client/src/services/database/clips.ts` — Add `cover_image_id` and `cover_image_path` columns to clips table
- `client/src/services/database/types.ts` — Update `Clip` type
- `client/src/composables/useFreeTierLimits.ts` — Add `image_apply` action with limit of 2/day

**Files to create:**
- `client/src/components/ImagePickerDialog.vue` — Dialog to pick from My Images gallery or create new; shows preview of how cover will look
- `client/src/composables/useCoverImage.ts` — Composable for applying cover image to a clip (generates new built clip with cover burned in via FFmpeg, or stores as metadata for social platforms)

**Rust/Tauri:**
- `client/src-tauri/src/cover_image.rs` — FFmpeg command to burn cover image as first frame or generate a new clip file with cover. For platforms that support separate thumbnails (YouTube, TikTok), just store the image path as metadata.

### Phase 7: Video Editor Integration

**Goal**: Pull images from gallery into the OpenCut video editor as timeline elements.

**Files to modify:**
- `client/src/editor/components/panels/assets/BuiltClipsView.vue` — Rename or extend to "My Media" showing both clips AND images from gallery
- `client/src/editor/bridge/project-loader.ts` — Support loading image assets from the image gallery into editor media panel

This mostly works already since the editor supports `ImageElement` on the timeline. The integration is about making gallery images easily accessible from within the video editor's asset panel.

### Phase 8: Watermark/Overlay Creator → Creator Profile Integration

**Goal**: Create watermarks/overlays in the image editor and apply them directly to creator profiles.

**Files to create:**
- `client/src/components/ImageEditorWatermarkDialog.vue` — Specialized dialog that opens the image editor in "watermark mode" (transparent background, overlay-specific presets, aspect ratio selector for which ratios to target)

**Files to modify:**
- `client/src/components/ProfileDialog.vue` — Add "Create in Editor" button next to watermark upload; opens image editor in watermark mode, saves result to watermarks table
- `client/src/components/WatermarkPositionPicker.vue` — Add "Edit in Studio" button to open selected watermark in image editor for refinement
- `client/src/services/database/watermarks.ts` — Link watermarks to image_assets via `source_image_id`

**Watermark mode specifics:**
- Transparent background (checkerboard pattern in preview)
- Aspect ratio selector: create for 16:9, 9:16, 1:1, 4:5, or "all" (generates variants)
- Export as PNG with alpha channel
- Auto-save to watermarks table on export

### Phase 9: Image Campaign System

**Goal**: New campaign type for image deliverables (logos, banners, thumbnails, stream posters).

#### Server (Elixir/Phoenix)

**Files to create:**
- `server/priv/repo/migrations/XXXXXX_add_image_campaigns.exs` — Migration adding `campaign_type` (clip/image) to `clipping_campaigns`, `image_categories` array field, `required_dimensions` map; add `image_url`, `image_width`, `image_height` to `campaign_submissions`

**Files to modify:**
- `server/lib/clippster_server/campaigns/campaign.ex` — Add `campaign_type` field with values `clip` | `image`, `image_categories` (array of: logo/banner/thumbnail/poster/overlay/watermark), `required_dimensions` map
- `server/lib/clippster_server/campaigns/campaign_submission.ex` — Add `image_url`, `image_width`, `image_height` fields; make `clip_url` optional (required for clip campaigns, `image_url` required for image campaigns)
- `server/lib/clippster_server_web/controllers/campaign_controller.ex` — Update create/update to accept `campaign_type` and image-specific fields; update submission to accept image uploads
- `server/lib/clippster_server_web/router.ex` — Add image upload endpoint for campaign submissions

#### Client (Tauri)

**Files to modify:**
- `client/src/services/campaignApi.ts` — Add `campaign_type`, `image_categories`, `required_dimensions` to `Campaign` type; add `image_url` to `CampaignSubmission`; add `submitImage()` function
- `client/src/pages/Campaigns.vue` (or equivalent) — Show campaign type badge (Clip/Image), filter by type
- Organization campaign creation UI — Add campaign type selector, image category checkboxes, dimension requirements

**Files to create:**
- `client/src/components/CampaignImageSubmitDialog.vue` — Dialog for submitting an image to a campaign: pick from gallery or create new in editor, validates dimensions match requirements, uploads to server

#### Landing (React)

**Files to modify:**
- `landing/src/services/campaignApi.ts` — Add image campaign types and submission functions
- `landing/src/pages/dashboard/OrgCampaigns.tsx` — Add campaign type selector in creation form, show type badges
- `landing/src/types/organization.ts` — Update Campaign type

**Files to create:**
- `landing/src/components/dashboard/CampaignImageSubmitDialog.tsx` — React version of image submission dialog (upload-only, no editor — editor is desktop-only)

### Phase 10: AI Image Tools (Paid Tier)

**Goal**: AI-powered image editing features gated behind Creator+ tier.

**Files to create:**
- `client/src/editor/components/panels/assets/AIImageToolsView.vue` — AI tools panel: Background Removal, AI Fill/Extend, Text-to-Image backgrounds, Auto-Layout suggestions
- `client/src/composables/useAIImageTools.ts` — Composable wrapping OpenRouter/API calls for image AI features
- `server/lib/clippster_server_web/controllers/ai_image_controller.ex` — Endpoints for AI image operations (background removal, generation)
- `server/lib/clippster_server_web/router.ex` — Add AI image routes

**AI Features:**
- **Background Removal** — Remove background from uploaded images (useful for watermarks, stickers)
- **AI Fill/Extend** — Extend image canvas with AI-generated content (outpainting)
- **Text-to-Image** — Generate background images from text prompts
- **Auto-Layout** — AI suggests element placement based on content type
- **Smart Resize** — AI-aware content-aware resize when changing aspect ratios

### Phase 11: Social Preview Mode

**Goal**: Live preview of how the image will look on each social platform.

**Files to create:**
- `client/src/editor/components/preview/SocialPreviewOverlay.vue` — Overlay showing platform-specific safe zones, text cutoff guides, and mockup frames (TikTok feed card, IG grid, YouTube search result, etc.)

**Files to modify:**
- `client/src/editor/components/preview/PreviewPanel.vue` — Add social preview toggle button in image mode

### Phase 12: Batch Operations

**Goal**: Apply watermarks/covers to multiple clips at once.

**Files to create:**
- `client/src/components/BatchImageApplyDialog.vue` — Select multiple clips → pick an image → apply as cover to all selected
- `client/src/composables/useBatchImageApply.ts` — Handles batch processing with progress tracking

**Files to modify:**
- `client/src/pages/Clips.vue` — Add "Apply Cover" to bulk selection actions bar

### Phase 13: Landing Web App Image Editor (Lite)

**Goal**: Basic image editing in the browser for org members (no Tauri dependency).

The landing app is React + web-only. We can't reuse EditorCore directly (it's Vue + Tauri). Instead:

**Files to create:**
- `landing/src/pages/dashboard/OrgImageEditor.tsx` — Lightweight canvas-based image editor using a React canvas library (e.g., Fabric.js or Konva.js)
- `landing/src/components/dashboard/ImageEditorCanvas.tsx` — Canvas component with basic tools (text, shapes, upload, resize, export)
- `landing/src/hooks/useImageEditor.ts` — Editor state management

**Scope for landing**: Upload images, add text, basic shapes, resize, export PNG. No AI tools, no templates (those are desktop-only premium features). Enough to create simple campaign submissions and view/manage image assets.

---

## Free Tier Limits

| Action | Free Tier Limit | Paid Tier |
|--------|----------------|-----------|
| Image creation/export | Unlimited basic | Unlimited |
| Apply cover to clip | 2/day | Unlimited |
| AI image tools | Blocked | Creator+ |
| Templates | 3 basic only | All templates |
| Brand Kit | Blocked | Starter+ |
| Campaign participation | Blocked | Starter+ |
| Batch operations | Blocked | Creator+ |
| Social preview | Available | Available |

**Files to modify for tier gating:**
- `client/src/composables/useFreeTierLimits.ts` — Add `image_apply: 2` to `FREE_TIER_LIMITS`
- `client/src/router/index.ts` — Add `requiredTier` meta where needed
- `server/lib/clippster_server_web/controllers/ai_image_controller.ex` — Creator+ gate on AI endpoints

---

## Database Changes Summary

### SQLite (Client)

**`image_assets` table updates:**
- `image_type` TEXT (thumbnail/watermark/overlay/banner/poster/logo/custom)
- `source_type` TEXT (upload/clip_thumbnail/frame_extract/ai_generated/template)
- `source_clip_id` TEXT (FK to clips)
- `source_project_id` TEXT (FK to projects)
- `canvas_width` INTEGER
- `canvas_height` INTEGER
- `export_format` TEXT (png/svg/webp)
- `editor_project_json` TEXT (serialized EditorCore project for re-editing)

**`clips` table updates:**
- `cover_image_id` TEXT (FK to image_assets)
- `cover_image_path` TEXT

### PostgreSQL (Server)

**`clipping_campaigns` table updates:**
- `campaign_type` VARCHAR DEFAULT 'clip' (clip/image)
- `image_categories` TEXT[] DEFAULT '{}' (logo/banner/thumbnail/poster/overlay/watermark)
- `required_dimensions` JSONB (e.g., `{"min_width": 1280, "min_height": 720, "aspect_ratio": "16:9"}`)

**`campaign_submissions` table updates:**
- `image_url` VARCHAR (for image campaign submissions)
- `image_width` INTEGER
- `image_height` INTEGER
- Make `clip_url` nullable (only required for clip campaigns)

---

## Implementation Order

1. **Phase 1** — Core editor page + navigation (foundation)
2. **Phase 2** — Image import + frame extraction (content in)
3. **Phase 5** — Image gallery (content management)
4. **Phase 3** — Template library (productivity boost)
5. **Phase 6** — Clip cover integration (key user value)
6. **Phase 7** — Video editor integration (cross-feature)
7. **Phase 8** — Watermark/overlay → creator profiles (existing feature enhancement)
8. **Phase 4** — Brand kit (org feature)
9. **Phase 9** — Image campaigns (server + client + landing)
10. **Phase 11** — Social preview (polish)
11. **Phase 10** — AI tools (premium feature)
12. **Phase 12** — Batch operations (power user)
13. **Phase 13** — Landing web app lite editor (web parity)
