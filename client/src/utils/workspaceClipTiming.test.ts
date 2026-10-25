import { describe, expect, it } from 'vitest';
import { referencedWorkspaceSource, usesProjectSource, workspaceClipSegments } from './workspaceClipTiming';
import type { ClipWithVersion, RawVideo } from '@/services/database/types';

const source = { project_id: 'project', file_path: 'C:/source.mp4', source_clip_id: null, is_segment: false } as RawVideo;
const clip = { id: 'clip', project_id: 'project', file_path: 'C:/generated-clip.mp4', duration: 19, current_version_start_time: 6340, current_version_end_time: 6359 } as ClipWithVersion;

describe('workspace source coordinates', () => {
  it('keeps a clip at 1:45:40 even when it has its own generated file', () => {
    expect(usesProjectSource(clip, source)).toBe(true);
    expect(workspaceClipSegments(clip, source)[0]).toMatchObject({ start_time: 6340, end_time: 6359, duration: 19 });
  });
  it('preserves saved source trims and disjoint segments without rebasing', () => {
    const segments = [{ start_time: 6338, end_time: 6345 }, { start_time: 6350, end_time: 6362 }] as ClipWithVersion['current_version_segments'];
    expect(workspaceClipSegments({ ...clip, current_version_segments: segments }, source).map(s => [s.start_time, s.end_time])).toEqual([[6338, 6345], [6350, 6362]]);
  });
  it('uses local time only when the available file is a standalone extracted clip', () => {
    const standalone = { ...source, source_clip_id: 'clip' };
    expect(usesProjectSource(clip, standalone)).toBe(false);
    expect(workspaceClipSegments(clip, standalone)[0]).toMatchObject({ start_time: 0, end_time: 19 });
  });
  it('never binds a clip to an unrelated project source', () => {
    expect(usesProjectSource(clip, { ...source, project_id: 'different' })).toBe(false);
  });
  it('preserves downloaded Twitch VOD timestamps with an external source ID and a string false flag', () => {
    const downloaded = { ...source, source_clip_id: 'v2828199023', is_segment: 'false', duration: 7910.25 };
    const detected = { ...clip, file_path: source.file_path, current_version_start_time: 2132.82, current_version_end_time: 2156.64,
      current_version_segments: [{ start_time: 2132.82, end_time: 2156.64 }] } as ClipWithVersion;
    expect(usesProjectSource(detected, downloaded)).toBe(true);
    expect(workspaceClipSegments(detected, downloaded)[0]).toMatchObject({ start_time: 2132.82, end_time: 2156.64 });
  });
  it('resolves a saved clip project back to the original source and preserves all three cuts', () => {
    const saved = { ...clip, project_id: 'saved-project', file_path: source.file_path, built_file_path: 'C:/export.mp4',
      current_version_segments: [{ start_time: 1852.1, end_time: 1855.3 }, { start_time: 1863.98, end_time: 1865.14 }, { start_time: 1870.24, end_time: 1874.22 }] } as ClipWithVersion;
    const resolved = referencedWorkspaceSource([saved], [source]);
    expect(resolved).toBe(source);
    expect(usesProjectSource(saved, resolved)).toBe(true);
    const segments = workspaceClipSegments(saved, resolved);
    expect(segments.map(s => s.start_time)).toEqual([1852.1, 1863.98, 1870.24]);
    expect(segments.reduce((sum, s) => sum + s.duration, 0)).toBeCloseTo(8.34);
    expect(referencedWorkspaceSource([saved], [])?.file_path).toBe(source.file_path);
  });
  it('bounds standalone clip segments to actual loaded media instead of stale clip duration', () => {
    const local = { ...source, source_clip_id: clip.id, duration: 22.12 };
    const stored = { ...clip, duration: 22.12, current_version_segments: [{ start_time: 0, end_time: 22.12 }] } as ClipWithVersion;
    expect(workspaceClipSegments(stored, local, 8.41)[0]).toMatchObject({ start_time: 0, end_time: 8.41, duration: 8.41 });
  });
  it('projects source timestamps onto a standalone extraction while keeping source provenance', () => {
    const local = { ...source, source_clip_id: clip.id };
    const stored = { ...clip, current_version_segments: [{ start_time: 6341, end_time: 6350 }] } as ClipWithVersion;
    expect(workspaceClipSegments(stored, local, 19)[0]).toMatchObject({ start_time: 1, end_time: 10, source_start_time: 6341, source_end_time: 6350 });
  });
});
