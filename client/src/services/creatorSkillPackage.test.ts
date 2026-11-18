import { describe, expect, it } from 'vitest';
import { parseCreatorSkillPackage, reconcileCreatorSkillResearch, reconcileCreatorSkillSponsors, recordCreatorSkillClaimReview, recordCreatorSkillFootageReview, recordCreatorSkillIndependentFinding, recordCreatorSkillIndependentSignoff } from './creatorSkillPackage';
import { creatorSkillPublishBlockers, creatorSkillUnresolvedFixes } from './creatorSkillReview';

const base = {
  funnel: { stage: 'trust', reason: 'The clip explains a sourced topic', metric: 'saves' },
  claims: [], sources: [], sponsors: [], thumbnailConcepts: ['Use a frame from this VOD'], thumbnailHeadlines: ['WHAT HAPPENED', 'THE BIG SHIFT'],
  platformCopy: [{ platform: 'YouTube Shorts', title: 'Clip title', description: 'Description', tags: [], pinnedComment: 'What do you think?' }],
  reviewItems: [],
};

describe('creator skill package validation', () => {
  it('requires reach clips to connect to a later stage', () => {
    const result = parseCreatorSkillPackage({ ...base, funnel: { stage: 'reach', reason: 'Broad appeal', metric: 'follows' } });
    expect(result.error).toContain('bridge');
  });

  it('rejects em dashes in upload copy', () => {
    const result = parseCreatorSkillPackage({ ...base, platformCopy: [{ ...base.platformCopy[0], title: 'News — today' }] });
    expect(result.error).toContain('em dashes');
    expect(parseCreatorSkillPackage({ ...base, platformCopy: [{ ...base.platformCopy[0], tags: ['news—today'] }] }).error).toContain('em dashes');
  });

  it('accepts a dated claim with a listed source', () => {
    const source = { url: 'https://example.com/press', title: 'Press release', publishedAt: '2026-10-01', retrievedAt: '2026-11-01' };
    const result = parseCreatorSkillPackage({ ...base, sources: [source], claims: [{ time: 3, text: 'A stated figure', verdict: 'verified', sourceUrl: source.url, publishedAt: source.publishedAt }] });
    expect(result.package?.claims).toHaveLength(1);
  });

  it('rejects a verified claim without a dated listed source', () => {
    const result = parseCreatorSkillPackage({ ...base, claims: [{ time: 3, text: 'A stated figure', verdict: 'verified' }] });
    expect(result.error).toContain('dated source URL');
  });

  it('rejects a verified claim whose date is absent from or conflicts with its source card', () => {
    const claim = { time: 3, text: 'A stated figure', verdict: 'verified', sourceUrl: 'https://example.com/press', publishedAt: '2026-10-01' };
    for (const publishedAt of [undefined, '2026-09-30']) {
      const result = parseCreatorSkillPackage({ ...base, sources: [{ url: claim.sourceUrl, title: 'Press release', retrievedAt: '2026-11-01', publishedAt }], claims: [claim] });
      expect(result.error).toContain('matching publication date');
    }
  });

  it('requires an on-screen label for uncertainty', () => {
    const result = parseCreatorSkillPackage({ ...base, claims: [{ time: 3, text: 'A rumor', verdict: 'rumor' }] });
    expect(result.error).toContain('on-screen label');
  });

  it('keeps public brand research separate from sponsorship', () => {
    const result = parseCreatorSkillPackage({
      ...base,
      brandReferences: [{ name: 'Pepsi', sourceUrl: 'https://www.pepsi.com/', logoUrl: 'https://www.pepsi.com/logo.png', colors: ['blue'], notes: 'Check usage rights.' }],
    });
    expect(result.package?.brandReferences?.[0].name).toBe('Pepsi');
    expect(result.package?.sponsors).toEqual([]);
  });
  it('accepts proposed long-form chapters without claiming their timing is verified', () => {
    const result = parseCreatorSkillPackage({ ...base, chapters: [{ time: 0, title: 'The question' }, { time: 45, title: 'The evidence' }, { time: 100, title: 'The takeaway' }] });
    expect(result.package?.chapters).toHaveLength(3);
    expect(parseCreatorSkillPackage({ ...base, chapters: [{ time: 0, title: 'Bad — title' }] }).error).toContain('em dashes');
  });
  it('requires public source and logo proposals to use HTTPS', () => {
    const result = parseCreatorSkillPackage({ ...base, brandReferences: [{ name: 'Pepsi', sourceUrl: 'http://www.pepsi.com/', colors: [], notes: 'Review' }] });
    expect(result.error).toContain('HTTPS source URL');
  });
  it('keeps source-time crop proposals inside the frame', () => {
    const footageReview = [{ start: 10, end: 15, crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 }, show: 'Article paragraph', hide: ['account name'], note: 'Inspect transition frames.' }];
    expect(parseCreatorSkillPackage({ ...base, footageReview }).package?.footageReview).toEqual(footageReview);
    expect(parseCreatorSkillPackage({ ...base, footageReview: [{ ...footageReview[0], crop: { x: 0.8, y: 0, width: 0.5, height: 1 } }] }).error).toContain('inside the source video');
  });
  it('records a human crop inspection without treating the proposal as automatically approved', () => {
    const proposed = parseCreatorSkillPackage({ ...base, footageReview: [{ start: 10, end: 15, show: 'Article', hide: ['account name'], note: 'Check transition.' }] }).package!;
    expect(proposed.footageReviews).toBeUndefined();
    const checked = recordCreatorSkillFootageReview(proposed, 0, 'frame_checked', 'Inspected both transitions and full-resolution frames.', '2026-11-02T00:00:00Z');
    expect(checked.footageReviews?.[0].decision).toBe('frame_checked');
    expect(() => recordCreatorSkillFootageReview(proposed, 1, 'frame_checked', 'Inspected source frames.')).toThrow('valid footage range');
  });
});

