import { api } from '@/lib/api'
import type { Campaign, CampaignResource, CampaignSubmissionAnalytics } from '@/types/organization'

export async function listOrganizationCampaigns(orgId: number, status?: string) {
  const qs = status ? `?status=${status}` : ''
  return api.get<{ success: boolean; campaigns: Campaign[]; error?: string }>(`/organizations/${orgId}/campaigns${qs}`)
}

export async function createCampaign(
  orgId: number,
  data: {
    title: string
    description?: string
    cover_image_url?: string
    creator_profile_id?: number | null
    budget?: string
    cpm?: string
    min_views_for_payment?: number
    join_type?: string
    allowed_platforms?: string[]
    payment_methods?: string[]
    status?: string
    starts_at?: string
    ends_at?: string
    branding_profile_id?: number | null
    content_vertical?: string | null
    campaign_goal?: string | null
    content_style_tags?: string[]
    resources?: CampaignResource[]
  }
) {
  return api.post<{ success: boolean; campaign?: Campaign; error?: string }>(`/organizations/${orgId}/campaigns`, data)
}

export async function updateCampaign(
  orgId: number,
  campaignId: number,
  data: Partial<{
    title: string
    description: string
    status: string
    budget: string
    cpm: string
    creator_profile_id: number | null
    branding_profile_id: number | null
    cover_image_url: string
    min_views_for_payment: number
    join_type: string
    allowed_platforms: string[]
    payment_methods: string[]
    starts_at: string
    ends_at: string
    content_vertical: string | null
    campaign_goal: string | null
    content_style_tags: string[]
    resources: CampaignResource[]
  }>
) {
  return api.put<{ success: boolean; campaign?: Campaign; error?: string }>(`/organizations/${orgId}/campaigns/${campaignId}`, data)
}

export async function deleteCampaign(orgId: number, campaignId: number) {
  return api.delete<{ success: boolean; error?: string }>(`/organizations/${orgId}/campaigns/${campaignId}`)
}

export async function pauseCampaign(orgId: number, campaignId: number) {
  return api.post<{ success: boolean; campaign?: Campaign; error?: string }>(`/organizations/${orgId}/campaigns/${campaignId}/pause`)
}

export async function activateCampaign(orgId: number, campaignId: number) {
  return api.post<{ success: boolean; campaign?: Campaign; error?: string }>(`/organizations/${orgId}/campaigns/${campaignId}/activate`)
}

export async function completeCampaign(orgId: number, campaignId: number) {
  return api.post<{ success: boolean; campaign?: Campaign; error?: string }>(`/organizations/${orgId}/campaigns/${campaignId}/complete`)
}

export async function listCampaignParticipants(orgId: number, campaignId: number, status?: string) {
  const qs = status ? `?status=${status}` : ''
  return api.get<{ success: boolean; participants: any[]; error?: string }>(`/organizations/${orgId}/campaigns/${campaignId}/participants${qs}`)
}

export async function approveParticipant(orgId: number, campaignId: number, participantId: number) {
  return api.post<{ success: boolean; error?: string }>(`/organizations/${orgId}/campaigns/${campaignId}/participants/${participantId}/approve`)
}

export async function rejectParticipant(orgId: number, campaignId: number, participantId: number) {
  return api.post<{ success: boolean; error?: string }>(`/organizations/${orgId}/campaigns/${campaignId}/participants/${participantId}/reject`)
}

export async function listOrganizationCampaignSubmissions(
  orgId: number | string,
  options?: { status?: string; platform?: string; campaign_id?: number; limit?: number; offset?: number }
) {
  const params = new URLSearchParams()
  if (options) {
    Object.entries(options).forEach(([key, val]) => {
      if (val !== undefined) params.append(key, String(val))
    })
  }
  const qs = params.toString() ? `?${params.toString()}` : ''
  return api.get<{ success: boolean; submissions: any[]; total?: number; error?: string }>(
    `/organizations/${orgId}/campaign-submissions${qs}`
  )
}

export async function verifySubmission(orgId: number, submissionId: number) {
  return api.post<{ success: boolean; error?: string }>(`/organizations/${orgId}/submissions/${submissionId}/verify`)
}

export async function rejectSubmission(orgId: number, submissionId: number, reason: string) {
  return api.post<{ success: boolean; error?: string }>(`/organizations/${orgId}/submissions/${submissionId}/reject`, { reason })
}

export async function syncSubmissionMetrics(orgId: number, submissionId: number) {
  return api.post<{
    success: boolean
    submission?: Record<string, unknown>
    analytics?: CampaignSubmissionAnalytics
    error?: string
  }>(`/organizations/${orgId}/submissions/${submissionId}/sync-metrics`)
}

export async function getSubmissionAnalytics(orgId: number, submissionId: number) {
  return api.get<{ success: boolean; analytics?: CampaignSubmissionAnalytics; error?: string }>(
    `/organizations/${orgId}/submissions/${submissionId}/analytics`
  )
}

export async function uploadCampaignCoverImage(orgId: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('asset_type', 'image')
  return api.upload<{ success: boolean; asset?: { url: string }; error?: string }>(`/organizations/${orgId}/assets`, formData)
}

export async function setCampaignCreatorProfiles(orgId: number, campaignId: number, creatorProfileIds: number[]) {
  return api.put<{ success: boolean; error?: string }>(`/organizations/${orgId}/campaigns/${campaignId}/creator-profiles`, {
    creator_profile_ids: creatorProfileIds
  })
}

export async function setCampaignResources(orgId: number, campaignId: number, resources: CampaignResource[]) {
  return api.put<{ success: boolean; resources: CampaignResource[]; error?: string }>(
    `/organizations/${orgId}/campaigns/${campaignId}/resources`,
    { resources }
  )
}

export const CAMPAIGN_CONTENT_VERTICALS = [
  { value: 'gaming', label: 'Gaming / Livestreams' },
  { value: 'music', label: 'Music' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'brand', label: 'Brand / Product' },
  { value: 'course', label: 'Course / Community' },
  { value: 'event', label: 'Event' },
  { value: 'news', label: 'News / Commentary' },
  { value: 'other', label: 'Other' }
]

export const VERIFICATION_WARNING_LABELS: Record<string, string> = {
  post_not_in_feed: 'Post not found in connected account feed',
  no_connected_account: 'No connected social account for verification',
  stale_metrics: 'Metrics are stale',
  never_synced: 'Metrics have never synced',
  duplicate_url: 'Duplicate submission URL in this campaign',
  view_spike: 'Large view increase between snapshots',
  low_engagement: 'Very low engagement relative to views',
  insufficient_metrics: 'Not enough metrics returned to assess confidence',
  manual_override: 'Views were manually overridden',
  invalid_url: 'Could not parse submission URL for feed lookup'
}

export function detectPlatformFromUrl(url: string): string | null {
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('x.com') || url.includes('twitter.com')) return 'x'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  return null
}

export function formatCpm(cpm: string | number): string {
  const val = typeof cpm === 'string' ? parseFloat(cpm) : cpm
  return `$${val.toFixed(2)} per 1K views`
}

export function getPlatformDisplayName(platform: string): string {
  const names: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', x: 'X (Twitter)', youtube: 'YouTube' }
  return names[platform] || platform
}
