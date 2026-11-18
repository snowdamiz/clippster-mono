import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { EditDocument, EditOverlay } from '../ai-video/types';
import { creatorSkillValidChapters } from './creatorSkillChapters';
import { creatorSkillCardComposition } from './creatorSkillCardComposition';

/** Add deterministic lower-third chapter cards to a long-form edit. */
export function addCreatorSkillChapterCards(document: EditDocument, files: Record<string, string>, item?: CreatorSkillPackage): { document: EditDocument; files: Record<string, string>; added: number; reviewItems: string[] } {
  const unchanged = { document, files, added: 0, reviewItems: [] as string[] };
  if (document.format.width <= document.format.height) return unchanged;
  const total = document.shots.reduce((sum, shot) => sum + shot.duration, 0);
  const chapters = creatorSkillValidChapters(item, total);
  if (!chapters) return unchanged;
  const overlays = [...document.overlays];
  const compositions = { ...files };
  const reviewItems: string[] = [];
  let added = 0;
  for (const [index, chapter] of chapters.entries()) {
    const id = `creator-skill-chapter-${index}`;
    const path = `compositions/${id}.html`;
    if (overlays.some(overlay => overlay.id === id) || path in compositions) continue;
    const start = Math.round(chapter.time * document.format.fps) / document.format.fps;
    const duration = Math.round(1.5 * document.format.fps) / document.format.fps;
    const lane = (['graphics', 'text'] as const).find(candidate => overlays.every(overlay => overlay.lane !== candidate || start >= overlay.start + overlay.duration || start + duration <= overlay.start));
    if (!lane) {
      reviewItems.push(`Chapter ${index + 1} at ${chapter.time}s could not fit on an overlay lane; add its card after checking the existing graphics.`);
      continue;
    }
    const label = `Chapter ${index + 1} · ${chapter.title}`;
    const overlay: EditOverlay = { id, lane, start, duration, label, composition: path, variables: { text: label } };
    overlays.push(overlay);
    compositions[path] = creatorSkillCardComposition(id, label, document.format, 'top-left', { style: ';top:auto;bottom:6%;max-width:78%;font-size:clamp(30px,3.2vw,62px)' });
    added++;
  }
  if (added) reviewItems.push('Review chapter cards against the spoken topic and timing in the finished long-form master.');
  return { document: { ...document, overlays }, files: compositions, added, reviewItems };
}
