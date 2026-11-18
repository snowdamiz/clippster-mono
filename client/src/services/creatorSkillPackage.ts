import { z } from 'zod';
import type { CreatorSkillPackage, CreatorSkillPreferences } from '@clippster/shared-types';
import { creatorSkillReviewBlockers } from './creatorSkillReview';

const text = (max: number) => z.string().trim().min(1).max(max);
const url = z.string().url().refine((value) => /^https:\/\//i.test(value), 'Use an HTTPS source URL');
const discountClaim = /\bdiscount\b|\b(?:save|off)\s+\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*%\s*(?:off|discount)/i;
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function mentionsSponsorDiscount(value: string, sponsorName: string): boolean {
  if (!discountClaim.test(value)) return false;
  const name = escapePattern(sponsorName.trim());
  return Boolean(name) && new RegExp(`(?:${name}.{0,120}(?:${discountClaim.source})|(?:${discountClaim.source}).{0,120}${name})`, 'i').test(value);
}

const schema = z.object({
  funnel: z.object({
    stage: z.enum(['reach', 'trust', 'sponsor', 'creator_product']),
    reason: text(500),
    bridge: text(500).optional(),
    metric: text(150),
  }),
  claims: z.array(z.object({
    time: z.number().finite().nonnegative(),
    text: text(1000),
    verdict: z.enum(['verified', 'partial', 'unconfirmed', 'rumor', 'opinion', 'prediction', 'not_found']),
    sourceUrl: url.optional(),
    publishedAt: text(80).optional(),
    onScreenLabel: text(250).optional(),
  })).max(100),
  sources: z.array(z.object({
    url,
    title: text(300),
    publishedAt: text(80).optional(),
    retrievedAt: text(80),
  })).max(100),
  brandReferences: z.array(z.object({
    name: text(150),
    sourceUrl: url,
    logoUrl: url.optional(),
    colors: z.array(text(80)).max(10),
    notes: text(500),
  })).max(20).default([]),
  footageReview: z.array(z.object({
    start: z.number().finite().nonnegative(),
    end: z.number().finite().positive(),
    crop: z.object({
      x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1),
      width: z.number().finite().positive().max(1), height: z.number().finite().positive().max(1),
    }).optional(),
    show: text(300), hide: z.array(text(200)).max(20), note: text(500),
  })).max(100).default([]),
  sponsors: z.array(z.object({
    name: text(150),
    confirmed: z.boolean(),
    referralUrl: url.optional(),
    code: text(100).optional(),
    disclosure: text(500).optional(),
    review: text(500).optional(),
  })).max(20),
  thumbnailConcepts: z.array(text(500)).min(1).max(10),
  thumbnailHeadlines: z.array(text(80).refine(value => value.split(/\s+/).length >= 2 && value.split(/\s+/).length <= 4 && !/\d/.test(value), 'Use 2 to 4 words and no unverified numbers')).min(2).max(4),
  chapters: z.array(z.object({ time: z.number().finite().nonnegative(), title: text(120) })).max(20).default([]),
  platformCopy: z.array(z.object({
    platform: text(80), title: text(250), description: text(3000), tags: z.array(text(80)).max(30), pinnedComment: text(1000),
  })).min(1).max(20),
  reviewItems: z.array(text(500)).max(100),
});

