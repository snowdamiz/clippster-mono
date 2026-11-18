import { describe, expect, it } from 'vitest';
import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { EditDocument, SpeechSegment } from '../ai-video/types';
import { validateDocument } from '../ai-video/director/validate';
import { addCreatorSkillSponsorDisclosure } from './creatorSkillSponsorDisclosure';

const document = {
  title: 'Sponsor clip', format: { width: 1080, height: 1920, fps: 30 }, music: null, clipAudio: 1,
  shots: [{ id: 'shot', mediaId: 'source', scene: null, sourceIn: 0, duration: 5, speed: 1, move: 'none', transitionIn: 'cut', refShot: null, description: '', alternates: [] }], overlays: [],
} as EditDocument;
const packageWith = (confirmed: boolean) => ({ sponsors: [{ name: 'Pepsi', confirmed, referralUrl: 'https://pepsi.example/ref', code: 'SAVE20', riskLine: 'Terms apply' }] }) as CreatorSkillPackage;
const speech = (text: string) => [{ start: 0, end: 4, text, speakerId: null }] as SpeechSegment[];

describe('creator skill sponsor disclosure', () => {
  it('labels an explicit read only when the creator profile confirmed the sponsor', () => {
    expect(addCreatorSkillSponsorDisclosure(document, {}, speech('This video is sponsored by Pepsi. Link below.'), packageWith(false)).added).toBe(false);
    const result = addCreatorSkillSponsorDisclosure(document, {}, speech('This video is sponsored by Pepsi. Link below.'), packageWith(true));
    expect(result.added).toBe(true);
    expect(result.document.overlays[0]).toMatchObject({ start: 0, duration: 5, label: 'Ad · Pepsi is a sponsor' });
    expect(result.files['compositions/creator-skill-sponsor-disclosure.html']).toContain('Code: SAVE20');
    expect(result.files['compositions/creator-skill-sponsor-disclosure.html']).toContain('https://pepsi.example/ref');
    expect(result.files['compositions/creator-skill-sponsor-disclosure.html']).toContain('Referral QR code');
    expect(result.files['compositions/creator-skill-sponsor-disclosure.html']).toContain('Terms apply');
    expect(validateDocument(result.document, { media: [{ id: 'source', name: 'clip', kind: 'video', path: 'clip.mp4', duration: 5, width: 1080, height: 1920, hasAudio: true, contentHash: 'test' }], maxSeconds: 60, exampleShots: 0, files: Object.keys(result.files), requireFiles: true }).errors).toEqual([]);
  });

  it('leaves an ordinary brand mention for manual review', () => {
    const result = addCreatorSkillSponsorDisclosure(document, {}, speech('I drank a Pepsi today.'), packageWith(true));
    expect(result.added).toBe(false);
    expect(result.reviewItems[0]).toContain('no explicit ad read');
  });

  it('keeps a first-frame sponsor chip even when graphics and text cover the whole clip', () => {
    const occupied = { ...document, overlays: [
      { id: 'graphic', lane: 'graphics', start: 0, duration: 5, label: 'Graphic', composition: 'compositions/graphic.html', variables: {} },
      { id: 'title', lane: 'text', start: 0, duration: 5, label: 'Title', composition: 'compositions/title.html', variables: { text: 'Title' } },
    ] } as EditDocument;
    const result = addCreatorSkillSponsorDisclosure(occupied, {}, speech('Sponsored by Pepsi. Link below.'), packageWith(true));
    expect(result.document.overlays[result.document.overlays.length - 1]).toMatchObject({ lane: 'sponsor', start: 0, duration: 5 });
  });
  it('flags a saved sponsor disclosure that misses the first frame or final read', () => {
    const saved = { ...document, overlays: [{ id: 'creator-skill-sponsor-disclosure', lane: 'sponsor', start: .1, duration: 4, label: 'Ad', composition: 'compositions/creator-skill-sponsor-disclosure.html', variables: {} }] } as EditDocument;
    const result = addCreatorSkillSponsorDisclosure(saved, {}, speech('Sponsored by Pepsi. Link below.'), packageWith(true));
    expect(result.added).toBe(false);
    expect(result.reviewItems).toEqual(expect.arrayContaining([expect.stringContaining('frame 1')]));
  });
  it('holds the referral pill from the mapped sponsor mention and keeps the CTA at the end', () => {
    const timeline = { ...document, shots: [
      { ...document.shots[0], id: 'intro', mediaId: 'intro', duration: 1 },
      { ...document.shots[0], sourceIn: 10, duration: 5 },
    ] } as EditDocument;
    const result = addCreatorSkillSponsorDisclosure(timeline, {}, [{ start: 10.5, end: 12, text: 'Sponsored by Pepsi. Link below.', speakerId: null }], packageWith(true), 'source');
    const composition = result.files['compositions/creator-skill-sponsor-disclosure.html'];
    expect(composition).toContain("tl.set('#referral-pill',{visibility:'visible'},1.500)");
    expect(composition).toContain("tl.set('#referral-pill',{visibility:'hidden'},4.000)");
    expect(composition).toContain("tl.set('#referral',{visibility:'visible'},3.000)");
  });
  it('uses the explicit ad read when the brand was mentioned earlier in passing', () => {
    const result = addCreatorSkillSponsorDisclosure(document, {}, [
      { start: 0, end: 1, text: 'I had a Pepsi.', speakerId: null },
      { start: 2, end: 3, text: 'This is sponsored by Pepsi. Link below.', speakerId: null },
    ], packageWith(true), 'source');
    expect(result.files['compositions/creator-skill-sponsor-disclosure.html']).toContain("tl.set('#referral-pill',{visibility:'visible'},2.000)");
  });
  it('does not put a discount percentage from saved sponsor text on screen', () => {
    const terms = { sponsors: [{ ...packageWith(true).sponsors[0], riskLine: 'Get 20% off today' }] } as CreatorSkillPackage;
    const result = addCreatorSkillSponsorDisclosure(document, {}, speech('Sponsored by Pepsi. Link below.'), terms, 'source');
    expect(result.files['compositions/creator-skill-sponsor-disclosure.html']).not.toContain('20% off');
    expect(result.reviewItems).toEqual(expect.arrayContaining([expect.stringContaining('on-screen discount percentage')]));
  });
  it('uses the saved disclosure wording without losing the first-frame Ad label', () => {
    const terms = { sponsors: [{ ...packageWith(true).sponsors[0], disclosure: 'Pepsi is a sponsor · I hold Pepsi shares · not financial advice' }] } as CreatorSkillPackage;
    const result = addCreatorSkillSponsorDisclosure(document, {}, speech('Sponsored by Pepsi. Link below.'), terms, 'source');
    expect(result.document.overlays[0].label).toBe('Ad · Pepsi is a sponsor · I hold Pepsi shares · not financial advice');
    expect(result.files['compositions/creator-skill-sponsor-disclosure.html']).toContain('I hold Pepsi shares');
  });

  it('does not truncate required disclosure text or show its discount offer', () => {
    const terms = { sponsors: [{ ...packageWith(true).sponsors[0], disclosure: 'Ad: Get 20% off with Pepsi' }] } as CreatorSkillPackage;
    const result = addCreatorSkillSponsorDisclosure(document, {}, speech('Sponsored by Pepsi. Link below.'), terms, 'source');
    expect(result.document.overlays[0].label).toBe('Ad · Sponsor disclosure');
    expect(result.reviewItems).toEqual(expect.arrayContaining([expect.stringContaining('compliant disclosure wording')]));
  });
  it('flags a missing holdings disclosure when the ad read discusses the creator position', () => {
    const result = addCreatorSkillSponsorDisclosure(document, {}, speech('Sponsored by Pepsi. I hold Pepsi shares. Link below.'), packageWith(true), 'source');
    expect(result.reviewItems).toEqual(expect.arrayContaining([expect.stringContaining('does not state the holding')]));
  });
});
