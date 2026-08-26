import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from './createApiClient';
import { createSchedulingApi } from './schedulingApi';
import { createUserSocialApi } from './userSocialApi';
import { createUserPostsApi } from './userPostsApi';

describe('schedulingApi', () => {
  it('schedules a post with mobile platform header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, post: { id: 1 } }),
    });

    const client = createApiClient({
      baseUrl: 'http://localhost:4000',
      getToken: async () => 'test-token',
      onUnauthorized: vi.fn(),
      platform: 'mobile',
      fetchImpl: fetchMock,
    });

    const schedulingApi = createSchedulingApi(client);
    await schedulingApi.schedulePost({
      platform: 'tiktok',
      media_url: 'https://cdn.example.com/video.mp4',
      caption: 'Test',
      scheduled_at: '2026-06-22T12:00:00.000Z',
      user_social_account_id: 42,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/social/schedule',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'X-Client-Platform': 'mobile',
        }),
        body: JSON.stringify({
          platform: 'tiktok',
          media_url: 'https://cdn.example.com/video.mp4',
          caption: 'Test',
          scheduled_at: '2026-06-22T12:00:00.000Z',
          user_social_account_id: 42,
        }),
      }),
    );
  });

  it('lists scheduled posts with status filter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, posts: [] }),
    });

    const client = createApiClient({
      baseUrl: 'http://localhost:4000',
      getToken: async () => 'test-token',
      onUnauthorized: vi.fn(),
      platform: 'mobile',
      fetchImpl: fetchMock,
    });

    const schedulingApi = createSchedulingApi(client);
    await schedulingApi.listScheduledPosts('scheduled');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/social/scheduled?status=scheduled',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('userSocialApi', () => {
  it('requests connect URL for a platform', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, auth_url: 'https://auth.example.com', connection_id: 'abc' }),
    });

    const client = createApiClient({
      baseUrl: 'http://localhost:4000',
      getToken: async () => 'test-token',
      onUnauthorized: vi.fn(),
      platform: 'mobile',
      fetchImpl: fetchMock,
    });

    const userSocialApi = createUserSocialApi(client);
    await userSocialApi.getConnectUrl('instagram');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/user/social/connect-url',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ platform: 'instagram' }),
      }),
    );
  });
});

describe('userPostsApi', () => {
  it('uploads media as FormData without Content-Type override', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ success: true, media_url: 'https://cdn.example.com/v.mp4' }),
    });

    const client = createApiClient({
      baseUrl: 'http://localhost:4000',
      getToken: async () => 'test-token',
      onUnauthorized: vi.fn(),
      platform: 'mobile',
      fetchImpl: fetchMock,
    });

    const userPostsApi = createUserPostsApi(client);
    const formData = new FormData();
    formData.append('file', new Blob(['test'], { type: 'video/mp4' }), 'clip.mp4');

    await userPostsApi.uploadMedia({
      uri: 'file:///clip.mp4',
      name: 'clip.mp4',
      type: 'video/mp4',
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
});
