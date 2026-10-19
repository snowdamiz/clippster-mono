import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { ServerUserCreatorProfile } from '@clippster/api-client';
import type { CreatorProfileWithLinks } from './database/types';

const Database = createRequire(import.meta.url)('better-sqlite3');

const state = vi.hoisted(() => ({ db: null as any, userId: 7 }));
vi.mock('./database/core', () => ({
  getCurrentUserId: () => state.userId,
  generateId: () => crypto.randomUUID(),
  getDatabase: async () => ({
    execute: async (sql: string, values: unknown[]) => state.db.prepare(sql).run(...values),
  }),
}));
vi.mock('./database', () => ({
  getIntroOutroByServerId: vi.fn(async () => ({ id: 'local-intro' })),
  getWatermarkByServerId: vi.fn(async () => ({ id: 'local-watermark' })),
}));
import { importPersonalCreator } from './personalCreatorImport';

const remote = (changes = {}): ServerUserCreatorProfile => ({
  id: 42,
  user_id: 7,
  client_id: null,
  name: 'Created on mobile',
  description: null,
  profile_image_url: null,
  intro_id: null,
  outro_id: null,
  watermark_id: null,
  watermark_settings: null,
  intro_outro_settings: null,
  intro_ratio_settings: null,
  outro_ratio_settings: null,
  layout_overlays: [],
  clip_build_defaults: null,
  scope: 'streamer',
  disabled: false,
  inserted_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  platform_links: [
    { platform: 'youtube', platform_id: 'channel', display_name: 'Channel', is_primary: true },
  ],
  ...changes,
});
const read = (): CreatorProfileWithLinks => {
  const profile = state.db.prepare('SELECT * FROM creator_profiles').get();
  return {
    ...profile,
    platform_links: state.db.prepare('SELECT * FROM creator_platform_links').all(),
  };
};

describe('cloud creator imports', () => {
  beforeEach(() => {
    state.db?.close();
    state.userId = 7;
    state.db = new Database(':memory:');
    state.db
      .exec(`CREATE TABLE creator_profiles (id TEXT PRIMARY KEY, server_id INTEGER, name TEXT, description TEXT,
      profile_image_path TEXT, intro_id TEXT, outro_id TEXT, watermark_id TEXT, watermark_settings TEXT,
      intro_outro_settings TEXT, intro_ratio_settings TEXT, outro_ratio_settings TEXT, layout_overlays TEXT,
      clip_build_defaults TEXT, scope TEXT, disabled INTEGER, auto_dvr_enabled INTEGER, user_id INTEGER, created_at REAL, updated_at REAL);
      CREATE TABLE creator_platform_links (id TEXT PRIMARY KEY, creator_profile_id TEXT, platform TEXT, platform_id TEXT,
      display_name TEXT, profile_image_url TEXT, is_primary INTEGER, created_at REAL, monitored_streamer_id TEXT);`);
  });
  it('imports cloud-only creators and normalizes YouTube links', async () => {
    await importPersonalCreator(remote(), undefined, 7);
    expect(read()).toMatchObject({
      server_id: 42,
      user_id: 7,
      name: 'Created on mobile',
      platform_links: [{ platform: 'YouTube', platform_id: 'channel' }],
    });
  });
  it('preserves profile IDs and monitoring links when applying newer cloud edits', async () => {
    await importPersonalCreator(remote(), undefined, 7);
    state.db.prepare("UPDATE creator_platform_links SET monitored_streamer_id = 'monitor-1'").run();
    const before = read();
    await importPersonalCreator(
      remote({ name: 'Edited on web', updated_at: '2026-01-03T00:00:00Z' }),
      before,
      7
    );
    expect(read()).toMatchObject({
      id: before.id,
      name: 'Edited on web',
      platform_links: [{ id: before.platform_links[0].id, monitored_streamer_id: 'monitor-1' }],
    });
    expect(state.db.prepare('SELECT count(*) AS count FROM creator_profiles').get().count).toBe(1);
  });
  it('does not overwrite newer desktop edits', async () => {
    await importPersonalCreator(
      remote({ name: 'New desktop name', updated_at: '2026-01-04T00:00:00Z' }),
      undefined,
      7
    );
    expect(await importPersonalCreator(remote(), read(), 7)).toBe(false);
    expect(read().name).toBe('New desktop name');
  });
  it('resolves cloud branding IDs to local assets', async () => {
    await importPersonalCreator(remote({ intro_id: 15, watermark_id: 16 }), undefined, 7);
    expect(read()).toMatchObject({ intro_id: 'local-intro', watermark_id: 'local-watermark' });
  });
  it('rejects an account switch before writing profiles', async () => {
    state.userId = 8;
    await expect(importPersonalCreator(remote(), undefined, 7)).rejects.toThrow('Account changed');
    expect(state.db.prepare('SELECT count(*) AS count FROM creator_profiles').get().count).toBe(0);
  });
});
