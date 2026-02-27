# Batch Social Media Posting System

Implement a flexible batch posting system that allows users to publish multiple clips to multiple platforms with granular control over which clips go to which platforms.

## Current Architecture Analysis

### Existing Publishing Flow (Single Clip)
1. **Frontend (Clips.vue)**: User clicks "Share" on a build → 3-dialog flow:
   - `PlatformSelectDialog` - Choose Instagram or Twitter
   - `PublishDestinationDialog` - Choose personal account or organization
   - `InstagramPublishDialog` / `TwitterPublishDialog` - Configure caption, account, schedule

2. **Media Upload**: Video/thumbnail uploaded to server via `uploadMediaForPost()` or `uploadUserMediaForPost()`

3. **Publishing**: 
   - Immediate: `publishPost()` API → creates `post_submission` record with status "publishing"
   - Scheduled: `schedulePost()` API → creates `post_submission` with `scheduled_at` timestamp

4. **Backend Processing**: `ScheduledPostWorker` polls for posts due to publish and executes platform APIs

### Database Schema
- **post_submissions** table supports:
  - Both org and personal posts (`owner_type`, `organization_id`, `user_social_account_id`)
  - Scheduling (`scheduled_at`, `started_at`, `completed_at`)
  - Multiple platforms (Instagram, Twitter, TikTok via `platform` field)
  - Retry logic (`attempts`, `max_attempts`)
  - Campaign/creator profile tracking
  - Clip linkage (`clip_id`)

## Requirements Breakdown

### Use Cases
1. **One clip → Multiple platforms**: Clip A to Instagram + Twitter + TikTok
2. **Multiple clips → One platform**: Clips A, B, C all to Instagram
3. **Multiple clips → Multiple platforms with mapping**: 
   - Clip A → Twitter only
   - Clip B → Instagram + Twitter + TikTok
   - Clip C → Instagram + Twitter

### User Experience Goals
- Select multiple clips from Clips page
- Configure platform destinations per clip
- Support both immediate and scheduled posting
- Show batch progress/status
- Handle partial failures gracefully

## Implementation Plan

### Phase 1: Backend - Batch Scheduling API

**New Endpoint**: `POST /social/batch-schedule`

**Request Body**:
```json
{
  "posts": [
    {
      "clip_id": "clip-uuid-1",
      "build_id": "build-uuid-1",
      "file_path": "/path/to/video.mp4",
      "thumbnail_path": "/path/to/thumb.jpg",
      "platforms": [
        {
          "platform": "instagram",
          "caption": "Check this out!",
          "scheduled_at": "2024-01-15T14:00:00Z",
          "organization_id": 1,
          "social_account_id": 2,
          "creator_profile_id": 3,
          "campaign_id": 4
        },
        {
          "platform": "twitter",
          "caption": "Amazing clip!",
          "scheduled_at": "2024-01-15T14:05:00Z",
          "user_social_account_id": 5
        }
      ]
    },
    {
      "clip_id": "clip-uuid-2",
      "build_id": "build-uuid-2",
      "file_path": "/path/to/video2.mp4",
      "platforms": [
        {
          "platform": "instagram",
          "caption": "Another great one",
          "organization_id": 1,
          "social_account_id": 2
        }
      ]
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "batch_id": "batch-uuid",
  "results": [
    {
      "clip_id": "clip-uuid-1",
      "platforms": [
        {
          "platform": "instagram",
          "success": true,
          "post_id": 123,
          "media_url": "https://..."
        },
        {
          "platform": "twitter",
          "success": true,
          "post_id": 124
        }
      ]
    }
  ],
  "summary": {
    "total_posts": 3,
    "successful": 3,
    "failed": 0
  }
}
```

**Files to Create/Modify**:
- `server/lib/clippster_server_web/controllers/scheduling_controller.ex` - Add `batch_schedule/2` function
- `server/lib/clippster_server/social.ex` - Add `schedule_batch_posts/2` function
- `server/lib/clippster_server_web/router.ex` - Add route `post "/social/batch-schedule"`

