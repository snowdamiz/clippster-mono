# Restricted Clipper Accounts Implementation Plan

## Overview

Organizations can create **restricted accounts** for clippers that limit them to only work within the scope assigned by the organization. These accounts cannot be used for personal clipping, joining other organizations, or accessing creators/campaigns not assigned to them.

> **Note**: A clipper could always create their own separate personal account. This system only applies to accounts **created by an organization**.

---

## How It Works

1. Org admin creates an account for a clipper (email + temp password)
2. Account is flagged with `created_by_organization_id = org.id`
3. Account has `is_restricted = true` by default
4. Clipper can only do what the org allows via restriction settings

---

## Restriction Categories

### Core Restrictions (Always On for Restricted Accounts)

These cannot be toggled - they're inherent to restricted accounts:

| Restriction | Description |
|-------------|-------------|
| **Restrict to assigned creators** | Can only track streams, download VODs, and create clips from assigned creator profiles |
| **Block joining other organizations** | Cannot join, apply to, or browse other organizations |
| **Hide billing page** | Org handles all billing; clipper has no access |
| **Clips owned by organization** | All clips created belong to the org |
| **Hide creator directory** | Cannot browse public creator profiles |
| **Hide campaign discovery** | Cannot browse or apply to public campaigns |

### Org-Configurable Toggles (Two Levels)

Restrictions can be set at **two levels**:

1. **Organization Defaults** - Base settings for all restricted members
2. **Per-Member Overrides** - Individual settings that override org defaults

This allows orgs to set sensible defaults while giving specific clippers more (or fewer) permissions.

#### Organization Default Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `allow_ai` | `true` | Enable AI features (auto-detect, captions, transcription) |
| `allow_asset_uploads` | `false` | Allow uploading personal intros, outros, watermarks |
| `allow_custom_prompts` | `false` | Allow creating custom AI prompts |
| `allow_clipper_profile` | `false` | Allow creating/editing public clipper profile |
| `allow_personal_social` | `true` | Allow connecting personal social accounts |
| `allow_clip_deletion` | `false` | Allow deleting clips (org retains if false) |
| `force_org_watermark` | `true` | Force org watermark on all exports |
| `require_clip_approval` | `false` | Clips must be approved before publishing |
| `clips_visible_to_admins` | `true` | Org admins can see all clips from restricted members |

#### Per-Member Overrides

Each restricted member can have individual overrides. If not set, they inherit the org default.

**Example scenarios**:
- Org default: `allow_ai = false`, but trusted clipper John has `allow_ai = true`
- Org default: `require_clip_approval = true`, but senior clipper Jane has `require_clip_approval = false`
- Org default: `allow_asset_uploads = false`, but designer Mike has `allow_asset_uploads = true`

**Resolution logic**:
```
effective_setting = member_override ?? org_default
```

---

## Feature-by-Feature Breakdown

### Stream Monitoring & VODs (LiveClip.vue, StreamVods.vue)

| Feature | Unrestricted | Restricted |
|---------|--------------|------------|
| Track any stream URL | ✅ Any URL | ❌ Only assigned creators' streams |
| Download any VOD | ✅ Any creator | ❌ Only assigned creators' VODs |
| Use DVR recording | ✅ Yes | ✅ Yes (for assigned creators) |
| Auto-detect clips | ✅ Any stream | ⚠️ Only if `allow_ai` enabled + assigned creators |

**Implementation**:
- Validate stream URLs against assigned creator platform links
- Filter VOD search results to assigned creators only
- Hide/disable "Auto" button when `allow_ai = false`

### Content Creation (Projects.vue, Clips.vue)

| Feature | Unrestricted | Restricted |
|---------|--------------|------------|
| Create projects | ✅ Any | ⚠️ Must be linked to assigned creator/campaign |
| Upload raw videos | ✅ Yes | ❌ No |
| Use video editor | ✅ Any video | ❌ Only clips from assigned creators |
| Build clips | ✅ Yes | ✅ Yes (for assigned work) |
| Export clips | ✅ Yes | ✅ Yes |
| Delete clips | ✅ Yes | ⚠️ Only if `allow_clip_deletion` enabled |

