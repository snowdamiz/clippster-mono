import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { SocialPlatform } from '@clippster/api-client';
import {
  POST_FOR_ME_STATUS_POLL_INTERVAL_MS,
  POST_FOR_ME_STATUS_TIMEOUT_MS,
} from '@clippster/api-client';
import { userSocialApi, analyticsApi } from './api';

export interface OAuthResult {
  success: boolean;
  error?: string;
}

export async function startPostForMeOrgOAuth(
  organizationId: number,
  platform: SocialPlatform,
): Promise<OAuthResult> {
  const redirectUrl = Linking.createURL('oauth-callback');
  const connectResponse = await userSocialApi.getOrgConnectUrl(organizationId, platform, {
    return_mode: 'mobile',
    return_url: redirectUrl,
  });

  if (!connectResponse.success || !connectResponse.auth_url || !connectResponse.connection_id) {
    return {
      success: false,
      error: connectResponse.error ?? 'Failed to create auth URL',
    };
  }

  await WebBrowser.openAuthSessionAsync(connectResponse.auth_url, redirectUrl);

  const status = await pollOrgConnectStatus(organizationId, connectResponse.connection_id);

  if (status.status !== 'synced') {
    return {
      success: false,
      error: status.error ?? 'Social account connection failed',
    };
  }

  const completeResponse = await userSocialApi.completeOrgConnect(
    organizationId,
    connectResponse.connection_id,
    platform,
  );

  if (!completeResponse.success) {
    return {
      success: false,
      error: completeResponse.error ?? 'Failed to finalize connection',
    };
  }

  void analyticsApi.trackEvent({
    event_type: 'org_social_account_connected',
    metadata: { platform, organization_id: organizationId },
  });

  return { success: true };
}

async function pollOrgConnectStatus(organizationId: number, connectionId: string) {
  const startedAt = Date.now();

  while (true) {
    const status = await userSocialApi.getOrgConnectStatus(organizationId, connectionId);

    if (!status.success) {
      throw new Error(status.error ?? 'Failed to fetch connection status');
    }

    if (status.status === 'synced' || status.status === 'failed' || status.status === 'expired') {
      return status;
    }

    if (Date.now() - startedAt > POST_FOR_ME_STATUS_TIMEOUT_MS) {
      throw new Error('Timed out waiting for account connection');
    }

    await new Promise((resolve) => setTimeout(resolve, POST_FOR_ME_STATUS_POLL_INTERVAL_MS));
  }
}
