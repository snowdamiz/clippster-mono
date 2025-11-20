import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import {
  createLivestreamSession,
  endLivestreamSession,
  updateMonitoredStreamer,
} from '@/services/database';
import type { LiveSession, LiveStatus, MonitoredStreamer } from '@/types/livestream';

const POLL_INTERVAL_MS = 30_000;

async function fetchLiveStatus(mintId: string): Promise<LiveStatus> {
  try {
    const response = await invoke<string>('check_pumpfun_livestream', { mintId });
    const data = JSON.parse(response);
    return {
      isLive: Boolean(data?.isLive),
      streamId: data?.id,
      streamStartTimestamp: data?.streamStartTimestamp,
      numParticipants: data?.numParticipants,
      roomName: data?.roomName,
      token: data?.token,
      raw: data,
    };
  } catch (error) {
    console.warn('[LiveMonitor] Failed to check live status', error);
    return { isLive: false };
  }
}

export function useLivestreamMonitoring() {
  const activeSessions = ref<Map<string, LiveSession>>(new Map());
  const pollingHandle = ref<number | null>(null);
  const isMonitoring = ref(false);

  async function startMonitoring(streamers: MonitoredStreamer[]) {
    if (streamers.length === 0) {
      return;
    }

    if (pollingHandle.value) {
      clearInterval(pollingHandle.value);
      pollingHandle.value = null;
    }

    isMonitoring.value = true;
    await pollStreamers(streamers);

    pollingHandle.value = window.setInterval(() => {
      pollStreamers(streamers);
    }, POLL_INTERVAL_MS);
  }

  async function stopMonitoring() {
    if (pollingHandle.value) {
      clearInterval(pollingHandle.value);
      pollingHandle.value = null;
    }

    isMonitoring.value = false;

    const entries = Array.from(activeSessions.value.values());
    activeSessions.value.clear();

    await Promise.all(
      entries.map(async (session) => {
        try {
          await invoke('stop_livestream_recording', { mintId: session.mintId });
        } catch (error) {
          console.warn('[LiveMonitor] Failed to stop recorder', error);
        }

        try {
          await endLivestreamSession(session.sessionId, Math.floor(Date.now() / 1000));
        } catch (error) {
          console.warn('[LiveMonitor] Failed to close session', error);
        }
      })
    );
  }

  async function pollStreamers(streamers: MonitoredStreamer[]) {
    for (const streamer of streamers) {
      const status = await fetchLiveStatus(streamer.mintId);
      await updateMonitoredStreamer(streamer.id, {
        last_check_timestamp: Math.floor(Date.now() / 1000),
        is_currently_live: status.isLive ? 1 : 0,
      });

      const sessionActive = activeSessions.value.has(streamer.id);

      if (status.isLive && !sessionActive) {
        await handleStreamStart(streamer, status);
      } else if (!status.isLive && sessionActive) {
        await handleStreamEnd(streamer);
      }
    }
  }

  async function handleStreamStart(streamer: MonitoredStreamer, status: LiveStatus) {
    try {
      const sessionInfo = await createLivestreamSession(
        streamer.id,
        streamer.mintId,
        streamer.displayName,
        status.streamStartTimestamp ? Math.floor(status.streamStartTimestamp / 1000) : undefined
      );

      await invoke('start_livestream_recording', {
        mintId: streamer.mintId,
        streamerId: streamer.id,
        sessionId: sessionInfo.sessionId,
      });

      activeSessions.value.set(streamer.id, {
        sessionId: sessionInfo.sessionId,
        streamerId: streamer.id,
        mintId: streamer.mintId,
        startedAt: Date.now(),
        streamStartTime: status.streamStartTimestamp || Date.now(),
        totalSegments: 0,
        processedSegments: 0,
        isRecording: true,
        projectId: sessionInfo.projectId,
      });
    } catch (error) {
      console.error('[LiveMonitor] Failed to start stream session', error);
    }
  }

  async function handleStreamEnd(streamer: MonitoredStreamer) {
    const session = activeSessions.value.get(streamer.id);
    if (!session) return;

    try {
      await invoke('stop_livestream_recording', { mintId: streamer.mintId });
    } catch (error) {
      console.warn('[LiveMonitor] Failed to stop recorder on end', error);
    }

    try {
      await endLivestreamSession(session.sessionId, Math.floor(Date.now() / 1000));
    } catch (error) {
      console.warn('[LiveMonitor] Failed to mark session ended', error);
    }

    await updateMonitoredStreamer(streamer.id, {
      is_currently_live: 0,
      current_session_id: null,
    });

    activeSessions.value.delete(streamer.id);
  }

  return {
    startMonitoring,
    stopMonitoring,
    activeSessions,
    isMonitoring,
  };
}
