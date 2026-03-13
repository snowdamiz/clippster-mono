import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useRealtimeTranscription } from './useRealtimeTranscription';
import { createClip as createClipRecord } from '@/services/database';
import { createClipVersion } from '@/services/database/clip-versions';
import { updateClip } from '@/services/database/clips';
import { getOrCreateManualSession } from '@/services/database/clip-detection-sessions';
import { createProject } from '@/services/database/projects';
import type { SupportedLivestreamPlatform } from '@/types/livestream';
import { API_BASE } from '@/lib/apiBase';

interface DetectedClip {
  title: string;
  description: string;
  start_time: number;
  duration: number;
  virality_score: number;
  detection_reason: string;
}

interface PendingClip {
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  viralityScore: number;
  detectionReason: string;
  contextSummary: string;
}

interface SegmentInfo {
  segmentNumber: number;
  filePath: string;
  startTime: number;
  duration: number;
  endTime: number;
}

interface RealtimeDetectionState {
  isActive: boolean;
  sessionId: string | null;
  projectId: string | null;
  detectionInterval: number | null;
  creditInterval: number | null;
  pendingClip: PendingClip | null;
  prompt: string;
  startTime: number;
  creditsUsed: number;
  segments: SegmentInfo[];
  recentlySavedClips: SavedClipInfo[];
}

interface SavedClipInfo {
  startTime: number;
  endTime: number;
  title: string;
  savedAt: number;
}

const DETECTION_INTERVAL_MS = 30_000; // 30 seconds
const VIRALITY_THRESHOLD = 85;
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const OVERLAP_THRESHOLD = 0.3; // 30% time overlap = potential duplicate
const TITLE_SIMILARITY_THRESHOLD = 0.25; // 25% word similarity = potential duplicate (lowered to catch "Savage Brother Roast" variants)

const state = ref<RealtimeDetectionState>({
  isActive: false,
  sessionId: null,
  projectId: null,
  detectionInterval: null,
  creditInterval: null,
  pendingClip: null,
  prompt: '',
  startTime: 0,
  creditsUsed: 0,
  segments: [],
  recentlySavedClips: [],
});

/**
 * Calculate time overlap ratio between two time ranges
 * Returns 0.0 to 1.0 (ratio of overlap to smaller duration)
 */
function calculateTimeOverlap(
  start1: number, end1: number,
  start2: number, end2: number
): number {
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  const overlapDuration = Math.max(0, overlapEnd - overlapStart);
  
  const duration1 = Math.max(1, end1 - start1);
  const duration2 = Math.max(1, end2 - start2);
  const smallerDuration = Math.min(duration1, duration2);
  
  return overlapDuration / smallerDuration;
}

/**
 * Calculate word similarity (Jaccard index) between two strings
 */
function calculateWordSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Check if a clip would be a duplicate of a recently saved clip
 * Uses BOTH time overlap AND title similarity to catch near-duplicates
 */
function isDuplicateOfRecentClip(pending: PendingClip): boolean {
  const now = Date.now();
  
  // Filter to clips saved within the dedup window
  const recentClips = state.value.recentlySavedClips.filter(
    clip => now - clip.savedAt < DEDUP_WINDOW_MS
  );
  
  for (const recent of recentClips) {
    const overlap = calculateTimeOverlap(
      pending.startTime, pending.endTime,
      recent.startTime, recent.endTime
    );
    
    const titleSimilarity = calculateWordSimilarity(pending.title, recent.title);
    
    // Duplicate if: significant time overlap AND similar titles
    // OR very high time overlap alone (>70%)
    // OR very high title similarity with any overlap (>60% title sim + >10% overlap)
    const isDuplicate = 
      (overlap > OVERLAP_THRESHOLD && titleSimilarity > TITLE_SIMILARITY_THRESHOLD) ||
      (overlap > 0.7) ||
      (titleSimilarity > 0.6 && overlap > 0.1);
    
    if (isDuplicate) {
      console.log(`[RealtimeClipDetection] Duplicate detected: "${pending.title}" (overlap=${Math.round(overlap * 100)}%, titleSim=${Math.round(titleSimilarity * 100)}%) with recently saved "${recent.title}"`);
      return true;
    }
  }
  
  return false;
}

