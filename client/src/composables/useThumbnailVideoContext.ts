import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useFrameExtractor } from '@/composables/useFrameExtractor';
import { getAllProjects } from '@/services/database/projects';
import { getAllClips } from '@/services/database/clips';
import {
  pickPrimaryRawVideo,
  resolveRawVideosForProject,
} from '@/services/project-raw-video-resolve';
import type { Clip, Project, RawVideo } from '@/services/database/types';

export interface ThumbnailKeyFrame {
  url: string;
  timestamp: number;
  index: number;
}

export interface ThumbnailVideoAttachPayload {
  selection: ThumbnailVideoSelection;
  keyFrames: ThumbnailKeyFrame[];
  media_items: Array<Record<string, unknown>>;
  key_frames: Array<Record<string, unknown>>;
}

export interface ThumbnailVideoSelection {
  id: string;
  name: string;
  type: 'project' | 'clip';
  sourcePath: string;
  duration: number | null;
  thumbnailUrl?: string;
  projectId?: string;
}
const MIN_FRAMES = 6;
const MAX_FRAMES = 12;

function computeFrameCount(duration: number): number {
  if (!duration || duration <= 0) return MIN_FRAMES;
  if (duration <= 30) return MIN_FRAMES;
  if (duration <= 120) return 8;
  if (duration <= 600) return 10;
  return MAX_FRAMES;
}

function computeTimestamps(duration: number, count: number): number[] {
  if (!duration || duration <= 0) return Array.from({ length: count }, (_, i) => i * 0.5);
  const step = duration / (count + 1);
  return Array.from({ length: count }, (_, i) => Math.min(duration - 0.1, step * (i + 1)));
}

export function useThumbnailVideoContext() {
  const { extractFrameAsDataUrl } = useFrameExtractor();
  const isLoadingSources = ref(false);
  const isExtractingFrames = ref(false);
  const error = ref<string | null>(null);
  const projects = ref<Project[]>([]);
  const builtClips = ref<Clip[]>([]);
  const thumbnailCache = ref<Map<string, string>>(new Map());

  async function loadSources() {
    isLoadingSources.value = true;
    error.value = null;
    try {
      const [allProjects, allClips] = await Promise.all([getAllProjects(), getAllClips()]);
      projects.value = allProjects.filter((p) => !p.parent_id);
      builtClips.value = allClips.filter(
        (c) => c.built_file_path && c.build_status === 'completed',
      );
      await preloadThumbnails();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load video sources';
    } finally {
      isLoadingSources.value = false;
    }
  }

  async function preloadThumbnails() {
    for (const clip of builtClips.value) {
      if (!clip.built_thumbnail_path || thumbnailCache.value.has(clip.id)) continue;
      try {
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: clip.built_thumbnail_path,
        });
        thumbnailCache.value.set(clip.id, dataUrl);
      } catch {
        // ignore missing thumbnails
      }
    }

    for (const project of projects.value) {
      if (!project.thumbnail_path || thumbnailCache.value.has(project.id)) continue;
      try {
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: project.thumbnail_path,
        });
        thumbnailCache.value.set(project.id, dataUrl);
      } catch {
        // ignore
      }
    }
  }

  async function resolveProjectVideo(project: Project): Promise<RawVideo | null> {
    const rawVideos = await resolveRawVideosForProject(project.id, project.parent_id);
    return pickPrimaryRawVideo(rawVideos);
  }

  async function buildProjectSelection(project: Project): Promise<ThumbnailVideoSelection | null> {
    const raw = await resolveProjectVideo(project);
    if (!raw?.file_path) return null;
    return {
      id: project.id,
      name: project.name,
      type: 'project',
      sourcePath: raw.file_path,
      duration: raw.duration,
      thumbnailUrl: thumbnailCache.value.get(project.id),
      projectId: project.id,
    };
  }

  function buildClipSelection(clip: Clip): ThumbnailVideoSelection | null {
    if (!clip.built_file_path) return null;
    return {
      id: clip.id,
      name: clip.name || clip.project_name || 'Untitled Clip',
      type: 'clip',
      sourcePath: clip.built_file_path,
      duration: clip.built_duration ?? clip.duration,
      thumbnailUrl: thumbnailCache.value.get(clip.id),
      projectId: clip.project_id ?? undefined,
    };
  }

  async function extractKeyFrames(
    selection: ThumbnailVideoSelection,
  ): Promise<ThumbnailKeyFrame[]> {
    isExtractingFrames.value = true;
    error.value = null;
    try {
      const duration = selection.duration ?? 60;
      const count = computeFrameCount(duration);
      const timestamps = computeTimestamps(duration, count);
      const frames: ThumbnailKeyFrame[] = [];

      for (let i = 0; i < timestamps.length; i++) {
        const timestamp = timestamps[i];
        const dataUrl = await extractFrameAsDataUrl(selection.sourcePath, timestamp);
        if (!dataUrl) continue;
        frames.push({ url: dataUrl, timestamp, index: i });
      }

      if (frames.length === 0) {
        throw new Error('Could not extract frames from the selected video');
      }

      return frames;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Frame extraction failed';
      throw e;
    } finally {
      isExtractingFrames.value = false;
    }
  }

  function toMediaPayload(selection: ThumbnailVideoSelection, keyFrames: ThumbnailKeyFrame[]) {
    return {
      media_items: [
        {
          id: selection.id,
          name: selection.name,
          type: 'video',
          source: selection.type,
          sourcePath: selection.sourcePath,
          projectId: selection.projectId,
          duration: selection.duration,
          thumbnailUrl: selection.thumbnailUrl,
        },
      ],
      key_frames: keyFrames.map((f) => ({
        url: f.url,
        timestamp: f.timestamp,
        index: f.index,
      })),
    };
  }

  return {
    isLoadingSources,
    isExtractingFrames,
    error,
    projects,
    builtClips,
    thumbnailCache,
    loadSources,
    resolveProjectVideo,
    buildProjectSelection,
    buildClipSelection,
    extractKeyFrames,
    toMediaPayload,
  };
}
