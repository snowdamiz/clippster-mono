/**
 * Hiring API Service
 * Handles communication with the server for organization hiring posts and applications.
 */

import api from './api';

// ============================================
// Types
// ============================================

export interface HiringPostOrganization {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface HiringPost {
  id: number;
  organization_id: number;
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
  status: 'active' | 'paused' | 'closed';
  is_public: boolean;
  inserted_at: string;
  updated_at: string;
  organization?: HiringPostOrganization;
  has_applied?: boolean;
}

export interface HiringApplicationClipperProfile {
  id: number;
  user_id: number;
  display_name: string | null;
  avatar_url: string | null;
  slug: string | null;
  bio: string | null;
  is_verified: boolean;
  looking_for_work: boolean;
  experience_level: string | null;
  response_time_hours: number | null;
  specialty_tags: string[];
  content_style_tags: string[];
  preferred_platforms: string[];
  languages: string[];
  total_clips_delivered: number;
  total_endorsements: number;
  total_campaigns_completed: number;
}

export interface HiringApplication {
  id: number;
  hiring_post_id: number;
  user_id: number;
  message: string | null;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  reviewed_at: string | null;
  admin_notes: string | null;
  inserted_at: string;
  updated_at: string;
  user?: {
    id: number;
    name: string | null;
    email: string;
    avatar_url: string | null;
  };
  clipper_profile?: HiringApplicationClipperProfile;
  hiring_post?: HiringPost;
}

export interface HiringPostFilters {
  content_types?: string[];
  languages?: string[];
  platforms?: string[];
  payment_type?: string;
}

export interface HiringPostFormData {
  title: string;
  description?: string;
  content_types?: string[];
  languages?: string[];
  platforms?: string[];
  payment_type?: string;
  payment_details?: string;
  streamer_count?: number;
  clipper_slots?: number;
  experience_level?: string;
  status?: string;
  is_public?: boolean;
}

export const PAYMENT_TYPES = [
  { value: 'cpm', label: 'CPM (Cost Per Mille)' },
  { value: 'flat_rate', label: 'Flat Rate' },
  { value: 'revenue_share', label: 'Revenue Share' },
  { value: 'negotiable', label: 'Negotiable' },
];

export function getPaymentTypeLabel(value: string): string {
  return PAYMENT_TYPES.find((t) => t.value === value)?.label || value;
}

// ============================================
// Clipper-facing API
// ============================================

export async function listPublicHiringPosts(filters?: HiringPostFilters) {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.content_types?.length) filters.content_types.forEach((t) => params.append('content_types[]', t));
    if (filters.languages?.length) filters.languages.forEach((l) => params.append('languages[]', l));
    if (filters.platforms?.length) filters.platforms.forEach((p) => params.append('platforms[]', p));
    if (filters.payment_type) params.append('payment_type', filters.payment_type);
  }
  const qs = params.toString() ? `?${params.toString()}` : '';
  const response = await api.get(`/hiring-posts${qs}`);
  return response.data as { success: boolean; hiring_posts: HiringPost[]; error?: string };
}

export async function getHiringPost(id: number) {
  const response = await api.get(`/hiring-posts/${id}`);
  return response.data as { success: boolean; hiring_post: HiringPost; error?: string };
}

export async function applyToHiringPost(id: number, message: string) {
  const response = await api.post(`/hiring-posts/${id}/apply`, { message });
  return response.data as { success: boolean; application: HiringApplication; error?: string };
}

export async function listMyHiringApplications() {
  const response = await api.get('/user/hiring-applications');
  return response.data as { success: boolean; applications: HiringApplication[]; error?: string };
}

// ============================================
// Org-facing API
// ============================================

export async function getOrgHiringPost(orgId: number | string) {
  const response = await api.get(`/organizations/${orgId}/hiring-post`);
  return response.data as { success: boolean; hiring_post: HiringPost | null; error?: string };
}

export async function saveOrgHiringPost(orgId: number | string, data: HiringPostFormData) {
  const response = await api.post(`/organizations/${orgId}/hiring-post`, data);
  return response.data as { success: boolean; hiring_post: HiringPost; error?: string };
}

export async function deleteOrgHiringPost(orgId: number | string) {
  const response = await api.delete(`/organizations/${orgId}/hiring-post`);
  return response.data as { success: boolean; error?: string };
}

export async function listHiringApplications(orgId: number | string) {
  const response = await api.get(`/organizations/${orgId}/hiring-post/applications`);
  return response.data as { success: boolean; applications: HiringApplication[]; error?: string };
}

export async function acceptHiringApplication(orgId: number | string, appId: number) {
  const response = await api.post(`/organizations/${orgId}/hiring-post/applications/${appId}/accept`);
  return response.data as { success: boolean; application: HiringApplication; error?: string };
}

export async function rejectHiringApplication(orgId: number | string, appId: number, adminNotes?: string) {
  const response = await api.post(`/organizations/${orgId}/hiring-post/applications/${appId}/reject`, {
    admin_notes: adminNotes,
  });
  return response.data as { success: boolean; application: HiringApplication; error?: string };
}
