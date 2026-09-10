import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { navigationItems } from '@/config/navigation';

describe('AI Image Creator routing', () => {
  it('uses the renamed navigation item and route', () => {
    const item = navigationItems.find((entry) => entry.name === 'AI Image Creator');

    expect(item?.path).toBe('/ai-image');
    expect(navigationItems.some((entry) => entry.path === '/ai-thumbnail')).toBe(false);
  });

  it('keeps the project list under the dashboard and sessions full-page', () => {
    const routerSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

    expect(routerSource).toContain("path: '/ai-image'");
    expect(routerSource).toContain("path: '/ai-image/session'");
    expect(routerSource).toContain("path: '/ai-image/thumbnail'");
    expect(routerSource).toContain('@/pages/AIImageGenerator.vue');
    expect(routerSource).toContain('@/pages/AIImageCreatorSession.vue');
    expect(routerSource).toContain('@/pages/AIThumbnailGenerator.vue');
    expect(routerSource).toContain('noLayout: true');
    expect(routerSource).not.toContain("path: '/ai-thumbnail'");
  });

  it('uses editor-style session chrome with Create Image / Thumbnail tabs', () => {
    const sessionSource = readFileSync(new URL('../pages/AIImageCreatorSession.vue', import.meta.url), 'utf8');
    const thumbSource = readFileSync(new URL('../pages/AIThumbnailGenerator.vue', import.meta.url), 'utf8');
    const headerSource = readFileSync(
      new URL('../components/ai-image/AIImageCreatorHeader.vue', import.meta.url),
      'utf8'
    );
    const toolsSource = readFileSync(
      new URL('../editor/components/panels/assets/AIToolsView.vue', import.meta.url),
      'utf8'
    );

    expect(sessionSource).toContain('AIImageCreatorHeader');
    expect(thumbSource).toContain('AIImageCreatorHeader');
    expect(headerSource).toContain('Create Image');
    expect(headerSource).toContain('Create Thumbnail');
    expect(headerSource).toContain('Save workable file');
    expect(headerSource).toContain('Save locally');
    expect(toolsSource).toContain("router.push('/ai-image')");
  });
});
