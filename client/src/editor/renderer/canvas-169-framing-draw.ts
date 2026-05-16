import type { ManualSourceFramingPayload } from "@/types";
import type { CropRect } from "../types/timeline";
import { use169BlurSliderToCssPx } from "@/utils/use169Blur";

const TARGET_169 = 16 / 9;

/** Slight zoom on blurred cover (matches POI `scale-[1.08]`) so blur does not reveal letterbox black. */
const COVER_BLEED = 1.08;

function blurPxFromSlider(amount: number, cw: number, ch: number): number {
	const raw = use169BlurSliderToCssPx(amount);
	const minSide = Math.min(cw, ch);
	const f = Math.max(0.35, Math.min(1, minSide / 720));
	return Math.round(raw * f * 100) / 100;
}

/** Max 16:9 plate inside canvas, then scale + offset (Manual POI geometry). */
function computePlateFrameRect(
	cw: number,
	ch: number,
	scale: number,
	normX: number,
	normY: number,
	plateAspect: number,
): { left: number; top: number; width: number; height: number } {
	const ar = cw / ch;
	let baseW: number;
	let baseH: number;
	if (ar > plateAspect) {
		baseH = ch;
		baseW = ch * plateAspect;
	} else {
		baseW = cw;
		baseH = cw / plateAspect;
	}
	const width = baseW * scale;
	const height = baseH * scale;
	const dx = normX * cw;
	const dy = normY * ch;
	const left = (cw - width) / 2 + dx;
	const top = (ch - height) / 2 + dy;
	return { left, top, width, height };
}

/** Logical plate rect in canvas pixels (same math as draw). */
export function getPlateRectLogical(
	cw: number,
	ch: number,
	framing: ManualSourceFramingPayload,
): { left: number; top: number; width: number; height: number } | null {
	if (framing.mode !== "use16x9") return null;
	return computePlateFrameRect(cw, ch, framing.scale, framing.x, framing.y, TARGET_169);
}

function source169CropPixels(
	mediaW: number,
	mediaH: number,
	crop: CropRect | undefined,
): { sx: number; sy: number; sw: number; sh: number } {
	const sourceAr = mediaW / mediaH;
	let sx = 0;
	let sy = 0;
	let sw = mediaW;
	let sh = mediaH;

	if (sourceAr > TARGET_169) {
		sw = mediaH * TARGET_169;
		sx = (mediaW - sw) / 2;
	} else if (sourceAr < TARGET_169) {
		sh = mediaW / TARGET_169;
		sy = (mediaH - sh) / 2;
	}

	const c = crop ?? { top: 0, right: 0, bottom: 0, left: 0 };
	return {
		sx: sx + c.left * sw,
		sy: sy + c.top * sh,
		sw: sw * (1 - c.left - c.right),
		sh: sh * (1 - c.top - c.bottom),
	};
}

function drawContainInRect(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	source: CanvasImageSource,
	mediaW: number,
	mediaH: number,
	crop: CropRect | undefined,
	rect: { left: number; top: number; width: number; height: number },
): void {
	const { sx, sy, sw, sh } = source169CropPixels(mediaW, mediaH, crop);
	const scale = Math.min(rect.width / sw, rect.height / sh);
	const dw = sw * scale;
	const dh = sh * scale;
	const dx = rect.left + (rect.width - dw) / 2;
	const dy = rect.top + (rect.height - dh) / 2;
	ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawCoverFullCanvas(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	source: CanvasImageSource,
	mediaW: number,
	mediaH: number,
	cw: number,
	ch: number,
	crop: CropRect | undefined,
	bleed = 1,
): void {
	const { sx, sy, sw, sh } = source169CropPixels(mediaW, mediaH, crop);
	const scale = Math.max(cw / sw, ch / sh) * bleed;
	const dw = sw * scale;
	const dh = sh * scale;
	const dx = (cw - dw) / 2;
	const dy = (ch - dh) / 2;
	ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
}

/**
 * Draw video/image with Use 16:9 framing (POI-style plate + blur).
 * Sharp plate is always 16:9 in canvas space (same as Manual POI).
 */
export function drawCanvas169SourceFraming(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	drawSource: CanvasImageSource,
	mediaW: number,
	mediaH: number,
	cw: number,
	ch: number,
	framing: ManualSourceFramingPayload,
	crop: CropRect | undefined,
): void {
	if (framing.mode !== "use16x9") return;

	const rect = computePlateFrameRect(cw, ch, framing.scale, framing.x, framing.y, TARGET_169);

	const prevFilter = ctx.filter;
	const blurPx =
		framing.blurEnabled && framing.blurAmount > 0
			? blurPxFromSlider(framing.blurAmount, cw, ch)
			: 0;
	const bgParts = [prevFilter && prevFilter !== "none" ? prevFilter : "", blurPx > 0 ? `blur(${blurPx}px)` : ""].filter(
		Boolean,
	);
	ctx.filter = bgParts.length > 0 ? bgParts.join(" ") : "none";
	drawCoverFullCanvas(ctx, drawSource, mediaW, mediaH, cw, ch, crop, COVER_BLEED);
	ctx.filter = prevFilter;
	drawContainInRect(ctx, drawSource, mediaW, mediaH, crop, rect);
}
