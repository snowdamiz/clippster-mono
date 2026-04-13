import { ref, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useToast } from '@/composables/useToast';
import { createDownloadedAudio } from '@/services/database/downloaded-audio';
import {
  extractSpaceSpeakerTimelineFromHls,
  getTwitterBroadcastInfo,
} from '@/services/twitter';
import {
  upsertDownloadedSpaceMetadata,
  type SpaceMetadataPayload,
} from '@/services/database/downloaded-space-metadata';
import type { SpaceParticipant, SpaceStageSnapshot } from '@/services/database/types';

function normalizeRole(role: string | undefined): SpaceParticipant['role'] {
  return role === 'host' || role === 'speaker' || role === 'listener' || role === 'guest' || role === 'unknown'
    ? role
    : 'unknown';
}

export interface AudioDownloadProgress {
  download_id: string;
  progress: number;
  current_time?: number;
  total_time?: number;
  status: string;
}

export interface AudioDownloadResult {
  download_id: string;
  success: boolean;
  file_path?: string;
  title?: string;
  platform?: string;
  source_url?: string;
  duration?: number;
  file_size?: number;
  sample_rate?: number;
  channels?: number;
  thumbnail_url?: string;
  error?: string;
  /** Pre-merged yt-dlp + GraphQL + optional diarization JSON from the Rust download pipeline. */
  twitter_space_metadata_json?: string;
  diarization_warning?: string;
}

export interface ActiveAudioDownload {
  id: string;
  title: string;
  platform: string;
  progress: number;
  status: string;
  error?: string;
}

// Shared state across all instances (singleton pattern)
const activeDownloads = ref<Map<string, ActiveAudioDownload>>(new Map());
const queuedDownloads = ref<ActiveAudioDownload[]>([]);
let progressUnlisten: UnlistenFn | null = null;
let completeUnlisten: UnlistenFn | null = null;
let isInitialized = false;

