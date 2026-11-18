import type { CreatorSkillPackage } from './creatorSkill';

/** A later OK by the same reviewer at the same output time retracts a false alarm without erasing the log. */
export function creatorSkillUnresolvedFixes(item: CreatorSkillPackage | undefined, masterMd5: string | undefined): Array<NonNullable<CreatorSkillPackage['independentReview']>[number]> {
  if (!item || !masterMd5) return [];
  const current = (item.independentReview ?? []).filter(entry => entry.masterMd5 === masterMd5);
  return current.filter((entry, index) => entry.severity === 'fix_first' && !current.some((later, laterIndex) =>
    laterIndex > index && later.reviewer === entry.reviewer && Math.abs(later.outputTime - entry.outputTime) <= 0.05 && later.severity === 'ok'));
}

export function creatorSkillReviewBlockers(item: CreatorSkillPackage | undefined, masterMd5: string | undefined): string[] {
  if (!item) return ['The edited master has no saved playbook package.'];
  return [
    ...(!masterMd5 ? ['The edited master has no checksum for review.'] : []),
    ...(!item.automatedQa ? ['Automated QA has not completed for this edited master.']
      : item.automatedQa.masterMd5 !== masterMd5 ? ['Automated QA belongs to a different edited master.']
        : item.automatedQa.blockers),
    ...creatorSkillUnresolvedFixes(item, masterMd5).map(finding => `FIX FIRST at ${finding.outputTime.toFixed(2)}s: ${finding.finding}`),
    ...(item.claimReviews ?? []).filter(review => review.decision === 'needs_changes').map(review => `Claim ${review.claimIndex + 1} needs changes: ${review.note}`),
    ...(item.footageReviews ?? []).filter(review => review.decision === 'needs_changes').map(review => `Footage range ${review.footageIndex + 1} needs changes: ${review.note}`),
    ...item.claims.flatMap((claim, index) => {
      if (['opinion', 'prediction'].includes(claim.verdict)) return [];
      const review = item.claimReviews?.find(entry => entry.claimIndex === index);
      if (review?.decision === 'needs_changes') return [];
      const sourceChecked = review?.decision === 'source_checked' && !!claim.sourceUrl;
      const labelChecked = review?.decision === 'label_checked' && ['unconfirmed', 'rumor', 'not_found'].includes(claim.verdict) && !!claim.onScreenLabel;
      return sourceChecked || labelChecked ? [] : [`Claim ${index + 1} still needs a human source or neutral-label check.`];
    }),
    ...(item.footageReview ?? []).flatMap((_, index) => {
      const review = item.footageReviews?.find(entry => entry.footageIndex === index);
      return review?.decision === 'frame_checked' || review?.decision === 'needs_changes' ? [] : [`Footage range ${index + 1} still needs a human frame check.`];
    }),
  ];
}

export function creatorSkillPublishBlockers(item: CreatorSkillPackage | undefined, masterMd5: string | undefined): string[] {
  if (!item) return creatorSkillReviewBlockers(item, masterMd5);
  return [
    ...creatorSkillReviewBlockers(item, masterMd5),
    ...(!masterMd5 || item.independentSignoff?.masterMd5 !== masterMd5 ? ['An independent reviewer must sign off on the current edited master.'] : []),
  ];
}
