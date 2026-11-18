import type { EditDocument } from '../ai-video/types';

type Range = { start: number; end: number };

/** Source ranges omitted by the edited video lane. */
export function creatorSkillRemovedRanges(document: EditDocument, sourceMediaId: string, sourceDuration: number): Range[] {
  const spans = document.shots.filter(shot => shot.mediaId === sourceMediaId && !shot.scene && shot.speed > 0)
    .map(shot => ({ start: Math.max(0, shot.sourceIn), end: Math.min(sourceDuration, shot.sourceIn + shot.duration * shot.speed) }))
    .sort((a, b) => a.start - b.start);
  const removed: Range[] = [];
  let covered = 0;
  for (const span of spans) {
    if (span.start > covered + 0.005) removed.push({ start: covered, end: span.start });
    covered = Math.max(covered, span.end);
  }
  // Video ends on a frame boundary while container audio duration can include
  // a partial final frame. Do not classify that rounding tail as an edit cut.
  // Internal gaps retain the strict 5 ms threshold above.
  const fps = document.format?.fps;
  const endTolerance = Number.isFinite(fps) && fps > 0 ? 1 / fps : 0.005;
  if (sourceDuration > covered + endTolerance + 1e-6) removed.push({ start: covered, end: sourceDuration });
  return removed;
}

/** Compare FFmpeg's 5 ms silence detection with each deleted source range. */
export function auditCreatorSkillRemovedAudio(
  document: EditDocument,
  sourceMediaId: string,
  sourceDuration: number,
  silenceLog: string,
): string[] {
  const removed = creatorSkillRemovedRanges(document, sourceMediaId, sourceDuration);
  if (!removed.length) return [];
  const starts = [...silenceLog.matchAll(/silence_start:\s*(-?\d+(?:\.\d+)?)/g)].map(match => Number(match[1]));
  const ends = [...silenceLog.matchAll(/silence_end:\s*(-?\d+(?:\.\d+)?)/g)].map(match => Number(match[1]));
  const silence = starts.map((start, index) => ({ start: Math.max(0, start), end: ends[index] ?? sourceDuration }));
  if (!silence.length) return [`Removed source audio was not quiet: ${removed.length} range${removed.length === 1 ? '' : 's'} need speech review.`];
  const risky = removed.filter(gap => {
    const quiet = silence.reduce((total, span) => total + Math.max(0, Math.min(gap.end, span.end) - Math.max(gap.start, span.start)), 0);
    return gap.end - gap.start - quiet > 0.01;
  });
  return risky.length ? [`${risky.length} removed source range${risky.length === 1 ? '' : 's'} ${risky.length === 1 ? 'contains' : 'contain'} audio above -50 dB: ${risky.slice(0, 5).map(gap => `${gap.start.toFixed(2)}-${gap.end.toFixed(2)}s`).join(', ')}. Restore speech or inspect each cut.`] : [];
}
