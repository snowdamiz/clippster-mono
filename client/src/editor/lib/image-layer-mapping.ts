/**
 * Maps canvas-space paint onto an image layer's native pixels.
 * Must stay in sync with ImageNode contain/cover + crop + transform + flip.
 */
import type { CropRect, FlipState, MediaFitMode, Transform } from "../types/timeline";
import type { PixelSelection } from "../types/image-document";

export type ImageDrawLayout = {
	canvasW: number;
	canvasH: number;
	nativeW: number;
	nativeH: number;
	sx: number;
	sy: number;
	sw: number;
	sh: number;
	dx: number;
	dy: number;
	dw: number;
	dh: number;
	transform: Transform;
	flip: FlipState;
};

const IDENTITY_TRANSFORM: Transform = { scale: 1, position: { x: 0, y: 0 }, rotate: 0 };
const IDENTITY_FLIP: FlipState = { horizontal: false, vertical: false };

export function parseHexRgb(color: string): { r: number; g: number; b: number } {
	let hex = color.trim().replace("#", "");
	if (hex.length === 3) {
		hex = hex
			.split("")
			.map((c) => c + c)
			.join("");
	}
	if (hex.length < 6) return { r: 255, g: 255, b: 255 };
	return {
		r: Number.parseInt(hex.slice(0, 2), 16) || 0,
		g: Number.parseInt(hex.slice(2, 4), 16) || 0,
		b: Number.parseInt(hex.slice(4, 6), 16) || 0,
	};
}

export function getImageDrawLayout({
	canvasW,
	canvasH,
	nativeW,
	nativeH,
	crop,
	mediaFit,
	transform,
	flip,
}: {
	canvasW: number;
	canvasH: number;
	nativeW: number;
	nativeH: number;
	crop?: CropRect;
	mediaFit?: MediaFitMode;
	transform?: Transform;
	flip?: FlipState;
}): ImageDrawLayout {
	const hasCrop = !!(crop && (crop.top > 0 || crop.right > 0 || crop.bottom > 0 || crop.left > 0));
	const sx = hasCrop ? crop!.left * nativeW : 0;
	const sy = hasCrop ? crop!.top * nativeH : 0;
	const sw = hasCrop ? nativeW * (1 - crop!.left - crop!.right) : nativeW;
	const sh = hasCrop ? nativeH * (1 - crop!.top - crop!.bottom) : nativeH;
	const fit = mediaFit ?? "contain";
	const fitScale =
		fit === "cover"
			? Math.max(canvasW / Math.max(sw, 1e-6), canvasH / Math.max(sh, 1e-6))
			: Math.min(canvasW / Math.max(sw, 1e-6), canvasH / Math.max(sh, 1e-6));
	const dw = sw * fitScale;
	const dh = sh * fitScale;
	return {
		canvasW,
		canvasH,
		nativeW,
		nativeH,
		sx,
		sy,
		sw,
		sh,
		dx: (canvasW - dw) / 2,
		dy: (canvasH - dh) / 2,
		dw,
		dh,
		transform: transform ?? IDENTITY_TRANSFORM,
		flip: flip ?? IDENTITY_FLIP,
	};
}

export function canvasPointToImagePixel(
	layout: ImageDrawLayout,
	canvasX: number,
	canvasY: number,
): { x: number; y: number } {
	const { canvasW, canvasH, transform, flip } = layout;
	const px = transform.position.x;
	const py = transform.position.y;
	const scale = Number.isFinite(transform.scale) && transform.scale !== 0 ? transform.scale : 1;
	const rot = (transform.rotate * Math.PI) / 180;

	let x = canvasX - (canvasW / 2 + px);
	let y = canvasY - (canvasH / 2 + py);
	const cos = Math.cos(-rot);
	const sin = Math.sin(-rot);
	const rx = x * cos - y * sin;
	const ry = x * sin + y * cos;
	x = rx / scale;
	y = ry / scale;
	if (flip.horizontal) x = -x;
	if (flip.vertical) y = -y;
	x += canvasW / 2;
	y += canvasH / 2;

	const ix = ((x - layout.dx) / Math.max(layout.dw, 1e-6)) * layout.sw + layout.sx;
	const iy = ((y - layout.dy) / Math.max(layout.dh, 1e-6)) * layout.sh + layout.sy;
	return { x: ix, y: iy };
}

