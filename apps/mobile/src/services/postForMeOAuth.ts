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

export async function startPostForMeOAuth(platform: SocialPlatform): Promise<OAuthResult> {
  const connectResponse = await userSocialApi.getConnectUrl(platform);

  if (!connectResponse.success || !connectResponse.auth_url || !connectResponse.connection_id) {
    return {
      success: false,
      error: connectResponse.error ?? 'Failed to create auth URL',
    };
  }

  const redirectUrl = Linking.createURL('oauth-callback');
  const browserResult = await WebBrowser.openAuthSessionAsync(
    connectResponse.auth_url,
    redirectUrl,
  );

  if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
    return { success: false, error: 'OAuth cancelled' };
  }

  const status = await pollConnectStatus(connectResponse.connection_id);

  if (status.status !== 'synced') {
    return {
      success: false,
      error: status.error ?? 'Social account connection failed',
    };
  }

  const completeResponse = await userSocialApi.completeConnect(
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
    event_type: 'social_account_connected',
    metadata: { platform },
  });

  return { success: true };
}

async function pollConnectStatus(connectionId: string) {
  const startedAt = Date.now();

  while (true) {
    const status = await userSocialApi.getConnectStatus(connectionId);

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
