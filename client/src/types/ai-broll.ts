/** AI B-roll suggestion and provider types (shared client/server contract). */

export type AiBrollSourceType = 'stock' | 'generated' | 'library' | 'manual';

export type AiBrollProvider = 'pexels' | 'pixabay' | 'local' | 'generated';

export type AiBrollSuggestionStatus =
  | 'suggested'
  | 'fetching'
  | 'ready'
  | 'applied'
  | 'rejected'
  | 'failed';

export type AiBrollDensity = 'low' | 'medium' | 'high';

export type AiBrollStyle = 'literal' | 'metaphorical' | 'mixed';

export interface AiBrollCandidate {
  id: string;
  provider: AiBrollProvider;
  mediaType: 'image' | 'video';
  previewUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
  duration?: number | null;
  attribution: string;
  license: string;
  providerAssetId: string;
  score?: number;
}

export interface AiBrollSuggestion {
  id: string;
  clipId: string;
  startTime: number;
  endTime: number;
  transcriptText: string;
  reason: string;
  visualQuery: string;
  generationPrompt?: string;
  sourceType: AiBrollSourceType;
  status: AiBrollSuggestionStatus;
  confidence: number;
  candidates: AiBrollCandidate[];
  selectedCandidateId?: string | null;
  /** Resolved local filesystem path after ingestion */
  localMediaPath?: string | null;
  error?: string | null;
}

/** Metadata stored on applied POI regions (export ignores unknown fields in Rust). */
export interface AiBrollRegionMetadata {
  suggestionId?: string;
  provider?: AiBrollProvider;
  query?: string;
  prompt?: string;
  attribution?: string;
  license?: string;
  sourceUrl?: string;
  /** Seconds into the B-roll source video to start playback */
  mediaSourceOffset?: number;
}

export interface AiBrollSuggestRequest {
  clipId: string;
  duration: number;
  aspectRatio: string;
  transcriptWords?: Array<{ word: string; start: number; end: number }>;
  transcriptSegments?: Array<{ text: string; start: number; end: number }>;
  density?: AiBrollDensity;
  style?: AiBrollStyle;
  sourceTypes?: AiBrollSourceType[];
}

export interface AiBrollSuggestResponse {
  suggestions: AiBrollSuggestion[];
}

export interface AiBrollSearchRequest {
  query: string;
  provider?: AiBrollProvider;
  orientation?: 'portrait' | 'landscape' | 'square';
  page?: number;
  perPage?: number;
}

export interface AiBrollSearchResponse {
  provider: AiBrollProvider;
  query: string;
  candidates: AiBrollCandidate[];
}

export interface AiBrollPlannerOptions {
  density: AiBrollDensity;
  style: AiBrollStyle;
  sourceTypes: AiBrollSourceType[];
}

export const DEFAULT_BROLL_OPTIONS: AiBrollPlannerOptions = {
  density: 'low',
  style: 'mixed',
  sourceTypes: ['stock', 'library'],
};
