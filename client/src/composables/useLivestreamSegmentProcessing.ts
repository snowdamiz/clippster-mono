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
  persistClipDetectionResults,
  getClipsByDetectionSession,
  updateClipBuildStatus,
} from '@/services/database';
import type { SegmentEventPayload, SegmentJob } from '@/types/livestream';
import type { ClipWithVersion, SubtitleSettings } from '@/services/database';

const DEFAULT_LIVE_PROMPT =
  'Detect the most viral, high-energy PumpFun livestream moments suitable for short-form clips.';
const DEFAULT_ASPECT_RATIOS = ['9:16'];
const DEFAULT_QUALITY = 'high';
const DEFAULT_FRAME_RATE = 30;
const DEFAULT_OUTPUT_FORMAT = 'mp4';
const DEFAULT_MAX_WORDS = 3;
const AUTO_BUILD_SUBTITLE_SETTINGS: SubtitleSettings = {
  enabled: false,
  fontFamily: 'Montserrat',
  fontSize: 32,
  fontWeight: 700,
  textColor: '#FFFFFF',
  backgroundColor: '#000000',
  backgroundEnabled: false,
  border1Width: 2,
  border1Color: '#00FF00',
  border2Width: 4,
  border2Color: '#000000',
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  shadowBlur: 4,
  shadowColor: '#000000',
  position: 'bottom',
  positionPercentage: 85,
  maxWidth: 90,
  animationStyle: 'none',
  lineHeight: 1.2,
  letterSpacing: 0,
  textAlign: 'center',
  textOffsetX: 0,
  textOffsetY: 0,
  padding: 16,
  borderRadius: 8,
  wordSpacing: 0.35,
  selectedPresetId: null,
};

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
  const queue = ref<SegmentJob[]>([]);
  const isProcessing = ref(false);

  async function handleSegmentReady(sessionId: string, payload: SegmentEventPayload) {
    const session = await getLivestreamSession(sessionId);
    if (!session || !session.project_id) {
      console.error('[LiveSegments] Missing project for session', sessionId);
      return;
    }

    const segmentId = await createLivestreamSegment(sessionId, {
      segmentNumber: payload.segment,
      startTimeOffset: (payload.segment - 1) * payload.duration,
      duration: payload.duration,
      status: 'ready',
    });

    queue.value.push({
      sessionId,
      segmentId,
      segmentNumber: payload.segment,
      streamerId: payload.streamerId,
      mintId: payload.mintId,
      filePath: payload.path,
      projectId: session.project_id,
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

  async function processSegment(job: SegmentJob) {
    await updateSegmentStatus(job.segmentId, 'processing');

    try {
      // Generate thumbnail for the segment video
      let thumbnailPath: string | undefined;
      try {
        thumbnailPath = await invoke<string>('generate_thumbnail', {
          videoPath: job.filePath,
        });
      } catch (e) {
        console.warn('Failed to generate thumbnail for segment:', e);
      }

      const originalFilename = filenameFromPath(job.filePath);
      const rawVideoId = await createRawVideo(job.filePath, {
        projectId: job.projectId,
        originalFilename,
        thumbnailPath,
        sourceMintId: job.mintId,
        isSegment: true,
        segmentNumber: job.segmentNumber,
      });

      // Notify other components that a new video is available
      window.dispatchEvent(new CustomEvent('video-added', { detail: { rawVideoId } }));

      await updateLivestreamSegment(job.segmentId, { raw_video_id: rawVideoId });

      const [audioFilename, audioBase64] = await invoke<[string, string]>(
        'extract_audio_from_video',
        {
          videoPath: job.filePath,
          outputPath: `segment_${job.segmentId}_audio.ogg`,
        }
      );

      const audioBlob = base64ToBlob(audioBase64);
      const audioFile = new File([audioBlob], audioFilename, { type: 'audio/ogg' });

      const formData = new FormData();
      formData.append('project_id', job.projectId);
      formData.append('prompt', DEFAULT_LIVE_PROMPT);
      formData.append('audio', audioFile, audioFile.name);

      const response = await api.post('/clips/detect', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data?.success) {
        const detectionSessionId = await persistClipDetectionResults(
          job.projectId,
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
        if (clips.length > 0) {
          await updateLivestreamSegment(job.segmentId, { clips_detected: clips.length });
          // Clips are stored in the database as detected, but not built yet.
          // User can build them later from the project dashboard.
        }

        await updateSegmentStatus(job.segmentId, 'completed');
        await updateLivestreamSessionProgress(job.sessionId, { processedSegmentsDelta: 1 });
      } else {
        throw new Error(response.data?.error || 'Clip detection failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
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
