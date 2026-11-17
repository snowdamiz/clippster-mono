import type { CreatorSkillSoundScan } from '@clippster/shared-types';

/** The classifier proposes listen points. It never authorizes muting or cutting speech. */
export function creatorSkillSoundScanReview(scan: CreatorSkillSoundScan | null, hasAudio: boolean): string[] {
  if (!hasAudio) return [];
  if (!scan) return ['Local AudioSet cough and throat-clear scan was unavailable; listen through the finished audio.'];
  return [
    ...(scan.findings.length
      ? scan.findings.map(event => `Possible ${event.label.toLowerCase()} near ${event.time.toFixed(2)}s (AudioSet score ${event.score.toFixed(2)}); listen and remove it only if every spoken word stays intact.`)
      : [`Local AudioSet scan covered ${scan.scannedSeconds.toFixed(1)}s and found no cough or throat-clear candidates; listen through the finished audio.`]),
    ...(scan.truncated ? ['AudioSet sound scan covered only the first 30 minutes; listen through the remaining audio.'] : []),
  ];
}
