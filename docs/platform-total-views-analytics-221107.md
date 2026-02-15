# Platform Total Views Analytics

Add a "Total Platform Views" metric to the admin analytics page that aggregates view counts from all posts published through Clippster across all users and organizations.

## Current State Analysis

### Existing View Tracking Systems

The platform currently tracks views across **4 separate tables**:

1. **`post_submissions`** - Organization posts published via connected social accounts
   - Fields: `view_count`, `like_count`, `comment_count`, `save_count`, `reach_count`, `impressions_count`
   - Scope: Organization-owned posts published through org social accounts
   - Status: `published` posts only

2. **`external_post_submissions`** - Link submissions from users
   - Fields: `view_count`, `like_count`, `comment_count`, `share_count`, `save_count`
   - Scope: Users submit links to posts they made on personal accounts
   - Status: `approved` posts only (pending/rejected excluded)

3. **`campaign_submissions`** - Campaign clip submissions
   - Fields: `view_count`, `like_count`, `comment_count`, `share_count`, `save_count`
   - Scope: Clips submitted to clipping campaigns
   - Status: `verified` or `paid` posts only

4. **`user_posts`** - Personal user posts via connected accounts
   - Fields: `view_count`, `like_count`, `comment_count`, `save_count`, `reach_count`, `impressions_count`
   - Scope: Individual users posting through their connected clipper social accounts
   - Status: `published` posts only

### Analytics Sync System

- **`AnalyticsSyncWorker`** - Background worker that syncs analytics from social platforms
- Currently runs **on-demand only** (no automatic hourly sync)
- Syncs both organization posts and user posts
- Uses platform-specific API modules (Instagram, Twitter, etc.)
- Respects rate limits and implements exponential backoff

### Current Admin Analytics Page

- **Location**: `client/src/pages/admin/AdminAnalytics.vue`
- **Backend**: `server/lib/clippster_server_web/controllers/analytics_controller.ex`
- **Displays**: Internal platform events (clip_detection, clip_export, vod_download, user_created, credits_purchased, credits_spent)
- **Missing**: Social media post views aggregation

## Implementation Plan

### Phase 1: Backend - Aggregation Function

**File**: `server/lib/clippster_server/analytics.ex`

Add new function `get_platform_views_summary/0`:
```elixir
def get_platform_views_summary do
  # Aggregate from post_submissions (published org posts)
  org_posts_views = from(p in PostSubmission,
    where: p.status == "published",
    select: %{
      total_posts: count(p.id),
      total_views: sum(p.view_count),
      total_likes: sum(p.like_count),
      total_comments: sum(p.comment_count)
    }
  ) |> Repo.one()

  # Aggregate from external_post_submissions (approved link submissions)
  external_posts_views = from(e in ExternalPostSubmission,
    where: e.status == "approved",
    select: %{
      total_posts: count(e.id),
      total_views: sum(e.view_count),
      total_likes: sum(e.like_count),
      total_comments: sum(e.comment_count)
    }
  ) |> Repo.one()

  # Aggregate from campaign_submissions (verified/paid campaign clips)
  campaign_posts_views = from(c in CampaignSubmission,
    where: c.status in ["verified", "paid"],
    select: %{
      total_posts: count(c.id),
      total_views: sum(c.view_count),
      total_likes: sum(c.like_count),
      total_comments: sum(c.comment_count)
    }
  ) |> Repo.one()

  # Aggregate from user_posts (published personal posts)
  user_posts_views = from(u in UserPost,
    where: u.status == "published",
    select: %{
      total_posts: count(u.id),
      total_views: sum(u.view_count),
      total_likes: sum(u.like_count),
      total_comments: sum(u.comment_count)
    }
  ) |> Repo.one()

  # Combine all sources
  %{
    total_posts: (org_posts_views.total_posts || 0) + (external_posts_views.total_posts || 0) + 
                 (campaign_posts_views.total_posts || 0) + (user_posts_views.total_posts || 0),
    total_views: (org_posts_views.total_views || 0) + (external_posts_views.total_views || 0) + 
                 (campaign_posts_views.total_views || 0) + (user_posts_views.total_views || 0),
    total_likes: (org_posts_views.total_likes || 0) + (external_posts_views.total_likes || 0) + 
                 (campaign_posts_views.total_likes || 0) + (user_posts_views.total_likes || 0),
    total_comments: (org_posts_views.total_comments || 0) + (external_posts_views.total_comments || 0) + 
                    (campaign_posts_views.total_comments || 0) + (user_posts_views.total_comments || 0),
    breakdown: %{
      org_posts: org_posts_views,
      external_posts: external_posts_views,
      campaign_posts: campaign_posts_views,
      user_posts: user_posts_views
    }
  }
end
```

