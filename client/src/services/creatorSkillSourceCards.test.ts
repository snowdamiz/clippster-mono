import { describe, expect, it } from 'vitest';
import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { EditDocument } from '../ai-video/types';
import { addCreatorSkillSourceCards } from './creatorSkillSourceCards';
import { auditCreatorSkillLabels } from './creatorSkillLabelAudit';
import { validateDocument } from '../ai-video/director/validate';

const document = {
  title: 'Test', music: null, clipAudio: 1,
  format: { width: 1080, height: 1920, fps: 30 },
  shots: [{ id: 'shot', mediaId: 'source', scene: null, sourceIn: 10, duration: 5, speed: 1, move: 'none', transitionIn: 'cut', refShot: null, description: '', alternates: [] }],
  overlays: [],
} as EditDocument;
const item = { claims: [{ time: 11, verdict: 'unconfirmed', text: 'Revenue was $5B', onScreenLabel: 'Revenue was $5B' }] } as CreatorSkillPackage;

describe('creator skill source cards', () => {
  it('does not manufacture an opinion disclaimer for a conversational joke', () => {
    const result = addCreatorSkillSourceCards(document, {}, 'source', { ...item, claims: [{ ...item.claims[0], verdict: 'opinion', onScreenLabel: 'Opinion and joke, not real policy' }] });
    expect(result.added).toBe(0);
    expect(result.document.overlays).toEqual([]);
    expect(result.files).toEqual({});
  });
  it('adds a neutral editable card at the spoken source time without repeating unverified numbers', () => {
    const result = addCreatorSkillSourceCards(document, {}, 'source', item);
    expect(result.added).toBe(1);
    expect(result.document.overlays[0]).toMatchObject({ start: 1, duration: 2, label: 'Unconfirmed: verify cited source', variables: { creatorSkillClaimTime: 11 } });
    expect(result.files['compositions/creator-skill-label-0.html']).toContain('data-composition-id="creator-skill-label-0"');
    expect(result.files['compositions/creator-skill-label-0.html']).not.toContain('$5B');
    expect(validateDocument(result.document, { media: [{ id: 'source', name: 'clip', kind: 'video', path: 'clip.mp4', duration: 30, width: 1080, height: 1920, hasAudio: true, contentHash: 'test' }], maxSeconds: 60, exampleShots: 0, files: Object.keys(result.files), requireFiles: true }).errors).toEqual([]);
    expect(auditCreatorSkillLabels(result.document, 'source', item, result.files)).toEqual([]);
    expect(addCreatorSkillSourceCards(result.document, result.files, 'source', item).added).toBe(0);
  });

  it('reports occupied lanes instead of overwriting existing graphics', () => {
    const blocked = { ...document, overlays: ['graphics', 'text'].map(lane => ({ id: lane, lane, start: 0, duration: 5, label: lane, composition: `compositions/${lane}.html`, variables: {} })) } as EditDocument;
    const result = addCreatorSkillSourceCards(blocked, {}, 'source', item);
    expect(result.added).toBe(0);
    expect(result.reviewItems[0]).toContain('both overlay lanes are occupied');
  });

  it('places a claim card without displacing the full-length sponsor disclosure', () => {
    const sponsored = { ...document, overlays: [{ id: 'ad', lane: 'sponsor', start: 0, duration: 5, label: 'Ad', composition: 'compositions/ad.html', variables: {} }] } as EditDocument;
    const result = addCreatorSkillSourceCards(sponsored, {}, 'source', item);
    expect(result.added).toBe(1);
    expect(result.document.overlays.map(overlay => overlay.lane)).toEqual(['sponsor', 'graphics']);
  });

  it('adds a cautious dated source card when the AI omitted its proposed label', () => {
    const dated = { ...item, claims: [{ time: 11, verdict: 'unconfirmed' as const, text: 'Revenue was $5B', sourceUrl: 'https://www.example.com/report', publishedAt: '2026-10-31' }] } as CreatorSkillPackage;
    const result = addCreatorSkillSourceCards(document, {}, 'source', dated);
    expect(result.added).toBe(1);
    expect(result.document.overlays[0].label).toContain('Source: example.com · Proposed date 2026-10-31');
    expect(result.document.overlays[0].label).not.toContain('$5B');
    expect(auditCreatorSkillLabels(result.document, 'source', dated, result.files)).toEqual([]);
  });

  it('adds a dated card when an existing AI label omits the source date', () => {
    const dated = { ...item, claims: [{ time: 11, verdict: 'unconfirmed' as const, text: 'Revenue was $5B', onScreenLabel: 'Unconfirmed', sourceUrl: 'https://example.com/report', publishedAt: '2026-10-31' }] } as CreatorSkillPackage;
    const existing = { ...document, overlays: [{ id: 'ai', lane: 'text', start: 0, duration: 5, label: 'Unconfirmed', composition: 'compositions/ai.html', variables: {} }] } as EditDocument;
    const result = addCreatorSkillSourceCards(existing, { 'compositions/ai.html': '<div>Unconfirmed</div>' }, 'source', dated);
    expect(result.added).toBe(1);
    expect(auditCreatorSkillLabels(result.document, 'source', dated, result.files)).toEqual([]);
  });

  it('attributes a dated AI-verified claim without asserting that its source was independently checked', () => {
    const cited = { ...item, claims: [{ time: 11, verdict: 'verified' as const, text: 'Revenue rose', sourceUrl: 'https://example.com/report', publishedAt: '2026-10-31' }] } as CreatorSkillPackage;
    const result = addCreatorSkillSourceCards(document, {}, 'source', cited);
    expect(result.document.overlays[0].label).toBe('Source: example.com · Proposed date 2026-10-31');
    expect(result.document.overlays[0].label).not.toContain('Verified');
  });
  it('does not present an uncaptured page as dated evidence', () => {
    const cited = { ...item, claims: [{ time: 11, verdict: 'unconfirmed' as const, text: 'Revenue rose', sourceUrl: 'https://example.com/report', publishedAt: '2026-10-31' }] } as CreatorSkillPackage;
    const missing = addCreatorSkillSourceCards(document, {}, 'source', cited, new Set());
    expect(missing.document.overlays[0].label).toBe('Unconfirmed: cited source not captured');
    expect(missing.reviewItems).toContain('Could not capture cited source for claim at 11.0s; inspect https://example.com/report directly before publishing.');
    const captured = addCreatorSkillSourceCards(document, {}, 'source', cited, new Set(['https://example.com/report']));
    expect(captured.document.overlays[0].label).toContain('Source: example.com · Proposed date 2026-10-31');
    const mismatch = addCreatorSkillSourceCards(document, {}, 'source', cited, new Set(['https://example.com/report']), new Map([['https://example.com/report', '2026-11-01']]));
    expect(mismatch.document.overlays[0].label).toContain('Unconfirmed: date mismatch');
    expect(mismatch.document.overlays[0].label).toContain('Page date 2026-11-01');
  });
});
