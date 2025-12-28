import { useState, useEffect } from 'react'

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

// GitHub repository for releases (public repo for downloads)
const GITHUB_REPO = 'snowdamiz/clippster-releases'
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

// Asset filename patterns (without version - we match by suffix)
const ASSET_PATTERNS = {
  'mac-arm64': /_aarch64\.dmg$/,
  'mac-x64': /_x64\.dmg$/,
  'windows-x64': /_x64-setup\.exe$/,
} as const

interface GitHubAsset {
  name: string
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  assets: GitHubAsset[]
}

// Cache for GitHub release data
let releaseCache: GitHubRelease | null = null
let fetchPromise: Promise<GitHubRelease | null> | null = null

async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  if (releaseCache) return releaseCache
  
  if (fetchPromise) return fetchPromise
  
  fetchPromise = fetch(GITHUB_API_URL)
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch release')
      return res.json()
    })
    .then((data: GitHubRelease) => {
      releaseCache = data
      return data
    })
    .catch(() => null)
  
  return fetchPromise
}

function getAssetKey(os: OS, arch: Architecture): keyof typeof ASSET_PATTERNS | null {
  if (os === 'mac') {
    return arch === 'arm64' ? 'mac-arm64' : 'mac-x64'
  }
  if (os === 'windows') {
    return 'windows-x64'
  }
  return null
}

function findAssetUrl(release: GitHubRelease | null, os: OS, arch: Architecture): { url: string; fileName: string } {
  const assetKey = getAssetKey(os, arch)
  
  if (release && assetKey) {
    const pattern = ASSET_PATTERNS[assetKey]
    const asset = release.assets.find(a => pattern.test(a.name))
    if (asset) {
      return { url: asset.browser_download_url, fileName: asset.name }
    }
  }
  
  // Fallback to releases page
  return { url: GITHUB_RELEASES_URL, fileName: '' }
}

function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'unknown'
  
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = (navigator.platform || '').toLowerCase()
  
  // Check platform first (more reliable)
  if (platform.includes('mac') || platform.includes('darwin')) {
    return 'mac'
  }
  if (platform.includes('win')) {
    return 'windows'
  }
  if (platform.includes('linux')) {
    return 'linux'
  }
  
  // Fallback to user agent
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
  
  // Try modern API first (Chrome 90+, Edge 90+)
  // @ts-expect-error - userAgentData is not in all TypeScript definitions yet
  const uaData = navigator.userAgentData
  if (uaData?.platform) {
    // Can get high entropy values for more accurate detection
    // But for now, use basic heuristics
  }
  
  // Check for Apple Silicon (M1/M2/M3)
  // Safari on Apple Silicon includes "ARM64" or the UA doesn't include "Intel"
  // Chrome/Firefox on Apple Silicon may run in Rosetta, but newer versions indicate ARM
  if (userAgent.includes('arm64') || userAgent.includes('aarch64')) {
    return 'arm64'
  }
  
  // macOS specific: Check if NOT Intel (newer Macs without Intel mention are likely ARM)
  const platform = (navigator.platform || '').toLowerCase()
  if (platform.includes('mac')) {
    // Safari on Apple Silicon will have "MacIntel" for platform but we can check other signals
    // If running on macOS and user agent doesn't explicitly say Intel, check for ARM hints
    if (userAgent.includes('applewebkit') && !userAgent.includes('intel')) {
      // This is tricky - modern Safari doesn't always indicate architecture clearly
      // We'll use a heuristic: check screen/GPU hints or default to arm64 for newer detection
    }
    
    // Try to detect via GPU (Apple GPU = Apple Silicon)
    // This is a best-effort detection
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
        if (debugInfo) {
          const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          if (renderer && typeof renderer === 'string') {
            const rendererLower = renderer.toLowerCase()
            // Apple GPU indicates Apple Silicon
            if (rendererLower.includes('apple m') || rendererLower.includes('apple gpu')) {
              return 'arm64'
            }
            // Intel GPU indicates Intel Mac
            if (rendererLower.includes('intel')) {
              return 'x64'
            }
          }
        }
      }
    } catch {
      // WebGL detection failed, continue with other methods
    }
  }
  
  // Windows ARM detection
  if (platform.includes('win') || userAgent.includes('windows')) {
    if (userAgent.includes('arm64') || userAgent.includes('arm')) {
      return 'arm64'
    }
    // Most Windows machines are x64
    return 'x64'
  }
  
  // Default to x64 for unknown (most common)
  return 'x64'
}

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>({ os: 'unknown', arch: 'unknown' })

  useEffect(() => {
    setPlatform({
      os: detectOS(),
      arch: detectArchitecture()
    })
  }, [])

  return platform
}

export function getDownloadLabel(os: OS, arch: Architecture): string {
  if (os === 'mac') {
    return arch === 'arm64' ? 'Mac (Apple Silicon)' : 'Mac (Intel)'
  }
  if (os === 'windows') {
    return 'Windows'
  }
  return 'Download'
}

// All supported platforms
const ALL_PLATFORMS: Array<{ os: OS; arch: Architecture }> = [
  { os: 'mac', arch: 'arm64' },
  { os: 'mac', arch: 'x64' },
  { os: 'windows', arch: 'x64' },
]

export interface DownloadsState {
  platform: Platform
  downloads: PlatformDownload[]
  primaryDownload: PlatformDownload | null
  otherDownloads: PlatformDownload[]
  isLoading: boolean
}

export function useDownloads(): DownloadsState {
  const platform = usePlatform()
  const [downloads, setDownloads] = useState<PlatformDownload[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchLatestRelease().then(release => {
      const allDownloads = ALL_PLATFORMS.map(({ os, arch }) => {
        const { url, fileName } = findAssetUrl(release, os, arch)
        return {
          platform: { os, arch },
          downloadUrl: url,
          fileName,
          label: getDownloadLabel(os, arch)
        }
      })
      setDownloads(allDownloads)
      setIsLoading(false)
    })
  }, [])

  const primaryDownload = downloads.find(
    d => d.platform.os === platform.os && d.platform.arch === platform.arch
  ) || downloads.find(d => d.platform.os === platform.os) || downloads[0] || null

  const otherDownloads = downloads.filter(d => d !== primaryDownload)

  return {
    platform,
    downloads,
    primaryDownload,
    otherDownloads,
    isLoading
  }
}