describe('creator skill sponsor reconciliation', () => {
  it('removes AI-invented sponsor terms and uses saved terms only', () => {
    const proposed = parseCreatorSkillPackage({
      ...base,
      sponsors: [
        { name: 'Pepsi', confirmed: true, code: 'FAKE', referralUrl: 'https://example.com/fake' },
        { name: 'Acme', confirmed: false, code: 'WRONG' },
      ],
      platformCopy: [{ ...base.platformCopy[0], description: 'Try https://example.com/fake with FAKE. Read https://example.com/report.', pinnedComment: 'Use WRONG.' }],
      sources: [{ url: 'https://example.com/report', title: 'Report', retrievedAt: '2026-11-01' }],
    }).package!;
    const result = reconcileCreatorSkillSponsors(proposed, {
      sponsors: [{ name: 'Acme', code: 'REAL', disclosure: 'Sponsored by Acme' }],
    });
    expect(result.sponsors[0]).toMatchObject({ name: 'Pepsi', confirmed: false });
    expect(result.sponsors[0]).not.toHaveProperty('code');
    expect(result.sponsors[0]).not.toHaveProperty('referralUrl');
    expect(result.sponsors[1]).toMatchObject({ name: 'Acme', confirmed: true, code: 'REAL', disclosure: 'Sponsored by Acme' });
    expect(result.platformCopy[0].description).not.toContain('https://example.com/fake');
    expect(result.platformCopy[0].description).not.toContain('FAKE');
    expect(result.platformCopy[0].description).toContain('https://example.com/report');
    expect(result.platformCopy[0].pinnedComment).not.toContain('WRONG');
    expect(result.reviewItems).toEqual(expect.arrayContaining([expect.stringContaining('removed from posting copy')]));
  });

  it('removes a saved referral from a disallowed platform draft', () => {
    const proposed = parseCreatorSkillPackage({
      ...base,
      sponsors: [{ name: 'Acme', confirmed: true }],
      platformCopy: [
        { ...base.platformCopy[0], platform: 'YouTube Shorts', description: 'Try https://acme.example/ref with code REAL', pinnedComment: 'REAL' },
        { ...base.platformCopy[0], platform: 'TikTok', description: 'Try https://acme.example/ref with code REAL', pinnedComment: 'REAL' },
      ],
    }).package!;
    const result = reconcileCreatorSkillSponsors(proposed, {
      sponsors: [{ name: 'Acme', referralUrl: 'https://acme.example/ref', code: 'REAL', platforms: ['YouTube'] }],
    });
    expect(result.platformCopy[0].description).toContain('https://acme.example/ref');
    expect(result.platformCopy[0].pinnedComment).toBe('REAL');
    expect(result.platformCopy[1].description).not.toContain('https://acme.example/ref');
    expect(result.platformCopy[1].description).not.toContain('REAL');
    expect(result.platformCopy[1].pinnedComment).not.toContain('REAL');
    expect(result.reviewItems).toEqual(expect.arrayContaining([expect.stringContaining('not approved for TikTok')]));
  });

  it('keeps sponsor discounts only in descriptions when the saved agreement allows them', () => {
    const proposed = parseCreatorSkillPackage({
      ...base,
      sponsors: [{ name: 'Acme', confirmed: true }],
      platformCopy: [{ ...base.platformCopy[0], title: 'Acme 20% off', description: 'Save 20% with Acme.', pinnedComment: 'Acme discount here' }],
    }).package!;
    const disallowed = reconcileCreatorSkillSponsors(proposed, { sponsors: [{ name: 'Acme' }] });
    expect(disallowed.platformCopy[0]).toMatchObject({ title: '', description: '', pinnedComment: '' });
    expect(disallowed.reviewItems).toEqual(expect.arrayContaining([expect.stringContaining('discount wording was removed')]));
    const allowed = reconcileCreatorSkillSponsors(proposed, { sponsors: [{ name: 'Acme', discountInDescriptionAllowed: true }] });
    expect(allowed.platformCopy[0]).toMatchObject({ title: '', description: 'Save 20% with Acme.', pinnedComment: '' });
  });
});

