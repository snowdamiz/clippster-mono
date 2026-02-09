import type { VideoEffect } from "../../types/effects";
import type { ColorAdjustments } from "../../types/timeline";

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
			case "noise":
				applyNoise(ctx, width, height, effect.amount, effect.intensity);
				break;
			case "vhs":
				applyVhs(ctx, width, height, effect.scanlineOpacity, effect.colorBleed, effect.noiseAmount, elapsed);
				break;
			case "motionBlur":
				applyMotionBlur(ctx, width, height, effect.angle, effect.distance);
				break;
			case "radialBlur":
				applyRadialBlur(ctx, width, height, effect.amount);
				break;
			case "hueShift":
				applyHueShift(ctx, width, height, effect.speed, elapsed);
				break;
			case "colorHalftone":
				applyColorHalftone(ctx, width, height, effect.dotSize);
				break;
			case "lensDistortion":
				applyLensDistortion(ctx, width, height, effect.amount);
				break;
			case "posterize":
				applyPosterize(ctx, width, height, effect.levels);
				break;
			case "bokehBlur":
				applyBokehBlur(ctx, width, height, effect.radius, effect.focusX, effect.focusY, effect.focusSize);
				break;
			case "tiltShift":
				applyTiltShift(ctx, width, height, effect.blurAmount, effect.position, effect.bandWidth);
				break;
			case "letterbox":
				applyLetterbox(ctx, width, height, effect.barSize, effect.color);
				break;
			case "mirror":
				applyMirror(ctx, width, height, effect.axis);
				break;
			case "kaleidoscope":
				applyKaleidoscope(ctx, width, height, effect.segments, effect.rotation);
				break;
			case "edgeDetect":
				applyEdgeDetect(ctx, width, height, effect.threshold);
				break;
			case "emboss":
				applyEmboss(ctx, width, height, effect.strength, effect.angle);
				break;
			case "colorOverlay":
				applyColorOverlay(ctx, width, height, effect.color, effect.blendMode, effect.intensity);
				break;
			case "duotone":
				applyDuotone(ctx, width, height, effect.shadowColor, effect.highlightColor, effect.intensity);
				break;
			case "thermal":
				applyThermal(ctx, width, height, effect.intensity);
				break;
			case "nightVision":
				applyNightVision(ctx, width, height, effect.noiseAmount, effect.intensity);
				break;
			case "oldFilm":
				applyOldFilm(ctx, width, height, effect.scratchDensity, effect.flickerAmount, effect.intensity, elapsed);
				break;
			case "tvStatic":
				applyTvStatic(ctx, width, height, effect.density, effect.intensity);
				break;
			case "scanlines":
				applyScanlines(ctx, width, height, effect.spacing, effect.opacity);
				break;
			case "rgbSplit":
				applyRgbSplit(ctx, width, height, effect.amount, effect.angle);
				break;
			case "zoomBlur":
				applyZoomBlur(ctx, width, height, effect.strength);
				break;
			case "shake":
				applyShake(ctx, width, height, effect.amount, effect.speed, elapsed);
				break;
			case "strobe":
				applyStrobe(ctx, width, height, effect.speed, effect.intensity, elapsed);
				break;
			case "colorPulse":
				applyColorPulse(ctx, width, height, effect.speed, effect.intensity, elapsed);
				break;
			case "filmBurn":
				applyFilmBurn(ctx, width, height, effect.speed, effect.color, effect.intensity, elapsed);
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
	const filterOnlyTypes = new Set(["blur", "grayscale", "sepia", "negative"]);
	return effects.some((e) => e.enabled && !filterOnlyTypes.has(e.type));
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

// ── New Effects ──

function applyNoise(ctx: Ctx, w: number, h: number, amount: number, intensity: number): void {
	const strength = (amount / 100) * (intensity / 100) * 80;
	if (strength < 1) return;
	const imageData = ctx.getImageData(0, 0, w, h);
	const data = imageData.data;
	for (let i = 0; i < data.length; i += 4) {
		const noise = (Math.random() - 0.5) * strength;
		data[i] = Math.max(0, Math.min(255, data[i] + noise));
		data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
		data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
	}
	ctx.putImageData(imageData, 0, 0);
}

