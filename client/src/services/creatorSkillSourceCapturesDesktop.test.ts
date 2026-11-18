import { expect, it, vi } from 'vitest';
import type { CreatorSkillPackage } from '@clippster/shared-types';

const { invoke, readTextFile, screenshot } = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue({ path: 'C:/captures/page.txt', screenshotHtml: '<html></html>' }),
  readTextFile: vi.fn().mockResolvedValue('Official company page'),
  screenshot: vi.fn().mockResolvedValue({ highlighted: false }),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/plugin-fs', () => ({ readTextFile }));
vi.mock('@/ai-video/runtime/hyperframesClient', () => ({ hyperframesRequest: screenshot }));

import { captureCreatorSkillDesktopSources, type CreatorSkillSourceCache } from './creatorSkillSourceCapturesDesktop';

it('reuses one public page capture across clips while keeping per-clip records', async () => {
  const item = {
    funnel: { stage: 'trust', reason: 'test', metric: 'reviews' },
    sources: [{ url: 'https://example.com/source', title: 'Source', retrievedAt: '2026-11-03' }],
    brandReferences: [], claims: [],
    sponsors: [], thumbnailConcepts: ['Source frame'], thumbnailHeadlines: ['Clear source', 'Visible context'],
    platformCopy: [{ platform: 'YouTube', title: 'Clip', description: 'Summary', tags: [], pinnedComment: 'Details' }],
    reviewItems: [],
  } satisfies CreatorSkillPackage;
  const cache: CreatorSkillSourceCache = new Map();
  const first = await captureCreatorSkillDesktopSources('clip-a', item, cache);
  const second = await captureCreatorSkillDesktopSources('clip-b', item, cache);
  expect(invoke).toHaveBeenCalledOnce();
  expect(readTextFile).toHaveBeenCalledOnce();
  expect(screenshot).toHaveBeenCalledOnce();
  expect(first.captures[0].path).toBe(second.captures[0].path);
  expect(second.captures[0].url).toBe('https://example.com/source');
});
