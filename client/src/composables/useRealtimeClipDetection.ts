import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
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

interface DetectionDebugStats {
  windowsScanned: number;
  emptyWindowSkips: number;
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

/** Server-resolved streamer reach tier and the corresponding softened quality
 *  thresholds. Echoed back from the realtime detection endpoint so the client
 *  can apply the SAME relaxed gates the server applied — keeping the two
 *  layers in sync, otherwise the client gate would re-reject clips the server
 *  already approved.
 *
 *  When this is null (no response yet, or non-list streamer), the client
 *  falls back to the default constants (MIN_CLIP_DURATION_SECONDS, etc.). */
interface ReachSettings {
  tier: 'top_tier' | 'famous' | 'established' | 'niche' | 'unknown';
  tier_label: string;
  matched_name: string | null;
  virality_threshold: number;
  min_duration: number;
  min_words_short: number;
  min_words_medium: number;
  min_words_long: number;
  min_density_short: number;
  min_density_long: number;
}

interface StreamerMetadata {
  display_name: string;
  channel_slug: string;
  platform: string;
}

interface RealtimeDetectionState {
  isActive: boolean;
  sessionId: string | null;
  projectId: string | null;
  detectionInterval: number | null;
  pendingClip: PendingClip | null;
  /** Wall-clock time when the current pending clip "moment" started (new topic / new start time). */
  pendingClipEpochStart: number | null;
  prompt: string;
  startTime: number;
  /** Running total of credits charged for audio actually sent to Whisper.
   *  Updated via the `realtime-credits-charged` window event dispatched by
   *  `useRealtimeTranscription.chargeForAudioSent`. Purely informational —
   *  the server is the source of truth for the user's balance. */
  creditsUsed: number;
  segments: SegmentInfo[];
  recentlySavedClips: SavedClipInfo[];
  /** Streamer identity sent with every detect-realtime POST. Used server-side
   *  to look up the curated reach tier (StreamerReach) and lower the quality
   *  bar for famous/top-tier creators. */
  streamerMetadata: StreamerMetadata | null;
  /** Latest reach settings echoed back from the server. The client-side
   *  quality gate uses these (or defaults when null) so it never rejects a
   *  clip the server already approved. */
  reachSettings: ReachSettings | null;
  /** Number of consecutive AI ticks that returned pending_clip: null while we have a pending clip. */
  consecutiveNullPendingDetections: number;
  /** End-of-buffer timestamp from the most recent runDetection tick, used by
   *  the stale-buffer auto-stop guard. When the recorder dies but recorder-exit
   *  / stream-ended never fire, the window stops advancing — that's our cue. */
  lastWindowEnd: number | null;
  /** Wall-clock ms when `lastWindowEnd` last advanced. */
  lastWindowAdvanceAt: number | null;
  debugStats: DetectionDebugStats;
}

interface SavedClipInfo {
  startTime: number;
  endTime: number;
  title: string;
  savedAt: number;
}

const DETECTION_INTERVAL_MS = 30_000; // 30 seconds
const DETECTION_WINDOW_SECONDS = 30; // last 30s of transcript sent to AI each tick
const VIRALITY_THRESHOLD = 85;
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const OVERLAP_THRESHOLD = 0.3; // 30% time overlap = potential duplicate
const TITLE_SIMILARITY_THRESHOLD = 0.25; // 25% word similarity = potential duplicate (lowered to catch "Savage Brother Roast" variants)
const MIN_CLIP_DURATION_SECONDS = 4;
const MAX_LEADING_SILENCE_SECONDS = 1;
const MAX_TRAILING_SILENCE_SECONDS = 2;
const MAX_INTERNAL_SILENCE_SECONDS = 14;
/** Lead-in to keep before the first spoken word so the clip doesn't start mid-syllable. */
const TRIM_BEFORE_FIRST_WORD_SECONDS = 0.6;
/** Tail to keep after the last spoken word so the clip doesn't get clipped mid-laugh/reaction. */
const TRIM_AFTER_LAST_WORD_SECONDS = 1.5;
/** If two consecutive AI ticks return pending_clip: null while we hold a pending clip,
 *  finalize: 60 seconds of "nothing new" implies the moment ended. */
const NULL_PENDING_DETECTIONS_TO_CLOSE = 2;
/** Even if AI keeps extending, force finalize so clips actually save while live.
 *  Set to 4 min (slightly past 3-min max span) so a real 3-min moment can wrap on context_change first. */
const MAX_PENDING_WALL_CLOCK_MS = 4 * 60 * 1000;
/** Hard cap on pending span — matches the manual-clip 3-minute buffer (BUFFER_DURATION_SECONDS in useRealtimeTranscription). */
const MAX_PENDING_CLIP_SPAN_SECONDS = 180;
/** New AI pending with start moved more than this (seconds) resets the stale-finalize timer. */
const PENDING_NEW_MOMENT_START_DELTA_SECONDS = 10;
/** Audio peak detection knobs reused for both gating-context and finalize boundary trim. */
const PEAK_THRESHOLD = 0.3;
const PEAK_MIN_INTERVAL = 2.0;
/** When refining clip start with audio peaks, look back this far before the AI start. */
const PEAK_LOOKBACK_SECONDS = 2;
/** Tail buffer after the last word/peak when refining clip end. */
const PEAK_TAIL_BUFFER_SECONDS = 2;
/** When the first audio peak lands more than this far AFTER the first transcribed
 *  word, the leading speech is filler/quiet — anchor the clip start on the peak
 *  (the actual energy of the moment) instead of the first word. */
const PEAK_OVERRIDE_FIRST_WORD_GAP_SECONDS = 5;
/** Lead-in to keep before an aggressive peak-anchored start (tighter than the
 *  per-word lead-in because the peak itself already represents the moment's energy). */
const PEAK_AGGRESSIVE_LOOKBACK_SECONDS = 1.5;
/** If `runDetection`'s window.end has not advanced for this many ms, the audio
 *  pipeline has clearly stalled (recorder died, stream offline, etc.) so we
 *  force-stop detection. Belt-and-suspenders backup for recorder-exit /
 *  stream-ended events that occasionally fail to fire. */
const STALE_WINDOW_AUTO_STOP_MS = 60_000;

function createDebugStats(): DetectionDebugStats {
  return {
    windowsScanned: 0,
    emptyWindowSkips: 0,
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
  pendingClip: null,
  pendingClipEpochStart: null,
  prompt: '',
  startTime: 0,
  creditsUsed: 0,
  segments: [],
  recentlySavedClips: [],
  streamerMetadata: null,
  reachSettings: null,
  consecutiveNullPendingDetections: 0,
  lastWindowEnd: null,
  lastWindowAdvanceAt: null,
  debugStats: createDebugStats(),
});

/** Tauri event unlisten handles for the active detection session, kept at module scope so
 *  startDetection registers them and stopDetection cleans them up. */
let recorderExitUnlisten: UnlistenFn | null = null;
let streamEndedUnlisten: UnlistenFn | null = null;

/** Window-event handlers registered by startDetection so they can be removed in stopDetection.
 *  These survive HMR reloads via the dispose hook at the bottom of this file. */
let outOfCreditsHandler: ((event: Event) => void) | null = null;
let creditsChargedHandler: ((event: Event) => void) | null = null;

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

