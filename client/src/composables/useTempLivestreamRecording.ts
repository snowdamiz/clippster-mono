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

// State for a single temp recording
export interface TempRecordingState {
  mintId: string;
  tempSessionId: string;
  isRecording: boolean;
  startedAt: number;
  segments: TempSegmentInfo[];
  totalDuration: number;
  streamEnded: boolean;
}

// Event payloads from backend
interface TempSegmentReadyPayload {
  mintId: string;
  tempSessionId: string;
  segment: number;
  path: string;
  duration: number;
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

  // Listen for temp segment ready events
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

  unlistenFunctions.push(segmentUnlisten, streamEndedUnlisten, exitUnlisten);
  listenersInitialized = true;
  console.log('[TempRecording] Event listeners initialized');
}

export function useTempLivestreamRecording() {
  // Computed helpers
  const hasTempRecording = (mintId: string) => computed(() => tempRecordings.value.has(mintId));
  
  const getTempRecordingState = (mintId: string) => computed(() => tempRecordings.value.get(mintId));

  /**
   * Start a temp recording for a mint (for watch-only DVR)
   * Returns the temp session ID if successful
   */
  async function startTempRecording(mintId: string, segmentDurationMinutes: number = 3): Promise<string> {
    // Initialize listeners if needed
    await initializeListeners();

    // Check if we already have a recording
    if (tempRecordings.value.has(mintId)) {
      const existing = tempRecordings.value.get(mintId)!;
      console.log(`[TempRecording] Already recording ${mintId}, returning existing session: ${existing.tempSessionId}`);
      return existing.tempSessionId;
    }

    try {
      // Start recording via backend
      const tempSessionId = await invoke<string>('start_temp_livestream_recording', {
        mintId,
        segmentDurationMinutes,
      });

      // Create initial state
      const state: TempRecordingState = {
        mintId,
        tempSessionId,
        isRecording: true,
        startedAt: Date.now(),
        segments: [],
        totalDuration: 0,
        streamEnded: false,
      };

      const newMap = new Map(tempRecordings.value);
      newMap.set(mintId, state);
      tempRecordings.value = newMap;

      console.log(`[TempRecording] Started recording for ${mintId} with session ${tempSessionId}`);
      return tempSessionId;
    } catch (error) {
      // If error is "already active", try to return existing session
      if (String(error).includes('already active')) {
        const existing = tempRecordings.value.get(mintId);
        if (existing) {
          return existing.tempSessionId;
        }
      }
      throw error;
    }
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
  };
}