**Implementation Details**:
- Validate all posts before processing any
- Upload media for each clip once, reuse URL for all platforms
- Create individual `post_submission` records for each clip+platform combination
- Use database transaction to ensure atomicity
- Return detailed results for each post

### Phase 2: Frontend - Batch Selection UI

**Multi-Select in Clips.vue**:
- Already has `selectedBuilds` ref for multi-select
- Add "Batch Publish" button when multiple builds selected
- Show selected count badge

**Files to Modify**:
- `client/src/pages/Clips.vue` - Add batch publish button and handler

### Phase 3: Frontend - Batch Configuration Dialog

**New Component**: `BatchPublishDialog.vue`

**Features**:
- List all selected clips with thumbnails
- Per-clip platform selection (checkboxes: Instagram, Twitter, TikTok)
- **Three-Level Scheduling Hierarchy**:
  1. **Global Level**: Default schedule applies to all clips
  2. **Clip Level**: Override global schedule for specific clip (applies to all platforms of that clip)
  3. **Platform Level**: Override clip schedule for specific platform (most granular control)
- Global settings section:
  - Default caption (with per-clip override option)
  - Default schedule time (with per-clip and per-platform override options)
  - Default destination (personal/org)
  - Default social accounts
  - "Apply schedule to all clips" checkbox for bulk scheduling
- Platform-specific settings:
  - Instagram: Account, creator profile, media type (reel/post)
  - Twitter: Account, caption length validation
  - TikTok: Account settings
- Schedule options at each level:
  - "Use global" / "Same as clip" (inherit from parent)
  - "Now" (immediate publish)
  - "Custom" (date/time picker)
  - "Offset" (e.g., +5min, +30min, +1hr from parent time)
- Validation:
  - At least one platform selected per clip
  - Valid schedule times (5+ minutes in future)
  - Required fields per platform
  - No scheduling conflicts (same account posting at exact same time)

**UI Layout** (with hierarchical scheduling):
```
┌─────────────────────────────────────────┐
│ Batch Publish to Social Media           │
├─────────────────────────────────────────┤
│ Global Settings                          │
│ ├─ Destination: [Personal ▼]            │
│ ├─ Default Caption: [____________]       │
│ ├─ Schedule All: [Now ▼] [Date] [Time]  │
│ └─ [✓] Apply schedule to all clips      │
├─────────────────────────────────────────┤
│ Clips (3 selected)                       │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ [✓] Clip A - "Amazing gameplay"     │ │
│ │     Schedule: [Use global ▼]         │ │
│ │     Caption: [Use default ▼]         │ │
│ │                                      │ │
│ │     Platforms:                       │ │
│ │     ┌─ [✓] Instagram                │ │
│ │     │   Schedule: [Same as clip ▼]  │ │
│ │     │   Caption: [Same as clip ▼]   │ │
│ │     └─ [✓] Twitter                  │ │
│ │         Schedule: [Custom: +5min ▼] │ │
│ │         Caption: [Same as clip ▼]   │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ [✓] Clip B - "Epic moment"          │ │
│ │     Schedule: [Custom: Tomorrow 2PM] │ │
│ │     Caption: [Custom: "Check..."]    │ │
│ │                                      │ │
│ │     Platforms:                       │ │
│ │     └─ [✓] Twitter                  │ │
│ │         Schedule: [Same as clip ▼]  │ │
│ │         Caption: [Same as clip ▼]   │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ [✓] Clip C - "Funny clip"           │ │
│ │     Schedule: [Use global ▼]         │ │
│ │     Caption: [Use default ▼]         │ │
│ │                                      │ │
│ │     Platforms:                       │ │
│ │     ┌─ [✓] Instagram                │ │
│ │     │   Schedule: [Same as clip ▼]  │ │
│ │     ├─ [✓] Twitter                  │ │
│ │     │   Schedule: [Custom: +30min]  │ │
│ │     └─ [✓] TikTok                   │ │
│ │         Schedule: [Custom: +1hr]    │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Platform Settings                        │
│ ├─ Instagram                             │
│ │  ├─ Account: [my_account ▼]           │
│ │  ├─ Creator Profile: [None ▼]         │
│ │  └─ Media Type: [Reel ▼]              │
│ ├─ Twitter                               │
│ │  └─ Account: [my_twitter ▼]           │
│ └─ TikTok                                │
│    └─ Account: [my_tiktok ▼]            │
├─────────────────────────────────────────┤
│ Summary: 7 posts scheduled               │
│ • Clip A: IG (2:00pm), X (2:05pm)       │
│ • Clip B: X (Tomorrow 2pm)              │
│ • Clip C: IG (2:00pm), X (2:30pm),      │
│           TikTok (3:00pm)                │
├─────────────────────────────────────────┤
│ [Cancel] [Preview Schedule] [Publish]   │
└─────────────────────────────────────────┘
```

