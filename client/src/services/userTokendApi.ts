/**
 * User Tokend API — native provider (not Post For Me).
 * Live: OAuth 2.1 + PKCE via Tokend authorize page.
 * Mock/local (OAuth unset): instant mock connect.
 */

import api from './api';

export interface UserTokendAccount {
  id: number;
  platform: 'tokend';
  platform_user_id: string;
  provider?: string;
  provider_account_id?: string | null;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  profile_url?: string | null;
  is_active: boolean;
  connected_at: string;
  inserted_at: string;
  updated_at: string;
}

export interface TokendConnectResult {
  success: boolean;
  account?: UserTokendAccount;
  error?: string;
  message?: string;
}

type TokendConnectUrlResponse = {
  success: boolean;
  connection_id?: string;
  auth_url?: string;
  error?: string;
  message?: string;
};

type ConnectStatusResponse = {
  success: boolean;
  connection_id?: string;
  status?: 'pending' | 'callback_received' | 'synced' | 'failed' | 'expired';
  error?: string;
  error_message?: string;
};

const STATUS_POLL_INTERVAL_MS = 1500;
const STATUS_TIMEOUT_MS = 180000;

export async function listUserTokendAccounts(): Promise<{
  success: boolean;
  accounts: UserTokendAccount[];
  error?: string;
}> {
  const response = await api.get('/user/social-accounts');
  return {
    ...response.data,
    accounts: (response.data.social_accounts || []).filter(
      (acc: { platform?: string; provider?: string }) =>
        acc.platform === 'tokend' || acc.provider === 'tokend'
    ),
  };
}

/**
 * Instant mock connect when Phoenix OAuth is not configured.
 */
export async function connectUserTokend(): Promise<TokendConnectResult> {
  try {
    const response = await api.post('/user/tokend/connect', {});
    const data = response.data;
    if (data.success && data.social_account) {
      return { success: true, account: data.social_account };
    }
    return {
      success: false,
      error: data.error || 'connect_failed',
      message: data.message || data.error,
    };
  } catch (error: unknown) {
    const err = error as {
      response?: { data?: { error?: string; message?: string }; status?: number };
      message?: string;
    };
    return {
      success: false,
      error: err.response?.data?.error || 'connect_failed',
      message: err.response?.data?.message || err.message || 'Failed to connect Tokend',
    };
  }
}

/**
 * Start Tokend OAuth in the system browser and poll until synced.
 */
export async function startUserTokendOAuth(
  onResult?: (result: TokendConnectResult) => void
): Promise<() => void> {
  const { invoke } = await import('@tauri-apps/api/core');

  const connectResponse = await api.post<TokendConnectUrlResponse>('/user/tokend/connect-url', {
    return_mode: 'tauri',
  });

  if (!connectResponse.data.success || !connectResponse.data.auth_url) {
    throw new Error(
      connectResponse.data.message ||
        connectResponse.data.error ||
        'Failed to create Tokend OAuth URL'
    );
  }

  const connectionId = connectResponse.data.connection_id;
  if (!connectionId) {
    throw new Error('Tokend connect-url did not include connection_id');
  }

  await invoke('start_post_for_me_oauth', { authUrl: connectResponse.data.auth_url });

  let cancelled = false;

  void (async () => {
    try {
      const status = await pollConnectStatus(connectionId, () => cancelled);
      if (cancelled || !onResult) return;

      if (status.status !== 'synced') {
        onResult({
          success: false,
          error: status.error || 'Tokend connection failed',
        });
        return;
      }

      const accounts = await listUserTokendAccounts();
      const account = accounts.accounts[0];
      onResult({
        success: true,
        account,
        message: account ? undefined : 'Connected — refresh if the account is not listed yet.',
      });
    } catch (error: unknown) {
      if (cancelled || !onResult) return;
      const err = error as { message?: string };
      onResult({
        success: false,
        error: err.message || 'Failed to complete Tokend connection',
      });
    }
  })();

  return () => {
    cancelled = true;
  };
}

export async function disconnectUserTokendAccount(
  accountId: number
): Promise<{ success: boolean; error?: string }> {
  const response = await api.delete(`/user/social-accounts/${accountId}`);
  return response.data;
}

