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
		fadegrays: "fadegrays",
		fadefast: "fadefast",
		fadeslow: "fadeslow",
		slideleft: "slideLeft",
		slideright: "slideRight",
		slideup: "slideUp",
		slidedown: "slideDown",
		wipeleft: "wipeLeft",
		wiperight: "wipeRight",
		wipeup: "wipeUp",
		wipedown: "wipeDown",
		zoomin: "zoomIn",
		// Legacy / removed product types → safe crossfade preview
		zoomout: "crossfade",
		blur: "crossfade",
		rotatein: "crossfade",
		fliphorizontal: "crossfade",
		flipvertical: "crossfade",
		glitch: "crossfade",
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
		prismsweep: "prismSweep",
		glitchblocks: "glitchBlocks",
		shutterflash: "shutterFlash",
		inkbloom: "inkBloom",
		diagtl: "diagTl",
		diagtr: "diagTr",
		diagbl: "diagBl",
		diagbr: "diagBr",
		wipetl: "wipeTl",
		wipetr: "wipeTr",
		wipebl: "wipeBl",
		wipebr: "wipeBr",
		squeezeh: "squeezeH",
		squeezev: "squeezeV",
		hlslice: "hlSlice",
		hrslice: "hrSlice",
		vuslice: "vuSlice",
		vdslice: "vdSlice",
		circleclose: "circleClose",
		horzopen: "horzOpen",
		horzclose: "horzClose",
		vertopen: "vertOpen",
		vertclose: "vertClose",
		hblurtransition: "hblurTransition",
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
		case "fadegrays":
			renderFadeGrays(ctx, w, h, outgoing, incoming, t);
			break;
		case "fadefast":
			renderCrossfade(ctx, w, h, outgoing, incoming, Math.min(1, t * 1.85));
			break;
		case "fadeslow":
			renderCrossfade(ctx, w, h, outgoing, incoming, Math.pow(t, 0.65));
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
		case "prismSweep":
			renderPrismSweep(ctx, w, h, outgoing, incoming, t);
			break;
		case "glitchBlocks":
			renderGlitchBlocks(ctx, w, h, outgoing, incoming, t);
			break;
		case "shutterFlash":
			renderShutterFlash(ctx, w, h, outgoing, incoming, t);
			break;
		case "inkBloom":
			renderInkBloom(ctx, w, h, outgoing, incoming, t);
			break;
		case "diagTl":
			renderDiagonalWipe(ctx, w, h, outgoing, incoming, t, "tl");
			break;
		case "diagTr":
			renderDiagonalWipe(ctx, w, h, outgoing, incoming, t, "tr");
			break;
		case "diagBl":
			renderDiagonalWipe(ctx, w, h, outgoing, incoming, t, "bl");
			break;
		case "diagBr":
			renderDiagonalWipe(ctx, w, h, outgoing, incoming, t, "br");
			break;
		case "wipeTl":
			renderCornerWipe(ctx, w, h, outgoing, incoming, t, "tl");
			break;
		case "wipeTr":
			renderCornerWipe(ctx, w, h, outgoing, incoming, t, "tr");
			break;
		case "wipeBl":
			renderCornerWipe(ctx, w, h, outgoing, incoming, t, "bl");
			break;
		case "wipeBr":
			renderCornerWipe(ctx, w, h, outgoing, incoming, t, "br");
			break;
		case "squeezeH":
			renderSqueeze(ctx, w, h, outgoing, incoming, t, "h");
			break;
		case "squeezeV":
			renderSqueeze(ctx, w, h, outgoing, incoming, t, "v");
			break;
		case "hlSlice":
			renderSlice(ctx, w, h, outgoing, incoming, t, "hl");
			break;
		case "hrSlice":
			renderSlice(ctx, w, h, outgoing, incoming, t, "hr");
			break;
		case "vuSlice":
			renderSlice(ctx, w, h, outgoing, incoming, t, "vu");
			break;
		case "vdSlice":
			renderSlice(ctx, w, h, outgoing, incoming, t, "vd");
			break;
		case "circleClose":
			renderCircleClose(ctx, w, h, outgoing, incoming, t);
			break;
		case "horzOpen":
			renderHorzVertOpenClose(ctx, w, h, outgoing, incoming, t, "horz", "open");
			break;
		case "horzClose":
			renderHorzVertOpenClose(ctx, w, h, outgoing, incoming, t, "horz", "close");
			break;
		case "vertOpen":
			renderHorzVertOpenClose(ctx, w, h, outgoing, incoming, t, "vert", "open");
			break;
		case "vertClose":
			renderHorzVertOpenClose(ctx, w, h, outgoing, incoming, t, "vert", "close");
			break;
		case "hblurTransition":
			renderBlurTransition(ctx, w, h, outgoing, incoming, t);
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
	const u = Math.max(0, Math.min(1, t));
	if (u <= 0) {
		ctx.drawImage(outgoing, 0, 0, w, h);
		return;
	}
	if (u >= 1) {
		ctx.drawImage(incoming, 0, 0, w, h);
		return;
	}
	const cx = w / 2;
	const cy = h / 2;
	const areaRatio = u;
	const reveal = areaRatio <= 0.5
		? Math.sqrt(areaRatio * 2)
		: 2 - Math.sqrt((1 - areaRatio) * 2);
	const halfW = (w / 2) * reveal;
	const halfH = (h / 2) * reveal;

	ctx.drawImage(outgoing, 0, 0, w, h);
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(cx, cy - halfH);
	ctx.lineTo(cx + halfW, cy);
	ctx.lineTo(cx, cy + halfH);
	ctx.lineTo(cx - halfW, cy);
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.restore();
}