export function useAudioDownloads() {
  const { warning: toastWarning } = useToast();

  async function startYouTubeAudioDownload(
    downloadId: string,
    title: string,
    vodUrl: string,
    channelName: string
  ): Promise<void> {
    // Add to active downloads
    activeDownloads.value.set(downloadId, {
      id: downloadId,
      title,
      platform: 'YouTube',
      progress: 0,
      status: 'Starting...',
    });

    try {
      await invoke('download_youtube_audio', {
        downloadId,
        title,
        vodUrl,
        channelName,
      });
    } catch (error) {
      console.error('Failed to start YouTube audio download:', error);
      const download = activeDownloads.value.get(downloadId);
      if (download) {
        download.error = error instanceof Error ? error.message : String(error);
        download.status = 'Failed';
      }
      throw error;
    }
  }

  async function startTwitterSpaceAudioDownload(
    downloadId: string,
    title: string,
    spaceUrl: string
  ): Promise<void> {
    // Add to active downloads
    activeDownloads.value.set(downloadId, {
      id: downloadId,
      title,
      platform: 'Twitter',
      progress: 0,
      status: 'Starting...',
    });

    try {
      await invoke('download_twitter_space_audio', {
        downloadId,
        title,
        spaceUrl,
      });
    } catch (error) {
      console.error('Failed to start Twitter Space audio download:', error);
      const download = activeDownloads.value.get(downloadId);
      if (download) {
        download.error = error instanceof Error ? error.message : String(error);
        download.status = 'Failed';
      }
      throw error;
    }
  }

  async function uploadAudioFile(filePath: string, title: string): Promise<AudioDownloadResult> {
    try {
      const result = await invoke<AudioDownloadResult>('upload_audio_file', {
        filePath,
        title,
      });

      // Save to database if successful
      if (result.success && result.file_path) {
        await createDownloadedAudio(
          title,
          'upload',
          result.file_path,
          undefined,
          undefined,
          result.duration,
          result.file_size,
          result.sample_rate,
          result.channels
        );
      }

      return result;
    } catch (error) {
      console.error('Failed to upload audio file:', error);
      throw error;
    }
  }

  async function cancelDownload(downloadId: string): Promise<void> {
    try {
      await invoke('cancel_audio_download', { downloadId });
      activeDownloads.value.delete(downloadId);
    } catch (error) {
      console.error('Failed to cancel audio download:', error);
      throw error;
    }
  }

  function handleProgress(event: AudioDownloadProgress) {
    const download = activeDownloads.value.get(event.download_id);
    if (download) {
      download.progress = event.progress;
      download.status = event.status;
    }
  }

  async function handleComplete(event: AudioDownloadResult) {
    console.log('[useAudioDownloads] Download complete event received:', event);
    console.log('[useAudioDownloads] Platform value:', event.platform);
    
    // Remove from active downloads first
    activeDownloads.value.delete(event.download_id);
    
    if (event.success && event.file_path && event.title && event.platform) {
      // Save to database
      try {
        const createdAudioId = await createDownloadedAudio(
          event.title,
          event.platform === 'YouTube' ? 'youtube' : 'twitter',
          event.file_path,
          event.platform,
          event.source_url,
          event.duration,
          event.file_size,
          event.sample_rate,
          event.channels,
          event.thumbnail_url
        );

        if (event.platform === 'Twitter') {
          let spaceMetadata: SpaceMetadataPayload | null = null;
          if (event.twitter_space_metadata_json) {
            spaceMetadata = buildSpaceMetadataFromRustPipelineJson(
              event,
              createdAudioId,
              event.twitter_space_metadata_json
            );
          }
          if (!spaceMetadata) {
            spaceMetadata = await buildSpaceMetadata(event, createdAudioId);
          }
          if (spaceMetadata) {
            await upsertDownloadedSpaceMetadata(spaceMetadata);
          }
          if (event.diarization_warning) {
            toastWarning('Speaker timeline', event.diarization_warning);
          }
        }
        console.log('[useAudioDownloads] Saved downloaded audio to database:', event.title);
        console.log('[useAudioDownloads] Saved with platform:', event.platform);
        
        // Emit a custom event that the UI can listen to AFTER database save is complete
        window.dispatchEvent(new CustomEvent('audio-library-updated', { 
          detail: { audioId: event.download_id, title: event.title } 
        }));
      } catch (error) {
        console.error('[useAudioDownloads] Failed to save downloaded audio to database:', error);
      }
    }
  }

  /**
   * Maps Rust `get_twitter_broadcast_info`-shaped JSON (already merged + optionally diarized)
   * into DB payload without a second `getTwitterBroadcastInfo` round-trip.
   */
  function buildSpaceMetadataFromRustPipelineJson(
    event: AudioDownloadResult,
    audioId: string,
    jsonStr: string
  ): SpaceMetadataPayload | null {
    const sourceUrl = event.source_url;
    if (!sourceUrl) return null;
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      return null;
    }

    const uploaderName =
      (typeof raw.uploader === 'string' && raw.uploader) ||
      (typeof raw.uploader_id === 'string' && raw.uploader_id) ||
      'Host';
    const hostId = `host-${uploaderName.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'speaker'}`;

    const rawParticipants = Array.isArray(raw.participants) ? raw.participants : [];
    let participants: SpaceParticipant[] =
      rawParticipants.length > 0
        ? (rawParticipants as Array<Record<string, unknown>>).map((p) => ({
            id: String(p.id ?? ''),
            name: String(p.name ?? p.id ?? ''),
            avatar_url:
              (typeof p.avatar_url === 'string' ? p.avatar_url : null) ??
              (typeof p.avatarUrl === 'string' ? p.avatarUrl : null),
            role: normalizeRole(typeof p.role === 'string' ? p.role : undefined),
          }))
        : [
            {
              id: hostId,
              name: uploaderName,
              avatar_url:
                typeof raw.avatarUrl === 'string'
                  ? raw.avatarUrl
                  : typeof raw.thumbnail === 'string'
                    ? raw.thumbnail
                    : null,
              role: 'host' as const,
            },
          ];

    const duration =
      (event.duration ??
        (typeof raw.duration === 'number'
          ? raw.duration
          : typeof raw.duration === 'string'
            ? parseFloat(raw.duration)
            : 0)) || 0;

    const timeline = Array.isArray(raw.speakerTimeline) ? raw.speakerTimeline : [];
    let speakerSegments =
      timeline.length > 0
        ? (timeline as Array<Record<string, unknown>>).map((seg, i) => ({
            id: String(seg.id ?? `dz-${i}`),
            speaker_id: String(seg.speakerId ?? seg.speaker_id ?? ''),
            start: Number(seg.start ?? 0),
            end: Number(seg.end ?? 0),
          }))
        : [];

    if (speakerSegments.length > 0) {
      participants = mergeParticipantsWithTimeline(participants, speakerSegments);
    } else {
      const onStageIds = participants
        .filter((p) => p.role === 'host' || p.role === 'speaker' || p.role === 'unknown')
        .map((p) => p.id);
      speakerSegments =
        duration > 0 && onStageIds.length > 0
          ? buildSeedSpeakerSegments(onStageIds, duration)
          : [];
    }

    const title =
      (typeof raw.title === 'string' && raw.title) ||
      (typeof raw.fulltitle === 'string' && raw.fulltitle) ||
      event.title ||
      undefined;

    return {
      audioId,
      sourceUrl,
      title,
      participants,
      speakerSegments,
    };
  }

  async function buildSpaceMetadata(
    event: AudioDownloadResult,
    audioId: string
  ): Promise<SpaceMetadataPayload | null> {
    const sourceUrl = event.source_url;
    if (!sourceUrl) return null;

    try {
      const info = await getTwitterBroadcastInfo(sourceUrl);
      const uploaderName = info.uploader || info.username?.replace('@', '') || 'Host';
      const hostId = `host-${uploaderName.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'speaker'}`;
      let participants = (info.participants && info.participants.length > 0
        ? info.participants.map((participant) => ({
            id: participant.id,
            name: participant.name,
            avatar_url: participant.avatarUrl || null,
            role: normalizeRole(participant.role),
          }))
        : [{
            id: hostId,
            name: uploaderName,
            avatar_url: info.avatarUrl || null,
            role: 'host' as const,
          }]);

      const duration = event.duration || info.duration || 0;
      const onStageIds = participants
        .filter((p) => p.role === 'host' || p.role === 'speaker' || p.role === 'unknown')
        .map((p) => p.id);
      let speakerSegments =
        duration > 0 && onStageIds.length > 0
          ? buildSeedSpeakerSegments(onStageIds, duration)
          : [];

      let hlsStageSnapshots: SpaceStageSnapshot[] | undefined;

      // ── Priority 1: X API speaker timeline (Periscope events or stage-join times) ──
      if (info.speakerTimeline && info.speakerTimeline.length > 0) {
        console.log(
          `[useAudioDownloads] Using X API speaker timeline (${info.speakerTimeline.length} segments)`
        );
        speakerSegments = info.speakerTimeline.map((seg) => ({
          id: seg.id,
          speaker_id: seg.speakerId,
          start: seg.start,
          end: seg.end,
        }));
        // Ensure any IDs that appear only in the timeline are present in participants
        participants = mergeParticipantsWithTimeline(participants, speakerSegments);
      } else if (info.manifestUrl && duration > 0) {
        // ── Priority 2: HLS ID3 metadata (fallback) ──
        try {
          const hls = await extractSpaceSpeakerTimelineFromHls(info.manifestUrl, duration);
          hlsStageSnapshots = (hls.stageSnapshots ?? []).map((s) => ({
            id: s.id,
            t: s.t,
            on_stage_user_ids: s.onStageUserIds ?? [],
          }));

          if (hls.speakerSegments.length > 0) {
            speakerSegments = hls.speakerSegments.map((seg) => ({
              id: seg.id,
              speaker_id: seg.speakerId,
              start: seg.start,
              end: seg.end,
            }));
            participants = mergeParticipantsWithTimeline(participants, speakerSegments);
          }

          if (hlsStageSnapshots.length > 0) {
            participants = mergeParticipantsWithTimeline(
              participants,
              hlsStageSnapshots.flatMap((snap) =>
                snap.on_stage_user_ids.map((id) => ({ speaker_id: id }))
              )
            );
          }
        } catch (timelineErr) {
          hlsStageSnapshots = undefined;
          console.warn(
            '[useAudioDownloads] HLS speaker timeline extraction failed (using seed timeline):',
            timelineErr
          );
        }
      }

      const payload: SpaceMetadataPayload = {
        audioId,
        sourceUrl,
        title: info.title || event.title || undefined,
        participants,
        speakerSegments,
      };
      if (hlsStageSnapshots !== undefined) {
        payload.stageSnapshots = hlsStageSnapshots;
      }
      return payload;
    } catch (error) {
      console.warn('[useAudioDownloads] Failed to enrich space metadata:', error);
      return {
        audioId,
        sourceUrl,
        title: event.title || undefined,
        participants: [],
        speakerSegments: [],
      };
    }
  }

  function mergeParticipantsWithTimeline(
    participants: SpaceParticipant[],
    segments: Array<{ speaker_id: string }>
  ) {
    const seen = new Set(participants.map((p) => p.id));
    const out = [...participants];
    for (const seg of segments) {
      if (seen.has(seg.speaker_id)) continue;
      seen.add(seg.speaker_id);
      out.push({
        id: seg.speaker_id,
        name: `Speaker ${seg.speaker_id}`,
        avatar_url: null,
        role: 'unknown' as const,
      });
    }
    return out;
  }

  function buildSeedSpeakerSegments(speakerIds: string[], totalDuration: number) {
    if (speakerIds.length === 0 || totalDuration <= 0) return [];

    // Seed timeline for UI: rotate speakers in 18s blocks until diarization is available.
    const block = 18;
    const segments: Array<{ id: string; speaker_id: string; start: number; end: number }> = [];
    let cursor = 0;
    let idx = 0;
    while (cursor < totalDuration) {
      const speakerId = speakerIds[idx % speakerIds.length];
      const end = Math.min(totalDuration, cursor + block);
      segments.push({
        id: `${speakerId}-${Math.floor(cursor)}`,
        speaker_id: speakerId,
        start: cursor,
        end,
      });
      cursor = end;
      idx += 1;
    }
    return segments;
  }

  // Initialize event listeners only once (singleton pattern)
  if (!isInitialized) {
    isInitialized = true;
    (async () => {
      // Listen for download progress events
      progressUnlisten = await listen<AudioDownloadProgress>('download-progress', (event) => {
        handleProgress(event.payload);
      });

      // Listen for download complete events
      completeUnlisten = await listen<AudioDownloadResult>('download-complete', (event) => {
        handleComplete(event.payload);
      });
    })();
  }

  onUnmounted(() => {
    // Don't unlisten since this is shared across all components
    // The listeners will persist for the lifetime of the app
  });

  function getActiveDownloads(): ActiveAudioDownload[] {
    return Array.from(activeDownloads.value.values());
  }

  function getQueuedDownloads(): ActiveAudioDownload[] {
    return queuedDownloads.value;
  }

  return {
    activeDownloads,
    queuedDownloads,
    startYouTubeAudioDownload,
    startTwitterSpaceAudioDownload,
    uploadAudioFile,
    cancelDownload,
    getActiveDownloads,
    getQueuedDownloads,
  };
}
