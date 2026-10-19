import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  profiles: vi.fn(), post: vi.fn(), get: vi.fn(), execute: vi.fn(),
  select: vi.fn(async () => [{ name: 'server_id' }]),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs', () => ({ readFile: vi.fn() }));
vi.mock('./api', () => ({ default: { post: mocks.post, get: mocks.get } }));
vi.mock('@/services/database/core', () => ({ getCurrentUserId: () => '1', getDatabase: async () => ({ select: mocks.select, execute: mocks.execute }) }));
vi.mock('@/services/database', () => ({
  ensureOrganizationAssetColumns: vi.fn(), getAllCreatorProfiles: mocks.profiles,
  getIntroOutroById: vi.fn(), getWatermarkImage: vi.fn(), createOrganizationIntroOutro: vi.fn(),
  createOrganizationWatermark: vi.fn(), getIntroOutroByServerId: vi.fn(), getWatermarkByServerId: vi.fn(),
}));
import { syncPersonalBranding } from './personalBrandingSync';

describe('desktop creator cloud sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profiles.mockResolvedValue([
      { id: 'local-1', name: 'Personal creator', scope: 'streamer', auto_dvr_enabled: 1, platform_links: [{ platform: 'twitch', platform_id: 'channel', display_name: 'Channel', profile_image_url: 'https://images.example/avatar.png', is_primary: true }] },
      { id: 'org-7', name: 'Assigned creator', platform_links: [] },
      { id: 'local-2', name: 'Global branding', scope: 'global', platform_links: [] },
    ]);
    mocks.post.mockResolvedValue({ data: { success: true, profile: { id: 11 } } });
    mocks.get.mockResolvedValue({ data: { success: true, profiles: [], assets: [] } });
  });
  it('publishes personal scopes and platform metadata without duplicating assigned creators', async () => {
    expect((await syncPersonalBranding()).upsertedProfiles).toBe(2);
    expect(mocks.post).toHaveBeenCalledWith('/user/creator-profiles', expect.objectContaining({
      client_id: 'local-1', scope: 'streamer', auto_dvr_enabled: true,
      profile_image_url: 'https://images.example/avatar.png',
      platform_links: [expect.objectContaining({ display_name: 'Channel', platform_id: 'channel' })],
    }));
    expect(mocks.post).toHaveBeenCalledWith('/user/creator-profiles', expect.objectContaining({ client_id: 'local-2', scope: 'global' }));
    expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining('server_id'), [11, 'local-1']);
  });
  it('reports failed upserts instead of claiming sync succeeded', async () => {
    mocks.post.mockResolvedValue({ data: { success: false, error: 'Sync denied' } });
    await expect(syncPersonalBranding()).rejects.toThrow('Sync denied');
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('automatic sync does not overwrite newer web edits', async () => {
    mocks.profiles.mockResolvedValue([{ id: 'local-1', name: 'Older desktop name', updated_at: 1700000000, platform_links: [] }]);
    mocks.get.mockResolvedValue({ data: { success: true, assets: [], profiles: [{ id: 11, client_id: 'local-1', name: 'New web name', updated_at: new Date(1700000001000).toISOString() }] } });
    expect((await syncPersonalBranding({ onlyLocalChanges: true })).upsertedProfiles).toBe(0);
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it.each([1700000002, 1700000002000])('publishes newer desktop edits with timestamp %s', async updated_at => {
    mocks.profiles.mockResolvedValue([{ id: 'local-1', name: 'New desktop name', updated_at, platform_links: [] }]);
    mocks.get.mockResolvedValue({ data: { success: true, assets: [], profiles: [{ id: 11, client_id: 'local-1', name: 'Old web name', updated_at: new Date(1700000001000).toISOString() }] } });
    expect((await syncPersonalBranding({ onlyLocalChanges: true })).upsertedProfiles).toBe(1);
  });
});
