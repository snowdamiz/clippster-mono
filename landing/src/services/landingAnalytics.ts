import { API_BASE } from '@/lib/apiBase'
import type { PlatformDownload } from '@/hooks/usePlatform'

export type LandingAnalyticsEvent =
  | 'landing_page_view'
  | 'landing_download_click'
  | 'landing_download_disabled_click'
  | 'landing_nav_click'
  | 'landing_cta_click'
  | 'landing_signup_click'
  | 'landing_pricing_click'
  | 'landing_external_link_click'

type MetadataValue = string | number | boolean | null | undefined
type AnalyticsMetadata = Record<string, MetadataValue>

const VISITOR_ID_KEY = 'clippster_landing_visitor_id'
const SESSION_ID_KEY = 'clippster_landing_session_id'
const ANALYTICS_URL = `${API_BASE}/analytics/public/track`
const PAGE_VIEW_DEDUPE_MS = 1_000

let lastPageViewKey = ''
let lastPageViewAt = 0

function createId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${prefix}_${randomId}`
}

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch {
    // Analytics must never block the landing page.
  }
}

function getOrCreateStoredId(storage: Storage, key: string, prefix: string): string {
  const existing = readStorage(storage, key)
  if (existing) return existing

  const next = createId(prefix)
  writeStorage(storage, key, next)
  return next
}

function safeUrlHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function safeReferrer(): AnalyticsMetadata {
  if (!document.referrer) return {}

  try {
    const referrer = new URL(document.referrer)
    return {
      referrer: `${referrer.origin}${referrer.pathname}`,
      referrer_host: referrer.host,
    }
  } catch {
    return {}
  }
}

function queryMetadata(): AnalyticsMetadata {
  const params = new URLSearchParams(window.location.search)
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref']

  return keys.reduce<AnalyticsMetadata>((acc, key) => {
    const value = params.get(key)
    if (value) acc[key] = value
    return acc
  }, {})
}

function viewportMetadata(): AnalyticsMetadata {
  return {
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    device_pixel_ratio: window.devicePixelRatio,
  }
}

function clientContext(): AnalyticsMetadata {
  return {
    visitor_id: getOrCreateStoredId(window.localStorage, VISITOR_ID_KEY, 'visitor'),
    session_id: getOrCreateStoredId(window.sessionStorage, SESSION_ID_KEY, 'session'),
    path: window.location.pathname,
    url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    page_title: document.title,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...safeReferrer(),
    ...queryMetadata(),
    ...viewportMetadata(),
  }
}

function sendAnalyticsEvent(eventType: LandingAnalyticsEvent, metadata: AnalyticsMetadata): void {
  const payload = JSON.stringify({
    event_type: eventType,
    metadata: {
      ...clientContext(),
      ...metadata,
    },
  })

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(ANALYTICS_URL, new Blob([payload], { type: 'application/json' }))
    if (sent) return
  }

  void fetch(ANALYTICS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Best-effort tracking only.
  })
}

export function trackLandingEvent(eventType: LandingAnalyticsEvent, metadata: AnalyticsMetadata = {}): void {
  sendAnalyticsEvent(eventType, metadata)
}

export function trackLandingPageView(metadata: AnalyticsMetadata = {}): void {
  const key = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const now = Date.now()

  if (key === lastPageViewKey && now - lastPageViewAt < PAGE_VIEW_DEDUPE_MS) {
    return
  }

  lastPageViewKey = key
  lastPageViewAt = now

  trackLandingEvent('landing_page_view', metadata)
}

export function downloadAnalyticsMetadata(
  download: PlatformDownload,
  source: string,
  buttonLabel?: string
): AnalyticsMetadata {
  const downloadPlatform = `${download.platform.os}-${download.platform.arch}`

  return {
    source,
    button_label: buttonLabel,
    detected_os: download.platform.os,
    detected_arch: download.platform.arch,
    download_platform: downloadPlatform,
    download_label: download.label,
    download_file_name: download.fileName,
    download_url_host: safeUrlHost(download.downloadUrl),
    release_version: download.releaseVersion,
    release_tag: download.releaseTag,
  }
}

export function trackDownloadClick(download: PlatformDownload, source: string, buttonLabel?: string): void {
  trackLandingEvent('landing_download_click', downloadAnalyticsMetadata(download, source, buttonLabel))
}

export function trackDisabledDownloadClick(source: string, buttonLabel = 'Coming Soon'): void {
  trackLandingEvent('landing_download_disabled_click', {
    source,
    button_label: buttonLabel,
  })
}
