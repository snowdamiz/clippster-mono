export type SocialPlatformId = 'instagram' | 'twitter' | 'x' | 'tiktok' | 'youtube';

export interface SocialAccountWithToken {
  id: number;
  platform: SocialPlatformId | string;
  username?: string | null;
  display_name?: string | null;
  token_expires_at?: string | null;
  is_active?: boolean;
}

export interface ExpiredSocialConnection {
  id: number;
  platform: SocialPlatformId | string;
  platformLabel: string;
  username: string;
  displayName: string | null;
  tokenExpiresAt: string;
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

export function isSocialTokenExpired(tokenExpiresAt?: string | null): boolean {
  if (!tokenExpiresAt) return false;

  const expiresAt = new Date(tokenExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) return false;

  return expiresAt <= Date.now();
}

export function toExpiredSocialConnection(
  account: SocialAccountWithToken
): ExpiredSocialConnection | null {
  if (!account.is_active || !account.token_expires_at || !isSocialTokenExpired(account.token_expires_at)) {
    return null;
  }

  return {
    id: account.id,
    platform: account.platform,
    platformLabel: getSocialPlatformLabel(account.platform),
    username: account.username || account.display_name || `Account ${account.id}`,
    displayName: account.display_name || null,
    tokenExpiresAt: account.token_expires_at,
  };
}

export function getExpiredSocialConnections(
  accounts: SocialAccountWithToken[]
): ExpiredSocialConnection[] {
  return accounts
    .map(toExpiredSocialConnection)
    .filter((account): account is ExpiredSocialConnection => account !== null);
}