function renderClockWipe(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	const u = Math.max(0, Math.min(1, t));
	if (u <= 0) {
		ctx.drawImage(outgoing, 0, 0, w, h);
		return;
	}
	if (u >= 1) {
		ctx.drawImage(incoming, 0, 0, w, h);
		return;
	}
	const cx = w / 2;
	const cy = h / 2;
	const maxRadius = Math.sqrt(w * w + h * h);
	const startAngle = -Math.PI / 2;
	const endAngle = startAngle + Math.PI * 2 * u;

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

function renderFadeGrays(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	// Approximation of xfade fadegrays: blend via dissolve-style noise + desaturation midpoint
	renderDissolve(ctx, w, h, outgoing, incoming, easeInOutCubic(t));
}

function renderPrismSweep(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	const p = clamp01(t);
	if (p <= 0) {
		ctx.drawImage(outgoing, 0, 0, w, h);
		return;
	}
	if (p >= 1) {
		ctx.drawImage(incoming, 0, 0, w, h);
		return;
	}

	ctx.drawImage(outgoing, 0, 0, w, h);

	// Same reveal direction as the old procedural matte, but rendered as a clipped polygon
	// instead of per-pixel CPU work. This keeps preview playback smooth and export identical.
	const edge = p * 1.45 - 0.18;
	const revealPolygon = clipUnitSquareByHalfPlane(0.78, 0.28, edge + 0.04);
	drawIncomingInUnitPolygon(ctx, w, h, incoming, revealPolygon);

	const stripe = edge;
	ctx.save();
	ctx.globalCompositeOperation = "screen";
	ctx.globalAlpha = Math.max(0, Math.sin(Math.PI * p)) * 0.28;
	ctx.strokeStyle = "#ffffff";
	ctx.lineWidth = Math.max(12, Math.min(w, h) * 0.035);
	drawUnitLineForHalfPlane(ctx, w, h, 0.78, 0.28, stripe);
	ctx.stroke();
	ctx.restore();
}

function renderGlitchBlocks(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	const p = clamp01(t);
	if (p <= 0) {
		ctx.drawImage(outgoing, 0, 0, w, h);
		return;
	}
	if (p >= 1) {
		ctx.drawImage(incoming, 0, 0, w, h);
		return;
	}

	ctx.drawImage(outgoing, 0, 0, w, h);

	const rows = 12;
	const rowH = h / rows;
	for (let row = 0; row < rows; row++) {
		const stagger = ((row * 37) % 11) / 11;
		const reveal = clamp01(p * 1.35 - stagger * 0.35);
		if (reveal <= 0) continue;

		const y = Math.floor(row * rowH);
		const rh = Math.ceil((row + 1) * rowH) - y;
		const fromLeft = row % 2 === 0;
		const rw = Math.ceil(w * reveal);
		const sx = fromLeft ? 0 : w - rw;
		const dx = sx;
		ctx.drawImage(incoming, sx, y, rw, rh, dx, y, rw, rh);
	}

	// Bounded glitch accent: a handful of shifted scan bands, never full-frame pixel loops.
	const jitterPhase = Math.floor(p * 24);
	const accentRows = 5;
	ctx.save();
	ctx.globalAlpha = Math.max(0, Math.sin(Math.PI * p)) * 0.22;
	for (let i = 0; i < accentRows; i++) {
		const row = (jitterPhase * 3 + i * 5) % rows;
		const y = Math.floor(row * rowH);
		const rh = Math.max(2, Math.ceil(rowH * 0.32));
		const shift = (((row * 17 + jitterPhase * 11) % 9) - 4) * Math.max(2, w * 0.006);
		const sx = Math.max(0, -shift);
		const dx = Math.max(0, shift);
		const sw = Math.max(1, w - Math.abs(shift));
		ctx.drawImage(incoming, sx, y, sw, rh, dx, y, sw, rh);
	}
	ctx.restore();
}

function renderShutterFlash(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	const p = clamp01(t);
	if (p <= 0) {
		ctx.drawImage(outgoing, 0, 0, w, h);
		return;
	}
	if (p >= 1) {
		ctx.drawImage(incoming, 0, 0, w, h);
		return;
	}

	ctx.drawImage(outgoing, 0, 0, w, h);

	const cols = 10;
	const colW = w / cols;
	for (let col = 0; col < cols; col++) {
		const fromTop = col % 2 === 0;
		const reveal = clamp01(p * 1.22 - (fromTop ? 0 : 0.22));
		if (reveal <= 0) continue;

		const x = Math.floor(col * colW);
		const cw = Math.ceil((col + 1) * colW) - x;
		const rh = Math.ceil(h * reveal);
		const sy = fromTop ? 0 : h - rh;
		ctx.drawImage(incoming, x, sy, cw, rh, x, sy, cw, rh);
	}

	const flash = 0.42 * Math.max(0, 1 - Math.abs(p - 0.5) / 0.16);
	if (flash > 0) {
		ctx.save();
		ctx.globalCompositeOperation = "screen";
		ctx.globalAlpha = flash;
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, w, h);
		ctx.restore();
	}
}

