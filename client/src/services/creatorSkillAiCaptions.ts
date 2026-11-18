import type { EditDocument, EditOverlay, SpeechSegment } from '../ai-video/types';

const APP_CAPTION_ID = 'creator-skill-captions';
const APP_CAPTION_PATH = `compositions/${APP_CAPTION_ID}.html`;
const isAppCaption = (overlay: EditOverlay) => overlay.id === APP_CAPTION_ID || overlay.composition === APP_CAPTION_PATH;
const isCaption = (overlay: EditOverlay) => overlay.lane === 'captions' || /(?:^|[/_.-])(?:captions?|subtitles?)(?:[/_.-]|$)/i.test(overlay.composition);

export function hasCreatorSkillAiCaptions(document: EditDocument): boolean {
  return document.overlays.some(overlay => !isAppCaption(overlay) && isCaption(overlay));
}

/** Keep the authored design and animation intact; remove only the retired app-generated track. */
export function prepareCreatorSkillAiCaptions(document: EditDocument, files: Record<string, string>) {
  const overlays = document.overlays.filter(overlay => !isAppCaption(overlay))
    .map(overlay => isCaption(overlay) && overlay.lane !== 'captions' ? { ...overlay, lane: 'captions' as const } : overlay);
  const changed = overlays.length !== document.overlays.length || overlays.some((overlay, index) => overlay !== document.overlays[index]) || APP_CAPTION_PATH in files;
  const cleaned = { ...files };
  delete cleaned[APP_CAPTION_PATH];
  return { document: changed ? { ...document, overlays } : document, files: changed ? cleaned : files, changed };
}

/** Source-relative word times, supplied by the app; the AI maps them through its edit. */
export function creatorSkillCaptionTiming(words: SpeechSegment[]): string {
  if (!words.length) return 'Word timing is unavailable. Inspect speech timing and flag caption alignment for review; do not invent precise word times.';
  return `App-provided caption word timing in seconds relative to the source clip. Map through each shot: timeline start + (word time - sourceIn) / speed. Use these words for your single caption track; choose styling, cue breaks, emphasis and placement from the playbook. Timing data: ${JSON.stringify(words.map(({ start, end, text }) => ({ start, end, text })))}`;
}
