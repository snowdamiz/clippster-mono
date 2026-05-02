/**
 * Preview "quality" controls media decode resolution (video CanvasSink, image resize),
 * not the layout canvas — buildScene always uses full project size so overlays stay aligned.
 */

export type PreviewQualityPreset = "auto" | 360 | 540 | 720 | 1080;

let projectWidth = 1920;
let projectHeight = 1080;
let quality: PreviewQualityPreset = "auto";
/** Bumps when settings change so image nodes can drop scaled bitmap caches. */
let generation = 0;

export function configurePreviewDecode(opts: {
	projectWidth: number;
	projectHeight: number;
	previewQuality: PreviewQualityPreset;
}): void {
	const nextW = Math.max(1, Math.round(opts.projectWidth));
	const nextH = Math.max(1, Math.round(opts.projectHeight));
	const changed =
		nextW !== projectWidth ||
		nextH !== projectHeight ||
		opts.previewQuality !== quality;
	projectWidth = nextW;
	projectHeight = nextH;
	quality = opts.previewQuality;
	if (changed) generation++;
}

export function getPreviewDecodeGeneration(): number {
	return generation;
}

/**
 * Target pixel box for decoding video frames (CanvasSink) and downscaling still images.
 * Same aspect ratio as the project canvas; smaller when a fixed quality preset is below project size.
 */
export function getPreviewDecodeSinkSize(): { width: number; height: number } {
	const targetHeight = quality === "auto"
		? Math.min(projectHeight, 720)
		: quality;
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
	fullHeight = projectHeight,
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
	source: HTMLImageElement | HTMLCanvasElement,
): Promise<CanvasImageSource> {
	const { width: boxW, height: boxH } = getPreviewDecodeSinkSize();
	const mediaW = "naturalWidth" in source ? source.naturalWidth : source.width;
	const mediaH = "naturalHeight" in source ? source.naturalHeight : source.height;
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
