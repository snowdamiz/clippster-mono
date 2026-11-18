import type { EditDocument } from '../ai-video/types';

/** Flag presentation rules that can be checked from the saved final timeline. */
export function auditCreatorSkillPresentation(document: EditDocument, selectedOutroId?: string): string[] {
  const issues: string[] = [];
  const total = document.shots.reduce((sum, shot) => sum + shot.duration, 0);
  const finalWindow = Math.max(0, total - 1.5);
  if (document.format.height > document.format.width && !document.overlays.some(overlay =>
    overlay.start <= 0 && overlay.duration >= 0.5 && overlay.lane !== 'captions' && overlay.lane !== 'sponsor' &&
    /hook|title|headline/i.test(`${overlay.label} ${overlay.id}`))) {
    issues.push('The vertical clip has no readable hook title from frame 1; add and check one before publishing.');
  }
  if (selectedOutroId) {
    const ending = document.shots[document.shots.length - 1];
    if (ending?.mediaId !== selectedOutroId) issues.push('The selected creator outro is not the final shot; place it over or after the real sign-off before publishing.');
    else if (ending.duration < 1.5) issues.push('The selected creator outro lasts less than 1.5 seconds; inspect end-card readability.');
  }
  for (const overlay of document.overlays) {
    if (overlay.lane === 'captions' || overlay.lane === 'sponsor') continue;
    if (overlay.duration > 0 && overlay.duration < 0.5)
      issues.push(`${overlay.label || overlay.id} lasts less than 0.5 seconds; check it for a distracting flash or unreadable card.`);
    if (overlay.start > finalWindow && overlay.start < total) issues.push(`${overlay.label || overlay.id} begins in the final 1.5 seconds; review the ending for a new graphic or one-frame glimpse.`);
    if (overlay.start < total && overlay.start + overlay.duration > finalWindow && overlay.duration < 1.5)
      issues.push(`${overlay.label || overlay.id} is visible near the ending for less than 1.5 seconds; check final-stat readability.`);
  }
  const editorial = document.overlays.filter(overlay => overlay.lane === 'graphics' || overlay.lane === 'text')
    .map(overlay => ({ start: overlay.start, end: overlay.start + overlay.duration })).sort((a, b) => a.start - b.start);
  let coveredUntil = editorial[0]?.end ?? 0;
  for (const span of editorial.slice(1)) {
    const gap = span.start - coveredUntil;
    if (gap > 0 && gap <= 10 / document.format.fps)
      issues.push(`A ${Math.round(gap * document.format.fps)}-frame gap between editorial graphics near ${coveredUntil.toFixed(2)}s may reveal a camera glimpse; check the rendered frames.`);
    coveredUntil = Math.max(coveredUntil, span.end);
  }
  if (document.format.width > document.format.height && total > 20) {
    const boundaries = [0, total];
    let shotEnd = 0;
    for (const shot of document.shots) { shotEnd += shot.duration; boundaries.push(shotEnd); }
    for (const overlay of document.overlays) {
      if (overlay.lane === 'captions' || overlay.lane === 'sponsor') continue;
      boundaries.push(overlay.start, Math.min(total, overlay.start + overlay.duration));
    }
    const ordered = [...new Set(boundaries.filter(time => Number.isFinite(time) && time >= 0 && time <= total))].sort((a, b) => a - b);
    let pacingGaps = 0;
    for (let index = 1; index < ordered.length; index++) {
      if (ordered[index] - ordered[index - 1] > 8) {
        pacingGaps++;
        if (pacingGaps <= 12) issues.push(`No shot or editorial graphic changes from ${ordered[index - 1].toFixed(1)}s to ${ordered[index].toFixed(1)}s; review the long-form visual pacing.`);
      }
    }
    if (pacingGaps > 12) issues.push(`${pacingGaps - 12} additional long-form visual pacing gaps exceed 8 seconds; inspect the full timeline.`);
  }
  return issues;
}

/** Only objectively missing required elements block signoff; pacing and short cards remain review notes. */
export function creatorSkillPresentationBlockers(document: EditDocument, selectedOutroId?: string): string[] {
  return auditCreatorSkillPresentation(document, selectedOutroId).filter(issue =>
    issue.startsWith('The vertical clip has no readable hook title') ||
    issue.startsWith('The selected creator outro is not the final shot'));
}
