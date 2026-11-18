import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { EditDocument } from '../ai-video/types';

const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Check that a proposed spoken-claim label is placed over the corresponding source moment. */
export function auditCreatorSkillLabels(
  document: EditDocument,
  sourceMediaId: string,
  item?: CreatorSkillPackage,
  compositions: Record<string, string> = {},
): string[] {
  if (!item?.claims.length) return [];
  const issues: string[] = [];
  let outputStart = 0;
  const sourceSpans = document.shots.flatMap(shot => {
    const start = outputStart;
    outputStart += shot.duration;
    return shot.mediaId === sourceMediaId ? [{ shot, start }] : [];
  });
  for (const claim of item.claims) {
    if (claim.verdict === 'opinion') continue;
    const span = sourceSpans.find(({ shot }) => claim.time >= shot.sourceIn && claim.time < shot.sourceIn + shot.duration * shot.speed);
    if (!span) continue; // The source moment was not included in this edit.
    const label = normalize(claim.onScreenLabel ?? '');
    if (!label) {
      const outputTime = span.start + (claim.time - span.shot.sourceIn) / span.shot.speed;
      if (!document.overlays.some(overlay => outputTime >= overlay.start && outputTime < overlay.start + overlay.duration && overlay.variables.creatorSkillClaimTime === claim.time))
        issues.push(`Claim at ${claim.time.toFixed(1)}s has no proposed on-screen label; add a neutral label or source card.`);
      continue;
    }
    const outputTime = span.start + (claim.time - span.shot.sourceIn) / span.shot.speed;
    const overlayMatches = document.overlays.filter(overlay =>
      outputTime >= overlay.start && outputTime < overlay.start + overlay.duration &&
      (overlay.variables.creatorSkillClaimTime === claim.time ||
        normalize(`${overlay.label} ${Object.values(overlay.variables).join(' ')} ${compositions[overlay.composition] ?? ''}`).includes(label)));
    if (!overlayMatches.length) issues.push(`No matching on-screen label for claim at source ${claim.time.toFixed(1)}s (output ${outputTime.toFixed(1)}s): ${claim.onScreenLabel}.`);
    else if (claim.sourceUrl && claim.publishedAt && !overlayMatches.some(overlay => `${overlay.label} ${compositions[overlay.composition] ?? ''}`.includes(claim.publishedAt!.slice(0, 10))))
      issues.push(`Source date is not visible for claim at source ${claim.time.toFixed(1)}s (output ${outputTime.toFixed(1)}s); show the reported date on the source card.`);
  }
  return issues;
}