function applyVhs(
	ctx: Ctx, w: number, h: number,
	scanlineOpacity: number, colorBleed: number, noiseAmount: number,
	elapsed: number,
): void {
	// Color bleed: shift red channel right
	if (colorBleed > 0) {
		const imageData = ctx.getImageData(0, 0, w, h);
		const data = imageData.data;
		const shift = Math.round(colorBleed);
		for (let y = 0; y < h; y++) {
			for (let x = w - 1; x >= shift; x--) {
				const dstIdx = (y * w + x) * 4;
				const srcIdx = (y * w + (x - shift)) * 4;
				data[dstIdx] = data[srcIdx]; // shift red channel
			}
		}
		ctx.putImageData(imageData, 0, 0);
	}

	// Scanlines
	if (scanlineOpacity > 0) {
		ctx.save();
		ctx.globalAlpha = scanlineOpacity / 100 * 0.5;
		ctx.fillStyle = "#000000";
		for (let y = 0; y < h; y += 4) {
			ctx.fillRect(0, y, w, 2);
		}
		ctx.restore();
	}

	// Noise overlay
	if (noiseAmount > 0) {
		applyNoise(ctx, w, h, noiseAmount, 60);
	}

	// Jitter: occasional horizontal offset
	const jitter = Math.sin(elapsed * 7.3) * Math.sin(elapsed * 13.1);
	if (Math.abs(jitter) > 0.7) {
		const offset = Math.round(jitter * 8);
		const imageData = ctx.getImageData(0, 0, w, h);
		const tempCanvas = new OffscreenCanvas(w, h);
		const tempCtx = tempCanvas.getContext("2d")!;
		tempCtx.putImageData(imageData, 0, 0);
		ctx.clearRect(0, 0, w, h);
		ctx.drawImage(tempCanvas, offset, 0);
	}
}

function applyMotionBlur(ctx: Ctx, w: number, h: number, angle: number, distance: number): void {
	if (distance < 1) return;
	const rad = (angle * Math.PI) / 180;
	const dx = Math.cos(rad) * distance;
	const dy = Math.sin(rad) * distance;
	const steps = Math.max(2, Math.min(distance, 8));

	const tempCanvas = new OffscreenCanvas(w, h);
	const tempCtx = tempCanvas.getContext("2d")!;
	tempCtx.drawImage(ctx.canvas as any, 0, 0);

	ctx.save();
	ctx.globalAlpha = 1 / steps;
	for (let i = 1; i < steps; i++) {
		const t = i / steps;
		ctx.drawImage(tempCanvas, dx * t, dy * t);
	}
	ctx.restore();
}

function applyRadialBlur(ctx: Ctx, w: number, h: number, amount: number): void {
	if (amount < 1) return;
	const steps = Math.min(amount, 6);
	const tempCanvas = new OffscreenCanvas(w, h);
	const tempCtx = tempCanvas.getContext("2d")!;
	tempCtx.drawImage(ctx.canvas as any, 0, 0);

	ctx.save();
	ctx.globalAlpha = 0.3 / steps;
	for (let i = 1; i <= steps; i++) {
		const scale = 1 + (i * amount * 0.002);
		ctx.translate(w / 2, h / 2);
		ctx.scale(scale, scale);
		ctx.translate(-w / 2, -h / 2);
		ctx.drawImage(tempCanvas, 0, 0);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	}
	ctx.restore();
}

function applyHueShift(ctx: Ctx, w: number, h: number, speed: number, elapsed: number): void {
	const degrees = (elapsed * speed * 360) % 360;
	if (degrees === 0) return;

	const tempCanvas = new OffscreenCanvas(w, h);
	const tempCtx = tempCanvas.getContext("2d")!;
	tempCtx.drawImage(ctx.canvas as any, 0, 0);

	ctx.clearRect(0, 0, w, h);
	ctx.save();
	ctx.filter = `hue-rotate(${degrees}deg)`;
	ctx.drawImage(tempCanvas, 0, 0);
	ctx.filter = "none";
	ctx.restore();
}