export function useRealtimeClipDetection() {
  const transcription = useRealtimeTranscription();
  
  const isActive = computed(() => state.value.isActive);
  const creditsUsed = computed(() => state.value.creditsUsed);
  const detectionDurationMinutes = computed(() => {
    if (!state.value.isActive || state.value.startTime === 0) return 0;
    return Math.floor((Date.now() - state.value.startTime) / 60000);
  });

  /**
   * Start real-time clip detection
   */
  async function startDetection(options: {
    sessionId: string;
    streamerName: string;
    platform: SupportedLivestreamPlatform;
    mintId?: string;
    prompt: string;
    segments?: SegmentInfo[];
  }) {
    if (state.value.isActive) {
      console.warn('[RealtimeClipDetection] Already active');
      return;
    }

    console.log('[RealtimeClipDetection] Starting detection with prompt:', options.prompt);

    // Create project folder for auto clips
    const projectName = `Auto Clip - ${options.streamerName} Live ${new Date().toLocaleString('en-US', { 
      month: 'numeric', 
      day: 'numeric', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: 'numeric', 
      second: 'numeric', 
      hour12: true 
    })}`;
    const projectDescription = `Auto-detected clips from ${options.platform} livestream ${options.streamerName}`;
    const projectId = await createProject(projectName, projectDescription, undefined, options.platform);

    state.value.isActive = true;
    state.value.sessionId = options.sessionId;
    state.value.projectId = projectId;
    state.value.prompt = options.prompt;
    state.value.pendingClip = null;
    state.value.startTime = Date.now();
    state.value.creditsUsed = 0;
    state.value.segments = options.segments || [];

    // Start transcription
    await transcription.startTranscription(options.sessionId);

    // Start detection interval (every 30 seconds)
    state.value.detectionInterval = window.setInterval(async () => {
      await runDetection();
    }, DETECTION_INTERVAL_MS);

    // Start credit deduction interval (every minute)
    state.value.creditInterval = window.setInterval(async () => {
      await deductCredit();
    }, 60_000); // 60 seconds

    console.log('[RealtimeClipDetection] Detection started, project:', projectId);
  }

  /**
   * Update segments array (called by livestream monitoring as new segments arrive)
   */
  function updateSegments(segments: SegmentInfo[]) {
    state.value.segments = segments;
  }

  /**
   * Deduct 1 credit for 1 minute of detection
   */
  async function deductCredit() {
    try {
      const token = localStorage.getItem('auth_token') || '';
      const response = await fetch(`${API_BASE}/credits/deduct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: 1,
          reason: 'Real-time clip detection (1 minute)',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[RealtimeClipDetection] Credit deduction failed:', error);
        
        // If out of credits, stop detection
        if (response.status === 402 || error.error === 'Insufficient credits') {
          console.warn('[RealtimeClipDetection] Out of credits, stopping detection');
          stopDetection();
          
          // Emit event for UI notification
          window.dispatchEvent(new CustomEvent('realtime-detection-stopped', {
            detail: { reason: 'out_of_credits' },
          }));
        }
        return;
      }

      state.value.creditsUsed += 1;
      console.log('[RealtimeClipDetection] Credit deducted, total used:', state.value.creditsUsed);
    } catch (error) {
      console.error('[RealtimeClipDetection] Credit deduction error:', error);
    }
  }

  /**
   * Stop real-time clip detection
   */
  async function stopDetection() {
    console.log('[RealtimeClipDetection] Stopping detection');

    if (state.value.detectionInterval) {
      clearInterval(state.value.detectionInterval);
      state.value.detectionInterval = null;
    }

    if (state.value.creditInterval) {
      clearInterval(state.value.creditInterval);
      state.value.creditInterval = null;
    }

    // Save pending clip before stopping
    if (state.value.pendingClip) {
      await savePendingClip();
    }

    transcription.stopTranscription();

    // Calculate final detection time and deduct remaining credits
    const elapsedMinutes = Math.ceil((Date.now() - state.value.startTime) / 60000);
    const remainingCredits = elapsedMinutes - state.value.creditsUsed;
    
    if (remainingCredits > 0) {
      // Deduct remaining credits for partial minute
      deductCredit();
    }

    state.value.isActive = false;
    state.value.sessionId = null;
    state.value.projectId = null;
    state.value.prompt = '';
    state.value.pendingClip = null;
    state.value.startTime = 0;
    state.value.creditsUsed = 0;
    state.value.recentlySavedClips = [];
  }

  /**
   * Run AI detection on current transcript buffer
   */
  async function runDetection() {
    if (!state.value.isActive || !state.value.projectId) {
      return;
    }

    const transcript = transcription.getFormattedTranscript();
    
    if (!transcript.text || transcript.text.length < 50) {
      console.log('[RealtimeClipDetection] Transcript too short, skipping detection');
      return;
    }

    console.log('[RealtimeClipDetection] Running detection on transcript:', {
      length: transcript.text.length,
      timeRange: `${transcript.start}s - ${transcript.end}s`,
    });

    // Analyze audio peaks from segments to detect loud/exciting moments
    let audioContext = '';
    try {
      if (state.value.segments.length > 0) {
        console.log('[RealtimeClipDetection] Analyzing audio peaks from segments...');
        
        // Find segments that overlap with the transcript time range
        const relevantSegments = state.value.segments.filter(seg => 
          seg.endTime > transcript.start && seg.startTime < transcript.end
        );

        if (relevantSegments.length > 0) {
          // Analyze the most recent segment for audio peaks
          const latestSegment = relevantSegments[relevantSegments.length - 1];
          
          const peaks = await invoke<Array<{ time: number; amplitude: number }>>('detect_audio_peaks', {
            videoPath: latestSegment.filePath,
            threshold: 0.3, // 30% above mean volume
            minInterval: 2.0, // At least 2 seconds between peaks
          });

          if (peaks.length > 0) {
            // Map peaks to transcript time range
            const peakTimes = peaks
              .map(p => latestSegment.startTime + p.time)
              .filter(t => t >= transcript.start && t <= transcript.end)
              .map(t => Math.round(t));

            if (peakTimes.length > 0) {
              audioContext = `AUDIO ANALYSIS: Detected ${peakTimes.length} volume spike(s) at ${peakTimes.join('s, ')}s (loud moments/screaming/excitement)`;
              console.log('[RealtimeClipDetection]', audioContext);
            }
          }
        }
      }
    } catch (error) {
      console.warn('[RealtimeClipDetection] Audio peak analysis failed:', error);
      // Continue without audio context
    }

    try {
      const token = localStorage.getItem('auth_token') || '';
      
      const response = await fetch(`${API_BASE}/clips/detect-realtime`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          transcript: transcript.text,
          transcript_start: transcript.start,
          transcript_end: transcript.end,
          prompt: state.value.prompt,
          virality_threshold: VIRALITY_THRESHOLD,
          audio_context: audioContext,
          pending_clip: state.value.pendingClip ? {
            title: state.value.pendingClip.title,
            description: state.value.pendingClip.description,
            start_time: state.value.pendingClip.startTime,
            end_time: state.value.pendingClip.endTime,
            context_summary: state.value.pendingClip.contextSummary,
          } : null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Detection failed: ${response.statusText}`);
      }

      const result = await response.json();
      const contextChange = result.context_change || false;
      const pendingClipData = result.pending_clip;

      console.log('[RealtimeClipDetection] Context change:', contextChange);

      // If context changed, save the current pending clip
      if (contextChange && state.value.pendingClip) {
        await savePendingClip();
      }

      // Update or create pending clip with new data
      if (pendingClipData) {
        state.value.pendingClip = {
          title: pendingClipData.title,
          description: pendingClipData.description,
          startTime: pendingClipData.start_time,
          endTime: pendingClipData.end_time || transcript.end,
          viralityScore: pendingClipData.virality_score,
          detectionReason: pendingClipData.detection_reason,
          contextSummary: pendingClipData.context_summary || '',
        };
        console.log('[RealtimeClipDetection] Pending clip updated:', state.value.pendingClip.title);
      }
    } catch (error) {
      console.error('[RealtimeClipDetection] Detection error:', error);
    }
  }

  /**
   * Save the pending clip to database and extract video file
   */
  async function savePendingClip() {
    if (!state.value.pendingClip || !state.value.projectId || !state.value.sessionId) {
      return;
    }

    const pending = state.value.pendingClip;

    // Check virality threshold before saving
    if (pending.viralityScore < VIRALITY_THRESHOLD) {
      console.log('[RealtimeClipDetection] Pending clip below threshold:', pending.viralityScore, '- discarding');
      state.value.pendingClip = null;
      return;
    }

    // Check for duplicates with recently saved clips (client-side safeguard)
    if (isDuplicateOfRecentClip(pending)) {
      console.log('[RealtimeClipDetection] Skipping duplicate clip:', pending.title);
      state.value.pendingClip = null;
      return;
    }

    console.log('[RealtimeClipDetection] Saving pending clip:', pending.title, `(${pending.startTime}s - ${pending.endTime}s)`);

    try {
      // Extract the video clip
      const clipDuration = pending.endTime - pending.startTime;
      const resultJson = await invoke<string>('extract_livestream_clip', {
        sessionId: state.value.sessionId,
        clipEndTime: pending.endTime,
        clipDuration: clipDuration,
        clipName: pending.title,
        segments: state.value.segments,
        projectId: state.value.projectId,
        watermarkId: null,
        watermarkSettings: null,
      });

      const extractionResult = JSON.parse(resultJson) as { clipPath: string; thumbnailPath: string | null };
      const clipFilePath = extractionResult.clipPath;
      const thumbnailFilePath = extractionResult.thumbnailPath;

      // Save clip to database
      const clipId = await createClipRecord(state.value.projectId, clipFilePath, {
        name: pending.title,
        duration: clipDuration,
        startTime: pending.startTime,
        endTime: pending.endTime,
        thumbnailPath: thumbnailFilePath || undefined,
      });

      // Create clip version
      const manualSessionId = await getOrCreateManualSession(state.value.projectId);
      const versionId = await createClipVersion(
        clipId,
        manualSessionId,
        1,
        {
          name: pending.title,
          startTime: pending.startTime,
          endTime: pending.endTime,
          description: pending.description,
          viralityScore: pending.viralityScore,
          detectionReason: pending.detectionReason,
        },
        'detected'
      );
      await updateClip(clipId, { current_version_id: versionId, detection_session_id: manualSessionId });

      console.log('[RealtimeClipDetection] Pending clip saved:', clipId);

      // Track this clip to prevent duplicates
      state.value.recentlySavedClips.push({
        startTime: pending.startTime,
        endTime: pending.endTime,
        title: pending.title,
        savedAt: Date.now(),
      });

      // Clean up old entries (older than dedup window)
      const now = Date.now();
      state.value.recentlySavedClips = state.value.recentlySavedClips.filter(
        clip => now - clip.savedAt < DEDUP_WINDOW_MS
      );

      // Emit event for UI updates
      window.dispatchEvent(new CustomEvent('realtime-clip-detected', {
        detail: {
          clipId,
          projectId: state.value.projectId,
          title: pending.title,
          startTime: pending.startTime,
          duration: clipDuration,
          viralityScore: pending.viralityScore,
          detectionReason: pending.detectionReason,
          clipPath: clipFilePath,
        },
      }));

      // Clear pending clip after saving
      state.value.pendingClip = null;
    } catch (error) {
      console.error('[RealtimeClipDetection] Failed to save pending clip:', error);
    }
  }


  return {
    isActive,
    creditsUsed,
    detectionDurationMinutes,
    startDetection,
    stopDetection,
    updateSegments,
  };
}
