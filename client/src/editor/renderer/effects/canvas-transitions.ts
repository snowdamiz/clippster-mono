import type { TransitionType } from "../../types/transitions";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Render a transition between two frames.
 * @param ctx - Target canvas context
 * @param w - Canvas width
 * @param h - Canvas height
 * @param outgoing - The outgoing frame (canvas/image)
 * @param incoming - The incoming frame (canvas/image)
 * @param progress - Transition progress 0..1 (0 = fully outgoing, 1 = fully incoming)
 * @param type - Transition type
 */
export function renderTransition(
	ctx: Ctx,
	w: number,
	h: number,
	outgoing: CanvasImageSource,
	incoming: CanvasImageSource,
	progress: number,
	type: TransitionType,
): void {
	const t = Math.max(0, Math.min(1, progress));

	switch (type) {
		case "crossfade":
			renderCrossfade(ctx, w, h, outgoing, incoming, t);
			break;
		case "fadeToBlack":
			renderFadeToColor(ctx, w, h, outgoing, incoming, t, "#000000");
			break;
		case "fadeToWhite":
			renderFadeToColor(ctx, w, h, outgoing, incoming, t, "#ffffff");
			break;
		case "dissolve":
			renderDissolve(ctx, w, h, outgoing, incoming, t);
			break;
		case "slideLeft":
			renderSlide(ctx, w, h, outgoing, incoming, t, "left");
			break;
		case "slideRight":
			renderSlide(ctx, w, h, outgoing, incoming, t, "right");
			break;
		case "slideUp":
			renderSlide(ctx, w, h, outgoing, incoming, t, "up");
			break;
		case "slideDown":
			renderSlide(ctx, w, h, outgoing, incoming, t, "down");
			break;
		case "wipeLeft":
			renderWipe(ctx, w, h, outgoing, incoming, t, "left");
			break;
		case "wipeRight":
			renderWipe(ctx, w, h, outgoing, incoming, t, "right");
			break;
		case "wipeUp":
			renderWipe(ctx, w, h, outgoing, incoming, t, "up");
			break;
		case "wipeDown":
			renderWipe(ctx, w, h, outgoing, incoming, t, "down");
			break;
		case "zoomIn":
			renderZoom(ctx, w, h, outgoing, incoming, t, "in");
			break;
		case "zoomOut":
			renderZoom(ctx, w, h, outgoing, incoming, t, "out");
			break;
		case "blur":
			renderBlurTransition(ctx, w, h, outgoing, incoming, t);
			break;
		default:
			renderCrossfade(ctx, w, h, outgoing, incoming, t);
	}
}

function renderCrossfade(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	ctx.globalAlpha = 1;
	ctx.drawImage(outgoing, 0, 0, w, h);
	ctx.globalAlpha = t;
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.globalAlpha = 1;
}

function renderFadeToColor(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource,
	t: number, color: string,
): void {
	if (t < 0.5) {
		// First half: outgoing fades to color
		const fadeOut = t * 2; // 0..1
		ctx.globalAlpha = 1;
		ctx.drawImage(outgoing, 0, 0, w, h);
		ctx.globalAlpha = fadeOut;
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, w, h);
	} else {
		// Second half: color fades to incoming
		const fadeIn = (t - 0.5) * 2; // 0..1
		ctx.globalAlpha = 1;
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, w, h);
		ctx.globalAlpha = fadeIn;
		ctx.drawImage(incoming, 0, 0, w, h);
	}
	ctx.globalAlpha = 1;
}

function renderDissolve(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	// Draw outgoing
	ctx.drawImage(outgoing, 0, 0, w, h);

	// Draw incoming with random pixel dissolve pattern
	// Use a deterministic pattern based on position
	const blockSize = 8;
	ctx.save();
	for (let y = 0; y < h; y += blockSize) {
		for (let x = 0; x < w; x += blockSize) {
			// Simple hash for deterministic randomness
			const hash = ((x * 73856093) ^ (y * 19349663)) & 0xffff;
			const threshold = hash / 0xffff;
			if (threshold < t) {
				ctx.drawImage(
					incoming,
					x, y, blockSize, blockSize,
					x, y, blockSize, blockSize,
				);
			}
		}
	}
	ctx.restore();
}

