import type { EditDocument, SpeechSegment } from '@/ai-video/types';

/** Check whether every timed source word remains inside footage ranges in the proposed timeline. */
export function auditCreatorSkillWordCoverage(
  document: EditDocument,
  sourceMediaId: string,
  words: SpeechSegment[],
): string[] {
  if (!words.length) return ['Word-level source timing is unavailable; compare the rendered speech with Raw.'];
  const ranges = document.shots
    .filter(shot => shot.mediaId === sourceMediaId && !shot.scene && shot.speed > 0)
    .map(shot => ({ start: shot.sourceIn, end: shot.sourceIn + shot.duration * shot.speed }))
    .sort((a, b) => a.start - b.start)
    .reduce<Array<{ start: number; end: number }>>((merged, range) => {
      const last = merged[merged.length - 1];
      if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
      else merged.push({ ...range });
      return merged;
    }, []);
  const missing = words.filter(word => {
    const span = word.end - word.start;
    if (span <= 0) return false;
    const covered = ranges.reduce((total, range) => total + Math.max(0, Math.min(word.end, range.end) - Math.max(word.start, range.start)), 0);
    return Math.min(span, covered) < span * 0.95;
  });
  if (!missing.length) return [];
  const examples = missing.slice(0, 5).map(word => `${word.start.toFixed(2)}s “${word.text}”`).join(', ');
  return [`The edited timeline may cut ${missing.length} transcribed word${missing.length === 1 ? '' : 's'}: ${examples}. Compare with Raw and restore any missing speech.`];
}

/** Structural speech-risk checks. Passing does not prove that a final audio diff passes. */
export function auditCreatorSkillSourceAudio(
  document: EditDocument,
  sourceMediaId: string,
  sourceDuration: number,
  hasAudio: boolean,
): string[] {
  if (!hasAudio) return [];
  const issues: string[] = [];
  if (document.clipAudio <= 0) issues.push('Source audio is muted in the edited timeline.');
  const shots = document.shots.filter((shot) => shot.mediaId === sourceMediaId && !shot.scene);
  if (!shots.length) return [...issues, 'The edited timeline contains no footage from the source clip.'];

  const tolerance = Math.max(0.12, 2 / document.format.fps);
  let coveredUntil = 0;
  let hasGap = false;
  let hasReorder = false;
  let hasSpeedChange = false;
  for (const shot of shots) {
    if (Math.abs(shot.speed - 1) > 0.001) hasSpeedChange = true;
    if (shot.sourceIn > coveredUntil + tolerance) hasGap = true;
    if (shot.sourceIn < coveredUntil - tolerance) hasReorder = true;
    coveredUntil = Math.max(coveredUntil, shot.sourceIn + shot.duration * shot.speed);
  }
  if (sourceDuration > coveredUntil + tolerance) hasGap = true;
  if (hasGap) issues.push('The edited timeline skips source audio ranges; compare every spoken word with Raw.');
  if (hasReorder) issues.push('The edited timeline repeats or reorders source footage; check speech meaning and flow.');
  if (hasSpeedChange) issues.push('The edited timeline changes source playback speed; check speech intelligibility.');
  return issues;
}

/** Reject an edit when measured evidence contradicts the keep-every-word rule. */
export function assertCreatorSkillSpeechPreserved(wordIssues: string[], removedAudioIssues: string[], sourceAudioIssues: string[] = [], preserveEveryWord = true): void {
  const lostWords = wordIssues.find(issue => issue.startsWith('The edited timeline may cut '));
  const audibleCut = removedAudioIssues.find(issue => /contains? audio above -50 dB/.test(issue));
  const missingSource = sourceAudioIssues.find(issue => issue === 'Source audio is muted in the edited timeline.' || issue === 'The edited timeline contains no footage from the source clip.');
  const failure = missingSource ?? (preserveEveryWord ? lostWords ?? audibleCut : undefined);
  if (failure) {
    throw new Error(`The AI edit failed the speech preservation check. ${failure} Raw remains available.`);
  }
}
