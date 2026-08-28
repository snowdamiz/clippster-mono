import type { TranscribeResponse } from '@clippster/api-client';
import { File, Paths, UploadType } from 'expo-file-system';
import { getApiBaseUrl } from '@/lib/config';
import { clipsApi, creditsApi } from '@/services/api';
import { getStoredToken } from '@/services/authStorage';
import {
  createTranscriptRecord,
  getRawVideoByProjectId,
  getTranscriptByProjectId,
  persistDetectedClips,
} from '@/services/database';
import { cancelFfmpeg, extractAudioForTranscription, probeDuration } from '@/services/ffmpeg';
import { ProgressSocket, type ProgressUpdate } from '@/services/progressSocket';

export interface AiPipelineProgress {
  stage:
    | 'idle'
    | 'checking_credits'
    | 'extracting_audio'
    | 'transcribing'
    | 'detecting'
    | 'complete'
    | 'error';
  progress: number;
  message: string;
  error?: string;
}

const DEFAULT_PROMPT =
  'Find the most engaging, shareable moments suitable for short-form clips. Prefer high-energy reactions, punchlines, and complete thoughts.';

/**
 * Desktop (Tauri) uses 25 min MP3 chunks at -q:a 8.
 * Mobile remux stub can only stream-copy AAC, so keep slices shorter to stay
 * near Lemonfox-friendly sizes (~10–12MB) before any server compress.
 */
const CHUNK_DURATION_MINUTES = 10;
const OVERLAP_SECONDS = 30;
const UPLOAD_MAX_RETRIES = 3;

type AudioChunkSpec = {
  chunkId: string;
  chunkIndex: number;
  startTime: number;
  endTime: number;
  duration: number;
};

type WhisperSegment = {
  start?: number;
  end?: number;
  text?: string;
  words?: Array<{ start?: number; end?: number; word?: string; text?: string }>;
  [key: string]: unknown;
};

type ChunkTranscript = {
  startTime: number;
  endTime: number;
  transcript: NonNullable<TranscribeResponse['transcript']>;
};

function buildChunkSpecs(totalDuration: number): AudioChunkSpec[] {
  const chunkSecs = CHUNK_DURATION_MINUTES * 60;
  const overlapSecs = OVERLAP_SECONDS;

  if (totalDuration <= 0) {
    return [
      {
        chunkId: 'chunk_0',
        chunkIndex: 0,
        startTime: 0,
        endTime: 0,
        duration: 0,
      },
    ];
  }

  if (totalDuration <= chunkSecs + 1) {
    return [
      {
        chunkId: 'chunk_0',
        chunkIndex: 0,
        startTime: 0,
        endTime: totalDuration,
        duration: totalDuration,
      },
    ];
  }

  const specs: AudioChunkSpec[] = [];
  let currentStart = 0;
  let index = 0;

  while (currentStart < totalDuration) {
    const currentEnd = Math.min(currentStart + chunkSecs, totalDuration);
    const duration = currentEnd - currentStart;
    if (duration < 1) break;

    specs.push({
      chunkId: `chunk_${index}`,
      chunkIndex: index,
      startTime: currentStart,
      endTime: currentEnd,
      duration,
    });

    if (currentEnd >= totalDuration) break;
    currentStart = currentEnd - overlapSecs;
    index += 1;
    if (index > 100) {
      throw new Error('Too many audio chunks — possible infinite loop');
    }
  }

  return specs;
}

function stitchChunkTranscripts(
  chunks: ChunkTranscript[],
  totalDuration: number,
): {
  text: string;
  segments: WhisperSegment[];
  language: string;
  duration: number;
} {
  let fullText = '';
  const combinedSegments: WhisperSegment[] = [];
  let language = 'english';

  for (const chunk of chunks) {
    const data = chunk.transcript;
    if (data.language) language = data.language;
    if (data.text) fullText += `${data.text} `;

    const segments = Array.isArray(data.segments) ? (data.segments as WhisperSegment[]) : [];
    for (const seg of segments) {
      combinedSegments.push({
        ...seg,
        start: (seg.start ?? 0) + chunk.startTime,
        end: (seg.end ?? 0) + chunk.startTime,
        words: seg.words?.map((w) => ({
          ...w,
          start: (w.start ?? 0) + chunk.startTime,
          end: (w.end ?? 0) + chunk.startTime,
        })),
      });
    }
  }

  return {
    text: fullText.trim(),
    segments: combinedSegments,
    language,
    duration: totalDuration,
  };
}

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

