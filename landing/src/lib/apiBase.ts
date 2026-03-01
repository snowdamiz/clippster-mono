const DEFAULT_API_ORIGIN = 'https://clippster-server.fly.dev'

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function stripApiSuffix(value: string): string {
  const normalized = stripTrailingSlash(value)
  return normalized.toLowerCase().endsWith('/api')
    ? normalized.slice(0, -4)
    : normalized
}

const configuredApiUrl = import.meta.env.VITE_API_URL || DEFAULT_API_ORIGIN

export const API_ORIGIN = stripApiSuffix(configuredApiUrl)
export const API_BASE = `${API_ORIGIN}/api`
