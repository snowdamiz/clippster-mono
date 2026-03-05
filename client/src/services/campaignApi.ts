/**
 * Campaign API Service
 * Handles communication with the server for clipping campaigns.
 */

import api from './api';

// ============================================
// Types
// ============================================

export interface CampaignOrganization {
  id: number;
  name: string;
  logo_url: string | null;
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

export interface CampaignCreatorPlatformLink {
  id: number;
  platform: string;
  platform_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  is_primary: boolean;
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
  platform_links?: CampaignCreatorPlatformLink[];
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
  clips_per_profile: number;
  assigned_streamer_ids: number[];
  inserted_at: string;
  updated_at: string;
  organization?: CampaignOrganization;
  creator_profile?: CampaignCreatorProfile | null;
  global_intro?: CampaignAsset | null;
  global_outro?: CampaignAsset | null;
  creator_profiles?: CampaignCreatorProfile[];
  participants_count?: number;
  joined_at?: string;
}

export interface ClipperProfileSummary {
  id: number;
  display_name: string | null;
  avatar_url: string | null;
  slug: string | null;
  bio: string | null;
  is_verified: boolean;
  experience_level: string | null;
  specialty_tags: string[];
  content_style_tags: string[];
  preferred_platforms: string[];
  total_campaigns_completed: number;
  total_clips_delivered: number;
  total_endorsements: number;
  badges: { badge_type: string; earned_at: string }[];
}

export interface CampaignParticipant {
  id: number;
  campaign_id: number;
  user_id: number;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  application_note: string | null;
  approved_at: string | null;
  inserted_at: string;
  user?: {
    id: number;
    email: string;
    display_name: string | null;
  };
  clipper_profile?: ClipperProfileSummary | null;
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
  views_last_updated_at: string | null;
  status: 'pending' | 'verified' | 'rejected' | 'paid';
  rejection_reason: string | null;
  verified_at: string | null;
  inserted_at: string;
  // Analytics fields
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  save_count?: number;
  // Author metadata from platform
  author_username?: string | null;
  author_name?: string | null;
  author_profile_image?: string | null;
  caption?: string | null;
  media_type?: string | null;
  user?: {
    id: number;
    email: string;
    display_name: string | null;
  };
  campaign?: {
    id: number;
    title: string;
  };
  creator_profile?: {
    id: number;
    name: string;
    profile_image_url: string | null;
  };
}

export interface CampaignPayment {
  id: number;
  campaign_id: number;
  submission_id: number;
  user_id: number;
  amount: string;
  views_at_payment: number | null;
  status: 'pending' | 'verified' | 'completed' | 'failed';
  external_transaction_id: string | null;
  paid_at: string | null;
  verification_screenshot_url?: string | null;
  verification_notes?: string | null;
  payment_date?: string | null;
  clipper_notified_at?: string | null;
  inserted_at: string;
  campaign?: {
    id: number;
    title: string;
  };
  submission?: CampaignSubmission;
  user?: {
    id: number;
    email: string;
    display_name: string | null;
  };
}

export interface CampaignStats {
  participants_count: number;
  submissions_count: number;
  verified_count: number;
  total_views: number;
  total_paid: string;
}

export interface EarningsSummary {
  total_earned: string;
  pending: string;
  total_submissions: number;
  verified_submissions: number;
}

// Response types
export interface ListCampaignsResponse {
  success: boolean;
  campaigns: Campaign[];
  error?: string;
}

export interface CampaignResponse {
  success: boolean;
  campaign?: Campaign;
  participation?: CampaignParticipation | null;
  stats?: CampaignStats;
  error?: string;
}

export interface ParticipantResponse {
  success: boolean;
  participant?: CampaignParticipant;
  message?: string;
  error?: string;
}

export interface ListParticipantsResponse {
  success: boolean;
  participants: CampaignParticipant[];
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

export interface PaymentResponse {
  success: boolean;
  payment?: CampaignPayment;
  error?: string;
}

export interface ListPaymentsResponse {
  success: boolean;
  payments: CampaignPayment[];
  error?: string;
}

export interface EarningsResponse {
  success: boolean;
  summary: EarningsSummary;
  payments: CampaignPayment[];
  error?: string;
}

export interface DeleteResponse {
  success: boolean;
  error?: string;
}

// ============================================
// Public/Clipper Campaign API
// ============================================

/**
 * List all active campaigns (marketplace view)
 */
export async function listActiveCampaigns(limit = 50, offset = 0): Promise<ListCampaignsResponse> {
  const response = await api.get('/campaigns', {
    params: { limit, offset },
  });
  return response.data;
}

/**
 * Get a single campaign by ID
 */
export async function getCampaign(campaignId: number): Promise<CampaignResponse> {
  const response = await api.get(`/campaigns/${campaignId}`);
  return response.data;
}

/**
 * Apply to join a campaign
 */
export async function applyToCampaign(
  campaignId: number,
  applicationNote?: string
): Promise<ParticipantResponse> {
  const response = await api.post(`/campaigns/${campaignId}/apply`, {
    application_note: applicationNote,
  });
  return response.data;
}

/**
 * Submit a clip to a campaign
 */
export async function submitClip(
  campaignId: number,
  clipUrl: string,
  platform?: string,
  socialAccountId?: number
): Promise<SubmissionResponse> {
  const response = await api.post(`/campaigns/${campaignId}/submissions`, {
    clip_url: clipUrl,
    platform,
    social_account_id: socialAccountId,
  });
  return response.data;
}

/**
 * List campaigns the current user has joined
 */
export async function listMyCampaigns(status?: string): Promise<ListCampaignsResponse> {
  const response = await api.get('/user/campaigns', {
    params: { status },
  });
  return response.data;
}

/**
 * List submissions for the current user
 */
export async function listMySubmissions(campaignId?: number): Promise<ListSubmissionsResponse> {
  const response = await api.get('/user/submissions', {
    params: { campaign_id: campaignId },
  });
  return response.data;
}

/**
 * Get earnings summary for the current user
 */
export async function getMyEarnings(): Promise<EarningsResponse> {
  const response = await api.get('/user/earnings');
  return response.data;
}

// ============================================
// Organization Campaign Management API
// ============================================

/**
 * List campaigns for an organization
 */
export async function listOrganizationCampaigns(
  organizationId: number,
  status?: string
): Promise<ListCampaignsResponse> {
  const response = await api.get(`/organizations/${organizationId}/campaigns`, {
    params: { status },
  });
  return response.data;
}

/**
 * Create a new campaign
 */
export async function createCampaign(
  organizationId: number,
  data: {
    title: string;
    description?: string;
    cover_image_url?: string;
    creator_profile_id?: number;
    budget?: number;
    cpm?: number;
    cpm_views?: number;
    min_views_for_payment?: number;
    join_type?: 'open' | 'application_required';
    allowed_platforms?: string[];
    payment_methods?: string[];
    status?: string;
    starts_at?: string;
    ends_at?: string;
    payment_model?: 'cpm' | 'per_clip';
    per_clip_amount?: number;
    clips_per_profile?: number;
    branding_profile_id?: number | null;
  }
): Promise<CampaignResponse> {
  const response = await api.post(`/organizations/${organizationId}/campaigns`, data);
  return response.data;
}

/**
 * Update a campaign
 */
export async function updateCampaign(
  organizationId: number,
  campaignId: number,
  data: Partial<{
    title: string;
    description: string;
    cover_image_url: string;
    creator_profile_id: number;
    budget: number;
    cpm: number;
    cpm_views: number;
    min_views_for_payment: number;
    join_type: 'open' | 'application_required';
    allowed_platforms: string[];
    payment_methods: string[];
    status: string;
    starts_at: string;
    ends_at: string;
    payment_model: 'cpm' | 'per_clip';
    per_clip_amount: number;
    clips_per_profile: number;
    branding_profile_id: number | null;
  }>
): Promise<CampaignResponse> {
  const response = await api.put(`/organizations/${organizationId}/campaigns/${campaignId}`, data);
  return response.data;
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(
  organizationId: number,
  campaignId: number
): Promise<DeleteResponse> {
  const response = await api.delete(`/organizations/${organizationId}/campaigns/${campaignId}`);
  return response.data;
}

/**
 * Pause a campaign
 */
export async function pauseCampaign(
  organizationId: number,
  campaignId: number
): Promise<CampaignResponse> {
  const response = await api.post(`/organizations/${organizationId}/campaigns/${campaignId}/pause`);
  return response.data;
}

/**
 * Activate a campaign
 */
export async function activateCampaign(
  organizationId: number,
  campaignId: number
): Promise<CampaignResponse> {
  const response = await api.post(
    `/organizations/${organizationId}/campaigns/${campaignId}/activate`
  );
  return response.data;
}

/**
 * Complete a campaign
 */
export async function completeCampaign(
  organizationId: number,
  campaignId: number
): Promise<CampaignResponse> {
  const response = await api.post(
    `/organizations/${organizationId}/campaigns/${campaignId}/complete`
  );
  return response.data;
}

// ============================================
// Participant Management API
// ============================================

/**
 * List participants for a campaign
 */
export async function listCampaignParticipants(
  organizationId: number,
  campaignId: number,
  status?: string
): Promise<ListParticipantsResponse> {
  const response = await api.get(
    `/organizations/${organizationId}/campaigns/${campaignId}/participants`,
    { params: { status } }
  );
  return response.data;
}

/**
 * Approve a participant
 */
export async function approveParticipant(
  organizationId: number,
  campaignId: number,
  participantId: number
): Promise<ParticipantResponse> {
  const response = await api.post(
    `/organizations/${organizationId}/campaigns/${campaignId}/participants/${participantId}/approve`
  );
  return response.data;
}

/**
 * Reject a participant
 */
export async function rejectParticipant(
  organizationId: number,
  campaignId: number,
  participantId: number
): Promise<ParticipantResponse> {
  const response = await api.post(
    `/organizations/${organizationId}/campaigns/${campaignId}/participants/${participantId}/reject`
  );
  return response.data;
}

/**
 * Remove a participant
 */
export async function removeParticipant(
  organizationId: number,
  campaignId: number,
  participantId: number
): Promise<DeleteResponse> {
  const response = await api.delete(
    `/organizations/${organizationId}/campaigns/${campaignId}/participants/${participantId}`
  );
  return response.data;
}

// ============================================
// Submission Management API
// ============================================

/**
 * List all campaign submissions for an organization (across all campaigns)
 */
export async function listOrganizationCampaignSubmissions(
  organizationId: number | string,
  options?: {
    status?: string;
    platform?: string;
    campaign_id?: number;
    limit?: number;
    offset?: number;
  }
): Promise<ListSubmissionsResponse> {
  const response = await api.get(
    `/organizations/${organizationId}/campaign-submissions`,
    { params: options }
  );
  return response.data;
}

/**
 * List submissions for a campaign
 */
export async function listCampaignSubmissions(
  organizationId: number,
  campaignId: number,
  status?: string
): Promise<ListSubmissionsResponse> {
  const response = await api.get(
    `/organizations/${organizationId}/campaigns/${campaignId}/submissions`,
    { params: { status } }
  );
  return response.data;
}

/**
 * Verify a submission
 */
export async function verifySubmission(
  organizationId: number,
  submissionId: number
): Promise<SubmissionResponse> {
  const response = await api.post(
    `/organizations/${organizationId}/submissions/${submissionId}/verify`
  );
  return response.data;
}

/**
 * Reject a submission
 */
export async function rejectSubmission(
  organizationId: number,
  submissionId: number,
  reason: string
): Promise<SubmissionResponse> {
  const response = await api.post(
    `/organizations/${organizationId}/submissions/${submissionId}/reject`,
    { reason }
  );
  return response.data;
}

/**
 * Update view count for a submission
 */
export async function updateSubmissionViews(
  organizationId: number,
  submissionId: number,
  viewCount: number
): Promise<SubmissionResponse> {
  const response = await api.put(
    `/organizations/${organizationId}/submissions/${submissionId}/views`,
    { view_count: viewCount }
  );
  return response.data;
}

// ============================================
// Payment Management API
// ============================================

/**
 * List payments for a campaign
 */
export async function listCampaignPayments(
  organizationId: number,
  campaignId: number,
  status?: string
): Promise<ListPaymentsResponse> {
  const response = await api.get(
    `/organizations/${organizationId}/campaigns/${campaignId}/payments`,
    { params: { status } }
  );
  return response.data;
}

/**
 * Create a payment for a submission
 */
export async function createPayment(
  organizationId: number,
  submissionId: number,
  amount: number
): Promise<PaymentResponse> {
  const response = await api.post(
    `/organizations/${organizationId}/submissions/${submissionId}/pay`,
    { amount }
  );
  return response.data;
}

/**
 * Mark a payment as completed
 */
export async function completePayment(
  organizationId: number,
  paymentId: number,
  externalTransactionId?: string
): Promise<PaymentResponse> {
  const response = await api.post(
    `/organizations/${organizationId}/payments/${paymentId}/complete`,
    { external_transaction_id: externalTransactionId }
  );
  return response.data;
}

// ============================================
// Campaign Cover Image Upload
// ============================================

export interface UploadCoverImageResponse {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a cover image for a campaign.
 * Returns the URL of the uploaded image.
 */
export async function uploadCampaignCoverImage(
  organizationId: number,
  file: File
): Promise<UploadCoverImageResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('asset_type', 'image');
    formData.append('name', `campaign-cover-${Date.now()}`);

    const response = await api.post(`/organizations/${organizationId}/assets`, formData, {
      headers: {
        'Content-Type': undefined,
      },
      timeout: 120000, // 2 minutes
    });

    if (response.data.success && response.data.asset?.url) {
      return {
        success: true,
        url: response.data.asset.url,
      };
    }

    return {
      success: false,
      error: response.data.error || 'Failed to upload image',
    };
  } catch (error: any) {
    console.error('[CampaignApi] Failed to upload cover image:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to upload image',
    };
  }
}

// ============================================
// Helper functions
// ============================================

/**
 * Detect platform from URL
 */
export function detectPlatformFromUrl(url: string): string | null {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('tiktok.com')) return 'tiktok';
  if (urlLower.includes('instagram.com')) return 'instagram';
  if (urlLower.includes('x.com') || urlLower.includes('twitter.com')) return 'x';
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';

