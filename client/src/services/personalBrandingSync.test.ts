import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  profiles: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  execute: vi.fn(),
  importProfile: vi.fn(),
  select: vi.fn(async () => [{ name: 'server_id' }]),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs', () => ({ readFile: vi.fn() }));
vi.mock('@/services/database/watermarks', () => ({ getWatermarkImage: vi.fn() }));
vi.mock('./api', () => ({ default: { post: mocks.post, put: mocks.put, get: mocks.get } }));
vi.mock('./personalCreatorImport', () => ({
  creatorTimestamp: (value: number) => (value < 1e12 ? value * 1000 : value),
  importPersonalCreator: mocks.importProfile,
}));
vi.mock('@/services/database/core', () => ({
  getCurrentUserId: () => 1,
  getDatabase: async () => ({ select: mocks.select, execute: mocks.execute }),
}));
vi.mock('@/services/database', () => ({
  ensureOrganizationAssetColumns: vi.fn(),
  getAllCreatorProfiles: mocks.profiles,
  getIntroOutroById: vi.fn(),
  getWatermarkImage: vi.fn(),
  createOrganizationIntroOutro: vi.fn(),
  createOrganizationWatermark: vi.fn(),
  getIntroOutroByServerId: vi.fn(),
  getWatermarkByServerId: vi.fn(),
}));
import { syncPersonalBranding } from './personalBrandingSync';

describe('desktop creator cloud sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profiles.mockResolvedValue([
      {
        id: 'local-1',
        name: 'Personal creator',
        scope: 'streamer',
        auto_dvr_enabled: 1,
        platform_links: [
          {
            platform: 'twitch',
            platform_id: 'channel',
            display_name: 'Channel',
            profile_image_url: 'https://images.example/avatar.png',
            is_primary: true,
          },
        ],
      },
      { id: 'org-7', name: 'Assigned creator', platform_links: [] },
      { id: 'local-2', name: 'Global branding', scope: 'global', platform_links: [] },
    ]);
    mocks.post.mockResolvedValue({ data: { success: true, profile: { id: 11 } } });
    mocks.put.mockResolvedValue({ data: { success: true, profile: { id: 11 } } });
    mocks.get.mockResolvedValue({ data: { success: true, profiles: [], assets: [] } });
  });
  it('publishes personal scopes and platform metadata without duplicating assigned creators', async () => {
    expect((await syncPersonalBranding()).upsertedProfiles).toBe(2);
    expect(mocks.post).toHaveBeenCalledWith(
      '/user/creator-profiles',
      expect.objectContaining({
        client_id: 'local-1',
        scope: 'streamer',
        auto_dvr_enabled: true,
        profile_image_url: 'https://images.example/avatar.png',
        platform_links: [
          expect.objectContaining({ display_name: 'Channel', platform_id: 'channel' }),
        ],
      })
    );
    expect(mocks.post).toHaveBeenCalledWith(
      '/user/creator-profiles',
      expect.objectContaining({ client_id: 'local-2', scope: 'global' })
    );
    expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining('server_id'), [
      11,
      'local-1',
    ]);
  });
  it('reports failed upserts instead of claiming sync succeeded', async () => {
    mocks.post.mockResolvedValue({ data: { success: false, error: 'Sync denied' } });
    await expect(syncPersonalBranding()).rejects.toThrow('Sync denied');
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('automatic sync does not overwrite newer web edits', async () => {
    mocks.profiles.mockResolvedValue([
      { id: 'local-1', name: 'Older desktop name', updated_at: 1700000000, platform_links: [] },
    ]);
    mocks.get.mockResolvedValue({
      data: {
        success: true,
        assets: [],
        profiles: [
          {
            id: 11,
            client_id: 'local-1',
            name: 'New web name',
            updated_at: new Date(1700000001000).toISOString(),
          },
        ],
      },
    });
    expect((await syncPersonalBranding()).upsertedProfiles).toBe(0);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.importProfile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New web name' }),
      expect.objectContaining({ id: 'local-1' }),
      1
    );
  });
  it.each([1700000002, 1700000002000])(
    'publishes newer desktop edits with timestamp %s',
    async (updated_at) => {
      mocks.profiles.mockResolvedValue([
        { id: 'local-1', name: 'New desktop name', updated_at, platform_links: [] },
      ]);
      mocks.get.mockResolvedValue({
        data: {
          success: true,
          assets: [],
          profiles: [
            {
              id: 11,
              client_id: 'local-1',
              name: 'Old web name',
              updated_at: new Date(1700000001000).toISOString(),
            },
          ],
        },
      });
      expect((await syncPersonalBranding()).upsertedProfiles).toBe(1);
      expect(mocks.put).toHaveBeenCalledWith(
        '/user/creator-profiles/11',
        expect.objectContaining({ name: 'New desktop name' })
      );
    }
  );
  it('imports web/mobile creators that have no desktop client ID', async () => {
    mocks.profiles.mockResolvedValue([]);
    const remote = { id: 42, client_id: null, name: 'Mobile creator' };
    mocks.get.mockResolvedValue({ data: { success: true, assets: [], profiles: [remote] } });
    await syncPersonalBranding();
    expect(mocks.importProfile).toHaveBeenCalledWith(remote, undefined, 1);
  });
  it('updates imported creators by server ID instead of creating duplicates', async () => {
    mocks.profiles.mockResolvedValue([
      {
        id: 'local-import',
        server_id: 42,
        updated_at: 1700000002,
        name: 'Edited on desktop',
        platform_links: [],
      },
    ]);
    mocks.get.mockResolvedValue({
      data: {
        success: true,
        assets: [],
        profiles: [{ id: 42, client_id: null, updated_at: new Date(1700000001000).toISOString() }],
      },
    });
    await syncPersonalBranding();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.put).toHaveBeenCalledWith(
      '/user/creator-profiles/42',
      expect.objectContaining({ name: 'Edited on desktop' })
    );
  });
  it('coalesces simultaneous page and background sync requests', async () => {
    const first = syncPersonalBranding();
    expect(syncPersonalBranding()).toBe(first);
    await first;
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });
  it('continues syncing other creators after one fails', async () => {
    mocks.post.mockRejectedValueOnce(new Error('Asset upload failed'));
    await expect(syncPersonalBranding()).rejects.toThrow('Asset upload failed');
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining('server_id'), [
      11,
      'local-2',
    ]);
  });
  it('removes cloud-deleted profiles instead of uploading them again', async () => {
    mocks.profiles.mockResolvedValue([{ id: 'local-1', server_id: 42, platform_links: [] }]);
    await syncPersonalBranding();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.execute).toHaveBeenCalledWith(
      'DELETE FROM creator_profiles WHERE id = ? AND server_id = ?',
      ['local-1', 42]
    );
  });
  it('does not treat a malformed snapshot as deleted creators', async () => {
    mocks.get.mockResolvedValue({ data: { success: true } });
    await expect(syncPersonalBranding()).rejects.toThrow('Incomplete cloud creator response');
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
