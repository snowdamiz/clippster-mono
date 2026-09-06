/**
 * Prepare video context for AI Thumbnail: frames + transcript per policy.
 * - project/clip with existing transcript → reuse
 * - otherwise Whisper (or YouTube captions first)
 */

import { Channel, invoke } from '@tauri-apps/api/core';
import api from '@/services/api';
import { getTranscriptByProjectId } from '@/services/database/transcripts';
import { extractYouTubeVideoId } from '@/services/youtube';
import type {
  ThumbnailKeyFrame,
  ThumbnailVideoSelection,
} from '@/composables/useThumbnailVideoContext';

export type TranscriptSource = 'existing' | 'youtube_captions' | 'whisper';

export interface ThumbnailPrepareProgress {
  stage: string;
  progress: number;
  message: string;
}

export interface ThumbnailVideoPrepareResult {
  selection: ThumbnailVideoSelection;
  keyFrames: ThumbnailKeyFrame[];
  media_items: Array<Record<string, unknown>>;
  key_frames: Array<Record<string, unknown>>;
  youtube_url?: string;
  video_title?: string;
  transcript: string;
  transcript_source: TranscriptSource;
}

const MIN_FRAMES = 6;
const MAX_FRAMES = 12;

function computeFrameCount(duration: number): number {
  if (!duration || duration <= 0) return MIN_FRAMES;
  if (duration <= 30) return MIN_FRAMES;
  if (duration <= 120) return 8;
  if (duration <= 600) return 10;
  return MAX_FRAMES;
}

function computeTimestamps(duration: number, count: number): number[] {
  if (!duration || duration <= 0) return Array.from({ length: count }, (_, i) => i * 0.5);
  const step = duration / (count + 1);
  return Array.from({ length: count }, (_, i) => Math.min(duration - 0.1, step * (i + 1)));
}

async function extractKeyFramesFromPath(
  sourcePath: string,
  duration: number | null,
): Promise<ThumbnailKeyFrame[]> {
  const dur = duration ?? 60;
  const count = computeFrameCount(dur);
  const timestamps = computeTimestamps(dur, count);
  const frames: ThumbnailKeyFrame[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i];
    try {
      const framePath = await invoke<string>('generate_thumbnail_at_timestamp', {
        videoPath: sourcePath,
        timestampSeconds: timestamp,
        outputFilename: `aithumb_frame_${Date.now()}_${i}`,
      });
      if (!framePath) continue;
      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: framePath });
      if (dataUrl) frames.push({ url: dataUrl, timestamp, index: i });
    } catch {
      // skip failed frame
    }
  }

  if (frames.length === 0) {
    throw new Error('Could not extract frames from the selected video');
  }
  return frames;
}

function toMediaPayload(
  selection: ThumbnailVideoSelection,
  keyFrames: ThumbnailKeyFrame[],
  sourceOverride?: string,
) {
  return {
    media_items: [
      {
        id: selection.id,
        name: selection.name,
        type: 'video',
        source: sourceOverride || selection.type,
        sourcePath: selection.sourcePath,
        projectId: selection.projectId,
        duration: selection.duration,
        thumbnailUrl: selection.thumbnailUrl,
        youtubeUrl: selection.youtubeUrl,
      },
    ],
    key_frames: keyFrames.map((f) => ({
      url: f.url,
      timestamp: f.timestamp,
      index: f.index,
    })),
  };
}

function dataUrlToFile(dataUrl: string, name: string, mime: string): File {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) throw new Error('Invalid data URL');
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

async function whisperFromAudioOrVideoPath(
  path: string,
  durationSeconds?: number | null,
  isAudioFile = false,
): Promise<string> {
  let file: File;

  if (isAudioFile) {
    const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: path });
    file = dataUrlToFile(dataUrl, 'audio.mp3', 'audio/mpeg');
  } else {
    const sourceId = `aithumb_${Math.abs(
      path.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0),
    )}`;
    const extracted = await invoke<{ file_path: string; filename: string; duration: number }>(
      'extract_audio_to_file',
      {
        videoPath: path,
        sourceId,
        trimStart: 0,
        trimDuration: Math.min(durationSeconds || 600, 30 * 60),
      },
    );
    if (!extracted?.file_path) throw new Error('Audio extraction failed');
    const dataUrl = await invoke<string>('read_file_as_data_url', {
      filePath: extracted.file_path,
    });
    file = dataUrlToFile(dataUrl, extracted.filename || 'audio.mp3', 'audio/mpeg');
  }

  const formData = new FormData();
  formData.append('audio', file);
  formData.append('filename', file.name);

  const response = await api.post('/ai/thumbnail/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300_000,
  });

  const text =
    response.data?.text ||
    response.data?.transcript?.text ||
    response.data?.transcription ||
    (typeof response.data?.transcript === 'string' ? response.data.transcript : '');

  if (!text || String(text).trim().length < 50) {
    throw new Error('Whisper returned an empty or too-short transcript');
  }

  return String(text).trim();
}

async function resolveExistingTranscript(
  selection: ThumbnailVideoSelection,
): Promise<string | null> {
  if (selection.projectId) {
    const t = await getTranscriptByProjectId(selection.projectId);
    if (t?.text && t.text.trim().length >= 50) return t.text.trim();
  }
  return null;
}

