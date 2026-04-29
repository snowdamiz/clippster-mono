import { ref } from 'vue';
import {
  getRawVideosByProjectId,
  getTranscriptByRawVideoId,
  getTranscriptChunks,
  createTranscript,
  createTranscriptSegment,
  getTranscriptByProjectId,
  getChunkedTranscriptByRawVideoId,
  type RawVideo,
} from '@/services/database';
import { useChunkedTranscriptCache } from './useChunkedTranscriptCache';
import { useToast } from '@/composables/useToast';
import api from '@/services/api';
import { type AudioChunk } from './useAudioChunking';

export interface TranscriptionOptions {
  chunkDurationMinutes?: number;
  overlapSeconds?: number;
  organizationId?: number | null;
}

interface UseTranscriptionOnlyOptions {
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  showChunkCompletionToast?: boolean;
  showCacheReuseToast?: boolean;
}

export interface TranscriptionProgress {
  stage:
    | 'initializing'
    | 'checking_cache'
    | 'extracting_chunks'
    | 'transcribing_chunks'
    | 'stitching'
    | 'completed'
    | 'cancelled'
    | 'error'
    | 'already_transcribed';
  progress: number;
  message: string;
  error?: string;
}

export function useTranscriptionOnly(options: UseTranscriptionOnlyOptions = {}) {
  const isProcessing = ref(false);
  const isCancelled = ref(false);
  const progress = ref<TranscriptionProgress>({
    stage: 'initializing',
    progress: 0,
    message: '',
  });
  const { success: showSuccess, error: showError } = useToast();
  const shouldShowSuccessToast = options.showSuccessToast ?? true;
  const shouldShowErrorToast = options.showErrorToast ?? true;

  const transcriptCache = useChunkedTranscriptCache({
    showCompletionToast: options.showChunkCompletionToast ?? true,
    showCacheReuseToast: options.showCacheReuseToast ?? true,
    showErrorToast: options.showErrorToast ?? true,
  });
  let abortController: AbortController | null = null;
  let currentOrganizationId: number | null = null;

  function checkCancelled() {
    if (isCancelled.value) {
      throw new Error('Transcription cancelled by user');
    }
  }

  function cancelTranscription() {
    if (!isProcessing.value) return;

    isCancelled.value = true;

    if (abortController) {
      abortController.abort();
      abortController = null;
    }

    progress.value = {
      stage: 'cancelled',
      progress: 0,
      message: 'Transcription cancelled by user',
    };
  }

  async function transcribeProject(
    projectId: string,
    options: TranscriptionOptions = {}
  ): Promise<{
    success: boolean;
    alreadyTranscribed?: boolean;
    error?: string;
  }> {
    try {
      isCancelled.value = false;
      abortController = new AbortController();
      currentOrganizationId = options.organizationId ?? null;

      isProcessing.value = true;
      progress.value = {
        stage: 'initializing',
        progress: 0,
        message: 'Initializing transcription...',
      };

      const { chunkDurationMinutes = 25, overlapSeconds = 30 } = options;

      // Get project video
      const rawVideos = await getRawVideosByProjectId(projectId);
      if (rawVideos.length === 0) {
        throw new Error('No video found for project');
      }

      const projectVideo = rawVideos[0];

      // Check for existing transcript
      const existingTranscript = await getTranscriptByRawVideoId(projectVideo.id);
      if (existingTranscript) {
        progress.value = {
          stage: 'already_transcribed',
          progress: 100,
          message: 'Transcript already exists',
        };
        return { success: true, alreadyTranscribed: true };
      }

      // Check for cached chunks that are already transcribed
      progress.value = {
        stage: 'checking_cache',
        progress: 10,
        message: 'Checking for cached chunks...',
      };

      const { initializeChunkedTranscriptSession, getCachedChunkMetadata } = transcriptCache;
      const cachedMetadata = await getCachedChunkMetadata(projectVideo.id);

      if (
        cachedMetadata &&
        cachedMetadata.hasCachedTranscript &&
        cachedMetadata.chunks &&
        cachedMetadata.chunks.length > 0
      ) {
        // All chunks already transcribed — just stitch them together
        return await stitchAndSaveTranscript(projectId, projectVideo);
      }

      // No cache — extract and chunk audio
      progress.value = {
        stage: 'extracting_chunks',
        progress: 20,
        message: 'Extracting audio chunks...',
      };

      checkCancelled();

      const sessionResult = await initializeChunkedTranscriptSession(
        projectVideo.id,
        chunkDurationMinutes,
        overlapSeconds
      );

      if (!sessionResult.success || !sessionResult.sessionId) {
        throw new Error(sessionResult.error || 'Failed to initialize chunked transcript session');
      }

      if (sessionResult.chunks && sessionResult.chunks.length > 0) {
        // Transcribe all chunks
        await transcribeChunks(
          projectId,
          sessionResult.sessionId,
          sessionResult.chunks,
          projectVideo
        );

        // Stitch into full transcript
        return await stitchAndSaveTranscript(projectId, projectVideo);
      }

      throw new Error('No audio chunks were extracted from the video');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (
        isCancelled.value ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('aborted')
      ) {
        progress.value = {
          stage: 'cancelled',
          progress: 0,
          message: 'Transcription cancelled by user',
        };
        return { success: false, error: 'Cancelled' };
      }

      progress.value = {
        stage: 'error',
        progress: 0,
        message: 'Transcription failed',
        error: errorMessage,
      };

      if (shouldShowErrorToast) {
        showError('Transcription failed', errorMessage, undefined, 'clips');
      }
      return { success: false, error: errorMessage };
    } finally {
      isProcessing.value = false;
      abortController = null;
    }
  }

  async function transcribeChunks(
    projectId: string,
    sessionId: string,
    chunks: AudioChunk[],
    _projectVideo: RawVideo
  ): Promise<void> {
    const existingChunks = await getTranscriptChunks(sessionId);
    const transcribedChunkIds = new Set(existingChunks.map((c) => c.chunk_id));
    const { storeChunkTranscription } = transcriptCache;
    const totalChunks = chunks.length;

    let completedChunks = 0;

    const transcribeChunk = async (chunk: AudioChunk, i: number): Promise<void> => {
      checkCancelled();

      if (transcribedChunkIds.has(chunk.chunk_id)) {
        console.log(`[TranscriptionOnly] Chunk ${chunk.chunk_id} already transcribed, skipping.`);
        completedChunks++;
        return;
      }

      // Convert base64 to File
      const binaryString = atob(chunk.base64_data);
      const bytes = new Uint8Array(binaryString.length);
      for (let j = 0; j < binaryString.length; j++) {
        bytes[j] = binaryString.charCodeAt(j);
      }

      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioFile = new File([blob], chunk.filename, { type: 'audio/mpeg' });

      const formData = new FormData();
      formData.append('project_id', projectId);
      formData.append('audio', audioFile);
      formData.append('duration', chunk.duration.toString());
      if (currentOrganizationId) {
        formData.append('organization_id', currentOrganizationId.toString());
      }

      const maxRetries = 3;
      let lastError: Error | null = null;
      let transcript: any = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          checkCancelled();

          const response = await api.post('/clips/transcribe', formData, {
            headers: { 'Content-Type': undefined },
            signal: abortController?.signal,
          });

          if (!response.data.success) {
            throw new Error(response.data.error || `Failed to transcribe chunk ${i + 1}`);
          }

          transcript = response.data.transcript;
          break;
        } catch (err: any) {
          lastError = err instanceof Error ? err : new Error(String(err));

          if (err?.name === 'CanceledError' || err?.response?.status === 402) {
            throw err;
          }

          const isRetryable = !err?.response || err?.response?.status >= 500;
          if (isRetryable && attempt < maxRetries - 1) {
            const delay = Math.min(2000 * Math.pow(2, attempt), 10000);
            console.log(
              `[TranscriptionOnly] Chunk ${i + 1} failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            throw lastError;
          }
        }
      }

      if (!transcript) {
        throw (
          lastError ||
          new Error(`Failed to transcribe chunk ${i + 1} after ${maxRetries} attempts`)
        );
      }

      const storeResult = await storeChunkTranscription(
        sessionId,
        i,
        chunk.chunk_id,
        transcript,
        chunk.start_time,
        chunk.end_time
      );

      if (!storeResult.success) {
        throw new Error(storeResult.error || `Failed to store chunk ${i + 1} transcription`);
      }

      completedChunks++;
      progress.value = {
        stage: 'transcribing_chunks',
        progress: 30 + (completedChunks / totalChunks) * 50, // 30% to 80%
        message: `Transcribed ${completedChunks}/${totalChunks} chunks...`,
      };
    };

    // Run transcription in parallel with a concurrency limit of 3
    const CONCURRENCY = 3;
    const chunksToProcess = chunks.map((chunk, i) => ({ chunk, i }));
    for (let start = 0; start < chunksToProcess.length; start += CONCURRENCY) {
      checkCancelled();
      const batch = chunksToProcess.slice(start, start + CONCURRENCY);
      await Promise.all(batch.map(({ chunk, i }) => transcribeChunk(chunk, i)));
    }
  }

  async function stitchAndSaveTranscript(
    projectId: string,
    projectVideo: RawVideo
  ): Promise<{ success: boolean; alreadyTranscribed?: boolean; error?: string }> {
    progress.value = {
      stage: 'stitching',
      progress: 85,
      message: 'Assembling full transcript...',
    };

    // Check if transcript was already created (race condition guard)
    const existingTranscript = await getTranscriptByRawVideoId(projectVideo.id);
    if (existingTranscript) {
      progress.value = {
        stage: 'completed',
        progress: 100,
        message: 'Transcript ready!',
      };
      dispatchTranscriptUpdated(projectId);
      if (shouldShowSuccessToast) {
        showSuccess('Transcription complete', 'Transcript is ready for viewing', undefined, 'clips');
      }
      return { success: true, alreadyTranscribed: true };
    }

    const chunkedTranscript = await getChunkedTranscriptByRawVideoId(projectVideo.id);
    if (!chunkedTranscript) {
      throw new Error('No chunked transcript found after transcription');
    }

    const chunks = await getTranscriptChunks(chunkedTranscript.id);
    if (chunks.length === 0) {
      throw new Error('No transcript chunks found');
    }

    // Combine chunks into full transcript
    let fullText = '';
    let combinedSegments: any[] = [];

    for (const chunk of chunks) {
      try {
        const chunkData = JSON.parse(chunk.raw_json);
        if (chunkData.text) fullText += chunkData.text + ' ';

        if (chunkData.segments && Array.isArray(chunkData.segments)) {
          const adjustedSegments = chunkData.segments.map((seg: any) => ({
            ...seg,
            start: (seg.start || 0) + chunk.start_time,
            end: (seg.end || 0) + chunk.start_time,
            words: seg.words?.map((w: any) => ({
              ...w,
              start: (w.start || 0) + chunk.start_time,
              end: (w.end || 0) + chunk.start_time,
            })),
          }));
          combinedSegments.push(...adjustedSegments);
        }
      } catch (e) {
        console.warn('[TranscriptionOnly] Failed to parse chunk JSON', e);
      }
    }

    // Build Whisper-compatible JSON
    const fullTranscriptJson = {
      text: fullText.trim(),
      segments: combinedSegments,
      language: chunkedTranscript.language || 'english',
      duration: chunkedTranscript.total_duration,
    };

    // Save to database
    const transcriptId = await createTranscript(
      projectVideo.id,
      JSON.stringify(fullTranscriptJson),
      fullText.trim(),
      chunkedTranscript.language || 'english',
      chunkedTranscript.total_duration
    );

    // Create segments
    for (let i = 0; i < combinedSegments.length; i++) {
      const seg = combinedSegments[i];
      await createTranscriptSegment(transcriptId, seg.start, seg.end, seg.text, i);
    }

    console.log('[TranscriptionOnly] Successfully created full transcript from chunks');

    progress.value = {
      stage: 'completed',
      progress: 100,
      message: 'Transcript ready!',
    };

    dispatchTranscriptUpdated(projectId);
    if (shouldShowSuccessToast) {
      showSuccess('Transcription complete', 'Transcript is ready for viewing');
    }

    return { success: true };
  }

  function dispatchTranscriptUpdated(projectId: string) {
    setTimeout(() => {
      const refreshEvent = new CustomEvent('transcript-updated', {
        detail: { projectId },
      });
      document.dispatchEvent(refreshEvent);
    }, 500);
  }

  function reset() {
    isCancelled.value = false;
    abortController = null;
    currentOrganizationId = null;
    progress.value = { stage: 'initializing', progress: 0, message: '' };
  }

  return {
    // State
    isProcessing,
    isCancelled,
    progress,

    // Methods
    transcribeProject,
    cancelTranscription,
    reset,
  };
}
