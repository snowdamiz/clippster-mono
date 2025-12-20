import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Segment info for DVR playback from temp recordings
export interface TempSegmentInfo {
  segmentNumber: number;
  filePath: string;
  startTime: number; // Seconds from recording start
  duration: number;
  endTime: number;
}

// State for a single temp recording (HLS-based for instant DVR)
export interface TempRecordingState {
  mintId: string;
  tempSessionId: string;
  isRecording: boolean;
  startedAt: number;
  segments: TempSegmentInfo[];
  totalDuration: number;
  streamEnded: boolean;
  // HLS-specific fields
  playlistPath: string | null;
  outputDir: string | null;
}

// Response from backend when starting temp recording
interface TempRecordingInfoResponse {
  sessionId: string;
  outputDir: string;
  alreadyActive: boolean;
}

// Event payloads from backend
interface TempSegmentReadyPayload {
  mintId: string;
  tempSessionId: string;
  segment: number;
  path: string;
  duration: number;
}

// HLS-specific segment payload with playlist info
interface TempHlsSegmentPayload {
  mintId: string;
  tempSessionId: string;
  segment: number;
  path: string;
  duration: number;
  playlistPath: string;
  totalSegments: number;
  totalDuration: number;
}

interface TempStreamEndedPayload {
  mintId: string;
  tempSessionId: string;
}

interface TempRecorderExitPayload {
  mintId: string;
  tempSessionId: string;
  code: number | null;
}

// Global state - shared across all instances
const tempRecordings = ref<Map<string, TempRecordingState>>(new Map());
let listenersInitialized = false;
const unlistenFunctions: UnlistenFn[] = [];

// Initialize event listeners (called once)
async function initializeListeners() {
  if (listenersInitialized) return;

  // Listen for temp segment ready events (basic segment info)
  const segmentUnlisten = await listen<TempSegmentReadyPayload>('temp-segment-ready', (event) => {
    const { mintId, tempSessionId, segment, path, duration } = event.payload;
    
    const state = tempRecordings.value.get(mintId);
    if (!state || state.tempSessionId !== tempSessionId) {
      console.warn('[TempRecording] Received segment for unknown session:', mintId, tempSessionId);
      return;
    }

    // Calculate start time based on existing segments
    const startTime = state.totalDuration;
    
    const newSegment: TempSegmentInfo = {
      segmentNumber: segment,
      filePath: path,
      startTime,
      duration,
      endTime: startTime + duration,
    };

    // Update state immutably
    const updatedState: TempRecordingState = {
      ...state,
      segments: [...state.segments, newSegment],
      totalDuration: startTime + duration,
    };
    
    const newMap = new Map(tempRecordings.value);
    newMap.set(mintId, updatedState);
    tempRecordings.value = newMap;

    console.log(`[TempRecording] Segment ${segment} ready for ${mintId}, total duration: ${updatedState.totalDuration}s`);
  });

  // Listen for HLS-specific segment events (with playlist path for DVR)
  const hlsSegmentUnlisten = await listen<TempHlsSegmentPayload>('temp-hls-segment', (event) => {
    const { mintId, tempSessionId, segment, path, duration, playlistPath, totalDuration } = event.payload;
    
    const state = tempRecordings.value.get(mintId);
    if (!state || state.tempSessionId !== tempSessionId) {
      console.warn('[TempRecording] Received HLS segment for unknown session:', mintId, tempSessionId);
      return;
    }

    // Calculate start time based on existing segments
    const startTime = state.segments.length > 0 
      ? state.segments[state.segments.length - 1].endTime 
      : 0;
    
    // Check if segment already exists
    const existingSegment = state.segments.find(s => s.segmentNumber === segment);
    if (existingSegment) {
      // Just update playlist path if needed
      if (!state.playlistPath && playlistPath) {
        const updatedState: TempRecordingState = {
          ...state,
          playlistPath,
          totalDuration,
        };
        const newMap = new Map(tempRecordings.value);
        newMap.set(mintId, updatedState);
        tempRecordings.value = newMap;
      }
      return;
    }
    
    const newSegment: TempSegmentInfo = {
      segmentNumber: segment,
      filePath: path,
      startTime,
      duration,
      endTime: startTime + duration,
    };

    // Update state with HLS playlist info
    const updatedState: TempRecordingState = {
      ...state,
      segments: [...state.segments, newSegment],
      totalDuration: totalDuration || (startTime + duration),
      playlistPath: playlistPath || state.playlistPath,
    };
    
    const newMap = new Map(tempRecordings.value);
    newMap.set(mintId, updatedState);
    tempRecordings.value = newMap;

    console.log(`[TempRecording] HLS segment ${segment} ready for ${mintId}, duration: ${duration}s, total: ${updatedState.totalDuration}s`);
  });

  // Listen for temp stream ended events
  const streamEndedUnlisten = await listen<TempStreamEndedPayload>('temp-stream-ended', (event) => {
    const { mintId, tempSessionId } = event.payload;
    
    const state = tempRecordings.value.get(mintId);
    if (!state || state.tempSessionId !== tempSessionId) return;

    const updatedState: TempRecordingState = {
      ...state,
      streamEnded: true,
      isRecording: false,
    };
    
    const newMap = new Map(tempRecordings.value);
    newMap.set(mintId, updatedState);
    tempRecordings.value = newMap;

    console.log(`[TempRecording] Stream ended for ${mintId}`);
  });

  // Listen for temp recorder exit events
  const exitUnlisten = await listen<TempRecorderExitPayload>('temp-recorder-exit', (event) => {
    const { mintId, tempSessionId, code } = event.payload;
    
    const state = tempRecordings.value.get(mintId);
    if (!state || state.tempSessionId !== tempSessionId) return;

    const updatedState: TempRecordingState = {
      ...state,
      isRecording: false,
    };
    
    const newMap = new Map(tempRecordings.value);
    newMap.set(mintId, updatedState);
    tempRecordings.value = newMap;

    console.log(`[TempRecording] Recorder exited for ${mintId} with code: ${code}`);
  });

  unlistenFunctions.push(segmentUnlisten, hlsSegmentUnlisten, streamEndedUnlisten, exitUnlisten);
  listenersInitialized = true;
  console.log('[TempRecording] HLS event listeners initialized');
}

