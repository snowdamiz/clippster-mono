import type { VideoEffect } from "../../types/effects";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Apply all enabled effects to the canvas context AFTER the frame has been drawn.
 * Effects are applied in order. Some use ctx.filter (blur, grayscale, sepia, invert),
 * others manipulate pixel data or draw overlays.
 *
 * @param ctx       The 2D context with the frame already drawn
 * @param width     Canvas width
 * @param height    Canvas height
 * @param effects   Array of effects to apply
 * @param time      Current playback time (seconds) — used for animated effects
 * @param elementStartTime  Element start time on timeline — for relative animation
 */
export function applyCanvasEffects(
	ctx: Ctx,
	width: number,
	height: number,
	effects: VideoEffect[],
	time: number,
	elementStartTime: number,
): void {
	const elapsed = time - elementStartTime;

	for (const effect of effects) {
		if (!effect.enabled) continue;

		switch (effect.type) {
			case "blur":
				applyBlur(ctx, width, height, effect.radius);
				break;
			case "pixelate":
				applyPixelate(ctx, width, height, effect.blockSize);
				break;
			case "sharpen":
				applySharpen(ctx, width, height, effect.amount);
				break;
			case "vignette":
				applyVignette(ctx, width, height, effect.radius, effect.softness);
				break;
			case "sepia":
				applySepia(ctx, width, height, effect.intensity);
				break;
			case "grayscale":
				applyGrayscale(ctx, width, height, effect.intensity);
				break;
			case "negative":
				applyNegative(ctx, width, height, effect.intensity);
				break;
			case "colorShift":
				applyColorShift(ctx, width, height, effect.redOffsetX, effect.redOffsetY, effect.blueOffsetX, effect.blueOffsetY);
				break;
			case "glitch":
				applyGlitch(ctx, width, height, effect.sliceCount, effect.maxOffset, effect.colorBleed, elapsed);
				break;
			case "wave":
				applyWave(ctx, width, height, effect.amplitude, effect.frequency, effect.speed, elapsed);
				break;
			case "zoomPulse":
				applyZoomPulse(ctx, width, height, effect.amount, effect.speed, elapsed);
				break;
			case "flash":
				applyFlash(ctx, width, height, effect.color, effect.speed, effect.intensity, elapsed);
				break;
		}
	}
}

/**
 * Build a CSS filter string for effects that can be expressed as ctx.filter.
 * This is used BEFORE drawing the frame for filter-based effects.
 * Returns empty string if no filter effects are present.
 */
export function buildFilterString(effects: VideoEffect[]): string {
	const parts: string[] = [];
	for (const effect of effects) {
		if (!effect.enabled) continue;
		switch (effect.type) {
			case "blur":
				parts.push(`blur(${effect.radius}px)`);
				break;
			case "grayscale":
				parts.push(`grayscale(${effect.intensity / 100})`);
				break;
			case "sepia":
				parts.push(`sepia(${effect.intensity / 100})`);
				break;
			case "negative":
				parts.push(`invert(${effect.intensity / 100})`);
				break;
		}
	}
	return parts.join(" ");
}

/**
 * Check if any effects require post-draw pixel manipulation
 * (i.e., cannot be done with ctx.filter alone).
 */
export function hasPostDrawEffects(effects: VideoEffect[]): boolean {
	return effects.some(
		(e) =>
			e.enabled &&
			(e.type === "pixelate" ||
				e.type === "sharpen" ||
				e.type === "vignette" ||
				e.type === "colorShift" ||
				e.type === "glitch" ||
				e.type === "wave" ||
				e.type === "zoomPulse" ||
				e.type === "flash"),
	);
}

// ── Individual effect implementations ──

function applyBlur(ctx: Ctx, w: number, h: number, radius: number): void {
	// Blur is handled via ctx.filter before drawing, so this is a no-op
	// when used in the filter pipeline. Only used for post-draw if needed.
}

