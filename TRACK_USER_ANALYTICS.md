# TODO: Track User Analytics

## Overview
Implement comprehensive user analytics tracking to monitor VOD downloads by platform and other user activity metrics in the admin dashboard.

## Background
During the admin user profile enhancement (Feb 25, 2026), we discovered that the database does not have a dedicated table for tracking VOD downloads with platform information. The current `processing_jobs` table tracks video processing but lacks platform metadata (Twitch, YouTube, Kick, PumpFun).

**IMPORTANT**: Clippster is a desktop application where **clips are stored client-side** in each user's local Tauri database, not in the server PostgreSQL database. There is no `clips` table on the server. This means:
- ❌ **Clips Detected**: Cannot track (stored locally on user's machine)
- ❌ **Clips Built**: Cannot track (stored locally on user's machine)
- ✅ **Posts Made**: CAN track via `user_posts` table (posts are submitted to server)
- ❌ **VODs Downloaded**: Cannot track (no table exists, would need implementation)

## Required Implementation

### 1. Database Schema
Create a new migration to add a table for tracking user video downloads:

```elixir
create table(:user_video_downloads) do
  add :user_id, references(:users, on_delete: :delete_all), null: false
  add :platform, :string, null: false  # "Twitch", "Youtube", "Kick", "PumpFun"
  add :video_url, :text
  add :video_id, :string
  add :video_title, :string
  add :duration_seconds, :integer
  add :download_source, :string  # "vod", "clip", "livestream"
  
  timestamps(type: :utc_datetime)
end

create index(:user_video_downloads, [:user_id])
create index(:user_video_downloads, [:platform])
create index(:user_video_downloads, [:user_id, :platform])
```

### 2. Backend Changes

#### Schema Module
- Create `ClippsterServer.Analytics.VideoDownload` schema
- Add associations and validations

#### Context Functions
- `Analytics.track_video_download/2` - Record a new download
- `Analytics.get_user_download_stats/1` - Get stats by platform
- `Analytics.get_platform_breakdown/1` - Get detailed platform breakdown

#### Admin Controller Updates
Update `get_user_profile/2` in `admin_controller.ex`:

```elixir
vods_by_platform = Repo.all(
  from(v in "user_video_downloads",
    where: v.user_id == ^user_id,
    group_by: v.platform,
    select: {v.platform, count(v.id)}
  )
) |> Enum.into(%{})

stats = %{
  vods_downloaded: %{
    total: Enum.sum(Map.values(vods_by_platform)),
    twitch: Map.get(vods_by_platform, "Twitch", 0),
    youtube: Map.get(vods_by_platform, "Youtube", 0),
    kick: Map.get(vods_by_platform, "Kick", 0),
    pumpfun: Map.get(vods_by_platform, "PumpFun", 0)
  },
  clips_detected: ...,
  clips_built: ...,
  posts_made: ...
}
```

### 3. Frontend Changes

#### AdminUserProfile.vue
Add VOD statistics display with platform breakdown:

```vue
<div class="info-list-item">
  <div class="info-list-item__label">VODs Downloaded</div>
  <div class="info-list-item__value">{{ user.statistics.vods_downloaded?.total || 0 }}</div>
</div>
<div v-if="user.statistics.vods_downloaded?.total > 0" class="platform-breakdown">
  <div v-if="user.statistics.vods_downloaded.twitch > 0" class="platform-stat">
    <span class="platform-name">Twitch:</span>
    <span class="platform-count">{{ user.statistics.vods_downloaded.twitch }}</span>
  </div>
  <!-- Repeat for YouTube, Kick, PumpFun -->
</div>
```

CSS styles for platform breakdown already exist in the file (lines 1495-1521).

### 4. Integration Points
Track downloads in the following locations:
- Twitch VOD download handler
- YouTube video download handler
- Kick video download handler
- PumpFun video download handler
- Any other video ingestion endpoints

### 5. Additional Considerations
- Add cleanup/retention policy for old download records
- Consider adding download success/failure status
- Track file size and processing time for analytics
- Add date range filtering for admin dashboard

## Files to Modify
- `server/priv/repo/migrations/YYYYMMDDHHMMSS_create_user_video_downloads.exs` (new)
- `server/lib/clippster_server/analytics/video_download.ex` (new)
- `server/lib/clippster_server/analytics.ex` (update)
- `server/lib/clippster_server_web/controllers/admin_controller.ex` (update)
- `client/src/pages/admin/AdminUserProfile.vue` (update)
- Video download handlers across the codebase (integrate tracking)

## Priority
Medium - This is a nice-to-have feature for admin analytics but not critical for core functionality.

## Related
- Admin user profile enhancement (completed Feb 25, 2026)
- User statistics tracking system
