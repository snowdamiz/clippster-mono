# Clippster Refined Feature Roadmap

Comprehensive feature roadmap with detailed specs for 20 features, refined through iterative user walkthrough.

---

## Feature #1: Live Stream Moment Bookmarks ✅ DETAILED

**Summary**: Clippers mark moments during live streams; bookmarks translate to VOD timestamps for AI-assisted clipping.

**Trigger**: Manual — hotkey `B` while watching livestream in `LivestreamWatchDialog.vue`
**Notes**: Optional text note/tag attached to each bookmark
**AI Window**: Configurable detection window around each bookmark (default ±60s, user-adjustable)
**Timestamp Translation**: `absoluteTime = dvrStartTime + playbackPosition` → `vodTimestamp = absoluteTime - recordingStartTime`
**UI**:
- Bookmark markers on the seek bar (colored dots)
- Bookmark list panel with notes, timestamps, and "Process" button
- AI detection runs around bookmark timestamps when user triggers processing
**Processing**: Manual trigger — user clicks "Process Bookmarks" after stream ends, AI runs clip detection focused on bookmark windows

**Key Files**:
- `LivestreamWatchDialog.vue` — add bookmark button/hotkey
- `useLivestreamViewer.ts` — bookmark state, timestamp calculation
- `useLivestreamMonitoring.ts` — DVR session timing reference

---

## Feature #2: Transcript-First Editing ✅ DETAILED

**Summary**: Full Descript-style transcript editing — delete/rearrange words in transcript = edit video on timeline.

**Mode**: Toggleable panel in the editor (not primary, not always visible — user toggles it on/off)
**Sync**: Bidirectional — edits in transcript reflect on timeline, edits on timeline reflect in transcript
**Capabilities**:
- Delete words/sentences → ripple-delete from timeline
- Rearrange paragraphs → reorder video segments
- Strikethrough mode — mark words for removal before committing
- Split at cursor — click between words to split video at that timestamp
- Click word → playhead jumps (already exists in `TranscriptPanel.vue`)
- Select word range → create clip (already exists)
- Double-click word → edit text (already exists)

**Existing Infrastructure**:
- `TranscriptPanel.vue` — word-level display, click-to-seek, drag-select, word editing
- `CaptionsView.vue` — loads transcript, generates caption elements
- `transcription.ts` — word-level timestamp types
- Whisper transcription with word-level timestamps

**New Work**: Port TranscriptPanel into editor as a panel, add delete→ripple-delete, rearrange→reorder, strikethrough mode, split-at-cursor

---

## Feature #3: Built-In Invoicing ✅ DETAILED

**Summary**: Clippers send invoices to organizations, auto-populated from clip/campaign data.

