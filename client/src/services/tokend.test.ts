import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkTokendLivestream,
  extractTokendChannel,
  fetchTokendCatalog,
  fetchTokendMode,
  getTokendCapabilities,
  getTokendConnectStrategy,
  getTokendVods,
  isTokendPublishPlatform,
  isTokendUrl,
} from './tokend';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('tokend service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects tokend.tv and local web URLs', () => {
    expect(isTokendUrl('https://tokend.tv/seed-nova')).toBe(true);
    expect(isTokendUrl('http://localhost:4100/seed-nova')).toBe(true);
    expect(isTokendUrl('https://tokend.com/@seed-nova')).toBe(false);
    expect(isTokendUrl('https://youtube.com/@x')).toBe(false);
  });

  it('extracts creator slug from Tokend paths and handles', () => {
    expect(extractTokendChannel('https://tokend.tv/Seed-Nova')).toBe('seed-nova');
    expect(extractTokendChannel('http://localhost:4100/seed-nova/vods')).toBe('seed-nova');
    expect(extractTokendChannel('https://tokend.tv/stream/seed-halo')).toBe('seed-halo');
    expect(extractTokendChannel('@seed-nova')).toBe('seed-nova');
    expect(extractTokendChannel('seed-orbit')).toBe('seed-orbit');
  });

  it('parses explicit mode and incomplete OAuth details from Phoenix', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          mode: 'local',
          configured: true,
          oauth_ready: false,
          oauth_incomplete: true,
          missing_oauth_configuration: ['TOKEND_OAUTH_REDIRECT_URI'],
          message: 'OAuth configuration is incomplete',
        })
      )
    );

    await expect(fetchTokendMode()).resolves.toEqual({
      mode: 'local',
      configured: true,
      oauth_ready: false,
      oauth_incomplete: true,
      missing_oauth_configuration: ['TOKEND_OAUTH_REDIRECT_URI'],
      message: 'OAuth configuration is incomplete',
    });
  });

  it('rejects mode failures and invalid mode responses instead of assuming mock', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Phoenix unavailable')));
    await expect(fetchTokendMode()).rejects.toThrow('Phoenix unavailable');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ mode: 'mock-fallback' })));
    await expect(fetchTokendMode()).rejects.toThrow('Invalid Tokend mode response');
  });

  it.each([
    {
      modeInfo: { mode: 'mock' as const, configured: false, oauth_ready: false },
      strategy: 'mock',
      mockConnect: true,
      oauthConnect: false,
      fixtureMode: true,
    },
    {
      modeInfo: {
        mode: 'mock' as const,
        configured: false,
        oauth_ready: false,
        oauth_incomplete: true,
      },
      strategy: 'unavailable',
      mockConnect: false,
      oauthConnect: false,
      fixtureMode: true,
    },
    {
      modeInfo: { mode: 'local' as const, configured: true, oauth_ready: false },
      strategy: 'unavailable',
      mockConnect: false,
      oauthConnect: false,
      fixtureMode: false,
    },
    {
      modeInfo: { mode: 'live' as const, configured: true, oauth_ready: false },
      strategy: 'unavailable',
      mockConnect: false,
      oauthConnect: false,
      fixtureMode: false,
    },
    {
      modeInfo: { mode: 'live' as const, configured: true, oauth_ready: true },
      strategy: 'oauth',
      mockConnect: false,
      oauthConnect: true,
      fixtureMode: false,
      publish: true,
      schedule: true,
      download: true,
      watch: true,
    },
  ])(
    'locks the $modeInfo.mode capability matrix with $strategy connect',
    ({
      modeInfo,
      strategy,
      mockConnect,
      oauthConnect,
      fixtureMode,
      publish = false,
      schedule = false,
      download = false,
      watch = false,
    }) => {
      const capabilities = getTokendCapabilities(modeInfo);

      expect(getTokendConnectStrategy(modeInfo)).toBe(strategy);
      expect(capabilities).toMatchObject({
        publicCatalog: true,
        liveStatus: true,
        mockConnect,
        oauthConnect,
        fixtureMode,
        publish,
        schedule,
        download,
        playback: watch,
        watch,
        dvr: false,
        analytics: false,
      });
    }
  );

  it('prefers explicit Phoenix capability flags over oauth_ready inference', () => {
    const capabilities = getTokendCapabilities({
      mode: 'live',
      configured: true,
      oauth_ready: true,
      capabilities: {
        publish: false,
        schedule: false,
        download: false,
        watch: false,
      },
    });

    expect(capabilities.publish).toBe(false);
    expect(capabilities.schedule).toBe(false);
    expect(capabilities.download).toBe(false);
    expect(capabilities.watch).toBe(false);
  });

  it('identifies Tokend publish targets for fail-closed routing', () => {
    expect(isTokendPublishPlatform('tokend')).toBe(true);
    expect(isTokendPublishPlatform('Tokend')).toBe(true);
    expect(isTokendPublishPlatform('youtube')).toBe(false);
  });

  it('maps catalog items without inventing fixture videos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          mode: 'live',
          slug: 'creator',
          displayName: 'Creator',
          streams: [
            {
              id: 'tokend-vod-1',
              title: 'Session',
              duration: 120,
              url: 'https://tokend.tv/creator/vod/1',
              kind: 'stream',
            },
          ],
          videos: [],
        })
      )
    );

    await expect(getTokendVods('creator', 20, 'streams')).resolves.toEqual([
      {
        videoId: 'tokend-vod-1',
        title: 'Session',
        duration: 120,
        thumbnailUrl: undefined,
        uploadDate: undefined,
        url: 'https://tokend.tv/creator/vod/1',
        isLive: false,
        kind: 'stream',
      },
    ]);
  });

  it('returns catalog fixtures only when Phoenix explicitly returns mock mode', async () => {
    const fixture = {
      mode: 'mock',
      slug: 'seed-nova',
      displayName: 'Seed Nova',
      streams: [],
      videos: [],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(fixture)));

    await expect(fetchTokendCatalog('seed-nova')).resolves.toEqual(fixture);
  });

  it('rejects catalog network and Phoenix errors without local fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    await expect(fetchTokendCatalog('seed-nova')).rejects.toThrow('connection refused');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'Tokend upstream unavailable' }, 502))
    );
    await expect(fetchTokendCatalog('seed-nova')).rejects.toThrow('Tokend upstream unavailable');
  });

  it('returns an explicit livestream error on network failure without fixture data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    await expect(checkTokendLivestream('seed-nova')).resolves.toEqual({
      isLive: false,
      channelId: 'seed-nova',
      error: 'connection refused',
    });
  });
});
