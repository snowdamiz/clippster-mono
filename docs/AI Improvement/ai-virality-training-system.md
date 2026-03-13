# AI Virality Training System

Admin-only analytics dashboard that uses Claude Opus 4.6 to analyze viral clips (video frames, audio, transcript) to improve detection prompts and virality scoring.

---

## Overview

**Goal**: Learn from clips that actually went viral to improve AI detection accuracy.

**Key Requirements**:
- **Admin-only** — New tab in admin dashboard, manual trigger
- **Opus 4.6 only** — This analysis uses Claude Opus, NOT used for regular clip detection
- **Dynamic virality threshold** — Percentile-based (top 10% = viral, top 25% = semi-viral), with 50k minimum floor
- **Multimodal analysis** — Video frames + audio energy + transcript sent to Opus
- **UI matches ClipperProfilePage** — Same card/tab/stat styling

---

## Data Sources

### Where Posts Come From

| Post Type | Table | Has R2 Video? | Notes |
|-----------|-------|---------------|-------|
| **Org posts** | `post_submissions` | ✅ `media_url` | Scheduled or immediate publish |
| **User personal posts** | `user_posts` | ✅ `media_url` | Posted to user's own accounts |
| **Campaign posts** (via app) | `post_submissions` | ✅ `media_url` | Also creates `campaign_submissions` |
| **Campaign posts** (manual link) | `campaign_submissions` | ❌ External URL | Skip for now |

### What We Have vs Need

| Data | Available? | Solution |
|------|------------|----------|
| Video file | ✅ R2 `media_url` | Download from R2 |
| Analytics | ✅ Synced from platforms | `view_count`, `like_count`, etc. |
| Caption | ✅ Stored | `caption` field |
| Transcript | ❌ Not stored server-side | Re-transcribe via Whisper (~$0.006/min) |
| Original virality score | ❌ Local SQLite only | Not available (future: store at post time) |

### Cost Estimate
- **50 viral clips × 60 sec avg = 50 min transcription = ~$0.30**
- **Opus 4.6 analysis**: ~$0.015/1K input tokens × ~2K tokens/clip = ~$1.50 for 50 clips
- **Total per analysis run**: ~$2-5 depending on clip count

---

## Architecture

### 1. Data Model

**New table: `viral_clip_analyses`**
```sql
CREATE TABLE viral_clip_analyses (
  id SERIAL PRIMARY KEY,
  
  -- Source (one of these will be set)
  post_submission_id INTEGER REFERENCES post_submissions(id),
  user_post_id INTEGER REFERENCES user_posts(id),
  
  -- Virality metrics
  view_count INTEGER NOT NULL,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  reach_count INTEGER DEFAULT 0,
  platform VARCHAR(50) NOT NULL,
  
  -- AI analysis
  transcript TEXT,
  opus_analysis JSONB,
  extracted_patterns JSONB,
  suggested_prompt_improvements JSONB,
  
  -- Metadata
  analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  video_duration_seconds FLOAT,
  virality_percentile FLOAT,
  is_viral BOOLEAN NOT NULL,
  
  -- Admin actions
  applied_to_prompts BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMP WITH TIME ZONE,
  applied_by_user_id INTEGER REFERENCES users(id)
);
```

**New table: `virality_thresholds`**
```sql
CREATE TABLE virality_thresholds (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  week_start DATE NOT NULL,
  total_posts INTEGER NOT NULL,
  viral_threshold_views INTEGER NOT NULL, -- 90th percentile
  semi_viral_threshold_views INTEGER NOT NULL, -- 75th percentile
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(platform, week_start)
);
```

### 2. Backend Modules

**New: `server/lib/clippster_server/ai/virality_training/`**
- `threshold_calculator.ex` — Calculate dynamic virality thresholds
- `clip_analyzer.ex` — Orchestrate analysis pipeline
- `media_analyzer.ex` — Extract frames and audio
- `pattern_extractor.ex` — Extract patterns from Opus analyses
- `prompt_improver.ex` — Generate prompt suggestions

**New: `server/lib/clippster_server_web/controllers/admin/virality_training_controller.ex`**
- Get overview stats
- List viral clips
- Trigger analysis
- Get analysis results
- Apply prompt improvements

### 3. Admin UI

**New: `client/src/pages/admin/AdminViralityTraining.vue`**
- **Overview Tab**: Weekly stats, threshold chart, viral vs total posts
- **Viral Clips Tab**: List with expandable details (transcript, Opus insights)
- **Patterns Tab**: Aggregated insights across all analyzed clips
- **Prompts Tab**: Suggested improvements with "Apply" buttons

