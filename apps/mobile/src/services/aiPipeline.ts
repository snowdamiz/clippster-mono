import * as FileSystem from 'expo-file-system/legacy';
import { clipsApi, creditsApi } from '@/services/api';
import {
  createTranscriptRecord,
  getRawVideoByProjectId,
  getTranscriptByProjectId,
  persistDetectedClips,
} from '@/services/database';
import { extractAudioMp3 } from '@/services/ffmpeg';
import { ProgressSocket, type ProgressUpdate } from '@/services/progressSocket';

export interface AiPipelineProgress {
  stage: 'idle' | 'checking_credits' | 'extracting_audio' | 'transcribing' | 'detecting' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

const DEFAULT_PROMPT =
  'Find the most engaging, shareable moments suitable for short-form clips. Prefer high-energy reactions, punchlines, and complete thoughts.';

function splitTranscriptIntoChunks(transcript: {
  duration?: number;
  segments?: Array<{ start: number; end: number; text?: string }>;
}) {
  const chunkDuration = 15 * 60;
  const totalDuration = transcript.duration ?? 0;
  const segments = transcript.segments ?? [];

  if (totalDuration <= chunkDuration || segments.length === 0) {
    return [
      {
        chunk_id: 'chunk_0',
        chunk_index: 0,
        start_time: 0,
        end_time: totalDuration || segments.at(-1)?.end || 0,
        raw_json: JSON.stringify(transcript),
      },
    ];
  }

  const chunks = [];
  let chunkIndex = 0;
  for (let start = 0; start < totalDuration; start += chunkDuration) {
    const end = Math.min(start + chunkDuration, totalDuration);
    const chunkSegments = segments.filter((segment) => segment.end > start && segment.start < end);
    chunks.push({
      chunk_id: `chunk_${chunkIndex}`,
      chunk_index: chunkIndex,
      start_time: start,
      end_time: end,
      raw_json: JSON.stringify({
        ...transcript,
        segments: chunkSegments,
        duration: end - start,
      }),
    });
    chunkIndex += 1;
  }
  return chunks;
}

function normalizeDetectedClips(result: { clips?: unknown }) {
  let clips = result.clips;
  if (clips && typeof clips === 'object' && !Array.isArray(clips) && (clips as { clips?: unknown }).clips) {
    clips = (clips as { clips: unknown[] }).clips;
  }
  if (!Array.isArray(clips)) return [];

  return clips.map((clip: Record<string, unknown>, index: number) => {
    const segments = Array.isArray(clip.segments) ? clip.segments : [];
    const firstSegment = segments[0] as Record<string, number> | undefined;
    const startTime = Number(clip.start_time ?? clip.startTime ?? firstSegment?.start_time ?? 0);
    const endTime = Number(clip.end_time ?? clip.endTime ?? firstSegment?.end_time ?? startTime + 30);

    return {
      name: String(clip.title ?? clip.name ?? `Clip ${index + 1}`),
      startTime,
      endTime,
      description: (clip.description as string | null) ?? null,
      confidenceScore: (clip.confidence_score as number | null) ?? (clip.confidence as number | null) ?? null,
      viralityScore: (clip.virality_score as number | null) ?? null,
      segments: segments.map((segment: Record<string, unknown>) => ({
        start_time: Number(segment.start_time ?? 0),
        end_time: Number(segment.end_time ?? 0),
        duration: Number(segment.duration ?? 0),
        transcript: (segment.transcript as string | null) ?? null,
      })),
    };
  });
}

export class AiPipeline {
  private progressSocket = new ProgressSocket();
  private cancelled = false;

  constructor(private onProgress: (progress: AiPipelineProgress) => void) {}

  cancel(): void {
    this.cancelled = true;
    this.progressSocket.disconnect();
  }

  private setProgress(progress: AiPipelineProgress): void {
    this.onProgress(progress);
  }

  private ensureNotCancelled(): void {
    if (this.cancelled) {
      throw new Error('Cancelled');
    }
  }

