import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { API_BASE } from '@/lib/apiBase';

interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  words?: TranscriptWord[];
}

interface TranscriptChunk {
  segment: TranscriptSegment;
  wallClockTime: number; // Date.now() when chunk was added
  streamTime: number; // cumulative stream elapsed time in seconds
}

interface AbsoluteTranscriptWord {
  word: string;
  start: number;
  end: number;
}

interface AbsoluteTranscriptSegment {
  text: string;
  start: number;
  end: number;
  words: AbsoluteTranscriptWord[];
}

interface TranscriptStats {
  start: number;
  end: number;
  duration: number;
  wordCount: number;
  spokenDuration: number;
  speechDensity: number;
  firstSpeechTime: number | null;
  lastSpeechTime: number | null;
  leadingSilence: number;
  trailingSilence: number;
  longestGap: number;
  /** True iff at least one speech event in this range came from a real Whisper
   *  word-level timestamp (segment.words[]). False when only segment-level
   *  fallback events were available — in that case `firstSpeechTime` /
   *  `lastSpeechTime` are clamped to the range edges and CANNOT be trusted as
   *  precise speech boundaries. The snap-clamp checks this flag so it doesn't
   *  treat "rangeStart-clamped synthetic event" as evidence that there's no
   *  leading silence to trim. */
  hasWordTimestamps: boolean;
}

interface PendingSegment {
  path: string;
  segmentNumber: number;
  duration: number;
  /** Cumulative streamTime at the START of this segment. */
  streamTime: number;
}

interface RealtimeTranscriptionState {
  isActive: boolean;
  buffer: TranscriptChunk[];
  bufferDurationSeconds: number;
  lastProcessedTime: number;
  /** Segments accumulated for the next Whisper batch. */
  pendingBatch: PendingSegment[];
  /** Sum of `duration` across pendingBatch (seconds). */
  pendingBatchSeconds: number;
  /** Set while a batch flush is in flight so concurrent segment-ready events queue instead of racing. */
  flushInProgress: boolean;
  /** Cumulative stream seconds processed so far, used as a fallback when segment numbers are missing. */
  cumulativeStreamSeconds: number;
}

const BUFFER_DURATION_SECONDS = 180; // 3 minutes
/** Target audio length per Whisper request. Below this, segments are accumulated; at or above, the batch is flushed. */
const WHISPER_BATCH_SECONDS = 30;
/** Default duration assumed when a segment-ready payload omits `duration`. */
const DEFAULT_SEGMENT_DURATION = 4;

const state = ref<RealtimeTranscriptionState>({
  isActive: false,
  buffer: [],
  bufferDurationSeconds: BUFFER_DURATION_SECONDS,
  lastProcessedTime: 0,
  pendingBatch: [],
  pendingBatchSeconds: 0,
  flushInProgress: false,
  cumulativeStreamSeconds: 0,
});

let segmentReadyUnlisten: UnlistenFn | null = null;

/**
 * Charge the user's credits for audio actually sent to Whisper.
 *
 * Billing is `audioSeconds / 60` credits per batch — i.e. a 30s batch costs
 * 0.5 credits, two 30s batches cost 1.0 credits. This is the ONLY credit
 * deduction in the realtime detection pipeline. When this stops being called
 * (stream offline / user stops detection / recorder exit), credit consumption
 * stops automatically — there is no wall-clock interval that keeps charging
 * for "time elapsed" regardless of whether work was performed.
 *
 * On 402 (insufficient credits) we dispatch `realtime-out-of-credits`, which
 * `useRealtimeClipDetection` listens for and uses to halt the session.
 */