**Imports needed**:
- `alias ClippsterServer.Social.{PostSubmission, ExternalPostSubmission}`
- `alias ClippsterServer.Campaigns.{CampaignSubmission, UserPost}`

### Phase 2: Backend - API Endpoint

**File**: `server/lib/clippster_server_web/controllers/analytics_controller.ex`

Add new endpoint `platform_views/2`:
```elixir
@doc """
Get platform-wide view statistics (admin only).
"""
def platform_views(conn, _params) do
  summary = Analytics.get_platform_views_summary()
  
  json(conn, %{
    success: true,
    data: summary
  })
end
```

**File**: `server/lib/clippster_server_web/router.ex`

Add route in `api_admin` scope:
```elixir
scope "/api/admin", ClippsterServerWeb do
  pipe_through [:api, :api_auth, :api_admin]
  
  # ... existing routes ...
  get "/analytics/platform-views", AnalyticsController, :platform_views
end
```

### Phase 3: Frontend - API Service

**File**: `client/src/services/analytics.ts`

Add new function:
```typescript
export interface PlatformViewsSummary {
  total_posts: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  breakdown: {
    org_posts: { total_posts: number; total_views: number; total_likes: number; total_comments: number };
    external_posts: { total_posts: number; total_views: number; total_likes: number; total_comments: number };
    campaign_posts: { total_posts: number; total_views: number; total_likes: number; total_comments: number };
    user_posts: { total_posts: number; total_views: number; total_likes: number; total_comments: number };
  };
}

export async function getPlatformViews(): Promise<PlatformViewsSummary> {
  const response = await api.get('/admin/analytics/platform-views');
  return response.data.data;
}
```

### Phase 4: Frontend - UI Component

**File**: `client/src/pages/admin/AdminAnalytics.vue`

**Changes**:

1. Add new reactive state:
```typescript
const platformViews = ref<PlatformViewsSummary | null>(null);
```

2. Add fetch function:
```typescript
const fetchPlatformViews = async () => {
  try {
    const views = await getPlatformViews();
    platformViews.value = views;
  } catch (err) {
    console.error('Error fetching platform views:', err);
    platformViews.value = null;
  }
};
```

3. Call in `onMounted` and `fetchAnalyticsStats`:
```typescript
onMounted(() => {
  fetchAnalyticsStats();
  fetchPlatformViews();
});

const fetchAnalyticsStats = async () => {
  // ... existing code ...
  await fetchPlatformViews(); // Add this
};
```

4. Add new hero card at the top (before analytics grid):
```vue
<!-- Platform Views Hero Card -->
<div v-if="platformViews" class="admin-analytics__hero-card">
  <div class="admin-analytics__hero-header">
    <div class="admin-analytics__hero-icon">
      <Eye class="admin-analytics__hero-icon-svg" />
    </div>
    <div>
      <h2 class="admin-analytics__hero-title">Total Platform Views</h2>
      <p class="admin-analytics__hero-subtitle">Across all clips posted from Clippster</p>
    </div>
  </div>
  
  <div class="admin-analytics__hero-stats">
    <div class="admin-analytics__hero-stat admin-analytics__hero-stat--primary">
      <p class="admin-analytics__hero-stat-label">Total Views</p>
      <p class="admin-analytics__hero-stat-value">{{ formatNumber(platformViews.total_views) }}</p>
    </div>
    <div class="admin-analytics__hero-stat">
      <p class="admin-analytics__hero-stat-label">Total Posts</p>
      <p class="admin-analytics__hero-stat-value">{{ formatNumber(platformViews.total_posts) }}</p>
    </div>
    <div class="admin-analytics__hero-stat">
      <p class="admin-analytics__hero-stat-label">Total Likes</p>
      <p class="admin-analytics__hero-stat-value">{{ formatNumber(platformViews.total_likes) }}</p>
    </div>
    <div class="admin-analytics__hero-stat">
      <p class="admin-analytics__hero-stat-label">Total Comments</p>
      <p class="admin-analytics__hero-stat-value">{{ formatNumber(platformViews.total_comments) }}</p>
    </div>
  </div>
  
  <!-- Breakdown by source -->
  <div class="admin-analytics__hero-breakdown">
    <h3 class="admin-analytics__breakdown-title">Breakdown by Source</h3>
    <div class="admin-analytics__breakdown-grid">
      <div class="admin-analytics__breakdown-item">
        <p class="admin-analytics__breakdown-label">Organization Posts</p>
        <p class="admin-analytics__breakdown-value">{{ formatNumber(platformViews.breakdown.org_posts.total_views) }} views</p>
      </div>
      <div class="admin-analytics__breakdown-item">
        <p class="admin-analytics__breakdown-label">Link Submissions</p>
        <p class="admin-analytics__breakdown-value">{{ formatNumber(platformViews.breakdown.external_posts.total_views) }} views</p>
      </div>
      <div class="admin-analytics__breakdown-item">
        <p class="admin-analytics__breakdown-label">Campaign Clips</p>
        <p class="admin-analytics__breakdown-value">{{ formatNumber(platformViews.breakdown.campaign_posts.total_views) }} views</p>
      </div>
      <div class="admin-analytics__breakdown-item">
        <p class="admin-analytics__breakdown-label">Personal Posts</p>
        <p class="admin-analytics__breakdown-value">{{ formatNumber(platformViews.breakdown.user_posts.total_views) }} views</p>
      </div>
    </div>
  </div>
</div>
```

