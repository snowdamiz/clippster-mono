import { ref, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { createDownloadedAudio } from '@/services/database/downloaded-audio';
import {
  extractSpaceSpeakerTimelineFromHls,
  getTwitterBroadcastInfo,
} from '@/services/twitter';
import {
  upsertDownloadedSpaceMetadata,
  type SpaceMetadataPayload,
} from '@/services/database/downloaded-space-metadata';
import type { SpaceParticipant, SpaceSpeakerSegment, SpaceStageSnapshot } from '@/services/database/types';
import {
  buildSpaceTimelineEventsPayload,
  deriveSegmentSourceFromId,
  mapSpeakerTimelineToStoredSegments,
  normalizeSpeakerSegments,
  sourceAllowsActiveHighlight,
  type StageJoinHintRow,
} from '@/services/spaces/space-replay-helpers';
import { useToast } from '@/composables/useToast';

function normalizeRole(role: string | undefined): SpaceParticipant['role'] {
  return role === 'host' ||
    role === 'cohost' ||
    role === 'speaker' ||
    role === 'admin' ||
    role === 'listener' ||
    role === 'guest' ||
    role === 'unknown'
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

    if (!event.success) {
      const { error: showError } = useToast();
      showError('Download Failed', event.error || 'Audio download failed');
      return;
    }
    
    if (event.file_path && event.title && event.platform) {
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
          const spaceMetadata = await buildSpaceMetadata(event, createdAudioId);
          if (spaceMetadata) {
            await upsertDownloadedSpaceMetadata(spaceMetadata);
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
      let participants: SpaceParticipant[] = (info.participants && info.participants.length > 0
        ? info.participants.map((participant) => ({
            id: participant.id,
            name: participant.name,
            avatar_url: participant.avatarUrl || null,
            role: normalizeRole(participant.role),
            twitter_username: participant.twitterUsername,
            periscope_user_id: participant.periscopeUserId,
            x_rest_id: participant.xRestId,
            display_name: participant.displayName,
          }))
        : [{
            id: hostId,
            name: uploaderName,
            avatar_url: info.avatarUrl || null,
            role: 'host' as const,
            twitter_username: info.username?.replace(/^@/, '') || undefined,
          }]);

      const duration = event.duration || info.duration || 0;
      let speakerSegments: SpaceSpeakerSegment[] = [];

      let hlsStageSnapshots: SpaceStageSnapshot[] | undefined;

      const apiSpeakerSegments =
        info.speakerTimeline && info.speakerTimeline.length > 0
          ? mapSpeakerTimelineToStoredSegments(info.speakerTimeline)
          : [];
      const hasReliableApiTimeline = apiSpeakerSegments.some((segment) =>
        sourceAllowsActiveHighlight(segment.source ?? deriveSegmentSourceFromId(segment.id))
      );

      // ── Priority 1: real X replay speaker events (Periscope) ──
      if (hasReliableApiTimeline) {
        console.log(
          `[useAudioDownloads] Using X API speaker timeline (${apiSpeakerSegments.length} segments)`
        );
        speakerSegments = apiSpeakerSegments;
        // Ensure any IDs that appear only in the timeline are present in participants
        participants = mergeParticipantsWithTimeline(participants, speakerSegments);
      } else if (info.manifestUrl) {
        // ── Priority 2: HLS ID3 metadata (fallback) ──
        try {
          const hls = await extractSpaceSpeakerTimelineFromHls(info.manifestUrl, duration || undefined);
          hlsStageSnapshots = (hls.stageSnapshots ?? []).map((s) => ({
            id: s.id,
            t: s.t,
            on_stage_user_ids: s.onStageUserIds ?? [],
          }));

          if (hls.speakerSegments.length > 0) {
            speakerSegments = mapSpeakerTimelineToStoredSegments(hls.speakerSegments);
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

      const dur =
        duration ||
        Math.max(
          0,
          ...speakerSegments.map((segment) => segment.end),
          ...(hlsStageSnapshots ?? []).map((snapshot) => snapshot.t)
        );
      speakerSegments = normalizeSpeakerSegments(speakerSegments, dur);
      const joinHintRows: StageJoinHintRow[] =
        info.spaceReplayHints?.stageJoinTimes?.map((r) => ({
          userId: r.userId,
          offsetSecs: typeof r.offsetSecs === 'number' ? r.offsetSecs : 0,
        })) ?? [];
      const timelineEvents = buildSpaceTimelineEventsPayload(
        participants,
        hlsStageSnapshots ?? [],
        speakerSegments,
        joinHintRows,
        dur
      );

      const payload: SpaceMetadataPayload = {
        audioId,
        sourceUrl,
        title: info.title || event.title || undefined,
        participants,
        speakerSegments,
        timelineEvents,
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
    const seen = new Set(participants.flatMap((p) => [p.id, p.periscope_user_id].filter(Boolean)));
    const out = [...participants];
    for (const seg of segments) {
      if (seen.has(seg.speaker_id)) continue;
      seen.add(seg.speaker_id);
      out.push({
        id: seg.speaker_id,
        name: `Speaker ${seg.speaker_id}`,
        avatar_url: null,
        role: 'unknown' as const,
        periscope_user_id: seg.speaker_id,
      });
    }
    return out;
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
