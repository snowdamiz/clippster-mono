/**
 * "Use 16:9" background blur: slider 0–30 vs actual filter strength.
 * Raw slider values were applied as `blur(Npx)`, which looked much weaker than the Creator
 * settings preview (small panel + perception) and than FFmpeg export; map slider → CSS px here
 * and keep Rust `gblur` sigma in sync (see video_processor use16x9 branch).
 */
export const USE169_BLUR_SLIDER_TO_CSS_PX = 2.15;

export function use169BlurSliderToCssPx(blurAmount: number): number {
  if (!blurAmount || blurAmount <= 0) return 0;
  return Math.round(blurAmount * USE169_BLUR_SLIDER_TO_CSS_PX * 100) / 100;
}

/**
 * Creator / POI output preview is small; same CSS px is a larger fraction of the frame than
 * in the workspace player. Scale down so the modal matches full-player blur at the same slider.
 */
export function scaleUse169BlurForPoiPreview(cssPx: number, minSidePx: number, refMinSidePx = 560): number {
  if (cssPx <= 0) return 0;
  if (minSidePx <= 0) return cssPx;
  const f = Math.max(0.18, Math.min(1, minSidePx / refMinSidePx));
  return Math.round(cssPx * f * 100) / 100;
}
