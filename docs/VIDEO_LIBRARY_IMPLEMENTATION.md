# Video Library Page Implementation Plan

Create a new "Video Library" page for regular YouTube and Rumble videos (not livestreams/VODs), separate from the existing VOD Library.

## User Requirements

1. **Navigation**: Video Library will be in sidebar below "VOD Library" and above "Built Clips"
2. **Page Name**: "Video Library"
3. **Visibility**: Both VOD Library and Video Library should be visible
4. **Content Separation**: Downloads from "Live Streams" tab → VOD Library, downloads from "Videos" tab → Video Library

## Context

The app currently has:
- **VOD Library** (`/projects` - `Projects.vue`): Handles livestream VODs from PumpFun, Kick, Twitch, YouTube, and Rumble
- **Stream VODs** (`/vods` - `StreamVods.vue`): Search interface with tabs for "Live Streams" vs "Videos" (YouTube/Rumble)
- **Tab State**: `StreamVods.vue` tracks `youtubeTab` and `rumbleTab` state ('streams' | 'videos')
- **Download Flow**: `startDownload()` in `useDownloads.ts` accepts a `provider` parameter

The new Video Library will be for **regular videos** downloaded from YouTube and Rumble (not live streams).

## Key Discovery: Tab-Based Routing

`StreamVods.vue` already has tab state:
- `youtubeTab: ref<'streams' | 'videos'>('streams')` (line 553)
- `rumbleTab: ref<'streams' | 'videos'>('streams')` (line 556)
- This tab state is passed to `platformStore.searchClips()` (lines 947-950)
- Downloads are initiated with `provider` parameter (line 1173)

**Solution**: Pass the current tab state along with the download to determine video type.

## Database Strategy

Add a `video_type` column to `raw_videos` and `projects` tables:
- `'livestream'` - VODs from live streams (downloads from "Live Streams" tab)
- `'video'` - Regular videos (downloads from "Videos" tab)
- `null` - Legacy/unknown (treat as livestream for backward compatibility)

## Implementation Steps

### 1. Database Schema Update
**Files to modify**:
- `client/src/services/database/core.ts` - Add migration for `video_type` column
- `client/src/services/database/raw-videos.ts` - Update `createRawVideo()` to accept `videoType` parameter
- `client/src/services/database/projects.ts` - Add `video_type` column and query helpers
- `client/src/services/database/types.ts` - Add `video_type` to `RawVideo` and `Project` interfaces

Add migration to:
- Add `video_type` column to `raw_videos` table: `'livestream' | 'video' | null`
- Add `video_type` column to `projects` table: `'livestream' | 'video' | null`
- Update existing records to `'livestream'` for backward compatibility (or leave as `null`)

### 2. Update StreamVods.vue Download Flow
**File**: `client/src/pages/StreamVods.vue`

Modify `downloadClipConfirmed()` function (around line 1158):
- Determine `videoType` based on current tab state:
  - If `detectedPlatform === 'YouTube'` and `youtubeTab === 'videos'` → `videoType: 'video'`
  - If `detectedPlatform === 'rumble'` and `rumbleTab === 'videos'` → `videoType: 'video'`
  - Otherwise → `videoType: 'livestream'`
- Pass `videoType` to `startDownload()` in options object

### 3. Update useDownloads.ts
**File**: `client/src/composables/useDownloads.ts`

Modify `startDownload()` function (line 420):
- Add `videoType?: 'livestream' | 'video'` to options parameter
- Store `videoType` in `ActiveDownload` interface
- Pass `videoType` to `createProject()` and `createRawVideo()` calls
- Ensure `videoType` is persisted through download completion flow

### 3. Create Video Library Page
**File**: `client/src/pages/VideoLibrary.vue`

Create new page based on `Projects.vue` structure but:
- **Title**: "Video Library" instead of "VOD Library"
- **Description**: "Manage your downloaded YouTube and Rumble videos"
- **Filter**: Only show projects/videos where `video_type = 'video'`
- **No Live Indicators**: Remove live stream badges/status
- **Platform Icons**: YouTube and Rumble only
- **Same Features**: Search, sort, filters, thumbnails, detection, transcription, workspace

### 4. Update Projects.vue (VOD Library)
**File**: `client/src/pages/Projects.vue`

