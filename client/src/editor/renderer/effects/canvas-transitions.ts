import type { TransitionType } from "../../types/transitions";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Map persisted / UI strings to canonical transition keys so preview never silently falls through to crossfade. */
function normalizeTransitionType(type: string): TransitionType {
	const compact = String(type).trim().replace(/[\s_-]+/g, "").toLowerCase();
	const aliases: Record<string, TransitionType> = {
		crossfade: "crossfade",
		fadetoblack: "fadeToBlack",
		fadetowhite: "fadeToWhite",
		dissolve: "dissolve",
		slideleft: "slideLeft",
		slideright: "slideRight",
		slideup: "slideUp",
		slidedown: "slideDown",
		wipeleft: "wipeLeft",
		wiperight: "wipeRight",
		wipeup: "wipeUp",
		wipedown: "wipeDown",
		zoomin: "zoomIn",
		zoomout: "zoomOut",
		blur: "blur",
		circlewipe: "circleWipe",
		diamondwipe: "diamondWipe",
		clockwipe: "clockWipe",
		pushleft: "pushLeft",
		pushright: "pushRight",
		pushup: "pushUp",
		pushdown: "pushDown",
		coverleft: "coverLeft",
		coverright: "coverRight",
		revealleft: "revealLeft",
		revealright: "revealRight",
		rotatein: "rotateIn",
		fliphorizontal: "flipHorizontal",
		flipvertical: "flipVertical",
		glitch: "glitch",
	};
	return aliases[compact] ?? (type as TransitionType);
}

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
	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = "source-over";
	ctx.filter = "none";

	const t = Math.max(0, Math.min(1, progress));
	const normalized = normalizeTransitionType(String(type));

	switch (normalized) {
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
		case "circleWipe":
			renderCircleWipe(ctx, w, h, outgoing, incoming, t);
			break;
		case "diamondWipe":
			renderDiamondWipe(ctx, w, h, outgoing, incoming, t);
			break;
		case "clockWipe":
			renderClockWipe(ctx, w, h, outgoing, incoming, t);
			break;
		case "pushLeft":
			renderPush(ctx, w, h, outgoing, incoming, t, "left");
			break;
		case "pushRight":
			renderPush(ctx, w, h, outgoing, incoming, t, "right");
			break;
		case "pushUp":
			renderPush(ctx, w, h, outgoing, incoming, t, "up");
			break;
		case "pushDown":
			renderPush(ctx, w, h, outgoing, incoming, t, "down");
			break;
		case "coverLeft":
			renderCover(ctx, w, h, outgoing, incoming, t, "left");
			break;
		case "coverRight":
			renderCover(ctx, w, h, outgoing, incoming, t, "right");
			break;
		case "revealLeft":
			renderReveal(ctx, w, h, outgoing, incoming, t, "left");
			break;
		case "revealRight":
			renderReveal(ctx, w, h, outgoing, incoming, t, "right");
			break;
		case "rotateIn":
			renderRotateIn(ctx, w, h, outgoing, incoming, t);
			break;
		case "flipHorizontal":
			renderFlip(ctx, w, h, outgoing, incoming, t, "horizontal");
			break;
		case "flipVertical":
			renderFlip(ctx, w, h, outgoing, incoming, t, "vertical");
			break;
		case "glitch":
			renderGlitchTransition(ctx, w, h, outgoing, incoming, t);
			break;
		default:
			renderCrossfade(ctx, w, h, outgoing, incoming, t);
	}

	ctx.restore();
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

	// Deterministic block dissolve. Block size scales with resolution so we never run tens
	// of thousands of drawImage calls per frame (that froze the preview at 1080p+).
	const maxBlocks = 900;
	const blockSize = Math.max(16, Math.ceil(Math.sqrt((w * h) / maxBlocks)));
	ctx.save();
	for (let y = 0; y < h; y += blockSize) {
		for (let x = 0; x < w; x += blockSize) {
			const bw = Math.min(blockSize, w - x);
			const bh = Math.min(blockSize, h - y);
			if (bw <= 0 || bh <= 0) continue;
			const hash = ((x * 73856093) ^ (y * 19349663)) & 0xffff;
			const threshold = hash / 0xffff;
			if (threshold < t) {
				ctx.drawImage(incoming, x, y, bw, bh, x, y, bw, bh);
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
	// Linear progress: strong easing keeps the wipe edge barely moving near the
	// endpoints (and can sit entirely in letterboxing), which reads as "broken".
	const u = Math.max(0, Math.min(1, t));

	// Draw outgoing as base
	ctx.drawImage(outgoing, 0, 0, w, h);

	// Clip incoming to the wipe region (device pixels; caller should use identity CTM)
	ctx.save();
	ctx.beginPath();
	switch (direction) {
		case "right":
			ctx.rect(0, 0, w * u, h);
			break;
		case "left":
			ctx.rect(w * (1 - u), 0, w * u, h);
			break;
		case "down":
			ctx.rect(0, 0, w, h * u);
			break;
		case "up": {
			// Incoming revealed from the bottom edge upward (matches FFmpeg xfade wipeup).
			// Do not round y/rh: Math.round + integer h often zeroes stripe height for small u,
			// so the clip is empty and the wipe looks "broken" while crossfade/slide still work.
			const stripeH = h * u;
			const y = h - stripeH;
			ctx.rect(0, y, w, Math.max(0, stripeH));
			break;
		}
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

function renderCircleWipe(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	const eased = easeInOutCubic(t);
	const maxRadius = Math.sqrt(w * w + h * h) / 2;
	const radius = maxRadius * eased;

	ctx.drawImage(outgoing, 0, 0, w, h);
	ctx.save();
	ctx.beginPath();
	ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
	ctx.clip();
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.restore();
}

function renderDiamondWipe(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	const eased = easeInOutCubic(t);
	const maxSize = Math.max(w, h);
	const size = maxSize * eased;
	const cx = w / 2;
	const cy = h / 2;

	ctx.drawImage(outgoing, 0, 0, w, h);
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(cx, cy - size);
	ctx.lineTo(cx + size, cy);
	ctx.lineTo(cx, cy + size);
	ctx.lineTo(cx - size, cy);
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.restore();
}

function renderClockWipe(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	const eased = easeInOutCubic(t);
	const cx = w / 2;
	const cy = h / 2;
	const maxRadius = Math.sqrt(w * w + h * h);
	const startAngle = -Math.PI / 2;
	const endAngle = startAngle + Math.PI * 2 * eased;

	ctx.drawImage(outgoing, 0, 0, w, h);
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(cx, cy);
	ctx.arc(cx, cy, maxRadius, startAngle, endAngle);
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.restore();
}

function renderPush(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource,
	t: number, direction: "left" | "right" | "up" | "down",
): void {
	const eased = easeInOutCubic(t);

	switch (direction) {
		case "left":
			ctx.drawImage(outgoing, -w * eased, 0, w, h);
			ctx.drawImage(incoming, w * (1 - eased), 0, w, h);
			break;
		case "right":
			ctx.drawImage(outgoing, w * eased, 0, w, h);
			ctx.drawImage(incoming, -w * (1 - eased), 0, w, h);
			break;
		case "up":
			ctx.drawImage(outgoing, 0, -h * eased, w, h);
			ctx.drawImage(incoming, 0, h * (1 - eased), w, h);
			break;
		case "down":
			ctx.drawImage(outgoing, 0, h * eased, w, h);
			ctx.drawImage(incoming, 0, -h * (1 - eased), w, h);
			break;
	}
}

function renderCover(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource,
	t: number, direction: "left" | "right",
): void {
	const eased = easeInOutCubic(t);

	// Outgoing stays in place, incoming slides over it
	ctx.drawImage(outgoing, 0, 0, w, h);
	if (direction === "left") {
		ctx.drawImage(incoming, w * (1 - eased), 0, w, h);
	} else {
		ctx.drawImage(incoming, -w * (1 - eased), 0, w, h);
	}
}

function renderReveal(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource,
	t: number, direction: "left" | "right",
): void {
	const eased = easeInOutCubic(t);

	// Incoming is underneath, outgoing slides away
	ctx.drawImage(incoming, 0, 0, w, h);
	if (direction === "left") {
		ctx.drawImage(outgoing, -w * eased, 0, w, h);
	} else {
		ctx.drawImage(outgoing, w * eased, 0, w, h);
	}
}

function renderRotateIn(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	const eased = easeInOutCubic(t);

	// Outgoing fades out
	ctx.save();
	ctx.globalAlpha = 1 - eased;
	ctx.drawImage(outgoing, 0, 0, w, h);
	ctx.restore();

	// Incoming rotates in from small + rotated
	ctx.save();
	ctx.globalAlpha = eased;
	ctx.translate(w / 2, h / 2);
	ctx.rotate((1 - eased) * Math.PI * 0.5);
	ctx.scale(0.5 + eased * 0.5, 0.5 + eased * 0.5);
	ctx.translate(-w / 2, -h / 2);
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.restore();
}

function renderFlip(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource,
	t: number, axis: "horizontal" | "vertical",
): void {
	// First half: outgoing flips away, second half: incoming flips in
	if (t < 0.5) {
		const scale = Math.cos(t * Math.PI); // 1 → 0
		ctx.save();
		ctx.translate(w / 2, h / 2);
		if (axis === "horizontal") {
			ctx.scale(scale, 1);
		} else {
			ctx.scale(1, scale);
		}
		ctx.translate(-w / 2, -h / 2);
		ctx.drawImage(outgoing, 0, 0, w, h);
		ctx.restore();
	} else {
		const scale = -Math.cos(t * Math.PI); // 0 → 1
		ctx.save();
		ctx.translate(w / 2, h / 2);
		if (axis === "horizontal") {
			ctx.scale(scale, 1);
		} else {
			ctx.scale(1, scale);
		}
		ctx.translate(-w / 2, -h / 2);
		ctx.drawImage(incoming, 0, 0, w, h);
		ctx.restore();
	}
}

function renderGlitchTransition(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	// Draw base frame
	const source = t < 0.5 ? outgoing : incoming;
	ctx.drawImage(source, 0, 0, w, h);

	// Glitch slices from the other frame
	const other = t < 0.5 ? incoming : outgoing;
	const intensity = Math.sin(t * Math.PI); // peaks at 0.5
	const sliceCount = Math.floor(5 + intensity * 15);
	const seed = Math.floor(t * 100);

	ctx.save();
	for (let i = 0; i < sliceCount; i++) {
		const hash = ((seed + i * 73856093) & 0xffff) / 0xffff;
		const hash2 = ((seed + i * 19349663) & 0xffff) / 0xffff;
		if (hash > intensity) continue;

		const sliceY = Math.floor(hash2 * h);
		const sliceH = Math.floor(4 + hash * 30);
		const offsetX = (hash - 0.5) * w * intensity * 0.3;

		ctx.drawImage(
			other,
			0, sliceY, w, sliceH,
			offsetX, sliceY, w, sliceH,
		);
	}
	ctx.restore();

	// RGB shift during peak
	if (intensity > 0.3) {
		const shift = Math.round(intensity * 8);
		const imageData = ctx.getImageData(0, 0, w, h);
		const src = new Uint8ClampedArray(imageData.data);
		const dst = imageData.data;
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const idx = (y * w + x) * 4;
				const rx = Math.min(w - 1, Math.max(0, x + shift));
				dst[idx] = src[(y * w + rx) * 4]; // Red shifted
				dst[idx + 2] = src[(y * w + Math.min(w - 1, Math.max(0, x - shift))) * 4 + 2]; // Blue shifted
			}
		}
		ctx.putImageData(imageData, 0, 0);
	}
}

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
