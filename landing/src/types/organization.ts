export interface Organization {
  id: number
  name: string
  description?: string
  logo_url?: string
  settings?: {
    allow_ai?: boolean
  }
  restriction_defaults?: OrganizationRestrictionDefaults
  inserted_at?: string
  updated_at?: string
}

export interface OrganizationMember {
  id: number
  user_id: number
  role: 'owner' | 'admin' | 'member'
  is_restricted?: boolean
  restriction_overrides?: Record<string, boolean>
  user?: {
    id: number
    name?: string
    email: string
    avatar_url?: string
    created_by_organization_id?: number | null
  }
  allocation?: {
    hours_allocated: string
    hours_used: string
    hours_remaining: string
  }
}

export interface OrganizationInvitation {
  id: number
  email: string
  role: string
  expires_at: string
}

export interface OrganizationCredits {
  hoursRemaining: string
  hoursUsed: string
}

export interface OrganizationSubscription {
  status: string
  tier: string | null
  tier_name: string | null
  start_date: string | null
  end_date: string | null
  renewal_method: string | null
  days_remaining: number
  has_subscription: boolean
  base_seats: number
  base_credits: number
  addons: Array<{
    tier: string
    name: string
    seats: number
    credits: number
  }>
  total_seats: number | null
  total_monthly_credits: number
  current_members: number
  seats_remaining: number | null
}

export interface OrganizationRestrictionDefaults {
  allow_ai?: boolean
  allow_asset_uploads?: boolean
  allow_custom_prompts?: boolean
  allow_clipper_profile?: boolean
  allow_personal_social?: boolean
  allow_clip_deletion?: boolean
  allow_hiring_browse?: boolean
  force_org_watermark?: boolean
  require_clip_approval?: boolean
  clips_visible_to_admins?: boolean
}

export interface LayoutOverlay {
  id: string
  imagePath: string
  imageUrl?: string
  assetId?: number | null
  label: string
  opacity: number
  perRatioSettings?: Record<string, unknown> | null
}

export interface ServerOrganizationCreatorProfile {
  id: number
  organization_id: number
  created_by_user_id?: number | null
  name: string
  description?: string | null
  profile_image_url?: string | null
  intro_id?: number | null
  outro_id?: number | null
  watermark_id?: number | null
  watermark_settings?: Record<string, unknown> | null
  layout_overlays?: LayoutOverlay[] | null
  disabled?: boolean
  platform_links?: ServerOrganizationPlatformLink[]
  assignments?: ServerProfileAssignment[]
  assigned_count?: number
  inserted_at?: string
  updated_at?: string
}

export interface ServerOrganizationPlatformLink {
  id: number
  creator_profile_id: number
  platform: string
  platform_id: string
  display_name?: string | null
  profile_image_url?: string | null
  is_primary: boolean
}

export interface ServerProfileAssignment {
  id: number
  creator_profile_id: number
  user_id: number
  user?: {
    id: number
    email: string
    name?: string
    avatar_url?: string
  }
}

export interface ServerOrganizationAsset {
  id: number
  organization_id: number
  asset_type: 'intro' | 'outro' | 'watermark' | 'audio' | 'image' | 'video' | 'overlay' | 'other'
  name: string
  url: string
  thumbnail_url?: string | null
  duration?: string | null
  width?: number | null
  height?: number | null
  file_size?: number | null
  mime_type?: string | null
  inserted_at?: string
}

export interface SocialAccount {
  id: number
  organization_id: number
  platform: string
  platform_user_id: string
  username: string
  display_name?: string
  profile_image_url?: string | null
  is_active: boolean
  token_expires_at?: string | null
  inserted_at?: string
  connected_at?: string | null
  assignments?: SocialAccountAssignment[]
}

export interface SocialAccountAssignment {
  id: number
  social_account_id: number
  user_id: number
  user?: {
    id: number
    email: string
    name?: string
    avatar_url?: string
  }
}

