import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  POST_FOR_ME_STATUS_POLL_INTERVAL_MS,
  POST_FOR_ME_STATUS_TIMEOUT_MS,
} from '@clippster/api-client';
import { analyticsApi, tokendApi } from './api';
import {
  fetchTokendMode,
  getTokendConnectStrategy,
  getTokendConnectUnavailableMessage,
} from './tokend';

export interface TokendOAuthResult {
  success: boolean;
  error?: string;
  message?: string;
}

export async function startTokendConnect(): Promise<TokendOAuthResult> {
  const modeInfo = await fetchTokendMode();
  const strategy = getTokendConnectStrategy(modeInfo);

  if (strategy === 'unavailable') {
    return { success: false, error: getTokendConnectUnavailableMessage(modeInfo) };
  }

  if (strategy === 'mock') {
    const response = await tokendApi.mockConnect();
    if (!response.success) {
      return {
        success: false,
        error: response.message ?? response.error ?? 'Failed to connect Tokend',
      };
    }
    void analyticsApi.trackEvent({
      event_type: 'social_account_connected',
      metadata: { platform: 'tokend', strategy: 'mock' },
    });
    return { success: true };
  }

  const redirectUrl = Linking.createURL('oauth-callback');
  const connectResponse = await tokendApi.getConnectUrl({
    return_mode: 'mobile',
    return_url: redirectUrl,
  });

  if (!connectResponse.success || !connectResponse.auth_url || !connectResponse.connection_id) {
    return {
      success: false,
      error:
        connectResponse.message ??
        connectResponse.error ??
        'Failed to create Tokend OAuth URL',
    };
  }

  await WebBrowser.openAuthSessionAsync(connectResponse.auth_url, redirectUrl);

  const status = await pollConnectStatus(connectResponse.connection_id);
  if (status.status !== 'synced') {
    return {
      success: false,
      error: status.error ?? status.error_message ?? 'Tokend connection failed',
    };
  }

  void analyticsApi.trackEvent({
    event_type: 'social_account_connected',
    metadata: { platform: 'tokend', strategy: 'oauth' },
  });

  return { success: true };
}

export async function startTokendOrgConnect(organizationId: number): Promise<TokendOAuthResult> {
  const modeInfo = await fetchTokendMode();
  const strategy = getTokendConnectStrategy(modeInfo);

  if (strategy === 'unavailable') {
    return { success: false, error: getTokendConnectUnavailableMessage(modeInfo) };
  }

  if (strategy === 'mock') {
    const response = await tokendApi.mockOrgConnect(organizationId);
    if (!response.success) {
      return {
        success: false,
        error: response.message ?? response.error ?? 'Failed to connect org Tokend',
      };
    }
    return { success: true };
  }

  const redirectUrl = Linking.createURL('oauth-callback');
  const connectResponse = await tokendApi.getOrgConnectUrl(organizationId, {
    return_mode: 'mobile',
    return_url: redirectUrl,
  });

  if (!connectResponse.success || !connectResponse.auth_url || !connectResponse.connection_id) {
    return {
      success: false,
      error:
        connectResponse.message ??
        connectResponse.error ??
        'Failed to create Tokend org OAuth URL',
    };
  }

  await WebBrowser.openAuthSessionAsync(connectResponse.auth_url, redirectUrl);

  const status = await pollConnectStatus(connectResponse.connection_id);
  if (status.status !== 'synced') {
    return {
      success: false,
      error: status.error ?? status.error_message ?? 'Tokend org connection failed',
    };
  }

  return { success: true };
}

async function pollConnectStatus(connectionId: string) {
  const startedAt = Date.now();

  while (true) {
    const status = await tokendApi.getConnectStatus(connectionId);
    if (!status.success) {
      throw new Error(status.error ?? 'Failed to fetch Tokend connection status');
    }

    if (status.status === 'synced' || status.status === 'failed' || status.status === 'expired') {
      return status;
    }

    if (Date.now() - startedAt > POST_FOR_ME_STATUS_TIMEOUT_MS) {
      throw new Error('Timed out waiting for Tokend connection');
    }

    await new Promise((resolve) => setTimeout(resolve, POST_FOR_ME_STATUS_POLL_INTERVAL_MS));
  }
}
