import type { EditDocument, EditOverlay } from '../ai-video/types';
import { creatorSkillCardComposition } from './creatorSkillCardComposition';

const ID = 'creator-skill-hook-title';
const PATH = `compositions/${ID}.html`;

/** Put a reviewable hook on frame one when the AI edit omitted its own. */
export function addCreatorSkillHookTitle(document: EditDocument, files: Record<string, string>): { document: EditDocument; files: Record<string, string>; added: boolean; reviewItems: string[] } {
  const unchanged = { document, files, added: false, reviewItems: [] as string[] };
  if (document.format.height <= document.format.width || document.overlays.some(overlay =>
    overlay.start <= 0 && overlay.duration >= 0.5 && overlay.lane !== 'captions' && overlay.lane !== 'sponsor' &&
    /hook|title|headline/i.test(`${overlay.label} ${overlay.id}`))) return unchanged;
  const title = document.title.replace(/[—–]/g, ':').replace(/\s+/g, ' ').trim();
  if (!title || title.length > 70 || /(?:\bX%|\bTBD\b|\bTODO\b)/i.test(title))
    return { ...unchanged, reviewItems: ['The AI edit has no usable first-frame hook title; write and verify one before publishing.'] };
  const total = document.shots.reduce((sum, shot) => sum + shot.duration, 0);
  const duration = Math.floor(Math.min(2.5, total) * document.format.fps) / document.format.fps;
  if (duration < 0.5 || document.overlays.some(overlay => overlay.id === ID) || PATH in files) return unchanged;
  const lane = (['text', 'graphics'] as const).find(candidate => document.overlays.every(overlay => overlay.lane !== candidate || overlay.start >= duration || overlay.start + overlay.duration <= 0));
  if (!lane) return { ...unchanged, reviewItems: ['Both graphic lanes cover frame 1; add a readable hook title to the existing design before publishing.'] };
  const overlay: EditOverlay = { id: ID, lane, start: 0, duration, label: `Hook title: ${title}`, composition: PATH, variables: { text: title } };
  return {
    document: { ...document, overlays: [...document.overlays, overlay] },
    files: { ...files, [PATH]: creatorSkillCardComposition(ID, title, document.format, 'top-left', { style: ';top:13%;left:5%;right:5%;max-width:90%;text-align:center;font-size:clamp(32px,5.5vw,76px)' }) },
    added: true,
    reviewItems: [`Verify the first-frame hook title against the spoken topic and cited sources: “${title}”.`],
  };
}
