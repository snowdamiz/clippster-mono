import { api } from '@/lib/api'
import type { ServerOrganizationCreatorProfile, ServerOrganizationPlatformLink, ServerProfileAssignment, ServerOrganizationAsset } from '@/types/organization'

// Logo upload
export async function uploadOrganizationLogo(orgId: number, file: File) {
  const formData = new FormData()
  formData.append('logo', file)
  return api.upload<{ success: boolean; logo_url?: string; error?: string }>(`/organizations/${orgId}/logo`, formData)
}

// Creator profiles
export async function listOrganizationCreatorProfiles(orgId: number) {
  return api.get<{ success: boolean; profiles: ServerOrganizationCreatorProfile[]; error?: string }>(`/organizations/${orgId}/creator-profiles`)
}

export async function getOrganizationCreatorProfile(orgId: number, profileId: number) {
  return api.get<{ success: boolean; profile?: ServerOrganizationCreatorProfile; error?: string }>(`/organizations/${orgId}/creator-profiles/${profileId}`)
}

export async function createOrganizationCreatorProfile(orgId: number, data: {
  name: string
  description?: string | null
  profile_image_url?: string | null
  intro_id?: number | null
  outro_id?: number | null
  watermark_id?: number | null
  watermark_settings?: Record<string, unknown> | null
  scope?: 'streamer' | 'global'
}) {
  return api.post<{ success: boolean; profile?: ServerOrganizationCreatorProfile; error?: string }>(`/organizations/${orgId}/creator-profiles`, data)
}

export async function updateOrganizationCreatorProfile(orgId: number, profileId: number, data: {
  name?: string
  description?: string | null
  profile_image_url?: string | null
  intro_id?: number | null
  outro_id?: number | null
  watermark_id?: number | null
  watermark_settings?: Record<string, unknown> | null
  intro_outro_settings?: Record<string, unknown> | null
  scope?: 'streamer' | 'global'
}) {
  return api.put<{ success: boolean; profile?: ServerOrganizationCreatorProfile; error?: string }>(`/organizations/${orgId}/creator-profiles/${profileId}`, data)
}

export async function deleteOrganizationCreatorProfile(orgId: number, profileId: number) {
  return api.delete<{ success: boolean; error?: string }>(`/organizations/${orgId}/creator-profiles/${profileId}`)
}

export async function uploadCreatorProfileImage(orgId: number, profileId: number, file: File) {
  const formData = new FormData()
  formData.append('image', file)
  return api.upload<{ success: boolean; profile_image_url?: string; error?: string }>(`/organizations/${orgId}/creator-profiles/${profileId}/image`, formData)
}

// Platform links
export async function addPlatformLink(orgId: number, profileId: number, data: { platform: string; platform_id: string; display_name?: string; profile_image_url?: string; is_primary?: boolean }) {
  return api.post<{ success: boolean; link?: ServerOrganizationPlatformLink; error?: string }>(`/organizations/${orgId}/creator-profiles/${profileId}/platform-links`, data)
}

export async function updatePlatformLink(orgId: number, profileId: number, linkId: number, data: { display_name?: string; is_primary?: boolean }) {
  return api.put<{ success: boolean; link?: ServerOrganizationPlatformLink; error?: string }>(`/organizations/${orgId}/creator-profiles/${profileId}/platform-links/${linkId}`, data)
}

export async function deletePlatformLink(orgId: number, profileId: number, linkId: number) {
  return api.delete<{ success: boolean; error?: string }>(`/organizations/${orgId}/creator-profiles/${profileId}/platform-links/${linkId}`)
}

// Profile assignments
export async function listProfileAssignments(orgId: number, profileId: number) {
  return api.get<{ success: boolean; assignments: ServerProfileAssignment[]; error?: string }>(`/organizations/${orgId}/creator-profiles/${profileId}/assignments`)
}

export async function assignProfile(orgId: number, profileId: number, userId: number) {
  return api.post<{ success: boolean; assignment?: ServerProfileAssignment; error?: string }>(`/organizations/${orgId}/creator-profiles/${profileId}/assignments`, { user_id: userId })
}

export async function unassignProfile(orgId: number, profileId: number, userId: number) {
  return api.delete<{ success: boolean; error?: string }>(`/organizations/${orgId}/creator-profiles/${profileId}/assignments/${userId}`)
}

// Organization assets
export async function listOrganizationAssets(orgId: number) {
  return api.get<{ success: boolean; assets: ServerOrganizationAsset[]; error?: string }>(`/organizations/${orgId}/assets`)
}

export async function uploadOrganizationAsset(orgId: number, file: File, assetType: string, name?: string) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('asset_type', assetType)
  if (name) formData.append('name', name)
  return api.upload<{ success: boolean; asset?: ServerOrganizationAsset; error?: string }>(`/organizations/${orgId}/assets`, formData)
}

export async function updateOrganizationAsset(orgId: number, assetId: number, data: { name?: string }) {
  return api.put<{ success: boolean; asset?: ServerOrganizationAsset; error?: string }>(`/organizations/${orgId}/assets/${assetId}`, data)
}

export async function deleteOrganizationAsset(orgId: number, assetId: number) {
  return api.delete<{ success: boolean; error?: string }>(`/organizations/${orgId}/assets/${assetId}`)
}

// Restriction defaults
export async function updateRestrictionDefaults(orgId: number, defaults: Record<string, boolean>) {
  return api.put<{ success: boolean; error?: string }>(`/organizations/${orgId}/restriction-defaults`, { restriction_defaults: defaults })
}