    // UNCONDITIONAL boundary snap: if there's any speech inside the AI's bounds, the
    // saved clip starts at first_word - lead_in and ends at last_word + tail. The
    // AI's window-aligned bounds are NEVER allowed to leak through as silence on
    // either edge of the saved clip.
    const adjusted: PendingClip = { ...pending };
    const snappedStart = Math.max(
      pending.startTime,
      initialStats.firstSpeechTime - TRIM_BEFORE_FIRST_WORD_SECONDS
    );
    const snappedEnd = Math.min(
      pending.endTime,
      initialStats.lastSpeechTime + TRIM_AFTER_LAST_WORD_SECONDS
    );

    if (snappedStart > pending.startTime + 0.05) {
      adjusted.startTime = snappedStart;
      reasons.push(`trimmed_leading_silence_${initialStats.leadingSilence.toFixed(1)}s`);
    }
    if (snappedEnd < pending.endTime - 0.05 && snappedEnd > adjusted.startTime) {
      adjusted.endTime = snappedEnd;
      reasons.push(`trimmed_trailing_silence_${initialStats.trailingSilence.toFixed(1)}s`);
    }

    const stats = transcription.getTranscriptStats(adjusted.startTime, adjusted.endTime);
    const duration = Math.max(0, adjusted.endTime - adjusted.startTime);
    // Tier-aware floors. When the server has resolved this streamer to a
    // famous/top-tier creator, it returned softened thresholds and applied
    // them in its own quality gate. The client gate must use the SAME values
    // — otherwise it would re-reject clips the server already approved.
    const reach = state.value.reachSettings;
    const minDuration = reach?.min_duration ?? MIN_CLIP_DURATION_SECONDS;
    const minWords =
      duration <= 12
        ? (reach?.min_words_short ?? 4)
        : duration <= 20
          ? (reach?.min_words_medium ?? 8)
          : (reach?.min_words_long ?? 12);
    const minSpeechDensity =
      duration <= 12 ? (reach?.min_density_short ?? 0.35) : (reach?.min_density_long ?? 0.45);

