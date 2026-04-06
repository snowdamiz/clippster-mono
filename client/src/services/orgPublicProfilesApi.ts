import api from './api';
import { SPECIALTY_TAGS } from './clipperProfilesApi';

export interface OrgPublicStreamer {
  id: number;
  name: string | null;
  description: string | null;
  profile_image_url: string | null;
  platform: string | null;
  platform_id: string | null;
  display_name: string | null;
}

export interface OrgPublicSocial {
  id: number;
  platform: string;
  username: string | null;
  display_name: string | null;
  profile_image_url: string | null;
}

export interface OrgPublicHiring {
  id: number;
  title: string;
  description: string | null;
  content_types: string[];
  languages: string[];
  platforms: string[];
  payment_type: string | null;
  payment_details: string | null;
  streamer_count: number | null;
  clipper_slots: number | null;
  clipper_slots_filled: number;
  experience_level: string | null;
  status: string;
}

export interface OrgPublicProfile {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  bio: string | null;
  logo_url: string | null;
  website_url: string | null;
  public_contact_email: string | null;
  public_discord?: string | null;
  public_telegram?: string | null;
  content_type_tags: string[];
  stats: {
    campaigns_total: number;
    campaigns_running: number;
    campaigns_completed: number;
    clippers_count: number;
    streamers_count: number;
    total_views: number;
  };
  streamers: OrgPublicStreamer[];
  social_accounts: OrgPublicSocial[];
  hiring: OrgPublicHiring | null;
}

export async function getOrgPublicProfileBySlug(slug: string) {
  const response = await api.get<{ success: boolean; profile?: OrgPublicProfile; error?: string }>(`/orgs/${slug}`);
  return response.data;
}

export function getContentTypeLabel(value: string): string {
  return SPECIALTY_TAGS.find((t) => t.value === value)?.label || value;
}
