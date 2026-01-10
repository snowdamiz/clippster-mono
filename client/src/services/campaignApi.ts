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

export interface CampaignCreatorProfile {
  id: number;
  name: string;
  profile_image_url: string | null;
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
  inserted_at: string;
  updated_at: string;
  organization?: CampaignOrganization;
  creator_profile?: CampaignCreatorProfile | null;
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
  user?: {
    id: number;
    email: string;
    display_name: string | null;
  };
  campaign?: {
    id: number;
    title: string;
  };
}

export interface CampaignPayment {
  id: number;
  campaign_id: number;
  submission_id: number;
  user_id: number;
  amount: string;
  views_at_payment: number | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  external_transaction_id: string | null;
  paid_at: string | null;
  inserted_at: string;
  campaign?: {
    id: number;
    title: string;
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
export async function listActiveCampaigns(
  limit = 50,
  offset = 0
): Promise<ListCampaignsResponse> {
  const response = await api.get('/campaigns', {
    params: { limit, offset }
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
    application_note: applicationNote
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
    social_account_id: socialAccountId
  });
  return response.data;
}

/**
 * List campaigns the current user has joined
 */
export async function listMyCampaigns(status?: string): Promise<ListCampaignsResponse> {
  const response = await api.get('/user/campaigns', {
    params: { status }
  });
  return response.data;
}

/**
 * List submissions for the current user
 */
export async function listMySubmissions(
  campaignId?: number
): Promise<ListSubmissionsResponse> {
  const response = await api.get('/user/submissions', {
    params: { campaign_id: campaignId }
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
    params: { status }
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
    min_views_for_payment?: number;
    join_type?: 'open' | 'application_required';
    allowed_platforms?: string[];
    payment_methods?: string[];
    status?: string;
    starts_at?: string;
    ends_at?: string;
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
    min_views_for_payment: number;
    join_type: 'open' | 'application_required';
    allowed_platforms: string[];
    payment_methods: string[];
    status: string;
    starts_at: string;
    ends_at: string;
  }>
): Promise<CampaignResponse> {
  const response = await api.put(
    `/organizations/${organizationId}/campaigns/${campaignId}`,
    data
  );
  return response.data;
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(
  organizationId: number,
  campaignId: number
): Promise<DeleteResponse> {
  const response = await api.delete(
    `/organizations/${organizationId}/campaigns/${campaignId}`
  );
  return response.data;
}

/**
 * Pause a campaign
 */
export async function pauseCampaign(
  organizationId: number,
  campaignId: number
): Promise<CampaignResponse> {
  const response = await api.post(
    `/organizations/${organizationId}/campaigns/${campaignId}/pause`
  );
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

    const response = await api.post(
      `/organizations/${organizationId}/assets`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 minutes
      }
    );

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
    youtube: 'YouTube'
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
    youtube: 'Youtube'
  };
  return icons[platform] || 'Globe';
}