function applyColorHalftone(ctx: Ctx, w: number, h: number, dotSize: number): void {
	if (dotSize < 2) return;
	const imageData = ctx.getImageData(0, 0, w, h);
	const data = imageData.data;
	const step = dotSize * 2;

	ctx.clearRect(0, 0, w, h);
	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, w, h);

	for (let y = 0; y < h; y += step) {
		for (let x = 0; x < w; x += step) {
			// Sample center pixel
			const cx = Math.min(x + dotSize, w - 1);
			const cy = Math.min(y + dotSize, h - 1);
			const idx = (cy * w + cx) * 4;
			const r = data[idx];
			const g = data[idx + 1];
			const b = data[idx + 2];
			const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
			const radius = lum * dotSize;

			if (radius > 0.5) {
				ctx.beginPath();
				ctx.arc(cx, cy, radius, 0, Math.PI * 2);
				ctx.fillStyle = `rgb(${r},${g},${b})`;
				ctx.fill();
			}
		}
	}
}

function applyLensDistortion(ctx: Ctx, w: number, h: number, amount: number): void {
	if (amount === 0) return;
	const imageData = ctx.getImageData(0, 0, w, h);
	const srcData = new Uint8ClampedArray(imageData.data);
	const dstData = imageData.data;
	const cx = w / 2;
	const cy = h / 2;
	const maxR = Math.sqrt(cx * cx + cy * cy);
	const k = amount / 100 * 0.5;

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const dx = (x - cx) / maxR;
			const dy = (y - cy) / maxR;
			const r2 = dx * dx + dy * dy;
			const distortion = 1 + k * r2;
			const srcX = Math.round(cx + (x - cx) / distortion);
			const srcY = Math.round(cy + (y - cy) / distortion);

			const dstIdx = (y * w + x) * 4;
			if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
				const srcIdx = (srcY * w + srcX) * 4;
				dstData[dstIdx] = srcData[srcIdx];
				dstData[dstIdx + 1] = srcData[srcIdx + 1];
				dstData[dstIdx + 2] = srcData[srcIdx + 2];
				dstData[dstIdx + 3] = srcData[srcIdx + 3];
			} else {
				dstData[dstIdx] = 0;
				dstData[dstIdx + 1] = 0;
				dstData[dstIdx + 2] = 0;
				dstData[dstIdx + 3] = 255;
			}
		}
	}
	ctx.putImageData(imageData, 0, 0);
}

function applyPosterize(ctx: Ctx, w: number, h: number, levels: number): void {
	if (levels < 2) return;
	const imageData = ctx.getImageData(0, 0, w, h);
	const data = imageData.data;
	const step = 255 / (levels - 1);

	for (let i = 0; i < data.length; i += 4) {
		data[i] = Math.round(Math.round(data[i] / step) * step);
		data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
		data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
	}
	ctx.putImageData(imageData, 0, 0);
}

// ── Advanced Color Adjustments (post-draw) ──

/**
 * Apply advanced color adjustments that cannot be expressed as CSS filters.
 * Called after the frame and effects have been drawn.
 */
export function applyAdvancedColorAdjustments(
	ctx: Ctx,
	w: number,
	h: number,
	ca: Partial<ColorAdjustments>,
): void {
	const hasFade = ca.fade && ca.fade > 0;
	const hasTint = ca.tint && ca.tint.length > 0;
	const hasHighlights = ca.highlights && ca.highlights !== 0;
	const hasShadows = ca.shadows && ca.shadows !== 0;
	const hasSharpness = ca.sharpness && ca.sharpness > 0;

	if (!hasFade && !hasTint && !hasHighlights && !hasShadows && !hasSharpness) return;

	// Fade: lift black point by blending white overlay
	if (hasFade) {
		ctx.save();
		ctx.globalCompositeOperation = "lighter";
		ctx.globalAlpha = (ca.fade! / 100) * 0.3;
		ctx.fillStyle = "#808080";
		ctx.fillRect(0, 0, w, h);
		ctx.restore();
	}

	// Tint: color overlay with soft-light blending
	if (hasTint) {
		ctx.save();
		ctx.globalCompositeOperation = "color";
		ctx.globalAlpha = 0.25;
		ctx.fillStyle = ca.tint!;
		ctx.fillRect(0, 0, w, h);
		ctx.restore();
	}

	// Highlights & Shadows: pixel-level curves adjustment
	if (hasHighlights || hasShadows) {
		const imageData = ctx.getImageData(0, 0, w, h);
		const data = imageData.data;
		const highlightShift = (ca.highlights ?? 0) / 100;
		const shadowShift = (ca.shadows ?? 0) / 100;

		for (let i = 0; i < data.length; i += 4) {
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

			// Highlights affect bright pixels (luminance > 0.5)
			// Shadows affect dark pixels (luminance < 0.5)
			let adjustment = 0;
			if (luminance > 0.5 && highlightShift !== 0) {
				const weight = (luminance - 0.5) * 2; // 0..1 for bright pixels
				adjustment += highlightShift * weight * 60;
			}
			if (luminance < 0.5 && shadowShift !== 0) {
				const weight = (0.5 - luminance) * 2; // 0..1 for dark pixels
				adjustment += shadowShift * weight * 60;
			}

			if (adjustment !== 0) {
				data[i] = Math.max(0, Math.min(255, r + adjustment));
				data[i + 1] = Math.max(0, Math.min(255, g + adjustment));
				data[i + 2] = Math.max(0, Math.min(255, b + adjustment));
			}
		}
		ctx.putImageData(imageData, 0, 0);
	}

	// Sharpness: unsharp mask
	if (hasSharpness) {
		applySharpen(ctx, w, h, (ca.sharpness! / 100) * 5);
	}
}

