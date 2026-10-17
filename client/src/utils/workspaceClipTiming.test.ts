import { describe, expect, it } from 'vitest';
import { usesProjectSource, workspaceClipSegments } from './workspaceClipTiming';
import type { ClipWithVersion, RawVideo } from '@/services/database/types';

const source = { project_id: 'project', file_path: 'C:/source.mp4', source_clip_id: null, is_segment: false } as RawVideo;
const clip = { project_id: 'project', file_path: 'C:/generated-clip.mp4', duration: 19, current_version_start_time: 6340, current_version_end_time: 6359 } as ClipWithVersion;

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
});
