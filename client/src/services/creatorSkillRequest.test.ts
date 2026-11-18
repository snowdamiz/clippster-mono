import { expect, it } from 'vitest';
import { creatorSkillRequest } from './creatorSkillRequest';

it('permits speaker-led edits and avoids mandatory filler and incidental research', () => {
  const request = creatorSkillRequest(null);
  expect(request).toContain('Do not manufacture a fact/context card');
  expect(request).toContain('prefer a speaker-led shot');
  expect(request).toContain('do not research every incidental name');
  expect(request).toContain('Do not skip speech preservation');
});

it('offers shared public references as candidates that must be checked for this clip', () => {
  const request = creatorSkillRequest(null, '9:16', {
    sources: [{ url: 'https://example.com/report', title: 'Official report', retrievedAt: '2026-11-03' }],
    brandReferences: [{ name: 'Pepsi', sourceUrl: 'https://example.com/brand', colors: ['blue'], notes: 'Public brand page' }],
  });
  expect(request).toContain('https://example.com/report');
  expect(request).toContain('Pepsi');
  expect(request).toContain('Check each claim, source date, brand identity, and rights question for this clip');
});