function applyPixelate(ctx: Ctx, w: number, h: number, blockSize: number): void {
	if (blockSize < 2) return;
	const imageData = ctx.getImageData(0, 0, w, h);
	const data = imageData.data;

	for (let y = 0; y < h; y += blockSize) {
		for (let x = 0; x < w; x += blockSize) {
			// Average the block
			let r = 0, g = 0, b = 0, count = 0;
			for (let dy = 0; dy < blockSize && y + dy < h; dy++) {
				for (let dx = 0; dx < blockSize && x + dx < w; dx++) {
					const idx = ((y + dy) * w + (x + dx)) * 4;
					r += data[idx];
					g += data[idx + 1];
					b += data[idx + 2];
					count++;
				}
			}
			r = Math.round(r / count);
			g = Math.round(g / count);
			b = Math.round(b / count);

			// Fill the block with average color
			for (let dy = 0; dy < blockSize && y + dy < h; dy++) {
				for (let dx = 0; dx < blockSize && x + dx < w; dx++) {
					const idx = ((y + dy) * w + (x + dx)) * 4;
					data[idx] = r;
					data[idx + 1] = g;
					data[idx + 2] = b;
				}
			}
		}
	}
	ctx.putImageData(imageData, 0, 0);
}

function applySharpen(ctx: Ctx, w: number, h: number, amount: number): void {
	if (amount <= 0) return;
	const imageData = ctx.getImageData(0, 0, w, h);
	const src = new Uint8ClampedArray(imageData.data);
	const dst = imageData.data;

	// Unsharp mask kernel: center = 1 + 4*amount, neighbors = -amount
	const a = amount * 0.3; // scale down for usability
	const kernel = [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0];

	for (let y = 1; y < h - 1; y++) {
		for (let x = 1; x < w - 1; x++) {
			for (let c = 0; c < 3; c++) {
				let val = 0;
				let ki = 0;
				for (let ky = -1; ky <= 1; ky++) {
					for (let kx = -1; kx <= 1; kx++) {
						val += src[((y + ky) * w + (x + kx)) * 4 + c] * kernel[ki++];
					}
				}
				dst[(y * w + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(val)));
			}
		}
	}
	ctx.putImageData(imageData, 0, 0);
}

function applyVignette(ctx: Ctx, w: number, h: number, radius: number, softness: number): void {
	const cx = w / 2;
	const cy = h / 2;
	const maxDim = Math.max(w, h);
	const innerRadius = (radius / 100) * maxDim * 0.5;
	const outerRadius = innerRadius + (softness / 100) * maxDim * 0.5;

	const gradient = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
	gradient.addColorStop(0, "rgba(0,0,0,0)");
	gradient.addColorStop(1, "rgba(0,0,0,0.85)");

	ctx.save();
	ctx.globalCompositeOperation = "multiply";
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, w, h);
	ctx.restore();
}

function applySepia(ctx: Ctx, _w: number, _h: number, _intensity: number): void {
	// Handled via ctx.filter — no-op here
}

function applyGrayscale(ctx: Ctx, _w: number, _h: number, _intensity: number): void {
	// Handled via ctx.filter — no-op here
}

function applyNegative(ctx: Ctx, _w: number, _h: number, _intensity: number): void {
	// Handled via ctx.filter — no-op here
}

function applyColorShift(
	ctx: Ctx, w: number, h: number,
	redOffsetX: number, redOffsetY: number,
	blueOffsetX: number, blueOffsetY: number,
): void {
	const imageData = ctx.getImageData(0, 0, w, h);
	const src = new Uint8ClampedArray(imageData.data);
	const dst = imageData.data;

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const dstIdx = (y * w + x) * 4;

			// Red channel from offset position
			const rx = Math.min(w - 1, Math.max(0, x + Math.round(redOffsetX)));
			const ry = Math.min(h - 1, Math.max(0, y + Math.round(redOffsetY)));
			dst[dstIdx] = src[(ry * w + rx) * 4];

			// Green stays in place
			dst[dstIdx + 1] = src[dstIdx + 1];

			// Blue channel from offset position
			const bx = Math.min(w - 1, Math.max(0, x + Math.round(blueOffsetX)));
			const by = Math.min(h - 1, Math.max(0, y + Math.round(blueOffsetY)));
			dst[dstIdx + 2] = src[(by * w + bx) * 4 + 2];

			// Alpha stays
			dst[dstIdx + 3] = src[dstIdx + 3];
		}
	}
	ctx.putImageData(imageData, 0, 0);
}

