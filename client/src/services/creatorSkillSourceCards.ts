import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { EditDocument, EditOverlay } from '../ai-video/types';
import { auditCreatorSkillLabels } from './creatorSkillLabelAudit';
import { creatorSkillCardComposition } from './creatorSkillCardComposition';

const PATH_PREFIX = 'compositions/creator-skill-label-';
const neutralLabel = (verdict: CreatorSkillPackage['claims'][number]['verdict']) => ({
  opinion: 'Creator opinion', prediction: 'Prediction', rumor: 'Rumor, not confirmed',
  not_found: 'Source not found', partial: 'Unconfirmed: verify cited source',
  verified: 'Source cited', unconfirmed: 'Unconfirmed: verify cited source',
})[verdict];

function sourceLabel(claim: CreatorSkillPackage['claims'][number], capturedPages?: ReadonlySet<string>, capturedDates?: ReadonlyMap<string, string>): string {
  const neutral = neutralLabel(claim.verdict);
  if (!claim.sourceUrl) return claim.verdict === 'verified' ? 'Unconfirmed: verify cited source' : neutral;
  if (capturedPages && !capturedPages.has(claim.sourceUrl)) return 'Unconfirmed: cited source not captured';
  let host: string;
  try { host = new URL(claim.sourceUrl).hostname.replace(/^www\./, ''); }
  catch { return claim.verdict === 'verified' ? 'Unconfirmed: verify cited source' : neutral; }
  const pageDate = capturedDates?.get(claim.sourceUrl);
  const proposedDate = /^\d{4}-\d{2}-\d{2}/.test(claim.publishedAt ?? '') ? claim.publishedAt!.slice(0, 10) : undefined;
  const date = pageDate ? `Page date ${pageDate}` : proposedDate ? `Proposed date ${proposedDate}` : 'date unconfirmed';
  const mismatch = pageDate && proposedDate && pageDate !== proposedDate ? 'Unconfirmed: date mismatch · ' : '';
  return `${mismatch}${claim.verdict === 'verified' ? '' : `${neutral} · `}Source: ${host} · ${date}`;
}

/** Add conservative, editable source labels where the AI timeline omitted them. */
export function addCreatorSkillSourceCards(
  document: EditDocument,
  files: Record<string, string>,
  sourceMediaId: string,
  item?: CreatorSkillPackage,
  capturedPages?: ReadonlySet<string>,
  capturedDates?: ReadonlyMap<string, string>,
): { document: EditDocument; files: Record<string, string>; added: number; reviewItems: string[] } {
  if (!item?.claims.length) return { document, files, added: 0, reviewItems: [] };
  const overlays = [...document.overlays];
  const addedFiles = { ...files };
  const reviewItems: string[] = [];
  const existingIssues = auditCreatorSkillLabels(document, sourceMediaId, item, files);
  let outputStart = 0;
  const spans = document.shots.flatMap(shot => {
    const start = outputStart;
    outputStart += shot.duration;
    return shot.mediaId === sourceMediaId ? [{ shot, start }] : [];
  });
  let added = 0;
  for (const [index, claim] of item.claims.entries()) {
    if (claim.sourceUrl && capturedPages && !capturedPages.has(claim.sourceUrl)) reviewItems.push(`Could not capture cited source for claim at ${claim.time.toFixed(1)}s; inspect ${claim.sourceUrl} directly before publishing.`);
    if (!existingIssues.some(issue => issue.startsWith(`No matching on-screen label for claim at source ${claim.time.toFixed(1)}s `) || issue.startsWith(`Claim at ${claim.time.toFixed(1)}s has no proposed on-screen label`) || issue.startsWith(`Source date is not visible for claim at source ${claim.time.toFixed(1)}s `))) continue;
    const span = spans.find(({ shot }) => claim.time >= shot.sourceIn && claim.time < shot.sourceIn + shot.duration * shot.speed);
    if (!span) continue;
    const label = sourceLabel(claim, capturedPages, capturedDates);
    const claimOutput = span.start + (claim.time - span.shot.sourceIn) / span.shot.speed;
    const start = Math.floor(claimOutput * document.format.fps) / document.format.fps;
    const duration = Math.floor(Math.min(2, span.start + span.shot.duration - start) * document.format.fps) / document.format.fps;
    if (duration < 0.5) { reviewItems.push(`Could not place source label near output ${claimOutput.toFixed(1)}s; the source shot ends too soon.`); continue; }
    const lane = (['graphics', 'text'] as const).find(candidate => overlays.every(overlay => overlay.lane !== candidate || start >= overlay.start + overlay.duration || start + duration <= overlay.start));
    if (!lane) { reviewItems.push(`Could not place source label near output ${claimOutput.toFixed(1)}s; both overlay lanes are occupied.`); continue; }
    const id = `creator-skill-label-${index}`;
    const path = `${PATH_PREFIX}${index}.html`;
    if (overlays.some(overlay => overlay.id === id) || path in addedFiles) { reviewItems.push(`Could not place source label ${index + 1}; its editor identifier is already in use.`); continue; }
    const overlay: EditOverlay = { id, lane, start, duration, label, composition: path, variables: { text: label, creatorSkillClaimTime: claim.time } };
    overlays.push(overlay);
    addedFiles[path] = creatorSkillCardComposition(id, label, document.format, 'top-left');
    added++;
  }
  return { document: { ...document, overlays }, files: addedFiles, added, reviewItems };
}
