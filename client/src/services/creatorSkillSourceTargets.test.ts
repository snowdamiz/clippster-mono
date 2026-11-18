import { expect, it } from 'vitest';
import type { CreatorSkillPackage } from '@clippster/shared-types';
import { creatorSkillSourceTargets } from './creatorSkillSourceTargets';

it('deduplicates cited and brand pages before applying the capture limit', () => {
  const item = {
    sources: [{ url: 'https://example.com/a', title: 'A' }, { url: 'https://example.com/b', title: 'B' }],
    brandReferences: [{ name: 'Brand', sourceUrl: 'https://example.com/a', logoUrl: 'https://cdn.example/logo.png' }, { name: 'Other', sourceUrl: 'https://example.com/c' }],
  } as CreatorSkillPackage;
  const result = creatorSkillSourceTargets(item, 2);
  expect(result.targets.map(target => [target.index, target.url, target.kind])).toEqual([
    [0, 'https://example.com/a', 'source'],
    [1, 'https://example.com/b', 'source'],
  ]);
  expect(result.omitted).toBe(1);
  expect(result.targets[0].logoUrl).toBe('https://cdn.example/logo.png');
});
