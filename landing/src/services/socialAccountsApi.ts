import { api } from '@/lib/api'
import type { SocialAccount, SocialAccountAssignment } from '@/types/organization'

export async function listSocialAccounts(orgId: number | string, includeInactive?: boolean) {
  const qs = includeInactive ? '?include_inactive=true' : ''
  return api.get<{ success: boolean; accounts: SocialAccount[]; error?: string }>(`/organizations/${orgId}/social-accounts${qs}`)
}

export async function getSocialAccount(orgId: number | string, accountId: number) {
  return api.get<{ success: boolean; account?: SocialAccount; error?: string }>(`/organizations/${orgId}/social-accounts/${accountId}`)
}

export async function completeSocialConnection(data: { organization_id: number; platform: string; platform_user_id: string; username: string; display_name?: string; profile_image_url?: string; access_token: string; token_expires_at?: string }) {
  return api.post<{ success: boolean; account?: SocialAccount; error?: string }>('/auth/social/complete', data)
}

export async function deleteSocialAccount(orgId: number | string, accountId: number) {
  return api.delete<{ success: boolean; error?: string }>(`/organizations/${orgId}/social-accounts/${accountId}`)
}

export async function refreshAccountToken(orgId: number | string, accountId: number) {
  return api.post<{ success: boolean; message?: string; error?: string }>(`/organizations/${orgId}/social-accounts/${accountId}/refresh`)
}

export async function listAccountAssignments(orgId: number | string, accountId: number) {
  return api.get<{ success: boolean; assignments: SocialAccountAssignment[]; error?: string }>(`/organizations/${orgId}/social-accounts/${accountId}/assignments`)
}

export async function assignSocialAccount(orgId: number | string, accountId: number, userIds: number[]) {
  return api.post<{ success: boolean; error?: string }>(`/organizations/${orgId}/social-accounts/${accountId}/assignments`, { user_ids: userIds })
}

export async function unassignSocialAccount(orgId: number | string, accountId: number, userId: number) {
  return api.delete<{ success: boolean; error?: string }>(`/organizations/${orgId}/social-accounts/${accountId}/assignments/${userId}`)
}

export async function listPostSubmissions(orgId: number | string, options?: { creator_profile_id?: number; account_id?: number; platform?: string; status?: string; submitted_by_user_id?: number; limit?: number; offset?: number }) {
  const params = new URLSearchParams()
  if (options) {
    Object.entries(options).forEach(([key, val]) => {
      if (val !== undefined) params.append(key, String(val))
    })
  }
  const qs = params.toString() ? `?${params.toString()}` : ''
  return api.get<{ success: boolean; posts: any[]; total?: number; error?: string }>(`/organizations/${orgId}/posts${qs}`)
}

export async function publishPost(orgId: number | string, data: { social_account_id: number; creator_profile_id?: number; media_url: string; caption?: string; media_type?: string; thumbnail_url?: string }) {
  return api.post<{ success: boolean; post?: any; error?: string }>(`/organizations/${orgId}/posts/publish`, data)
}

export async function syncPostAnalytics(orgId: number | string, postId: number) {
  return api.post<{ success: boolean; error?: string }>(`/organizations/${orgId}/posts/${postId}/sync`)
}

export async function getAnalyticsSummary(orgId: number | string, options?: { creator_profile_id?: number; days?: number }) {
  const params = new URLSearchParams()
  if (options) {
    Object.entries(options).forEach(([key, val]) => {
      if (val !== undefined) params.append(key, String(val))
    })
  }
  const qs = params.toString() ? `?${params.toString()}` : ''
  return api.get<{ success: boolean; summary?: any; error?: string }>(`/organizations/${orgId}/posts/analytics${qs}`)
}