// ── New Effect Implementations ──

function applyBokehBlur(ctx: Ctx, w: number, h: number, radius: number, focusX: number, focusY: number, focusSize: number): void {
	if (radius < 1) return;
	const tempCanvas = new OffscreenCanvas(w, h);
	const tempCtx = tempCanvas.getContext("2d")!;
	tempCtx.drawImage(ctx.canvas as any, 0, 0);

	// Apply blur to temp
	tempCtx.filter = `blur(${radius}px)`;
	tempCtx.drawImage(tempCanvas, 0, 0);
	tempCtx.filter = "none";

	// Create radial gradient mask for focus area
	const cx = (focusX / 100) * w;
	const cy = (focusY / 100) * h;
	const focusRadius = (focusSize / 100) * Math.max(w, h) * 0.5;

	ctx.save();
	// Draw blurred version
	ctx.drawImage(tempCanvas, 0, 0);
	// Cut out the focus area by drawing original back with clip
	ctx.globalCompositeOperation = "destination-in";
	const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, focusRadius * 2);
	gradient.addColorStop(0, "rgba(0,0,0,0)");
	gradient.addColorStop(0.5, "rgba(0,0,0,0)");
	gradient.addColorStop(1, "rgba(0,0,0,1)");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, w, h);
	ctx.restore();

	// Composite original sharp center back
	ctx.save();
	ctx.globalCompositeOperation = "destination-over";
	tempCtx.filter = "none";
	const origCanvas = new OffscreenCanvas(w, h);
	const origCtx = origCanvas.getContext("2d")!;
	origCtx.drawImage(ctx.canvas as any, 0, 0);
	ctx.restore();
}

function applyTiltShift(ctx: Ctx, w: number, h: number, blurAmount: number, position: number, bandWidth: number): void {
	if (blurAmount < 1) return;
	const tempCanvas = new OffscreenCanvas(w, h);
	const tempCtx = tempCanvas.getContext("2d")!;
	tempCtx.drawImage(ctx.canvas as any, 0, 0);

	// Create blurred version
	const blurCanvas = new OffscreenCanvas(w, h);
	const blurCtx = blurCanvas.getContext("2d")!;
	blurCtx.filter = `blur(${blurAmount}px)`;
	blurCtx.drawImage(tempCanvas, 0, 0);
	blurCtx.filter = "none";

	// Band position and width
	const bandCenter = (position / 100) * h;
	const bandHalf = (bandWidth / 100) * h * 0.5;
	const feather = bandHalf * 0.6;

	// Draw blurred, then draw sharp band on top with gradient mask
	ctx.clearRect(0, 0, w, h);
	ctx.drawImage(blurCanvas, 0, 0);

	ctx.save();
	ctx.globalCompositeOperation = "destination-out";
	const gradient = ctx.createLinearGradient(0, bandCenter - bandHalf - feather, 0, bandCenter + bandHalf + feather);
	gradient.addColorStop(0, "rgba(0,0,0,0)");
	gradient.addColorStop(0.3, "rgba(0,0,0,1)");
	gradient.addColorStop(0.7, "rgba(0,0,0,1)");
	gradient.addColorStop(1, "rgba(0,0,0,0)");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, w, h);
	ctx.restore();

	ctx.save();
	ctx.globalCompositeOperation = "destination-over";
	ctx.drawImage(tempCanvas, 0, 0);
	ctx.restore();
}