/** Inverse of canvasPointToImagePixel. */
export function imagePixelToCanvasPoint(
	layout: ImageDrawLayout,
	imageX: number,
	imageY: number,
): { x: number; y: number } {
	const { canvasW, canvasH, transform, flip } = layout;
	const scale = Number.isFinite(transform.scale) && transform.scale !== 0 ? transform.scale : 1;
	const rot = (transform.rotate * Math.PI) / 180;

	let x = ((imageX - layout.sx) / Math.max(layout.sw, 1e-6)) * layout.dw + layout.dx;
	let y = ((imageY - layout.sy) / Math.max(layout.sh, 1e-6)) * layout.dh + layout.dy;
	x -= canvasW / 2;
	y -= canvasH / 2;
	if (flip.horizontal) x = -x;
	if (flip.vertical) y = -y;
	x *= scale;
	y *= scale;
	const cos = Math.cos(rot);
	const sin = Math.sin(rot);
	const rx = x * cos - y * sin;
	const ry = x * sin + y * cos;
	return {
		x: rx + canvasW / 2 + transform.position.x,
		y: ry + canvasH / 2 + transform.position.y,
	};
}

/**
 * Sets the destination CTM so drawing a canvas-sized image lands on native pixels.
 */
/** Forward ImageNode transform: native/contain-fit coords → canvas. */
export function applyImageToCanvasTransform(
	ctx: CanvasRenderingContext2D,
	layout: ImageDrawLayout,
): void {
	const { canvasW, canvasH, transform, flip } = layout;
	const scale = Number.isFinite(transform.scale) && transform.scale !== 0 ? transform.scale : 1;
	ctx.translate(canvasW / 2 + transform.position.x, canvasH / 2 + transform.position.y);
	ctx.rotate((transform.rotate * Math.PI) / 180);
	ctx.scale(scale, scale);
	ctx.translate(-canvasW / 2, -canvasH / 2);
	if (flip.horizontal || flip.vertical) {
		ctx.translate(canvasW / 2, canvasH / 2);
		ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
		ctx.translate(-canvasW / 2, -canvasH / 2);
	}
}

export function applyCanvasToImageTransform(
	ctx: CanvasRenderingContext2D,
	layout: ImageDrawLayout,
): void {
	const { canvasW, canvasH, transform, flip } = layout;
	const scale = Number.isFinite(transform.scale) && transform.scale !== 0 ? transform.scale : 1;

	ctx.translate(layout.sx, layout.sy);
	ctx.scale(layout.sw / Math.max(layout.dw, 1e-6), layout.sh / Math.max(layout.dh, 1e-6));
	ctx.translate(-layout.dx, -layout.dy);

	ctx.translate(canvasW / 2, canvasH / 2);
	if (flip.horizontal || flip.vertical) {
		ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
	}
	ctx.scale(1 / scale, 1 / scale);
	ctx.rotate((-transform.rotate * Math.PI) / 180);
	ctx.translate(-(canvasW / 2 + transform.position.x), -(canvasH / 2 + transform.position.y));
}

export function pointsBounds(
	points: Array<{ x: number; y: number }>,
): { x: number; y: number; width: number; height: number } | null {
	if (points.length === 0) return null;
	let minX = points[0].x;
	let minY = points[0].y;
	let maxX = points[0].x;
	let maxY = points[0].y;
	for (const p of points) {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	}
	return {
		x: minX,
		y: minY,
		width: Math.max(maxX - minX, 1e-6),
		height: Math.max(maxY - minY, 1e-6),
	};
}

export function selectionBoundingBox(
	points: Array<{ x: number; y: number }>,
): { x: number; y: number; width: number; height: number } | null {
	if (points.length < 3) return null;
	const box = pointsBounds(points);
	if (!box || box.width < 0.002 || box.height < 0.002) return null;
	return box;
}

function addSelectionRing(
	ctx: CanvasRenderingContext2D,
	ring: Array<{ x: number; y: number }>,
	width: number,
	height: number,
) {
	if (ring.length < 3) return;
	const [first, ...rest] = ring;
	ctx.moveTo(first.x * width, first.y * height);
	for (const p of rest) ctx.lineTo(p.x * width, p.y * height);
	ctx.closePath();
}

export function clipSelectionToContext(
	ctx: CanvasRenderingContext2D,
	selection: Pick<PixelSelection, "x" | "y" | "width" | "height" | "type" | "points" | "rings"> | null,
	width: number,
	height: number,
	type: PixelSelection["type"] = selection?.type ?? "rect",
): void {
	if (!selection) return;
	ctx.beginPath();
	const rings =
		(type === "path" || selection.type === "path") && selection.rings && selection.rings.length > 0
			? selection.rings
			: (type === "path" || selection.type === "path") && selection.points && selection.points.length >= 3
				? [selection.points]
				: null;
	if (rings) {
		for (const ring of rings) addSelectionRing(ctx, ring, width, height);
		ctx.clip(rings.length > 1 ? "evenodd" : "nonzero");
		return;
	}
	if (selection.width <= 0 || selection.height <= 0) return;
	const x = selection.x * width;
	const y = selection.y * height;
	const w = selection.width * width;
	const h = selection.height * height;
	if (type === "ellipse" || selection.type === "ellipse") {
		ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
	} else {
		ctx.rect(x, y, w, h);
	}
	ctx.clip();
}