async function chargeForAudioSent(audioSeconds: number) {
  if (audioSeconds <= 0) return;
  const amount = audioSeconds / 60;

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
        amount,
        reason: `Real-time clip detection (${audioSeconds.toFixed(1)}s audio)`,
      }),
    });

    if (response.ok) {
      console.log(
        `[RealtimeTranscription] Deducted ${amount.toFixed(3)} credits for ${audioSeconds.toFixed(1)}s of audio`
      );
      window.dispatchEvent(
        new CustomEvent('realtime-credits-charged', {
          detail: { amount, audioSeconds },
        })
      );
      return;
    }

    const error = await response.json().catch(() => ({}));
    console.error('[RealtimeTranscription] Credit deduction failed:', error);

    if (response.status === 402 || error?.error === 'Insufficient credits') {
      console.warn('[RealtimeTranscription] Out of credits, signaling detection to halt');
      window.dispatchEvent(
        new CustomEvent('realtime-out-of-credits', {
          detail: { reason: 'out_of_credits' },
        })
      );
    }
  } catch (error) {
    console.error('[RealtimeTranscription] Credit charge request failed:', error);
  }
}

export function useRealtimeTranscription() {
  const isActive = computed(() => state.value.isActive);
  const transcriptBuffer = computed(() => state.value.buffer);
  const bufferText = computed(() => {
    return state.value.buffer.map((chunk) => chunk.segment.text).join(' ');
  });

  /**
   * Flush the pending segment batch: concat audio for all queued segments via
   * the Tauri `extract_audio_from_segments` command, send the resulting MP3 to
   * Whisper, and append the returned transcript to the buffer with absolute
   * stream-time offsets.
   *
   * `force=true` flushes whatever is queued (used on stop). Otherwise the
   * caller is expected to have verified pendingBatchSeconds >= WHISPER_BATCH_SECONDS.
   */
  async function flushBatch(force: boolean): Promise<void> {
    if (state.value.flushInProgress) {
      return;
    }
    if (state.value.pendingBatch.length === 0) {
      return;
    }
    if (!force && state.value.pendingBatchSeconds < WHISPER_BATCH_SECONDS) {
      return;
    }

    const batch = state.value.pendingBatch;
    const batchSeconds = state.value.pendingBatchSeconds;
    state.value.pendingBatch = [];
    state.value.pendingBatchSeconds = 0;
    state.value.flushInProgress = true;

    const batchStartStreamTime = batch[0].streamTime;
    const segmentPaths = batch.map((s) => s.path);

    console.log(
      '[RealtimeTranscription] Flushing batch:',
      batch.length,
      'segments,',
      batchSeconds.toFixed(1),
      's audio, streamTime start:',
      batchStartStreamTime
    );

    try {
      const result = await invoke<[string, string]>('extract_audio_from_segments', {
        segmentPaths,
      });
      const [, audioBase64] = result;
      console.log(
        '[RealtimeTranscription] Concatenated audio extracted, size:',
        audioBase64.length,
        'chars'
      );

      const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
      const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });

      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.mp3');
      formData.append('language', 'en');
      formData.append('project_id', 'realtime-transcription');

      console.log('[RealtimeTranscription] Sending batched audio to Whisper API...');
      const token = localStorage.getItem('auth_token') || '';
      const response = await fetch(`${API_BASE}/clips/transcribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: formData,
      });

      console.log('[RealtimeTranscription] Whisper response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[RealtimeTranscription] Transcription error:', errorText);
        throw new Error(`Transcription failed: ${response.statusText} - ${errorText}`);
      }

      const transcriptData = await response.json();
      const transcript = transcriptData.transcript || transcriptData;
      const segments = transcript.segments || [];
      const fullText = transcript.text || '';

      console.log(
        '[RealtimeTranscription] Batch transcription received: segments=',
        segments.length,
        ', text:',
        fullText.substring(0, 120)
      );

      if (segments.length === 0 && fullText.trim().length > 0) {
        segments.push({ text: fullText, start: 0, end: batchSeconds, words: [] });
      }

      if (segments.length > 0) {
        const now = Date.now();
        for (const segment of segments) {
          const chunk: TranscriptChunk = {
            segment: {
              text: segment.text || '',
              start: segment.start || 0,
              end: segment.end || 0,
              words: segment.words || [],
            },
            wallClockTime: now,
            streamTime: batchStartStreamTime + (segment.start || 0),
          };
          state.value.buffer.push(chunk);
          state.value.lastProcessedTime = now;
        }

        trimBuffer();
        console.log(
          '[RealtimeTranscription] Buffer size:',
          state.value.buffer.length,
          'chunks (stream:',
          batchStartStreamTime,
          's -',
          batchStartStreamTime + batchSeconds,
          's)'
        );
      }

      // Charge credits ONLY for audio Whisper actually accepted. If the request
      // failed (caught below) or the response was empty, we don't bill the user
      // — and because billing is tied to this code path, halting transcription
      // (stop, offline, recorder exit) automatically halts billing.
      await chargeForAudioSent(batchSeconds);
    } catch (error) {
      console.error('[RealtimeTranscription] Failed to transcribe batch:', error);
    } finally {
      state.value.flushInProgress = false;
    }
  }

  /**
   * Start real-time transcription by listening to segment-ready events.
   *
   * Each `segment-ready` is queued, not transcribed, until accumulated audio
   * duration crosses WHISPER_BATCH_SECONDS. That batch is then concatenated and
   * sent to Whisper as a single ~30s request, regardless of the platform's HLS
   * segment duration (4s for Kick/Twitch/YouTube/Twitter/Rumble at sub-1-min
   * granularity; longer for other modes).
   */
  async function startTranscription(sessionId: string) {
    if (state.value.isActive) {
      console.warn('[RealtimeTranscription] Already active');
      return;
    }

    console.log('[RealtimeTranscription] Starting transcription for session:', sessionId);
    state.value.isActive = true;
    state.value.buffer = [];
    state.value.lastProcessedTime = 0;
    state.value.pendingBatch = [];
    state.value.pendingBatchSeconds = 0;
    state.value.flushInProgress = false;
    state.value.cumulativeStreamSeconds = 0;

    segmentReadyUnlisten = await listen('segment-ready', async (event: any) => {
      const payload = event.payload as {
        path: string;
        sessionId: string;
        segment?: number;
        duration?: number;
      };

      if (payload.sessionId !== sessionId) {
        return;
      }

      const segmentDuration = payload.duration ?? DEFAULT_SEGMENT_DURATION;
      // Prefer absolute streamTime derived from segment index + duration when available,
      // otherwise fall back to a running cumulative counter so platforms that omit
      // the segment index still produce monotonically-increasing timestamps.
      const streamTime =
        payload.segment !== undefined && payload.segment !== null
          ? payload.segment * segmentDuration
          : state.value.cumulativeStreamSeconds;

      state.value.cumulativeStreamSeconds = streamTime + segmentDuration;

      const pending: PendingSegment = {
        path: payload.path,
        segmentNumber: payload.segment ?? state.value.pendingBatch.length,
        duration: segmentDuration,
        streamTime,
      };

      state.value.pendingBatch.push(pending);
      state.value.pendingBatchSeconds += segmentDuration;

      console.log(
        '[RealtimeTranscription] Queued segment for batch:',
        payload.path,
        `(${segmentDuration}s, total=${state.value.pendingBatchSeconds.toFixed(1)}s/${WHISPER_BATCH_SECONDS}s)`
      );

      if (state.value.pendingBatchSeconds >= WHISPER_BATCH_SECONDS) {
        await flushBatch(false);
      }
    });
  }

  /**
   * Stop real-time transcription. Any partial sub-30s batch still queued is
   * flushed so the tail audio isn't lost (e.g. a clip-worthy moment right
   * before the user stopped detection).
   */
  async function stopTranscription() {
    console.log('[RealtimeTranscription] Stopping transcription');

    if (segmentReadyUnlisten) {
      segmentReadyUnlisten();
      segmentReadyUnlisten = null;
    }

    if (state.value.pendingBatch.length > 0) {
      try {
        await flushBatch(true);
      } catch (error) {
        console.warn('[RealtimeTranscription] Final flush failed:', error);
      }
    }

    state.value.isActive = false;
    state.value.buffer = [];
    state.value.lastProcessedTime = 0;
    state.value.pendingBatch = [];
    state.value.pendingBatchSeconds = 0;
    state.value.flushInProgress = false;
    state.value.cumulativeStreamSeconds = 0;
  }

  /**
   * Trim buffer to keep only last N seconds
   */
  function trimBuffer() {
    if (state.value.buffer.length === 0) return;

    const now = Date.now();
    const cutoffMs = now - state.value.bufferDurationSeconds * 1000;

    // Remove chunks older than cutoff (using wall-clock time)
    state.value.buffer = state.value.buffer.filter((chunk) => {
      return chunk.wallClockTime >= cutoffMs;
    });
  }

  /**
   * Get current transcript buffer as formatted text with timestamps
   */
  function getFormattedTranscript(): { text: string; start: number; end: number } {
    if (state.value.buffer.length === 0) {
      return { text: '', start: 0, end: 0 };
    }

    const text = state.value.buffer.map((chunk) => chunk.segment.text).join(' ');
    // Use cumulative stream time for AI detection context
    const start = state.value.buffer[0].streamTime;
    const lastChunk = state.value.buffer[state.value.buffer.length - 1];
    const lastChunkDuration = Math.max(0, lastChunk.segment.end - lastChunk.segment.start);
    const end = lastChunk.streamTime + (lastChunkDuration || 4);

    return { text, start, end };
  }

  function getTranscriptStats(start?: number, end?: number): TranscriptStats {
    const transcript = getFormattedTranscript();
    const rangeStart = start ?? transcript.start;
    const rangeEnd = end ?? transcript.end;
    const duration = Math.max(0, rangeEnd - rangeStart);
    const speechEvents: Array<{
      start: number;
      end: number;
      words: number;
      fromWords: boolean;
    }> = [];

    for (const chunk of state.value.buffer) {
      const segmentStart = chunk.streamTime;
      const segmentDuration = Math.max(0, chunk.segment.end - chunk.segment.start);
      const segmentEnd = chunk.streamTime + (segmentDuration || 4);

      if (segmentEnd < rangeStart || segmentStart > rangeEnd) {
        continue;
      }

      const chunkBaseTime = chunk.streamTime - chunk.segment.start;
      const validWords = (chunk.segment.words || []).filter((word) => {
        const wordStart = chunkBaseTime + word.start;
        const wordEnd = chunkBaseTime + word.end;
        return word.word.trim().length > 0 && wordEnd >= rangeStart && wordStart <= rangeEnd;
      });

      if (validWords.length > 0) {
        for (const word of validWords) {
          speechEvents.push({
            start: Math.max(rangeStart, chunkBaseTime + word.start),
            end: Math.min(rangeEnd, chunkBaseTime + word.end),
            words: 1,
            fromWords: true,
          });
        }
        continue;
      }

      const text = chunk.segment.text.trim();
      if (!text) {
        continue;
      }

      const overlapStart = Math.max(rangeStart, segmentStart);
      const overlapEnd = Math.min(rangeEnd, segmentEnd || segmentStart + 4);
      const fallbackWords = text.split(/\s+/).filter(Boolean).length;

      if (overlapEnd > overlapStart && fallbackWords > 0) {
        speechEvents.push({
          start: overlapStart,
          end: overlapEnd,
          words: fallbackWords,
          fromWords: false,
        });
      }
    }

    speechEvents.sort((a, b) => a.start - b.start);

    const wordCount = speechEvents.reduce((sum, event) => sum + event.words, 0);
    const hasWordTimestamps = speechEvents.some((event) => event.fromWords);
    const firstSpeechTime = speechEvents[0]?.start ?? null;
    const lastSpeechTime = speechEvents[speechEvents.length - 1]?.end ?? null;
    const spokenDuration = speechEvents.reduce(
      (sum, event) => sum + Math.max(0, event.end - event.start),
      0
    );
    let longestGap = 0;

    for (let index = 1; index < speechEvents.length; index += 1) {
      longestGap = Math.max(longestGap, speechEvents[index].start - speechEvents[index - 1].end);
    }

    return {
      start: rangeStart,
      end: rangeEnd,
      duration,
      wordCount,
      spokenDuration,
      speechDensity: duration > 0 ? wordCount / duration : 0,
      firstSpeechTime,
      lastSpeechTime,
      leadingSilence:
        firstSpeechTime === null ? duration : Math.max(0, firstSpeechTime - rangeStart),
      trailingSilence: lastSpeechTime === null ? duration : Math.max(0, rangeEnd - lastSpeechTime),
      longestGap,
      hasWordTimestamps,
    };
  }

  function getAbsoluteTranscriptSegments(): AbsoluteTranscriptSegment[] {
    return state.value.buffer.map((chunk) => {
      const chunkBaseTime = chunk.streamTime - chunk.segment.start;
      const segmentDuration = Math.max(0, chunk.segment.end - chunk.segment.start);

      return {
        text: chunk.segment.text,
        start: chunk.streamTime,
        end: chunk.streamTime + (segmentDuration || 4),
        words: (chunk.segment.words || []).map((word) => ({
          word: word.word,
          start: chunkBaseTime + word.start,
          end: chunkBaseTime + word.end,
        })),
      };
    });
  }

  /**
   * Get the most recent `windowSeconds` of transcript as a discrete window.
   * Uses cumulative streamTime (not wall clock), so the window aligns with the
   * times the realtime detection LLM uses for clip boundaries.
   */
  function getRecentWindow(windowSeconds: number): {
    text: string;
    start: number;
    end: number;
    segments: AbsoluteTranscriptSegment[];
    stats: TranscriptStats;
  } {
    const all = getFormattedTranscript();
    if (all.end <= 0 || state.value.buffer.length === 0) {
      const emptyStats = getTranscriptStats(0, 0);
      return { text: '', start: 0, end: 0, segments: [], stats: emptyStats };
    }

    const end = all.end;
    const start = Math.max(all.start, end - Math.max(0, windowSeconds));

    const allSegments = getAbsoluteTranscriptSegments();
    const segments = allSegments.filter((seg) => seg.end > start && seg.start < end);
    const text = segments.map((seg) => seg.text).join(' ').trim();
    const stats = getTranscriptStats(start, end);

    return { text, start, end, segments, stats };
  }

  /**
   * Get the transcript text + segments for an arbitrary [start, end] range
   * in cumulative stream time. Used to send the pending-clip transcript so
   * far alongside the latest 30s window.
   */
  function getTranscriptForRange(
    start: number,
    end: number
  ): { text: string; segments: AbsoluteTranscriptSegment[] } {
    if (end <= start || state.value.buffer.length === 0) {
      return { text: '', segments: [] };
    }

    const segments = getAbsoluteTranscriptSegments().filter(
      (seg) => seg.end > start && seg.start < end
    );
    const text = segments.map((seg) => seg.text).join(' ').trim();
    return { text, segments };
  }

  /**
   * Get transcript buffer as Whisper-compatible JSON
   */
  function getTranscriptJson(): string {
    const segments = state.value.buffer.map((chunk) => chunk.segment);
    return JSON.stringify({ segments });
  }

  return {
    isActive,
    transcriptBuffer,
    bufferText,
    startTranscription,
    stopTranscription,
    getFormattedTranscript,
    getTranscriptStats,
    getAbsoluteTranscriptSegments,
    getRecentWindow,
    getTranscriptForRange,
    getTranscriptJson,
  };
}
