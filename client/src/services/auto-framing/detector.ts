import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import simdLoader from '@mediapipe-wasm/vision_wasm_internal.js?url';
import simdBinary from '@mediapipe-wasm/vision_wasm_internal.wasm?url';
import scalarLoader from '@mediapipe-wasm/vision_wasm_nosimd_internal.js?url';
import scalarBinary from '@mediapipe-wasm/vision_wasm_nosimd_internal.wasm?url';
import model from './blaze_face_short_range.tflite?url';
import { openAnalysisVideo } from './video';
import type { FramingSample } from './planner';

/** All model/runtime URLs are Vite assets packaged with the desktop app. */
export async function analyzeLocalFaces(
  url: string,
  start: number,
  end: number,
  signal: AbortSignal,
  progress: (value: number) => void,
  cuts: number[] = []
) {
  if (!(end > start && start >= 0) || end - start > 1800)
    throw new Error('Auto framing supports clips up to 30 minutes. Trim the clip first.');
  const simd = await FilesetResolver.isSimdSupported();
  signal.throwIfAborted();
  const detector = await FaceDetector.createFromOptions(
    {
      wasmLoaderPath: simd ? simdLoader : scalarLoader,
      wasmBinaryPath: simd ? simdBinary : scalarBinary,
    },
    {
      baseOptions: { modelAssetPath: model, delegate: 'CPU' },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.6,
    }
  );
  let media: Awaited<ReturnType<typeof openAnalysisVideo>> | undefined;
  try {
    signal.throwIfAborted();
    media = await openAnalysisVideo(url, signal);
    const { video } = media;
    if (Number.isFinite(video.duration) && end > video.duration + 0.15)
      throw new Error(
        'The preview video is shorter than the clip. Reopen the clip before framing.'
      );
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = Math.max(2, Math.round((640 * video.videoHeight) / video.videoWidth));
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const thumb = document.createElement('canvas');
    thumb.width = 32;
    thumb.height = 18;
    const thumbCtx = thumb.getContext('2d', { willReadFrequently: true })!;
    let previous: Uint8ClampedArray | undefined;
    const samples: FramingSample[] = [];
    const count = Math.ceil((end - start) / 0.4);
    const times = [
      ...new Set([
        ...Array.from({ length: count + 1 }, (_, i) =>
          Math.max(0, Math.min(i * 0.4, end - start - 0.001))
        ),
        ...cuts.filter((t) => t > 0 && t < end - start),
      ]),
    ].sort((a, b) => a - b);
    for (let i = 0; i < times.length; i++) {
      signal.throwIfAborted();
      const relative = times[i];
      await media.seek(start + Math.max(0, relative));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      thumbCtx.drawImage(canvas, 0, 0, 32, 18);
      const pixels = thumbCtx.getImageData(0, 0, 32, 18).data;
      let difference = 0;
      if (previous)
        for (let p = 0; p < pixels.length; p += 4) {
          difference +=
            (Math.abs(pixels[p] - previous[p]) +
              Math.abs(pixels[p + 1] - previous[p + 1]) +
              Math.abs(pixels[p + 2] - previous[p + 2])) /
            3;
        }
      const detections = detector.detect(canvas).detections;
      samples.push({
        time: Math.max(0, relative),
        cut: i === 0 || cuts.includes(relative) || difference / (32 * 18 * 255) > 0.28,
        faces: detections.flatMap((d) =>
          d.boundingBox
            ? [
                {
                  x: d.boundingBox.originX / canvas.width,
                  y: d.boundingBox.originY / canvas.height,
                  width: d.boundingBox.width / canvas.width,
                  height: d.boundingBox.height / canvas.height,
                  score: d.categories[0]?.score ?? 0,
                },
              ]
            : []
        ),
      });
      previous = pixels;
      progress(Math.round(((i + 1) / times.length) * 100));
      // Release the UI between inference calls so cancellation and progress stay responsive.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return { samples, width: video.videoWidth, height: video.videoHeight };
  } finally {
    media?.close();
    detector.close();
  }
}