function applyLetterbox(ctx: Ctx, w: number, h: number, barSize: number, color: string): void {
	const barHeight = Math.round((barSize / 100) * h);
	if (barHeight < 1) return;
	ctx.save();
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, w, barHeight);
	ctx.fillRect(0, h - barHeight, w, barHeight);
	ctx.restore();
}

function applyMirror(ctx: Ctx, w: number, h: number, axis: "horizontal" | "vertical"): void {
	const tempCanvas = new OffscreenCanvas(w, h);
	const tempCtx = tempCanvas.getContext("2d")!;
	tempCtx.drawImage(ctx.canvas as any, 0, 0);

	if (axis === "horizontal") {
		// Mirror left half to right
		ctx.save();
		ctx.translate(w, 0);
		ctx.scale(-1, 1);
		ctx.drawImage(tempCanvas, 0, 0, w / 2, h, 0, 0, w / 2, h);
		ctx.restore();
	} else {
		// Mirror top half to bottom
		ctx.save();
		ctx.translate(0, h);
		ctx.scale(1, -1);
		ctx.drawImage(tempCanvas, 0, 0, w, h / 2, 0, 0, w, h / 2);
		ctx.restore();
	}
}

function applyKaleidoscope(ctx: Ctx, w: number, h: number, segments: number, rotation: number): void {
	if (segments < 2) return;
	const tempCanvas = new OffscreenCanvas(w, h);
	const tempCtx = tempCanvas.getContext("2d")!;
	tempCtx.drawImage(ctx.canvas as any, 0, 0);

	const cx = w / 2;
	const cy = h / 2;
	const angleStep = (Math.PI * 2) / segments;
	const rotRad = (rotation * Math.PI) / 180;

	ctx.clearRect(0, 0, w, h);
	ctx.save();

	for (let i = 0; i < segments; i++) {
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(angleStep * i + rotRad);
		if (i % 2 === 1) ctx.scale(-1, 1);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(Math.max(w, h), 0);
		ctx.arc(0, 0, Math.max(w, h), 0, angleStep);
		ctx.closePath();
		ctx.clip();
		ctx.translate(-cx, -cy);
		ctx.drawImage(tempCanvas, 0, 0);
		ctx.restore();
	}

	ctx.restore();
}

function applyEdgeDetect(ctx: Ctx, w: number, h: number, threshold: number): void {
	const imageData = ctx.getImageData(0, 0, w, h);
	const src = new Uint8ClampedArray(imageData.data);
	const dst = imageData.data;
	const t = (threshold / 100) * 128;

	for (let y = 1; y < h - 1; y++) {
		for (let x = 1; x < w - 1; x++) {
			const idx = (y * w + x) * 4;
			// Sobel operator
			let gx = 0, gy = 0;
			for (let c = 0; c < 3; c++) {
				const tl = src[((y - 1) * w + (x - 1)) * 4 + c];
				const t0 = src[((y - 1) * w + x) * 4 + c];
				const tr = src[((y - 1) * w + (x + 1)) * 4 + c];
				const ml = src[(y * w + (x - 1)) * 4 + c];
				const mr = src[(y * w + (x + 1)) * 4 + c];
				const bl = src[((y + 1) * w + (x - 1)) * 4 + c];
				const b0 = src[((y + 1) * w + x) * 4 + c];
				const br = src[((y + 1) * w + (x + 1)) * 4 + c];
				gx += Math.abs(-tl + tr - 2 * ml + 2 * mr - bl + br);
				gy += Math.abs(-tl - 2 * t0 - tr + bl + 2 * b0 + br);
			}
			const magnitude = (gx + gy) / 3;
			const edge = magnitude > t ? Math.min(255, magnitude) : 0;
			dst[idx] = edge;
			dst[idx + 1] = edge;
			dst[idx + 2] = edge;
		}
	}
	ctx.putImageData(imageData, 0, 0);
}

