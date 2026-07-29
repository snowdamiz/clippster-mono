/**
 * Preview "quality" controls media decode resolution (video CanvasSink, image resize),
 * not the layout canvas — buildScene always uses full project size so overlays stay aligned.
 */

export type PreviewQualityPreset = 'auto' | 360 | 540 | 720 | 1080;
export type AutoPreviewQuality = 360 | 540 | 720;

const AUTO_QUALITY_STEPS: readonly AutoPreviewQuality[] = [360, 540, 720];

let projectWidth = 1920;
let projectHeight = 1080;
let quality: PreviewQualityPreset = 'auto';
let autoQualityHeight: AutoPreviewQuality = getInitialAutoPreviewQuality();
let decodeSinkSizeOverride: { width: number; height: number } | null = null;
/** Bumps when settings change so image nodes can drop scaled bitmap caches. */
let generation = 0;

export function getInitialAutoPreviewQuality(
  hardwareConcurrency = typeof navigator === 'undefined' ? 8 : navigator.hardwareConcurrency
): AutoPreviewQuality {
  return hardwareConcurrency <= 2 ? 360 : 720;
}

/**
 * Stateful frame-cost budget used only by Auto quality. It requires sustained
 * pressure to step down and a longer stable period to step back up.
 */
export class AdaptivePreviewQualityController {
  private overBudgetFrames = 0;
  private underBudgetFrames = 0;

  constructor(public height: AutoPreviewQuality = getInitialAutoPreviewQuality()) {}

  recordFrame(frameCostMs: number, frameBudgetMs: number): AutoPreviewQuality | null {
    if (!Number.isFinite(frameCostMs) || !Number.isFinite(frameBudgetMs) || frameBudgetMs <= 0) {
      return null;
    }

    if (frameCostMs > frameBudgetMs * 0.85) {
      this.overBudgetFrames++;
      this.underBudgetFrames = 0;
    } else if (frameCostMs < frameBudgetMs * 0.45) {
      this.underBudgetFrames++;
      this.overBudgetFrames = 0;
    } else {
      this.overBudgetFrames = 0;
      this.underBudgetFrames = 0;
    }

    const index = AUTO_QUALITY_STEPS.indexOf(this.height);
    if (this.overBudgetFrames >= 8 && index > 0) {
      this.height = AUTO_QUALITY_STEPS[index - 1]!;
      this.resetSamples();
      return this.height;
    }
    if (this.underBudgetFrames >= 90 && index < AUTO_QUALITY_STEPS.length - 1) {
      this.height = AUTO_QUALITY_STEPS[index + 1]!;
      this.resetSamples();
      return this.height;
    }
    return null;
  }

  private resetSamples(): void {
    this.overBudgetFrames = 0;
    this.underBudgetFrames = 0;
  }
}

export function configurePreviewDecode(opts: {
  projectWidth: number;
  projectHeight: number;
  previewQuality: PreviewQualityPreset;
  autoQualityHeight?: AutoPreviewQuality;
}): void {
  const nextW = Math.max(1, Math.round(opts.projectWidth));
  const nextH = Math.max(1, Math.round(opts.projectHeight));
  const nextAutoQuality = opts.autoQualityHeight ?? autoQualityHeight;
  const changed =
    nextW !== projectWidth ||
    nextH !== projectHeight ||
    opts.previewQuality !== quality ||
    nextAutoQuality !== autoQualityHeight;
  projectWidth = nextW;
  projectHeight = nextH;
  quality = opts.previewQuality;
  autoQualityHeight = nextAutoQuality;
  if (changed) generation++;
}

export function getPreviewDecodeGeneration(): number {
  return generation;
}

export function setPreviewDecodeSinkSizeOverride(
  size: { width: number; height: number } | null
): void {
  decodeSinkSizeOverride = size
    ? {
        width: Math.max(1, Math.round(size.width)),
        height: Math.max(1, Math.round(size.height)),
      }
    : null;
  generation++;
}

/**
 * Target pixel box for decoding video frames (CanvasSink) and downscaling still images.
 * Same aspect ratio as the project canvas; smaller when a fixed quality preset is below project size.
 */
export function getPreviewDecodeSinkSize(): { width: number; height: number } {
  if (decodeSinkSizeOverride) return decodeSinkSizeOverride;
  const targetHeight = quality === 'auto' ? Math.min(projectHeight, autoQualityHeight) : quality;
  const scale = Math.min(1, targetHeight / projectHeight);
  return {
    width: Math.max(1, Math.round(projectWidth * scale)),
    height: Math.max(1, Math.round(projectHeight * scale)),
  };
}

/**
 * Target pixel box for expensive CPU post-processing in the interactive preview.
 * Auto intentionally caps heavy pixel effects lower than layout size; export renderers
 * do not opt into this preview path, so exports still process at full resolution.
 */
export function getPreviewEffectProcessingSize(
  fullWidth = projectWidth,
  fullHeight = projectHeight
): { width: number; height: number } {
  const safeW = Math.max(1, Math.round(fullWidth));
  const safeH = Math.max(1, Math.round(fullHeight));
  const decode = getPreviewDecodeSinkSize();
  const targetH = Math.min(safeH, decode.height, 720);
  const scale = Math.min(1, targetH / safeH);
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

/**
 * Downscale a loaded bitmap to fit inside the same decode box as video (contain), then
 * callers draw it scaled up to the full layout canvas. Returns original if already at/past target.
 */
export async function createPreviewScaledImageBitmap(
  source: HTMLImageElement | HTMLCanvasElement
): Promise<CanvasImageSource> {
  const { width: boxW, height: boxH } = getPreviewDecodeSinkSize();
  const mediaW = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const mediaH = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (mediaW <= 0 || mediaH <= 0) return source;

  const contain = Math.min(boxW / mediaW, boxH / mediaH, 1);
  if (contain >= 1 - 1e-6) return source;

  const rw = Math.max(1, Math.round(mediaW * contain));
  const rh = Math.max(1, Math.round(mediaH * contain));
  try {
    return await createImageBitmap(source, {
      resizeWidth: rw,
      resizeHeight: rh,
    });
  } catch {
    return source;
  }
}
