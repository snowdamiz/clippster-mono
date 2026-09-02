import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from './createApiClient';
import { createAuthApi } from './authApi';

describe('createApiClient', () => {
  it('adds Authorization and X-Client-Platform headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, user: { id: 1 } }),
    });

    const client = createApiClient({
      baseUrl: 'http://localhost:4000',
      getToken: async () => 'test-token',
      onUnauthorized: vi.fn(),
      platform: 'mobile',
      fetchImpl: fetchMock,
    });

    const authApi = createAuthApi(client);
    await authApi.me();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'X-Client-Platform': 'mobile',
        }),
      }),
    );
  });

  it('calls onUnauthorized on 401', async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      status: 401,
      json: async () => ({ success: false, error: 'Unauthorized' }),
    });

    const client = createApiClient({
      baseUrl: 'https://api.clippster.app/api',
      getToken: async () => 'bad-token',
      onUnauthorized,
      platform: 'mobile',
      fetchImpl: fetchMock,
    });

    await client.get('/auth/me');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