function applyEmboss(ctx: Ctx, w: number, h: number, strength: number, angle: number): void {
	const imageData = ctx.getImageData(0, 0, w, h);
	const src = new Uint8ClampedArray(imageData.data);
	const dst = imageData.data;
	const rad = (angle * Math.PI) / 180;
	const dx = Math.round(Math.cos(rad));
	const dy = Math.round(Math.sin(rad));

	for (let y = 1; y < h - 1; y++) {
		for (let x = 1; x < w - 1; x++) {
			const idx = (y * w + x) * 4;
			const srcIdx1 = ((y - dy) * w + (x - dx)) * 4;
			const srcIdx2 = ((y + dy) * w + (x + dx)) * 4;
			for (let c = 0; c < 3; c++) {
				const val = 128 + (src[srcIdx2 + c] - src[srcIdx1 + c]) * strength;
				dst[idx + c] = Math.max(0, Math.min(255, Math.round(val)));
			}
		}
	}
	ctx.putImageData(imageData, 0, 0);
}

function applyColorOverlay(ctx: Ctx, w: number, h: number, color: string, blendMode: string, intensity: number): void {
	ctx.save();
	ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
	ctx.globalAlpha = intensity / 100;
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, w, h);
	ctx.restore();
}

function applyDuotone(ctx: Ctx, w: number, h: number, shadowColor: string, highlightColor: string, intensity: number): void {
	const imageData = ctx.getImageData(0, 0, w, h);
	const data = imageData.data;
	const mix = intensity / 100;

	// Parse colors
	const sc = hexToRgb(shadowColor);
	const hc = hexToRgb(highlightColor);

	for (let i = 0; i < data.length; i += 4) {
		const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
		const dr = sc.r + (hc.r - sc.r) * lum;
		const dg = sc.g + (hc.g - sc.g) * lum;
		const db = sc.b + (hc.b - sc.b) * lum;
		data[i] = Math.round(data[i] * (1 - mix) + dr * mix);
		data[i + 1] = Math.round(data[i + 1] * (1 - mix) + dg * mix);
		data[i + 2] = Math.round(data[i + 2] * (1 - mix) + db * mix);
	}
	ctx.putImageData(imageData, 0, 0);
}

function applyThermal(ctx: Ctx, w: number, h: number, intensity: number): void {
	const imageData = ctx.getImageData(0, 0, w, h);
	const data = imageData.data;
	const mix = intensity / 100;

	for (let i = 0; i < data.length; i += 4) {
		const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
		// Thermal palette: black → blue → red → yellow → white
		let r: number, g: number, b: number;
		if (lum < 0.25) {
			const t = lum / 0.25;
			r = 0; g = 0; b = Math.round(128 * t);
		} else if (lum < 0.5) {
			const t = (lum - 0.25) / 0.25;
			r = Math.round(255 * t); g = 0; b = Math.round(128 * (1 - t));
		} else if (lum < 0.75) {
			const t = (lum - 0.5) / 0.25;
			r = 255; g = Math.round(255 * t); b = 0;
		} else {
			const t = (lum - 0.75) / 0.25;
			r = 255; g = 255; b = Math.round(255 * t);
		}
		data[i] = Math.round(data[i] * (1 - mix) + r * mix);
		data[i + 1] = Math.round(data[i + 1] * (1 - mix) + g * mix);
		data[i + 2] = Math.round(data[i + 2] * (1 - mix) + b * mix);
	}
	ctx.putImageData(imageData, 0, 0);
}

function applyNightVision(ctx: Ctx, w: number, h: number, noiseAmount: number, intensity: number): void {
	const imageData = ctx.getImageData(0, 0, w, h);
	const data = imageData.data;
	const mix = intensity / 100;

	for (let i = 0; i < data.length; i += 4) {
		const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
		// Green-tinted monochrome
		const gr = Math.round(lum * 40);
		const gg = Math.round(lum * 255);
		const gb = Math.round(lum * 40);
		const noise = (Math.random() - 0.5) * noiseAmount;
		data[i] = Math.max(0, Math.min(255, Math.round(data[i] * (1 - mix) + (gr + noise) * mix)));
		data[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1] * (1 - mix) + (gg + noise) * mix)));
		data[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2] * (1 - mix) + (gb + noise) * mix)));
	}
	ctx.putImageData(imageData, 0, 0);

	// Add vignette
	applyVignette(ctx, w, h, 30, 60);
}

