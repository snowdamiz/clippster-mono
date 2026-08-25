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

export function isSocialTokenExpired(tokenExpiresAt?: string | null): boolean {
  if (!tokenExpiresAt) return false
  const expiresAt = new Date(tokenExpiresAt).getTime()
  if (Number.isNaN(expiresAt)) return false
  return expiresAt <= Date.now()
}

/** Near access-token expiry is not actionable; reconnect only on expired/disconnected state. */
export function isTokenExpiringSoonForAccount(_account: SocialAccountTokenState): boolean {
  return false
}
