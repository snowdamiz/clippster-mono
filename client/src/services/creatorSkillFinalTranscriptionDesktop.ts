import api from '@/services/api';
import { normalizeCreatorSkillTranscriptionWords, type WordInfo } from '@clippster/shared-types';
import { useAudioChunking } from '@/composables/useAudioChunking';
import { audioChunkFile } from '@/utils/audioChunkFile';

/** The existing single-clip endpoint deducts no personal credits for clips under 30 minutes. */
export async function transcribeCreatorSkillFinalAudio(filePath: string, clipId: string, duration: number): Promise<WordInfo[]> {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 30 * 60) throw new Error('Final audio re-transcription supports clips up to 30 minutes.');
  const chunking = useAudioChunking({ showSuccessToast: false, showErrorToast: false });
  const extracted = await chunking.extractAndChunkVideo(filePath, `creator-skill-final-${clipId}`, { chunkDurationMinutes: 20, overlapSeconds: 0 });
  if (!extracted.success || !extracted.chunks?.length) throw new Error(extracted.error || 'Could not extract final audio.');
  const words: WordInfo[] = [];
  for (const chunk of extracted.chunks) {
    const form = new FormData();
    form.append('project_id', `creator-skill-final-${clipId}`);
    form.append('audio', audioChunkFile(chunk));
    form.append('duration', String(chunk.duration));
    form.append('free_single_clip', 'true');
    form.append('free_single_clip_total_duration', String(duration));
    const response = await api.post('/clips/transcribe', form, { headers: { 'Content-Type': undefined } });
    if (!response.data.success) throw new Error(response.data.details || response.data.error || 'Final audio transcription failed.');
    words.push(...normalizeCreatorSkillTranscriptionWords(response.data.transcript, chunk.duration).map(word => ({ ...word, start: word.start + chunk.start_time, end: word.end + chunk.start_time })));
  }
  return words.sort((a, b) => a.start - b.start);
}