describe('creator skill research evidence', () => {
  it('downgrades a proposed verified claim when the provider reports no page fetches', () => {
    const proposed = parseCreatorSkillPackage({
      ...base,
      sources: [{ url: 'https://example.com/source', title: 'Source', publishedAt: '2026-10-01', retrievedAt: '2026-11-01' }],
      claims: [{ time: 2, text: 'A number', verdict: 'verified', sourceUrl: 'https://example.com/source', publishedAt: '2026-10-01' }],
    }).package!;
    const result = reconcileCreatorSkillResearch(proposed, 0);
    expect(result.claims[0]).toMatchObject({ verdict: 'unconfirmed', onScreenLabel: expect.stringContaining('Unconfirmed') });
    expect(result.reviewItems).toEqual(expect.arrayContaining([expect.stringContaining('No web page retrievals')]));
    const retrieved = reconcileCreatorSkillResearch(proposed, 1);
    expect(retrieved.claims[0].verdict).toBe('unconfirmed');
    expect(retrieved.reviewItems).toEqual(expect.arrayContaining([expect.stringContaining('none were linked to individual citations')]));
  });
});

it('records a human source check without upgrading the claim verdict', () => {
  const item = parseCreatorSkillPackage({ ...base, claims: [{ time: 2, text: 'A figure', verdict: 'unconfirmed', sourceUrl: 'https://example.com/report', onScreenLabel: 'Unconfirmed' }] }).package!;
  const reviewed = recordCreatorSkillClaimReview(item, 0, 'source_checked', 'Checked the dated report directly.', '2026-11-02T00:00:00Z');
  expect(reviewed.claimReviews?.[0]).toMatchObject({ claimIndex: 0, decision: 'source_checked' });
  expect(reviewed.claims[0].verdict).toBe('unconfirmed');
  expect(() => recordCreatorSkillClaimReview(item, 0, 'source_checked', 'short')).toThrow('10 to 1000');
});

it('ties an independent finding to the inspected master checksum', () => {
  const item = parseCreatorSkillPackage(base).package!;
  const finding = { reviewer: 'Alex', severity: 'fix_first' as const, outputTime: 12.5, finding: 'Private notification visible at 12.5 seconds.', masterMd5: 'a'.repeat(32) };
  const reviewed = recordCreatorSkillIndependentFinding(item, finding, '2026-11-02T00:00:00Z');
  expect(reviewed.independentReview?.[0]).toMatchObject(finding);
  expect(creatorSkillUnresolvedFixes(reviewed, finding.masterMd5)).toHaveLength(1);
  expect(creatorSkillUnresolvedFixes(reviewed, 'b'.repeat(32))).toHaveLength(0);
  const rechecked = { ...recordCreatorSkillIndependentFinding(reviewed, { ...finding, severity: 'ok', finding: 'Rechecked the frame; notification belongs to the public article.' }, '2026-11-02T00:01:00Z'), automatedQa: { masterMd5: finding.masterMd5, blockers: [] } };
  expect(creatorSkillUnresolvedFixes(rechecked, finding.masterMd5)).toHaveLength(0);
  expect(creatorSkillPublishBlockers(reviewed, finding.masterMd5)).toEqual(expect.arrayContaining([expect.stringContaining('FIX FIRST')]));
  expect(creatorSkillPublishBlockers(rechecked, finding.masterMd5)).toContain('An independent reviewer must sign off on the current edited master.');
  const signed = recordCreatorSkillIndependentSignoff(rechecked, { reviewer: 'Alex', note: 'Watched the complete master against Raw and checked every flagged frame.', masterMd5: finding.masterMd5 });
  expect(creatorSkillPublishBlockers(signed, finding.masterMd5)).toEqual([]);
  expect(creatorSkillPublishBlockers(signed, 'b'.repeat(32))).toContain('An independent reviewer must sign off on the current edited master.');
  expect(() => recordCreatorSkillIndependentFinding(item, { ...finding, masterMd5: '' })).toThrow('Hash the rendered master');
});

