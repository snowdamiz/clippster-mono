/**
 * Shared state shape, option lists and display helpers for the organization
 * campaign screens (list, create/edit dialog, manage dialog). Formatting only —
 * API calls stay in the components.
 */
import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
import type { CampaignContentVertical } from '@/services/campaignApi';

export interface CampaignFormState {
  title: string;
  description: string;
  cpm: number;
  cpm_views: number;
  budget: number;
  min_views_for_payment: number;
  max_views: number | null;
  join_type: 'open' | 'application_required';
  allowed_platforms: string[];
  payment_methods: string[];
  cover_image_url: string;
  starts_at: string;
  ends_at: string;
  // Payment model
  payment_model: 'cpm' | 'per_clip';
  per_clip_amount: number;
  clips_per_profile: number;
  // Creator and branding
  creator_profile_id: number | null;
  branding_profile_id: number | null;
  content_vertical: CampaignContentVertical | null;
  campaign_goal: string;
  content_style_tags: string[];
}

// Dropdown options
export const CPM_VIEWS_OPTIONS = [
  { label: '500 views', value: 500 },
  { label: '1,000 views', value: 1000 },
  { label: '5,000 views', value: 5000 },
  { label: '10,000 views', value: 10000 },
  { label: '100,000 views', value: 100000 },
];

export const JOIN_TYPE_OPTIONS = [
  { label: 'Open', value: 'open' },
  { label: 'Application required', value: 'application_required' },
];

export const formatCpm = (cpm: string | number) => {
  const value = typeof cpm === 'string' ? parseFloat(cpm) : cpm;
  return value.toFixed(2);
};

export const formatViews = (views: number) => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(0)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(0)}K`;
  return views.toString();
};

export const formatBudget = (budget: string | number) => {
  const value = typeof budget === 'string' ? parseFloat(budget) : budget;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
};

export const formatDate = (dateStr: string) => {
  return fmtDate(dateStr);
};

export const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
};

export const extractUsername = (url: string) => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    // Extract username from various URL patterns
    // x.com/username/status/123 -> username
    // instagram.com/p/ABC123 -> extract from path
    // tiktok.com/@username/video/123 -> username
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      // For X/Twitter: /username/status/id
      if (urlObj.hostname.includes('x.com') || urlObj.hostname.includes('twitter.com')) {
        return parts[0];
      }
      // For TikTok: /@username/video/id
      if (urlObj.hostname.includes('tiktok.com') && parts[0].startsWith('@')) {
        return parts[0].substring(1);
      }
      // For Instagram: /p/id or /reel/id - use hostname
      if (urlObj.hostname.includes('instagram.com')) {
        return 'instagram';
      }
      // For YouTube: various patterns
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        return 'youtube';
      }
      return parts[0];
    }
    return urlObj.hostname;
  } catch {
    // Fallback: truncate the URL
    return url.length > 20 ? url.substring(0, 20) + '...' : url;
  }
};
