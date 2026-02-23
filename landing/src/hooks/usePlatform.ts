import { useState, useEffect, useMemo } from 'react'

export type OS = 'mac' | 'windows' | 'linux' | 'unknown'
export type Architecture = 'arm64' | 'x64' | 'unknown'

export interface Platform {
  os: OS
  arch: Architecture
}

export interface PlatformDownload {
  platform: Platform
  downloadUrl: string
  fileName: string
  label: string
}

// Backend API endpoint for release info (cached server-side)
const API_URL = `${import.meta.env.VITE_API_URL || 'https://clippster-server.fly.dev'}/api/releases/latest`
const GITHUB_RELEASES_URL = 'https://github.com/snowdamiz/clippster-releases/releases/latest'

// Platform configurations
const PLATFORM_CONFIG: Record<string, { os: OS; arch: Architecture }> = {
  'mac-arm64': { os: 'mac', arch: 'arm64' },
  'mac-x64': { os: 'mac', arch: 'x64' },
  'windows-x64': { os: 'windows', arch: 'x64' },
}

interface ReleaseDownload {
  platform: string
  label: string
  filename: string
  download_url: string
}

interface ReleaseResponse {
  version: string
  tag: string
  downloads: ReleaseDownload[]
}

// Cache for release data
let releaseCache: ReleaseResponse | null = null
let fetchPromise: Promise<ReleaseResponse | null> | null = null

async function fetchRelease(): Promise<ReleaseResponse | null> {
  if (releaseCache) return releaseCache
  if (fetchPromise) return fetchPromise

  fetchPromise = fetch(API_URL)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
    .then((data: ReleaseResponse) => {
      releaseCache = data
      return data
    })
    .catch(() => null)

  return fetchPromise
}

function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'unknown'

  const userAgent = navigator.userAgent.toLowerCase()
  const platform = (navigator.platform || '').toLowerCase()

  if (platform.includes('mac') || platform.includes('darwin')) {
    return 'mac'
  }
  if (platform.includes('win')) {
    return 'windows'
  }
  if (platform.includes('linux')) {
    return 'linux'
  }

  if (userAgent.includes('mac os') || userAgent.includes('macos')) {
    return 'mac'
  }
  if (userAgent.includes('windows')) {
    return 'windows'
  }
  if (userAgent.includes('linux')) {
    return 'linux'
  }

  return 'unknown'
}

function detectArchitecture(): Architecture {
  if (typeof navigator === 'undefined') return 'unknown'

  const userAgent = navigator.userAgent.toLowerCase()

  if (userAgent.includes('arm64') || userAgent.includes('aarch64')) {
    return 'arm64'
  }

  const platform = (navigator.platform || '').toLowerCase()
  if (platform.includes('mac')) {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
        if (debugInfo) {
          const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          if (renderer && typeof renderer === 'string') {
            const rendererLower = renderer.toLowerCase()
            if (rendererLower.includes('apple m') || rendererLower.includes('apple gpu')) {
              return 'arm64'
            }
            if (rendererLower.includes('intel')) {
              return 'x64'
            }
          }
        }
      }
    } catch {
      // WebGL detection failed
    }
  }

  if (platform.includes('win') || userAgent.includes('windows')) {
    if (userAgent.includes('arm64') || userAgent.includes('arm')) {
      return 'arm64'
    }
    return 'x64'
  }

  return 'x64'
}

export function usePlatform(): Platform {
  // Use useMemo to compute platform once on mount instead of useEffect + setState
  const platform = useMemo<Platform>(() => ({
    os: detectOS(),
    arch: detectArchitecture()
  }), [])

  return platform
}

export function getDownloadLabel(): string {
  return 'Download'
}

export interface DownloadsState {
  platform: Platform
  downloads: PlatformDownload[]
  primaryDownload: PlatformDownload | null
  otherDownloads: PlatformDownload[]
  isLoading: boolean
}

function buildFallbackDownloads(): PlatformDownload[] {
  return [
    {
      platform: { os: 'mac', arch: 'arm64' },
      downloadUrl: GITHUB_RELEASES_URL,
      fileName: '',
      label: 'Mac (Apple Silicon)',
    },
    {
      platform: { os: 'mac', arch: 'x64' },
      downloadUrl: GITHUB_RELEASES_URL,
      fileName: '',
      label: 'Mac (Intel)',
    },
    {
      platform: { os: 'windows', arch: 'x64' },
      downloadUrl: GITHUB_RELEASES_URL,
      fileName: '',
      label: 'Windows',
    },
  ]
}

function buildDownloads(release: ReleaseResponse): PlatformDownload[] {
  return release.downloads.map(d => {
    const config = PLATFORM_CONFIG[d.platform] || { os: 'unknown' as OS, arch: 'unknown' as Architecture }
    return {
      platform: config,
      downloadUrl: d.download_url,
      fileName: d.filename,
      label: d.label,
    }
  })
}

export function useDownloads(): DownloadsState {
  const platform = usePlatform()
  const [release, setRelease] = useState<ReleaseResponse | null>(releaseCache)
  const [isLoading, setIsLoading] = useState(!releaseCache)

  useEffect(() => {
    if (!releaseCache) {
      fetchRelease().then(data => {
        setRelease(data)
        setIsLoading(false)
      })
    }
  }, [])

  const downloads = useMemo(() => {
    return release ? buildDownloads(release) : buildFallbackDownloads()
  }, [release])

  const primaryDownload = downloads.find(
    d => d.platform.os === platform.os && d.platform.arch === platform.arch
  ) || downloads.find(d => d.platform.os === platform.os) || downloads[0] || null

  const otherDownloads = downloads.filter(d => d !== primaryDownload)

  return {
    platform,
    downloads,
    primaryDownload,
    otherDownloads,
    isLoading,
  }
}