### Assets & Customization (Assets.vue, Prompts.vue)

| Feature | Unrestricted | Restricted |
|---------|--------------|------------|
| Upload intros/outros | ✅ Yes | ⚠️ Only if `allow_asset_uploads` enabled |
| Upload watermarks | ✅ Yes | ⚠️ Only if `allow_asset_uploads` enabled |
| Create custom prompts | ✅ Yes | ⚠️ Only if `allow_custom_prompts` enabled |
| Use org/campaign assets | ✅ Yes | ✅ Yes (these are the primary assets) |

### Watermark Enforcement

When `force_org_watermark = true`:

| Behavior | Description |
|----------|-------------|
| Build settings | Org watermark pre-selected and locked |
| Remove watermark option | Hidden/disabled |
| Personal watermarks | Not available |
| Campaign watermark | Takes precedence if set |

**Implementation**:
- In `ClipBuildSettingsDialog.vue`: Check restriction, lock watermark selector
- In build pipeline: Always apply org/campaign watermark, ignore user override attempts
- Backend validation: Reject builds without required watermark

### Clip Approval Workflow

When `require_clip_approval = true`:

| State | Description |
|-------|-------------|
| `pending_approval` | Clip built but awaiting admin review |
| `approved` | Admin approved, can be published |
| `rejected` | Admin rejected with optional feedback |
| `published` | Clip has been posted |

**Flow**:
1. Clipper builds a clip → status = `pending_approval`
2. Clip appears in org admin's approval queue
3. Admin reviews and approves/rejects
4. If approved, clipper can publish
5. If rejected, clipper sees feedback and can rebuild

**Implementation**:
- Add `approval_status` field to clips table
- Add `approval_notes` field for admin feedback
- New admin UI: Approval queue in org dashboard
- Clipper UI: Show approval status badge on clips
- Block publish actions for unapproved clips

### Profiles & Identity (ClipperProfilePage.vue, CreatorProfiles.vue)

| Feature | Unrestricted | Restricted |
|---------|--------------|------------|
| Create clipper profile | ✅ Yes | ⚠️ Only if `allow_clipper_profile` enabled |
| Edit clipper profile | ✅ Yes | ⚠️ Only if `allow_clipper_profile` enabled |
| Appear on leaderboard | ✅ Yes | ❌ No (or under org branding) |
| Create creator profiles | ✅ Yes | ❌ No |
| View creator directory | ✅ All creators | ❌ Only assigned creators |

### Organizations & Campaigns (Organizations.vue, CampaignsPage.vue)

| Feature | Unrestricted | Restricted |
|---------|--------------|------------|
| Join other organizations | ✅ Yes | ❌ No - locked to creating org |
| Leave organization | ✅ Yes | ⚠️ Deletes account or converts to personal |
| Browse public campaigns | ✅ Yes | ❌ No |
| Apply to campaigns | ✅ Yes | ❌ No - only sees assigned campaigns |
| View org they're in | ✅ Yes | ✅ Yes (limited view) |

### Social & Publishing

| Feature | Unrestricted | Restricted |
|---------|--------------|------------|
| Connect personal social accounts | ✅ Yes | ⚠️ Only if `allow_personal_social` enabled |
| Use org-assigned social accounts | ✅ Yes | ✅ Yes |
| Post to personal accounts | ✅ Yes | ⚠️ Only if `allow_personal_social` enabled |
| Schedule posts | ✅ Yes | ✅ Yes (for approved clips if approval required) |
| Publish unapproved clips | ✅ Yes | ❌ No (if `require_clip_approval` enabled) |

### Billing & Account (Billing.vue)

| Feature | Unrestricted | Restricted |
|---------|--------------|------------|
| View billing page | ✅ Yes | ❌ Hidden |
| Manage subscription | ✅ Yes | ❌ No - org handles |
| Use credits | ✅ Personal credits | ✅ Org-allocated credits |
| Buy credits | ✅ Yes | ❌ No |