export async function prepareLibraryVideoAttach(
  selection: ThumbnailVideoSelection,
  onProgress?: (p: ThumbnailPrepareProgress) => void,
): Promise<ThumbnailVideoPrepareResult> {
  onProgress?.({ stage: 'frames', progress: 15, message: 'Extracting keyframes…' });
  const keyFrames = await extractKeyFramesFromPath(selection.sourcePath, selection.duration);
  const payload = toMediaPayload(selection, keyFrames);

  onProgress?.({ stage: 'transcript', progress: 45, message: 'Checking for existing transcript…' });
  let transcript = await resolveExistingTranscript(selection);
  let transcript_source: TranscriptSource = 'existing';

  if (!transcript) {
    onProgress?.({ stage: 'whisper', progress: 60, message: 'Transcribing with Whisper…' });
    transcript = await whisperFromAudioOrVideoPath(selection.sourcePath, selection.duration);
    transcript_source = 'whisper';
  }

  onProgress?.({ stage: 'done', progress: 100, message: 'Video context ready' });

  return {
    selection,
    keyFrames,
    media_items: payload.media_items,
    key_frames: payload.key_frames,
    video_title: selection.name,
    transcript,
    transcript_source,
  };
}

export async function prepareYouTubeVideoAttach(
  youtubeUrl: string,
  onProgress?: (p: ThumbnailPrepareProgress) => void,
): Promise<ThumbnailVideoPrepareResult> {
  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) throw new Error('Invalid YouTube URL');

  const normalized = `https://www.youtube.com/watch?v=${videoId}`;
  onProgress?.({ stage: 'captions', progress: 10, message: 'Fetching YouTube captions…' });

  let title = `YouTube ${videoId}`;
  let transcript = '';
  let transcript_source: TranscriptSource = 'youtube_captions';

  try {
    const raw = await invoke<string>('fetch_youtube_captions', { youtubeUrl: normalized });
    const parsed = JSON.parse(raw) as { title?: string; transcript?: string; source?: string };
    if (parsed.title) title = parsed.title;
    if (parsed.transcript && parsed.transcript.trim().length >= 50) {
      transcript = parsed.transcript.trim();
      transcript_source = 'youtube_captions';
    }
  } catch (e) {
    console.warn('[prepareYouTubeVideoAttach] captions failed', e);
  }

  onProgress?.({ stage: 'download', progress: 30, message: 'Downloading video for frames…' });
  const jobId = crypto.randomUUID();
  const channel = new Channel<{ stage: string; progress: number; message: string }>();
  channel.onmessage = (ev) => {
    onProgress?.({
      stage: ev.stage,
      progress: Math.min(85, 30 + Math.round((ev.progress || 0) * 0.5)),
      message: ev.message,
    });
  };

  const evidence = await invoke<{
    metadata: { displayName?: string; duration?: number; sourceUrl?: string };
    frames: Array<{ timestamp: number; mimeType?: string; mime_type?: string; base64Data?: string; base64_data?: string }>;
  }>('prepare_reference_video', {
    input: { jobId, kind: 'url', value: normalized },
    onEvent: channel,
  });

  if (evidence.metadata?.displayName) title = evidence.metadata.displayName;

  const keyFrames: ThumbnailKeyFrame[] = (evidence.frames || []).slice(0, 12).map((f, index) => {
    const b64 = f.base64Data || f.base64_data || '';
    const mime = f.mimeType || f.mime_type || 'image/jpeg';
    return {
      url: `data:${mime};base64,${b64}`,
      timestamp: f.timestamp,
      index,
    };
  });

  if (keyFrames.length === 0) {
    throw new Error('Could not sample frames from the YouTube video');
  }

  if (!transcript) {
    onProgress?.({
      stage: 'whisper',
      progress: 88,
      message: 'Captions missing — transcribing audio…',
    });
    const audioPath = await invoke<string>('download_youtube_audio_for_transcription', {
      youtubeUrl: normalized,
    });
    transcript = await whisperFromAudioOrVideoPath(audioPath, null, true);
    transcript_source = 'whisper';
  }

  if (!transcript || transcript.length < 50) {
    throw new Error(
      'Could not get a transcript for this YouTube video (no captions and Whisper failed)',
    );
  }

  const selection: ThumbnailVideoSelection = {
    id: videoId,
    name: title,
    type: 'youtube',
    sourcePath: normalized,
    duration: evidence.metadata?.duration ?? null,
    youtubeUrl: normalized,
  };

  onProgress?.({ stage: 'done', progress: 100, message: 'YouTube context ready' });

  return {
    selection,
    keyFrames,
    ...toMediaPayload(selection, keyFrames, 'youtube'),
    youtube_url: normalized,
    video_title: title,
    transcript,
    transcript_source,
  };
}

export async function prepareUploadVideoAttach(
  filePath: string,
  displayName: string,
  onProgress?: (p: ThumbnailPrepareProgress) => void,
): Promise<ThumbnailVideoPrepareResult> {
  const selection: ThumbnailVideoSelection = {
    id: `upload-${Date.now()}`,
    name: displayName,
    type: 'upload',
    sourcePath: filePath,
    duration: null,
  };

  onProgress?.({ stage: 'frames', progress: 20, message: 'Extracting keyframes…' });
  const keyFrames = await extractKeyFramesFromPath(filePath, null);
  const payload = toMediaPayload(selection, keyFrames, 'upload');

  onProgress?.({ stage: 'whisper', progress: 55, message: 'Transcribing upload with Whisper…' });
  const transcript = await whisperFromAudioOrVideoPath(filePath, null);

  onProgress?.({ stage: 'done', progress: 100, message: 'Upload context ready' });

  return {
    selection,
    keyFrames,
    media_items: payload.media_items,
    key_frames: payload.key_frames,
    video_title: displayName,
    transcript,
    transcript_source: 'whisper',
  };
}
