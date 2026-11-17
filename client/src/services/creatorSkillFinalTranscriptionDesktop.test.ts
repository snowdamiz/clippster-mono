import { expect, it, vi } from 'vitest';
import { transcribeCreatorSkillFinalAudio } from './creatorSkillFinalTranscriptionDesktop';

const post = vi.hoisted(() => vi.fn(async (_path: string, form: FormData) => {
  expect(form.get('free_single_clip')).toBe('true');
  expect(form.get('free_single_clip_total_duration')).toBe('45');
  return { data: { success: true, transcript: { words: [{ word: 'Hello', start: 0.1, end: 0.5 }] } } };
}));
vi.mock('@/services/api', () => ({ default: { post } }));
vi.mock('@/composables/useAudioChunking', () => ({ useAudioChunking: () => ({ extractAndChunkVideo: async () => ({ success: true, chunks: [{ start_time: 0, duration: 45, filename: 'audio.mp3' }] }) }) }));
vi.mock('@/utils/audioChunkFile', () => ({ audioChunkFile: () => new Blob(['audio'], { type: 'audio/mpeg' }) }));

it('transcribes the finished desktop clip through the no-personal-credit single-clip path', async () => {
  expect(await transcribeCreatorSkillFinalAudio('edited.mp4', 'clip', 45)).toEqual([{ word: 'Hello', start: 0.1, end: 0.5 }]);
  expect(post).toHaveBeenCalledTimes(1);
});