/** Validate the agent's proposed research package before storing it with the editable clip. */
export function parseCreatorSkillPackage(value: unknown): { package?: CreatorSkillPackage; error?: string } {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return { error: parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') };
  }
  const result = parsed.data;
  if (result.footageReview.some(entry => entry.end <= entry.start || entry.crop && (entry.crop.x + entry.crop.width > 1 || entry.crop.y + entry.crop.height > 1))) {
    return { error: 'Footage review ranges and normalized crop rectangles must stay inside the source video.' };
  }
  if (result.funnel.stage === 'reach' && !result.funnel.bridge) {
    return { error: 'A reach clip needs a bridge to a trust or conversion stage.' };
  }
  if (result.platformCopy.some((copy) => /\u2014/.test(`${copy.title}${copy.description}${copy.pinnedComment}${copy.tags.join('')}`))) {
    return { error: 'Platform copy must not contain em dashes.' };
  }
  if (result.chapters.some(chapter => /\u2014/.test(chapter.title))) return { error: 'Chapter titles must not contain em dashes.' };
  const knownSources = new Map(result.sources.map((source) => [source.url, source]));
  for (const claim of result.claims) {
    const source = claim.sourceUrl ? knownSources.get(claim.sourceUrl) : undefined;
    if (['verified', 'partial'].includes(claim.verdict) &&
        (!source || !claim.publishedAt || !source.publishedAt || claim.publishedAt !== source.publishedAt)) {
      return { error: 'Verified or partial claims need a dated source URL with a matching publication date in sources.' };
    }
    if (claim.verdict !== 'verified' && !claim.onScreenLabel) {
      return { error: 'Uncertain, opinion, rumor, and prediction claims need an on-screen label.' };
    }
  }
  return { package: result };
}