  async transcribeProject(projectId: string): Promise<void> {
    this.cancelled = false;
    this.setProgress({ stage: 'checking_credits', progress: 2, message: 'Checking credits…' });
    this.ensureNotCancelled();

    const balance = await creditsApi.getBalance();
    if (!balance.success) {
      throw new Error(balance.error ?? 'Could not check credits');
    }

    const available = balance.balance ?? balance.credits ?? 0;
    if (available < 1) {
      throw new Error('Insufficient credits. Buy credits in Settings or at clippster.app/credits.');
    }

    const existing = await getTranscriptByProjectId(projectId);
    if (existing) {
      this.setProgress({ stage: 'complete', progress: 100, message: 'Transcript already exists' });
      return;
    }

    const rawVideo = await getRawVideoByProjectId(projectId);
    if (!rawVideo) {
      throw new Error('No video found for this project');
    }

    this.progressSocket.connect(projectId, (update: ProgressUpdate) => {
      this.setProgress({
        stage: 'transcribing',
        progress: Math.max(10, Math.min(95, update.progress)),
        message: update.message ?? update.stage,
        error: update.stage === 'error' ? update.message ?? 'Transcription failed' : undefined,
      });
    });

    this.setProgress({ stage: 'extracting_audio', progress: 10, message: 'Extracting audio…' });
    const audioPath = `${FileSystem.cacheDirectory ?? ''}transcribe_${projectId}.mp3`;
    await extractAudioMp3(rawVideo.file_path, audioPath);
    this.ensureNotCancelled();

    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('duration', String(rawVideo.duration ?? 0));
    formData.append('audio', {
      uri: audioPath,
      name: 'audio.mp3',
      type: 'audio/mpeg',
    } as unknown as Blob);

    this.setProgress({ stage: 'transcribing', progress: 25, message: 'Uploading for transcription…' });
    const response = await clipsApi.transcribe(formData);
    if (!response.success || !response.transcript) {
      throw new Error(response.error ?? response.details ?? 'Transcription failed');
    }

    await createTranscriptRecord({
      rawVideoId: rawVideo.id,
      rawJson: JSON.stringify(response.transcript),
      text: response.transcript.text ?? '',
      language: response.transcript.language ?? null,
      duration: response.transcript.duration ?? rawVideo.duration,
    });

    this.progressSocket.disconnect();
    this.setProgress({ stage: 'complete', progress: 100, message: 'Transcription complete' });
  }

  async detectClips(projectId: string, prompt = DEFAULT_PROMPT): Promise<number> {
    this.cancelled = false;
    const transcriptRow = await getTranscriptByProjectId(projectId);
    if (!transcriptRow) {
      throw new Error('Transcribe this project before running clip detection');
    }

    const rawVideo = await getRawVideoByProjectId(projectId);
    if (!rawVideo) {
      throw new Error('No video found for this project');
    }

    const transcript = JSON.parse(transcriptRow.raw_json ?? '{}');
    const chunks = splitTranscriptIntoChunks(transcript);

    this.progressSocket.connect(projectId, (update: ProgressUpdate) => {
      this.setProgress({
        stage: 'detecting',
        progress: Math.max(10, Math.min(95, update.progress)),
        message: update.message ?? update.stage,
        error: update.stage === 'error' ? update.message ?? 'Detection failed' : undefined,
      });
    });

    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('prompt', prompt);
    formData.append('using_cached_transcript', 'true');
    formData.append('chunks', JSON.stringify(chunks));
    formData.append('total_duration', String(transcript.duration ?? rawVideo.duration ?? 0));
    formData.append('language', transcript.language ?? 'english');

    this.setProgress({ stage: 'detecting', progress: 20, message: 'Detecting clips…' });
    const response = await clipsApi.detectChunked(formData);
    if (!response.success) {
      throw new Error(response.error ?? response.details ?? 'Clip detection failed');
    }

    const normalized = normalizeDetectedClips(response);
    await persistDetectedClips(projectId, prompt, normalized, rawVideo.file_path);

    this.progressSocket.disconnect();
    this.setProgress({
      stage: 'complete',
      progress: 100,
      message: `Found ${normalized.length} clips`,
    });
    return normalized.length;
  }
}