**Scheduling Hierarchy Examples**:

*Example 1: Simple bulk schedule (all same time)*
- Global: Tomorrow 2:00 PM
- Clip A: Use global → All platforms at 2:00 PM
- Clip B: Use global → All platforms at 2:00 PM
- Clip C: Use global → All platforms at 2:00 PM

*Example 2: Stagger clips, same platforms*
- Global: Tomorrow 2:00 PM
- Clip A: Use global (2:00 PM) → IG, Twitter both at 2:00 PM
- Clip B: Custom 3:00 PM → IG, Twitter both at 3:00 PM
- Clip C: Custom 4:00 PM → IG, Twitter both at 4:00 PM

*Example 3: Stagger platforms within clip*
- Global: Tomorrow 2:00 PM
- Clip A: Use global (2:00 PM)
  - Instagram: Same as clip (2:00 PM)
  - Twitter: Offset +5min (2:05 PM)
  - TikTok: Offset +10min (2:10 PM)

*Example 4: Full granular control*
- Global: Tomorrow 2:00 PM
- Clip A: Custom 9:00 AM
  - Instagram: Same as clip (9:00 AM)
  - Twitter: Custom 12:00 PM
- Clip B: Use global (2:00 PM)
  - Instagram: Same as clip (2:00 PM)
  - Twitter: Offset +30min (2:30 PM)
- Clip C: Custom 6:00 PM
  - Instagram: Custom 5:00 PM
  - Twitter: Same as clip (6:00 PM)
  - TikTok: Custom 7:00 PM

**Files to Create**:
- `client/src/components/BatchPublishDialog.vue` - Main dialog component
- `client/src/components/BatchPublishClipItem.vue` - Individual clip configuration item
- `client/src/components/BatchPublishPlatformItem.vue` - Per-platform configuration within clip
- `client/src/composables/useBatchPublish.ts` - State management and API calls
- `client/src/composables/useScheduleHierarchy.ts` - Resolve schedule inheritance logic

### Phase 4: Frontend - Batch API Integration

**New API Service**: `client/src/services/batchPublishApi.ts`

**Functions**:
```typescript
export interface BatchPublishClip {
  clip_id: string;
  build_id: string;
  file_path: string;
  thumbnail_path?: string;
  platforms: BatchPublishPlatform[];
}

export interface BatchPublishPlatform {
  platform: 'instagram' | 'twitter' | 'tiktok';
  caption?: string;
  scheduled_at?: string;
  organization_id?: number;
  social_account_id?: number;
  creator_profile_id?: number;
  campaign_id?: number;
  user_social_account_id?: number;
  media_type?: string;
}

export interface BatchPublishRequest {
  posts: BatchPublishClip[];
}

export async function batchPublish(data: BatchPublishRequest): Promise<BatchPublishResponse>
```

**Files to Create**:
- `client/src/services/batchPublishApi.ts`

### Phase 5: Progress Tracking & Error Handling

