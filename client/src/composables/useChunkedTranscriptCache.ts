import { ref, computed } from 'vue';
import {
  createChunkedTranscript,
  storeTranscriptChunk,
  getChunkedTranscriptByRawVideoId,
  getTranscriptChunks,
  updateChunkedTranscriptCompleteness,
  getChunkMetadataForProcessing,
} from '@/services/database';
import { useAudioChunking, type AudioChunk } from './useAudioChunking';
import { useToast } from '@/composables/useToast';

export interface ChunkTranscriptionResult {
  chunkId: string;
  chunkIndex: number;
  startTime: number;
  endTime: number;
  duration: number;
  transcription: any;
  success: boolean;
  error?: string;
}

export interface ChunkedTranscriptSession {
  id: string;
  rawVideoId: string;
  totalChunks: number;
  chunkDurationMinutes: number;
  overlapSeconds: number;
  totalDuration: number;
  completedChunks: number;
  status: 'initializing' | 'extracting' | 'transcribing' | 'completed' | 'error';
  progress: number;
  error: string | null;
}

interface UseChunkedTranscriptCacheOptions {
  showCompletionToast?: boolean;
  showCacheReuseToast?: boolean;
  showErrorToast?: boolean;
}

export function useChunkedTranscriptCache(options: UseChunkedTranscriptCacheOptions = {}) {
  const currentSession = ref<ChunkedTranscriptSession | null>(null);
  const isProcessing = ref(false);
  const error = ref<string | null>(null);
  const { success: showSuccess, error: showError } = useToast();
  const shouldShowCompletionToast = options.showCompletionToast ?? true;
  const shouldShowCacheReuseToast = options.showCacheReuseToast ?? true;
  const shouldShowErrorToast = options.showErrorToast ?? true;

  // Computed properties
  const sessionProgress = computed(() => currentSession.value?.progress || 0);
  const sessionStatus = computed(() => currentSession.value?.status || 'idle');
  const hasActiveSession = computed(() => !!currentSession.value);

  async function initializeChunkedTranscriptSession(
    rawVideoId: string,
    chunkDurationMinutes: number = 10,
    overlapSeconds: number = 30,
    startTime?: number,
    endTime?: number
  ): Promise<{ success: boolean; sessionId?: string; chunks?: AudioChunk[]; error?: string }> {
    try {
      isProcessing.value = true;
      error.value = null;

      // Check if chunked transcript already exists
      const existingChunked = await getChunkedTranscriptByRawVideoId(rawVideoId);
      if (existingChunked) {
        // Only return if complete, or if partial but we want to continue?
        // For now, let's assume if it exists we want to check for chunks.
        const existingChunks = await getTranscriptChunks(existingChunked.id);

        // If we have some chunks but not all, we might need to re-process or resume.
        // But for initialization, if we have a record, let's return it.
        // If it's complete, return success.
        if (existingChunked.is_complete) {
          if (shouldShowCacheReuseToast) {
            showSuccess('Transcript cached', 'Using existing chunked transcript for this video');
          }
          return { success: true, sessionId: existingChunked.id };
        }

        // If not complete, we might want to resume or overwrite.
        // If we have 0 chunks, we can treat it as fresh.
        if (existingChunks.length > 0) {
          // We have partial chunks.
          // If we are calling initialize, it implies we might want to start fresh or resume.
          // However, useChunkedClipDetection calls this when "no cache found" logic flow is active
          // OR it should have been caught by getCachedChunkMetadata earlier.

          // If we are here, it means getCachedChunkMetadata returned null or insufficient data.
          // Let's create a NEW session or overwrite.
          // For simplicity and robustness, let's proceed to create a new one if the old one is incomplete/broken.
          console.log('Found incomplete chunked transcript, proceeding to re-chunk/re-initialize');
        }
      }

      // Get raw video record to access file path
      const { getRawVideo } = await import('@/services/database');
      const rawVideo = await getRawVideo(rawVideoId);
      if (!rawVideo) {
        throw new Error('Video not found in database.');
      }

      // Use audio chunking to get chunk information
      const { extractAndChunkVideo } = useAudioChunking();
      const chunkingResult = await extractAndChunkVideo(rawVideo.file_path, rawVideoId, {
        chunkDurationMinutes,
        overlapSeconds,
        startTime,
        endTime,
      });

      if (!chunkingResult.success || !chunkingResult.chunks) {
        throw new Error(chunkingResult.error || 'Failed to chunk video');
      }

      const chunks = chunkingResult.chunks;
      const totalDuration = chunks.reduce((sum, chunk) => sum + chunk.duration, 0);

      // Create chunked transcript record
      const chunkedTranscriptId = await createChunkedTranscript(
        rawVideoId,
        chunks.length,
        chunkDurationMinutes,
        overlapSeconds,
        totalDuration
      );

      // Initialize session
      currentSession.value = {
        id: chunkedTranscriptId,
        rawVideoId: rawVideoId,
        totalChunks: chunks.length,
        chunkDurationMinutes,
        overlapSeconds,
        totalDuration,
        completedChunks: 0,
        status: 'initializing',
        progress: 0,
        error: null,
      };

      return { success: true, sessionId: chunkedTranscriptId, chunks };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error.value = errorMessage;
      if (shouldShowErrorToast) {
        showError('Initialization failed', errorMessage);
      }
      return { success: false, error: errorMessage };
    } finally {
      isProcessing.value = false;
    }
  }

  async function storeChunkTranscription(
    sessionId: string,
    chunkIndex: number,
    chunkId: string,
    transcriptionResult: any,
    chunkStartTime: number,
    chunkEndTime: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!currentSession.value || currentSession.value.id !== sessionId) {
        throw new Error('No active session or session mismatch');
      }

      // Get chunked transcript to verify
      const chunkedTranscript = await getChunkedTranscriptByRawVideoId(
        currentSession.value.rawVideoId
      );
      if (!chunkedTranscript) {
        throw new Error('Chunked transcript not found');
      }

      // Store the chunk transcription
      const chunkText =
        transcriptionResult.text ||
        transcriptionResult.segments?.map((seg: any) => seg.text).join(' ') ||
        '';

      const chunkLanguage = transcriptionResult.language || 'english';
      const chunkSize = JSON.stringify(transcriptionResult).length;

      // Use the original chunk timing from the audio chunking, not the Whisper duration
      // chunkStartTime/chunkEndTime represent where this chunk exists in the original video
      await storeTranscriptChunk(
        chunkedTranscript.id,
        chunkIndex,
        chunkId,
        chunkStartTime,
        chunkEndTime,
        JSON.stringify(transcriptionResult),
        chunkText,
        chunkSize,
        chunkLanguage
      );

      // Update session progress
      currentSession.value.completedChunks += 1;
      currentSession.value.progress =
        (currentSession.value.completedChunks / currentSession.value.totalChunks) * 100;

      // Check if all chunks are complete
      await updateChunkedTranscriptCompleteness(chunkedTranscript.id);

      // Update session status if complete
      if (currentSession.value.completedChunks >= currentSession.value.totalChunks) {
        currentSession.value.status = 'completed';
        if (shouldShowCompletionToast) {
          showSuccess(
            'Transcription complete',
            `All ${currentSession.value.totalChunks} chunks transcribed and cached`
          );
        }
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  }

  async function getCachedChunkMetadata(rawVideoId: string): Promise<{
    hasCachedTranscript: boolean;
    chunks: Array<{
      chunk_id: string;
      chunk_index: number;
      start_time: number;
      end_time: number;
      raw_json: string;
    }>;
    totalDuration: number;
    language: string | null;
  } | null> {
    try {
      const metadata = await getChunkMetadataForProcessing(rawVideoId);

      if (metadata) {
        // Map the property name to match expected interface
        return {
          hasCachedTranscript: metadata.hasChunkedTranscript,
          chunks: metadata.chunks,
          totalDuration: metadata.totalDuration,
          language: metadata.language,
        };
      }

      return metadata;
    } catch (err) {
      return null;
    }
  }

  async function getReconstructedTranscript(rawVideoId: string): Promise<any | null> {
    try {
      const chunkedTranscript = await getChunkedTranscriptByRawVideoId(rawVideoId);
      if (!chunkedTranscript || !chunkedTranscript.is_complete) {
        return null;
      }

      const chunks = await getTranscriptChunks(chunkedTranscript.id);
      if (chunks.length === 0) {
        return null;
      }

      // Sort chunks by index
      chunks.sort((a, b) => a.chunk_index - b.chunk_index);

      // Reconstruct full transcript from chunks
      const allSegments = chunks.flatMap((chunk) => {
        const chunkData = JSON.parse(chunk.raw_json);
        return chunkData.segments || [];
      });

      const allWords = chunks.flatMap((chunk) => {
        const chunkData = JSON.parse(chunk.raw_json);
        return chunkData.words || [];
      });

      const combinedText = chunks
        .map((chunk) => chunk.text)
        .join(' ')
        .trim();

      const reconstructedTranscript = {
        duration: chunkedTranscript.total_duration,
        text: combinedText,
        segments: allSegments,
        words: allWords,
        language: chunkedTranscript.language,
        chunk_reconstruction_metadata: {
          chunks_processed: chunks.length,
          total_segments: allSegments.length,
          total_words: allWords.length,
          reconstructed_at: new Date().toISOString(),
          chunk_ids: chunks.map((chunk) => chunk.chunk_id),
          chunked_transcript_id: chunkedTranscript.id,
        },
      };

      return reconstructedTranscript;
    } catch (err) {
      return null;
    }
  }

  async function clearCachedTranscript(
    _rawVideoId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // This would delete the chunked transcript and all its chunks
      // Implementation depends on whether we want to support clearing cache
      return { success: false, error: 'Clear cache not implemented' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  }

  function resetSession() {
    currentSession.value = null;
    error.value = null;
  }

  return {
    // State
    currentSession,
    isProcessing,
    error,

    // Computed
    sessionProgress,
    sessionStatus,
    hasActiveSession,

    // Methods
    initializeChunkedTranscriptSession,
    storeChunkTranscription,
    getCachedChunkMetadata,
    getReconstructedTranscript,
    clearCachedTranscript,
    resetSession,
  };
}
