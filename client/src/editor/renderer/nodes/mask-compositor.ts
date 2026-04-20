/**
 * Canvas 2D mask compositor for shape masks on video/image elements.
 *
 * Preview strategy:
 *   - Non-feathered masks use ctx.clip() — fast, no pixel readback needed.
 *   - Feathered masks render the element to a temp OffscreenCanvas, apply
 *     a blurred mask with destination-in compositing, then blit the result.
 *     This requires the caller to pass a "draw function" for the feathered path.
 *
 * Export: FFmpeg handles masks via geq + boxblur filters in video_editor_export.rs.
 */

import type { MaskShape } from "../../types/timeline";

// ── Shape drawing helpers ────────────────────────────────────────────────────

function drawRectangle(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	mask: MaskShape,
	canvasW: number,
	canvasH: number,
) {
	const cx = mask.x * canvasW;
	const cy = mask.y * canvasH;
	const hw = (mask.width * canvasW) / 2;
	const hh = (mask.height * canvasH) / 2;

	ctx.save();
	if (mask.rotation !== 0) {
		ctx.translate(cx, cy);
		ctx.rotate((mask.rotation * Math.PI) / 180);
		ctx.translate(-cx, -cy);
	}
	ctx.rect(cx - hw, cy - hh, hw * 2, hh * 2);
	ctx.restore();
}

function drawEllipse(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	mask: MaskShape,
	canvasW: number,
	canvasH: number,
) {
	const cx = mask.x * canvasW;
	const cy = mask.y * canvasH;
	const rx = (mask.width * canvasW) / 2;
	const ry = (mask.height * canvasH) / 2;
	const rotation = (mask.rotation * Math.PI) / 180;

	ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
}

function drawMaskShape(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	mask: MaskShape,
	canvasW: number,
	canvasH: number,
) {
	if (mask.type === "rectangle") {
		drawRectangle(ctx, mask, canvasW, canvasH);
	} else {
		drawEllipse(ctx, mask, canvasW, canvasH);
	}
}

// ── Hard-edge clip path (non-feathered) ─────────────────────────────────────

/**
 * Sets up a clipping path on ctx for all non-feathered masks.
 * Call BEFORE drawing the element, inside a ctx.save()/restore() block.
 * The clip is automatically removed when restore() is called.
 *
 * Returns true if at least one feathered mask exists (caller must use
 * renderWithFeatheredMasks instead / in addition).
 */
export function setupMaskClip(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	masks: MaskShape[],
	canvasW: number,
	canvasH: number,
): boolean {
	const hardMasks = masks.filter((m) => m.feather === 0);
	const hasFeathered = masks.some((m) => m.feather > 0);

	if (hardMasks.length === 0) return hasFeathered;

	for (const mask of hardMasks) {
		ctx.beginPath();

		if (mask.invert) {
			// Cover the whole canvas, then punch out the shape (evenodd rule)
			ctx.rect(0, 0, canvasW, canvasH);
			drawMaskShape(ctx, mask, canvasW, canvasH);
			ctx.clip("evenodd");
		} else {
			drawMaskShape(ctx, mask, canvasW, canvasH);
			ctx.clip();
		}
	}

	return hasFeathered;
}

// ── Feathered masks via offscreen compositing ────────────────────────────────

/**
 * For feathered masks, renders the element to an OffscreenCanvas, applies
 * blurred mask shapes via destination-in compositing, then draws the result
 * onto the main context.
 *
 * @param mainCtx  The main canvas rendering context
 * @param masks    Only feathered masks are processed here
 * @param canvasW  Full canvas width
 * @param canvasH  Full canvas height
 * @param drawFn   Async function that draws the element onto a given ctx
 */
export async function applyFeatheredMasks(
	mainCtx: CanvasRenderingContext2D,
	masks: MaskShape[],
	canvasW: number,
	canvasH: number,
	drawFn: (ctx: OffscreenCanvasRenderingContext2D) => Promise<void>,
): Promise<void> {
	const featheredMasks = masks.filter((m) => m.feather > 0);
	if (featheredMasks.length === 0) return;

	// 1. Render element to temp canvas
	const elemCanvas = new OffscreenCanvas(canvasW, canvasH);
	const elemCtx = elemCanvas.getContext("2d", { willReadFrequently: false });
	if (!elemCtx) return;
	await drawFn(elemCtx);

	// 2. Create mask canvas and draw blurred shapes
	const maskCanvas = new OffscreenCanvas(canvasW, canvasH);
	const maskCtx = maskCanvas.getContext("2d");
	if (!maskCtx) return;

	for (const mask of featheredMasks) {
		maskCtx.save();
		if (mask.feather > 0) {
			maskCtx.filter = `blur(${mask.feather}px)`;
		}
		maskCtx.beginPath();
		drawMaskShape(maskCtx as unknown as CanvasRenderingContext2D, mask, canvasW, canvasH);

		if (mask.invert) {
			// White everywhere except the shape
			maskCtx.fillStyle = "white";
			maskCtx.fillRect(0, 0, canvasW, canvasH);
			maskCtx.globalCompositeOperation = "destination-out";
			maskCtx.fillStyle = "black";
			maskCtx.fill();
		} else {
			maskCtx.fillStyle = "white";
			maskCtx.fill();
		}
		maskCtx.restore();
	}

	// 3. Apply mask to element canvas via destination-in
	elemCtx.globalCompositeOperation = "destination-in";
	elemCtx.drawImage(maskCanvas, 0, 0);
	elemCtx.globalCompositeOperation = "source-over";

	// 4. Composite masked element onto main canvas
	mainCtx.drawImage(elemCanvas, 0, 0);
}

// ── Convenience: apply all masks (hard + feathered) ─────────────────────────

/**
 * High-level helper: applies all masks after the element has already been
 * drawn to mainCtx using the hard-clip approach (for non-feathered) or the
 * offscreen approach (for feathered).
 *
 * Use this as a POST-DRAW step when masks only contain hard-edge shapes
 * (feather === 0 for all) — it reads back the pixels and re-applies alpha.
 * For feathered masks, use setupMaskClip + applyFeatheredMasks instead.
 */
export function hasMasks(masks: MaskShape[] | undefined): boolean {
	return !!(masks && masks.length > 0);
}

export function hasFeatheredMasks(masks: MaskShape[] | undefined): boolean {
	return !!(masks && masks.some((m) => m.feather > 0));
}
