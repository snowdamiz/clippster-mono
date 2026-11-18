import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { EditDocument, SpeechSegment } from '../ai-video/types';

const namePattern = (name: string) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
const tiktokAllowed = (platforms?: string[]) => !platforms?.length || platforms.some(platform => /tiktok/i.test(platform));

export function creatorSkillTikTokRestrictedSponsors(item?: CreatorSkillPackage): string[] {
  return item?.sponsors.filter(sponsor => sponsor.confirmed && !tiktokAllowed(sponsor.platforms)).map(sponsor => sponsor.name) ?? [];
}

/** Cut before the first spoken mention of a confirmed sponsor excluded from TikTok. */
export function creatorSkillTikTokCut(
  document: EditDocument,
  sourceMediaId: string,
  speech: SpeechSegment[],
  item?: CreatorSkillPackage,
  files: Record<string, string> = {},
): { document?: EditDocument; reviewItems: string[]; excludedSponsors: string[] } {
  const restrictedNames = new Set(creatorSkillTikTokRestrictedSponsors(item));
  const restricted = item?.sponsors.filter(sponsor => restrictedNames.has(sponsor.name)) ?? [];
  if (!restricted.length) return { reviewItems: [], excludedSponsors: [] };
  const names = restricted.map(sponsor => sponsor.name);
  const mentions = speech.filter(segment => restricted.some(sponsor => namePattern(sponsor.name).test(segment.text)));
  if (!mentions.length) return { reviewItems: [`${names.join(', ')} is excluded from TikTok, but its read could not be located in the timed transcript; check the TikTok version manually.`], excludedSponsors: names };
  const mentionStart = Math.min(...mentions.map(segment => segment.start));
  const prelude = speech.filter(segment => segment.end <= mentionStart && mentionStart - segment.end <= 6 && /\b(sponsor|partner|ad|code|referral|link below)\b/i.test(segment.text));
  const firstMention = Math.min(mentionStart, ...prelude.map(segment => segment.start));
  let outputStart = 0;
  let outputCut: number | null = null;
  for (const shot of document.shots) {
    if (shot.mediaId === sourceMediaId && firstMention >= shot.sourceIn && firstMention < shot.sourceIn + shot.duration * shot.speed) {
      outputCut = outputStart + (firstMention - shot.sourceIn) / shot.speed;
      break;
    }
    outputStart += shot.duration;
  }
  if (outputCut === null) return { reviewItems: [`${names.join(', ')} is excluded from TikTok, but the sponsor read is not mapped to the edited timeline; inspect this clip before posting.`], excludedSponsors: names };
  const cut = Math.floor(Math.max(0, outputCut - 0.25) * document.format.fps) / document.format.fps;
  if (cut < 10) return { reviewItems: [`The ${names.join(', ')} read starts before a usable sponsor-free TikTok cut; do not post this edit to TikTok.`], excludedSponsors: names };
  const shots: EditDocument['shots'] = [];
  let cursor = 0;
  for (const shot of document.shots) {
    if (cursor >= cut) break;
    const duration = Math.min(shot.duration, cut - cursor);
    if (duration >= 0.1) shots.push({ ...shot, duration });
    cursor += shot.duration;
  }
  const overlays = document.overlays.filter(overlay => overlay.id !== 'creator-skill-sponsor-disclosure' && overlay.id !== 'creator-skill-captions' && overlay.start < cut)
    .map(overlay => ({ ...overlay, duration: Math.min(overlay.duration, cut - overlay.start) }))
    .filter(overlay => overlay.duration >= 0.1);
  const forbidden = restricted.flatMap(sponsor => [sponsor.name, sponsor.referralUrl, sponsor.code].filter((value): value is string => Boolean(value && value.length >= 3)));
  const renderedText = [
    ...shots.flatMap(shot => shot.scene ? [shot.scene.label, ...Object.values(shot.scene.variables ?? {}).map(String), files[shot.scene.composition] ?? ''] : []),
    ...overlays.flatMap(overlay => [overlay.label, ...Object.values(overlay.variables ?? {}).map(String), files[overlay.composition] ?? '']),
  ].join(' ').toLowerCase();
  if (forbidden.some(value => renderedText.includes(value.toLowerCase()))) {
    return { reviewItems: [`The proposed TikTok cut still contains ${names.join(', ')} sponsor text or graphics; remove them in the editor before posting.`], excludedSponsors: names };
  }
  return {
    document: { ...document, title: `${document.title} (TikTok sponsor-free)`, shots, overlays },
    reviewItems: [`TikTok cut ends before the saved ${names.join(', ')} sponsor read. Review the final frame, speech, captions, and platform terms before posting.`],
    excludedSponsors: names,
  };
}