Add filter to only show:
- Projects where `video_type = 'livestream'` OR `video_type IS NULL` (backward compatibility)
- Keep all existing functionality (live indicators, platform badges, etc.)

### 5. Router Configuration
**File**: `client/src/router/index.ts`

Add new route:
```typescript
{
  path: '/videos',
  name: 'videos',
  component: () => import('@/layouts/DashboardLayout.vue'),
  children: [
    {
      path: '',
      name: 'videos-home',
      component: () => import('@/pages/VideoLibrary.vue'),
    },
  ],
}
```

### 6. Navigation Updates
**File**: `client/src/config/navigation.ts`

Add new navigation item in the `navigationItems` array:
- Insert after "VOD Library" (line 87-91) and before "Built Clips" (line 93-97)
- Use same group: `'create'`
- Icon: `Video` (imported from lucide-vue-next)
- Path: `/videos`
- Name: `'Video Library'`

```typescript
{
  name: 'Video Library',
  path: '/videos',
  icon: Video,
  group: 'create',
},
```

### 7. Database Query Functions
**File**: `client/src/services/database/projects.ts`

Add helper functions:
- `getVideoLibraryProjects()` - Get projects with `video_type = 'video'`
- Update `getAllProjects()` or create `getVodLibraryProjects()` to filter by `video_type = 'livestream' OR video_type IS NULL`

These functions will be used by:
- `VideoLibrary.vue` - to fetch only regular video projects
- `Projects.vue` - to fetch only livestream VOD projects

### 8. StreamVods.vue Integration
**File**: `client/src/pages/StreamVods.vue`

When downloading from YouTube "Videos" tab or Rumble "Videos" tab:
- Pass `videoType: 'video'` to download function
- These will appear in Video Library, not VOD Library

### 9. Testing Checklist
- [ ] Download YouTube video → appears in Video Library
- [ ] Download YouTube livestream VOD → appears in VOD Library
- [ ] Download Rumble video → appears in Video Library
- [ ] Download Rumble livestream VOD → appears in VOD Library
- [ ] Existing VODs still appear in VOD Library (backward compatibility)
- [ ] Both libraries support: detection, transcription, workspace, deletion
- [ ] Search/filter works in both libraries
- [ ] Platform badges show correctly

## File Structure Summary

**New Files**:
- `client/src/pages/VideoLibrary.vue` - Main video library page (copy of Projects.vue with modifications)

**Modified Files**:
- `client/src/services/database/core.ts` - Migration for `video_type` column
- `client/src/services/database/types.ts` - Add `video_type` to `RawVideo` interface
- `client/src/services/database/raw-videos.ts` - Update `createRawVideo()` signature
- `client/src/services/database/projects.ts` - Add query helpers for filtering by video type
- `client/src/composables/useDownloads.ts` - Pass `videoType` to `createRawVideo()`
- `client/src/pages/Projects.vue` - Filter to only show livestream VODs
- `client/src/pages/StreamVods.vue` - Pass `videoType` based on tab selection
- `client/src/router/index.ts` - Add `/videos` route
- Navigation component - Add Video Library menu item

## Design Considerations

### UI Consistency
- Use same card design, layout, and styling as VOD Library
- Maintain consistent actions: detect clips, transcribe, workspace, delete
- Same search/filter/sort functionality

### User Experience
- Clear separation between livestream VODs and regular videos
- Easy navigation between both libraries
- Consistent terminology throughout the app

### Backward Compatibility
- Existing VODs (with `video_type = null`) continue to appear in VOD Library
- No data migration required for existing users
- Graceful handling of missing `video_type` column in older databases

## Implementation Order

1. **Database Schema** - Add `video_type` columns and migrations
2. **Types & Interfaces** - Update TypeScript interfaces
3. **Download Flow** - Update `StreamVods.vue` to pass tab state as `videoType`
4. **useDownloads** - Accept and persist `videoType` parameter
5. **Database Queries** - Add filtering functions for video type
6. **VideoLibrary.vue** - Create new page (copy of Projects.vue with filters)
7. **Projects.vue** - Add filter to only show livestream VODs
8. **Navigation** - Add Video Library menu item
9. **Router** - Add `/videos` route
10. **Testing** - Verify downloads route to correct library