function deleteQuietly(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // ignore cleanup errors
  }
}

export class AiPipeline {
  private progressSocket = new ProgressSocket();
  private cancelled = false;
  private uploadAbort: AbortController | null = null;
  private activeProjectId: string | null = null;

  constructor(private onProgress: (progress: AiPipelineProgress) => void) {}

  cancel(): void {
    this.cancelled = true;
    this.uploadAbort?.abort();
    cancelFfmpeg();
    this.progressSocket.disconnect();
    if (this.activeProjectId) {
      void clipsApi.cancelByProject(this.activeProjectId).catch(() => undefined);
    }
  }

  private setProgress(progress: AiPipelineProgress): void {
    this.onProgress(progress);
  }

  private ensureNotCancelled(): void {
    if (this.cancelled) {
      throw new Error('Cancelled');
    }
  }

  private resolveUploadMedia(path: string): { name: string; type: string } {
    const lower = path.toLowerCase();
    if (lower.endsWith('.m4a') || lower.endsWith('.aac') || lower.endsWith('.mp4')) {
      return { name: 'audio.m4a', type: 'audio/mp4' };
    }
    if (lower.endsWith('.mp3')) {
      return { name: 'audio.mp3', type: 'audio/mpeg' };
    }
    if (lower.endsWith('.ts') || lower.endsWith('.m2ts')) {
      return { name: 'video.ts', type: 'video/mp2t' };
    }
    return { name: 'video.mp4', type: 'video/mp4' };
  }

