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
}

interface RealtimeTranscriptionState {
  isActive: boolean;
  buffer: TranscriptChunk[];
  bufferDurationSeconds: number;
  lastProcessedTime: number;
}

const BUFFER_DURATION_SECONDS = 180; // 3 minutes
const state = ref<RealtimeTranscriptionState>({
  isActive: false,
  buffer: [],
  bufferDurationSeconds: BUFFER_DURATION_SECONDS,
  lastProcessedTime: 0,
});

let segmentReadyUnlisten: UnlistenFn | null = null;

export function useRealtimeTranscription() {
  const isActive = computed(() => state.value.isActive);
  const transcriptBuffer = computed(() => state.value.buffer);
  const bufferText = computed(() => {
    return state.value.buffer.map((chunk) => chunk.segment.text).join(' ');
  });

  /**
   * Start real-time transcription by listening to segment-ready events
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

    // Listen to segment-ready events (emitted every 4 seconds by DVR recording)
    segmentReadyUnlisten = await listen('segment-ready', async (event: any) => {
      const payload = event.payload as {
        path: string;
        sessionId: string;
        segment?: number;
        duration?: number;
      };

      // Only process segments for this session
      if (payload.sessionId !== sessionId) {
        return;
      }

      console.log('[RealtimeTranscription] Segment ready:', payload.path);

      try {
        // Extract audio from segment and get base64 data
        console.log('[RealtimeTranscription] Extracting audio from segment...');
        const result = await invoke<[string, string]>('extract_audio_from_video', {
          videoPath: payload.path,
          outputPath: '', // Empty path means return base64
        });

        // Rust returns [filename, base64_data]
        const [_filename, audioBase64] = result;
        console.log('[RealtimeTranscription] Audio extracted, size:', audioBase64.length, 'chars');

        // Convert base64 to blob for upload
        const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });
        console.log('[RealtimeTranscription] Audio blob created, size:', audioBlob.size, 'bytes');

        // Transcribe audio using server endpoint
        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.mp3');
        formData.append('language', 'en');
        formData.append('project_id', 'realtime-transcription'); // Dummy project ID for real-time mode

        console.log('[RealtimeTranscription] Sending to Whisper API...');
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
        console.log('[RealtimeTranscription] Transcription received:', transcriptData);

        // The server returns { success, transcript: { segments, text, ... } }
        const transcript = transcriptData.transcript || transcriptData;
        const segments = transcript.segments || [];
        const fullText = transcript.text || '';

        console.log(
          '[RealtimeTranscription] Segments count:',
          segments.length,
          'Full text:',
          fullText.substring(0, 100)
        );

        // If no segments but has text, create a single segment from the full text
        if (segments.length === 0 && fullText.trim().length > 0) {
          segments.push({ text: fullText, start: 0, end: 4, words: [] });
        }

        // Add to buffer
        if (segments.length > 0) {
          const now = Date.now();
          // Compute cumulative stream time from segment index and duration
          const segmentIndex = payload.segment ?? 0;
          const segmentDuration = payload.duration ?? 4;
          const segmentStreamTime = segmentIndex * segmentDuration;

          for (const segment of segments) {
            const chunk: TranscriptChunk = {
              segment: {
                text: segment.text || '',
                start: segment.start || 0,
                end: segment.end || 0,
                words: segment.words || [],
              },
              wallClockTime: now,
              // Map segment-local time to cumulative stream time
              streamTime: segmentStreamTime + (segment.start || 0),
            };

            state.value.buffer.push(chunk);
            state.value.lastProcessedTime = now;
          }

          // Trim buffer to last 3 minutes
          trimBuffer();

          console.log('[RealtimeTranscription] Buffer size:', state.value.buffer.length, 'chunks');
        }
      } catch (error) {
        console.error('[RealtimeTranscription] Failed to transcribe segment:', error);
      }
    });
  }

  /**
   * Stop real-time transcription
   */
  function stopTranscription() {
    console.log('[RealtimeTranscription] Stopping transcription');

    if (segmentReadyUnlisten) {
      segmentReadyUnlisten();
      segmentReadyUnlisten = null;
    }

    state.value.isActive = false;
    state.value.buffer = [];
    state.value.lastProcessedTime = 0;
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
    const speechEvents: Array<{ start: number; end: number; words: number }> = [];

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
        });
      }
    }

    speechEvents.sort((a, b) => a.start - b.start);

    const wordCount = speechEvents.reduce((sum, event) => sum + event.words, 0);
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
    getTranscriptJson,
  };
}
