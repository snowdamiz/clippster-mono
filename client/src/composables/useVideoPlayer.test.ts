import { afterEach, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { ClipWithVersion, Project, RawVideo } from '@/services/database/types';
const mocks = vi.hoisted(() => ({ videos: vi.fn(), children: vi.fn(), clips: vi.fn(), invoke: vi.fn() }));
vi.mock('@/services/database', () => ({ getAllRawVideos: mocks.videos, getRawVideosByOriginalProjectId: mocks.children, getClipsWithVersionsByProjectId: mocks.clips }));
vi.mock('@/services/clip-vod-extract', () => ({ isPlausibleVodSourcePath: (path: string) => !path.includes('/built_clips/') }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
import { useVideoPlayer } from './useVideoPlayer';
import { usesProjectSource, workspaceClipSegments } from '@/utils/workspaceClipTiming';

afterEach(() => vi.restoreAllMocks());

it('opens a saved manual project on its referenced full VOD, never its short export', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const source = { id: 'original', project_id: 'original-project', file_path: 'C:/videos/original.mp4', duration: 7200, source_clip_id: 'external-vod', is_segment: 'false' } as unknown as RawVideo;
  const clip = { id: 'saved-clip', project_id: 'saved-project', file_path: source.file_path, built_file_path: 'C:/clips/export.mp4', built_duration: 8.41,
    current_version_start_time: 1852.1, current_version_end_time: 1874.22,
    current_version_segments: [{ start_time: 1852.1, end_time: 1855.3 }, { start_time: 1863.98, end_time: 1865.14 }, { start_time: 1870.24, end_time: 1874.22 }] } as ClipWithVersion;
  mocks.videos.mockResolvedValue([source]); mocks.children.mockResolvedValue([]); mocks.clips.mockResolvedValue([clip]); mocks.invoke.mockResolvedValue(4567);
  const scope = effectScope();
  const project = ref<Project | null>(null);
  const player = scope.run(() => useVideoPlayer(project))!;
  player.videoElement.value = { paused: true, load: vi.fn(), duration: 7200, currentTime: 0, videoWidth: 1920, videoHeight: 1080 } as unknown as HTMLVideoElement;
  await player.loadVideos();
  project.value = { id: 'saved-project' } as Project;
  await nextTick();
  await player.loadVideoForProject();
  expect(player.currentFilePath.value).toBe(source.file_path);
  expect(player.currentVideo.value?.id).toBe('original');
  expect(usesProjectSource(clip, player.currentVideo.value)).toBe(true);
  const ranges = workspaceClipSegments(clip, player.currentVideo.value);
  expect(ranges).toHaveLength(3);
  expect(ranges[0].start_time).toBe(1852.1);
  expect(ranges.reduce((sum, range) => sum + range.duration, 0)).toBeCloseTo(8.34);
  scope.stop();
});
