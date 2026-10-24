import type { ClipWithVersion, RawVideo } from '@/services/database/types';
import { isClipBuildOutputPath, isSelfContainedClip } from './selfContainedClip';

type Source = Pick<RawVideo, 'project_id' | 'file_path' | 'source_clip_id'> & { is_segment: boolean | number | string; duration?: number | null };
type ClipSource = Pick<ClipWithVersion, 'project_id' | 'file_path'> & { id?: string };
const mediaPath = (path: string) => path.replace(/\\/g, '/').toLowerCase();

/** A generated clip/export path does not change the time domain of its project source. */
export function usesProjectSource(clip: ClipSource, source: Source | null | undefined): boolean {
  if (!source?.file_path) return false;
  // source_clip_id also stores external VOD IDs, e.g. Twitch's "v2828199023".
  // Only an exact local clip ID identifies an extracted, clip-owned source.
  if (clip.id && source.source_clip_id === clip.id) return false;
  if (source.is_segment === true || source.is_segment === 1 || source.is_segment === 'true' || source.is_segment === '1') return false;
  return sameMediaPath(clip.file_path, source.file_path) || source.project_id === clip.project_id;
}

export function sameMediaPath(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && mediaPath(left) === mediaPath(right));
}

export function workspaceClipSegments(clip: ClipWithVersion, source: Source | null | undefined, loadedDuration?: number) {
  const version = clip.current_version;
  const start = version?.start_time ?? clip.current_version_start_time ?? clip.start_time ?? 0;
  const end = version?.end_time ?? clip.current_version_end_time ?? clip.end_time ?? start;
  const sourceBased = usesProjectSource(clip, source);
  const duration = [loadedDuration, sameMediaPath(clip.file_path, source?.file_path) ? source?.duration : undefined, clip.duration, end - start]
    .find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0) ?? 0;
  const stored = clip.current_version_segments ?? [];
  if (stored.length) {
    // Source timestamps remain authoritative, including spliced clips and saved trims.
    if (sourceBased || !clip.file_path) {
      return stored.map(s => ({ ...s, duration: s.end_time - s.start_time }));
    }
    const local = stored.map(s => {
      const offset = start > 0 && s.start_time >= start && s.end_time > duration ? start : 0;
      return { ...s, source_start_time: s.start_time, source_end_time: s.end_time,
        start_time: Math.max(0, s.start_time - offset), end_time: Math.min(duration, s.end_time - offset) };
    })
      .filter(s => Number.isFinite(s.start_time) && Number.isFinite(s.end_time) && s.end_time > s.start_time)
      .map(s => ({ ...s, duration: s.end_time - s.start_time }));
    if (local.length) return local;
  }
  const local = !sourceBased && Boolean(clip.file_path) && duration > 0;
  return [{
    source_start_time: start,
    source_end_time: end,
    start_time: local ? 0 : start,
    end_time: local ? duration : end,
    duration: local ? duration : end - start,
    transcript: version?.description ?? clip.current_version_description ?? '',
  }];
}

/** Saved clip projects can reference a source file owned by another project. */
export function referencedWorkspaceSource(clips: ClipWithVersion[], videos: RawVideo[]): RawVideo | null {
  const clip = clips.find(c => c.file_path && !isClipBuildOutputPath(c.file_path) && !isSelfContainedClip(c));
  if (!clip) return null;
  const existing = videos.find(video => sameMediaPath(video.file_path, clip.file_path));
  if (existing) return existing;
  // A source path remains usable after its old library row was removed. This is
  // transient playback metadata, never a new database record or guessed duration.
  return {
    id: `workspace-source-${clip.id}`, project_id: clip.project_id, file_path: clip.file_path,
    original_filename: clip.file_path.split(/[/\\]/).pop() ?? null,
    thumbnail_path: null, duration: null, width: null, height: null, frame_rate: null,
    codec: null, file_size: null, original_project_id: null, platform: null, source_url: null,
    created_at: 0, updated_at: 0, source_clip_id: null, source_mint_id: null,
    segment_number: null, is_segment: false, segment_start_time: null, segment_end_time: null,
  };
}