  return null;
}

/**
 * Format CPM for display
 */
export function formatCpm(cpm: string | number): string {
  const value = typeof cpm === 'string' ? parseFloat(cpm) : cpm;
  return `$${value.toFixed(2)} per 1K views`;
}

/**
 * Calculate estimated earnings based on views and CPM
 */
export function calculateEarnings(views: number, cpm: string | number): number {
  const cpmValue = typeof cpm === 'string' ? parseFloat(cpm) : cpm;
  return (views / 1000) * cpmValue;
}

/**
 * Get platform display name
 */
export function getPlatformDisplayName(platform: string): string {
  const names: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    x: 'X (Twitter)',
    youtube: 'YouTube',
  };
  return names[platform] || platform;
}

/**
 * Get platform icon name (for Lucide icons)
 */
export function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    tiktok: 'Music2',
    instagram: 'Instagram',
    x: 'Twitter',
    youtube: 'YouTube',
  };
  return icons[platform] || 'Globe';
}

/**
 * Get campaigns the current user has joined that include a specific creator profile.
 * Used by LiveClip to check if a creator is part of any campaigns.
 */
export async function getCampaignsByCreatorProfile(
  creatorProfileId: number
): Promise<ListCampaignsResponse> {
  const response = await api.get(`/user/campaigns/by-creator/${creatorProfileId}`);
  return response.data;
}

