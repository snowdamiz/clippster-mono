import { api } from '@/lib/api'
import type { SharedClip } from '@/types/organization'

export async function listOrganizationSharedClips(orgId: number | string) {
  return api.get<{ success: boolean; clips: SharedClip[]; error?: string }>(`/organizations/${orgId}/shared-clips`)
}

export async function createSharedClip(orgId: number | string, file: File, options: { name: string; description?: string; duration?: number; shareWithAll?: boolean; recipientUserIds?: number[]; brandingConfig?: Record<string, any>; brandingRequired?: boolean; thumbnail?: File }) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', options.name)
  if (options.description) formData.append('description', options.description)
  if (options.duration) formData.append('duration', String(options.duration))
  if (options.shareWithAll !== undefined) formData.append('share_with_all', String(options.shareWithAll))
  if (options.recipientUserIds) formData.append('recipient_user_ids', JSON.stringify(options.recipientUserIds))
  if (options.brandingConfig) formData.append('branding_config', JSON.stringify(options.brandingConfig))
  if (options.brandingRequired !== undefined) formData.append('branding_required', String(options.brandingRequired))
  if (options.thumbnail) formData.append('thumbnail', options.thumbnail)
  return api.upload<{ success: boolean; clip?: SharedClip; error?: string }>(`/organizations/${orgId}/shared-clips`, formData)
}

export async function getSharedClip(orgId: number | string, clipId: number | string) {
  return api.get<{ success: boolean; clip?: SharedClip; error?: string }>(`/organizations/${orgId}/shared-clips/${clipId}`)
}

export async function deleteSharedClip(orgId: number | string, clipId: number | string) {
  return api.delete<{ success: boolean; error?: string }>(`/organizations/${orgId}/shared-clips/${clipId}`)
}

export async function getSharedClipStats(orgId: number | string, clipId: number | string) {
  return api.get<{ success: boolean; stats?: { total: number; viewed: number; downloaded: number; posted: number }; error?: string }>(`/organizations/${orgId}/shared-clips/${clipId}/stats`)
}

export function getExpirationBadgeColor(daysRemaining: number): 'green' | 'yellow' | 'red' {
  if (daysRemaining >= 5) return 'green'
  if (daysRemaining >= 2) return 'yellow'
  return 'red'
}

export function getExpirationText(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'Expired'
  if (daysRemaining === 1) return 'Expires tomorrow'
  return `Expires in ${daysRemaining} days`
}
