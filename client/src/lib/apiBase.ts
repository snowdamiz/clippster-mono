/** Prefer 127.0.0.1 in DEV — on Windows, localhost → ::1 can hit a different
 *  process on :4000 (e.g. Docker) while Phoenix binds only to 127.0.0.1. */
const DEFAULT_DEV_API_ORIGIN = 'http://127.0.0.1:4000'
const DEFAULT_PROD_API_ORIGIN = 'https://clippster-server.fly.dev'

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function stripApiSuffix(value: string): string {
  const normalized = stripTrailingSlash(value)
  return normalized.toLowerCase().endsWith('/api')
    ? normalized.slice(0, -4)
    : normalized
}

const configuredApiUrl =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? DEFAULT_DEV_API_ORIGIN : DEFAULT_PROD_API_ORIGIN)

export const API_ORIGIN = stripApiSuffix(configuredApiUrl)
export const API_BASE = `${API_ORIGIN}/api`