/**
 * Get campaign details by ID (for applying assets during build).
 * Returns campaign with global assets.
 */
export async function getCampaignById(
  campaignId: number
): Promise<{ success: boolean; campaign?: Campaign; error?: string }> {
  const response = await api.get(`/campaigns/${campaignId}`);
  return response.data;
}

// ============================================
// Campaign Creator Profiles API
// ============================================

export interface ListCreatorProfilesResponse {
  success: boolean;
  creator_profiles: CampaignCreatorProfile[];
  error?: string;
}

export interface CreatorProfileResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * List creator profiles assigned to a campaign
 */
export async function listCampaignCreatorProfiles(
  organizationId: number,
  campaignId: number
): Promise<ListCreatorProfilesResponse> {
  const response = await api.get(
    `/organizations/${organizationId}/campaigns/${campaignId}/creator-profiles`
  );
  return response.data;
}

/**
 * Add a creator profile to a campaign
 */
export async function addCreatorProfileToCampaign(
  organizationId: number,
  campaignId: number,
  creatorProfileId: number
): Promise<CreatorProfileResponse> {
  const response = await api.post(
    `/organizations/${organizationId}/campaigns/${campaignId}/creator-profiles`,
    { creator_profile_id: creatorProfileId }
  );
  return response.data;
}