  private async uploadForTranscription(
    audioFile: File,
    media: { name: string; type: string },
    projectId: string,
    duration: number,
    progressRange: { from: number; to: number },
    label: string,
  ): Promise<TranscribeResponse> {
    let baseUrl = getApiBaseUrl().trim();
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    if (!baseUrl.endsWith('/api')) baseUrl += '/api';

    const token = await getStoredToken();
    const headers: Record<string, string> = {
      'X-Client-Platform': 'mobile',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    this.uploadAbort = new AbortController();
    try {
      const result = await audioFile.upload(`${baseUrl}/clips/transcribe`, {
        httpMethod: 'POST',
        uploadType: UploadType.MULTIPART,
        fieldName: 'audio',
        mimeType: media.type,
        parameters: {
          project_id: projectId,
          duration: String(duration),
        },
        headers,
        signal: this.uploadAbort.signal,
        onProgress: ({ bytesSent, totalBytes }) => {
          if (this.cancelled) return;
          const fraction = totalBytes > 0 ? bytesSent / totalBytes : 0;
          const progress = Math.round(
            progressRange.from + fraction * (progressRange.to - progressRange.from),
          );
          this.setProgress({
            stage: 'transcribing',
            progress,
            message: label,
          });
        },
      });

      this.ensureNotCancelled();

      let parsed: TranscribeResponse;
      try {
        parsed = JSON.parse(result.body) as TranscribeResponse;
      } catch {
        throw new Error(
          result.body?.trim()
            ? `Transcription failed (${result.status}): ${result.body.slice(0, 200)}`
            : `Transcription upload failed (${result.status})`,
        );
      }

      if (!parsed.success || !parsed.transcript) {
        throw new Error(parsed.error ?? parsed.details ?? 'Transcription failed');
      }
      return parsed;
    } finally {
      this.uploadAbort = null;
    }
  }

  private async uploadChunkWithRetry(
    audioFile: File,
    media: { name: string; type: string },
    projectId: string,
    duration: number,
    progressRange: { from: number; to: number },
    label: string,
  ): Promise<TranscribeResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < UPLOAD_MAX_RETRIES; attempt++) {
      this.ensureNotCancelled();
      try {
        return await this.uploadForTranscription(
          audioFile,
          media,
          projectId,
          duration,
          progressRange,
          label,
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (this.cancelled || lastError.message === 'Cancelled') throw lastError;

        const message = lastError.message.toLowerCase();
        const retryable =
          message.includes('network') ||
          message.includes('socket') ||
          message.includes('timeout') ||
          message.includes('failed (5') ||
          message.includes('upload failed');

        if (retryable && attempt < UPLOAD_MAX_RETRIES - 1) {
          const delay = Math.min(2000 * 2 ** attempt, 10_000);
          console.warn(
            `[AiPipeline] ${label} failed (attempt ${attempt + 1}/${UPLOAD_MAX_RETRIES}), retrying in ${delay}ms`,
            lastError,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }
    }

    throw lastError ?? new Error('Transcription upload failed');
  }

  private async extractChunkAudio(
    sourcePath: string,
    projectId: string,
    spec: AudioChunkSpec,
  ): Promise<string> {
    const outFile = new File(Paths.cache, `transcribe_${projectId}_${spec.chunkId}.m4a`);
    deleteQuietly(outFile);

    return extractAudioForTranscription(
      sourcePath,
      outFile.uri,
      undefined,
      spec.startTime,
      spec.endTime,
    );
  }

  async transcribeProject(projectId: string): Promise<void> {
    this.cancelled = false;
    this.activeProjectId = projectId;
    this.setProgress({ stage: 'checking_credits', progress: 2, message: 'Checking credits…' });
    this.ensureNotCancelled();

    const balance = await creditsApi.getBalance();
    if (!balance.success) {
      throw new Error(balance.error ?? 'Could not check credits');
    }

    const available = balance.total_available;
    const hasCredits =
      available === 'unlimited' || (typeof available === 'number' && available > 0);
    if (!hasCredits) {
      throw new Error('Insufficient credits. Subscribe or buy credits at clippster.app/credits.');
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
      if (this.cancelled) return;
      this.setProgress({
        stage: 'transcribing',
        progress: Math.max(10, Math.min(95, update.progress)),
        message: update.message ?? update.stage,
        error: update.stage === 'error' ? update.message ?? 'Transcription failed' : undefined,
      });
    });

    const sourcePath = rawVideo.file_path;
    let totalDuration = rawVideo.duration ?? 0;
    if (totalDuration <= 0) {
      totalDuration = (await probeDuration(sourcePath)) ?? 0;
    }
    if (totalDuration <= 0) {
      throw new Error('Could not determine video duration for chunking');
    }

    const specs = buildChunkSpecs(totalDuration);
    console.log('[AiPipeline] Chunk plan', {
      projectId,
      totalDuration,
      chunkCount: specs.length,
      chunkMinutes: CHUNK_DURATION_MINUTES,
      overlapSeconds: OVERLAP_SECONDS,
    });

    const chunkResults: ChunkTranscript[] = [];

    for (let i = 0; i < specs.length; i++) {
      this.ensureNotCancelled();
      const spec = specs[i];
      const extractFrom = 8 + Math.round((i / specs.length) * 22);
      const extractTo = 8 + Math.round(((i + 0.45) / specs.length) * 22);
      const uploadFrom = 30 + Math.round((i / specs.length) * 55);
      const uploadTo = 30 + Math.round(((i + 1) / specs.length) * 55);

      this.setProgress({
        stage: 'extracting_audio',
        progress: extractFrom,
        message: `Extracting audio chunk ${i + 1}/${specs.length}…`,
      });

      let uploadPath: string;
      let tempFile: File | null = null;
      try {
        uploadPath = await this.extractChunkAudio(sourcePath, projectId, spec);
        const uri = uploadPath.startsWith('file://') ? uploadPath : `file://${uploadPath}`;
        tempFile = new File(uri);
        this.setProgress({
          stage: 'extracting_audio',
          progress: extractTo,
          message: `Extracted chunk ${i + 1}/${specs.length}`,
        });
      } catch (error) {
        console.warn(
          `[AiPipeline] Chunk ${i + 1} extract failed; uploading source slice via server fallback is not available — failing chunk`,
          error,
        );
        throw new Error(
          `Failed to extract audio chunk ${i + 1}/${specs.length}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      this.ensureNotCancelled();
      if (!tempFile.exists) {
        throw new Error(`Audio chunk file missing: ${uploadPath}`);
      }

      const media = this.resolveUploadMedia(uploadPath);
      console.log('[AiPipeline] Uploading chunk for transcription', {
        projectId,
        chunkId: spec.chunkId,
        startTime: spec.startTime,
        endTime: spec.endTime,
        duration: spec.duration,
        name: media.name,
        type: media.type,
        size: tempFile.size,
      });

      this.setProgress({
        stage: 'transcribing',
        progress: uploadFrom,
        message: `Transcribing chunk ${i + 1}/${specs.length}…`,
      });

      try {
        const response = await this.uploadChunkWithRetry(
          tempFile,
          media,
          projectId,
          spec.duration,
          { from: uploadFrom, to: uploadTo },
          `Uploading chunk ${i + 1}/${specs.length}…`,
        );
        chunkResults.push({
          startTime: spec.startTime,
          endTime: spec.endTime,
          transcript: response.transcript!,
        });
      } finally {
        if (tempFile) deleteQuietly(tempFile);
      }
    }

    this.ensureNotCancelled();
    this.setProgress({
      stage: 'transcribing',
      progress: 90,
      message: 'Assembling full transcript…',
    });

    const stitched = stitchChunkTranscripts(chunkResults, totalDuration);
    await createTranscriptRecord({
      rawVideoId: rawVideo.id,
      rawJson: JSON.stringify(stitched),
      text: stitched.text,
      language: stitched.language,
      duration: stitched.duration,
    });

    this.progressSocket.disconnect();
    this.setProgress({ stage: 'complete', progress: 100, message: 'Transcription complete' });
  }

  async detectClips(
    projectId: string,
    options?: {
      prompt?: string;
      startTime?: number;
      endTime?: number;
    },
  ): Promise<number> {
    this.cancelled = false;
    this.activeProjectId = projectId;
    const prompt = options?.prompt ?? DEFAULT_PROMPT;
    const transcriptRow = await getTranscriptByProjectId(projectId);
    if (!transcriptRow) {
      throw new Error('Transcribe this project before running clip detection');
    }

    const rawVideo = await getRawVideoByProjectId(projectId);
    if (!rawVideo) {
      throw new Error('No video found for this project');
    }

    const transcript = JSON.parse(transcriptRow.raw_json ?? '{}');
    let chunks = splitTranscriptIntoChunks(transcript);
    if (options?.startTime != null || options?.endTime != null) {
      const startTime = options.startTime ?? 0;
      const endTime = options.endTime ?? Number.POSITIVE_INFINITY;
      chunks = chunks.filter((chunk) => chunk.end_time > startTime && chunk.start_time < endTime);
    }

    this.progressSocket.connect(projectId, (update: ProgressUpdate) => {
      if (this.cancelled) return;
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
    formData.append('enhanced', 'false');
    if (options?.startTime != null) {
      formData.append('start_time', String(options.startTime));
    }
    if (options?.endTime != null) {
      formData.append('end_time', String(options.endTime));
    }

    this.setProgress({ stage: 'detecting', progress: 20, message: 'Detecting clips…' });
    this.ensureNotCancelled();
    const response = await clipsApi.detectChunked(formData);
    this.ensureNotCancelled();
    if (!response.success) {
      throw new Error(response.error ?? response.details ?? 'Clip detection failed');
    }

    const normalized = normalizeDetectedClips(response);
    await persistDetectedClips(projectId, prompt, normalized, rawVideo.file_path);
    const { queueProjectSync } = await import('./cloudSync');
    void queueProjectSync(projectId);

    this.progressSocket.disconnect();
    this.setProgress({
      stage: 'complete',
      progress: 100,
      message: `Found ${normalized.length} clips`,
    });
    return normalized.length;
  }
}
