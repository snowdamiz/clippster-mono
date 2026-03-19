# Campaign Branding Flow - Complete Architecture

## Current State Analysis

### 1. Org Creator Profile Branding (Detection/Download Time)

**How it works:**
- When user downloads VOD or auto-detects from live stream
- System checks if user has org-assigned creator profile via `getMyAssignedCreatorProfiles()`
- Branding is applied based on hierarchy in `useBrandingProfileSelection.ts`:
  1. **Org streamer match** - If org has creator profile for this specific streamer
  2. **Org member default** - If user has assigned branding profile from org
  3. **Org global branding** - If org has global branding profiles
  4. **Personal global** - User's own global branding
  5. **Streamer profile** - Local streamer-specific profile

**Storage:**
- Project has `selected_branding_profile_id` field
- References local `creator_profiles` table
- Org profiles are converted to local format via `serverProfileToLocal()`

**Assets Applied:**
- `intro_id` - Intro video
- `outro_id` - Outro video  
- `watermark_id` - Watermark image
- `watermark_settings` - Per-ratio watermark config
- `layout_overlays` - Overlay graphics

---

### 2. Campaign Branding (Build Time)

**Current Implementation:**
- `ClipBuildSettingsDialog.vue` has Add-ons section (Step 4)
- Checkbox: "This clip is for a campaign"
- Campaign dropdown appears when checked
- Shows available campaigns from `getCampaignsByCreatorProfile()`

**Campaign Types:**
1. **Specific Creator Profile Campaigns** - `creator_profile_id` set
2. **Global Branding Campaigns** - `creator_profile_id: null`, `branding_profile_id` set

**What's Missing:**
- Campaign branding does NOT override org branding yet
- No `clip_builds` table to track which branding was applied
- Build dialog doesn't actually apply campaign branding to export

---

## Required Changes

### 1. Campaign Override Logic

**When user checks "This clip is for a campaign":**
- Campaign branding MUST completely replace org branding
- Org watermark → Campaign watermark (or none)
- Org intro/outro → Campaign intro/outro (or none)
- Org overlays → Campaign overlays (or none)

**Implementation:**
```typescript
// In build settings dialog
if (isForCampaign && selectedCampaign) {
  // Get campaign branding profile
  const campaignBrandingProfile = await getCampaignBrandingProfile(selectedCampaign);
  
  // Override ALL org branding
  buildConfig.intro_id = campaignBrandingProfile.intro_id;
  buildConfig.outro_id = campaignBrandingProfile.outro_id;
  buildConfig.watermark_id = campaignBrandingProfile.watermark_id;
  buildConfig.watermark_settings = campaignBrandingProfile.watermark_settings;
  buildConfig.layout_overlays = campaignBrandingProfile.layout_overlays;
} else {
  // Use org branding (already set from project's selected_branding_profile_id)
  buildConfig = getOrgBrandingFromProject(projectId);
}
```

---

### 2. Database Schema - `clip_builds` Table

**Purpose:** Track each build of a clip with its branding context

```sql
CREATE TABLE clip_builds (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Build output
  built_file_path TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL, -- '16:9', '9:16', '1:1', '4:5'
  
  -- Branding context
  branding_type TEXT NOT NULL, -- 'org' | 'campaign' | 'personal' | 'none'
  campaign_id INTEGER, -- NULL if not campaign build
  branding_profile_id TEXT, -- Which profile's assets were used
  
  -- Build settings snapshot
  quality TEXT NOT NULL, -- 'low' | 'medium' | 'high'
  frame_rate INTEGER NOT NULL, -- 30 | 60
  output_format TEXT NOT NULL, -- 'mp4' | 'mov'
  
  -- Branding assets used (for reference)
  intro_asset_id TEXT,
  outro_asset_id TEXT,
  watermark_asset_id TEXT,
  
  -- Metadata
  file_size INTEGER,
  duration_seconds REAL,
  build_status TEXT NOT NULL DEFAULT 'building', -- 'building' | 'completed' | 'failed'
  error_message TEXT,
  
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

CREATE INDEX idx_clip_builds_clip_id ON clip_builds(clip_id);
CREATE INDEX idx_clip_builds_campaign_id ON clip_builds(campaign_id);
CREATE INDEX idx_clip_builds_status ON clip_builds(build_status);
```

---

### 3. UI Changes

**Projects.vue - Clip List:**
- Show badge on clips with campaign builds: "Campaign Build"
- Show which campaign(s) clip was built for
- Allow rebuilding same clip for different campaign

**ClipBuildSettingsDialog.vue - Add-ons Section:**
- Keep existing campaign checkbox/dropdown
- Add warning text: "Campaign branding will replace all org branding"
- Show preview of what will be applied:
  - ✓ Campaign intro/outro
  - ✓ Campaign watermark
  - ✗ Org intro/outro (crossed out)
  - ✗ Org watermark (crossed out)

---

### 4. Export/Build Logic Changes