/**
 * Remove a creator profile from a campaign
 */
export async function removeCreatorProfileFromCampaign(
  organizationId: number,
  campaignId: number,
  creatorProfileId: number
): Promise<CreatorProfileResponse> {
  const response = await api.delete(
    `/organizations/${organizationId}/campaigns/${campaignId}/creator-profiles/${creatorProfileId}`
  );
  return response.data;
}

/**
 * Calculate payments for all verified submissions in a campaign
 */
export async function calculateCampaignPayments(
  organizationId: number,
  campaignId: number
): Promise<{ success: boolean; payments_created: number; total_amount: string; error?: string }> {
  const response = await api.post(
    `/organizations/${organizationId}/campaigns/${campaignId}/calculate-payments`
  );
  return response.data;
}

/**
 * List payments for a campaign (updated version with status filter)
 */
export async function listCampaignPaymentsWithFilter(
  organizationId: number,
  campaignId: number,
  status?: string
): Promise<{ success: boolean; payments: CampaignPayment[]; error?: string }> {
  const params = status ? { status } : {};
  const response = await api.get(
    `/organizations/${organizationId}/campaigns/${campaignId}/payments`,
    { params }
  );
  return response.data;
}

/**
 * Verify payment completion with proof
 */
export async function verifyPayment(
  organizationId: number,
  paymentId: number,
  data: {
    screenshot_url?: string;
    notes: string;
    payment_date?: string;
  }
): Promise<{ success: boolean; payment: CampaignPayment; error?: string }> {
  const response = await api.post(
    `/organizations/${organizationId}/payments/${paymentId}/verify`,
    data
  );
  return response.data;
}

/**
 * Set all creator profiles for a campaign (replaces existing)
 */
export async function setCampaignCreatorProfiles(
  organizationId: number,
  campaignId: number,
  creatorProfileIds: number[]
): Promise<CreatorProfileResponse> {
  const response = await api.put(
    `/organizations/${organizationId}/campaigns/${campaignId}/creator-profiles`,
    { creator_profile_ids: creatorProfileIds }
  );
  return response.data;
}
