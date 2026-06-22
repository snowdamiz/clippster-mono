export type SocialPlatformId = 'instagram' | 'twitter' | 'x' | 'tiktok' | 'youtube';

/** Warn users this many days before a Post For Me token expires. */
export const SOCIAL_TOKEN_EXPIRING_SOON_DAYS = 2;

/** TikTok tokens expire frequently — warn sooner. */
export const SOCIAL_TOKEN_TIKTOK_EXPIRING_SOON_DAYS = 1;

export interface SocialAccountWithToken {
  id: number;
  platform: SocialPlatformId | string;
  username?: string | null;
  display_name?: string | null;
  token_expires_at?: string | null;
  is_active?: boolean;
  provider_status?: 'connected' | 'disconnected' | string | null;
}

export type SocialTokenAttentionStatus = 'expired' | 'expiring_soon' | 'disconnected';

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
    default:
      return platform.charAt(0).toUpperCase() + platform.slice(1);
  }
}

export function isSocialAccountDisconnected(account: SocialAccountWithToken): boolean {
  if (account.provider_status === 'disconnected') return true;
  return account.is_active === false;
}

export function getExpiringSoonDays(platform: string): number {
  return platform === 'tiktok' ? SOCIAL_TOKEN_TIKTOK_EXPIRING_SOON_DAYS : SOCIAL_TOKEN_EXPIRING_SOON_DAYS;
}

export function isSocialTokenExpired(tokenExpiresAt?: string | null): boolean {
  if (!tokenExpiresAt) return false;

  const expiresAt = new Date(tokenExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) return false;

  return expiresAt <= Date.now();
}

export function isSocialTokenExpiringSoon(
  tokenExpiresAt?: string | null,
  withinDays: number = SOCIAL_TOKEN_EXPIRING_SOON_DAYS
): boolean {
  if (!tokenExpiresAt || isSocialTokenExpired(tokenExpiresAt)) return false;

  const expiresAt = new Date(tokenExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) return false;

  const daysUntilExpiry = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);
  return daysUntilExpiry <= withinDays;
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

  if (!account.token_expires_at) return null;

  const expiringSoonDays = getExpiringSoonDays(account.platform);

  const status: SocialTokenAttentionStatus | null = isSocialTokenExpired(account.token_expires_at)
    ? 'expired'
    : isSocialTokenExpiringSoon(account.token_expires_at, expiringSoonDays)
      ? 'expiring_soon'
      : null;

  if (!status) return null;

  return {
    id: account.id,
    platform: account.platform,
    platformLabel: getSocialPlatformLabel(account.platform),
    username: account.username || account.display_name || `Account ${account.id}`,
    displayName: account.display_name || null,
    tokenExpiresAt: account.token_expires_at,
    status,
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

export function isTokenExpiringSoonForAccount(account: SocialAccountWithToken): boolean {
  if (isSocialAccountDisconnected(account)) return true;
  return isSocialTokenExpiringSoon(
    account.token_expires_at,
    getExpiringSoonDays(account.platform)
  );
}

export function isTokenExpiredForAccount(account: SocialAccountWithToken): boolean {
  if (isSocialAccountDisconnected(account)) return true;
  return isSocialTokenExpired(account.token_expires_at);
}
