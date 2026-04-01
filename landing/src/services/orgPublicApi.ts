import { api } from '@/lib/api'
import { SPECIALTY_TAGS } from './clipperApi'

export interface OrgPublicProfile {
  id: number
  name: string
  slug: string
  description: string | null
  bio: string | null
  logo_url: string | null
  website_url: string | null
  public_contact_email: string | null
  content_type_tags: string[]
  stats: {
    campaigns_total: number
    campaigns_running: number
    campaigns_completed: number
    clippers_count: number
    streamers_count: number
  }
  streamers: Array<{
    id: number
    name: string | null
    profile_image_url: string | null
    platform: string | null
    display_name: string | null
  }>
  social_accounts: Array<{
    id: number
    platform: string
    username: string | null
    profile_image_url: string | null
    display_name?: string | null
  }>
  hiring: {
    title: string
    description: string | null
    status?: string | null
    clipper_slots_filled?: number | null
    clipper_slots?: number | null
    experience_level?: string | null
    payment_type?: string | null
  } | null
}

export async function getOrgPublicProfile(slug: string) {
  return api.get<{ success: boolean; profile?: OrgPublicProfile; error?: string }>(`/orgs/${slug}`)
}

export function getContentTypeLabel(value: string): string {
  return SPECIALTY_TAGS.find((t) => t.value === value)?.label || value
}
