import { ref } from 'vue';
import {
  getRawVideosByProjectId,
  persistClipDetectionResults,
  getTranscriptByRawVideoId,
  getTranscriptChunks,
  type RawVideo,
} from '@/services/database';
import { useChunkedTranscriptCache } from './useChunkedTranscriptCache';
import { useVideoOperations } from './useVideoOperations';
import { useToast } from '@/composables/useToast';
import { useFocalPointDetection } from '@/composables/useFocalPointDetection';
import api from '@/services/api';

import { type AudioChunk } from './useAudioChunking';

export interface ChunkedDetectionOptions {
  chunkDurationMinutes?: number;
  overlapSeconds?: number;
  forceReprocess?: boolean;
  organizationId?: number | null; // For org credit deduction
  startTime?: number; // Start time in seconds for detection range
  endTime?: number; // End time in seconds for detection range
  subtitleSettings?: { enabled: boolean; presetId: string } | null;
  /** Enhanced VOD detection: transcript + video + audio (2× detection credits). */
  enhanced?: boolean;
  /** Optional streamer / project context for AI detection (platform, display name, reach tier). */
  streamerMetadata?: Record<string, unknown> | null;
}

/** Matches server @enhanced_vod_chunk_duration_seconds (15 min). */
const ENHANCED_CHUNK_DURATION_SECONDS = 900;

interface VideoChunkRange {
  startTime: number;
  endTime: number;
}

export interface DetectionProgress {
  stage:
    | 'initializing'
    | 'checking_cache'
    | 'extracting_chunks'
    | 'extracting_video'
    | 'transcribing_chunks'
    | 'detecting_clips'
    | 'completed'
    | 'cancelled'
    | 'error';
  progress: number;
  message: string;
  error?: string;
  jobId?: string;
  creditsRefunded?: number;
}