5. Add helper function:
```typescript
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};
```

6. Add imports:
```typescript
import { Eye } from 'lucide-vue-next';
import { getPlatformViews, type PlatformViewsSummary } from '@/services/analytics';
```

7. Add CSS styles for hero card:
```css
.admin-analytics__hero-card {
  padding: 2rem;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(20, 184, 166, 0.15) 100%);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.admin-analytics__hero-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.admin-analytics__hero-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(20, 184, 166, 0.3) 100%);
  border: 1px solid rgba(16, 185, 129, 0.4);
}

.admin-analytics__hero-icon-svg {
  width: 28px;
  height: 28px;
  color: #34d399;
}

.admin-analytics__hero-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
}

.admin-analytics__hero-subtitle {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

.admin-analytics__hero-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.admin-analytics__hero-stat {
  padding: 1rem;
  background-color: rgba(39, 39, 42, 0.5);
  border-radius: 10px;
  border: 1px solid rgba(39, 39, 42, 0.8);
}

.admin-analytics__hero-stat--primary {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(20, 184, 166, 0.2) 100%);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.admin-analytics__hero-stat-label {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-analytics__hero-stat--primary .admin-analytics__hero-stat-label {
  color: rgba(52, 211, 153, 0.8);
}

.admin-analytics__hero-stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
}

.admin-analytics__hero-stat--primary .admin-analytics__hero-stat-value {
  color: #34d399;
}

.admin-analytics__hero-breakdown {
  padding-top: 1.5rem;
  border-top: 1px solid rgba(16, 185, 129, 0.2);
}

.admin-analytics__breakdown-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-analytics__breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.admin-analytics__breakdown-item {
  padding: 0.75rem;
  background-color: rgba(39, 39, 42, 0.3);
  border-radius: 8px;
}

.admin-analytics__breakdown-label {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0 0 0.25rem;
}

.admin-analytics__breakdown-value {
  font-size: 1rem;
  font-weight: 600;
  color: #34d399;
  margin: 0;
}
```

## Data Flow Summary

1. **Data Collection**: Views are tracked in 4 tables as posts are published/submitted
2. **Analytics Sync**: `AnalyticsSyncWorker` periodically fetches updated metrics from social platforms
3. **Aggregation**: New `get_platform_views_summary/0` function sums views across all 4 tables
4. **API**: New `/api/admin/analytics/platform-views` endpoint returns aggregated data
5. **Display**: Admin analytics page shows prominent hero card with total views + breakdown

## Files to Create

None - all modifications to existing files.

## Files to Modify

| File | Changes |
|------|---------|
| `server/lib/clippster_server/analytics.ex` | Add `get_platform_views_summary/0` function, add imports for post schemas |
| `server/lib/clippster_server_web/controllers/analytics_controller.ex` | Add `platform_views/2` endpoint |
| `server/lib/clippster_server_web/router.ex` | Add `/admin/analytics/platform-views` route |
| `client/src/services/analytics.ts` | Add `PlatformViewsSummary` interface and `getPlatformViews()` function |
| `client/src/pages/admin/AdminAnalytics.vue` | Add hero card UI, fetch logic, helper functions, CSS styles |

## Testing Checklist

- [ ] Backend aggregation returns correct totals from all 4 tables
- [ ] API endpoint requires admin authentication
- [ ] Frontend displays formatted numbers (K/M suffixes)
- [ ] Breakdown shows correct source-specific view counts
- [ ] Refresh button updates platform views
- [ ] Handles zero views gracefully
- [ ] Handles null/undefined values in database (uses `|| 0` fallback)

## Future Enhancements

- Add date range filtering (last 7 days, 30 days, all time)
- Add platform breakdown (Instagram vs Twitter vs TikTok)
- Add trend indicators (% change from previous period)
- Export to CSV functionality
- Real-time updates via WebSocket
