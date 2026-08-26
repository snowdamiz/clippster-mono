import { afterEach, describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('./api', () => ({
  default: {
    post,
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

import { startUserTokendConnection } from './userTokendApi';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Tokend connection mode routing', () => {
  afterEach(() => {
    post.mockReset();
    vi.unstubAllGlobals();
  });

  it('does not create a mock account when mode lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Phoenix unavailable')));

    await expect(startUserTokendConnection()).rejects.toThrow('Phoenix unavailable');
    expect(post).not.toHaveBeenCalled();
  });

  it('does not create a mock account when partner OAuth is disabled outside mock mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          mode: 'local',
          configured: true,
          oauth_ready: false,
          message: 'Partner OAuth disabled',
        })
      )
    );

    await expect(startUserTokendConnection()).rejects.toThrow('Partner OAuth disabled');
    expect(post).not.toHaveBeenCalled();
  });

  it('does not create a mock account when mock mode has incomplete OAuth settings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          mode: 'mock',
          configured: false,
          oauth_ready: false,
          oauth_incomplete: true,
          missing_oauth_configuration: ['TOKEND_OAUTH_REDIRECT_URI'],
        })
      )
    );

    await expect(startUserTokendConnection()).rejects.toThrow(
      'Tokend partner OAuth is incomplete'
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('uses the mock endpoint only in explicit mock mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ mode: 'mock', configured: false, oauth_ready: false }))
    );
    post.mockResolvedValue({
      data: {
        success: true,
        social_account: { id: 1, username: 'seednova' },
      },
    });

    await expect(startUserTokendConnection()).resolves.toEqual(expect.any(Function));
    expect(post).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith('/user/tokend/connect', {});
  });
});