function renderInkBloom(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	const p = clamp01(t);
	if (p <= 0) {
		ctx.drawImage(outgoing, 0, 0, w, h);
		return;
	}
	if (p >= 1) {
		ctx.drawImage(incoming, 0, 0, w, h);
		return;
	}

	ctx.drawImage(outgoing, 0, 0, w, h);

	const cx = w / 2;
	const cy = h / 2;
	const maxRadius = Math.sqrt(w * w + h * h) / 2;
	const base = Math.max(0, p * 1.08 - 0.05);
	const points = 56;

	ctx.save();
	ctx.beginPath();
	for (let i = 0; i < points; i++) {
		const a = (i / points) * Math.PI * 2;
		const nx = Math.cos(a);
		const ny = Math.sin(a);
		const wobble = 1
			+ 0.09 * Math.sin(a * 5 + p * 8)
			+ 0.055 * Math.sin(a * 9 - p * 6);
		const r = maxRadius * base * wobble;
		const x = cx + nx * r;
		const y = cy + ny * r;
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.restore();
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

type UnitPoint = { x: number; y: number };

function clipUnitSquareByHalfPlane(a: number, b: number, c: number): UnitPoint[] {
	let polygon: UnitPoint[] = [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 1, y: 1 },
		{ x: 0, y: 1 },
	];

	const inside = (p: UnitPoint) => a * p.x + b * p.y <= c;
	const intersect = (p1: UnitPoint, p2: UnitPoint): UnitPoint => {
		const v1 = a * p1.x + b * p1.y - c;
		const v2 = a * p2.x + b * p2.y - c;
		const t = v1 / (v1 - v2 || 1);
		return {
			x: p1.x + (p2.x - p1.x) * t,
			y: p1.y + (p2.y - p1.y) * t,
		};
	};

	const output: UnitPoint[] = [];
	for (let i = 0; i < polygon.length; i++) {
		const current = polygon[i];
		const previous = polygon[(i + polygon.length - 1) % polygon.length];
		const curIn = inside(current);
		const prevIn = inside(previous);
		if (curIn) {
			if (!prevIn) output.push(intersect(previous, current));
			output.push(current);
		} else if (prevIn) {
			output.push(intersect(previous, current));
		}
	}
	polygon = output;
	return polygon;
}

function drawIncomingInUnitPolygon(
	ctx: Ctx,
	w: number,
	h: number,
	incoming: CanvasImageSource,
	polygon: UnitPoint[],
): void {
	if (polygon.length < 3) return;
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(polygon[0].x * w, polygon[0].y * h);
	for (let i = 1; i < polygon.length; i++) {
		ctx.lineTo(polygon[i].x * w, polygon[i].y * h);
	}
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.restore();
}

function drawUnitLineForHalfPlane(ctx: Ctx, w: number, h: number, a: number, b: number, c: number): void {
	const points: UnitPoint[] = [];
	const pushIfValid = (p: UnitPoint) => {
		if (
			p.x >= -1e-6 &&
			p.x <= 1 + 1e-6 &&
			p.y >= -1e-6 &&
			p.y <= 1 + 1e-6 &&
			!points.some((q) => Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.y - p.y) < 1e-6)
		) {
			points.push({ x: clamp01(p.x), y: clamp01(p.y) });
		}
	};

	if (Math.abs(b) > 1e-9) {
		pushIfValid({ x: 0, y: c / b });
		pushIfValid({ x: 1, y: (c - a) / b });
	}
	if (Math.abs(a) > 1e-9) {
		pushIfValid({ x: c / a, y: 0 });
		pushIfValid({ x: (c - b) / a, y: 1 });
	}

	if (points.length < 2) return;
	ctx.beginPath();
	ctx.moveTo(points[0].x * w, points[0].y * h);
	ctx.lineTo(points[1].x * w, points[1].y * h);
}

