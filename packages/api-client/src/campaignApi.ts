import type { ApiClient } from './createApiClient';

export interface CampaignOrganization {
  id: number;
  name: string;
  logo_url: string | null;
  slug?: string | null;
}

export interface CampaignAsset {
  id: number;
  asset_type: string;
  name: string;
  url: string;
  thumbnail_url: string | null;
  duration: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  mime_type: string | null;
}

export interface CampaignCreatorProfile {
  id: number;
  name: string;
  profile_image_url: string | null;
  description?: string | null;
  watermark_settings?: Record<string, unknown> | null;
  intro?: CampaignAsset | null;
  outro?: CampaignAsset | null;
  watermark?: CampaignAsset | null;
}

export interface CampaignResource {
  id?: number;
  campaign_id?: number;
  resource_type: 'video' | 'audio' | 'reference_link' | 'brief' | 'file';
  source_platform?: 'x' | 'youtube' | 'rumble' | 'kick' | 'twitch' | 'other' | null;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  sort_order?: number;
  metadata?: Record<string, unknown>;
}

export interface CampaignMetricSnapshot {
  id: number;
  source: string;
  view_count?: number | null;
  like_count?: number | null;
  comment_count?: number | null;
  inserted_at: string;
}

export interface CampaignSubmissionAnalytics {
  trends: Record<string, unknown>;
  warnings: string[];
  feed_match_status?: string | null;
  metrics_last_synced_at?: string | null;
  snapshots: CampaignMetricSnapshot[];
}

export interface Campaign {
  id: number;
  organization_id: number;
  creator_profile_id: number | null;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  budget: string;
  spent: string;
  cpm: string;
  cpm_views: number;
  min_views_for_payment: number;
  join_type: 'open' | 'application_required';
  allowed_platforms: string[];
  payment_methods: string[];
  status: 'draft' | 'active' | 'paused' | 'completed';
  starts_at: string | null;
  ends_at: string | null;
  branding_profile_id: number | null;
  payment_model: 'cpm' | 'per_clip';
  per_clip_amount: string | null;
  resources?: CampaignResource[];
  inserted_at: string;
  updated_at: string;
  organization?: CampaignOrganization;
  creator_profile?: CampaignCreatorProfile | null;
  global_intro?: CampaignAsset | null;
  global_outro?: CampaignAsset | null;
  global_watermarks?: Record<string, number | null> | null;
  require_watermark?: boolean;
  require_intro?: boolean;
  require_outro?: boolean;
  creator_profiles?: CampaignCreatorProfile[];
  branding_profile?: CampaignCreatorProfile | null;
  participants_count?: number;
  joined_at?: string;
}

export interface CampaignParticipation {
  status: string;
  joined_at: string;
  approved_at: string | null;
}

export interface CampaignSubmission {
  id: number;
  campaign_id: number;
  user_id: number;
  clip_url: string;
  platform: string;
  platform_post_id: string | null;
  view_count: number;
  status: 'pending' | 'verified' | 'rejected' | 'paid';
  rejection_reason: string | null;
  verified_at: string | null;
  inserted_at: string;
  like_count?: number;
  comment_count?: number;
  campaign?: { id: number; title: string };
}

export interface CampaignPayment {
  id: number;
  campaign_id: number;
  amount: string;
  status: 'pending' | 'verified' | 'completed' | 'failed';
  paid_at: string | null;
  inserted_at: string;
  campaign?: { id: number; title: string };
}

export interface EarningsSummary {
  total_earned: string;
  pending: string;
  total_submissions: number;
  verified_submissions: number;
}

export interface ListCampaignsResponse {
  success: boolean;
  campaigns: Campaign[];
  error?: string;
}

export interface CampaignResponse {
  success: boolean;
  campaign?: Campaign;
  participation?: CampaignParticipation | null;
  error?: string;
}

export interface ParticipantResponse {
  success: boolean;
  participant?: { status: string };
  message?: string;
  error?: string;
}

export interface SubmissionResponse {
  success: boolean;
  submission?: CampaignSubmission;
  error?: string;
}

export interface ListSubmissionsResponse {
  success: boolean;
  submissions: CampaignSubmission[];
  total?: number;
  error?: string;
}

export interface EarningsResponse {
  success: boolean;
  summary: EarningsSummary;
  payments: CampaignPayment[];
  error?: string;
}

export function formatCpm(cpm: string | number): string {
  const value = typeof cpm === 'string' ? parseFloat(cpm) : cpm;
  return `$${value.toFixed(2)} per 1K views`;
}

/** Active campaigns that have not passed ends_at — eligible for posting. */
export function isCampaignOpenForPosting(campaign: Pick<Campaign, 'status' | 'ends_at'>): boolean {
  if (campaign.status !== 'active') return false;
  if (!campaign.ends_at) return true;
  const endsAt = new Date(campaign.ends_at);
  if (Number.isNaN(endsAt.getTime())) return true;
  return endsAt.getTime() > Date.now();
}

export function filterCampaignsOpenForPosting<T extends Pick<Campaign, 'status' | 'ends_at'>>(
  campaigns: T[],
): T[] {
  return campaigns.filter(isCampaignOpenForPosting);
}

export function getPlatformDisplayName(platform: string): string {
  const names: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    x: 'X (Twitter)',
    twitter: 'X (Twitter)',
    youtube: 'YouTube',
  };
  return names[platform] ?? platform;
}

export function detectPlatformFromUrl(url: string): string | null {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('tiktok.com')) return 'tiktok';
  if (urlLower.includes('instagram.com')) return 'instagram';
  if (urlLower.includes('x.com') || urlLower.includes('twitter.com')) return 'x';
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  return null;
}

export function createCampaignApi(client: ApiClient) {
  return {
    listActiveCampaigns(limit = 50, offset = 0) {
      return client.get<ListCampaignsResponse>(`/campaigns?limit=${limit}&offset=${offset}`);
    },

    getCampaign(campaignId: number) {
      return client.get<CampaignResponse>(`/campaigns/${campaignId}`);
    },

    applyToCampaign(campaignId: number, applicationNote?: string) {
      return client.post<ParticipantResponse>(`/campaigns/${campaignId}/apply`, {
        application_note: applicationNote,
      });
    },

    submitClip(campaignId: number, clipUrl: string, platform?: string, socialAccountId?: number) {
      return client.post<SubmissionResponse>(`/campaigns/${campaignId}/submissions`, {
        clip_url: clipUrl,
        platform,
        social_account_id: socialAccountId,
      });
    },

    listMyCampaigns(status?: string) {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      return client.get<ListCampaignsResponse>(`/user/campaigns${query}`);
    },

    listMySubmissions(campaignId?: number) {
      const query = campaignId ? `?campaign_id=${campaignId}` : '';
      return client.get<ListSubmissionsResponse>(`/user/submissions${query}`);
    },

    getMyEarnings() {
      return client.get<EarningsResponse>('/user/earnings');
    },
  };
}

export type CampaignApi = ReturnType<typeof createCampaignApi>;
