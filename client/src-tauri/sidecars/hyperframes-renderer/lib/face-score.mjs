import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { runCli } from './cli.mjs';

const require = createRequire(import.meta.url);
const visionDir = dirname(require.resolve('@mediapipe/tasks-vision'));
const modelPath = fileURLToPath(new URL('./blaze_face_short_range.tflite', import.meta.url));
const portraitModelPath = fileURLToPath(new URL('./selfie_segmenter.tflite', import.meta.url));

async function withVisionPage(paths, signal, work) {
  if (!Array.isArray(paths) || paths.length > 24 || paths.some(path => typeof path !== 'string')) throw new Error('Invalid thumbnail paths');
  signal?.throwIfAborted();
  const browserPath = await runCli(['browser', 'path'], { signal });
  if (browserPath.code !== 0) throw new Error('The local rendering browser is unavailable');
  const executablePath = browserPath.stdout.trim().split(/\r?\n/).pop();
  const assets = new Map([
    ['/vision_bundle.mjs', [join(visionDir, 'vision_bundle.mjs'), 'text/javascript']],
    ['/wasm/vision_wasm_internal.js', [join(visionDir, 'wasm', 'vision_wasm_internal.js'), 'text/javascript']],
    ['/wasm/vision_wasm_internal.wasm', [join(visionDir, 'wasm', 'vision_wasm_internal.wasm'), 'application/wasm']],
    ['/wasm/vision_wasm_nosimd_internal.js', [join(visionDir, 'wasm', 'vision_wasm_nosimd_internal.js'), 'text/javascript']],
    ['/wasm/vision_wasm_nosimd_internal.wasm', [join(visionDir, 'wasm', 'vision_wasm_nosimd_internal.wasm'), 'application/wasm']],
    ['/model.tflite', [modelPath, 'application/octet-stream']],
    ['/portrait.tflite', [portraitModelPath, 'application/octet-stream']],
    ...paths.map((path, index) => [`/frame/${index}.jpg`, [path, 'image/jpeg']]),
  ]);
  const server = createServer(async (request, response) => {
    if (request.url === '/') { response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Local thumbnail analysis</title>'); return; }
    const asset = assets.get(request.url);
    if (!asset) { response.writeHead(404).end(); return; }
    try {
      response.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store' });
      response.end(await readFile(asset[0]));
    } catch { if (!response.headersSent) response.writeHead(500); response.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const timeout = setTimeout(() => { void browser?.close(); }, 30_000);
    const closeOnAbort = () => { void browser?.close(); };
    signal?.addEventListener('abort', closeOnAbort, { once: true });
    try {
      const page = await browser.newPage();
      const origin = `http://127.0.0.1:${server.address().port}`;
      await page.goto(origin);
      return await work(page, origin);
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', closeOnAbort); }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

/** Scores local stills in the same Chromium runtime used by the video renderer. */
export async function detectFaces({ paths }, { signal } = {}) {
  return withVisionPage(paths, signal, (page, origin) => page.evaluate(async (origin, count) => {
        const { FaceDetector, FilesetResolver } = await import(origin + '/vision_bundle.mjs');
        const fileset = await FilesetResolver.forVisionTasks(origin + '/wasm');
        const detector = await FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: origin + '/model.tflite', delegate: 'CPU' },
          runningMode: 'IMAGE', minDetectionConfidence: 0.5,
        });
        try {
          const result = [];
          for (let index = 0; index < count; index++) {
            const image = new Image();
            image.src = `${origin}/frame/${index}.jpg`;
            await image.decode();
            result.push(detector.detect(image).detections.flatMap(detection => detection.boundingBox ? [{
              width: detection.boundingBox.width / image.naturalWidth,
              height: detection.boundingBox.height / image.naturalHeight,
              score: detection.categories[0]?.score ?? 0,
              keypoints: detection.keypoints.map(point => ({ x: point.x, y: point.y, label: point.label })),
            }] : []));
          }
          return result;
        } finally { detector.close(); }
  }, origin, paths.length));
}

/** Remove only the background from a same-day VOD still; keep the RGB portrait untouched. */
export async function cutoutPortrait({ path, destination }, { signal } = {}) {
  if (typeof path !== 'string' || typeof destination !== 'string') throw new Error('Invalid portrait paths');
  const cutout = await withVisionPage([path], signal, (page, origin) => page.evaluate(async origin => {
    const { ImageSegmenter, FilesetResolver } = await import(origin + '/vision_bundle.mjs');
    const fileset = await FilesetResolver.forVisionTasks(origin + '/wasm');
    const segmenter = await ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: origin + '/portrait.tflite', delegate: 'CPU' },
      runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true,
    });
    try {
      const image = new Image();
      image.src = origin + '/frame/0.jpg';
      await image.decode();
      const result = segmenter.segment(image);
      try {
        const mask = result.confidenceMasks?.at(-1);
        if (!mask) throw new Error('The local portrait model did not return a person mask');
        const confidence = mask.getAsFloat32Array();
        let foreground = 0;
        for (const value of confidence) if (value > 0.5) foreground++;
        if (foreground < confidence.length * 0.05 || foreground > confidence.length * 0.95) throw new Error('The local portrait mask did not separate the subject from the background');
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = mask.width;
        maskCanvas.height = mask.height;
        const maskContext = maskCanvas.getContext('2d');
        const maskPixels = maskContext.createImageData(mask.width, mask.height);
        for (let index = 0; index < confidence.length; index++) {
          const alpha = Math.max(0, Math.min(255, Math.round(confidence[index] * 255)));
          maskPixels.data[index * 4] = maskPixels.data[index * 4 + 1] = maskPixels.data[index * 4 + 2] = 255;
          maskPixels.data[index * 4 + 3] = alpha;
        }
        maskContext.putImageData(maskPixels, 0, 0);
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        context.globalCompositeOperation = 'destination-in';
        context.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let transparentPixels = 0;
        let opaquePixels = 0;
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] < 32) transparentPixels++;
          if (pixels[index] > 224) opaquePixels++;
        }
        if (!transparentPixels || !opaquePixels) throw new Error('The portrait cutout did not contain both subject and transparent background');
        return { encoded: canvas.toDataURL('image/png').split(',')[1], foregroundFraction: foreground / confidence.length, transparentPixels, opaquePixels };
      } finally { result.close(); }
    } finally { segmenter.close(); }
  }, origin));
  const bytes = Buffer.from(cutout.encoded, 'base64');
  if (bytes.length < 1000) throw new Error('The local portrait cutout is empty');
  await writeFile(destination, bytes);
  return { destination, foregroundFraction: cutout.foregroundFraction, transparentPixels: cutout.transparentPixels, opaquePixels: cutout.opaquePixels };
}