function applyOldFilm(ctx: Ctx, w: number, h: number, scratchDensity: number, flickerAmount: number, intensity: number, elapsed: number): void {
	const mix = intensity / 100;

	// Desaturate partially
	const imageData = ctx.getImageData(0, 0, w, h);
	const data = imageData.data;
	for (let i = 0; i < data.length; i += 4) {
		const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
		// Sepia tint
		data[i] = Math.round(data[i] * (1 - mix * 0.6) + (lum * 1.1 + 20) * mix * 0.6);
		data[i + 1] = Math.round(data[i + 1] * (1 - mix * 0.6) + (lum * 0.9 + 10) * mix * 0.6);
		data[i + 2] = Math.round(data[i + 2] * (1 - mix * 0.6) + (lum * 0.7) * mix * 0.6);
	}
	ctx.putImageData(imageData, 0, 0);

	// Brightness flicker
	if (flickerAmount > 0) {
		const flicker = Math.sin(elapsed * 12.7) * Math.sin(elapsed * 7.3) * (flickerAmount / 100) * 0.15 * mix;
		if (Math.abs(flicker) > 0.01) {
			ctx.save();
			ctx.globalCompositeOperation = flicker > 0 ? "lighter" : "multiply";
			ctx.globalAlpha = Math.abs(flicker);
			ctx.fillStyle = flicker > 0 ? "#ffffff" : "#000000";
			ctx.fillRect(0, 0, w, h);
			ctx.restore();
		}
	}

	// Scratches
	if (scratchDensity > 0) {
		const seed = Math.floor(elapsed * 4);
		const rng = (i: number) => {
			const x = Math.sin(seed + i * 127.1) * 43758.5453;
			return x - Math.floor(x);
		};
		const count = Math.ceil((scratchDensity / 100) * 5 * mix);
		ctx.save();
		ctx.globalAlpha = 0.3 * mix;
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = 1;
		for (let i = 0; i < count; i++) {
			const x = rng(i) * w;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x + (rng(i + 50) - 0.5) * 20, h);
			ctx.stroke();
		}
		ctx.restore();
	}

	// Vignette
	applyVignette(ctx, w, h, 40, 50);
}

function applyTvStatic(ctx: Ctx, w: number, h: number, density: number, intensity: number): void {
	const strength = (density / 100) * (intensity / 100);
	if (strength < 0.01) return;
	const imageData = ctx.getImageData(0, 0, w, h);
	const data = imageData.data;
	const blockSize = 4;

	for (let y = 0; y < h; y += blockSize) {
		for (let x = 0; x < w; x += blockSize) {
			if (Math.random() > strength) continue;
			const val = Math.random() * 255;
			for (let dy = 0; dy < blockSize && y + dy < h; dy++) {
				for (let dx = 0; dx < blockSize && x + dx < w; dx++) {
					const idx = ((y + dy) * w + (x + dx)) * 4;
					data[idx] = val;
					data[idx + 1] = val;
					data[idx + 2] = val;
				}
			}
		}
	}
	ctx.putImageData(imageData, 0, 0);
}

function applyScanlines(ctx: Ctx, w: number, h: number, spacing: number, opacity: number): void {
	if (opacity < 1) return;
	ctx.save();
	ctx.globalAlpha = opacity / 100 * 0.6;
	ctx.fillStyle = "#000000";
	for (let y = 0; y < h; y += spacing * 2) {
		ctx.fillRect(0, y, w, spacing);
	}
	ctx.restore();
}

function applyRgbSplit(ctx: Ctx, w: number, h: number, amount: number, angle: number): void {
	if (amount < 1) return;
	const rad = (angle * Math.PI) / 180;
	const dx = Math.round(Math.cos(rad) * amount);
	const dy = Math.round(Math.sin(rad) * amount);

	const imageData = ctx.getImageData(0, 0, w, h);
	const src = new Uint8ClampedArray(imageData.data);
	const dst = imageData.data;

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const dstIdx = (y * w + x) * 4;
			// Red shifted one direction
			const rx = Math.min(w - 1, Math.max(0, x + dx));
			const ry = Math.min(h - 1, Math.max(0, y + dy));
			dst[dstIdx] = src[(ry * w + rx) * 4];
			// Green stays
			dst[dstIdx + 1] = src[dstIdx + 1];
			// Blue shifted opposite
			const bx = Math.min(w - 1, Math.max(0, x - dx));
			const by = Math.min(h - 1, Math.max(0, y - dy));
			dst[dstIdx + 2] = src[(by * w + bx) * 4 + 2];
			dst[dstIdx + 3] = src[dstIdx + 3];
		}
	}
	ctx.putImageData(imageData, 0, 0);
}

