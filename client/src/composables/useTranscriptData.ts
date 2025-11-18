/**
 * Composable for managing transcript data and caching in timeline components
 * Handles transcript loading, caching, and tooltip word management
 */
import { ref, watch, type Ref } from 'vue';
import { getTranscriptWithSegmentsByProjectId } from '../services/database';
import {
  parseTranscriptToWords,
  findWordsAroundTime,
  debounce,
  type WordInfo,
} from '../utils/timelineUtils';
import type { WhisperSegment } from '../types';

// Transcript data interface
interface TranscriptData {
  transcript: any;
  segments: any[];
  words: WordInfo[];
  whisperSegments: WhisperSegment[];
}

export function useTranscriptData(projectId: Ref<string | null>) {
  // Transcript data state
  const transcriptData = ref<TranscriptData | null>(null);

  // Tooltip transcript state
  const tooltipTranscriptWords = ref<WordInfo[]>([]);
  const centerWordIndex = ref(0);

  // Drag tooltip transcript state
  const dragTooltipTranscriptWords = ref<WordInfo[]>([]);
  const dragTooltipCenterWordIndex = ref(0);

  // Resize tooltip transcript state
  const resizeTooltipTranscriptWords = ref<WordInfo[]>([]);
  const resizeTooltipCenterWordIndex = ref(0);

  // Cache for word search results to improve performance
  const wordSearchCache = ref<Map<number, { words: WordInfo[]; centerIndex: number }>>(new Map());

  // Parse whisper segments from raw JSON
  function parseWhisperSegments(rawJson: string): WhisperSegment[] {
    try {
      const data = JSON.parse(rawJson);
      const segments: WhisperSegment[] = [];

      if (data.segments && Array.isArray(data.segments)) {
        data.segments.forEach((segment: any, index: number) => {
          if (segment.start !== undefined && segment.end !== undefined) {
            const segmentWords: WordInfo[] = [];

            // Extract words for this segment if available
            if (segment.words && Array.isArray(segment.words)) {
              segment.words.forEach((word: any) => {
                if (word.word && word.start !== undefined && word.end !== undefined) {
                  segmentWords.push({
                    word: word.word.trim(),
                    start: word.start,
                    end: word.end,
                    confidence: word.confidence,
                  });
                }
              });
            }

            segments.push({
              id: segment.id !== undefined ? segment.id : index,
              start: segment.start,
              end: segment.end,
              text: segment.text || '',
              words: segmentWords.length > 0 ? segmentWords : undefined,
            });
          }
        });
      }

      return segments;
    } catch (error) {
      console.error('[useTranscriptData] Failed to parse whisper segments:', error);
      return [];
    }
  }

  // Find the whisper segment that contains the given timestamp
  function findSegmentAtTime(timestamp: number, segments: WhisperSegment[]): WhisperSegment | null {
    if (!segments || segments.length === 0) return null;

    // Find segment that contains the timestamp
    for (const segment of segments) {
      if (timestamp >= segment.start && timestamp <= segment.end) {
        return segment;
      }
    }

    // If no exact match, return null (dead space between segments)
    return null;
  }

  // Load transcript data for enhanced tooltips
  async function loadTranscriptData(projectId: string | null) {
    if (!projectId) {
      transcriptData.value = null;
      return;
    }

    try {
      const { transcript, segments } = await getTranscriptWithSegmentsByProjectId(projectId);

      if (transcript && transcript.raw_json) {
        // Parse the raw JSON to extract word-level timing and segments
        const words = parseTranscriptToWords(transcript.raw_json);
        const whisperSegments = parseWhisperSegments(transcript.raw_json);

        transcriptData.value = {
          transcript,
          segments,
          words,
          whisperSegments,
        };

        // Clear cache when new transcript data is loaded
        wordSearchCache.value.clear();
      } else {
        transcriptData.value = null;
        wordSearchCache.value.clear();
      }
    } catch (error) {
      transcriptData.value = null;
      wordSearchCache.value.clear();
    }
  }

  // Throttled function for immediate tooltip updates (position)
  // This will be handled by the component with throttling
  // Just update the timestamp in the component

  // Optimized function for updating tooltip words
  const debouncedUpdateTooltipWords = debounce((timestamp: number) => {
    if (transcriptData.value && transcriptData.value.words.length > 0) {
      // Check cache first
      const cacheKey = Math.round(timestamp * 10); // Round to 100ms precision
      if (wordSearchCache.value.has(cacheKey)) {
        const cached = wordSearchCache.value.get(cacheKey)!;
        tooltipTranscriptWords.value = cached.words;
        centerWordIndex.value = cached.centerIndex;
        return;
      }

      const { words, centerIndex } = findWordsAroundTime(timestamp, transcriptData.value.words);
      tooltipTranscriptWords.value = words;
      centerWordIndex.value = centerIndex;

      // Cache the result (including empty results for dead space)
      wordSearchCache.value.set(cacheKey, { words, centerIndex });

      // Limit cache size to prevent memory issues
      if (wordSearchCache.value.size > 1000) {
        const firstKey = wordSearchCache.value.keys().next().value;
        if (firstKey !== undefined) {
          wordSearchCache.value.delete(firstKey);
        }
      }
    }
  }, 30); // Slightly increased for better performance

  // Update tooltip words for drag operation
  function updateDragTooltipWords(timestamp: number) {
    if (transcriptData.value && transcriptData.value.words.length > 0) {
      const { words, centerIndex } = findWordsAroundTime(timestamp, transcriptData.value.words);
      dragTooltipTranscriptWords.value = words;
      dragTooltipCenterWordIndex.value = centerIndex;
    } else {
      dragTooltipTranscriptWords.value = [];
      dragTooltipCenterWordIndex.value = 0;
    }
  }

  // Update tooltip words for resize operation
  function updateResizeTooltipWords(timestamp: number) {
    if (transcriptData.value && transcriptData.value.words.length > 0) {
      const { words, centerIndex } = findWordsAroundTime(timestamp, transcriptData.value.words);
      resizeTooltipTranscriptWords.value = words;
      resizeTooltipCenterWordIndex.value = centerIndex;
    } else {
      resizeTooltipTranscriptWords.value = [];
      resizeTooltipCenterWordIndex.value = 0;
    }
  }

  // Clear all tooltip data
  function clearTooltipData() {
    tooltipTranscriptWords.value = [];
    centerWordIndex.value = 0;
    dragTooltipTranscriptWords.value = [];
    dragTooltipCenterWordIndex.value = 0;
    resizeTooltipTranscriptWords.value = [];
    resizeTooltipCenterWordIndex.value = 0;
    debouncedUpdateTooltipWords.cancel();
  }

  // Clear drag-specific tooltip data
  function clearDragTooltipData() {
    dragTooltipTranscriptWords.value = [];
    dragTooltipCenterWordIndex.value = 0;
  }

  // Clear resize-specific tooltip data
  function clearResizeTooltipData() {
    resizeTooltipTranscriptWords.value = [];
    resizeTooltipCenterWordIndex.value = 0;
  }

  // Watch for projectId changes
  watch(
    projectId,
    (newProjectId) => {
      loadTranscriptData(newProjectId || null);
    },
    { immediate: true }
  );

  return {
    // State
    transcriptData,
    tooltipTranscriptWords,
    centerWordIndex,
    dragTooltipTranscriptWords,
    dragTooltipCenterWordIndex,
    resizeTooltipTranscriptWords,
    resizeTooltipCenterWordIndex,

    // Methods
    loadTranscriptData,
    debouncedUpdateTooltipWords,
    updateDragTooltipWords,
    updateResizeTooltipWords,
    clearTooltipData,
    clearDragTooltipData,
    clearResizeTooltipData,
    findSegmentAtTime,
  };
}
