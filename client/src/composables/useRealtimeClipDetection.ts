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
  hookScore?: number;
  payoffScore?: number;
  emotionScore?: number;
  shareabilityScore?: number;
  densityScore?: number;
  signalScore?: number;
  boundaryScore?: number;
}

interface ClipQualityResult {
  shouldSave: boolean;
  pending: PendingClip;
  reasons: string[];
}

interface RealtimeSignalSummary {
  shouldAskAi: boolean;
  reasons: string[];
  triggerPhrases: string[];
  audioPeakCount: number;
  recentWordCount: number;
  recentSpeechDensity: number;
  recentLongestGap: number;
}

interface DetectionDebugStats {
  windowsScanned: number;
  lowSignalSkips: number;
  aiCalls: number;
  serverRejections: number;
  qualityRejections: number;
  thresholdRejections: number;
  duplicateSkips: number;
  clipsSaved: number;
  errors: number;
  lastReasons: string[];
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
  /** Wall-clock time when the current pending clip "moment" started (new topic / new start time). */
  pendingClipEpochStart: number | null;
  prompt: string;
  startTime: number;
  creditsUsed: number;
  segments: SegmentInfo[];
  recentlySavedClips: SavedClipInfo[];
  consecutiveLowSignalDetections: number;
  debugStats: DetectionDebugStats;
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
const MIN_CLIP_DURATION_SECONDS = 4;
const MAX_LEADING_SILENCE_SECONDS = 3;
const MAX_TRAILING_SILENCE_SECONDS = 5;
const MAX_INTERNAL_SILENCE_SECONDS = 14;
const TRIM_BEFORE_FIRST_WORD_SECONDS = 0.75;
const TRIM_AFTER_LAST_WORD_SECONDS = 2;
const RECENT_SIGNAL_WINDOW_SECONDS = 30;
const LOW_SIGNAL_DETECTIONS_TO_CLOSE_PENDING = 2;
/** If the model keeps extending one pending clip, finalize after this wall time so clips actually save while live. */
const MAX_PENDING_WALL_CLOCK_MS = 2 * 60 * 1000;
/** Hard cap on pending span before we finalize (stream keeps "signals" high forever otherwise). */
/** Slightly under typical model max so ~95s pendings still finalize. */
const MAX_PENDING_CLIP_SPAN_SECONDS = 90;
/** New AI pending with start moved more than this (seconds) resets the stale-finalize timer. */
const PENDING_NEW_MOMENT_START_DELTA_SECONDS = 10;
const TRIGGER_PHRASES = [
  'clip that',
  'clip this',
  'clip it',
  "that's a clip",
  'thats a clip',
  'someone clip',
  'chat clip',
  'w clip',
  'no way',
  'oh my god',
  'what the fuck',
  'wtf',
  'holy shit',
  'insane',
  'crazy',
];

function createDebugStats(): DetectionDebugStats {
  return {
    windowsScanned: 0,
    lowSignalSkips: 0,
    aiCalls: 0,
    serverRejections: 0,
    qualityRejections: 0,
    thresholdRejections: 0,
    duplicateSkips: 0,
    clipsSaved: 0,
    errors: 0,
    lastReasons: [],
  };
}

const state = ref<RealtimeDetectionState>({
  isActive: false,
  sessionId: null,
  projectId: null,
  detectionInterval: null,
  creditInterval: null,
  pendingClip: null,
  pendingClipEpochStart: null,
  prompt: '',
  startTime: 0,
  creditsUsed: 0,
  segments: [],
  recentlySavedClips: [],
  consecutiveLowSignalDetections: 0,
  debugStats: createDebugStats(),
});

/**
 * Calculate time overlap ratio between two time ranges
 * Returns 0.0 to 1.0 (ratio of overlap to smaller duration)
 */
function calculateTimeOverlap(start1: number, end1: number, start2: number, end2: number): number {
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
  const words1 = new Set(
    str1
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  const words2 = new Set(
    str2
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
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
    (clip) => now - clip.savedAt < DEDUP_WINDOW_MS
  );

  for (const recent of recentClips) {
    const overlap = calculateTimeOverlap(
      pending.startTime,
      pending.endTime,
      recent.startTime,
      recent.endTime
    );

    const titleSimilarity = calculateWordSimilarity(pending.title, recent.title);

    // Duplicate if: (tightened thresholds to prevent near-duplicates)
    // - 50%+ time overlap alone
    // - 20%+ overlap with 40%+ title similarity
    // - 50%+ title similarity with any overlap (>10%)
    const isDuplicate =
      overlap > 0.5 ||
      (overlap > 0.2 && titleSimilarity > 0.4) ||
      (titleSimilarity > 0.5 && overlap > 0.1);

    if (isDuplicate) {
      console.log(
        `[RealtimeClipDetection] Duplicate detected: "${pending.title}" (overlap=${Math.round(overlap * 100)}%, titleSim=${Math.round(titleSimilarity * 100)}%) with recently saved "${recent.title}"`
      );
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

  function recordDebugEvent(type: string, detail: Record<string, unknown> = {}) {
    const reason = typeof detail.reason === 'string' ? detail.reason : type;
    state.value.debugStats.lastReasons = [
      reason,
      ...state.value.debugStats.lastReasons.filter((existing) => existing !== reason),
    ].slice(0, 10);

    window.dispatchEvent(
      new CustomEvent('realtime-detection-debug', {
        detail: {
          type,
          stats: { ...state.value.debugStats },
          ...detail,
        },
      })
    );
  }

  function evaluatePendingClipQuality(pending: PendingClip): ClipQualityResult {
    const initialStats = transcription.getTranscriptStats(pending.startTime, pending.endTime);
    const reasons: string[] = [];

    if (
      initialStats.wordCount === 0 ||
      initialStats.firstSpeechTime === null ||
      initialStats.lastSpeechTime === null
    ) {
      return {
        shouldSave: false,
        pending,
        reasons: ['no_speech_in_clip_range'],
      };
    }

    const adjusted: PendingClip = { ...pending };

    if (initialStats.leadingSilence > MAX_LEADING_SILENCE_SECONDS) {
      adjusted.startTime = Math.max(
        pending.startTime,
        initialStats.firstSpeechTime - TRIM_BEFORE_FIRST_WORD_SECONDS
      );
      reasons.push(`trimmed_leading_silence_${Math.round(initialStats.leadingSilence)}s`);
    }

    if (initialStats.trailingSilence > MAX_TRAILING_SILENCE_SECONDS) {
      adjusted.endTime = Math.min(
        pending.endTime,
        initialStats.lastSpeechTime + TRIM_AFTER_LAST_WORD_SECONDS
      );
      reasons.push(`trimmed_trailing_silence_${Math.round(initialStats.trailingSilence)}s`);
    }

    const stats = transcription.getTranscriptStats(adjusted.startTime, adjusted.endTime);
    const duration = Math.max(0, adjusted.endTime - adjusted.startTime);
    const minWords = duration <= 12 ? 4 : duration <= 20 ? 8 : 12;
    const minSpeechDensity = duration <= 12 ? 0.35 : 0.45;

    if (duration < MIN_CLIP_DURATION_SECONDS) {
      reasons.push(`too_short_${Math.round(duration)}s`);
    }

    if (stats.wordCount < minWords) {
      reasons.push(`too_few_words_${stats.wordCount}_of_${minWords}`);
    }

    if (stats.speechDensity < minSpeechDensity) {
      reasons.push(`low_speech_density_${stats.speechDensity.toFixed(2)}wps`);
    }

    const internalSilenceLimit =
      duration <= 45
        ? MAX_INTERNAL_SILENCE_SECONDS
        : duration <= 90
          ? 18
          : 22;
    if (stats.longestGap > internalSilenceLimit && duration > 25) {
      reasons.push(`internal_dead_air_${Math.round(stats.longestGap)}s`);
    }

    if (
      stats.leadingSilence > MAX_LEADING_SILENCE_SECONDS ||
      stats.trailingSilence > MAX_TRAILING_SILENCE_SECONDS
    ) {
      reasons.push('untrimmed_boundary_silence');
    }

    return {
      shouldSave: reasons.every((reason) => reason.startsWith('trimmed_')),
      pending: adjusted,
      reasons,
    };
  }

  function buildRealtimeSignalSummary(
    transcriptText: string,
    recentStats: ReturnType<typeof transcription.getTranscriptStats>,
    absolutePeakTimes: number[]
  ): RealtimeSignalSummary {
    const normalizedText = transcriptText.toLowerCase();
    const triggerPhrases = TRIGGER_PHRASES.filter((phrase) => normalizedText.includes(phrase));
    const reasons: string[] = [];

    if (triggerPhrases.length > 0) {
      reasons.push('trigger_phrase');
    }

    if (absolutePeakTimes.length > 0) {
      reasons.push('audio_peak');
    }

    if (recentStats.wordCount >= 18 && recentStats.speechDensity >= 0.45) {
      reasons.push('dense_recent_speech');
    }

    if (
      recentStats.wordCount >= 10 &&
      recentStats.longestGap <= 6 &&
      recentStats.speechDensity >= 0.3
    ) {
      reasons.push('steady_recent_speech');
    }

    return {
      shouldAskAi: reasons.length > 0,
      reasons,
      triggerPhrases,
      audioPeakCount: absolutePeakTimes.length,
      recentWordCount: recentStats.wordCount,
      recentSpeechDensity: recentStats.speechDensity,
      recentLongestGap: recentStats.longestGap,
    };
  }

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
    const projectName = `Auto Clip - ${options.streamerName} Live ${new Date().toLocaleString(
      'en-US',
      {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true,
      }
    )}`;
    const projectDescription = `Auto-detected clips from ${options.platform} livestream ${options.streamerName}`;
    const projectId = await createProject(
      projectName,
      projectDescription,
      undefined,
      options.platform
    );

    state.value.isActive = true;
    state.value.sessionId = options.sessionId;
    state.value.projectId = projectId;
    state.value.prompt = options.prompt;
    state.value.pendingClip = null;
    state.value.pendingClipEpochStart = null;
    state.value.startTime = Date.now();
    state.value.creditsUsed = 0;
    state.value.segments = options.segments || [];
    state.value.consecutiveLowSignalDetections = 0;
    state.value.debugStats = createDebugStats();

    // Start transcription
    await transcription.startTranscription(options.sessionId);

    // Schedule detection runs every 30s, but never overlap: setInterval would queue
    // another run while await runDetection() is still in progress, which caused
    // duplicate saves of the same pending clip (same timestamps/title).
    const scheduleNextDetection = () => {
      if (!state.value.isActive) return;
      state.value.detectionInterval = window.setTimeout(async () => {
        if (!state.value.isActive) return;
        try {
          await runDetection();
        } finally {
          if (state.value.isActive) {
            scheduleNextDetection();
          } else {
            state.value.detectionInterval = null;
          }
        }
      }, DETECTION_INTERVAL_MS);
    };
    scheduleNextDetection();

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
          Authorization: `Bearer ${token}`,
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
          window.dispatchEvent(
            new CustomEvent('realtime-detection-stopped', {
              detail: { reason: 'out_of_credits' },
            })
          );
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

    if (state.value.detectionInterval !== null) {
      clearTimeout(state.value.detectionInterval);
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

    console.log('[RealtimeClipDetection] Session summary:', state.value.debugStats);
    recordDebugEvent('session_summary', {
      reason: 'stopped',
      durationMinutes: detectionDurationMinutes.value,
    });

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
    state.value.pendingClipEpochStart = null;
    state.value.startTime = 0;
    state.value.creditsUsed = 0;
    state.value.recentlySavedClips = [];
    state.value.consecutiveLowSignalDetections = 0;
    state.value.debugStats = createDebugStats();
  }

  /**
   * Run AI detection on current transcript buffer
   */
  async function runDetection() {
    if (!state.value.isActive || !state.value.projectId) {
      return;
    }

    state.value.debugStats.windowsScanned += 1;

    if (state.value.pendingClip && state.value.pendingClipEpochStart !== null) {
      const ageMs = Date.now() - state.value.pendingClipEpochStart;
      const spanSec =
        state.value.pendingClip.endTime - state.value.pendingClip.startTime;
      if (
        ageMs >= MAX_PENDING_WALL_CLOCK_MS ||
        spanSec >= MAX_PENDING_CLIP_SPAN_SECONDS
      ) {
        console.log('[RealtimeClipDetection] Finalizing pending clip (stale span or wall clock)', {
          ageMs,
          spanSec,
        });
        recordDebugEvent('finalize_stale_pending', {
          reason: 'max_pending_age_or_span',
          ageMs,
          spanSec,
        });
        await savePendingClip();
      }
    }

    const transcript = transcription.getFormattedTranscript();
    const recentSignalStart = Math.max(
      transcript.start,
      transcript.end - RECENT_SIGNAL_WINDOW_SECONDS
    );
    const transcriptStats = transcription.getTranscriptStats(transcript.start, transcript.end);
    const recentStats = transcription.getTranscriptStats(recentSignalStart, transcript.end);
    const transcriptSegments = transcription.getAbsoluteTranscriptSegments();
    const recentTranscriptText = transcriptSegments
      .filter((segment) => segment.end >= recentSignalStart && segment.start <= transcript.end)
      .map((segment) => segment.text)
      .join(' ');

    if (!transcript.text || transcript.text.length < 50) {
      console.log('[RealtimeClipDetection] Transcript too short, skipping detection');
      state.value.debugStats.lowSignalSkips += 1;
      recordDebugEvent('skip_short_transcript', {
        reason: 'short_transcript',
        transcriptLength: transcript.text.length,
      });
      return;
    }

    console.log('[RealtimeClipDetection] Running detection on transcript:', {
      length: transcript.text.length,
      timeRange: `${transcript.start}s - ${transcript.end}s`,
    });

    // Analyze audio peaks from segments to detect loud/exciting moments
    let audioContext = '';
    let absolutePeakTimes: number[] = []; // Peak times in absolute stream time for dead zone detection
    try {
      if (state.value.segments.length > 0) {
        console.log('[RealtimeClipDetection] Analyzing audio peaks from segments...');

        // Find segments that overlap with the transcript time range
        const relevantSegments = state.value.segments.filter(
          (seg) => seg.endTime > transcript.start && seg.startTime < transcript.end
        );

        if (relevantSegments.length > 0) {
          // Analyze the most recent segment for audio peaks
          const latestSegment = relevantSegments[relevantSegments.length - 1];

          const peaks = await invoke<Array<{ time: number; amplitude: number }>>(
            'detect_audio_peaks',
            {
              videoPath: latestSegment.filePath,
              threshold: 0.3, // 30% above mean volume
              minInterval: 2.0, // At least 2 seconds between peaks
            }
          );

          if (peaks.length > 0) {
            // Map peaks to absolute stream time
            absolutePeakTimes = peaks
              .map((p) => latestSegment.startTime + p.time)
              .filter((t) => t >= transcript.start && t <= transcript.end);

            if (absolutePeakTimes.length > 0) {
              const peakTimesRounded = absolutePeakTimes.map((t) => Math.round(t));
              audioContext = `AUDIO ANALYSIS: Detected ${peakTimesRounded.length} volume spike(s) at ${peakTimesRounded.join('s, ')}s (loud moments/screaming/excitement)`;
              console.log('[RealtimeClipDetection]', audioContext);
            }
          }
        }
      }
    } catch (error) {
      console.warn('[RealtimeClipDetection] Audio peak analysis failed:', error);
      // Continue without audio context
    }

    const signalSummary = buildRealtimeSignalSummary(
      recentTranscriptText,
      recentStats,
      absolutePeakTimes
    );

    if (!signalSummary.shouldAskAi) {
      state.value.consecutiveLowSignalDetections += 1;
      state.value.debugStats.lowSignalSkips += 1;
      console.log('[RealtimeClipDetection] Low-signal window, skipping AI:', signalSummary);
      recordDebugEvent('skip_low_signal', {
        reason: 'low_signal',
        signalSummary,
        consecutiveLowSignalDetections: state.value.consecutiveLowSignalDetections,
      });

      if (
        state.value.pendingClip &&
        state.value.consecutiveLowSignalDetections >= LOW_SIGNAL_DETECTIONS_TO_CLOSE_PENDING
      ) {
        console.log('[RealtimeClipDetection] Repeated low-signal windows, closing pending clip');
        recordDebugEvent('close_pending_low_signal', {
          reason: 'repeated_low_signal',
          pendingTitle: state.value.pendingClip.title,
        });
        await savePendingClip();
      }

      return;
    }

    state.value.consecutiveLowSignalDetections = 0;
    state.value.debugStats.aiCalls += 1;

    try {
      const token = localStorage.getItem('auth_token') || '';

      const response = await fetch(`${API_BASE}/clips/detect-realtime`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          transcript: transcript.text,
          transcript_start: transcript.start,
          transcript_end: transcript.end,
          prompt: state.value.prompt,
          virality_threshold: VIRALITY_THRESHOLD,
          audio_context: audioContext,
          transcript_stats: transcriptStats,
          recent_transcript_stats: recentStats,
          signal_context: signalSummary,
          transcript_segments: transcriptSegments,
          pending_clip: state.value.pendingClip
            ? {
                title: state.value.pendingClip.title,
                description: state.value.pendingClip.description,
                start_time: state.value.pendingClip.startTime,
                end_time: state.value.pendingClip.endTime,
                context_summary: state.value.pendingClip.contextSummary,
                hook_score: state.value.pendingClip.hookScore,
                payoff_score: state.value.pendingClip.payoffScore,
                emotion_score: state.value.pendingClip.emotionScore,
                shareability_score: state.value.pendingClip.shareabilityScore,
                density_score: state.value.pendingClip.densityScore,
                signal_score: state.value.pendingClip.signalScore,
                boundary_score: state.value.pendingClip.boundaryScore,
              }
            : null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Detection failed: ${response.statusText}`);
      }

      const result = await response.json();
      const contextChange = result.context_change || false;
      const pendingClipData = result.pending_clip;
      const pendingClipRejected = result.pending_clip_rejected || false;
      const candidateRejected = result.candidate_rejected || false;
      const pendingClipRejectionReason = result.pending_clip_rejection_reason || 'server_rejected';

      console.log('[RealtimeClipDetection] Context change:', contextChange);

      if (pendingClipRejected && state.value.pendingClip) {
        state.value.debugStats.serverRejections += 1;
        console.log(
          '[RealtimeClipDetection] Server rejected pending clip quality:',
          state.value.pendingClip.title,
          pendingClipRejectionReason
        );
        recordDebugEvent('server_rejected_pending_clip', {
          reason: pendingClipRejectionReason,
          pendingTitle: state.value.pendingClip.title,
        });
        state.value.pendingClip = null;
        state.value.pendingClipEpochStart = null;
      }

      if (candidateRejected && !pendingClipRejected) {
        state.value.debugStats.serverRejections += 1;
        console.log(
          '[RealtimeClipDetection] Server rejected realtime candidate:',
          pendingClipRejectionReason
        );
        recordDebugEvent('server_rejected_candidate', {
          reason: pendingClipRejectionReason,
        });
      }

      // Dead zone detection - truncate clips when audio energy drops for extended period
      if (pendingClipData && state.value.pendingClip && absolutePeakTimes.length > 0) {
        const currentDuration = pendingClipData.end_time - state.value.pendingClip.startTime;

        // For clips > 60s, check for dead zones in audio
        if (currentDuration > 60) {
          const clipPeaks = absolutePeakTimes.filter(
            (t) => t >= state.value.pendingClip!.startTime && t <= pendingClipData.end_time
          );

          if (clipPeaks.length > 0) {
            const lastPeakTime = Math.max(...clipPeaks);
            const silenceDuration = pendingClipData.end_time - lastPeakTime;

            // If 20+ seconds of no energy at end, truncate and force save
            if (silenceDuration > 20) {
              console.log(
                `[RealtimeClipDetection] Dead zone detected: ${Math.round(silenceDuration)}s silence after last peak, truncating clip`
              );
              state.value.pendingClip.endTime = lastPeakTime + 3; // +3s buffer
              await savePendingClip();
              // pendingClip is now null, let the new detection become fresh pending clip
            }
          }
        }
      }

      // If context changed, save the current pending clip
      if (contextChange && state.value.pendingClip) {
        await savePendingClip();
      }

      // Update or create pending clip with new data
      if (pendingClipData) {
        const prev = state.value.pendingClip;
        const newStart = Number(pendingClipData.start_time);
        if (
          !prev ||
          Math.abs(newStart - prev.startTime) > PENDING_NEW_MOMENT_START_DELTA_SECONDS
        ) {
          state.value.pendingClipEpochStart = Date.now();
        }
        state.value.pendingClip = {
          title: pendingClipData.title,
          description: pendingClipData.description,
          startTime: pendingClipData.start_time,
          endTime: pendingClipData.end_time || transcript.end,
          viralityScore: pendingClipData.virality_score,
          detectionReason: pendingClipData.detection_reason,
          contextSummary: pendingClipData.context_summary || '',
          hookScore: pendingClipData.hook_score ?? pendingClipData.hookScore,
          payoffScore: pendingClipData.payoff_score ?? pendingClipData.payoffScore,
          emotionScore: pendingClipData.emotion_score ?? pendingClipData.emotionScore,
          shareabilityScore:
            pendingClipData.shareability_score ?? pendingClipData.shareabilityScore,
          densityScore: pendingClipData.density_score ?? pendingClipData.densityScore,
          signalScore: pendingClipData.signal_score ?? pendingClipData.signalScore,
          boundaryScore: pendingClipData.boundary_score ?? pendingClipData.boundaryScore,
        };
        console.log('[RealtimeClipDetection] Pending clip updated:', state.value.pendingClip.title);
      }
    } catch (error) {
      state.value.debugStats.errors += 1;
      console.error('[RealtimeClipDetection] Detection error:', error);
      recordDebugEvent('ai_detection_error', {
        reason: 'ai_detection_error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save the pending clip to database and extract video file
   */
  async function savePendingClip() {
    if (!state.value.pendingClip || !state.value.projectId || !state.value.sessionId) {
      return;
    }

    // Claim immediately (sync). Overlapping runDetection ticks used to await here while
    // still holding pendingClip, so two saves passed dedup and extracted the same clip.
    const pending = state.value.pendingClip;
    const pendingEpochStart = state.value.pendingClipEpochStart;
    state.value.pendingClip = null;
    state.value.pendingClipEpochStart = null;

    const quality = evaluatePendingClipQuality(pending);
    if (!quality.shouldSave) {
      state.value.debugStats.qualityRejections += 1;
      console.log(
        '[RealtimeClipDetection] Pending clip failed quality gates:',
        pending.title,
        quality.reasons
      );
      recordDebugEvent('client_quality_rejected_clip', {
        reason: quality.reasons.join(','),
        pendingTitle: pending.title,
        qualityReasons: quality.reasons,
      });
      return;
    }

    const qualityPending = {
      ...quality.pending,
      detectionReason:
        quality.reasons.length > 0
          ? `${quality.pending.detectionReason} | Quality gates: ${quality.reasons.join(', ')}`
          : quality.pending.detectionReason,
    };

    // Check virality threshold before saving
    if (qualityPending.viralityScore < VIRALITY_THRESHOLD) {
      state.value.debugStats.thresholdRejections += 1;
      console.log(
        '[RealtimeClipDetection] Pending clip below threshold:',
        qualityPending.viralityScore,
        '- discarding'
      );
      recordDebugEvent('client_threshold_rejected_clip', {
        reason: 'below_virality_threshold',
        pendingTitle: qualityPending.title,
        viralityScore: qualityPending.viralityScore,
      });
      return;
    }

    // Check for duplicates with recently saved clips (client-side safeguard)
    if (isDuplicateOfRecentClip(qualityPending)) {
      state.value.debugStats.duplicateSkips += 1;
      console.log('[RealtimeClipDetection] Skipping duplicate clip:', qualityPending.title);
      recordDebugEvent('client_duplicate_skipped_clip', {
        reason: 'duplicate_clip',
        pendingTitle: qualityPending.title,
      });
      return;
    }

    console.log(
      '[RealtimeClipDetection] Saving pending clip:',
      qualityPending.title,
      `(${qualityPending.startTime}s - ${qualityPending.endTime}s)`
    );

    try {
      // Extract the video clip
      const clipDuration = qualityPending.endTime - qualityPending.startTime;
      const resultJson = await invoke<string>('extract_livestream_clip', {
        sessionId: state.value.sessionId,
        clipEndTime: qualityPending.endTime,
        clipDuration: clipDuration,
        clipName: qualityPending.title,
        segments: state.value.segments,
        projectId: state.value.projectId,
        watermarkId: null,
        watermarkSettings: null,
      });

      const extractionResult = JSON.parse(resultJson) as {
        clipPath: string;
        thumbnailPath: string | null;
      };
      const clipFilePath = extractionResult.clipPath;
      const thumbnailFilePath = extractionResult.thumbnailPath;

      // Save clip to database
      const clipId = await createClipRecord(state.value.projectId, clipFilePath, {
        name: qualityPending.title,
        duration: clipDuration,
        startTime: qualityPending.startTime,
        endTime: qualityPending.endTime,
        thumbnailPath: thumbnailFilePath || undefined,
      });

      // Create clip version
      const manualSessionId = await getOrCreateManualSession(state.value.projectId);
      const versionId = await createClipVersion(
        clipId,
        manualSessionId,
        1,
        {
          name: qualityPending.title,
          startTime: qualityPending.startTime,
          endTime: qualityPending.endTime,
          description: qualityPending.description,
          viralityScore: qualityPending.viralityScore,
          detectionReason: qualityPending.detectionReason,
        },
        'detected'
      );
      await updateClip(clipId, {
        current_version_id: versionId,
        detection_session_id: manualSessionId,
      });

      state.value.debugStats.clipsSaved += 1;
      console.log('[RealtimeClipDetection] Pending clip saved:', clipId);
      recordDebugEvent('clip_saved', {
        reason: 'clip_saved',
        clipId,
        title: qualityPending.title,
        viralityScore: qualityPending.viralityScore,
      });

      // Track this clip to prevent duplicates
      state.value.recentlySavedClips.push({
        startTime: qualityPending.startTime,
        endTime: qualityPending.endTime,
        title: qualityPending.title,
        savedAt: Date.now(),
      });

      // Clean up old entries (older than dedup window)
      const now = Date.now();
      state.value.recentlySavedClips = state.value.recentlySavedClips.filter(
        (clip) => now - clip.savedAt < DEDUP_WINDOW_MS
      );

      // Emit event for UI updates
      window.dispatchEvent(
        new CustomEvent('realtime-clip-detected', {
          detail: {
            clipId,
            projectId: state.value.projectId,
            title: qualityPending.title,
            startTime: qualityPending.startTime,
            duration: clipDuration,
            viralityScore: qualityPending.viralityScore,
            detectionReason: qualityPending.detectionReason,
            clipPath: clipFilePath,
          },
        })
      );
    } catch (error) {
      state.value.debugStats.errors += 1;
      console.error('[RealtimeClipDetection] Failed to save pending clip:', error);
      recordDebugEvent('clip_save_error', {
        reason: 'clip_save_error',
        pendingTitle: pending.title,
        message: error instanceof Error ? error.message : String(error),
      });
      // Restore pending only if nothing newer replaced it (retry extraction later)
      if (!state.value.pendingClip) {
        state.value.pendingClip = pending;
        state.value.pendingClipEpochStart = pendingEpochStart;
      }
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