function renderDiagonalWipe(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource,
	t: number, corner: "tl" | "tr" | "bl" | "br",
): void {
	const u = easeInOutCubic(t);
	ctx.drawImage(outgoing, 0, 0, w, h);
	ctx.save();
	ctx.beginPath();
	if (corner === "tl") {
		ctx.moveTo(0, 0);
		ctx.lineTo(u * w, 0);
		ctx.lineTo(0, u * h);
	} else if (corner === "tr") {
		ctx.moveTo(w, 0);
		ctx.lineTo(w - u * w, 0);
		ctx.lineTo(w, u * h);
	} else if (corner === "bl") {
		ctx.moveTo(0, h);
		ctx.lineTo(u * w, h);
		ctx.lineTo(0, h - u * h);
	} else {
		ctx.moveTo(w, h);
		ctx.lineTo(w - u * w, h);
		ctx.lineTo(w, h - u * h);
	}
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.restore();
}

function renderCornerWipe(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource,
	t: number, corner: "tl" | "tr" | "bl" | "br",
): void {
	const u = easeInOutCubic(t);
	const maxR = Math.sqrt(w * w + h * h);
	const r = u * maxR * 0.55;
	ctx.drawImage(outgoing, 0, 0, w, h);
	ctx.save();
	ctx.beginPath();
	const cx = corner === "tl" || corner === "bl" ? 0 : w;
	const cy = corner === "tl" || corner === "tr" ? 0 : h;
	const start = corner === "tl" ? 0 : corner === "tr" ? Math.PI / 2 : corner === "bl" ? -Math.PI / 2 : Math.PI;
	ctx.moveTo(cx, cy);
	ctx.arc(cx, cy, r, start, start + Math.PI / 2);
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.restore();
}

function renderSqueeze(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource,
	t: number, axis: "h" | "v",
): void {
	const u = easeInOutCubic(t);
	ctx.save();
	ctx.translate(w / 2, h / 2);
	if (axis === "h") {
		ctx.scale(1 - u * 0.45, 1);
	} else {
		ctx.scale(1, 1 - u * 0.45);
	}
	ctx.translate(-w / 2, -h / 2);
	ctx.globalAlpha = 1;
	ctx.drawImage(outgoing, 0, 0, w, h);
	ctx.restore();

	ctx.save();
	ctx.translate(w / 2, h / 2);
	if (axis === "h") {
		ctx.scale(Math.max(0.05, u), 1);
	} else {
		ctx.scale(1, Math.max(0.05, u));
	}
	ctx.translate(-w / 2, -h / 2);
	ctx.globalAlpha = Math.min(1, u * 1.2);
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.restore();
	ctx.globalAlpha = 1;
}

function renderSlice(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource,
	t: number, kind: "hl" | "hr" | "vu" | "vd",
): void {
	const u = easeInOutCubic(t);
	ctx.drawImage(outgoing, 0, 0, w, h);
	ctx.save();
	ctx.beginPath();
	if (kind === "hl") {
		ctx.rect(0, 0, u * w, h);
	} else if (kind === "hr") {
		ctx.rect(w * (1 - u), 0, u * w, h);
	} else if (kind === "vu") {
		ctx.rect(0, 0, w, u * h);
	} else {
		ctx.rect(0, h * (1 - u), w, u * h);
	}
	ctx.clip();
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.restore();
}

function renderCircleClose(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource, t: number,
): void {
	renderCircleWipe(ctx, w, h, incoming, outgoing, 1 - easeInOutCubic(t));
}

function renderHorzVertOpenClose(
	ctx: Ctx, w: number, h: number,
	outgoing: CanvasImageSource, incoming: CanvasImageSource,
	t: number, axis: "horz" | "vert", mode: "open" | "close",
): void {
	const u = easeInOutCubic(t);
	const gap = axis === "horz" ? u * w * 0.5 : u * h * 0.5;
	ctx.drawImage(outgoing, 0, 0, w, h);
	ctx.save();
	ctx.beginPath();
	if (axis === "horz") {
		if (mode === "open") {
			ctx.rect(w / 2 - gap, 0, gap * 2, h);
			ctx.clip();
		} else {
			ctx.rect(0, 0, w, h);
			ctx.rect(w / 2 - gap, 0, gap * 2, h);
			ctx.clip("evenodd");
		}
	} else if (mode === "open") {
		ctx.rect(0, h / 2 - gap, w, gap * 2);
		ctx.clip();
	} else {
		ctx.rect(0, 0, w, h);
		ctx.rect(0, h / 2 - gap, w, gap * 2);
		ctx.clip("evenodd");
	}
	ctx.drawImage(incoming, 0, 0, w, h);
	ctx.restore();
}

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
