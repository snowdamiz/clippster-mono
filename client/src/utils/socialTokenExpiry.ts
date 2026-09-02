export type SocialPlatformId = 'instagram' | 'twitter' | 'x' | 'tiktok' | 'youtube';

export interface SocialAccountWithToken {
  id: number;
  platform: SocialPlatformId | string;
  username?: string | null;
  display_name?: string | null;
  token_expires_at?: string | null;
  is_active?: boolean;
  provider_status?: 'connected' | 'disconnected' | string | null;
}

export type SocialTokenAttentionStatus = 'expired' | 'disconnected';

export interface SocialTokenAttention {
  id: number;
  platform: SocialPlatformId | string;
  platformLabel: string;
  username: string;
  displayName: string | null;
  tokenExpiresAt: string | null;
  status: SocialTokenAttentionStatus;
}

export function getSocialPlatformLabel(platform: string): string {
  switch (platform) {
    case 'instagram':
      return 'Instagram';
    case 'x':
    case 'twitter':
      return 'X (Twitter)';
    case 'tiktok':
      return 'TikTok';
    case 'youtube':
      return 'YouTube';
    case 'tokend':
      return 'Tokend';
    default:
      return platform.charAt(0).toUpperCase() + platform.slice(1);
  }
}

export function isSocialAccountDisconnected(account: SocialAccountWithToken): boolean {
  if (account.provider_status === 'disconnected') return true;
  return account.is_active === false;
}

export function isSocialTokenExpired(tokenExpiresAt?: string | null): boolean {
  if (!tokenExpiresAt) return false;

  const expiresAt = new Date(tokenExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) return false;

  return expiresAt <= Date.now();
}

export function toSocialTokenAttention(
  account: SocialAccountWithToken
): SocialTokenAttention | null {
  if (isSocialAccountDisconnected(account)) {
    return {
      id: account.id,
      platform: account.platform,
      platformLabel: getSocialPlatformLabel(account.platform),
      username: account.username || account.display_name || `Account ${account.id}`,
      displayName: account.display_name || null,
      tokenExpiresAt: account.token_expires_at || null,
      status: 'disconnected',
    };
  }

  if (!account.token_expires_at || !isSocialTokenExpired(account.token_expires_at)) {
    return null;
  }

  return {
    id: account.id,
    platform: account.platform,
    platformLabel: getSocialPlatformLabel(account.platform),
    username: account.username || account.display_name || `Account ${account.id}`,
    displayName: account.display_name || null,
    tokenExpiresAt: account.token_expires_at,
    status: 'expired',
  };
}

export function getSocialTokenAttentionList(
  accounts: SocialAccountWithToken[]
): SocialTokenAttention[] {
  return accounts
    .map(toSocialTokenAttention)
    .filter((account): account is SocialTokenAttention => account !== null);
}

/** @deprecated Use getSocialTokenAttentionList with status === 'expired' */
export interface ExpiredSocialConnection {
  id: number;
  platform: SocialPlatformId | string;
  platformLabel: string;
  username: string;
  displayName: string | null;
  tokenExpiresAt: string;
}

export function getExpiredSocialConnections(
  accounts: SocialAccountWithToken[]
): ExpiredSocialConnection[] {
  return getSocialTokenAttentionList(accounts)
    .filter((a) => a.status === 'expired' || a.status === 'disconnected')
    .map(({ status: _status, tokenExpiresAt, ...connection }) => ({
      ...connection,
      tokenExpiresAt: tokenExpiresAt || new Date(0).toISOString(),
    }));
}

export function isSocialTokenAttentionUrgent(account: SocialTokenAttention): boolean {
  return account.status === 'expired' || account.status === 'disconnected';
}

/** Near access-token expiry is not actionable; reconnect only on expired/disconnected state. */
export function isTokenExpiringSoonForAccount(_account: SocialAccountWithToken): boolean {
  return false;
}

export function isTokenExpiredForAccount(account: SocialAccountWithToken): boolean {
  if (isSocialAccountDisconnected(account)) return true;
  return isSocialTokenExpired(account.token_expires_at);
}
