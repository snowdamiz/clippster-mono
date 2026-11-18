import type { CreatorSkillPackage } from '@clippster/shared-types';
import { isCreatorSkillShortPlatform } from './creatorSkillEditorialAudit';

const chapterLine = /^\s*\d{1,2}:\d{2}(?::\d{2})?\s+\S/;
const chapterHeading = /^\s*chapters?\s*:?[\s]*$/i;
const laterSection = /^\s*(?:ad\s*:|sponsors?\s*:|disclosures?\s*:|sources?\s*:)/i;
const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Place AI-proposed chapter titles only after their times fit the actual rendered long-form clip. */
export function creatorSkillValidChapters(item: CreatorSkillPackage | undefined, duration: number): NonNullable<CreatorSkillPackage['chapters']> | null {
  if (!item) return null;
  const existingCopy = item.platformCopy.find(copy => !isCreatorSkillShortPlatform(copy.platform));
  const fromDescription = existingCopy?.description.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*(\d{1,2}):([0-5]\d)\s+(.+)$/);
    return match ? [{ time: Number(match[1]) * 60 + Number(match[2]), title: match[3].replace(/^[-–]\s*/, '').trim() }] : [];
  }) ?? [];
  const proposed = item.chapters?.length ? item.chapters : fromDescription;
  const chapters = proposed.map(chapter => ({ time: Math.floor(chapter.time), title: chapter.title.trim() })).sort((a, b) => a.time - b.time);
  if (chapters.length < 3 || !Number.isFinite(duration) || chapters[0]?.time !== 0 ||
      chapters.some((chapter, index) => !Number.isFinite(chapter.time) || chapter.time < 0 || chapter.time > duration - 10 ||
        !chapter.title || chapter.title.length > 70 || /\u2014|\b(?:placeholder|tbd)\b/i.test(chapter.title) || index > 0 && chapter.time - chapters[index - 1].time < 10)) {
    return null;
  }
  return chapters;
}

/** Place AI-proposed chapter titles only after their times fit the actual rendered long-form clip. */
export function finalizeCreatorSkillChapters(item: CreatorSkillPackage | undefined, duration: number): { item?: CreatorSkillPackage; reviewItems: string[] } {
  if (!item) return { reviewItems: [] };
  const chapters = creatorSkillValidChapters(item, duration);
  if (!chapters) return { item, reviewItems: ['The AI did not provide three valid long-form chapters tied to the final duration; write and check the chapter titles and times against the finished video.'] };
  const block = ['Chapters', ...chapters.map(chapter => `${timeLabel(chapter.time)} ${chapter.title}`)];
  const platformCopy = item.platformCopy.map(copy => {
    if (isCreatorSkillShortPlatform(copy.platform)) return copy;
    const lines = copy.description.split(/\r?\n/).filter(line => !chapterLine.test(line) && !chapterHeading.test(line));
    const insert = lines.findIndex(line => laterSection.test(line));
    lines.splice(insert < 0 ? lines.length : insert, 0, ...block, '');
    return { ...copy, description: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() };
  });
  return { item: { ...item, chapters, platformCopy }, reviewItems: ['Review each proposed chapter title and start time against the finished long-form video before publishing.'] };
}