function renderSlide(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource,
	t: number, direction: "left" | "right" | "up" | "down",
): void {
	const eased = easeInOutCubic(t);

	let outX = 0, outY = 0, inX = 0, inY = 0;
	switch (direction) {
		case "left":
			outX = -w * eased;
			inX = w * (1 - eased);
			break;
		case "right":
			outX = w * eased;
			inX = -w * (1 - eased);
			break;
		case "up":
			outY = -h * eased;
			inY = h * (1 - eased);
			break;
		case "down":
			outY = h * eased;
			inY = -h * (1 - eased);
			break;
	}

	ctx.drawImage(outgoing, outX, outY, w, h);
	ctx.drawImage(incoming, inX, inY, w, h);
}

function renderWipe(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource,
	t: number, direction: "left" | "right" | "up" | "down",
): void {
	const eased = easeInOutCubic(t);

	// Draw outgoing as base
	ctx.drawImage(outgoing, 0, 0, w, h);

	// Clip incoming to the wipe region
	ctx.save();
	ctx.beginPath();
	switch (direction) {
		case "right":
			ctx.rect(0, 0, w * eased, h);
			break;
		case "left":
			ctx.rect(w * (1 - eased), 0, w * eased, h);
			break;
		case "down":
			ctx.rect(0, 0, w, h * eased);
			break;
		case "up":
			ctx.rect(0, h * (1 - eased), w, h * eased);
			break;
	}
	ctx.clip();
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.restore();
}

function renderZoom(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource,
	t: number, direction: "in" | "out",
): void {
	const eased = easeInOutCubic(t);

	if (direction === "in") {
		// Outgoing zooms in and fades out
		const scale = 1 + eased * 0.5;
		ctx.save();
		ctx.globalAlpha = 1 - eased;
		ctx.translate(w / 2, h / 2);
		ctx.scale(scale, scale);
		ctx.translate(-w / 2, -h / 2);
		ctx.drawImage(outgoing, 0, 0, w, h);
		ctx.restore();

		// Incoming fades in
		ctx.save();
		ctx.globalAlpha = eased;
		ctx.drawImage(incoming, 0, 0, w, h);
		ctx.restore();
	} else {
		// Outgoing fades out
		ctx.save();
		ctx.globalAlpha = 1 - eased;
		ctx.drawImage(outgoing, 0, 0, w, h);
		ctx.restore();

		// Incoming zooms out from large to normal
		const scale = 1.5 - eased * 0.5;
		ctx.save();
		ctx.globalAlpha = eased;
		ctx.translate(w / 2, h / 2);
		ctx.scale(scale, scale);
		ctx.translate(-w / 2, -h / 2);
		ctx.drawImage(incoming, 0, 0, w, h);
		ctx.restore();
	}
}

function renderBlurTransition(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	if (t < 0.5) {
		// First half: outgoing gets blurrier
		const blurAmount = t * 2 * 20; // 0..20px
		ctx.save();
		ctx.filter = `blur(${blurAmount}px)`;
		ctx.globalAlpha = 1;
		ctx.drawImage(outgoing, 0, 0, w, h);
		ctx.filter = "none";
		ctx.restore();
	} else {
		// Second half: incoming gets sharper
		const blurAmount = (1 - t) * 2 * 20; // 20..0px
		ctx.save();
		ctx.filter = `blur(${blurAmount}px)`;
		ctx.globalAlpha = 1;
		ctx.drawImage(incoming, 0, 0, w, h);
		ctx.filter = "none";
		ctx.restore();
	}
}

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
