export const SOCIAL_TOKEN_EXPIRING_SOON_DAYS = 2
export const SOCIAL_TOKEN_TIKTOK_EXPIRING_SOON_DAYS = 1

export interface SocialAccountTokenState {
  token_expires_at?: string | null
  is_active?: boolean
  platform?: string
  provider_status?: string | null
}

export function isSocialAccountDisconnected(account: SocialAccountTokenState): boolean {
  if (account.provider_status === 'disconnected') return true
  return account.is_active === false
}

export function getExpiringSoonDays(platform?: string): number {
  return platform === 'tiktok' ? SOCIAL_TOKEN_TIKTOK_EXPIRING_SOON_DAYS : SOCIAL_TOKEN_EXPIRING_SOON_DAYS
}

export function isSocialTokenExpired(tokenExpiresAt?: string | null): boolean {
  if (!tokenExpiresAt) return false
  const expiresAt = new Date(tokenExpiresAt).getTime()
  if (Number.isNaN(expiresAt)) return false
  return expiresAt <= Date.now()
}

export function isSocialTokenExpiringSoon(
  tokenExpiresAt?: string | null,
  withinDays: number = SOCIAL_TOKEN_EXPIRING_SOON_DAYS
): boolean {
  if (!tokenExpiresAt || isSocialTokenExpired(tokenExpiresAt)) return false
  const expiresAt = new Date(tokenExpiresAt).getTime()
  if (Number.isNaN(expiresAt)) return false
  const daysUntilExpiry = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24)
  return daysUntilExpiry <= withinDays
}

export function isTokenExpiringSoonForAccount(account: SocialAccountTokenState): boolean {
  if (isSocialAccountDisconnected(account)) return true
  return isSocialTokenExpiringSoon(
    account.token_expires_at,
    getExpiringSoonDays(account.platform)
  )
}
