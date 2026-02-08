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
				e.type === "flash" ||
				e.type === "noise" ||
				e.type === "vhs" ||
				e.type === "motionBlur" ||
				e.type === "radialBlur" ||
				e.type === "hueShift" ||
				e.type === "colorHalftone" ||
				e.type === "lensDistortion" ||
				e.type === "posterize"),
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