export function useChunkedClipDetection() {
  const isProcessing = ref(false);
  const isCancelled = ref(false);
  const progress = ref<DetectionProgress>({
    stage: 'initializing',
    progress: 0,
    message: '',
  });
  const { success: showSuccess, error: showError } = useToast();

  // AbortController for canceling API requests
  let abortController: AbortController | null = null;

  // Shared transcript cache instance to maintain session state across functions
  const transcriptCache = useChunkedTranscriptCache();

  // Track the current project ID for server-side cancellation
  let currentProjectId: string | null = null;

  // Track organization ID for credit deduction
  let currentOrganizationId: number | null = null;

  // Track subtitle settings for clip persistence
  let currentSubtitleSettings: { enabled: boolean; presetId: string } | null = null;

  // Optional creator reach context for AI detection.
  let currentStreamerMetadata: Record<string, unknown> | null = null;

  // Enhanced VOD detection (transcript + video + audio)
  let currentEnhanced = false;

  function getApiErrorResponse(error: unknown): { status?: number; data?: any } | null {
    const response = (error as { response?: { status?: number; data?: any } } | null)?.response;
    return response ?? null;
  }

  function formatCreditAmount(value: unknown): string {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value ?? 0);
    return numeric.toFixed(3).replace(/\.?0+$/, '');
  }

  function getErrorMessage(error: unknown): string {
    const response = getApiErrorResponse(error);
    const data = response?.data;

    if (response?.status === 402) {
      const details = typeof data?.details === 'string' ? data.details : '';
      const required = data?.credits_required;
      const remaining = data?.credits_remaining;
      const refunded = Number(data?.credits_refunded ?? 0);

      if (details) return `Insufficient credits. ${details}`;

      if (required !== undefined && remaining !== undefined) {
        const base = `Insufficient credits. You have ${formatCreditAmount(remaining)} credits, but ${formatCreditAmount(required)} are required.`;
        return refunded > 0
          ? `${base} ${formatCreditAmount(refunded)} transcription credits were refunded.`
          : base;
      }

      return 'Insufficient credits for this operation.';
    }

    if (typeof data?.details === 'string') return data.details;
    if (typeof data?.error === 'string') return data.error;
    return error instanceof Error ? error.message : String(error);
  }

  // Cancel the current detection process and request server-side refund
  async function cancelDetection() {
    if (!isProcessing.value) return;

    console.log('[ChunkedClipDetection] Cancelling detection...');
    isCancelled.value = true;

    // Abort any pending API requests
    if (abortController) {
      abortController.abort();
      abortController = null;
    }

    // Kill any running FFmpeg processes on the Rust side
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('cancel_audio_extraction');
      console.log('[ChunkedClipDetection] Cancelled FFmpeg audio extraction processes');
    } catch (err) {
      console.warn('[ChunkedClipDetection] Failed to cancel audio extraction:', err);
    }

    // Request server-side cancellation and refund
    let creditsRefunded = 0;
    if (currentProjectId) {
      try {
        console.log(
          '[ChunkedClipDetection] Requesting server-side cancellation for project:',
          currentProjectId
        );
        const response = await api.post('/jobs/cancel-by-project', {
          project_id: currentProjectId,
        });

        if (response.data.success) {
          creditsRefunded = response.data.credits_refunded || 0;
          console.log('[ChunkedClipDetection] Server refunded', creditsRefunded, 'credits');
        }
      } catch (error) {
        // Server cancellation failed - might not have charged yet, or job completed
        console.log('[ChunkedClipDetection] Server cancellation response:', error);
      }
    }

    progress.value = {
      stage: 'cancelled',
      progress: 0,
      message:
        creditsRefunded > 0
          ? `Detection cancelled. ${creditsRefunded.toFixed(3)} credits refunded.`
          : 'Detection cancelled by user',
      creditsRefunded: creditsRefunded,
    };

    currentProjectId = null;
    isProcessing.value = false;
  }

  // Check if detection was cancelled
  function checkCancelled(): boolean {
    if (isCancelled.value) {
      throw new Error('Detection cancelled by user');
    }
    return false;
  }

  async function detectClipsWithChunking(
    projectId: string,
    prompt: string,
    options: ChunkedDetectionOptions = {}
  ): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
    cancelled?: boolean;
    jobId?: string;
  }> {
    try {
      // Reset cancellation state
      isCancelled.value = false;
      abortController = new AbortController();

      // Store project ID for server-side cancellation
      currentProjectId = projectId;

      // Store organization ID for credit deduction
      currentOrganizationId = options.organizationId ?? null;

      console.log('[ChunkedClipDetection] Options received:', JSON.stringify(options));
      currentSubtitleSettings = options.subtitleSettings ?? null;
      currentStreamerMetadata = options.streamerMetadata ?? null;

      isProcessing.value = true;
      progress.value = {
        stage: 'initializing',
        progress: 0,
        message: 'Initializing clip detection...',
      };

      const {
        chunkDurationMinutes = 15,
        overlapSeconds = 30,
        forceReprocess = false,
        startTime = 0,
        endTime = 0,
      } = options;

      // Get project video
      const rawVideos = await getRawVideosByProjectId(projectId);
      if (rawVideos.length === 0) {
        throw new Error('No video found for project');
      }

      const projectVideo = rawVideos[0];

      // Trigger focal point detection in background (non-blocking)
      const { detectFocalPointsBackground } = useFocalPointDetection();
      detectFocalPointsBackground(projectVideo.id, projectVideo.file_path, 5).catch((error) => {
        console.warn('[ClipDetection] Focal point detection failed (non-critical):', error);
      });

      // Check for existing regular transcript first
      const existingTranscript = await getTranscriptByRawVideoId(projectVideo.id);

      if (existingTranscript && !forceReprocess) {
        return await processWithTraditionalTranscript(projectId, prompt, existingTranscript, projectVideo);
      }

      // Initialize chunked transcript cache
      progress.value = {
        stage: 'checking_cache',
        progress: 10,
        message: 'Checking for cached chunks...',
      };

      const { initializeChunkedTranscriptSession, getCachedChunkMetadata } = transcriptCache;

      // Check for existing cached chunks unless forcing reprocess
      if (!forceReprocess) {
        const cachedMetadata = await getCachedChunkMetadata(projectVideo.id);

        if (
          cachedMetadata &&
          cachedMetadata.hasCachedTranscript &&
          cachedMetadata.chunks &&
          cachedMetadata.chunks.length > 0
        ) {
          return await processWithCachedChunks(
            projectId,
            prompt,
            cachedMetadata,
            projectVideo,
            startTime,
            endTime
          );
        } else if (
          cachedMetadata &&
          cachedMetadata.hasCachedTranscript &&
          (!cachedMetadata.chunks || cachedMetadata.chunks.length === 0)
        ) {
          // Fall back to traditional processing if chunks are empty
          const existingTranscript = await getTranscriptByRawVideoId(projectVideo.id);
          if (existingTranscript) {
            return await processWithTraditionalTranscript(
              projectId,
              prompt,
              existingTranscript,
              projectVideo,
              startTime,
              endTime
            );
          }
          // If no traditional transcript either, continue with fresh audio processing
        }
      }

      // No cache found, proceed with fresh chunking
      progress.value = {
        stage: 'extracting_chunks',
        progress: 20,
        message: 'Extracting audio chunks...',
      };

      const sessionResult = await initializeChunkedTranscriptSession(
        projectVideo.id,
        chunkDurationMinutes,
        overlapSeconds,
        startTime,
        endTime
      );

      if (!sessionResult.success || !sessionResult.sessionId) {
        throw new Error(sessionResult.error || 'Failed to initialize chunked transcript session');
      }

      // Process chunks if available
      if (sessionResult.chunks && sessionResult.chunks.length > 0) {
        // If chunks came from an existing session, we may need to skip those already transcribed.
        // sessionResult.chunks contains AudioChunk[] which is raw audio.

        // Filter out chunks that are already transcribed if we are resuming?
        // But sessionResult usually returns fresh chunks from audio extraction if it ran extraction.
        // If initializeChunkedTranscriptSession found existing chunks, it returns them.

        // Let's assume processWithChunks handles checks or we force re-process if we are here.
        // Actually, if we just extracted them, we need to transcribe.

        return await processWithChunks(
          projectId,
          sessionResult.sessionId,
          prompt,
          sessionResult.chunks,
          projectVideo,
          startTime,
          endTime
        );
      }

      // Fallback to traditional detection with audio extraction if no chunks
      progress.value = {
        stage: 'detecting_clips',
        progress: 50,
        message: 'Processing audio for clip detection...',
      };

      return await processWithFreshAudio(projectId, prompt, projectVideo, startTime, endTime);
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      // Check if this was a cancellation
      if (
        isCancelled.value ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('aborted')
      ) {
        progress.value = {
          stage: 'cancelled',
          progress: 0,
          message: 'Detection cancelled by user',
        };
        return { success: false, cancelled: true };
      }

      progress.value = {
        stage: 'error',
        progress: 0,
        message: 'Detection failed',
        error: errorMessage,
      };

      showError('Clip detection failed', errorMessage, undefined, 'clips');
      return { success: false, error: errorMessage };
    } finally {
      // Always kill any orphaned FFmpeg processes when detection ends (error, cancel, or success)
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('cancel_audio_extraction');
      } catch (_) {
        // Ignore - may not have any active processes
      }
      isProcessing.value = false;
      abortController = null;
      currentProjectId = null;
      currentStreamerMetadata = null;
      currentEnhanced = false;
    }
  }

  function filterChunksByTimeRange<T extends { start_time: number; end_time: number }>(
    chunks: T[],
    startTime: number,
    endTime: number
  ): T[] {
    const sorted = [...chunks].sort((a, b) => a.start_time - b.start_time);
    if (startTime <= 0 && endTime <= 0) {
      return sorted;
    }
    return sorted.filter((chunk) => {
      return chunk.end_time > startTime && (endTime <= 0 || chunk.start_time < endTime);
    });
  }

  function computeFixedVideoChunkRanges(
    totalDuration: number,
    rangeStart: number,
    rangeEnd: number
  ): VideoChunkRange[] {
    const effectiveStart = Math.max(0, rangeStart);
    const effectiveEnd = rangeEnd > 0 ? Math.min(rangeEnd, totalDuration) : totalDuration;
    if (effectiveEnd <= effectiveStart) {
      return [];
    }

    const ranges: VideoChunkRange[] = [];
    let cursor = effectiveStart;
    while (cursor < effectiveEnd) {
      const chunkEnd = Math.min(cursor + ENHANCED_CHUNK_DURATION_SECONDS, effectiveEnd);
      ranges.push({ startTime: cursor, endTime: chunkEnd });
      cursor = chunkEnd;
    }
    return ranges;
  }

  async function appendEnhancedVideoChunks(
    formData: FormData,
    videoPath: string,
    ranges: VideoChunkRange[]
  ): Promise<void> {
    if (ranges.length === 0) {
      throw new Error('Enhanced detection requires at least one video chunk');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    const { readFile, remove } = await import('@tauri-apps/plugin-fs');

    for (let i = 0; i < ranges.length; i++) {
      checkCancelled();
      const { startTime, endTime } = ranges[i];

      progress.value = {
        stage: 'extracting_video',
        progress: 50 + (i / ranges.length) * 10,
        message: `Extracting video chunk ${i + 1}/${ranges.length} for enhanced analysis...`,
      };

      const tempPath = await invoke<string>('extract_video_chunk_for_analysis', {
        videoPath,
        startTimeSecs: startTime,
        endTimeSecs: endTime,
      });

      try {
        const bytes = await readFile(tempPath);
        const blob = new Blob([bytes], { type: 'video/mp4' });
        const file = new File([blob], `video_chunk_${i}.mp4`, { type: 'video/mp4' });
        formData.append(`video_chunk_${i}`, file);
      } finally {
        await remove(tempPath).catch(() => {});
      }
    }
  }

  async function appendDetectionFormFields(
    formData: FormData,
    projectVideo: RawVideo,
    startTime: number,
    endTime: number,
    videoChunkRanges?: VideoChunkRange[]
  ): Promise<void> {
    if (currentEnhanced) {
      formData.append('enhanced', 'true');
      const ranges =
        videoChunkRanges ??
        computeFixedVideoChunkRanges(
          projectVideo.duration ?? 0,
          startTime,
          endTime > 0 ? endTime : (projectVideo.duration ?? 0)
        );
      await appendEnhancedVideoChunks(formData, projectVideo.file_path, ranges);
    }
  }

  async function processWithChunks(
    projectId: string,
    sessionId: string,
    prompt: string,
    chunks: AudioChunk[],
    projectVideo: RawVideo,
    startTime: number = 0,
    endTime: number = 0
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      progress.value = {
        stage: 'transcribing_chunks',
        progress: 30,
        message: `Transcribing ${chunks.length} chunks...`,
      };

      // Check for already transcribed chunks to avoid re-work
      const existingChunks = await getTranscriptChunks(sessionId);
      const transcribedChunkIds = new Set(existingChunks.map((c) => c.chunk_id));
      const { storeChunkTranscription, getCachedChunkMetadata } = transcriptCache;
      const totalChunks = chunks.length;

      // Track how many chunks have completed for progress reporting
      let completedChunks = 0;

      // Transcribe a single chunk with retry logic
      const transcribeChunk = async (chunk: AudioChunk, i: number): Promise<void> => {
        checkCancelled();

        if (transcribedChunkIds.has(chunk.chunk_id)) {
          console.log(`Chunk ${chunk.chunk_id} already transcribed, skipping.`);
          completedChunks++;
          return;
        }

        // Convert base64 to Blob/File
        const binaryString = atob(chunk.base64_data);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }

        // Use audio/mpeg for MP3 compatibility
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const audioFile = new File([blob], chunk.filename, { type: 'audio/mpeg' });

        // Prepare upload
        const formData = new FormData();
        formData.append('project_id', projectId);
        formData.append('audio', audioFile);
        formData.append('duration', chunk.duration.toString());
        if (currentOrganizationId) {
          formData.append('organization_id', currentOrganizationId.toString());
        }
        if (currentEnhanced) {
          formData.append('enhanced', 'true');
        }
        appendStreamerMetadata(formData);

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
                `[ChunkTranscribe] Chunk ${i + 1} failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`
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
          progress: 30 + (completedChunks / totalChunks) * 20, // 30% to 50%
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

      // All chunks transcribed. Now use cached metadata flow.
      progress.value = {
        stage: 'transcribing_chunks',
        progress: 50,
        message: 'All chunks transcribed. Preparing detection...',
      };

      const cachedMetadata = await getCachedChunkMetadata(projectVideo.id);
      if (!cachedMetadata) {
        throw new Error('Failed to retrieve cached metadata after transcription');
      }

      return await processWithCachedChunks(
        projectId,
        prompt,
        cachedMetadata,
        projectVideo,
        startTime,
        endTime
      );
    } catch (e) {
      throw e;
    }
  }

  async function processWithCachedChunks(
    projectId: string,
    prompt: string,
    cachedMetadata: any,
    projectVideo: RawVideo,
    startTime: number = 0,
    endTime: number = 0
  ): Promise<{ success: boolean; sessionId?: string; error?: string; jobId?: string }> {
    try {
      progress.value = {
        stage: 'detecting_clips',
        progress: 40,
        message: 'Detecting clips using cached transcript...',
      };

      // Prepare request with cached chunks
      const formData = new FormData();
      formData.append('project_id', projectId.toString());
      formData.append('prompt', prompt);
      formData.append('using_cached_transcript', 'true');
      if (currentOrganizationId) {
        formData.append('organization_id', currentOrganizationId.toString());
      }
      appendStreamerMetadata(formData);

      // Send chunk metadata instead of full transcript
      formData.append('chunks', JSON.stringify(cachedMetadata.chunks));
      formData.append('total_duration', cachedMetadata.totalDuration.toString());
      formData.append('language', cachedMetadata.language || 'english');

      // Add time range parameters if specified
      if (startTime > 0 || endTime > 0) {
        formData.append('start_time', startTime.toString());
        formData.append('end_time', endTime.toString());
      }

      if (currentEnhanced) {
        const filteredChunks = filterChunksByTimeRange(cachedMetadata.chunks, startTime, endTime);
        const videoRanges = filteredChunks.map((chunk) => ({
          startTime: chunk.start_time,
          endTime: chunk.end_time,
        }));
        await appendDetectionFormFields(
          formData,
          projectVideo,
          startTime,
          endTime,
          videoRanges
        );
      }

      progress.value = {
        stage: 'detecting_clips',
        progress: 60,
        message: currentEnhanced
          ? 'Running enhanced detection (video + transcript)...'
          : 'Analyzing cached transcript for clips...',
      };

      // Check for cancellation before API call
      checkCancelled();

      // Call the chunked detection endpoint with abort signal
      // Use extended timeout (20 minutes) since AI processing each chunk can take 1-2 min
      let response;
      try {
        response = await api.post('/clips/detect-chunked', formData, {
          headers: {
            'Content-Type': undefined,
          },
          signal: abortController?.signal,
          timeout: currentEnhanced ? 3600000 : 1200000, // Enhanced: up to 60 min
        });
      } catch (err: any) {
        if (err?.response?.status === 402) {
          const msg = getErrorMessage(err);
          showError('Insufficient Credits', msg, undefined, 'clips');
          progress.value = {
            stage: 'error',
            progress: 0,
            message: 'Detection failed',
            error: msg,
          };
          return { success: false, error: msg };
        }
        throw err;
      }

      const result = response.data;

      if (!result.success) {
        throw new Error(result.error || 'Clip detection failed');
      }

      progress.value = {
        stage: 'completed',
        progress: 100,
        message: 'Clip detection completed!',
      };

      // Store results in database
      const sessionId = await persistClipDetectionResults(
        projectId,
        prompt,
        result,
        {
          processingTimeMs: 0, // Cached processing is fast
          detectionModel: 'claude-3.5-sonnet-chunked',
          serverResponseId: result.jobId || null,
          videoFilePath: projectVideo.file_path,
          rawVideoId: projectVideo.id,
        },
        currentSubtitleSettings
      );

      // IMPORTANT: When using cached chunks, the full transcript isn't part of the response.
      // We need to stitch the chunked transcripts together and save it as the project transcript
      // so the TranscriptPanel can display it.

      const { createTranscript, createTranscriptSegment, getTranscriptByProjectId } =
        await import('@/services/database');
      const existingTranscript = await getTranscriptByProjectId(projectId);

      if (!existingTranscript) {
        try {
          // Fetch all chunks from the database
          const { getTranscriptChunks, getChunkedTranscriptByRawVideoId } =
            await import('@/services/database');
          const rawVideos = await getRawVideosByProjectId(projectId);

          if (rawVideos.length > 0) {
            const chunkedTranscript = await getChunkedTranscriptByRawVideoId(rawVideos[0].id);

            if (chunkedTranscript) {
              const chunks = await getTranscriptChunks(chunkedTranscript.id);

              // Combine chunks into a full transcript
              let fullText = '';
              let combinedSegments: any[] = [];
              let combinedWords: any[] = [];

              for (const chunk of chunks) {
                try {
                  const chunkData = JSON.parse(chunk.raw_json);
                  if (chunkData.text) fullText += chunkData.text + ' ';

                  if (chunkData.segments && Array.isArray(chunkData.segments)) {
                    // Adjust segment times by chunk start time
                    const adjustedSegments = chunkData.segments.map((seg: any) => ({
                      ...seg,
                      start: (seg.start || 0) + chunk.start_time,
                      end: (seg.end || 0) + chunk.start_time,
                      // Adjust word times if available
                      words: seg.words?.map((w: any) => ({
                        ...w,
                        start: (w.start || 0) + chunk.start_time,
                        end: (w.end || 0) + chunk.start_time,
                      })),
                    }));
                    combinedSegments.push(...adjustedSegments);

                    // Also extract all words for flat structure if needed
                    adjustedSegments.forEach((seg: any) => {
                      if (seg.words) combinedWords.push(...seg.words);
                    });
                  }
                } catch (e) {
                  console.warn('Failed to parse chunk JSON', e);
                }
              }

              // Construct minimal Whisper-compatible JSON for the full transcript
              const fullTranscriptJson = {
                text: fullText.trim(),
                segments: combinedSegments,
                language: chunkedTranscript.language || 'english',
                duration: chunkedTranscript.total_duration,
              };

              // Save to database
              const transcriptId = await createTranscript(
                rawVideos[0].id,
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

              console.log('[ChunkedDetection] Successfully created full transcript from chunks');

              // Trigger a refresh of transcript data in the UI
              setTimeout(() => {
                // Emit a custom event that TranscriptPanel and Timeline can listen to
                // Or just rely on reactivity if the project ID is the same
                // If using database service, we might need to invalidate queries?
                // Usually reloading data in components works.

                // Force a UI refresh of the transcript panel by re-fetching data
                // Since useTranscriptData watches projectId, maybe we don't need anything extra
                // but if it's already loaded as null, we need to trigger a reload.
                const refreshEvent = new CustomEvent('transcript-updated', {
                  detail: { projectId: projectId },
                });
                document.dispatchEvent(refreshEvent);
              }, 500);
            }
          }
        } catch (err) {
          console.error('[ChunkedDetection] Failed to create full transcript from chunks:', err);
        }
      }

      showSuccess(
        'Clips detected',
        `Found ${result.clips?.length || 0} clips using cached transcript`,
        undefined,
        'clips'
      );

      return { success: true, sessionId };
    } catch (error) {
      console.error('[ChunkedClipDetection] processWithCachedChunks FAILED:', error);
      console.error(
        '[ChunkedClipDetection] Error stack:',
        error instanceof Error ? error.stack : 'no stack'
      );
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  async function processWithTraditionalTranscript(
    projectId: string,
    prompt: string,
    existingTranscript: any,
    projectVideo: RawVideo,
    startTime: number = 0,
    endTime: number = 0
  ): Promise<{ success: boolean; sessionId?: string; error?: string; cancelled?: boolean }> {
    try {
      progress.value = {
        stage: 'detecting_clips',
        progress: 60,
        message: 'Detecting clips using existing transcript...',
      };

      // Prepare request with cached transcript
      const formData = new FormData();
      formData.append('project_id', projectId.toString());
      formData.append('prompt', prompt);
      formData.append('using_cached_transcript', 'true');
      if (currentOrganizationId) {
        formData.append('organization_id', currentOrganizationId.toString());
      }
      appendStreamerMetadata(formData);

      // Send cached transcript
      formData.append(
        'transcript',
        JSON.stringify({
          id: existingTranscript.id,
          raw_response: existingTranscript.raw_json,
          text: existingTranscript.text,
          language: existingTranscript.language,
          duration: existingTranscript.duration,
        })
      );

      if (startTime > 0 || endTime > 0) {
        formData.append('start_time', startTime.toString());
        if (endTime > 0) {
          formData.append('end_time', endTime.toString());
        }
      }

      const transcriptDuration =
        existingTranscript.duration ?? projectVideo.duration ?? 0;
      const effectiveEnd = endTime > 0 ? endTime : transcriptDuration;
      await appendDetectionFormFields(
        formData,
        { ...projectVideo, duration: transcriptDuration },
        startTime,
        effectiveEnd
      );

      progress.value = {
        stage: 'detecting_clips',
        progress: 80,
        message: currentEnhanced
          ? 'Running enhanced detection (video + transcript)...'
          : 'Analyzing transcript for clips...',
      };

      // Check for cancellation before API call
      checkCancelled();

      const response = await api.post('/clips/detect', formData, {
        headers: {
          'Content-Type': undefined,
        },
        signal: abortController?.signal,
        timeout: currentEnhanced ? 3600000 : 900000,
      });

      const result = response.data;

      if (!result.success) {
        throw new Error(result.error || 'Clip detection failed');
      }

      progress.value = {
        stage: 'completed',
        progress: 100,
        message: 'Clip detection completed!',
      };

      // Store results in database
      const sessionId = await persistClipDetectionResults(
        projectId,
        prompt,
        result,
        {
          processingTimeMs: 0,
          detectionModel: 'claude-3.5-sonnet-traditional',
          serverResponseId: result.jobId || null,
          videoFilePath: projectVideo.file_path,
          rawVideoId: projectVideo.id,
        },
        currentSubtitleSettings
      );

      showSuccess('Clips detected', `Found ${result.clips?.length || 0} clips`, undefined, 'clips');

      return { success: true, sessionId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Check if this was a cancellation
      if (
        isCancelled.value ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('aborted')
      ) {
        return { success: false, cancelled: true };
      }
      return { success: false, error: errorMessage };
    }
  }

  async function processWithFreshAudio(
    projectId: string,
    prompt: string,
    projectVideo: RawVideo,
    startTime: number = 0,
    endTime: number = 0
  ): Promise<{ success: boolean; sessionId?: string; error?: string; cancelled?: boolean }> {
    try {
      // Trigger focal point detection in background (non-blocking)
      const { detectFocalPointsBackground } = useFocalPointDetection();
      detectFocalPointsBackground(projectVideo.id, projectVideo.file_path, 5).catch((error) => {
        console.warn('[ClipDetection] Focal point detection failed (non-critical):', error);
      });

      progress.value = {
        stage: 'transcribing_chunks',
        progress: 40,
        message: 'Transcribing audio...',
      };

      // Generate audio file using existing FFmpeg function
      const { invoke } = await import('@tauri-apps/api/core');
      const [filename, base64Data] = await invoke<[string, string]>('extract_audio_from_video', {
        videoPath: projectVideo.file_path,
        outputPath: 'temp_audio_audio_only.mp3',
      });

      // Convert base64 back to binary
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create Blob and File
      const blob = new Blob([bytes], { type: 'audio/ogg' });
      const audioFile = new File([blob], filename, { type: 'audio/ogg' });

      // Check for cancellation before API call
      checkCancelled();

      // Prepare request with fresh audio
      const formData = new FormData();
      formData.append('project_id', projectId.toString());
      formData.append('prompt', prompt);
      formData.append('using_cached_transcript', 'false');
      formData.append('audio', audioFile, audioFile.name);
      if (projectVideo.duration) {
        formData.append('duration', projectVideo.duration.toString());
      }
      if (currentOrganizationId) {
        formData.append('organization_id', currentOrganizationId.toString());
      }
      appendStreamerMetadata(formData);

      if (startTime > 0 || endTime > 0) {
        formData.append('start_time', startTime.toString());
        if (endTime > 0) {
          formData.append('end_time', endTime.toString());
        }
      }

      const effectiveEnd = endTime > 0 ? endTime : (projectVideo.duration ?? 0);
      await appendDetectionFormFields(formData, projectVideo, startTime, effectiveEnd);

      progress.value = {
        stage: 'detecting_clips',
        progress: 75,
        message: currentEnhanced
          ? 'Running enhanced detection (video + transcript)...'
          : 'Detecting clips...',
      };

      const response = await api.post('/clips/detect', formData, {
        headers: {
          'Content-Type': undefined,
        },
        signal: abortController?.signal,
        timeout: currentEnhanced ? 3600000 : 900000,
      });

      const result = response.data;

      if (!result.success) {
        throw new Error(result.error || 'Clip detection failed');
      }

      progress.value = {
        stage: 'completed',
        progress: 100,
        message: 'Clip detection completed!',
      };

      // Store results in database
      const sessionId = await persistClipDetectionResults(
        projectId,
        prompt,
        result,
        {
          processingTimeMs: 0,
          detectionModel: currentEnhanced ? 'gemini-enhanced-vod' : 'claude-3.5-sonnet-fresh',
          enhanced: currentEnhanced,
          serverResponseId: result.jobId || null,
          videoFilePath: projectVideo.file_path,
          rawVideoId: projectVideo.id,
        },
        currentSubtitleSettings
      );

      showSuccess('Clips detected', `Found ${result.clips?.length || 0} clips`, undefined, 'clips');

      return { success: true, sessionId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Check if this was a cancellation
      if (
        isCancelled.value ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('aborted')
      ) {
        return { success: false, cancelled: true };
      }
      return { success: false, error: errorMessage };
    }
  }

  async function fallbackToTraditionalDetection(
    projectId: string,
    prompt: string,
    projectVideo: RawVideo
  ): Promise<{ success: boolean; sessionId?: string; error?: string; cancelled?: boolean }> {
    try {
      progress.value = {
        stage: 'detecting_clips',
        progress: 50,
        message: 'Using traditional detection (fallback)...',
      };

      // Generate audio file
      const { prepareVideoForChunking } = useVideoOperations();
      const audioResult = await prepareVideoForChunking(projectVideo.file_path, projectId);

      if (!audioResult.success) {
        throw new Error(audioResult.error || 'Failed to prepare audio');
      }

      // Use traditional single-file detection
      const formData = new FormData();

      // For now, we'll create a single audio chunk from the chunks
      if (audioResult.chunks && audioResult.chunks.length > 0) {
        // Use the first chunk as a fallback
        const firstChunk = audioResult.chunks[0];
        const audioBlob = new Blob([Buffer.from(firstChunk.base64_data, 'base64')], {
          type: 'audio/ogg',
        });
        const audioFile = new File([audioBlob], firstChunk.filename, { type: 'audio/ogg' });
        formData.append('audio', audioFile);
      } else {
        throw new Error('No audio chunks available for fallback');
      }

      formData.append('project_id', projectId.toString());
      formData.append('prompt', prompt);
      formData.append('using_cached_transcript', 'false');
      if (projectVideo.duration) {
        formData.append('duration', projectVideo.duration.toString());
      }
      if (currentOrganizationId) {
        formData.append('organization_id', currentOrganizationId.toString());
      }
      appendStreamerMetadata(formData);

      const effectiveEnd = projectVideo.duration ?? 0;
      await appendDetectionFormFields(formData, projectVideo, 0, effectiveEnd);

      progress.value = {
        stage: 'detecting_clips',
        progress: 70,
        message: currentEnhanced
          ? 'Running enhanced detection (video + transcript)...'
          : 'Analyzing transcript for clips...',
      };

      // Check for cancellation before API call
      checkCancelled();

      const response = await api.post('/clips/detect', formData, {
        headers: {
          'Content-Type': undefined,
        },
        signal: abortController?.signal,
        timeout: currentEnhanced ? 3600000 : 900000,
      });

      const result = response.data;

      if (!result.success) {
        throw new Error(result.error || 'Clip detection failed');
      }

      progress.value = {
        stage: 'completed',
        progress: 100,
        message: 'Clip detection completed!',
      };

      // Store results in database
      const sessionId = await persistClipDetectionResults(
        projectId,
        prompt,
        result,
        {
          processingTimeMs: 0,
          detectionModel: currentEnhanced ? 'gemini-enhanced-vod' : 'claude-3.5-sonnet-fallback',
          enhanced: currentEnhanced,
          serverResponseId: result.jobId || null,
          videoFilePath: projectVideo.file_path,
          rawVideoId: projectVideo.id,
        },
        currentSubtitleSettings
      );

      showSuccess('Clips detected', `Found ${result.clips?.length || 0} clips`, undefined, 'clips');

      return { success: true, sessionId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Check if this was a cancellation
      if (
        isCancelled.value ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('aborted')
      ) {
        return { success: false, cancelled: true };
      }
      return { success: false, error: errorMessage };
    }
  }

  function reset() {
    isProcessing.value = false;
    isCancelled.value = false;
    abortController = null;
    currentProjectId = null;
    currentOrganizationId = null;
    currentStreamerMetadata = null;
    currentEnhanced = false;
    progress.value = { stage: 'initializing', progress: 0, message: '' };
  }

  function appendStreamerMetadata(formData: FormData) {
    if (currentStreamerMetadata) {
      formData.append('streamer_metadata', JSON.stringify(currentStreamerMetadata));
    }
  }

  return {
    // State
    isProcessing,
    isCancelled,
    progress,

    // Methods
    detectClipsWithChunking,
    fallbackToTraditionalDetection,
    cancelDetection,
    reset,
  };
}
