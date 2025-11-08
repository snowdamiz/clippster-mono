import { ref } from 'vue';
import {
  getRawVideosByProjectId,
  persistClipDetectionResults,
  getTranscriptByRawVideoId,
  type RawVideo,
} from '@/services/database';
import { useChunkedTranscriptCache } from './useChunkedTranscriptCache';
import { useVideoOperations } from './useVideoOperations';
import { useToast } from '@/composables/useToast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface ChunkedDetectionOptions {
  chunkDurationMinutes?: number;
  overlapSeconds?: number;
  forceReprocess?: boolean;
}

export interface DetectionProgress {
  stage:
    | 'initializing'
    | 'checking_cache'
    | 'extracting_chunks'
    | 'transcribing_chunks'
    | 'detecting_clips'
    | 'completed'
    | 'error';
  progress: number;
  message: string;
  error?: string;
}

export function useChunkedClipDetection() {
  const isProcessing = ref(false);
  const progress = ref<DetectionProgress>({
    stage: 'initializing',
    progress: 0,
    message: '',
  });
  const { success: showSuccess, error: showError } = useToast();

  async function detectClipsWithChunking(
    projectId: string,
    prompt: string,
    options: ChunkedDetectionOptions = {}
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      isProcessing.value = true;
      progress.value = {
        stage: 'initializing',
        progress: 0,
        message: 'Initializing clip detection...',
      };

      const { chunkDurationMinutes = 30, overlapSeconds = 30, forceReprocess = false } = options;

      // Get project video
      const rawVideos = await getRawVideosByProjectId(projectId);
      if (rawVideos.length === 0) {
        throw new Error('No video found for project');
      }

      const projectVideo = rawVideos[0];

      // Check for existing regular transcript first
      const existingTranscript = await getTranscriptByRawVideoId(projectVideo.id);

      if (existingTranscript && !forceReprocess) {
        return await processWithTraditionalTranscript(projectId, prompt, existingTranscript);
      }

      // Initialize chunked transcript cache
      progress.value = {
        stage: 'checking_cache',
        progress: 10,
        message: 'Checking for cached chunks...',
      };

      const { initializeChunkedTranscriptSession, getCachedChunkMetadata } =
        useChunkedTranscriptCache();

      // Check for existing cached chunks unless forcing reprocess
      if (!forceReprocess) {
        const cachedMetadata = await getCachedChunkMetadata(projectVideo.id);

        if (
          cachedMetadata &&
          cachedMetadata.hasCachedTranscript &&
          cachedMetadata.chunks &&
          cachedMetadata.chunks.length > 0
        ) {
          return await processWithCachedChunks(projectId, prompt, cachedMetadata, projectVideo);
        } else if (
          cachedMetadata &&
          cachedMetadata.hasCachedTranscript &&
          (!cachedMetadata.chunks || cachedMetadata.chunks.length === 0)
        ) {
          // Fall back to traditional processing if chunks are empty
          const existingTranscript = await getTranscriptByRawVideoId(projectVideo.id);
          if (existingTranscript) {
            return await processWithTraditionalTranscript(projectId, prompt, existingTranscript);
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
        overlapSeconds
      );

      if (!sessionResult.success || !sessionResult.sessionId) {
        throw new Error(sessionResult.error || 'Failed to initialize chunked transcript session');
      }

      // For now, fall back to traditional detection with audio extraction
      // TODO: Implement full chunked processing when server endpoint is ready
      progress.value = {
        stage: 'detecting_clips',
        progress: 50,
        message: 'Processing audio for clip detection...',
      };

      return await processWithFreshAudio(projectId, prompt, projectVideo);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      progress.value = {
        stage: 'error',
        progress: 0,
        message: 'Detection failed',
        error: errorMessage,
      };

      showError('Clip detection failed', errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      isProcessing.value = false;
    }
  }

  async function processWithCachedChunks(
    projectId: string,
    prompt: string,
    cachedMetadata: any,
    _projectVideo: RawVideo
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
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

      // Send chunk metadata instead of full transcript
      formData.append('chunks', JSON.stringify(cachedMetadata.chunks));
      formData.append('total_duration', cachedMetadata.totalDuration.toString());
      formData.append('language', cachedMetadata.language || 'english');

      progress.value = {
        stage: 'detecting_clips',
        progress: 60,
        message: 'Analyzing cached transcript for clips...',
      };

      // Call the chunked detection endpoint
      const response = await fetch(`${API_BASE}/api/clips/detect-chunked`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Clip detection failed');
      }

      progress.value = {
        stage: 'completed',
        progress: 100,
        message: 'Clip detection completed!',
      };

      // Store results in database
      const sessionId = await persistClipDetectionResults(projectId, prompt, result, {
        processingTimeMs: 0, // Cached processing is fast
        detectionModel: 'claude-3.5-sonnet-chunked',
        serverResponseId: result.jobId || null,
      });

      showSuccess(
        'Clips detected',
        `Found ${result.clips?.length || 0} clips using cached transcript`
      );

      return { success: true, sessionId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  async function processWithTraditionalTranscript(
    projectId: string,
    prompt: string,
    existingTranscript: any
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
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

      progress.value = {
        stage: 'detecting_clips',
        progress: 80,
        message: 'Analyzing transcript for clips...',
      };

      const response = await fetch(`${API_BASE}/api/clips/detect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Clip detection failed');
      }

      progress.value = {
        stage: 'completed',
        progress: 100,
        message: 'Clip detection completed!',
      };

      // Store results in database
      const sessionId = await persistClipDetectionResults(projectId, prompt, result, {
        processingTimeMs: 0,
        detectionModel: 'claude-3.5-sonnet-traditional',
        serverResponseId: result.jobId || null,
      });

      showSuccess('Clips detected', `Found ${result.clips?.length || 0} clips`);

      return { success: true, sessionId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  async function processWithFreshAudio(
    projectId: string,
    prompt: string,
    projectVideo: RawVideo
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      progress.value = {
        stage: 'transcribing_chunks',
        progress: 40,
        message: 'Transcribing audio...',
      };

      // Generate audio file using existing FFmpeg function
      const { invoke } = await import('@tauri-apps/api/core');
      const [filename, base64Data] = await invoke<[string, string]>('extract_audio_from_video', {
        videoPath: projectVideo.file_path,
        outputPath: 'temp_audio_audio_only.ogg',
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

      progress.value = {
        stage: 'detecting_clips',
        progress: 70,
        message: 'Detecting clips...',
      };

      // Prepare request with fresh audio
      const formData = new FormData();
      formData.append('project_id', projectId.toString());
      formData.append('prompt', prompt);
      formData.append('using_cached_transcript', 'false');
      formData.append('audio', audioFile, audioFile.name);

      const response = await fetch(`${API_BASE}/api/clips/detect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Clip detection failed');
      }

      progress.value = {
        stage: 'completed',
        progress: 100,
        message: 'Clip detection completed!',
      };

      // Store results in database
      const sessionId = await persistClipDetectionResults(projectId, prompt, result, {
        processingTimeMs: 0,
        detectionModel: 'claude-3.5-sonnet-fresh',
        serverResponseId: result.jobId || null,
      });

      showSuccess('Clips detected', `Found ${result.clips?.length || 0} clips`);

      return { success: true, sessionId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  async function fallbackToTraditionalDetection(
    projectId: string,
    prompt: string,
    projectVideo: RawVideo
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
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

      progress.value = {
        stage: 'detecting_clips',
        progress: 70,
        message: 'Analyzing transcript for clips...',
      };

      const response = await fetch(`${API_BASE}/api/clips/detect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Clip detection failed');
      }

      progress.value = {
        stage: 'completed',
        progress: 100,
        message: 'Clip detection completed!',
      };

      // Store results in database
      const sessionId = await persistClipDetectionResults(projectId, prompt, result, {
        processingTimeMs: 0,
        detectionModel: 'claude-3.5-sonnet-fallback',
        serverResponseId: result.jobId || null,
      });

      showSuccess('Clips detected', `Found ${result.clips?.length || 0} clips`);

      return { success: true, sessionId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  function reset() {
    isProcessing.value = false;
    progress.value = { stage: 'initializing', progress: 0, message: '' };
  }

  return {
    // State
    isProcessing,
    progress,

    // Methods
    detectClipsWithChunking,
    fallbackToTraditionalDetection,
    reset,
  };
}
