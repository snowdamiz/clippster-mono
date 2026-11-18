import type { CreatorSkillPackage } from '@clippster/shared-types';

export const isCreatorSkillShortPlatform = (name: string) => /shorts?|reels?|tiktok|instagram|vertical/i.test(name);

/** Check deliverable structure without presenting AI copy or crop proposals as approved. */
export function auditCreatorSkillEditorialPackage(item: CreatorSkillPackage | undefined, sourceDuration: number, outputDuration: number): string[] {
  if (!item) return ['The playbook package is missing; review claims, footage, and posting copy before publishing.'];
  const issues: string[] = [];
  const longForm = sourceDuration >= 120;
  if (longForm && (outputDuration < 120 || outputDuration > 720)) issues.push(`Long-form output is ${outputDuration.toFixed(1)}s; review the 2–12 minute playbook range and segment choice.`);
  if (!longForm && outputDuration < 20) issues.push(`Short output is ${outputDuration.toFixed(1)}s; review the 20-second minimum and whether the thought is complete.`);
  if (!longForm && outputDuration > 70) issues.push(`Short output is ${outputDuration.toFixed(1)}s; review the 20–60 second stream Short or 45–70 second recorded Short target.`);
  const matchingCopy = item.platformCopy.filter(copy => longForm ? !isCreatorSkillShortPlatform(copy.platform) : isCreatorSkillShortPlatform(copy.platform));
  if (!matchingCopy.length) issues.push(`No ${longForm ? 'long-form' : 'Shorts'} posting copy was drafted for this clip.`);
  for (const copy of matchingCopy) {
    if (copy.title.length < 40 || copy.title.length > 55) issues.push(`${copy.platform} title is ${copy.title.length} characters; review the 40–55 character playbook target.`);
    if (!isCreatorSkillShortPlatform(copy.platform)) {
      if (copy.tags.length < 20 || copy.tags.length > 30) issues.push(`${copy.platform} has ${copy.tags.length} search tags; prepare 20–30 relevant phrases for upload.`);
      if (copy.tags.join(',').length > 500) issues.push(`${copy.platform} search tags exceed the 500-character upload limit.`);
    }
    if (!/(?:^|\n)\s*(?:#[\p{L}\p{N}_]+\s+){2}#[\p{L}\p{N}_]+\s*$/u.test(copy.description))
      issues.push(`${copy.platform} description needs three relevant hashtags at the end.`);
    if (/\b(?:TBD|TODO|placeholder)\b|\bX%/i.test(`${copy.title} ${copy.description} ${copy.pinnedComment} ${copy.tags.join(' ')}`))
      issues.push(`${copy.platform} posting copy contains placeholder text; replace it with reviewed facts before upload.`);
    if (longForm) {
      const chapters = [...copy.description.matchAll(/(?:^|\n)\s*(\d{1,2}):([0-5]\d)\s+\S[^\n]*/g)]
        .map(match => Number(match[1]) * 60 + Number(match[2]));
      if (chapters.length < 3 || chapters[0] !== 0 || chapters.some((time, index) => index > 0 && time - chapters[index - 1] < 10) || chapters[chapters.length - 1] > outputDuration - 10) {
        issues.push(`${copy.platform} long-form description needs at least three accurate chapters, starting at 0:00 and lasting at least 10 seconds each.`);
      }
    }
  }
  for (const [index, range] of (item.footageReview ?? []).entries()) {
    if (range.end > sourceDuration + 0.05) issues.push(`Footage crop proposal ${index + 1} ends beyond the source clip; correct its source-time range.`);
  }
  if (!item.footageReview?.length) issues.push('No clip-specific footage crop ranges were proposed; inspect the entire source and rendered edit for private material.');
  return issues;
}
