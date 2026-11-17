import { join, videoDir } from '@tauri-apps/api/path';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { CREATOR_SKILL_THUMBNAIL_SIZE, drawCreatorSkillThumbnail } from './creatorSkillThumbnail';
import { creatorSkillFrameSharpness, creatorSkillThumbnailFaceScore, selectCreatorSkillThumbnailStills } from './creatorSkillThumbnailSelection';
import { createLocalFaceDetector, createLocalPortraitSegmenter } from './auto-framing/detector';
import type { ImageSegmenter } from '@mediapipe/tasks-vision';

export async function selectCreatorSkillSourceStills(stills: Array<{ path: string; sourceTime: number; index: number }>): Promise<{ stills: Array<{ path: string; sourceTime: number }>; faceDetectionAvailable: boolean; faceFrames: number }> {
  const detector = stills.length ? await createLocalFaceDetector().catch(() => null) : null;
  let detectionFailed = false;
  let faceFrames = 0;
  try {
  const scored = [];
  for (const still of stills) {
    try {
      const bytes = await readFile(still.path);
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }));
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 72;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) { scored.push({ ...still, score: 0 }); continue; }
        context.drawImage(bitmap, 0, 0, 128, 72);
        const sharpness = creatorSkillFrameSharpness(context.getImageData(0, 0, 128, 72).data, 128, 72);
        let faces: Array<{ width: number; height: number; score: number; keypoints: Array<{ x: number; y: number }> }> = [];
        if (detector) {
          const faceCanvas = document.createElement('canvas');
          faceCanvas.width = 640;
          faceCanvas.height = Math.max(2, Math.round(640 * bitmap.height / bitmap.width));
          faceCanvas.getContext('2d')?.drawImage(bitmap, 0, 0, faceCanvas.width, faceCanvas.height);
          try {
            faces = detector.detect(faceCanvas).detections.flatMap(detection => detection.boundingBox ? [{
              width: detection.boundingBox.width / faceCanvas.width,
              height: detection.boundingBox.height / faceCanvas.height,
              score: detection.categories[0]?.score ?? 0,
              keypoints: detection.keypoints.map(point => ({ x: point.x, y: point.y })),
            }] : []);
          } catch { detectionFailed = true; }
          if (faces.length) faceFrames++;
        }
        scored.push({ ...still, score: creatorSkillThumbnailFaceScore(sharpness, faces) });
      } finally { bitmap.close(); }
    } catch { scored.push({ ...still, score: 0 }); }
  }
  return { stills: selectCreatorSkillThumbnailStills(scored), faceDetectionAvailable: !!detector && !detectionFailed, faceFrames };
  } finally { detector?.close(); }
}

function cutoutPortrait(bitmap: ImageBitmap, segmenter: ImageSegmenter): HTMLCanvasElement {
  const result = segmenter.segment(bitmap);
  try {
    const masks = result.confidenceMasks;
    const mask = masks?.[masks.length - 1];
    if (!mask) throw new Error('Portrait model returned no person mask.');
    const confidence = mask.getAsFloat32Array();
    let foreground = 0;
    for (const value of confidence) if (value > 0.5) foreground++;
    if (foreground < confidence.length * 0.05 || foreground > confidence.length * 0.95) throw new Error('Portrait mask did not separate the subject from the background.');
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = mask.width;
    maskCanvas.height = mask.height;
    const maskContext = maskCanvas.getContext('2d');
    if (!maskContext) throw new Error('Portrait mask canvas is unavailable.');
    const maskPixels = maskContext.createImageData(mask.width, mask.height);
    for (let index = 0; index < confidence.length; index++) {
      maskPixels.data[index * 4] = maskPixels.data[index * 4 + 1] = maskPixels.data[index * 4 + 2] = 255;
      maskPixels.data[index * 4 + 3] = Math.max(0, Math.min(255, Math.round(confidence[index] * 255)));
    }
    maskContext.putImageData(maskPixels, 0, 0);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Portrait canvas is unavailable.');
    context.drawImage(bitmap, 0, 0);
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { result.close(); }
}

/** Rasterize review drafts from source VOD stills without a paid image service. */
export async function renderCreatorSkillThumbnailDrafts(
  clipId: string,
  stills: Array<{ path: string; sourceTime: number }>,
  headlines: string[],
  logoPath?: string,
  brandColors: string[] = [],
): Promise<{ variants: Array<{ path: string; index: number; headline: string }>; cutoutCount: number; modelAvailable: boolean }> {
  if (!stills.length || !headlines.length) return { variants: [], cutoutCount: 0, modelAvailable: false };
  const logoBytes = logoPath ? await readFile(logoPath).catch(() => null) : null;
  const logo = logoBytes ? await createImageBitmap(new Blob([new Uint8Array(logoBytes)], { type: 'image/png' })).catch(() => null) : null;
  const segmenter = await createLocalPortraitSegmenter().catch(() => null);
  try {
  const drafts = await Promise.allSettled(Array.from({ length: 4 }, async (_, index) => {
    const still = stills[index % stills.length];
    const bytes = await readFile(still.path);
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }));
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CREATOR_SKILL_THUMBNAIL_SIZE.width;
      canvas.height = CREATOR_SKILL_THUMBNAIL_SIZE.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Thumbnail canvas is unavailable.');
      const headline = headlines[index % headlines.length];
      const portrait = segmenter ? (() => { try { return cutoutPortrait(bitmap, segmenter); } catch { return null; } })() : null;
      drawCreatorSkillThumbnail(context, bitmap, bitmap, headline, index, logo ? { image: logo, width: logo.width, height: logo.height } : undefined, brandColors, portrait ?? undefined);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not encode thumbnail draft.')), 'image/png'));
      const path = await join(await videoDir(), `creator-skill-${clipId}-thumbnail-${index}.png`);
      await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
      return { path, index, headline, hasCutout: !!portrait };
    } finally { bitmap.close(); }
  }));
  const completed = drafts.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  return { variants: completed.map(({ hasCutout: _hasCutout, ...variant }) => variant), cutoutCount: completed.filter(variant => variant.hasCutout).length, modelAvailable: !!segmenter };
  } finally { logo?.close(); segmenter?.close(); }
}
