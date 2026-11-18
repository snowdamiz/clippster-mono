import { expect, it } from 'vitest';
import type { EditDocument, EditOverlay } from '../ai-video/types';
import { creatorSkillCaptionTiming, hasCreatorSkillAiCaptions, prepareCreatorSkillAiCaptions } from './creatorSkillAiCaptions';

const caption: EditOverlay = { id: 'c1', lane: 'captions', start: .2, duration: 1, label: 'Hello world', composition: 'compositions/caption.html', variables: { color: '#abc', size: 72 } };
const doc = (overlays: EditOverlay[]) => ({ overlays } as EditDocument);

it('preserves AI caption design, variables, timing, and composition code', () => {
  const document = doc([caption]);
  const files = { [caption.composition]: '<div>AI design and animation</div>' };
  const result = prepareCreatorSkillAiCaptions(document, files);
  expect(result.changed).toBe(false);
  expect(result.document).toBe(document);
  expect(result.files).toBe(files);
});

it('removes only the old app track and migrates AI text-lane captions without restyling', () => {
  const old = { ...caption, id: 'creator-skill-captions', composition: 'compositions/creator-skill-captions.html' };
  const title = { ...caption, id: 'title', lane: 'text' as const, composition: 'compositions/title.html' };
  const result = prepareCreatorSkillAiCaptions(doc([{ ...caption, lane: 'text' }, old, title]), { [old.composition]: 'old', [caption.composition]: 'AI', [title.composition]: 'title' });
  expect(result.document.overlays).toEqual([caption, title]);
  expect(result.files).toEqual({ [caption.composition]: 'AI', [title.composition]: 'title' });
  expect(hasCreatorSkillAiCaptions(result.document)).toBe(true);
  expect(hasCreatorSkillAiCaptions(doc([old, title]))).toBe(false);
});

it('supplies exact word timing without selecting caption styling', () => {
  const timing = creatorSkillCaptionTiming([{ text: 'Hello', start: .123, end: .456, speakerId: null }]);
  expect(timing).toContain('"start":0.123,"end":0.456,"text":"Hello"');
  expect(timing).toContain('(word time - sourceIn) / speed');
});