---

## Navigation Changes

For restricted accounts, sidebar visibility:

**Hidden**:
- ❌ Creators (browse page)
- ❌ Campaigns (browse page) 
- ❌ Assets (if `allow_asset_uploads = false`)
- ❌ Prompts (if `allow_custom_prompts = false`)
- ❌ Billing
- ❌ Clipper Profile (if `allow_clipper_profile = false`)

**Visible**:
- ✅ Projects (scoped to assignments)
- ✅ My Clips (their work)
- ✅ Live (assigned creators only)
- ✅ Stream VODs (assigned creators only)
- ✅ Organizations (their org only)
- ✅ Messages (org communication)

---

## Database Changes

### Migration: Add restriction fields to organizations

```sql
-- Organization-level defaults for all restricted members
ALTER TABLE organizations ADD COLUMN restriction_defaults JSONB DEFAULT '{
  "allow_ai": true,
  "allow_asset_uploads": false,
  "allow_custom_prompts": false,
  "allow_clipper_profile": false,
  "allow_personal_social": true,
  "allow_clip_deletion": false,
  "force_org_watermark": true,
  "require_clip_approval": false,
  "clips_visible_to_admins": true
}'::jsonb;
```

### Migration: Add restriction fields to organization_members

```sql
-- Flag indicating this is a restricted account
ALTER TABLE organization_members ADD COLUMN is_restricted BOOLEAN DEFAULT false;

-- Per-member overrides (NULL values inherit from org defaults)
-- Only non-null values override the org default
ALTER TABLE organization_members ADD COLUMN restriction_overrides JSONB DEFAULT NULL;

-- Example override: {"allow_ai": true, "require_clip_approval": false}
-- This member gets AI access and no approval required, 
-- but inherits all other settings from org defaults
```

### Resolution Logic (Backend)

```elixir
def get_effective_restrictions(organization_id, user_id) do
  org = get_organization(organization_id)
  member = get_member(organization_id, user_id)
  
  if member.is_restricted do
    org_defaults = org.restriction_defaults || %{}
    member_overrides = member.restriction_overrides || %{}
    
    # Merge: member overrides take precedence
    Map.merge(org_defaults, member_overrides)
  else
    # Non-restricted members have no restrictions
    %{restricted: false}
  end
end
```

### Migration: Add approval fields to clips

```sql
ALTER TABLE clips ADD COLUMN approval_status VARCHAR(20) DEFAULT NULL;
-- Values: NULL (not restricted), 'pending_approval', 'approved', 'rejected'

ALTER TABLE clips ADD COLUMN approval_notes TEXT DEFAULT NULL;
ALTER TABLE clips ADD COLUMN approved_by_user_id BIGINT REFERENCES users(id);
ALTER TABLE clips ADD COLUMN approved_at TIMESTAMP;
```

### Migration: Track org ownership of clips

```sql
ALTER TABLE clips ADD COLUMN organization_id BIGINT REFERENCES organizations(id);
-- Set when clip is created by a restricted member
```

---

## Backend Implementation

### New Context Functions (organizations.ex)

```elixir
def is_restricted_member?(user_id)
def get_restriction_settings(organization_id)
def get_user_restrictions(user_id)  # Returns effective restrictions for user
def can_access_creator?(user_id, creator_identifier)
def get_allowed_creators_for_user(user_id)
def update_restriction_settings(org_id, settings, admin)
```

### New Context Functions (clips.ex)

```elixir
def submit_for_approval(clip_id)
def approve_clip(clip_id, admin_user_id, notes \\ nil)
def reject_clip(clip_id, admin_user_id, notes)
def list_pending_approval_clips(organization_id)
def can_publish_clip?(clip_id, user_id)
```

### New API Endpoints

```elixir
# User permissions endpoint
GET /api/user/restrictions
# Returns effective restrictions for current user

# Org restriction settings
GET /api/organizations/:id/restriction-settings
PUT /api/organizations/:id/restriction-settings

# Clip approval
GET /api/organizations/:id/clips/pending-approval
POST /api/clips/:id/submit-for-approval
POST /api/clips/:id/approve
POST /api/clips/:id/reject
```

