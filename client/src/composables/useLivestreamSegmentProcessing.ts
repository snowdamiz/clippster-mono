import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import api from '@/services/api';
import {
  createLivestreamSegment,
  updateSegmentStatus,
  updateLivestreamSegment,
  updateLivestreamSessionProgress,
  createRawVideo,
  getLivestreamSession,
  getLivestreamSegment,
  persistClipDetectionResults,
  getClipsByDetectionSession,
  createProject,
  getProject,
} from '@/services/database';
import type { SegmentEventPayload, SegmentJob } from '@/types/livestream';

const DEFAULT_LIVE_PROMPT =
  'Detect the most viral, high-energy PumpFun livestream moments suitable for short-form clips.';

interface ProcessingJob extends SegmentJob {
  onProgress?: (status: string) => void;
}

function base64ToBlob(base64: string, mime = 'audio/ogg'): Blob {
  const binary = atob(base64);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function filenameFromPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || filePath;
}

export function useLivestreamSegmentProcessing() {
  const queue = ref<ProcessingJob[]>([]);
  const isProcessing = ref(false);

  async function handleSegmentReady(
    sessionId: string,
    payload: SegmentEventPayload,
    detectClips: boolean = true,
    onProgress?: (status: string) => void
  ) {
    const session = await getLivestreamSession(sessionId);
    if (!session || !session.project_id) {
      console.warn(
        '[LiveSegments] Session no longer exists or missing project, skipping segment',
        sessionId
      );
      return;
    }

    // Also check that the parent project still exists
    const parentProject = await getProject(session.project_id);
    if (!parentProject) {
      console.warn(
        '[LiveSegments] Parent project no longer exists, skipping segment',
        session.project_id
      );
      return;
    }

    let segmentId: string;
    try {
      segmentId = await createLivestreamSegment(sessionId, {
        segmentNumber: payload.segment,
        startTimeOffset: (payload.segment - 1) * payload.duration,
        duration: payload.duration,
        status: 'ready',
      });
    } catch (err) {
      console.warn('[LiveSegments] Failed to create segment (session may have been deleted):', err);
      return;
    }

    queue.value.push({
      sessionId,
      segmentId,
      segmentNumber: payload.segment,
      streamerId: payload.streamerId,
      mintId: payload.mintId,
      filePath: payload.path,
      projectId: session.project_id,
      detectClips,
      duration: payload.duration,
      onProgress,
    });

    if (!isProcessing.value) {
      processQueue();
    }
  }

  async function processQueue() {
    if (isProcessing.value) return;
    isProcessing.value = true;

    while (queue.value.length > 0) {
      const job = queue.value[0];
      try {
        await processSegment(job);
      } catch (error) {
        console.error('[LiveSegments] Failed to process segment', error);
      } finally {
        queue.value.shift();
      }
    }

    isProcessing.value = false;
  }

  async function processSegment(job: ProcessingJob) {
    // Check if the segment still exists (it might have been deleted during cleanup)
    const segment = await getLivestreamSegment(job.segmentId);
    if (!segment) {
      console.warn(`[LiveSegments] Segment ${job.segmentId} no longer exists, skipping processing`);
      return;
    }

    // Also check if the parent project still exists
    const parentProject = await getProject(job.projectId);
    if (!parentProject) {
      console.warn(
        `[LiveSegments] Parent project ${job.projectId} no longer exists, skipping processing`
      );
      return;
    }

    job.onProgress?.('Processing started');

    try {
      await updateSegmentStatus(job.segmentId, 'processing');
    } catch (err) {
      console.warn('[LiveSegments] Failed to update segment status (may have been deleted):', err);
      return;
    }

    try {
      // Create a new project for this segment to avoid raw_videos unique constraint
      const parentProject = await getProject(job.projectId);
      const segmentProjectName = parentProject
        ? `${parentProject.name} (Part ${job.segmentNumber})`
        : `Livestream Segment ${job.segmentNumber}`;

      const segmentProjectId = await createProject(
        segmentProjectName,
        parentProject?.description || undefined,
        job.projectId,
        'PumpFun'
      );

      // Generate thumbnail for the segment video
      let thumbnailPath: string | undefined;
      try {
        job.onProgress?.('Generating thumbnail');
        thumbnailPath = await invoke<string>('generate_thumbnail', {
          videoPath: job.filePath,
        });
      } catch (e) {
        console.warn('Failed to generate thumbnail for segment:', e);
      }

      const originalFilename = filenameFromPath(job.filePath);
      const rawVideoId = await createRawVideo(job.filePath, {
        projectId: segmentProjectId,
        originalFilename,
        thumbnailPath,
        sourceMintId: job.mintId,
        isSegment: true,
        segmentNumber: job.segmentNumber,
        originalProjectId: job.projectId, // Track the parent project
        duration: job.duration,
      });

      // Notify other components that a new video is available
      window.dispatchEvent(
        new CustomEvent('video-added', { detail: { rawVideoId, projectId: segmentProjectId } })
      );

      await updateLivestreamSegment(job.segmentId, { raw_video_id: rawVideoId });

      if (job.detectClips) {
        job.onProgress?.('Separating audio');
        const [audioFilename, audioBase64] = await invoke<[string, string]>(
          'extract_audio_from_video',
          {
            videoPath: job.filePath,
            outputPath: `segment_${job.segmentId}_audio.mp3`,
          }
        );

        const audioBlob = base64ToBlob(audioBase64);
        const audioFile = new File([audioBlob], audioFilename, { type: 'audio/ogg' });

        const formData = new FormData();
        formData.append('project_id', segmentProjectId);
        formData.append('prompt', DEFAULT_LIVE_PROMPT);
        formData.append('audio', audioFile, audioFile.name);
        if (job.duration) {
          formData.append('duration', job.duration.toString());
        }

        job.onProgress?.('Transcribing audio & Detecting Clips');
        try {
          const response = await api.post('/clips/detect', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 900000, // 15 minutes for AI detection
          });

          if (response.data?.success) {
            const detectionSessionId = await persistClipDetectionResults(
              segmentProjectId,
              DEFAULT_LIVE_PROMPT,
              response.data,
              {
                processingTimeMs: 0,
                detectionModel: 'pumpfun-live-segment',
                serverResponseId: response.data?.jobId || null,
                videoFilePath: job.filePath,
                rawVideoId: rawVideoId,
              }
            );

            const clips = await getClipsByDetectionSession(detectionSessionId);
            job.onProgress?.(`Found ${clips.length} clips`);

            if (clips.length > 0) {
              await updateLivestreamSegment(job.segmentId, { clips_detected: clips.length });
            }

            await updateSegmentStatus(job.segmentId, 'completed');
            await updateLivestreamSessionProgress(job.sessionId, { processedSegmentsDelta: 1 });
          } else {
            throw new Error(response.data?.error || 'Clip detection failed');
          }
        } catch (apiError: any) {
          // Handle 402 Payment Required (Insufficient Credits) gracefully
          if (apiError.response && apiError.response.status === 402) {
            console.warn(
              '[LiveSegments] Insufficient credits for detection. Switching to recording only.'
            );

            // Mark this segment as completed (recorded only) instead of error
            job.onProgress?.('Insufficient credits - Detection skipped');
            await updateSegmentStatus(job.segmentId, 'completed');
            await updateLivestreamSessionProgress(job.sessionId, { processedSegmentsDelta: 1 });

            // Update the session status via event so the main monitor knows to stop trying to detect
            window.dispatchEvent(
              new CustomEvent('livestream-credit-exhausted', {
                detail: { sessionId: job.sessionId, streamerId: job.streamerId },
              })
            );

            return;
          }

          // Re-throw other errors to be handled by the outer catch block
          throw apiError;
        }
      } else {
        job.onProgress?.('Segment recorded (Detection skipped)');
        await updateSegmentStatus(job.segmentId, 'completed');
        await updateLivestreamSessionProgress(job.sessionId, { processedSegmentsDelta: 1 });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      job.onProgress?.(`Error: ${message}`);
      await updateSegmentStatus(job.segmentId, 'error', message);
      throw error;
    }
  }

  return {
    queue,
    isProcessing,
    handleSegmentReady,
  };
}