function applyGlitch(
	ctx: Ctx, w: number, h: number,
	sliceCount: number, maxOffset: number, colorBleed: number,
	elapsed: number,
): void {
	const imageData = ctx.getImageData(0, 0, w, h);
	const src = new Uint8ClampedArray(imageData.data);
	const dst = imageData.data;

	// Pseudo-random based on elapsed time for deterministic but animated glitch
	const seed = Math.floor(elapsed * 8) * 1337;
	const rng = (i: number) => {
		const x = Math.sin(seed + i * 127.1) * 43758.5453;
		return x - Math.floor(x);
	};

	const sliceHeight = Math.ceil(h / sliceCount);

	for (let s = 0; s < sliceCount; s++) {
		const yStart = s * sliceHeight;
		const yEnd = Math.min(yStart + sliceHeight, h);
		const offset = Math.round((rng(s) - 0.5) * 2 * maxOffset);
		const rgbShift = Math.round((rng(s + 100) - 0.5) * 2 * (colorBleed / 100) * 10);

		for (let y = yStart; y < yEnd; y++) {
			for (let x = 0; x < w; x++) {
				const dstIdx = (y * w + x) * 4;
				const srcX = Math.min(w - 1, Math.max(0, x + offset));

				// Red from shifted position
				const rSrcX = Math.min(w - 1, Math.max(0, srcX + rgbShift));
				dst[dstIdx] = src[(y * w + rSrcX) * 4];

				// Green from offset position
				dst[dstIdx + 1] = src[(y * w + srcX) * 4 + 1];

				// Blue from opposite shifted position
				const bSrcX = Math.min(w - 1, Math.max(0, srcX - rgbShift));
				dst[dstIdx + 2] = src[(y * w + bSrcX) * 4 + 2];

				dst[dstIdx + 3] = src[(y * w + srcX) * 4 + 3];
			}
		}
	}
	ctx.putImageData(imageData, 0, 0);
}

function applyWave(
	ctx: Ctx, w: number, h: number,
	amplitude: number, frequency: number, speed: number,
	elapsed: number,
): void {
	const imageData = ctx.getImageData(0, 0, w, h);
	const src = new Uint8ClampedArray(imageData.data);
	const dst = imageData.data;

	const phase = elapsed * speed * Math.PI * 2;

	for (let y = 0; y < h; y++) {
		const offset = Math.round(amplitude * Math.sin((y / h) * frequency * Math.PI * 2 + phase));
		for (let x = 0; x < w; x++) {
			const dstIdx = (y * w + x) * 4;
			const srcX = Math.min(w - 1, Math.max(0, x + offset));
			const srcIdx = (y * w + srcX) * 4;
			dst[dstIdx] = src[srcIdx];
			dst[dstIdx + 1] = src[srcIdx + 1];
			dst[dstIdx + 2] = src[srcIdx + 2];
			dst[dstIdx + 3] = src[srcIdx + 3];
		}
	}
	ctx.putImageData(imageData, 0, 0);
}

function applyZoomPulse(
	ctx: Ctx, w: number, h: number,
	amount: number, speed: number,
	elapsed: number,
): void {
	// Read current canvas content
	const imageData = ctx.getImageData(0, 0, w, h);

	// Calculate zoom factor
	const zoomFactor = 1 + (amount / 100) * Math.sin(elapsed * speed * Math.PI * 2);

	// Create temporary canvas for the zoom
	const tempCanvas = new OffscreenCanvas(w, h);
	const tempCtx = tempCanvas.getContext("2d")!;
	tempCtx.putImageData(imageData, 0, 0);

	// Clear and draw zoomed
	ctx.clearRect(0, 0, w, h);
	ctx.save();
	ctx.translate(w / 2, h / 2);
	ctx.scale(zoomFactor, zoomFactor);
	ctx.translate(-w / 2, -h / 2);
	ctx.drawImage(tempCanvas, 0, 0);
	ctx.restore();
}

function applyFlash(
	ctx: Ctx, w: number, h: number,
	color: string, speed: number, intensity: number,
	elapsed: number,
): void {
	// Oscillating flash overlay
	const alpha = Math.max(0, Math.sin(elapsed * speed * Math.PI * 2)) * (intensity / 100) * 0.8;
	if (alpha > 0.01) {
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, w, h);
		ctx.restore();
	}
}
