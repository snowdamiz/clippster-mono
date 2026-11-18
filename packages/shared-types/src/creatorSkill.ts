/** Optional creator preferences; missing public details may be discovered per project. */
import type { WordInfo } from './clip';

/** Validate word times returned by the existing single-clip transcription endpoint. */
export function normalizeCreatorSkillTranscriptionWords(transcript: unknown, duration: number): WordInfo[] {
  if (!transcript || typeof transcript !== 'object') return [];
  const data = transcript as { words?: unknown; segments?: unknown };
  const segments = Array.isArray(data.segments) ? data.segments : [];
  const words = Array.isArray(data.words) && data.words.length ? data.words : segments.flatMap(segment =>
    segment && typeof segment === 'object' && Array.isArray((segment as { words?: unknown }).words)
      ? (segment as { words: unknown[] }).words : []);
  return words.filter((word): word is WordInfo =>
    !!word && typeof word === 'object' &&
    typeof (word as WordInfo).word === 'string' &&
    Number.isFinite((word as WordInfo).start) && Number.isFinite((word as WordInfo).end) &&
    (word as WordInfo).start >= 0 && (word as WordInfo).end > (word as WordInfo).start &&
    (word as WordInfo).end <= duration + 1);
}

export type CreatorSkillFormat = '9:16' | '16:9';

export const CREATOR_SKILL_DOCUMENT_NAMES = ['creator.md', 'claims.md', 'speech-diff.md', 'sound-scan.md', 'footage.md', 'review-brief.md', 'long-copy.md', 'shorts-copy.md', 'thumbnail-notes.md', 'delivery-summary.md'] as const;
export type CreatorSkillDocumentName = typeof CREATOR_SKILL_DOCUMENT_NAMES[number];

export interface CreatorSkillSoundScan {
  findings: Array<{ time: number; label: string; score: number }>;
  scannedSeconds: number;
  analyzedWindows: number;
  truncated: boolean;
}

export interface CreatorSkillClaimEvidence {
  claimIndex: number;
  captureIndex: number;
  excerpt: string;
  matchedTerms: number;
}

export function creatorSkillFormatForDuration(seconds: number): CreatorSkillFormat {
  return Number.isFinite(seconds) && seconds >= 120 ? '16:9' : '9:16';
}

export interface CreatorSkillPreferences {
  brand?: { channelName?: string; colors?: string[]; fonts?: string[]; companyUrl?: string };
  editing?: {
    preserveEveryWord?: boolean;
    musicAllowed?: boolean;
    soundEffectsAllowed?: boolean;
    graphicDensity?: 'minimal' | 'standard' | 'high';
    rules?: string[];
  };
  sponsors?: Array<{
    name: string;
    referralUrl?: string;
    code?: string;
    disclosure?: string;
    platforms?: string[];
    discountInDescriptionAllowed?: boolean;
    riskLine?: string;
  }>;
  publishing?: { audience?: string; tone?: string; callToAction?: string; platforms?: string[]; schedule?: string };
  delivery?: { destination?: string; previewMaxMb?: number };
}

export interface CreatorSkillPackage {
  funnel: { stage: 'reach' | 'trust' | 'sponsor' | 'creator_product'; reason: string; bridge?: string; metric: string };
  claims: Array<{
    time: number;
    text: string;
    verdict: 'verified' | 'partial' | 'unconfirmed' | 'rumor' | 'opinion' | 'prediction' | 'not_found';
    sourceUrl?: string;
    publishedAt?: string;
    onScreenLabel?: string;
  }>;
  claimReviews?: Array<{ claimIndex: number; decision: 'source_checked' | 'label_checked' | 'needs_changes'; note: string; reviewedAt: string }>;
  sources: Array<{ url: string; title: string; publishedAt?: string; retrievedAt: string }>;
  /** Public references for entities mentioned in the clip; these do not confirm sponsorship or usage rights. */
  brandReferences?: Array<{ name: string; sourceUrl: string; logoUrl?: string; colors: string[]; notes: string }>;
  /** Proposed source-video crops; the creator must inspect the rendered frames before publishing. */
  footageReview?: Array<{ start: number; end: number; crop?: { x: number; y: number; width: number; height: number }; show: string; hide: string[]; note: string }>;
  footageReviews?: Array<{ footageIndex: number; decision: 'frame_checked' | 'needs_changes'; note: string; reviewedAt: string }>;
  independentReview?: Array<{ reviewer: string; severity: 'fix_first' | 'should_fix' | 'ok'; outputTime: number; finding: string; masterMd5: string; reviewedAt: string }>;
  independentSignoff?: { reviewer: string; note: string; masterMd5: string; reviewedAt: string };
  automatedQa?: { masterMd5: string; blockers: string[] };
  sponsors: Array<{ name: string; confirmed: boolean; referralUrl?: string; code?: string; disclosure?: string; riskLine?: string; platforms?: string[]; discountInDescriptionAllowed?: boolean; review?: string }>;
  thumbnailConcepts: string[];
  thumbnailHeadlines: string[];
  /** Proposed chapter starts in finished-video time, checked after rendering. */
  chapters?: Array<{ time: number; title: string }>;
  platformCopy: Array<{ platform: string; title: string; description: string; tags: string[]; pinnedComment: string }>;
  reviewItems: string[];
}

/** Raw footage and generated work remain separately addressable. */
export interface CreatorSkillClipEdit {
  clipId: string;
  detectionSessionId: string;
  aiSessionId?: number;
  prepaidJobId?: number;
  thumbnailCandidates?: Array<{ path: string; sourceTime: number }>;
  thumbnailVariants?: Array<{ path: string; index: number; headline: string }>;
  status: 'awaiting_approval' | 'queued' | 'researching' | 'editing' | 'rendering' | 'needs_review' | 'ready' | 'failed';
  selectedVersion: 'raw' | 'edited';
  rawSource: { path: string; segments: Array<{ start: number; end: number }> };
  rawClipMd5?: string;
  sourceCaptures?: Array<{ index: number; url: string; title: string; kind: 'source' | 'brand'; fetchedAt: string; path: string; linkedLogoUrl?: string; screenshotPath?: string; pagePublishedAt?: string }>;
  claimEvidence?: CreatorSkillClaimEvidence[];
  edited?: { path: string; timeline: unknown; assets: string[]; captionsPath?: string; contactSheetPath?: string; phonePreviewPath?: string; noMusicPath?: string; tiktokSafePath?: string; tiktokCaptionsPath?: string; masterMd5?: string; editorNotes?: string; speechDiff?: string; soundScan?: CreatorSkillSoundScan };
  playbookPackage?: CreatorSkillPackage;
  creatorProfile?: { name: string; preferences: CreatorSkillPreferences };
  sources: Array<{ url: string; title: string; publishedAt?: string }>;
  reviewItems: string[];
}