    if (duration < minDuration) {
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

  /**
   * Find audio peaks (loud/exciting moments) across all segments overlapping
   * [startTime, endTime] in absolute stream time. Used both as AI context for
   * the current 30s window and to refine pending-clip boundaries at finalize.
   */
  async function detectPeaksInRange(
    startTime: number,
    endTime: number
  ): Promise<number[]> {
    if (endTime <= startTime || state.value.segments.length === 0) {
      return [];
    }

    const relevantSegments = state.value.segments.filter(
      (seg) => seg.endTime > startTime && seg.startTime < endTime
    );

    const peakTimes: number[] = [];
    for (const seg of relevantSegments) {
      try {
        const peaks = await invoke<Array<{ time: number; amplitude: number }>>(
          'detect_audio_peaks',
          {
            videoPath: seg.filePath,
            threshold: PEAK_THRESHOLD,
            minInterval: PEAK_MIN_INTERVAL,
          }
        );
        for (const peak of peaks) {
          const absoluteTime = seg.startTime + peak.time;
          if (absoluteTime >= startTime && absoluteTime <= endTime) {
            peakTimes.push(absoluteTime);
          }
        }
      } catch (error) {
        console.warn(
          '[RealtimeClipDetection] Peak detection failed for segment',
          seg.filePath,
          error
        );
      }
    }

    peakTimes.sort((a, b) => a - b);
    return peakTimes;
  }

  /**
   * Refine pending-clip boundaries using audio peaks plus the existing word
   * timestamps. Tightens the clip onto the actual energetic span: shifts start
   * back to the earliest peak/word (with a small lead-in) and end forward to
   * the latest peak/word (with a small tail). Never widens past the AI's bounds.
   */
  async function refineBoundariesWithPeaks(p: PendingClip): Promise<PendingClip> {
    const peaks = await detectPeaksInRange(p.startTime, p.endTime);
    const stats = transcription.getTranscriptStats(p.startTime, p.endTime);

    const firstPeak = peaks.length > 0 ? peaks[0] : null;
    const lastPeak = peaks.length > 0 ? peaks[peaks.length - 1] : null;
    const firstWord = stats.firstSpeechTime;
    const lastWord = stats.lastSpeechTime;

    const candidatesStart: number[] = [];
    if (firstWord !== null) candidatesStart.push(firstWord);
    if (firstPeak !== null) candidatesStart.push(firstPeak);

    const candidatesEnd: number[] = [];
    if (lastWord !== null) candidatesEnd.push(lastWord);
    if (lastPeak !== null) candidatesEnd.push(lastPeak);

    if (candidatesStart.length === 0 && candidatesEnd.length === 0) {
      return p;
    }

    const refined: PendingClip = { ...p };

    if (candidatesStart.length > 0) {
      // Default: anchor on whichever comes first (word or peak), with a small lookback.
      let anchorStart = Math.min(...candidatesStart);
      let lookback = PEAK_LOOKBACK_SECONDS;

      // Aggressive override: when the first audio peak lands more than ~5s
      // AFTER the first transcribed word, the leading speech is filler/quiet
      // (chatter, intro, ad-read) and the peak is where the real moment
      // begins. Anchor on the peak instead of the (early) word.
      if (
        firstPeak !== null &&
        firstWord !== null &&
        firstPeak - firstWord > PEAK_OVERRIDE_FIRST_WORD_GAP_SECONDS
      ) {
        anchorStart = firstPeak;
        lookback = PEAK_AGGRESSIVE_LOOKBACK_SECONDS;
        console.log(
          `[RealtimeClipDetection] Aggressive peak-anchor: firstPeak ${firstPeak.toFixed(1)}s is ${(firstPeak - firstWord).toFixed(1)}s after firstWord ${firstWord.toFixed(1)}s — using peak as start anchor.`
        );
      }

      const tightenedStart = Math.max(p.startTime, anchorStart - lookback);
      if (tightenedStart > p.startTime) {
        refined.startTime = tightenedStart;
      }
    }

    if (candidatesEnd.length > 0) {
      const latest = Math.max(...candidatesEnd);
      const tightenedEnd = Math.min(p.endTime, latest + PEAK_TAIL_BUFFER_SECONDS);
      if (tightenedEnd < p.endTime && tightenedEnd > refined.startTime) {
        refined.endTime = tightenedEnd;
      }
    }

    if (refined.endTime - refined.startTime < MIN_CLIP_DURATION_SECONDS) {
      return p;
    }

    if (
      refined.startTime !== p.startTime ||
      refined.endTime !== p.endTime
    ) {
      console.log(
        '[RealtimeClipDetection] Peak-aware boundary refine:',
        `${p.startTime}s -> ${refined.startTime}s, ${p.endTime}s -> ${refined.endTime}s`,
        `(peaks=${peaks.length}, firstWord=${firstWord}, lastWord=${lastWord})`
      );
    }

    return refined;
  }

  /**
   * Anchor AI-returned start/end bounds onto actual transcribed speech.
   *
   * The model is instructed (server prompt Phase 1) to emit timestamps from the
   * per-segment timeline, NOT the window edges. This is the safety net: regardless
   * of what the AI returns, snap start_time forward to the first transcribed word
   * minus a small lead-in, and snap end_time back to the last transcribed word
   * plus a small tail. The clip can never ship with leading/trailing silence
   * unless the AI's bounds are tighter than the speech itself (in which case we
   * trust the AI).
   *
   * `windowStart` / `windowEnd` are the buffer edges we asked the AI about; they
   * are used to compute the clamp range when the AI's bounds extend past them.
   */
  function snapBoundsToSpeech(
    aiStart: number,
    aiEnd: number,
    windowStart: number,
    windowEnd: number
  ): { start: number; end: number; reason: string } {
    const safeAiStart = Number.isFinite(aiStart) ? aiStart : windowStart;
    const safeAiEnd = Number.isFinite(aiEnd) && aiEnd > safeAiStart ? aiEnd : windowEnd;

    // Compute speech stats over the AI's claimed range. We REQUIRE real
    // word-level timestamps to trust the snap — without them, `firstSpeechTime`
    // is just `Math.max(rangeStart, segmentStart)` (a synthetic event clamped
    // to the AI range edge), which makes a 21-second silent intro look like
    // there's no leading silence to trim. So we fall back to the wider window
    // when the AI range has no real word data, and finally bail out as
    // `no_speech_to_anchor` if even the wider window lacks word-level data.
    let stats = transcription.getTranscriptStats(safeAiStart, safeAiEnd);
    let usedFallback = false;
    const aiRangeHasNoSpeech =
      stats.firstSpeechTime === null || stats.lastSpeechTime === null;
    const aiRangeOnlySynthetic = !aiRangeHasNoSpeech && !stats.hasWordTimestamps;

    if (aiRangeHasNoSpeech || aiRangeOnlySynthetic) {
      stats = transcription.getTranscriptStats(windowStart, windowEnd);
      usedFallback = true;
    }

    if (
      stats.firstSpeechTime === null ||
      stats.lastSpeechTime === null ||
      !stats.hasWordTimestamps
    ) {
      // Either no speech anywhere in the window, or only segment-level fallback
      // events exist. Either way, we have no precise boundary to snap to — let
      // the AI's bounds pass through. The save-time quality-trim layer (which
      // re-runs after more Whisper batches have populated word-level data)
      // will tighten or reject the clip downstream.
      return {
        start: safeAiStart,
        end: safeAiEnd,
        reason: aiRangeOnlySynthetic ? 'no_word_timestamps_yet' : 'no_speech_to_anchor',
      };
    }

    // Floor: never start before the AI's claim, but always at most lead_in seconds before first speech.
    const snappedStart = Math.max(
      safeAiStart,
      stats.firstSpeechTime - TRIM_BEFORE_FIRST_WORD_SECONDS
    );
    // Ceiling: never end after the AI's claim, but always at most tail seconds after last speech.
    const snappedEnd = Math.min(
      safeAiEnd,
      stats.lastSpeechTime + TRIM_AFTER_LAST_WORD_SECONDS
    );

    if (snappedEnd <= snappedStart + 0.5) {
      // Snap collapsed — fall back to AI bounds, the quality gate will catch this.
      return { start: safeAiStart, end: safeAiEnd, reason: 'snap_collapsed' };
    }

    const movedStart = Math.abs(snappedStart - safeAiStart) > 0.05;
    const movedEnd = Math.abs(snappedEnd - safeAiEnd) > 0.05;
    let reason = 'no_change';
    if (movedStart && movedEnd) reason = usedFallback ? 'snap_both_fallback' : 'snap_both';
    else if (movedStart) reason = 'snap_start';
    else if (movedEnd) reason = 'snap_end';

    return { start: snappedStart, end: snappedEnd, reason };
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
      // Don't silently no-op: the caller almost always thinks they just kicked off
      // a fresh session. Surfacing this as an error forces the UI (and devs) to
      // notice that a previous session is still alive — which in turn helps catch
      // bugs where stopDetection() never ran (e.g. leaked intervals burning credits).
      const msg = `[RealtimeClipDetection] startDetection called while already active (sessionId=${state.value.sessionId}). Stop the existing session first.`;
      console.error(msg);
      throw new Error('Realtime detection is already active. Stop the current session before starting a new one.');
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
    state.value.streamerMetadata = {
      display_name: options.streamerName,
      channel_slug: options.mintId || options.streamerName,
      platform: options.platform,
    };
    state.value.reachSettings = null;
    state.value.consecutiveNullPendingDetections = 0;
    state.value.lastWindowEnd = null;
    state.value.lastWindowAdvanceAt = null;
    state.value.debugStats = createDebugStats();

    // Start transcription
    await transcription.startTranscription(options.sessionId);

    // Defensive HMR cleanup: if a previous module instance left listeners
    // attached (e.g. the dispose hook didn't run cleanly during a Vite reload),
    // unregister them before re-listening so we don't end up with two handlers
    // racing to call stopDetection().
    if (recorderExitUnlisten) {
      try { recorderExitUnlisten(); } catch { /* ignore */ }
      recorderExitUnlisten = null;
    }
    if (streamEndedUnlisten) {
      try { streamEndedUnlisten(); } catch { /* ignore */ }
      streamEndedUnlisten = null;
    }
    if (outOfCreditsHandler) {
      window.removeEventListener('realtime-out-of-credits', outOfCreditsHandler);
      outOfCreditsHandler = null;
    }
    if (creditsChargedHandler) {
      window.removeEventListener('realtime-credits-charged', creditsChargedHandler);
      creditsChargedHandler = null;
    }

    // Self-terminate when the recorder for this session exits or the backend
    // signals the stream has ended. Without these, detection keeps ticking on
    // an empty buffer (and the stale-window guard would eventually catch it,
    // but these events are the fast path).
    const handleSessionEnd = async (
      payload: { sessionId?: string; streamerId?: string } | undefined,
      reason: 'recorder_exit' | 'stream_ended'
    ) => {
      if (!state.value.isActive) return;
      if (!payload || payload.sessionId !== state.value.sessionId) return;

      console.log(
        `[RealtimeClipDetection] ${reason} for session ${payload.sessionId}, stopping detection`
      );

      window.dispatchEvent(
        new CustomEvent('realtime-detection-stopped', {
          detail: {
            reason,
            sessionId: payload.sessionId,
            streamerId: payload.streamerId,
          },
        })
      );

      try {
        await stopDetection();
      } catch (error) {
        console.error('[RealtimeClipDetection] Error during auto-stop:', error);
      }
    };

    recorderExitUnlisten = await listen<{
      sessionId?: string;
      streamerId?: string;
      code?: number | null;
    }>('recorder-exit', (event) => handleSessionEnd(event.payload, 'recorder_exit'));

    streamEndedUnlisten = await listen<{
      sessionId?: string;
      streamerId?: string;
    }>('stream-ended', (event) => handleSessionEnd(event.payload, 'stream_ended'));

    // Halt detection when transcription's per-batch credit charge returns 402
    // (insufficient credits). The transcription composable dispatches this
    // event from chargeForAudioSent — see useRealtimeTranscription.ts.
    outOfCreditsHandler = async () => {
      if (!state.value.isActive) return;
      console.warn('[RealtimeClipDetection] Received out-of-credits, stopping detection');
      window.dispatchEvent(
        new CustomEvent('realtime-detection-stopped', {
          detail: { reason: 'out_of_credits' },
        })
      );
      try {
        await stopDetection();
      } catch (error) {
        console.error('[RealtimeClipDetection] Error during out-of-credits stop:', error);
      }
    };
    window.addEventListener('realtime-out-of-credits', outOfCreditsHandler);

    // Mirror per-batch credit charges into the local creditsUsed counter so
    // the UI keeps showing a running total. Source of truth for the user's
    // balance is the server, not this counter.
    creditsChargedHandler = (event: Event) => {
      const ce = event as CustomEvent<{ amount?: number }>;
      const amount = Number(ce.detail?.amount);
      if (!Number.isFinite(amount) || amount <= 0) return;
      state.value.creditsUsed += amount;
    };
    window.addEventListener('realtime-credits-charged', creditsChargedHandler);

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

    console.log('[RealtimeClipDetection] Detection started, project:', projectId);
  }

  /**
   * Update segments array (called by livestream monitoring as new segments arrive)
   */
  function updateSegments(segments: SegmentInfo[]) {
    state.value.segments = segments;
  }

  /**
   * Stop real-time clip detection.
   *
   * Idempotent: concurrent triggers (recorder-exit + stream-ended + user click +
   * out-of-credits + stale-buffer) all funnel here without double-saving the
   * pending clip or leaking listeners. Credit deduction happens per-Whisper-batch
   * in useRealtimeTranscription.chargeForAudioSent — when stopTranscription
   * halts the segment-ready listener below, no further batches flush, so no
   * further credits are charged. There is intentionally NO partial-minute
   * reconciliation here: billing is now exactly proportional to audio sent.
   */
  async function stopDetection() {
    if (!state.value.isActive) {
      return;
    }

    console.log('[RealtimeClipDetection] Stopping detection');

    // Detach session-end listeners first so a late event from the recorder
    // tearing down doesn't re-enter stopDetection while we're cleaning up.
    if (recorderExitUnlisten) {
      recorderExitUnlisten();
      recorderExitUnlisten = null;
    }
    if (streamEndedUnlisten) {
      streamEndedUnlisten();
      streamEndedUnlisten = null;
    }
    if (outOfCreditsHandler) {
      window.removeEventListener('realtime-out-of-credits', outOfCreditsHandler);
      outOfCreditsHandler = null;
    }
    if (creditsChargedHandler) {
      window.removeEventListener('realtime-credits-charged', creditsChargedHandler);
      creditsChargedHandler = null;
    }

    if (state.value.detectionInterval !== null) {
      clearTimeout(state.value.detectionInterval);
      state.value.detectionInterval = null;
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

    // Stopping transcription cancels the segment-ready listener AND flushes any
    // partial pending Whisper batch. The flush still bills via
    // chargeForAudioSent so the user is charged proportionally for the tail
    // audio (e.g. 15s remaining → 0.25 credits). After this returns, no further
    // billing can occur.
    await transcription.stopTranscription();

    state.value.isActive = false;
    state.value.sessionId = null;
    state.value.projectId = null;
    state.value.prompt = '';
    state.value.pendingClip = null;
    state.value.pendingClipEpochStart = null;
    state.value.startTime = 0;
    state.value.creditsUsed = 0;
    state.value.recentlySavedClips = [];
    state.value.streamerMetadata = null;
    state.value.reachSettings = null;
    state.value.consecutiveNullPendingDetections = 0;
    state.value.lastWindowEnd = null;
    state.value.lastWindowAdvanceAt = null;
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

    // The AI sees only the latest 30s window plus, if present, the full
    // transcript of the pending clip so far. This matches the user's mental
    // model of "30s at a time, with the pending moment as continuation context"
    // and keeps the prompt focused instead of dumping the whole 180s buffer.
    const window = transcription.getRecentWindow(DETECTION_WINDOW_SECONDS);
    const windowStats = window.stats;
    const windowSegments = window.segments;

    // Stale-buffer guard: if window.end hasn't advanced for STALE_WINDOW_AUTO_STOP_MS,
    // the audio pipeline has stalled (recorder died, stream offline, etc.) and
    // we should stop instead of churning the AI on the same stale buffer
    // forever. This is a safety net for cases where recorder-exit / stream-ended
    // events failed to fire — without it, runDetection would keep running until
    // credits ran out (and with usage-based billing now in place, even that is
    // less of a concern, but we still don't want to spam the AI endpoint).
    const now = Date.now();
    if (state.value.lastWindowEnd !== null && window.end <= state.value.lastWindowEnd + 0.05) {
      const staleMs = state.value.lastWindowAdvanceAt
        ? now - state.value.lastWindowAdvanceAt
        : 0;
      if (staleMs >= STALE_WINDOW_AUTO_STOP_MS) {
        console.warn(
          `[RealtimeClipDetection] Stale buffer: window.end=${window.end.toFixed(1)}s has not advanced for ${(staleMs / 1000).toFixed(1)}s — stopping detection.`
        );
        recordDebugEvent('stale_buffer_auto_stop', {
          reason: 'stale_buffer',
          staleMs,
          lastWindowEnd: state.value.lastWindowEnd,
        });
        // The local `window` here shadows the global, so use globalThis to
        // reach the real window.dispatchEvent for the UI-level notification.
        globalThis.dispatchEvent(
          new CustomEvent('realtime-detection-stopped', {
            detail: { reason: 'stale_buffer' },
          })
        );
        await stopDetection();
        return;
      }
    } else {
      state.value.lastWindowEnd = window.end;
      state.value.lastWindowAdvanceAt = now;
    }

    if (!window.text || window.text.length < 20) {
      console.log('[RealtimeClipDetection] 30s window has no usable transcript, skipping');
      state.value.debugStats.emptyWindowSkips += 1;
      recordDebugEvent('skip_empty_window', {
        reason: 'empty_window',
        windowLength: window.text.length,
      });
      return;
    }

    console.log('[RealtimeClipDetection] Running detection on 30s window:', {
      length: window.text.length,
      timeRange: `${window.start}s - ${window.end}s`,
      pendingClipTitle: state.value.pendingClip?.title ?? null,
    });

    // Audio peaks across the 30s window provide context to the LLM (loud moments,
    // screaming, hype) but never gate whether we call it.
    let audioContext = '';
    let windowPeakTimes: number[] = [];
    try {
      windowPeakTimes = await detectPeaksInRange(window.start, window.end);
      if (windowPeakTimes.length > 0) {
        const peakTimesRounded = windowPeakTimes.map((t) => Math.round(t));
        audioContext = `AUDIO ANALYSIS: Detected ${peakTimesRounded.length} volume spike(s) at ${peakTimesRounded.join('s, ')}s (loud moments/screaming/excitement)`;
        console.log('[RealtimeClipDetection]', audioContext);
      }
    } catch (error) {
      console.warn('[RealtimeClipDetection] Audio peak analysis failed:', error);
    }

    // Pending-clip transcript so far, if any. This lets the AI judge continuation
    // against the actual words spoken, not just the saved title/description.
    const pendingTranscript = state.value.pendingClip
      ? transcription.getTranscriptForRange(
          state.value.pendingClip.startTime,
          state.value.pendingClip.endTime
        )
      : null;

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
          transcript: window.text,
          transcript_start: window.start,
          transcript_end: window.end,
          prompt: state.value.prompt,
          virality_threshold: VIRALITY_THRESHOLD,
          audio_context: audioContext,
          transcript_stats: windowStats,
          transcript_segments: windowSegments,
          pending_clip_transcript: pendingTranscript?.text ?? '',
          streamer_metadata: state.value.streamerMetadata,
          pending_clip: state.value.pendingClip
            ? {
                title: state.value.pendingClip.title,
                description: state.value.pendingClip.description,
                start_time: state.value.pendingClip.startTime,
                end_time: state.value.pendingClip.endTime,
                virality_score: state.value.pendingClip.viralityScore,
                detection_reason: state.value.pendingClip.detectionReason,
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

      if (result.reach_settings) {
        const incoming = result.reach_settings as ReachSettings;
        const prev = state.value.reachSettings;
        if (!prev || prev.tier !== incoming.tier) {
          console.log(
            `[RealtimeClipDetection] Streamer reach tier resolved: ${incoming.tier_label}` +
              `${incoming.matched_name ? ` (matched: ${incoming.matched_name})` : ''}` +
              `, virality_threshold=${incoming.virality_threshold}, min_duration=${incoming.min_duration}s`
          );
        }
        state.value.reachSettings = incoming;
      }

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
        state.value.consecutiveNullPendingDetections = 0;
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

      if (contextChange && state.value.pendingClip) {
        await savePendingClip();
      }

      if (pendingClipData) {
        state.value.consecutiveNullPendingDetections = 0;
        const prev = state.value.pendingClip;
        const aiStart = Number(pendingClipData.start_time);
        const aiEnd = Number(pendingClipData.end_time || window.end);

        // Snap-clamp every AI response onto actual transcribed speech. This is
        // the architectural guarantee that no clip ships with the rolling
        // window's leading/trailing silence baked in, regardless of whether
        // the model honored the prompt's per-segment-timeline rules.
        const snapped = snapBoundsToSpeech(aiStart, aiEnd, window.start, window.end);

        // Determine the FINAL start/end for the pending clip. The continuation
        // rule is: keep the existing pending start_time (it was already anchored
        // on the moment's first word in a prior tick), and only push end_time
        // forward — to the snapped end_time, NOT the AI's potentially window-aligned
        // value.
        const isContinuation =
          !contextChange &&
          prev !== null &&
          Math.abs(aiStart - prev.startTime) <= PENDING_NEW_MOMENT_START_DELTA_SECONDS;

        const finalStart = isContinuation ? prev!.startTime : snapped.start;
        const finalEnd = isContinuation
          ? Math.max(prev!.endTime, snapped.end)
          : snapped.end;

        if (
          !prev ||
          Math.abs(aiStart - prev.startTime) > PENDING_NEW_MOMENT_START_DELTA_SECONDS
        ) {
          state.value.pendingClipEpochStart = Date.now();
        }

        if (
          Math.abs(snapped.start - aiStart) > 0.5 ||
          Math.abs(snapped.end - aiEnd) > 0.5 ||
          (isContinuation && Math.abs(finalEnd - aiEnd) > 0.5)
        ) {
          console.log(
            `[RealtimeClipDetection] Snapped AI bounds: ai=[${aiStart.toFixed(2)}s, ${aiEnd.toFixed(2)}s] -> snap=[${snapped.start.toFixed(2)}s, ${snapped.end.toFixed(2)}s] -> final=[${finalStart.toFixed(2)}s, ${finalEnd.toFixed(2)}s] (${snapped.reason}${isContinuation ? ', continuation' : ''})`
          );
        }

        state.value.pendingClip = {
          title: pendingClipData.title,
          description: pendingClipData.description,
          startTime: finalStart,
          endTime: finalEnd,
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
        console.log(
          `[RealtimeClipDetection] Pending clip updated: "${state.value.pendingClip.title}" [${finalStart.toFixed(2)}s - ${finalEnd.toFixed(2)}s] (${(finalEnd - finalStart).toFixed(1)}s)`
        );
      } else if (state.value.pendingClip) {
        // AI saw nothing new and we already have a pending clip. Two consecutive
        // "nothing" ticks (~60s) means the moment is over: finalize and save.
        state.value.consecutiveNullPendingDetections += 1;
        console.log(
          '[RealtimeClipDetection] AI returned no clip; consecutiveNull =',
          state.value.consecutiveNullPendingDetections
        );
        if (
          state.value.consecutiveNullPendingDetections >= NULL_PENDING_DETECTIONS_TO_CLOSE
        ) {
          console.log(
            '[RealtimeClipDetection] Repeated null detections, finalizing pending clip'
          );
          recordDebugEvent('close_pending_null_ai', {
            reason: 'consecutive_null_pending',
            pendingTitle: state.value.pendingClip.title,
          });
          await savePendingClip();
          state.value.consecutiveNullPendingDetections = 0;
        }
      } else {
        state.value.consecutiveNullPendingDetections = 0;
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
    const claimed = state.value.pendingClip;
    const pendingEpochStart = state.value.pendingClipEpochStart;
    state.value.pendingClip = null;
    state.value.pendingClipEpochStart = null;
    state.value.consecutiveNullPendingDetections = 0;

    // Audio-peak-aware boundary refinement runs FIRST so the existing word-trim
    // quality gate can then strip residual silence around the energetic span.
    let pending = claimed;
    try {
      pending = await refineBoundariesWithPeaks(claimed);
    } catch (error) {
      console.warn(
        '[RealtimeClipDetection] Peak-aware boundary refine failed, using AI bounds:',
        error
      );
    }

    const quality = evaluatePendingClipQuality(pending);

    // Single diagnostic line covering every boundary stage. If a saved clip ever
    // ships with leading/trailing silence again, this log reveals which stage failed.
    const claimedStats = transcription.getTranscriptStats(claimed.startTime, claimed.endTime);
    console.log(
      `[RealtimeClipDetection] Save pipeline for "${claimed.title}":\n` +
        `  AI/snapped:    [${claimed.startTime.toFixed(2)}s - ${claimed.endTime.toFixed(2)}s] (${(claimed.endTime - claimed.startTime).toFixed(1)}s) firstWord=${claimedStats.firstSpeechTime?.toFixed(2) ?? 'n/a'} lastWord=${claimedStats.lastSpeechTime?.toFixed(2) ?? 'n/a'} leadSilence=${claimedStats.leadingSilence.toFixed(1)}s trailSilence=${claimedStats.trailingSilence.toFixed(1)}s\n` +
        `  Peak-refined:  [${pending.startTime.toFixed(2)}s - ${pending.endTime.toFixed(2)}s] (${(pending.endTime - pending.startTime).toFixed(1)}s)\n` +
        `  Quality-trim:  [${quality.pending.startTime.toFixed(2)}s - ${quality.pending.endTime.toFixed(2)}s] (${(quality.pending.endTime - quality.pending.startTime).toFixed(1)}s) shouldSave=${quality.shouldSave} reasons=[${quality.reasons.join(', ')}]`
    );

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

    // Check virality threshold before saving. Use the server-resolved per-tier
    // threshold when available (lower for famous/top-tier streamers).
    const effectiveViralityThreshold =
      state.value.reachSettings?.virality_threshold ?? VIRALITY_THRESHOLD;
    if (qualityPending.viralityScore < effectiveViralityThreshold) {
      state.value.debugStats.thresholdRejections += 1;
      console.log(
        `[RealtimeClipDetection] Pending clip below threshold: ${qualityPending.viralityScore} < ${effectiveViralityThreshold} - discarding`
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

// Vite HMR cleanup. Without this, every time this module hot-reloads in dev the
// previous module's setTimeout(detectionInterval) and Tauri listeners keep
// firing against an orphaned `state` ref. With the wall-clock credit interval
// removed (billing is now per-Whisper-batch in useRealtimeTranscription),
// there's no zombie `/credits/deduct` loop to worry about — but we still
// tear down detection timers and event listeners cleanly so the new module
// instance starts from a known state.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (state.value.detectionInterval !== null) {
      clearTimeout(state.value.detectionInterval);
      state.value.detectionInterval = null;
    }
    if (recorderExitUnlisten) {
      try {
        recorderExitUnlisten();
      } catch {
        /* ignore */
      }
      recorderExitUnlisten = null;
    }
    if (streamEndedUnlisten) {
      try {
        streamEndedUnlisten();
      } catch {
        /* ignore */
      }
      streamEndedUnlisten = null;
    }
    if (outOfCreditsHandler) {
      window.removeEventListener('realtime-out-of-credits', outOfCreditsHandler);
      outOfCreditsHandler = null;
    }
    if (creditsChargedHandler) {
      window.removeEventListener('realtime-credits-charged', creditsChargedHandler);
      creditsChargedHandler = null;
    }
    state.value.isActive = false;
    console.log('[RealtimeClipDetection] HMR dispose: cleared timers + listeners');
  });
}