**Current Flow:**
1. User clicks "Build Clip"
2. `ClipBuildSettingsDialog` opens
3. User configures settings
4. Calls `build_clip_from_segments` Tauri command
5. FFmpeg builds video with org branding

**New Flow:**
1. User clicks "Build Clip"
2. `ClipBuildSettingsDialog` opens
3. User selects campaign (optional)
4. **Resolve branding profile:**
   - If campaign selected → Use campaign's `branding_profile_id`
   - Else → Use project's `selected_branding_profile_id` (org branding)
5. **Pass branding to build command:**
   ```typescript
   await invoke('build_clip_from_segments', {
     projectId,
     clipId,
     aspectRatio,
     brandingProfileId: resolvedBrandingProfileId,
     campaignId: selectedCampaign?.id || null,
     // ... other settings
   });
   ```
6. **Create `clip_builds` record:**
   ```typescript
   await createClipBuild({
     clip_id: clipId,
     project_id: projectId,
     built_file_path: outputPath,
     aspect_ratio: aspectRatio,
     branding_type: selectedCampaign ? 'campaign' : 'org',
     campaign_id: selectedCampaign?.id || null,
     branding_profile_id: resolvedBrandingProfileId,
     // ... settings
   });
   ```

---

### 5. Campaign Branding Resolution

**For Global Branding Campaigns:**
```typescript
// Campaign has creator_profile_id: null, branding_profile_id: 123
const campaign = await getCampaign(campaignId);

if (campaign.creator_profile_id === null && campaign.branding_profile_id) {
  // Global branding campaign
  const brandingProfile = await getOrganizationCreatorProfile(
    campaign.organization_id,
    campaign.branding_profile_id
  );
  
  // Use this profile's assets
  return {
    intro_id: brandingProfile.intro_id,
    outro_id: brandingProfile.outro_id,
    watermark_id: brandingProfile.watermark_id,
    watermark_settings: brandingProfile.watermark_settings,
    layout_overlays: brandingProfile.layout_overlays,
  };
}
```

**For Specific Creator Profile Campaigns:**
```typescript
// Campaign has creator_profile_id: 456
const campaign = await getCampaign(campaignId);

if (campaign.creator_profile_id) {
  const creatorProfile = await getOrganizationCreatorProfile(
    campaign.organization_id,
    campaign.creator_profile_id
  );
  
  return {
    intro_id: creatorProfile.intro_id,
    outro_id: creatorProfile.outro_id,
    watermark_id: creatorProfile.watermark_id,
    watermark_settings: creatorProfile.watermark_settings,
    layout_overlays: creatorProfile.layout_overlays,
  };
}
```

---

## Legacy Cleanup Required

### Remove Campaign Selection from Detection/Download

**Files to check:**
1. `LiveClip.vue` - Remove campaign selection before auto-detection starts
2. `StreamVods.vue` - Remove campaign selection before VOD download
3. `livestream.ts` store - Remove `setSessionCampaign()` if exists

**Verification:**
- Search for campaign selection dialogs before clip creation
- Ensure clips are created with `campaign_id: null`
- Campaign association only happens at build/post time

---

## Complete User Flow

### Example: User A in Org with Jerzy Profile

**1. Detection/Download:**
- User A downloads VOD from xQc stream
- System checks: User A has org-assigned profile "Jerzy"
- Project created with `selected_branding_profile_id: jerzy_profile_id`
- Clips created (raw, no campaign)

**2. Build for Personal Use:**
- User opens clip in editor
- Clicks "Build Clip"
- Does NOT check "This clip is for a campaign"
- Build uses Jerzy profile branding (org watermark, intro, outro)
- `clip_builds` record: `branding_type: 'org'`, `campaign_id: null`

**3. Build for Campaign:**
- User clicks "Build Clip" again (same clip)
- Checks "This clip is for a campaign"
- Selects "Global Branding Campaign"
- Campaign has `branding_profile_id: clippster_profile_id`
- Build uses Clippster profile branding (campaign watermark, intro, outro)
- **Jerzy branding is NOT applied**
- `clip_builds` record: `branding_type: 'campaign'`, `campaign_id: 123`

**4. Post to Social:**
- User posts campaign build to TikTok
- Selects same campaign in post dialog
- Campaign submission created with clip URL

**Result:**
- Same raw clip has 2 builds
- Personal build with Jerzy branding
- Campaign build with Clippster branding
- User can see both builds in Projects view

---

## Implementation Checklist

- [ ] Create `clip_builds` table migration
- [ ] Add `clip_builds` database service functions
- [ ] Update `ClipBuildSettingsDialog.vue` to resolve campaign branding
- [ ] Add campaign branding override logic to build command
- [ ] Create `clip_builds` record after successful build
- [ ] Update Projects.vue to show campaign build badges
- [ ] Add campaign branding preview in build dialog
- [ ] Remove legacy campaign selection from VOD/auto-detection
- [ ] Test: Org branding applied by default
- [ ] Test: Campaign branding overrides org branding
- [ ] Test: Same clip can be built multiple times
- [ ] Test: Global branding campaigns work correctly
