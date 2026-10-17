/**
 * Media helpers for adding portfolio clips from the profile editor: finding
 * built clips in the local library (with thumbnails), turning one into an
 * uploadable File, and capturing a poster frame for any video File.
 */
import { invoke } from '@tauri-apps/api/core';
import { getAllClipsWithBuilds, getRawVideosByProjectId, type Clip, type ClipBuild } from '@/services/database';
import { getStoragePath } from '@/services/storage';
import { uploadPortfolioClip } from '@/services/clipperProfilesApi';

export type LibraryClip = Clip & { builds: ClipBuild[] };

/** Server-side limit for portfolio clip uploads. */
export const MAX_PORTFOLIO_CLIP_BYTES = 200 * 1024 * 1024;

export const formatMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** First output of a build (multi-aspect builds store a JSON list), else its file path. */
function buildOutputPath(build: ClipBuild): string | null {
  if (build.output_paths) {
    try {
      const paths = JSON.parse(build.output_paths);
      if (Array.isArray(paths) && paths.length > 0) return paths[0];
    } catch {
      // fall through to file_path
    }
  }
  return build.file_path || null;
}

function completedBuild(clip: LibraryClip): ClipBuild | undefined {
  return clip.builds?.find((b) => b.status === 'completed' && (b.output_paths || b.file_path));
}

/** Clips in the local library that have at least one finished build. */
export async function loadLibraryClips(): Promise<LibraryClip[]> {
  const clips = await getAllClipsWithBuilds();
  return clips.filter((clip) => clip.builds?.some((build) => build.status === 'completed' && build.file_path));
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    if (await invoke<boolean>('check_file_exists', { path })) {
      return await invoke<string>('read_file_as_data_url', { filePath: path });
    }
  } catch {
    // try the next source
  }
  return null;
}

/**
 * Thumbnail data URL for a library clip. Tries, in order: the build's
 * thumbnail, the clip's built thumbnail, `{video}_thumb.jpg` in the thumbnails
 * folder, then the project's raw video thumbnail.
 */
export async function loadLibraryClipThumbnail(clip: LibraryClip): Promise<string | null> {
  const build = completedBuild(clip);
  const outputPath = build && buildOutputPath(build);
  if (!build || !outputPath) return null;

  const sources: string[] = [];
  if (build.thumbnail_path) sources.push(build.thumbnail_path);
  if (clip.built_thumbnail_path) sources.push(clip.built_thumbnail_path);
  try {
    const base = await getStoragePath('thumbnails');
    const name = outputPath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || '';
    sources.push(`${base}/${name}_thumb.jpg`);
  } catch {
    // no thumbnails folder configured
  }

  for (const path of sources) {
    const dataUrl = await readIfExists(path);
    if (dataUrl) return dataUrl;
  }

  if (clip.project_id) {
    try {
      const [rawVideo] = await getRawVideosByProjectId(clip.project_id);
      if (rawVideo?.thumbnail_path) return await readIfExists(rawVideo.thumbnail_path);
    } catch {
      // no fallback available
    }
  }
  return null;
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, body] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'video/mp4';
  const bytes = atob(body);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  return new File([buffer], filename, { type: mime });
}

/** Reads a library clip's built video into a File, or null when it has no output. */
export async function libraryClipFile(clip: LibraryClip): Promise<File | null> {
  const build = completedBuild(clip);
  const filePath = build && buildOutputPath(build);
  if (!filePath) return null;
  const dataUrl = await invoke<string>('read_file_as_data_url', { filePath });
  return dataUrlToFile(dataUrl, `${clip.name || 'clip'}.mp4`);
}

/**
 * Poster frame (JPEG) for a video File. Plays briefly so the WebView decodes
 * a real frame before the canvas capture; resolves null on failure/timeout.
 */
export function generateVideoThumbnail(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    // Must be in the DOM and (barely) visible for the Tauri WebView to decode frames.
    video.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:320px;height:180px;opacity:0.01;pointer-events:none;';
    document.body.appendChild(video);

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.volume = 0;

    let done = false;
    const finish = (result: File | null) => {
      if (done) return;
      done = true;
      video.pause();
      URL.revokeObjectURL(objectUrl);
      video.remove();
      resolve(result);
    };

    const captureFrame = () => {
      try {
        const { videoWidth: w, videoHeight: h } = video;
        if (!w || !h) return finish(null);
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = Math.round(640 * (h / w));
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => finish(blob && blob.size >= 500 ? new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }) : null),
          'image/jpeg',
          0.85
        );
      } catch {
        finish(null);
      }
    };

    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    });
    video.addEventListener('seeked', () => {
      if (typeof video.requestVideoFrameCallback === 'function') {
        // Fires exactly when a decoded frame is painted.
        video.requestVideoFrameCallback(() => captureFrame());
        video.play().catch(() => {});
      } else {
        video
          .play()
          .then(() => setTimeout(() => (video.pause(), captureFrame()), 200))
          .catch(() => setTimeout(captureFrame, 300));
      }
    });
    video.addEventListener('error', () => finish(null));
    setTimeout(() => finish(null), 15000);
  });
}

/**
 * Uploads a video as a portfolio clip with a captured poster frame. Returns
 * the API response plus a local object URL of the poster (for immediate
 * display; the caller owns and revokes it).
 */
export async function uploadPortfolioVideo(file: File, title: string) {
  const thumbnail = await generateVideoThumbnail(file);
  const response = await uploadPortfolioClip(file, title, thumbnail ?? undefined);
  const localThumbnail = response.success && thumbnail ? URL.createObjectURL(thumbnail) : null;
  return { response, localThumbnail };
}