export interface SharedClip {
  id: number
  organization_id: number
  organization_name?: string
  name: string
  description: string | null
  url?: string
  thumbnail_url: string | null
  duration: number | null
  file_size: number | null
  share_with_all: boolean
  branding_config: Record<string, any>
  branding_required: boolean
  expires_at: string
  days_until_expiration: number
  inserted_at: string
  uploaded_by: { id: number; email: string; name: string | null; avatar_url: string | null } | null
  stats?: { total: number; viewed: number; downloaded: number; posted: number }
  recipients?: SharedClipRecipient[]
  viewed_at?: string | null
  downloaded_at?: string | null
  posted_at?: string | null
}

export interface SharedClipRecipient {
  user_id: number
  user: { id: number; email: string; name: string | null; avatar_url: string | null } | null
  viewed_at: string | null
  downloaded_at: string | null
  posted_at: string | null
}

export interface Campaign {
  id: number
  organization_id: number
  creator_profile_id: number | null
  title: string
  description: string | null
  cover_image_url: string | null
  budget: string
  spent: string
  cpm: string
  cpm_views: number
  min_views_for_payment: number
  join_type: 'open' | 'application_required'
  allowed_platforms: string[]
  payment_methods: string[]
  status: 'draft' | 'active' | 'paused' | 'completed'
  starts_at: string | null
  ends_at: string | null
  global_watermarks: Record<string, number> | null
  global_intro_id: number | null
  global_outro_id: number | null
  require_watermark: boolean
  require_intro: boolean
  require_outro: boolean
  inserted_at: string
  updated_at: string
  organization?: { id: number; name: string; logo_url: string | null }
  creator_profile?: CampaignCreatorProfile | null
  creator_profiles?: CampaignCreatorProfile[]
  participants_count?: number
  joined_at?: string
}

export interface CampaignCreatorProfile {
  id: number
  name: string
  profile_image_url: string | null
  description?: string | null
  watermark_settings?: Record<string, unknown> | null
  intro?: ServerOrganizationAsset | null
  outro?: ServerOrganizationAsset | null
  watermark?: ServerOrganizationAsset | null
  platform_links?: ServerOrganizationPlatformLink[]
}

export interface ScheduledPost {
  id: number
  platform: 'instagram' | 'tiktok' | 'twitter' | 'youtube'
  status: 'pending' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'canceled'
  caption: string | null
  media_url: string
  thumbnail_url: string | null
  media_type: 'image' | 'video' | 'reel' | 'carousel' | 'story'
  owner_type: 'org' | 'user'
  clip_id: string | null
  scheduled_at: string | null
  posted_at: string | null
  post_id: string | null
  post_url: string | null
  error_message: string | null
  attempts: number
  max_attempts: number
  can_edit: boolean
  can_cancel: boolean
  analytics: {
    view_count: number
    like_count: number
    comment_count: number
    save_count: number
    reach_count: number
    impressions_count: number
  }
  social_account: {
    id: number
    platform: string
    username: string
    display_name?: string
    profile_image_url?: string
  } | null
  inserted_at: string
  updated_at: string
}

export interface ExternalPostSubmission {
  id: number
  platform: string
  post_url: string
  post_id: string | null
  caption: string | null
  media_type: string | null
  clip_id: string | null
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
  reviewed_at: string | null
  analytics: {
    view_count: number
    like_count: number
    comment_count: number
    share_count: number
    save_count: number
  }
  author_username: string | null
  author_name: string | null
  author_profile_image: string | null
  submitted_by: { id: number; email: string; name?: string; avatar_url?: string } | null
  reviewed_by: { id: number; email: string; name?: string; avatar_url?: string } | null
  creator_profile: { id: number; name: string; profile_image_url?: string } | null
  campaign: { id: number; name: string } | null
  inserted_at: string
  updated_at: string
}
