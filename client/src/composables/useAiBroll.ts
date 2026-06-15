import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { suggestAiBroll, searchAiBrollStock } from '@/services/aiBrollApi';
import {
  getAiBrollSuggestionsForClip,
  saveAiBrollSuggestions,
  updateAiBrollSuggestion,
} from '@/services/database/ai-broll-suggestions';
import { addProjectMedia } from '@/services/database/project-media';
import type {
  AiBrollCandidate,
  AiBrollDensity,
  AiBrollPlannerOptions,
  AiBrollStyle,
  AiBrollSuggestion,
} from '@/types/ai-broll';
import type { ManualFramingConfig, ManualRegion, SegmentRegionConfig } from '@/types';

const REGION_COLORS = ['#4F9DFF', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'];

function generateId(): string {
  return crypto.randomUUID();
}

function clipRelativeWords(
  words: Array<{ word: string; start: number; end: number }>,
  clipStart: number,
  clipEnd: number,
) {
  return words
    .filter((w) => w.end > clipStart && w.start < clipEnd)
    .map((w) => ({
      word: w.word,
      start: Math.max(0, w.start - clipStart),
      end: Math.min(clipEnd - clipStart, w.end - clipStart),
    }));
}

function clipRelativeSegments(
  segments: Array<{ text: string; start: number; end: number }>,
  clipStart: number,
  clipEnd: number,
) {
  return segments
    .filter((s) => s.end > clipStart && s.start < clipEnd)
    .map((s) => ({
      text: s.text,
      start: Math.max(0, s.start - clipStart),
      end: Math.min(clipEnd - clipStart, s.end - clipStart),
    }));
}

function buildFullCanvasRegion(
  mediaPath: string,
  mediaType: 'image' | 'video',
  suggestion: AiBrollSuggestion,
  candidate: AiBrollCandidate,
  index: number,
): ManualRegion {
  const sourceOffset =
    candidate.duration && candidate.duration > 3
      ? Math.min(Math.random() * Math.max(0, candidate.duration - 3), candidate.duration * 0.3)
      : 0;

  return {
    id: generateId(),
    color: REGION_COLORS[index % REGION_COLORS.length],
    label: `B-roll: ${suggestion.visualQuery.slice(0, 32)}`,
    source: { x: 0, y: 0, width: 1, height: 1 },
    output: { x: 0, y: 0, width: 1, height: 1 },
    mediaAssetId: mediaPath,
    mediaType,
    aspectRatioLocked: true,
    mediaSourceOffset: sourceOffset,
    aiBroll: {
      suggestionId: suggestion.id,
      provider: candidate.provider,
      query: suggestion.visualQuery,
      attribution: candidate.attribution,
      license: candidate.license,
      sourceUrl: candidate.downloadUrl,
      mediaSourceOffset: sourceOffset,
    },
  };
}

export function useAiBroll() {
  const suggestions = ref<AiBrollSuggestion[]>([]);
  const isGenerating = ref(false);
  const isFetching = ref(false);
  const error = ref<string | null>(null);
  const options = ref<AiBrollPlannerOptions>({
    density: 'low',
    style: 'mixed',
    sourceTypes: ['stock', 'library'],
  });

  const appliedCount = computed(
    () => suggestions.value.filter((s) => s.status === 'applied').length,
  );

  async function loadSuggestions(clipId: string) {
    suggestions.value = await getAiBrollSuggestionsForClip(clipId);
  }

  async function generateSuggestions(params: {
    clipId: string;
    clipStart: number;
    clipEnd: number;
    aspectRatio: string;
    transcriptWords?: Array<{ word: string; start: number; end: number }>;
    transcriptSegments?: Array<{ text: string; start: number; end: number }>;
    plannerOptions?: Partial<AiBrollPlannerOptions>;
  }) {
    isGenerating.value = true;
    error.value = null;
    try {
      const opts = { ...options.value, ...params.plannerOptions };
      options.value = opts;

      const duration = params.clipEnd - params.clipStart;
      const response = await suggestAiBroll({
        clipId: params.clipId,
        duration,
        aspectRatio: params.aspectRatio,
        transcriptWords: clipRelativeWords(params.transcriptWords ?? [], params.clipStart, params.clipEnd),
        transcriptSegments: clipRelativeSegments(
          params.transcriptSegments ?? [],
          params.clipStart,
          params.clipEnd,
        ),
        density: opts.density,
        style: opts.style,
        sourceTypes: opts.sourceTypes,
      });

      suggestions.value = response.suggestions.map((s) => ({
        ...s,
        status: 'suggested' as const,
        candidates: s.candidates ?? [],
      }));

      await saveAiBrollSuggestions(params.clipId, suggestions.value);
    } catch (e) {
      const axiosErr = e as { response?: { data?: { error?: string } }; message?: string };
      error.value =
        axiosErr.response?.data?.error ??
        (e instanceof Error ? e.message : 'Failed to generate B-roll suggestions');
    } finally {
      isGenerating.value = false;
    }
  }

  async function fetchCandidatesForSuggestion(
    suggestion: AiBrollSuggestion,
    orientation: 'portrait' | 'landscape' = 'portrait',
  ): Promise<AiBrollSuggestion> {
    const updated = { ...suggestion, status: 'fetching' as const };
    await updateAiBrollSuggestion(updated);
    replaceSuggestion(updated);

    try {
      const result = await searchAiBrollStock({
        query: suggestion.visualQuery,
        orientation,
      });
      const withCandidates: AiBrollSuggestion = {
        ...updated,
        status: result.candidates.length > 0 ? 'ready' : 'failed',
        candidates: result.candidates,
        selectedCandidateId: result.candidates[0]?.id ?? null,
        error: result.candidates.length > 0 ? null : 'No stock footage found',
      };
      await updateAiBrollSuggestion(withCandidates);
      replaceSuggestion(withCandidates);
      return withCandidates;
    } catch (e) {
      const failed: AiBrollSuggestion = {
        ...updated,
        status: 'failed',
        error: e instanceof Error ? e.message : 'Search failed',
      };
      await updateAiBrollSuggestion(failed);
      replaceSuggestion(failed);
      return failed;
    }
  }

  async function fetchAllCandidates(orientation: 'portrait' | 'landscape' = 'portrait') {
    isFetching.value = true;
    error.value = null;
    try {
      for (const s of suggestions.value.filter((x) => x.status === 'suggested' || x.status === 'failed')) {
        await fetchCandidatesForSuggestion(s, orientation);
      }
    } finally {
      isFetching.value = false;
    }
  }

  async function ingestCandidate(
    suggestion: AiBrollSuggestion,
    candidate: AiBrollCandidate,
    projectId: string,
  ): Promise<string> {
    const ext = candidate.mediaType === 'image' ? 'jpg' : 'mp4';
    const filename = `broll_${candidate.provider}_${candidate.providerAssetId}.${ext}`;

    const localPath = await invoke<string>('download_broll_media', {
      url: candidate.downloadUrl,
      projectId,
      filename,
    });

    await addProjectMedia(projectId, {
      mediaType: candidate.mediaType,
      filePath: localPath,
      fileName: filename,
      duration: candidate.duration ?? null,
      width: candidate.width || null,
      height: candidate.height || null,
    });

    return localPath;
  }

  function replaceSuggestion(next: AiBrollSuggestion) {
    const idx = suggestions.value.findIndex((s) => s.id === next.id);
    if (idx >= 0) {
      suggestions.value[idx] = next;
    }
  }

  async function applySuggestionToConfig(
    suggestion: AiBrollSuggestion,
    segmentConfigs: SegmentRegionConfig[],
    projectId: string,
    regionIndex: number,
  ): Promise<{ segmentConfigs: SegmentRegionConfig[]; suggestion: AiBrollSuggestion }> {
    let working = suggestion;
    if (working.candidates.length === 0) {
      working = await fetchCandidatesForSuggestion(working);
    }
    const candidate =
      working.candidates.find((c) => c.id === working.selectedCandidateId) ??
      working.candidates[0];
    if (!candidate?.downloadUrl) {
      throw new Error('No candidate media available');
    }

    const localPath = await ingestCandidate(working, candidate, projectId);
    const region = buildFullCanvasRegion(
      localPath,
      candidate.mediaType,
      working,
      candidate,
      regionIndex,
    );

    const segment: SegmentRegionConfig = {
      segmentId: generateId(),
      startTime: working.startTime,
      endTime: working.endTime,
      regions: [region],
    };

    const nextSegments = [...segmentConfigs, segment].sort((a, b) => a.startTime - b.startTime);
    const applied: AiBrollSuggestion = {
      ...working,
      status: 'applied',
      localMediaPath: localPath,
      selectedCandidateId: candidate.id,
    };
    await updateAiBrollSuggestion(applied);
    replaceSuggestion(applied);

    return { segmentConfigs: nextSegments, suggestion: applied };
  }

  async function regenerateSuggestion(
    suggestion: AiBrollSuggestion,
    orientation: 'portrait' | 'landscape' = 'portrait',
  ) {
    const reset: AiBrollSuggestion = {
      ...suggestion,
      status: 'suggested',
      candidates: [],
      selectedCandidateId: null,
      localMediaPath: null,
      error: null,
    };
    await updateAiBrollSuggestion(reset);
    replaceSuggestion(reset);
    return fetchCandidatesForSuggestion(reset, orientation);
  }

  async function rejectSuggestion(suggestion: AiBrollSuggestion) {
    const rejected: AiBrollSuggestion = { ...suggestion, status: 'rejected' };
    await updateAiBrollSuggestion(rejected);
    replaceSuggestion(rejected);
  }

  function suggestionToMarker(s: AiBrollSuggestion) {
    return {
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      label: s.visualQuery,
      status: s.status,
    };
  }

  const brollMarkers = computed(() =>
    suggestions.value
      .filter((s) => s.status !== 'rejected')
      .map(suggestionToMarker),
  );

  return {
    suggestions,
    isGenerating,
    isFetching,
    error,
    options,
    appliedCount,
    brollMarkers,
    loadSuggestions,
    generateSuggestions,
    fetchCandidatesForSuggestion,
    fetchAllCandidates,
    applySuggestionToConfig,
    regenerateSuggestion,
    rejectSuggestion,
    ingestCandidate,
  };
}

export type AiBrollMarker = ReturnType<typeof useAiBroll>['brollMarkers']['value'][number];
