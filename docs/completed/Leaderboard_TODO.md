# Leaderboard Implementation TODO

## Current Status: Partially Implemented

The leaderboard UI is in place but the data pipeline for tracking views from clipper-submitted posts is not yet complete.

---

## Completed ✅

- [x] Add Leaderboard tab to ClipperProfilePage (before Accounts tab)
- [x] Create "Your Ranking" card showing global rank, clips posted, and total views
- [x] Create "Top Clippers This Week" leaderboard list with avatars, names, clips count, views
- [x] Highlight current user's entry with "(You)" label
- [x] Medal colors for top 3 positions (gold, silver, bronze)
- [x] Add `total_views` field to `clipper_leaderboard_entries` schema
- [x] Create migration `20260109000004_add_total_views_to_leaderboard.exs`
- [x] Update API serialization to include `total_views`, `user_id`, and `id`

---

## Pending 🔧

### 1. Campaign Submissions - Track Post URLs and Views
**Files to modify:**
- `server/lib/clippster_server/campaigns/campaign_submission.ex`
- `server/priv/repo/migrations/` (new migration)

**Changes needed:**
```elixir
# Add to campaign_submissions table:
field :post_url, :string          # URL to clipper's post on their social account
field :post_platform, :string     # instagram, tiktok, youtube, etc.
field :view_count, :integer       # Fetched view count
field :views_last_synced_at, :utc_datetime  # When views were last fetched
```

### 2. Submission UI - Allow Clippers to Submit Post URLs
**Files to modify:**
- `client/src/components/organization/OrganizationCampaigns.vue` (submission review)
- `client/src/pages/CampaignsPage.vue` (clipper submission form)

**Changes needed:**
- Add input field for clippers to paste their post URL when submitting
- Display post URL in org's submission review panel
- Add "Sync Views" button for manual refresh

### 3. Social Platform API Integration
**Files to create:**
- `server/lib/clippster_server/social/view_fetcher.ex`

**APIs to integrate:**
- **Instagram Graph API** - Fetch video views via media insights
- **TikTok API** - Fetch video views
- **YouTube Data API** - Fetch video views
- **Twitter/X API** - Fetch video views (if applicable)

**Considerations:**
- Rate limiting
- API key management
- Fallback for private/unavailable posts

### 4. Background Worker - Sync View Counts
**Files to create:**
- `server/lib/clippster_server/campaigns/view_sync_worker.ex`

**Behavior:**
- Run every 6-12 hours
- Fetch view counts for all verified submissions from the last 30 days
- Update `view_count` and `views_last_synced_at` fields
- Log errors for failed fetches (private posts, deleted posts, etc.)

### 5. Leaderboard Calculation - Aggregate Views
**Files to modify:**
- `server/lib/clippster_server/clipper_profiles/leaderboard_worker.ex`

**Changes needed:**
- When calculating weekly/monthly leaderboard:
  - Sum `view_count` from all verified submissions per clipper
  - Store in `total_views` field on leaderboard entry
- Update score calculation to factor in views:
  ```elixir
  score = (clips * 10) + (views / 1000) + (endorsements * 50)
  ```

---

## Data Flow (Target Architecture)

```
1. Clipper posts clip on THEIR OWN social account (IG, TikTok, etc.)
2. Clipper submits post URL to campaign in Clippster
3. Org reviews and verifies the submission
4. ViewSyncWorker periodically fetches view counts from post URLs
5. LeaderboardWorker aggregates views per clipper
6. Leaderboard displays: clips count + total views
```

---

## Notes

- The current leaderboard shows placeholder data (0 views) until the view sync pipeline is implemented
- Migration `20260109000004_add_total_views_to_leaderboard.exs` needs to be run
- Consider adding manual view entry as a fallback if API integration is delayed