**Matches ClipperProfilePage.vue styling**:
- Same card components
- Same tab navigation
- Same stat grid layout
- Same color scheme and fonts

### 4. Analysis Pipeline

```
1. Admin clicks "Run Analysis" for date range
2. System calculates virality thresholds for that week
3. Identify viral clips (above threshold) from post_submissions + user_posts
4. For each viral clip:
   a. Download video from R2 storage
   b. Re-transcribe via Whisper API
   c. Extract 5 key frames (evenly spaced)
   d. Analyze audio energy levels
   e. Send to Opus 4.6 with:
      - Transcript
      - Frame images (base64)
      - Audio energy data
      - Performance metrics
5. Store Opus response and extract patterns
6. Aggregate patterns across all clips
7. Generate prompt improvement suggestions
```

---

## Implementation Plan

### Phase 1: Database & Backend (3-4 days)
- [ ] Create migrations for new tables
- [ ] Implement threshold calculation logic
- [ ] Create virality training modules
- [ ] Add admin controller and routes

### Phase 2: Admin UI (2-3 days)
- [ ] Create `AdminViralityTraining.vue` matching ClipperProfilePage style
- [ ] Overview tab with stats and charts
- [ ] Viral clips list with expandable details
- [ ] Patterns analysis view

### Phase 3: Analysis Pipeline (2-3 days)
- [ ] Threshold calculation logic (manual trigger)
- [ ] Viral clip identification from `post_submissions` + `user_posts`
- [ ] Download video from R2 storage
- [ ] Re-transcribe via Whisper API (~$0.006/min)
- [ ] Frame extraction from video (FFmpeg)
- [ ] Audio energy analysis (FFmpeg)
- [ ] Opus multimodal analysis (video frames + transcript + audio)
- [ ] Pattern extraction and aggregation

### Phase 4: Prompt Improvement (1-2 days)
- [ ] Prompt suggestions tab
- [ ] Aggregate insights from analyses
- [ ] Manual "apply suggestion" workflow

---

## Key Design Decisions

1. **Opus 4.6 is admin-only** — Regular detection continues using Grok/Claude Haiku/Gemini
2. **Dynamic thresholds** — "Viral" is relative to weekly volume, not fixed numbers
3. **Per-platform thresholds** — TikTok 100k views ≠ Twitter 100k views
4. **Multimodal analysis** — Opus receives video frames, audio analysis, AND transcript
5. **Prompt engineering focus** — No model fine-tuning, improve prompts based on learnings
6. **Manual trigger** — Admin clicks "Run Analysis" button, no automatic scheduling
7. **Manual application** — Admin reviews suggestions before applying to prompts
8. **Re-transcription** — Server runs Whisper on viral clips since transcripts aren't stored (~$0.006/min)
9. **Skip manual submissions** — Campaign submissions with external URLs (no R2 video) are excluded

---

## Future Enhancement (Optional)

**Store transcript at post time** — When users post clips through the app, send the transcript from local SQLite to the server. This would:
- Eliminate re-transcription cost
- Preserve original AI detection data (virality_score, detection_reason)
- Enable comparison of predicted vs actual performance

This requires client changes and is not needed for MVP.

---

## Files to Create/Modify

### Backend
- `server/priv/repo/migrations/20260312000001_create_virality_thresholds.exs`
- `server/priv/repo/migrations/20260312000002_create_viral_clip_analyses.exs`
- `server/lib/clippster_server/ai/virality_training/threshold_calculator.ex`
- `server/lib/clippster_server/ai/virality_training/clip_analyzer.ex`
- `server/lib/clippster_server/ai/virality_training/media_analyzer.ex`
- `server/lib/clippster_server/ai/virality_training/pattern_extractor.ex`
- `server/lib/clippster_server/ai/virality_training/prompt_improver.ex`
- `server/lib/clippster_server_web/controllers/admin/virality_training_controller.ex`
- Update `server/lib/clippster_server_web/router.ex`

### Frontend
- `client/src/pages/admin/AdminViralityTraining.vue`
- Update `client/src/pages/admin/AdminHub.vue` (add link)
- Update `client/src/services/api.ts` (add endpoints)

### Prompts to Update
- `server/lib/clippster_server/ai/system_prompt.ex`
- `server/lib/clippster_server/ai/multimodal_clip_detection.ex` (system prompt)