**Features**:
- Show upload progress for each clip
- Show publishing status for each platform
- Handle partial failures (some posts succeed, some fail)
- Allow retry of failed posts
- Show detailed error messages

**Progress Dialog**:
```
┌─────────────────────────────────────────┐
│ Publishing 7 Posts...                    │
├─────────────────────────────────────────┤
│ Clip A                                   │
│ ├─ Instagram: ✓ Published                │
│ └─ Twitter: ✓ Published                  │
│                                          │
│ Clip B                                   │
│ └─ Twitter: ⟳ Publishing...              │
│                                          │
│ Clip C                                   │
│ ├─ Instagram: ⏳ Uploading (45%)         │
│ ├─ Twitter: ⏳ Queued                    │
│ └─ TikTok: ⏳ Queued                     │
├─────────────────────────────────────────┤
│ Progress: 2/7 posts published            │
│ [View Details] [Cancel Remaining]        │
└─────────────────────────────────────────┘
```

**Files to Create**:
- `client/src/components/BatchPublishProgressDialog.vue`

### Phase 6: Batch Management View

**New Page/Section**: View and manage batch publish jobs

**Features**:
- List all batch publish operations
- Show status of each post in batch
- Retry failed posts
- Cancel pending posts
- View analytics for published posts

**Optional Enhancement** (can be deferred):
- `batch_publish_jobs` table to track batch operations
- Link individual `post_submissions` to parent batch job

## Technical Considerations

### Media Upload Optimization
- Upload each clip's video/thumbnail once
- Reuse media URLs for all platforms
- Consider parallel uploads for multiple clips
- Show aggregate upload progress

### Validation Strategy
- Frontend validation before API call
- Backend validation with detailed error messages
- Return validation errors for ALL posts (don't fail fast)
- Allow user to fix errors and resubmit

### Transaction Handling
- Use database transaction for batch insert
- Rollback on critical errors
- Partial success handling (some posts created, some failed)

### Rate Limiting
- Respect platform API rate limits
- Stagger scheduled posts (e.g., 30 seconds apart)
- Queue posts if rate limit exceeded

### Free Tier Restrictions
- Existing free tier check in `schedule/2` applies
- Batch endpoint should also check user tier
- Show upgrade prompt if free tier user attempts batch publish

## Files Summary

### Backend (Elixir)
**New**:
- None (reuse existing infrastructure)

**Modified**:
- `server/lib/clippster_server_web/controllers/scheduling_controller.ex` - Add `batch_schedule/2`
- `server/lib/clippster_server/social.ex` - Add `schedule_batch_posts/2`
- `server/lib/clippster_server_web/router.ex` - Add batch route

### Frontend (Vue/TypeScript)
**New**:
- `client/src/components/BatchPublishDialog.vue`
- `client/src/components/BatchPublishClipItem.vue`
- `client/src/components/BatchPublishProgressDialog.vue`
- `client/src/services/batchPublishApi.ts`
- `client/src/composables/useBatchPublish.ts`

**Modified**:
- `client/src/pages/Clips.vue` - Add batch publish button and integration

## Testing Scenarios

1. **Single clip, multiple platforms**: Verify all platforms receive correct media
2. **Multiple clips, single platform**: Verify all clips published to same platform
3. **Complex mapping**: Verify platform selection per clip works correctly
4. **Scheduling**: Verify scheduled times are respected
5. **Personal vs Org**: Verify destination selection works
6. **Validation**: Verify errors are caught and displayed
7. **Partial failure**: Verify some posts can succeed while others fail
8. **Free tier**: Verify free tier users are blocked appropriately

## Future Enhancements

1. **Templates**: Save batch configurations as templates for reuse
2. **Bulk editing**: Edit caption/schedule for multiple clips at once
3. **Platform-specific optimizations**: Auto-format captions per platform
4. **Analytics dashboard**: Aggregate analytics for batch posts
5. **CSV import**: Import batch publish configurations from CSV
6. **Recurring batches**: Schedule recurring batch publishes