export function useTempLivestreamRecording() {
  // Computed helpers
  const hasTempRecording = (mintId: string) => computed(() => tempRecordings.value.has(mintId));
  
  const getTempRecordingState = (mintId: string) => computed(() => tempRecordings.value.get(mintId));

  /**
   * Start a temp HLS recording for a mint (for watch-only DVR with instant rewind)
   * Uses 4-second segments by default for responsive DVR like Kick
   * Returns the temp session ID if successful
   */
  async function startTempRecording(mintId: string, segmentDurationSeconds: number = 4): Promise<string> {
    // Initialize listeners if needed
    await initializeListeners();

    // Check if we already have the state locally
    if (tempRecordings.value.has(mintId)) {
      const existing = tempRecordings.value.get(mintId)!;
      console.log(`[TempRecording] Already tracking ${mintId}, returning existing session: ${existing.tempSessionId}`);
      return existing.tempSessionId;
    }

    // Start HLS recording via backend (returns existing session info if already active)
    const response = await invoke<TempRecordingInfoResponse>('start_temp_livestream_recording', {
      mintId,
      segmentDurationSeconds,
    });

    const { sessionId, outputDir, alreadyActive } = response;
    
    // Create/update state with HLS-specific fields
    const state: TempRecordingState = {
      mintId,
      tempSessionId: sessionId,
      isRecording: true,
      startedAt: Date.now(),
      segments: [],
      totalDuration: 0,
      streamEnded: false,
      playlistPath: outputDir ? `${outputDir}\\playlist.m3u8` : null,
      outputDir,
    };

    const newMap = new Map(tempRecordings.value);
    newMap.set(mintId, state);
    tempRecordings.value = newMap;

    if (alreadyActive) {
      console.log(`[TempRecording] Connected to existing HLS recording for ${mintId} with session ${sessionId}`);
    } else {
      console.log(`[TempRecording] Started HLS recording for ${mintId} with session ${sessionId} (${segmentDurationSeconds}s segments)`);
    }
    
    return sessionId;
  }

  /**
   * Stop a temp recording without cleanup (files remain for DVR access)
   */
  async function stopTempRecording(mintId: string): Promise<void> {
    try {
      await invoke('stop_temp_livestream_recording', { mintId });
      
      const state = tempRecordings.value.get(mintId);
      if (state) {
        const updatedState: TempRecordingState = {
          ...state,
          isRecording: false,
        };
        const newMap = new Map(tempRecordings.value);
        newMap.set(mintId, updatedState);
        tempRecordings.value = newMap;
      }
      
      console.log(`[TempRecording] Stopped recording for ${mintId}`);
    } catch (error) {
      console.warn(`[TempRecording] Error stopping recording for ${mintId}:`, error);
    }
  }

  /**
   * Cleanup temp recording files (stop and delete)
   */
  async function cleanupTempRecording(mintId: string): Promise<void> {
    try {
      await invoke('cleanup_temp_recording', { mintId });
      
      // Remove from state
      const newMap = new Map(tempRecordings.value);
      newMap.delete(mintId);
      tempRecordings.value = newMap;
      
      console.log(`[TempRecording] Cleaned up recording for ${mintId}`);
    } catch (error) {
      console.warn(`[TempRecording] Error cleaning up recording for ${mintId}:`, error);
      // Still remove from state even if cleanup failed
      const newMap = new Map(tempRecordings.value);
      newMap.delete(mintId);
      tempRecordings.value = newMap;
    }
  }

  /**
   * Check if a temp recording is active in the backend
   */
  async function isTempRecordingActive(mintId: string): Promise<boolean> {
    try {
      return await invoke<boolean>('is_temp_recording_active', { mintId });
    } catch (error) {
      console.warn(`[TempRecording] Error checking if recording is active:`, error);
      return false;
    }
  }

  /**
   * Get the temp recording directory path for a mint
   */
  async function getTempRecordingPath(mintId: string): Promise<string | null> {
    try {
      return await invoke<string>('get_temp_recording_path', { mintId });
    } catch (error) {
      console.warn(`[TempRecording] Error getting recording path:`, error);
      return null;
    }
  }

  /**
   * Get segments for a temp recording
   */
  function getSegments(mintId: string): TempSegmentInfo[] {
    return tempRecordings.value.get(mintId)?.segments || [];
  }

  /**
   * Get total duration of temp recording
   */
  function getTotalDuration(mintId: string): number {
    return tempRecordings.value.get(mintId)?.totalDuration || 0;
  }

  /**
   * Check if stream has ended for a temp recording
   */
  function hasStreamEnded(mintId: string): boolean {
    return tempRecordings.value.get(mintId)?.streamEnded || false;
  }

  /**
   * Get temp session ID for a mint
   */
  function getTempSessionId(mintId: string): string | null {
    return tempRecordings.value.get(mintId)?.tempSessionId || null;
  }

  /**
   * Get HLS playlist path for DVR playback
   */
  function getPlaylistPath(mintId: string): string | null {
    return tempRecordings.value.get(mintId)?.playlistPath || null;
  }

  /**
   * Get output directory for a temp recording
   */
  function getOutputDir(mintId: string): string | null {
    return tempRecordings.value.get(mintId)?.outputDir || null;
  }

  /**
   * Cleanup all temp recordings (called on app close)
   */
  async function cleanupAllTempRecordings(): Promise<void> {
    const mints = Array.from(tempRecordings.value.keys());
    for (const mintId of mints) {
      await cleanupTempRecording(mintId);
    }
  }

  return {
    // State
    tempRecordings,
    
    // Computed helpers
    hasTempRecording,
    getTempRecordingState,
    
    // Actions
    startTempRecording,
    stopTempRecording,
    cleanupTempRecording,
    isTempRecordingActive,
    getTempRecordingPath,
    cleanupAllTempRecordings,
    
    // Getters
    getSegments,
    getTotalDuration,
    hasStreamEnded,
    getTempSessionId,
    getPlaylistPath,
    getOutputDir,
  };
}
