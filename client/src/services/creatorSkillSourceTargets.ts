import type { CreatorSkillPackage } from '@clippster/shared-types';

export interface CreatorSkillSourceTarget { index: number; url: string; title: string; kind: 'source' | 'brand'; logoUrl?: string }

/** One bounded, stable list of distinct public pages for desktop and web review captures. */
export function creatorSkillSourceTargets(item: CreatorSkillPackage, limit = 12): { targets: CreatorSkillSourceTarget[]; omitted: number } {
  const unique = new Map<string, { title: string; kind: 'source' | 'brand'; logoUrl?: string }>();
  for (const source of item.sources) unique.set(source.url, { title: source.title, kind: 'source' });
  for (const brand of item.brandReferences ?? []) {
    const existing = unique.get(brand.sourceUrl);
    unique.set(brand.sourceUrl, { title: existing?.title ?? brand.name, kind: existing?.kind ?? 'brand', logoUrl: brand.logoUrl });
  }
  const targets = [...unique].slice(0, limit).map(([url, details], index) => ({ index, url, ...details }));
  return { targets, omitted: Math.max(0, unique.size - targets.length) };
}
