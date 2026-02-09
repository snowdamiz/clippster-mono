import { api } from '@/lib/api'
import type { ScheduledPost, ExternalPostSubmission } from '@/types/organization'

export async function listOrgScheduledPosts(orgId: number | string, options?: { status?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams()
  if (options) {
    Object.entries(options).forEach(([key, val]) => {
      if (val !== undefined) params.append(key, String(val))
    })
  }
  const qs = params.toString() ? `?${params.toString()}` : ''
  return api.get<{ success: boolean; posts: ScheduledPost[]; total?: number; error?: string }>(`/organizations/${orgId}/scheduled-posts${qs}`)
}

export async function listExternalPosts(orgId: number | string, options?: { status?: string; creator_profile_id?: number; campaign_id?: number; limit?: number; offset?: number }) {
  const params = new URLSearchParams()
  if (options) {
    Object.entries(options).forEach(([key, val]) => {
      if (val !== undefined) params.append(key, String(val))
    })
  }
  const qs = params.toString() ? `?${params.toString()}` : ''
  return api.get<{ success: boolean; submissions: ExternalPostSubmission[]; total: number; error?: string }>(`/organizations/${orgId}/external-posts${qs}`)
}

export async function approveExternalPost(orgId: number | string, submissionId: number) {
  return api.post<{ success: boolean; submission?: ExternalPostSubmission; error?: string }>(`/organizations/${orgId}/external-posts/${submissionId}/approve`)
}

export async function rejectExternalPost(orgId: number | string, submissionId: number, notes?: string) {
  return api.post<{ success: boolean; submission?: ExternalPostSubmission; error?: string }>(`/organizations/${orgId}/external-posts/${submissionId}/reject`, notes ? { notes } : undefined)
}

export async function syncOrgAnalytics(orgId: number | string) {
  return api.post<{ success: boolean; message?: string; error?: string }>(`/organizations/${orgId}/sync-analytics`)
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMins = Math.round(diffMs / 60000)
  const diffHours = Math.round(diffMs / 3600000)
  const diffDays = Math.round(diffMs / 86400000)

  if (diffMs > 0) {
    if (diffMins < 60) return `in ${diffMins} min`
    if (diffHours < 24) return `in ${diffHours} hours`
    return `in ${diffDays} days`
  }
  const absMins = Math.abs(diffMins)
  const absHours = Math.abs(diffHours)
  const absDays = Math.abs(diffDays)
  if (absMins < 60) return `${absMins} min ago`
  if (absHours < 24) return `${absHours} hours ago`
  return `${absDays} days ago`
}

export function getStatusColor(status: ScheduledPost['status']): string {
  const colors: Record<string, string> = {
    published: 'text-emerald-400',
    scheduled: 'text-blue-400',
    publishing: 'text-blue-400',
    pending: 'text-amber-400',
    failed: 'text-red-400',
    canceled: 'text-zinc-500',
  }
  return colors[status] || 'text-zinc-400'
}