/** Only a saved creator agreement can confirm a sponsor or supply its terms. */
export function reconcileCreatorSkillSponsors(
  item: CreatorSkillPackage,
  preferences?: CreatorSkillPreferences,
): CreatorSkillPackage {
  const confirmed = new Map((preferences?.sponsors ?? []).map((sponsor) => [sponsor.name.trim().toLocaleLowerCase(), sponsor]));
  const sponsors = item.sponsors.map((sponsor) => {
    const key = sponsor.name.trim().toLocaleLowerCase();
    const saved = confirmed.get(key);
    return saved
      ? { name: saved.name, confirmed: true, referralUrl: saved.referralUrl, code: saved.code, disclosure: saved.disclosure, riskLine: saved.riskLine, platforms: saved.platforms, discountInDescriptionAllowed: saved.discountInDescriptionAllowed, review: [sponsor.review, 'Confirm this clip is covered by the saved sponsorship agreement.'].filter(Boolean).join(' ') }
      : { name: sponsor.name, confirmed: false, review: sponsor.review || 'Mentioned brand; no sponsorship is recorded in the creator profile.' };
  });
  const unapprovedReferralLinks = new Set(item.sponsors
    .filter(sponsor => sponsor.referralUrl && sponsor.referralUrl !== confirmed.get(sponsor.name.trim().toLocaleLowerCase())?.referralUrl)
    .map(sponsor => sponsor.referralUrl));
  const allowedLinks = new Set([
    ...(preferences?.sponsors ?? []).map(sponsor => sponsor.referralUrl),
    preferences?.brand?.companyUrl,
    ...item.sources.map(source => source.url).filter(url => !unapprovedReferralLinks.has(url)),
  ].filter((value): value is string => Boolean(value)));
  const unsavedCodes = item.sponsors
    .filter(sponsor => sponsor.code && sponsor.code !== confirmed.get(sponsor.name.trim().toLocaleLowerCase())?.code)
    .map(sponsor => sponsor.code)
    .filter((value): value is string => Boolean(value && value.length >= 3));
  let removedTerms = false;
  let removedDiscounts = false;
  const platformWarnings: string[] = [];
  const clean = (value: string, blockedLinks: Set<string>, blockedCodes: string[]): string => {
    const withoutLinks = value.replace(/https?:\/\/[^\s<>"']+/gi, match => {
      const trailing = match.match(/[.,!?;:]+$/)?.[0] ?? '';
      const link = match.slice(0, match.length - trailing.length);
      if (allowedLinks.has(link) && !blockedLinks.has(link)) return match;
      removedTerms = true;
      return trailing;
    });
    return [...unsavedCodes, ...blockedCodes].reduce((text, code) => {
      if (!text.toLocaleLowerCase().includes(code.toLocaleLowerCase())) return text;
      removedTerms = true;
      return text.replace(new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    }, withoutLinks).replace(/ {2,}/g, ' ').trim();
  };
  const platformCopy = item.platformCopy.map(copy => {
    const platform = copy.platform.toLocaleLowerCase().replace(/\s+/g, '');
    const restricted = sponsors.filter(sponsor => sponsor.confirmed && sponsor.platforms?.length &&
      !sponsor.platforms.some(allowed => {
        const name = allowed.toLocaleLowerCase().replace(/\s+/g, '');
        return platform.includes(name) || name.includes(platform);
      }));
    for (const sponsor of restricted) platformWarnings.push(`${sponsor.name} is not approved for ${copy.platform}; remove its CTA from the video before publishing on that platform.`);
    const blockedLinks = new Set(restricted.map(sponsor => sponsor.referralUrl).filter((value): value is string => Boolean(value)));
    const blockedCodes = restricted.map(sponsor => sponsor.code).filter((value): value is string => Boolean(value && value.length >= 3));
    const approvedDiscounts = sponsors.filter(sponsor => sponsor.confirmed && sponsor.discountInDescriptionAllowed);
    const clearDiscount = (value: string, allowDescription: boolean): string => {
      if (sponsors.some(sponsor => mentionsSponsorDiscount(value, sponsor.name) &&
          (!allowDescription || !approvedDiscounts.includes(sponsor)))) {
        removedDiscounts = true;
        return '';
      }
      return value;
    };
    return {
      ...copy,
      title: clearDiscount(clean(copy.title, blockedLinks, blockedCodes), false),
      description: clearDiscount(clean(copy.description, blockedLinks, blockedCodes), true),
      tags: copy.tags.map(tag => clearDiscount(clean(tag, blockedLinks, blockedCodes), false)).filter(Boolean),
      pinnedComment: clearDiscount(clean(copy.pinnedComment, blockedLinks, blockedCodes), false),
    };
  });
  return { ...item, sponsors, platformCopy, reviewItems: [
    ...item.reviewItems,
    ...(removedTerms ? ['Unconfirmed or platform-restricted links or referral codes were removed from posting copy. Check the final copy and saved sponsor terms before publishing.'] : []),
    ...(removedDiscounts ? ['Sponsor discount wording was removed from posting copy where the saved agreement did not allow it. Rewrite any empty fields before publishing.'] : []),
    ...platformWarnings,
  ] };
}

/** A page-fetch count cannot prove that any particular cited URL supports a claim. */
export function reconcileCreatorSkillResearch(item: CreatorSkillPackage, researchFetches: number): CreatorSkillPackage {
  let downgraded = false;
  const claims = item.claims.map((claim) => {
    if (claim.verdict !== 'verified' && claim.verdict !== 'partial') return claim;
    downgraded = true;
    return { ...claim, verdict: 'unconfirmed' as const, onScreenLabel: 'Unconfirmed: verify the cited source' };
  });
  return downgraded
    ? { ...item, claims, reviewItems: [...item.reviewItems, researchFetches > 0
      ? 'Page retrievals were reported, but none were linked to individual citations. Verify each claim and publication date before calling it confirmed.'
      : 'No web page retrievals were reported. Verify every proposed source before publishing.'] }
    : item;
}

/** Record a human source check without changing the AI claim verdict or rendered label. */
export function recordCreatorSkillClaimReview(
  item: CreatorSkillPackage,
  claimIndex: number,
  decision: 'source_checked' | 'label_checked' | 'needs_changes',
  note: string,
  reviewedAt = new Date().toISOString(),
): CreatorSkillPackage {
  if (!Number.isSafeInteger(claimIndex) || claimIndex < 0 || claimIndex >= item.claims.length) throw new Error('Choose a valid claim.');
  if (decision !== 'source_checked' && decision !== 'label_checked' && decision !== 'needs_changes') throw new Error('Choose a valid review decision.');
  const detail = note.trim();
  if (detail.length < 10 || detail.length > 1000) throw new Error('Add a review note of 10 to 1000 characters.');
  if (decision === 'source_checked' && !item.claims[claimIndex].sourceUrl) throw new Error('A source URL is required before marking a claim source checked.');
  if (decision === 'label_checked' && (!['unconfirmed', 'rumor', 'not_found'].includes(item.claims[claimIndex].verdict) || !item.claims[claimIndex].onScreenLabel))
    throw new Error('A neutral on-screen label is required for a label check.');
  const previous = item.claimReviews ?? [];
  return { ...item, independentSignoff: undefined, claimReviews: [
    ...previous.filter(review => review.claimIndex !== claimIndex),
    { claimIndex, decision, note: detail, reviewedAt },
  ].sort((a, b) => a.claimIndex - b.claimIndex) };
}

/** Record a human inspection of the proposed crop and its rendered transition frames. */
export function recordCreatorSkillFootageReview(
  item: CreatorSkillPackage,
  footageIndex: number,
  decision: 'frame_checked' | 'needs_changes',
  note: string,
  reviewedAt = new Date().toISOString(),
): CreatorSkillPackage {
  if (!Number.isSafeInteger(footageIndex) || footageIndex < 0 || footageIndex >= (item.footageReview?.length ?? 0)) throw new Error('Choose a valid footage range.');
  if (decision !== 'frame_checked' && decision !== 'needs_changes') throw new Error('Choose a valid footage review decision.');
  const detail = note.trim();
  if (detail.length < 10 || detail.length > 1000) throw new Error('Add a review note of 10 to 1000 characters.');
  return { ...item, independentSignoff: undefined, footageReviews: [
    ...(item.footageReviews ?? []).filter(review => review.footageIndex !== footageIndex),
    { footageIndex, decision, note: detail, reviewedAt },
  ].sort((a, b) => a.footageIndex - b.footageIndex) };
}

/** Append a review finding tied to the exact rendered master inspected. */
export function recordCreatorSkillIndependentFinding(
  item: CreatorSkillPackage,
  finding: { reviewer: string; severity: 'fix_first' | 'should_fix' | 'ok'; outputTime: number; finding: string; masterMd5: string },
  reviewedAt = new Date().toISOString(),
): CreatorSkillPackage {
  const reviewer = finding.reviewer.trim();
  const detail = finding.finding.trim();
  if (reviewer.length < 2 || reviewer.length > 100) throw new Error('Enter the reviewer’s name (2 to 100 characters).');
  if (!['fix_first', 'should_fix', 'ok'].includes(finding.severity)) throw new Error('Choose FIX FIRST, SHOULD FIX, or OK.');
  if (!Number.isFinite(finding.outputTime) || finding.outputTime < 0) throw new Error('Enter a valid output time in seconds.');
  if (detail.length < 10 || detail.length > 2000) throw new Error('Describe the evidence and correction in 10 to 2000 characters.');
  if (!/^[a-f0-9]{32}$/i.test(finding.masterMd5)) throw new Error('Hash the rendered master before recording a review.');
  return { ...item, independentSignoff: item.independentSignoff?.masterMd5 === finding.masterMd5.toLowerCase() ? undefined : item.independentSignoff,
    independentReview: [...(item.independentReview ?? []), { reviewer, severity: finding.severity, outputTime: finding.outputTime, finding: detail, masterMd5: finding.masterMd5.toLowerCase(), reviewedAt }] };
}

/** Sign off only after the separate reviewer has inspected the complete current master. */
export function recordCreatorSkillIndependentSignoff(
  item: CreatorSkillPackage,
  input: { reviewer: string; note: string; masterMd5: string },
  reviewedAt = new Date().toISOString(),
): CreatorSkillPackage {
  const reviewer = input.reviewer.trim();
  const note = input.note.trim();
  if (reviewer.length < 2 || reviewer.length > 100) throw new Error('Enter the reviewer’s name (2 to 100 characters).');
  if (note.length < 20 || note.length > 2000) throw new Error('Describe the full-master review in 20 to 2000 characters.');
  if (!/^[a-f0-9]{32}$/i.test(input.masterMd5)) throw new Error('Hash the edited master before signoff.');
  if (creatorSkillReviewBlockers(item, input.masterMd5).length)
    throw new Error('Resolve automated QA and FIX FIRST findings, and complete every required claim source and footage frame check before signoff.');
  return { ...item, independentSignoff: { reviewer, note, masterMd5: input.masterMd5.toLowerCase(), reviewedAt } };
}

