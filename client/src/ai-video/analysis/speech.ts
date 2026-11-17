import api from '@/services/api';
import { useAudioChunking } from '@/composables/useAudioChunking';
import { audioChunkFile } from '@/utils/audioChunkFile';
import { join } from '@tauri-apps/api/path';
import type { MediaItem, SpeechSegment } from '../types';
import { readJson, sourcesCacheDir, writeJson } from './shared';

interface RawSpeechSegment {
  start?: number;
  end?: number;
  text?: string;
  speaker_id?: string | number | null;
  speaker?: string | number | null;
  speaker_label?: string | number | null;
  words?: Array<{ speaker_id?: string | number | null; speaker?: string | number | null }>;
}

/** Analyze one video's audio with Clippster's existing metered transcription service. */
export async function analyzeVideoSpeech(
  sessionId: number,
  item: MediaItem,
  force = false
): Promise<SpeechSegment[]> {
  const chunking = useAudioChunking({ showSuccessToast: false, showErrorToast: false });
  const extracted = await chunking.extractAndChunkVideo(
    item.path,
    `ai-video-${sessionId}-${item.id}`,
    {
      chunkDurationMinutes: 20,
      overlapSeconds: 0,
    }
  );
  if (!extracted.success || !extracted.chunks)
    throw new Error(extracted.error || 'Could not extract audio.');

  const turns: SpeechSegment[] = [];
  for (const [chunkIndex, chunk] of extracted.chunks.entries()) {
    const cachePath = await join(
      await sourcesCacheDir(),
      `${item.contentHash}.speech.${chunkIndex}.json`
    );
    const cached = force ? null : await readJson<SpeechSegment[]>(cachePath);
    if (cached) {
      turns.push(...cached);
      continue;
    }
    const chunkTurns: SpeechSegment[] = [];
    const form = new FormData();
    form.append('project_id', `ai-video-${sessionId}`);
    form.append('audio', audioChunkFile(chunk));
    form.append('duration', String(chunk.duration));
    const response = await api.post('/clips/transcribe', form, {
      headers: { 'Content-Type': undefined },
    });
    if (!response.data.success) throw new Error(response.data.error || 'Speech analysis failed.');
    const segments = (response.data.transcript?.segments ?? []) as RawSpeechSegment[];
    for (const segment of segments) {
      if (
        !Number.isFinite(segment.start) ||
        !Number.isFinite(segment.end) ||
        segment.start! < 0 ||
        segment.end! <= segment.start! ||
        !segment.text?.trim()
      )
        continue;
      const labelledWord = segment.words?.find(
        (word) => word.speaker_id != null || word.speaker != null
      );
      const rawSpeaker =
        segment.speaker_id ??
        segment.speaker ??
        segment.speaker_label ??
        labelledWord?.speaker_id ??
        labelledWord?.speaker;
      chunkTurns.push({
        start: chunk.start_time + segment.start!,
        end: chunk.start_time + segment.end!,
        text: segment.text.trim(),
        // IDs are local to each API chunk; do not imply that two chunks identify the same person.
        speakerId: rawSpeaker == null ? null : `${chunkIndex}:${rawSpeaker}`,
      });
    }
    await writeJson(cachePath, chunkTurns);
    turns.push(...chunkTurns);
  }
  return turns.sort((a, b) => a.start - b.start);
}
