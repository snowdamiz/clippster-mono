import { startUserInstagramOAuth } from '@/services/userInstagramApi';
import { startUserTwitterOAuth } from '@/services/userTwitterApi';
import { startUserTiktokOAuth } from '@/services/userTiktokApi';
import { startUserYoutubeOAuth } from '@/services/userYoutubeApi';
import {
  startInstagramOAuthPopup,
  startTwitterOAuthPopup,
  startTiktokOAuthPopup,
  startYoutubeOAuthPopup,
} from '@/services/socialAccountsApi';
import {
  type OrgSocialConnectOptions,
  type UserSocialConnectOptions,
} from '@/services/userSocialConnect';
import { getSocialPlatformLabel } from '@/utils/socialTokenExpiry';

type OAuthResult = { success: boolean; error?: string };

function normalizePlatform(platform: string): string {
  return platform === 'x' ? 'twitter' : platform;
}

function normalizeOrgPlatform(platform: string): string {
  return platform === 'twitter' ? 'x' : platform;
}

/**
 * Re-authorize a personal social account via Post For Me OAuth.
 * No disconnect is required — the server upserts the existing connection.
 */
export async function reconnectPersonalSocialPlatform(
  platform: string,
  onResult?: (result: OAuthResult) => void,
  options?: UserSocialConnectOptions
): Promise<() => void> {
  const normalized = normalizePlatform(platform);

  const handler = (result: OAuthResult) => {
    onResult?.(result);
  };

  switch (normalized) {
    case 'instagram':
      return startUserInstagramOAuth(handler, options);
    case 'twitter':
      return startUserTwitterOAuth(handler, options);
    case 'tiktok':
      return startUserTiktokOAuth(handler, options);
    case 'youtube':
      return startUserYoutubeOAuth(handler, options);
    default:
      throw new Error(`Reconnect is not supported for ${getSocialPlatformLabel(platform)}`);
  }
}

/**
 * Re-authorize an organization social account via Post For Me OAuth.
 */
export async function reconnectOrgSocialPlatform(
  organizationId: string | number,
  platform: string,
  onResult?: (result: OAuthResult) => void,
  options?: OrgSocialConnectOptions
): Promise<() => void> {
  const normalized = normalizeOrgPlatform(platform);

  const handler = (result: OAuthResult) => {
    onResult?.(result);
  };

  switch (normalized) {
    case 'instagram':
      return startInstagramOAuthPopup(organizationId, handler, options);
    case 'x':
      return startTwitterOAuthPopup(organizationId, handler, options);
    case 'tiktok':
      return startTiktokOAuthPopup(organizationId, handler, options);
    case 'youtube':
      return startYoutubeOAuthPopup(organizationId, handler, options);
    default:
      throw new Error(`Reconnect is not supported for ${getSocialPlatformLabel(platform)}`);
  }
}
