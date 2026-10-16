import type { ClipWithVersion, RawVideo } from '@/services/database/types';

type Source = Pick<RawVideo, 'project_id' | 'file_path' | 'source_clip_id' | 'is_segment'>;
type ClipSource = Pick<ClipWithVersion, 'project_id' | 'file_path'>;
const mediaPath = (path: string) => path.replace(/\\/g, '/').toLowerCase();

/** A generated clip/export path does not change the time domain of its project source. */
export function usesProjectSource(clip: ClipSource, source: Source | null | undefined): boolean {
  if (!source || source.project_id !== clip.project_id) return false;
  if (source.source_clip_id || source.is_segment) return false;
  return Boolean(source.file_path);
}

export function sameMediaPath(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && mediaPath(left) === mediaPath(right));
}

export function workspaceClipSegments(clip: ClipWithVersion, source: Source | null | undefined) {
  const version = clip.current_version;
  const start = version?.start_time ?? clip.current_version_start_time ?? clip.start_time ?? 0;
  const end = version?.end_time ?? clip.current_version_end_time ?? clip.end_time ?? start;
  const sourceBased = usesProjectSource(clip, source);
  const duration = clip.duration && clip.duration > 0 ? clip.duration : end - start;
  const stored = clip.current_version_segments ?? [];
  if (stored.length) {
    // Source timestamps remain authoritative, including spliced clips and saved trims.
    if (sourceBased || !clip.file_path || stored.every(s => s.start_time >= 0 && s.end_time <= duration + 0.5)) {
      return stored.map(s => ({ ...s, duration: s.end_time - s.start_time }));
    }
  }
  const local = !sourceBased && Boolean(clip.file_path) && duration > 0;
  return [{
    start_time: local ? 0 : start,
    end_time: local ? duration : end,
    duration: local ? duration : end - start,
    transcript: version?.description ?? clip.current_version_description ?? '',
  }];
}
