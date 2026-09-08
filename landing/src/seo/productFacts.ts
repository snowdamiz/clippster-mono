/**
 * Verified product facts for SEO/GEO copy.
 * Source of truth for platform ingest, publish targets, and feature claims.
 * Do not invent capabilities here — update only when code ships.
 */

export const PUBLISH_PLATFORMS = ['instagram', 'tiktok', 'x', 'youtube'] as const
export type PublishPlatform = (typeof PUBLISH_PLATFORMS)[number]

/** Verified caption / transcription language count in the desktop editor UI. */
export const CAPTION_LANGUAGES_VERIFIED = 9

export type IngestPlatformId = 'twitch' | 'kick' | 'youtube' | 'pumpfun' | 'x' | 'rumble'

export type PlatformFacts = {
  id: IngestPlatformId
  label: string
  /** Watch / record a live stream in the desktop app */
  liveWatch: boolean
  /** Download VODs / replays on desktop */
  vodDownload: boolean
  /** Available as an ingest source on desktop */
  desktop: boolean
  /** VOD download / import on the mobile companion */
  mobileVod: boolean
  /**
   * Destinations you can publish or schedule to from Clippster.
   * Empty = source-only (not a PostForMe publish target).
   */
  publish: readonly PublishPlatform[]
  publishVia: 'postforme' | 'none'
  notes: string
}

export const PLATFORMS: Record<IngestPlatformId, PlatformFacts> = {
  twitch: {
    id: 'twitch',
    label: 'Twitch',
    liveWatch: true,
    vodDownload: true,
    desktop: true,
    mobileVod: true,
    publish: [],
    publishVia: 'none',
    notes: 'Source only — clip live or from VODs; export/schedule to short-form publishers.',
  },
  kick: {
    id: 'kick',
    label: 'Kick',
    liveWatch: true,
    vodDownload: true,
    desktop: true,
    mobileVod: true,
    publish: [],
    publishVia: 'none',
    notes: 'Source only — same ingest workflow as Twitch; not a publish destination.',
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    liveWatch: true,
    vodDownload: true,
    desktop: true,
    mobileVod: true,
    publish: [...PUBLISH_PLATFORMS],
    publishVia: 'postforme',
    notes: 'Full loop: ingest live/VOD and publish Shorts (and other PostForMe targets).',
  },
  pumpfun: {
    id: 'pumpfun',
    label: 'Pump.fun',
    liveWatch: true,
    vodDownload: true,
    desktop: true,
    mobileVod: false,
    publish: [],
    publishVia: 'none',
    notes: 'Desktop-only ingest via LiveKit path; no mobile VOD and not a publish target.',
  },
  x: {
    id: 'x',
    label: 'X',
    liveWatch: true,
    vodDownload: true,
    desktop: true,
    mobileVod: true,
    publish: [...PUBLISH_PLATFORMS],
    publishVia: 'postforme',
    notes: 'Live watch and VOD/broadcast download on desktop; publish/schedule via PostForMe.',
  },
  rumble: {
    id: 'rumble',
    label: 'Rumble',
    liveWatch: true,
    vodDownload: true,
    desktop: true,
    mobileVod: true,
    publish: [],
    publishVia: 'none',
    notes: 'Source only — live watch and VOD download on desktop; VOD on mobile; not a publish destination.',
  },
}

export const FEATURES = {
  liveClippingDesktop: true,
  pipMode: true,
  dvr: true,
  timelineEditor: true,
  campaigns: true,
  orgTools: true,
  designStudioBeta: true,
  mobileCompanion: true,
} as const

/** Caveats that marketing and SEO copy must not contradict. */
export const HONEST_LIMITATIONS = [
  `Auto-captions are verified for ${CAPTION_LANGUAGES_VERIFIED} languages — do not inflate the count.`,
  'Kick, Twitch, Rumble, and Pump.fun are clip sources only — not native publish destinations.',
  'Real-time live clipping, PiP, and DVR are desktop features; mobile is a companion for VOD, edit, and posting.',
  'Pump.fun ingest is desktop-only (no mobile VOD path).',
  'Design Studio (thumbnails / stream graphics) is desktop beta — not a general image editor claim.',
  'AI highlight detection and social scheduling are plan-gated (not on Free/Basic for detection; posting requires a paid plan).',
  'No verified “95% accuracy” or similar model-performance claims in product metrics.',
  'Post performance analytics cover PostForMe-connected posts and campaign submissions — not a full cross-platform analytics suite.',
] as const

/** Desktop live-watch ingest platforms (Kick, Twitch, X, YouTube, Rumble, Pump.fun). */
export function liveWatchPlatformIds(): IngestPlatformId[] {
  return (Object.keys(PLATFORMS) as IngestPlatformId[]).filter((id) => PLATFORMS[id].liveWatch)
}

export function liveWatchPlatformsLabel(): string {
  return liveWatchPlatformIds()
    .map((id) => PLATFORMS[id].label)
    .join(', ')
}

export function getPlatform(id: IngestPlatformId): PlatformFacts {
  return PLATFORMS[id]
}

export function isPublishPlatform(value: string): value is PublishPlatform {
  return (PUBLISH_PLATFORMS as readonly string[]).includes(value)
}

export function publishTargetsLabel(platforms: readonly PublishPlatform[] = PUBLISH_PLATFORMS): string {
  const labels: Record<PublishPlatform, string> = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    x: 'X',
    youtube: 'YouTube',
  }
  return platforms.map((p) => labels[p]).join(', ')
}
