import { describe, expect, it } from 'vitest';
import { creatorSkillBrandLogo } from './creatorSkillBrandLogo';
import type { CreatorSkillPackage } from '@clippster/shared-types';

const packageWith = (sourceUrl: string, logoUrl: string) => ({ brandReferences: [{ name: 'Pepsi', sourceUrl, logoUrl }] }) as CreatorSkillPackage;

describe('creatorSkillBrandLogo', () => {
  it('accepts a cited HTTPS brand host', () => {
    expect(creatorSkillBrandLogo(packageWith('https://www.pepsi.com/about', 'https://www.pepsi.com/logo.png'))).toEqual({ name: 'Pepsi', url: 'https://www.pepsi.com/logo.png' });
  });

  it('rejects a different host or insecure image', () => {
    expect(creatorSkillBrandLogo(packageWith('https://www.pepsi.com/', 'https://other.example/logo.png'))).toBeNull();
    expect(creatorSkillBrandLogo(packageWith('https://www.pepsi.com/', 'http://www.pepsi.com/logo.png'))).toBeNull();
  });
  it('requires a saved capture of the cited brand page when one is supplied', () => {
    const item = packageWith('https://www.pepsi.com/about', 'https://www.pepsi.com/logo.png');
    expect(creatorSkillBrandLogo(item, new Set())).toBeNull();
    expect(creatorSkillBrandLogo(item, new Set(['https://www.pepsi.com/about']))).toEqual({ name: 'Pepsi', url: 'https://www.pepsi.com/logo.png' });
  });
  it('selects a named brand in a multi-brand clip and avoids an unrelated logo', () => {
    const item = { brandReferences: [
      { name: 'Pepsi', sourceUrl: 'https://pepsi.example/about', logoUrl: 'https://pepsi.example/logo.png' },
      { name: 'Coke', sourceUrl: 'https://coke.example/about', logoUrl: 'https://coke.example/logo.png' },
    ] } as CreatorSkillPackage;
    expect(creatorSkillBrandLogo(item, undefined, 'The Coke launch')).toEqual({ name: 'Coke', url: 'https://coke.example/logo.png' });
    expect(creatorSkillBrandLogo(item, undefined, 'A new launch')).toBeNull();
    expect(creatorSkillBrandLogo(item, undefined, 'Cokery')).toBeNull();
  });
  it('allows a public CDN logo only when the captured page explicitly links it', () => {
    const item = packageWith('https://www.pepsi.com/about', 'https://cdn.pepsi.com/logo.png');
    const page = new Set(['https://www.pepsi.com/about']);
    expect(creatorSkillBrandLogo(item, page)).toBeNull();
    expect(creatorSkillBrandLogo(item, page, undefined, new Map([['https://www.pepsi.com/about', 'https://cdn.pepsi.com/logo.png']]))).toEqual({ name: 'Pepsi', url: 'https://cdn.pepsi.com/logo.png' });
  });
});