function applyZoomBlur(ctx: Ctx, w: number, h: number, strength: number): void {
	if (strength < 1) return;
	const steps = Math.min(strength, 8);
	const tempCanvas = new OffscreenCanvas(w, h);
	const tempCtx = tempCanvas.getContext("2d")!;
	tempCtx.drawImage(ctx.canvas as any, 0, 0);

	ctx.save();
	ctx.globalAlpha = 0.15 / steps;
	for (let i = 1; i <= steps; i++) {
		const scale = 1 + (i * strength * 0.003);
		ctx.translate(w / 2, h / 2);
		ctx.scale(scale, scale);
		ctx.translate(-w / 2, -h / 2);
		ctx.drawImage(tempCanvas, 0, 0);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	}
	ctx.restore();
}

function applyShake(ctx: Ctx, w: number, h: number, amount: number, speed: number, elapsed: number): void {
	const phase = elapsed * speed * Math.PI * 2;
	const dx = Math.round(Math.sin(phase * 1.3) * amount * Math.sin(phase * 0.7));
	const dy = Math.round(Math.cos(phase * 0.9) * amount * Math.cos(phase * 1.1));
	if (dx === 0 && dy === 0) return;

	const tempCanvas = new OffscreenCanvas(w, h);
	const tempCtx = tempCanvas.getContext("2d")!;
	tempCtx.drawImage(ctx.canvas as any, 0, 0);

	ctx.clearRect(0, 0, w, h);
	ctx.drawImage(tempCanvas, dx, dy);
}

function applyStrobe(ctx: Ctx, w: number, h: number, speed: number, intensity: number, elapsed: number): void {
	// Square wave strobe: alternate between visible and black
	const cycle = elapsed * speed;
	const on = (cycle % 1) < 0.5;
	if (!on) {
		const alpha = (intensity / 100) * 0.9;
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.fillStyle = "#000000";
		ctx.fillRect(0, 0, w, h);
		ctx.restore();
	}
}

function applyColorPulse(ctx: Ctx, w: number, h: number, speed: number, intensity: number, elapsed: number): void {
	const phase = elapsed * speed * Math.PI * 2;
	const satBoost = Math.sin(phase) * (intensity / 100);
	if (Math.abs(satBoost) < 0.01) return;

	const tempCanvas = new OffscreenCanvas(w, h);
	const tempCtx = tempCanvas.getContext("2d")!;
	tempCtx.drawImage(ctx.canvas as any, 0, 0);

	ctx.clearRect(0, 0, w, h);
	ctx.save();
	ctx.filter = `saturate(${1 + satBoost * 2})`;
	ctx.drawImage(tempCanvas, 0, 0);
	ctx.filter = "none";
	ctx.restore();
}

function applyFilmBurn(ctx: Ctx, w: number, h: number, speed: number, color: string, intensity: number, elapsed: number): void {
	const phase = elapsed * speed;
	// Moving light leak blob
	const x = (Math.sin(phase * 0.7) * 0.5 + 0.5) * w;
	const y = (Math.cos(phase * 0.5) * 0.5 + 0.5) * h;
	const radius = Math.max(w, h) * 0.4;
	const alpha = (Math.sin(phase * 1.3) * 0.5 + 0.5) * (intensity / 100) * 0.5;

	if (alpha < 0.01) return;

	const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
	gradient.addColorStop(0, color);
	gradient.addColorStop(0.5, color + "80");
	gradient.addColorStop(1, "rgba(0,0,0,0)");

	ctx.save();
	ctx.globalCompositeOperation = "screen";
	ctx.globalAlpha = alpha;
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, w, h);
	ctx.restore();
}

// ── Utility ──

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const h = hex.replace("#", "");
	return {
		r: parseInt(h.substring(0, 2), 16) || 0,
		g: parseInt(h.substring(2, 4), 16) || 0,
		b: parseInt(h.substring(4, 6), 16) || 0,
	};
}