export async function publishToUserTokend(data: {
  account_id: number;
  media_url: string;
  caption?: string;
  media_type?: string;
  thumbnail_url?: string;
}): Promise<{ success: boolean; post?: unknown; error?: string; message?: string }> {
  const response = await api.post('/user/tokend/publish', data);
  return response.data;
}

export async function connectOrgTokend(organizationId: number | string): Promise<TokendConnectResult> {
  try {
    const response = await api.post(`/organizations/${organizationId}/tokend/connect`, {});
    const data = response.data;
    if (data.success && data.social_account) {
      return { success: true, account: data.social_account };
    }
    return {
      success: false,
      error: data.error || 'connect_failed',
      message: data.message || data.error,
    };
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
    return {
      success: false,
      error: err.response?.data?.error || 'connect_failed',
      message: err.response?.data?.message || err.message || 'Failed to connect Tokend',
    };
  }
}

export async function startOrgTokendOAuth(
  organizationId: number | string,
  onResult?: (result: TokendConnectResult) => void
): Promise<() => void> {
  const { invoke } = await import('@tauri-apps/api/core');

  const connectResponse = await api.post<TokendConnectUrlResponse>(
    `/organizations/${organizationId}/tokend/connect-url`,
    { return_mode: 'tauri' }
  );

  if (!connectResponse.data.success || !connectResponse.data.auth_url) {
    throw new Error(
      connectResponse.data.message ||
        connectResponse.data.error ||
        'Failed to create Tokend OAuth URL'
    );
  }

  const connectionId = connectResponse.data.connection_id;
  if (!connectionId) {
    throw new Error('Tokend connect-url did not include connection_id');
  }

  await invoke('start_post_for_me_oauth', { authUrl: connectResponse.data.auth_url });

  let cancelled = false;

  void (async () => {
    try {
      const status = await pollOrgConnectStatus(organizationId, connectionId, () => cancelled);
      if (cancelled || !onResult) return;

      if (status.status !== 'synced') {
        onResult({
          success: false,
          error: status.error || 'Tokend connection failed',
        });
        return;
      }

      onResult({ success: true });
    } catch (error: unknown) {
      if (cancelled || !onResult) return;
      const err = error as { message?: string };
      onResult({
        success: false,
        error: err.message || 'Failed to complete Tokend connection',
      });
    }
  })();

  return () => {
    cancelled = true;
  };
}

async function pollConnectStatus(
  connectionId: string,
  isCancelled: () => boolean
): Promise<ConnectStatusResponse> {
  const startedAt = Date.now();

  while (!isCancelled()) {
    const response = await api.get<ConnectStatusResponse>('/user/social/connect-status', {
      params: { connection_id: connectionId },
    });
    const status = response.data;

    if (!status.success) {
      throw new Error(status.error || 'Failed to fetch connection status');
    }

    if (status.status === 'synced' || status.status === 'failed' || status.status === 'expired') {
      return status;
    }

    if (Date.now() - startedAt > STATUS_TIMEOUT_MS) {
      throw new Error('Timed out waiting for Tokend authorization');
    }

    await new Promise((r) => setTimeout(r, STATUS_POLL_INTERVAL_MS));
  }

  return { success: false, status: 'failed', error: 'cancelled' };
}

async function pollOrgConnectStatus(
  organizationId: number | string,
  connectionId: string,
  isCancelled: () => boolean
): Promise<ConnectStatusResponse> {
  const startedAt = Date.now();

  while (!isCancelled()) {
    const response = await api.get<ConnectStatusResponse>('/social/connect-status', {
      params: { organization_id: organizationId, connection_id: connectionId },
    });
    const status = response.data;

    if (!status.success) {
      throw new Error(status.error || 'Failed to fetch connection status');
    }

    if (status.status === 'synced' || status.status === 'failed' || status.status === 'expired') {
      return status;
    }

    if (Date.now() - startedAt > STATUS_TIMEOUT_MS) {
      throw new Error('Timed out waiting for Tokend authorization');
    }

    await new Promise((r) => setTimeout(r, STATUS_POLL_INTERVAL_MS));
  }

  return { success: false, status: 'failed', error: 'cancelled' };
}
