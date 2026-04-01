import { api } from '@/lib/api'

export interface ClipperProfile {
  id: number
  user_id: number
  display_name: string | null
  avatar_url: string | null
  slug: string | null
  bio: string | null
  is_public?: boolean
  is_verified: boolean
  looking_for_work: boolean
  experience_level: string | null
  response_time_hours: number | null
  specialty_tags: string[]
  content_style_tags: string[]
  preferred_platforms: string[]
  languages: string[]
  total_clips_delivered: number
  total_endorsements: number
  total_campaigns_completed: number
  portfolio_clips?: { id: number; thumbnail_url: string | null; title?: string; video_url?: string }[]
  timezone?: string | null
  is_affiliate?: boolean
  total_views?: number
  endorsements?: Array<{
    id: number
    content: string | null
    rating: number | null
    organization?: { id: number; name: string } | null
    endorsed_by?: { id: number; name: string } | null
  }>
  social_accounts?: Array<{
    platform: string
    username: string
    profile_url: string | null
    profile_image_url: string | null
    is_verified: boolean
  }>
}

export interface LeaderboardEntry {
  id: number
  rank: number
  clips_delivered: number
  total_views: number
  clipper_profile?: {
    id: number
    user_id: number
    display_name: string | null
    avatar_url: string | null
    slug: string | null
    is_verified: boolean
  }
}

export interface DirectoryFilters {
  looking_for_work?: boolean
  verified_only?: boolean
  experience_level?: string
  specialty_tags?: string[]
  content_style_tags?: string[]
  preferred_platforms?: string[]
  languages?: string[]
}

function isDirectoryVisibleProfile(profile: ClipperProfile): boolean {
  const displayName = profile.display_name?.trim()
  const slug = profile.slug?.trim()
  const isPublic = profile.is_public ?? true
  return isPublic && Boolean(displayName) && Boolean(slug)
}

export const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'experienced', label: 'Experienced' },
  { value: 'professional', label: 'Professional' },
]

export const SPECIALTY_TAGS = [
  { value: 'gaming', label: 'Gaming' },
  { value: 'irl', label: 'IRL' },
  { value: 'just-chatting', label: 'Just Chatting' },
  { value: 'esports', label: 'Esports' },
  { value: 'music', label: 'Music' },
  { value: 'sports', label: 'Sports' },
  { value: 'news', label: 'News' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'educational', label: 'Educational' },
  { value: 'asmr', label: 'ASMR' },
  { value: 'creative', label: 'Creative' },
  { value: 'podcasts', label: 'Podcasts' },
]

export const CONTENT_STYLE_TAGS = [
  { value: 'meme', label: 'Meme' },
  { value: 'clean', label: 'Clean' },
  { value: 'effects', label: 'Effects' },
  { value: 'subtitles', label: 'Subtitles' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'highlights', label: 'Highlights' },
  { value: 'reactions', label: 'Reactions' },
  { value: 'compilations', label: 'Compilations' },
  { value: 'dramatic', label: 'Dramatic' },
]

export const PREFERRED_PLATFORMS = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'snapchat', label: 'Snapchat' },
]

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'it', name: 'Italian' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'th', name: 'Thai' },
  { code: 'id', name: 'Indonesian' },
]

export async function listClippers(filters?: DirectoryFilters) {
  const params = new URLSearchParams()
  if (filters) {
    if (filters.looking_for_work) params.append('looking_for_work', 'true')
    if (filters.verified_only) params.append('verified_only', 'true')
    if (filters.experience_level && filters.experience_level !== 'any') params.append('experience_level', filters.experience_level)
    if (filters.specialty_tags?.length) filters.specialty_tags.forEach(t => params.append('specialty_tags[]', t))
    if (filters.content_style_tags?.length) filters.content_style_tags.forEach(t => params.append('content_style_tags[]', t))
    if (filters.preferred_platforms?.length) filters.preferred_platforms.forEach(p => params.append('preferred_platforms[]', p))
    if (filters.languages?.length) filters.languages.forEach(l => params.append('languages[]', l))
  }
  const qs = params.toString() ? `?${params.toString()}` : ''
  const response = await api.get<{ success: boolean; profiles: ClipperProfile[]; error?: string }>(`/clipper-profiles${qs}`)
  if (!response.success) return response
  return {
    ...response,
    profiles: (response.profiles || []).filter(isDirectoryVisibleProfile),
  }
}

export async function getClipperBySlug(slug: string) {
  return api.get<{ success: boolean; profile: ClipperProfile; error?: string }>(`/clippers/${slug}`)
}

export async function getLeaderboard(period: 'weekly' | 'monthly' = 'weekly') {
  return api.get<{ success: boolean; entries: LeaderboardEntry[]; error?: string }>(`/clipper-profiles/leaderboard?period=${period}`)
}

export function getExperienceLevelLabel(value: string): string {
  return EXPERIENCE_LEVELS.find(l => l.value === value)?.label || value
}

export function getSpecialtyTagLabel(value: string): string {
  return SPECIALTY_TAGS.find(t => t.value === value)?.label || value
}

export function getLanguageName(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.name || code
}

export function getLanguageFlag(code: string): string {
  const flags: Record<string, string> = {
    en: '\u{1F1FA}\u{1F1F8}', es: '\u{1F1EA}\u{1F1F8}', pt: '\u{1F1E7}\u{1F1F7}', fr: '\u{1F1EB}\u{1F1F7}',
    de: '\u{1F1E9}\u{1F1EA}', ja: '\u{1F1EF}\u{1F1F5}', ko: '\u{1F1F0}\u{1F1F7}', zh: '\u{1F1E8}\u{1F1F3}',
    ru: '\u{1F1F7}\u{1F1FA}', ar: '\u{1F1F8}\u{1F1E6}', hi: '\u{1F1EE}\u{1F1F3}', it: '\u{1F1EE}\u{1F1F9}',
    pl: '\u{1F1F5}\u{1F1F1}', tr: '\u{1F1F9}\u{1F1F7}', vi: '\u{1F1FB}\u{1F1F3}', th: '\u{1F1F9}\u{1F1ED}',
    id: '\u{1F1EE}\u{1F1E9}',
  }
  return flags[code] || code.toUpperCase()
}

export function formatResponseTime(hours: number | null): string {
  if (hours === null || hours === undefined) return ''
  if (hours < 1) return '< 1h'
  if (hours < 24) return `~${hours}h`
  const days = Math.round(hours / 24)
  return days === 1 ? '~1 day' : `~${days} days`
}

export function formatViews(views: number): string {
  if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M'
  if (views >= 1000) return (views / 1000).toFixed(1) + 'K'
  return views.toString()
}