### Middleware/Plugs

- Add permission checks to VOD download endpoint
- Add permission checks to stream tracking
- Add watermark enforcement in build pipeline
- Add approval check before publish actions

---

## Frontend Implementation

### New Permissions Store (stores/permissions.ts)

```typescript
interface UserRestrictions {
  isRestricted: boolean;
  restrictingOrgId: string | null;
  
  // Computed from org settings
  allowAi: boolean;
  allowAssetUploads: boolean;
  allowCustomPrompts: boolean;
  allowClipperProfile: boolean;
  allowPersonalSocial: boolean;
  allowClipDeletion: boolean;
  forceOrgWatermark: boolean;
  requireClipApproval: boolean;
  
  // Assigned resources
  allowedCreatorIds: string[];
  allowedCampaignIds: string[];
}

// Actions
fetchRestrictions(): Promise<void>
canAccessCreator(creatorId: string): boolean
canAccessCampaign(campaignId: string): boolean
```

### Component Updates

**LiveClip.vue**:
- Import `useAIPermission` and hide/disable Auto button when AI disabled
- Validate stream URLs against allowed creators
- Show message when trying to track non-assigned creator

**StreamVods.vue**:
- Filter search to allowed creators only
- Show "restricted" message for non-assigned creators

**ClipBuildSettingsDialog.vue**:
- Lock watermark selector when `forceOrgWatermark = true`
- Show org watermark as required

**Clips.vue / ClipsTab.vue**:
- Show approval status badge on clips
- Disable publish button for unapproved clips
- Hide delete button when `allowClipDeletion = false`

**navigation.ts**:
- Add `restrictedHidden` property to nav items
- Filter based on user restrictions

### New Components

**ClipApprovalQueue.vue** (for org admins):
- List of pending approval clips
- Preview, approve, reject actions
- Feedback input for rejections

**ApprovalStatusBadge.vue**:
- Visual indicator for clip approval status
- Pending (yellow), Approved (green), Rejected (red)

---

## Org Admin UI

### OrganizationSettings.vue - New Section

```
┌─────────────────────────────────────────────────────┐
│ RESTRICTED MEMBER SETTINGS                          │
│ These settings apply to accounts created by your    │
│ organization.                                       │
├─────────────────────────────────────────────────────┤
│ AI & DETECTION                                      │
│ ☑ Enable AI Features                               │
│   Auto-detect, captions, transcription              │
│                                                     │
│ CONTENT & ASSETS                                    │
│ ☐ Allow uploading personal assets                  │
│ ☐ Allow creating custom prompts                    │
│ ☑ Force organization watermark on exports          │
│                                                     │
│ PUBLISHING & APPROVAL                               │
│ ☑ Require clip approval before publishing          │
│ ☐ Allow deleting clips                             │
│                                                     │
│ PROFILE & SOCIAL                                    │
│ ☐ Allow creating clipper profile                   │
│ ☑ Allow connecting personal social accounts        │
└─────────────────────────────────────────────────────┘
```

### OrganizationClippers.vue - Member Management

```
┌─────────────────────────────────────────────────────┐
│ Clipper: john@example.com                           │
│ Status: Restricted Account                          │
│ Created: Jan 10, 2026                               │
├─────────────────────────────────────────────────────┤
│ ASSIGNED CREATORS                                   │
│ ☑ xQc (Twitch, Kick, YouTube)                      │
│ ☑ Kai Cenat (Twitch, YouTube)                      │
│ ☐ Asmongold                                         │
│ [+ Assign Creator]                                  │
├─────────────────────────────────────────────────────┤
│ ASSIGNED CAMPAIGNS                                  │
│ ☑ Q1 Highlights Campaign                           │
│ [+ Assign Campaign]                                 │
├─────────────────────────────────────────────────────┤
│ PERMISSION OVERRIDES                                │
│ These override the organization defaults.           │
│                                                     │
│ AI Features          [Use Default ▼] (Default: On)  │
│ Asset Uploads        [Use Default ▼] (Default: Off) │
│ Custom Prompts       [Use Default ▼] (Default: Off) │
│ Clipper Profile      [Allow      ▼] ← OVERRIDE     │
│ Personal Social      [Use Default ▼] (Default: On)  │
│ Clip Deletion        [Use Default ▼] (Default: Off) │
│ Force Watermark      [Use Default ▼] (Default: On)  │
│ Require Approval     [Skip       ▼] ← OVERRIDE     │
│                                                     │
│ [Reset All to Defaults]                             │
├─────────────────────────────────────────────────────┤
│ STATS                                               │
│ Clips created: 47                                   │
│ Pending approval: 3                                 │
│ Credits used: 127 / 500 min                         │
└─────────────────────────────────────────────────────┘
```