it('blocks signoff and publishing when automated QA fails or belongs to another master', () => {
  const hash = 'a'.repeat(32);
  const item = { ...parseCreatorSkillPackage(base).package!, automatedQa: { masterMd5: hash, blockers: ['Brief visual flash near 2.00s.'] } };
  expect(creatorSkillPublishBlockers(item, hash)).toContain('Brief visual flash near 2.00s.');
  expect(() => recordCreatorSkillIndependentSignoff(item, { reviewer: 'Alex', note: 'Watched the complete master and checked every frame.', masterMd5: hash })).toThrow('Resolve automated QA');
  const cleared = { ...item, automatedQa: { masterMd5: hash, blockers: [] } };
  const signed = recordCreatorSkillIndependentSignoff(cleared, { reviewer: 'Alex', note: 'Watched the complete master and checked every frame.', masterMd5: hash });
  expect(creatorSkillPublishBlockers(signed, hash)).toEqual([]);
  expect(creatorSkillPublishBlockers(signed, 'b'.repeat(32))).toContain('Automated QA belongs to a different edited master.');
});

it('blocks an edited master while a claim or footage review needs changes', () => {
  const item = parseCreatorSkillPackage({ ...base, claims: [{ time: 1, text: 'A claim', verdict: 'unconfirmed', sourceUrl: 'https://example.com/report', onScreenLabel: 'Unconfirmed: A claim' }], footageReview: [{ start: 0, end: 2, show: 'Camera', hide: [], note: 'Check frame' }] }).package!;
  expect(creatorSkillPublishBlockers(item, 'a'.repeat(32))).toEqual(expect.arrayContaining([expect.stringContaining('Claim 1 still needs'), expect.stringContaining('Footage range 1 still needs')]));
  expect(() => recordCreatorSkillIndependentSignoff(item, { reviewer: 'Alex', note: 'Watched the complete master and checked every frame.', masterMd5: 'a'.repeat(32) })).toThrow('complete every required');
  const claim = recordCreatorSkillClaimReview(item, 0, 'needs_changes', 'The claim needs a dated source.');
  const footage = recordCreatorSkillFootageReview(claim, 0, 'needs_changes', 'A private notification is visible.');
  expect(creatorSkillPublishBlockers(footage, 'a'.repeat(32))).toHaveLength(4);
  const checked = { ...recordCreatorSkillFootageReview(recordCreatorSkillClaimReview(footage, 0, 'source_checked', 'Checked a dated official report.'), 0, 'frame_checked', 'Inspected the changed frame and transitions.'), automatedQa: { masterMd5: 'a'.repeat(32), blockers: [] } };
  const signed = recordCreatorSkillIndependentSignoff(checked, { reviewer: 'Alex', note: 'Watched the complete master against Raw and checked all sources.', masterMd5: 'a'.repeat(32) });
  expect(creatorSkillPublishBlockers(signed, 'a'.repeat(32))).toEqual([]);
});

it('permits a reviewed neutral label for a claim with no available source', () => {
  const item = parseCreatorSkillPackage({ ...base, claims: [{ time: 1, text: 'A rumor', verdict: 'rumor', onScreenLabel: 'Rumor, not confirmed' }] }).package!;
  const checked = { ...recordCreatorSkillClaimReview(item, 0, 'label_checked', 'Checked that the rumor stays clearly labeled on screen.'), automatedQa: { masterMd5: 'a'.repeat(32), blockers: [] } };
  const signed = recordCreatorSkillIndependentSignoff(checked, { reviewer: 'Alex', note: 'Watched the complete master against Raw and checked its labels.', masterMd5: 'a'.repeat(32) });
  expect(creatorSkillPublishBlockers(signed, 'a'.repeat(32))).toEqual([]);
});

it('requires a source check for a verified claim even if an old label check is present', () => {
  const sourceUrl = 'https://example.com/report';
  const item = parseCreatorSkillPackage({ ...base, claims: [{ time: 1, text: 'A dated figure', verdict: 'verified', sourceUrl, publishedAt: '2026-11-01' }], sources: [{ url: sourceUrl, title: 'Report', publishedAt: '2026-11-01', retrievedAt: '2026-11-02' }] }).package!;
  const stale = { ...item, claimReviews: [{ claimIndex: 0, decision: 'label_checked' as const, note: 'Checked a prior uncertain label.', reviewedAt: '2026-11-02T00:00:00Z' }] };
  expect(creatorSkillPublishBlockers(stale, 'a'.repeat(32))).toContain('Claim 1 still needs a human source or neutral-label check.');
  expect(() => recordCreatorSkillIndependentSignoff(stale, { reviewer: 'Alex', note: 'Watched the complete master against Raw and checked its claim.', masterMd5: 'a'.repeat(32) })).toThrow('complete every required');
});
