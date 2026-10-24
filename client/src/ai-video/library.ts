/** The app's own libraries as pickable sources for the AI video editor. Every item resolves to a finished file on disk. */
import { getCompletedBuildEntries } from '@/services/database/clip-build';
import { getEditorExportClips } from '@/services/database/clips';
import { getAllDownloadedAudio } from '@/services/database/downloaded-audio';
import { getAllImageAssets } from '@/services/database/image-assets';
import { getAllProjects } from '@/services/database/projects';
import { pickPrimaryRawVideo, resolveRawVideosForProject } from '@/services/project-raw-video-resolve';
import { imageThumbnail } from './analysis/media';

export type LibrarySource = 'built-clips' | 'projects' | 'image-library' | 'audio-library';

export interface LibraryItem {
  key: string;
  name: string;
  path: string;
  meta?: string | null;
  duration?: number | null;
  /** Local image path, data URL or remote URL. */
  thumbnail?: string | null;
}

export const LIBRARY_SOURCES: Record<LibrarySource, { label: string; empty: string }> = {
  'built-clips': { label: 'Built clips', empty: 'Build clips from your projects to see them here.' },
  projects: { label: 'Projects', empty: 'Projects with a downloaded or uploaded video show up here.' },
  'image-library': { label: 'Image library', empty: 'Images you create or upload show up here.' },
  'audio-library': { label: 'Audio library', empty: 'Songs and sounds you download or upload show up here.' },
};

function aspectRatios(json: string | null): string | null {
  if (!json) return null;
  try {
    const ratios: unknown = JSON.parse(json);
    return Array.isArray(ratios) && ratios.length ? ratios.join(', ') : null;
  } catch {
    return null;
  }
}

/** Clip builds plus Video Editor exports, matching what the Clips page shows. */
async function builtClips(): Promise<LibraryItem[]> {
  const [builds, editorExports] = await Promise.all([getCompletedBuildEntries(), getEditorExportClips()]);
  const entries = [
    ...builds.map(({ clip, build }) => ({
      createdAt: build.created_at,
      item: {
        key: build.id,
        name: clip.name || clip.project_name || 'Untitled clip',
        path: build.file_path,
        meta: aspectRatios(build.aspect_ratios),
        duration: build.duration ?? clip.duration,
        thumbnail: build.thumbnail_path ?? clip.built_thumbnail_path,
      },
    })),
    ...editorExports.map((clip) => ({
      createdAt: clip.created_at,
      item: {
        key: clip.id,
        name: clip.name || 'Untitled export',
        path: clip.built_file_path,
        meta: 'Video Editor',
        duration: clip.built_duration ?? clip.duration,
        thumbnail: clip.built_thumbnail_path,
      },
    })),
  ];
  return entries.sort((a, b) => b.createdAt - a.createdAt).map((entry) => entry.item);
}

async function projects(): Promise<LibraryItem[]> {
  const resolved = await Promise.all(
    (await getAllProjects()).map(async (project) => {
      const video = pickPrimaryRawVideo(await resolveRawVideosForProject(project.id, project.parent_id));
      return video ? { project, video } : null;
    })
  );
  const seen = new Set<string>();
  const items: LibraryItem[] = [];
  for (const entry of resolved) {
    if (!entry || seen.has(entry.video.file_path)) continue;
    seen.add(entry.video.file_path);
    items.push({
      key: entry.project.id,
      name: entry.project.name,
      path: entry.video.file_path,
      meta: entry.project.platform,
      duration: entry.video.duration,
      thumbnail: entry.project.thumbnail_path ?? entry.video.thumbnail_path,
    });
  }
  return items;
}

async function imageLibrary(): Promise<LibraryItem[]> {
  return (await getAllImageAssets()).map((image) => ({
    key: image.id,
    name: image.name,
    path: image.file_path,
    meta: image.width && image.height ? `${image.width}×${image.height}` : null,
    thumbnail: image.file_path,
  }));
}

async function audioLibrary(): Promise<LibraryItem[]> {
  return (await getAllDownloadedAudio())
    .filter((audio) => audio.platform !== 'Twitter')
    .map((audio) => ({
      key: audio.id,
      name: audio.title,
      path: audio.file_path,
      meta: audio.platform,
      duration: audio.duration,
      thumbnail: audio.thumbnail_url,
    }));
}

const LOADERS: Record<LibrarySource, () => Promise<LibraryItem[]>> = {
  'built-clips': builtClips,
  projects,
  'image-library': imageLibrary,
  'audio-library': audioLibrary,
};

export function loadLibrary(source: LibrarySource): Promise<LibraryItem[]> {
  return LOADERS[source]();
}

const thumbnails = new Map<string, Promise<string | null>>();

/** Displayable thumbnail for a library item: remote and data URLs pass through, local files are downscaled. */
export function libraryThumbnail(source: string): Promise<string | null> {
  if (/^(data:|https?:)/.test(source)) return Promise.resolve(source);
  let thumbnail = thumbnails.get(source);
  if (!thumbnail) {
    thumbnail = imageThumbnail(source).catch(() => null);
    thumbnails.set(source, thumbnail);
  }
  return thumbnail;
}