**Flow**: Clipper → Organization
**Auto-populated data**: Clips delivered count, campaign deliverables, credit/payment amounts from campaign rates
**Payment**: Informational only — org pays externally (PayPal, Venmo, bank transfer, etc.)
**Export**: PDF export
**No time tracking** (doesn't exist in codebase, not adding it)

---

## Feature #4: Comment & Annotation Layer ✅ DETAILED

**Summary**: Frame.io-style review system — managers/streamers draw on frames and leave text comments.

**Who comments**: Managers and streamers only (not clippers)
**Comment types**: Text comments at specific timestamps + drawing/annotation on video frames (circles, arrows, highlights)
**Resolution flow**: Clipper marks comments as "resolved" after addressing feedback
**Location**: On the editor timeline (time-stamped markers)

---

## Feature #6: Clip Lifecycle Tracking ✅ DETAILED

**Summary**: Track every clip through stages: detected → clipped → edited → approved → exported → posted → archived.

**UI**: Status badge on each clip card in the clips list (no Kanban view)
**Transitions**: Mix of auto + manual
- Auto: detected→clipped (on clip creation), edited→exported (on export complete), posted (confirmed via social API)
- Manual: approved (manager clicks approve)
**Campaign integration**: Lifecycle stages map to campaign submission statuses
**No notifications** in V1 (can add later)

---

## Feature #7: Internal Dispute Resolution ✅ DETAILED

**Summary**: Either party opens a dispute, platform admin mediates, can trigger payment actions.

**Initiator**: Either side (clipper or org)
**Resolution**: Platform admin mediates as neutral party
**Evidence auto-attached**: Clip lifecycle logs, export audit trails, message history, campaign terms/NDA
**Outcome actions**: Written decision (permanently logged), can trigger payment release or refund

---

## Feature #9: Clipper Leveling System (Sensible Defaults)

**Levels**: Visible on clipper's public profile and to orgs when browsing clippers
**Criteria**: Consistency, quality (approval rate), revision count, delivery speed, reliability
**Perks**: Higher levels unlock priority access to campaigns, visible badges, higher pay rate eligibility
**Ties into**: Composite Reputation Score (#19)

---

## Feature #10: Smart Project Scoping (Sensible Defaults)

**Format**: Wizard/form when org creates a new campaign
**Questions**: Goals, target platforms, volume needed, urgency/deadline, content type
**Output**: Auto-suggested scope (recommended clipper count, timeline, budget estimate)
**AI**: Optionally suggest scope based on org's past campaign data

---

## Feature #11: Time-to-Value Tracking (Sensible Defaults)

**Dashboard**: Average time per pipeline stage (detected→clipped, clipped→edited, edited→approved, etc.)
**Breakdowns**: Per-clipper and per-campaign
**Purpose**: Identify bottlenecks, prove value to clients

---

## Feature #12: Clipper Availability Status (Sensible Defaults)

**UI**: Simple toggle on clipper profile (Available / Limited / Offline)
**Extras**: Timezone display + optional working hours
**Visible to**: Orgs and streamers when browsing clippers or assigning work

---

## Feature #13: Export Audit Trails (Sensible Defaults)

**Logged data**: Who exported, when, which project, export settings (resolution, format, aspect ratio)
**Viewable by**: Both org admins and the clipper who exported
**Purpose**: Dispute evidence, theft protection, accountability

---

## Feature #14: Edit Templates / Style Presets (Sensible Defaults)

**Scope**: Full editing style bundle — caption style + watermark config + aspect ratio + filters + text style
**Levels**: Personal templates (per clipper) AND org-enforced templates
**Existing**: Text presets and caption presets already exist. This extends to a full template entity.
**Relationship**: Personal version of Brand Kit (#28). Brand Kit is org-enforced; templates are personal.

---

## Feature #15: Batch Export / Batch Edit (Sensible Defaults)

**Scope**: Both — select multiple clips from clips list → apply same edit template → batch export
**Implementation**: Queue wrapper on existing FFmpeg export pipeline
**UI**: Multi-select in clips list, "Batch Export" button, progress for each clip

---

## Feature #16: Content Calendar View (Sensible Defaults)

**UI**: Visual calendar showing scheduled posts across all platforms
**Data source**: Existing `ScheduledPostsList` / `OrgScheduledPostsList` data
**Extras**: Show campaign deadlines and delivery milestones
**Implementation**: Calendar UI component on top of existing scheduling data

---

## Feature #17: Automated Quality Checks on Export (Sensible Defaults)

**Trigger**: Runs automatically before every export
**Checks**: Audio levels within broadcast spec, no black frames, captions in safe zones, correct aspect ratio, duration within platform limits
**Behavior**: Show warnings but allow override (soft block, not hard block)
**Purpose**: Catches ~80% of revision requests before submission

---

## Feature #18: Clip Performance Analytics Dashboard (Sensible Defaults)

**Data source**: Connected social accounts (Instagram/Twitter analytics already synced)
**Views**: Clipper-facing (my clips' performance) AND org-facing (all clips across all clippers)
**Key metrics**: Views, engagement rate, watch time, shares — correlated with clip attributes (hook length, caption style, duration)
**Purpose**: Data moat that keeps orgs on platform

---

## Feature #19: Composite Reputation Score (Sensible Defaults)

**Components**: Approval rate, revision count, delivery speed, client feedback, dispute history, consistency
**Visibility**: On clipper's public profile
**Effects**: Affects campaign eligibility (e.g., "requires reputation ≥ 80")
**Ties into**: Clipper Leveling System (#9)

---

## Feature #20: NDA / Contract Management (Sensible Defaults)

**Format**: Org uploads a document (PDF/text) as campaign terms
**Flow**: Clipper must accept terms before joining campaign
**Logging**: Acceptance logged with timestamp for legal proof
**Lightweight**: Not a full contract management system — just a terms acceptance gate

---

## Feature #21: Silence & Filler Word Removal ✅ DETAILED

**Summary**: One-click detection and removal of filler words and silence, integrated into transcript panel.

**Integration**: Part of the Transcript-First Editing panel (#2)
**Detection targets**:
- Filler words: um, uh, like, you know, so, basically, actually, literally, right
- Silence/dead air: pauses > configurable threshold (default 1.5s)
**Removal behavior**: Ripple delete (removes the time, video gets shorter)
**Preview**: Shows what will be removed before committing (highlighted in transcript with strikethrough)
**UI**: "Remove All Fillers" button + "Remove Silence" button in transcript panel toolbar
**Existing infrastructure**: Whisper word-level timestamps, `filler_word_count` already in system prompt metrics

---

## Feature L: Streamer Voice Command Clip Detection ✅ DETAILED

**Summary**: AI detects when a streamer says "clip that" or "clip this" in the transcript and creates clips with directional semantics.

**"Clip that"** (backward): AI looks BACKWARD from the phrase timestamp to find where the moment/topic started (could be 30s, 1min, 2min back). Creates clip from [moment_start → phrase_timestamp].

**"Clip this"** (forward): AI looks FORWARD from the phrase timestamp until the streamer finishes the topic. Creates clip from [phrase_timestamp → topic_end].

**Phrase variations detected**:
- "clip that", "clip this"
- "someone clip that", "chat clip that"
- "that needs to be clipped", "clip it"
- Case-insensitive matching

**Implementation**:
1. **Pre-processing step**: Before sending transcript chunks to AI, scan for clip command phrases and annotate them with `streamer_clip_request: { type: "backward"|"forward", timestamp: N }` flags
2. **System prompt update** (`system_prompt.ex`): New section instructing AI to treat these as HIGH PRIORITY explicit clip markers with directional boundary logic
3. **Works in both contexts**: VOD auto-detection AND live stream detection (same transcript pipeline)

**Key Files**:
- `server/lib/clippster_server/ai/system_prompt.ex` — add voice command detection instructions
- Server-side transcript pre-processing (new module or addition to existing chunking logic)
- No client changes needed — detection results appear as normal clips

---

## Feature #28: Brand Kit System (Sensible Defaults)

**Summary**: Org-level brand kit bundling all brand assets into a structured entity that auto-loads in the editor.

**Contents**:
- Logo + position/size rules
- Color palette (primary, secondary, accent)
- Approved fonts
- Watermark position + opacity
- Caption style preset
- Intro/outro templates
- Audio stingers/bumpers

**Enforcement**: Mixed — some elements enforced (watermark, logo placement), others suggested (caption style, colors)
**Auto-apply**: When clipper opens editor for an org campaign, brand kit auto-loads all elements
**Existing infrastructure**: Org shared assets, `BrandingView.vue`, watermarks, intro/outros, text presets

---

## Dropped Features

- **Feature A (AI Voice Cloning / Overdub)** — User explicitly removed
- **Feature O (Competitor Content Tracking)** — User explicitly removed
- **Feature #5 (Anti-Clip Theft)** — User explicitly removed
- **Feature #8 (Clip Quotas)** — User explicitly removed
- **Feature P (Collaborative Editing)** — User explicitly removed
- **#22 AI Virality Score** — Already exists (virality_score in clip detection)
- **#23 AI Auto-Reframe** — Already exists (framing_strategy.ex, layout_analyzer.ex, speaker_detection.ex)
- **#25 Multi-Language Translation** — Not selected
- **#26 AI Highlight Reel** — Not selected
- **#27 Multi-Platform Export** — Not selected

---

## Summary by Tier

### Tier 1: Core Clipping & Editing (6)
| # | Feature | Status |
|---|---------|--------|
| 1 | Live Stream Moment Bookmarks | ✅ Detailed |
| 2 | Transcript-First Editing | ✅ Detailed |
| 14 | Edit Templates / Style Presets | Sensible defaults |
| 15 | Batch Export / Batch Edit | Sensible defaults |
| 21 | Silence & Filler Word Removal | ✅ Detailed |
| L | Streamer Voice Command Clip Detection | ✅ Detailed |

### Tier 2: AI & Detection (1)
| # | Feature | Status |
|---|---------|--------|
| 28 | Brand Kit System | Sensible defaults |

### Tier 3: Collaboration & Workflow (4)
| # | Feature | Status |
|---|---------|--------|
| 4 | Comment & Annotation Layer | ✅ Detailed |
| 16 | Content Calendar View | Sensible defaults |
| 17 | Automated Quality Checks on Export | Sensible defaults |
| 18 | Clip Performance Analytics Dashboard | Sensible defaults |

### Tier 4: Business & Operations (6)
| # | Feature | Status |
|---|---------|--------|
| 3 | Built-In Invoicing | ✅ Detailed |
| 6 | Clip Lifecycle Tracking | ✅ Detailed |
| 10 | Smart Project Scoping | Sensible defaults |
| 11 | Time-to-Value Tracking | Sensible defaults |
| 13 | Export Audit Trails | Sensible defaults |
| 20 | NDA / Contract Management | Sensible defaults |

### Tier 5: Trust & Safety (3)
| # | Feature | Status |
|---|---------|--------|
| 7 | Internal Dispute Resolution | ✅ Detailed |
| 19 | Composite Reputation Score | Sensible defaults |
| 9 | Clipper Leveling System | Sensible defaults |

### Tier 6: Resource Management (1)
| # | Feature | Status |
|---|---------|--------|
| 12 | Clipper Availability Status | Sensible defaults |