Each dropdown has three options:
- **Use Default** - Inherit from org settings
- **Allow / On** - Override to enable
- **Deny / Off** - Override to disable

### New: Approval Queue Tab

```
┌─────────────────────────────────────────────────────┐
│ PENDING APPROVAL (12)                               │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ [Thumbnail] "Epic clutch moment"                │ │
│ │ Creator: xQc | Clipper: john@example.com        │ │
│ │ Submitted: 2 hours ago                          │ │
│ │ [Preview] [Approve ✓] [Reject ✗]                │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [Thumbnail] "Funny fail compilation"            │ │
│ │ Creator: Kai Cenat | Clipper: jane@example.com  │ │
│ │ Submitted: 5 hours ago                          │ │
│ │ [Preview] [Approve ✓] [Reject ✗]                │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (3-4 days)
- [ ] Database migrations (restriction settings, approval fields)
- [ ] Backend context functions for restrictions
- [ ] API endpoint for user restrictions
- [ ] Frontend permissions store

### Phase 2: Navigation & Access Control (2-3 days)
- [ ] Update navigation.ts with restriction filtering
- [ ] Hide/show nav items based on restrictions
- [ ] Add restriction checks to page components
- [ ] Validate creator access in LiveClip/StreamVods

### Phase 3: AI & Auto-Detect Restrictions (1-2 days)
- [ ] Hide/disable Auto button when AI disabled
- [ ] Update useAIPermission composable
- [ ] Add visual indicators for disabled features

### Phase 4: Watermark Enforcement (2-3 days)
- [ ] Update ClipBuildSettingsDialog for locked watermark
- [ ] Backend validation for required watermark
- [ ] Campaign/org watermark cascade logic

### Phase 5: Clip Approval Workflow (3-4 days)
- [ ] Add approval status to clips
- [ ] Create approval queue UI for admins
- [ ] Add approval status badges
- [ ] Block publish for unapproved clips
- [ ] Rejection feedback flow

### Phase 6: Admin UI & Polish (2-3 days)
- [ ] Restriction settings in OrganizationSettings
- [ ] Member restriction management in OrganizationClippers
- [ ] Create restricted account flow
- [ ] Testing & edge cases

**Total Estimate: 13-19 days**

---

## Edge Cases

### Clipper wants to leave org
- **Option A**: Account is deleted (clips stay with org)
- **Option B**: Account converts to personal (loses org access, org keeps clips)

### Org removes clipper
- Revoke access immediately
- Clips created for org stay with org
- Account can be deleted or converted

### Clipper makes a second account
- Completely separate - unrestricted personal account
- Can join any org, do anything
- No connection to the org-created account

### Approval timeout
- Consider auto-approve after X days (configurable)
- Or escalation to org owner

### Bulk operations
- Bulk approve/reject in approval queue
- Bulk assign creators to multiple clippers

---

## Future Enhancements

- **Working hours restriction**: Only allow clipping during certain hours
- **Platform restrictions**: Limit to specific platforms (Twitch only, etc.)
- **Export quality limits**: Cap max resolution
- **Session time limits**: Auto-stop after X hours
- **Clip templates**: Force specific build presets
- **Analytics dashboard**: Org-wide clipper performance metrics
