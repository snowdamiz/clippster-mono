import type { CreatorSkillClaimEvidence, CreatorSkillPackage } from '@clippster/shared-types';

const STOP = new Set(['about', 'after', 'before', 'could', 'from', 'have', 'into', 'said', 'that', 'their', 'there', 'these', 'this', 'those', 'were', 'which', 'with', 'would']);
const terms = (text: string) => [...new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(token => token.length >= 4 && !STOP.has(token)))];
const numbers = (text: string) => [...new Set(text.match(/\b\d[\d,.]*(?:%|[KMB])?/gi)?.map(value => value.toLocaleLowerCase()) ?? [])];

/** Candidate passages are hints for a reviewer, never a fact-check verdict. */
export function creatorSkillClaimEvidence(
  item: CreatorSkillPackage,
  captures: Array<{ index: number; url: string; text: string }>,
): CreatorSkillClaimEvidence[] {
  const byUrl = new Map(captures.map(capture => [capture.url, capture]));
  return item.claims.flatMap((claim, claimIndex) => {
    const capture = claim.sourceUrl ? byUrl.get(claim.sourceUrl) : undefined;
    if (!capture) return [];
    const wanted = terms(claim.text);
    const requiredNumbers = numbers(claim.text);
    if (!wanted.length && !requiredNumbers.length) return [];
    const body = capture.text.split(/\r?\n\r?\n/).slice(1).join('\n\n');
    const passages = body.split(/\r?\n+/).map(part => part.trim()).filter(part => part.length >= 20 && part.length <= 3000);
    const ranked = passages.map(excerpt => {
      const found = new Set(terms(excerpt));
      const matchedTerms = wanted.filter(term => found.has(term)).length;
      const seenNumbers = new Set(numbers(excerpt));
      const allNumbersMatch = requiredNumbers.every(number => seenNumbers.has(number));
      return { excerpt, matchedTerms, allNumbersMatch };
    }).filter(candidate => candidate.allNumbersMatch && candidate.matchedTerms >= (requiredNumbers.length ? 1 : Math.min(3, wanted.length)) && candidate.matchedTerms / Math.max(1, wanted.length) >= 0.4)
      .sort((a, b) => b.matchedTerms - a.matchedTerms || a.excerpt.length - b.excerpt.length);
    const best = ranked[0];
    if (!best) return [];
    return [{ claimIndex, captureIndex: capture.index, excerpt: best.excerpt.slice(0, 600), matchedTerms: best.matchedTerms }];
  });
}
