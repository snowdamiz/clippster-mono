import { ref, onMounted } from "vue";

const THUMB_W = 120;
const THUMB_H = 80;

/** Draw a sample "photo" scene onto a canvas context — a landscape with sky, hills, sun */
function drawSampleScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
	// Sky gradient
	const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
	sky.addColorStop(0, "#1a1a3e");
	sky.addColorStop(1, "#3b1f6e");
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, w, h * 0.6);

	// Sun
	const sunGrad = ctx.createRadialGradient(w * 0.7, h * 0.25, 2, w * 0.7, h * 0.25, w * 0.15);
	sunGrad.addColorStop(0, "#ffcc44");
	sunGrad.addColorStop(0.5, "#ff8833");
	sunGrad.addColorStop(1, "transparent");
	ctx.fillStyle = sunGrad;
	ctx.fillRect(0, 0, w, h);

	// Hills
	ctx.fillStyle = "#1a3a2a";
	ctx.beginPath();
	ctx.moveTo(0, h * 0.55);
	ctx.quadraticCurveTo(w * 0.25, h * 0.35, w * 0.5, h * 0.5);
	ctx.quadraticCurveTo(w * 0.75, h * 0.65, w, h * 0.45);
	ctx.lineTo(w, h);
	ctx.lineTo(0, h);
	ctx.closePath();
	ctx.fill();

	// Foreground
	const ground = ctx.createLinearGradient(0, h * 0.6, 0, h);
	ground.addColorStop(0, "#0d2818");
	ground.addColorStop(1, "#0a1f14");
	ctx.fillStyle = ground;
	ctx.fillRect(0, h * 0.65, w, h * 0.35);

	// Small accent dots (stars)
	ctx.fillStyle = "rgba(255,255,255,0.6)";
	const stars = [[0.15, 0.1], [0.3, 0.18], [0.5, 0.08], [0.85, 0.15], [0.6, 0.22], [0.2, 0.28]];
	for (const [sx, sy] of stars) {
		ctx.beginPath();
		ctx.arc(w * sx, h * sy, 1, 0, Math.PI * 2);
		ctx.fill();
	}
}

/** Draw a second sample scene (warm tones) for transition "B" side */
function drawSampleSceneB(ctx: CanvasRenderingContext2D, w: number, h: number) {
	// Warm sky
	const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
	sky.addColorStop(0, "#ff6b35");
	sky.addColorStop(1, "#ffc947");
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, w, h * 0.6);

	// Water
	const water = ctx.createLinearGradient(0, h * 0.6, 0, h);
	water.addColorStop(0, "#1a6b8a");
	water.addColorStop(1, "#0d3b4f");
	ctx.fillStyle = water;
	ctx.fillRect(0, h * 0.55, w, h * 0.45);

	// Sun reflection
	ctx.fillStyle = "rgba(255,200,70,0.3)";
	ctx.fillRect(w * 0.4, h * 0.55, w * 0.2, h * 0.45);

	// Sun
	ctx.fillStyle = "#fff4cc";
	ctx.beginPath();
	ctx.arc(w * 0.5, h * 0.35, w * 0.08, 0, Math.PI * 2);
	ctx.fill();
}

function applyEffectToCanvas(
	ctx: CanvasRenderingContext2D,
	effectType: string,
	w: number,
	h: number,
) {
	switch (effectType) {
		case "blur": {
			ctx.filter = "blur(3px)";
			const imgData = ctx.getImageData(0, 0, w, h);
			ctx.putImageData(imgData, 0, 0);
			// Re-draw with filter
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = w;
			tempCanvas.height = h;
			const tCtx = tempCanvas.getContext("2d")!;
			tCtx.drawImage(ctx.canvas, 0, 0);
			ctx.filter = "blur(3px)";
			ctx.clearRect(0, 0, w, h);
			ctx.drawImage(tempCanvas, 0, 0);
			ctx.filter = "none";
			break;
		}
		case "pixelate": {
			const blockSize = 8;
			const imgData = ctx.getImageData(0, 0, w, h);
			const d = imgData.data;
			for (let y = 0; y < h; y += blockSize) {
				for (let x = 0; x < w; x += blockSize) {
					const i = (y * w + x) * 4;
					const r = d[i], g = d[i + 1], b = d[i + 2];
					ctx.fillStyle = `rgb(${r},${g},${b})`;
					ctx.fillRect(x, y, blockSize, blockSize);
				}
			}
			break;
		}
		case "sharpen": {
			// Show a high-contrast overlay to suggest sharpening
			ctx.globalCompositeOperation = "overlay";
			ctx.fillStyle = "rgba(255,255,255,0.15)";
			ctx.fillRect(0, 0, w, h);
			ctx.globalCompositeOperation = "source-over";
			break;
		}
		case "sepia": {
			ctx.filter = "sepia(0.85)";
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = w;
			tempCanvas.height = h;
			const tCtx = tempCanvas.getContext("2d")!;
			tCtx.drawImage(ctx.canvas, 0, 0);
			ctx.clearRect(0, 0, w, h);
			ctx.drawImage(tempCanvas, 0, 0);
			ctx.filter = "none";
			break;
		}
		case "grayscale": {
			ctx.filter = "grayscale(1)";
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = w;
			tempCanvas.height = h;
			const tCtx = tempCanvas.getContext("2d")!;
			tCtx.drawImage(ctx.canvas, 0, 0);
			ctx.clearRect(0, 0, w, h);
			ctx.drawImage(tempCanvas, 0, 0);
			ctx.filter = "none";
			break;
		}
		case "negative": {
			ctx.filter = "invert(1)";
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = w;
			tempCanvas.height = h;
			const tCtx = tempCanvas.getContext("2d")!;
			tCtx.drawImage(ctx.canvas, 0, 0);
			ctx.clearRect(0, 0, w, h);
			ctx.drawImage(tempCanvas, 0, 0);
			ctx.filter = "none";
			break;
		}
		case "vignette": {
			const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.6);
			grad.addColorStop(0, "transparent");
			grad.addColorStop(1, "rgba(0,0,0,0.7)");
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, w, h);
			break;
		}
		case "wave": {
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = w;
			tempCanvas.height = h;
			const tCtx = tempCanvas.getContext("2d")!;
			tCtx.drawImage(ctx.canvas, 0, 0);
			const imgData = tCtx.getImageData(0, 0, w, h);
			ctx.clearRect(0, 0, w, h);
			const outData = ctx.createImageData(w, h);
			for (let y = 0; y < h; y++) {
				const shift = Math.round(Math.sin(y * 0.15) * 5);
				for (let x = 0; x < w; x++) {
					const srcX = Math.min(Math.max(x + shift, 0), w - 1);
					const si = (y * w + srcX) * 4;
					const di = (y * w + x) * 4;
					outData.data[di] = imgData.data[si];
					outData.data[di + 1] = imgData.data[si + 1];
					outData.data[di + 2] = imgData.data[si + 2];
					outData.data[di + 3] = imgData.data[si + 3];
				}
			}
			ctx.putImageData(outData, 0, 0);
			break;
		}
		case "glitch": {
			// Horizontal slice displacement + color channel offset
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = w;
			tempCanvas.height = h;
			const tCtx = tempCanvas.getContext("2d")!;
			tCtx.drawImage(ctx.canvas, 0, 0);
			// Draw displaced slices
			const sliceH = Math.ceil(h / 6);
			for (let i = 0; i < 6; i++) {
				const offset = (i % 2 === 0 ? 1 : -1) * (3 + i * 2);
				ctx.drawImage(tempCanvas, 0, i * sliceH, w, sliceH, offset, i * sliceH, w, sliceH);
			}
			// Red/cyan channel shift
			ctx.globalCompositeOperation = "screen";
			ctx.fillStyle = "rgba(255,0,0,0.08)";
			ctx.fillRect(3, 0, w, h);
			ctx.fillStyle = "rgba(0,255,255,0.08)";
			ctx.fillRect(-3, 0, w, h);
			ctx.globalCompositeOperation = "source-over";
			break;
		}
		case "colorShift": {
			// Chromatic aberration — red/blue offset
			ctx.globalCompositeOperation = "screen";
			ctx.fillStyle = "rgba(255,0,0,0.12)";
			ctx.fillRect(3, 0, w, h);
			ctx.fillStyle = "rgba(0,100,255,0.12)";
			ctx.fillRect(-3, 0, w, h);
			ctx.globalCompositeOperation = "source-over";
			break;
		}
		case "zoomPulse": {
			// Show a slightly zoomed version with radial lines
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = w;
			tempCanvas.height = h;
			const tCtx = tempCanvas.getContext("2d")!;
			tCtx.drawImage(ctx.canvas, 0, 0);
			ctx.clearRect(0, 0, w, h);
			const s = 1.08;
			ctx.drawImage(tempCanvas, -(w * (s - 1)) / 2, -(h * (s - 1)) / 2, w * s, h * s);
			// Radial lines hint
			ctx.strokeStyle = "rgba(255,255,255,0.1)";
			ctx.lineWidth = 0.5;
			for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
				ctx.beginPath();
				ctx.moveTo(w / 2, h / 2);
				ctx.lineTo(w / 2 + Math.cos(a) * w, h / 2 + Math.sin(a) * h);
				ctx.stroke();
			}
			break;
		}
		case "flash": {
			ctx.fillStyle = "rgba(255,255,255,0.35)";
			ctx.fillRect(0, 0, w, h);
			break;
		}
		case "noise": {
			const imgData = ctx.getImageData(0, 0, w, h);
			const d = imgData.data;
			for (let i = 0; i < d.length; i += 4) {
				const n = (Math.random() - 0.5) * 60;
				d[i] += n;
				d[i + 1] += n;
				d[i + 2] += n;
			}
			ctx.putImageData(imgData, 0, 0);
			break;
		}
		case "vhs": {
			// Scanlines + slight color bleed
			for (let y = 0; y < h; y += 2) {
				ctx.fillStyle = "rgba(0,0,0,0.15)";
				ctx.fillRect(0, y, w, 1);
			}
			ctx.globalCompositeOperation = "screen";
			ctx.fillStyle = "rgba(255,0,0,0.06)";
			ctx.fillRect(2, 0, w, h);
			ctx.fillStyle = "rgba(0,255,255,0.06)";
			ctx.fillRect(-2, 0, w, h);
			ctx.globalCompositeOperation = "source-over";
			// Noise
			const imgData = ctx.getImageData(0, 0, w, h);
			const d = imgData.data;
			for (let i = 0; i < d.length; i += 16) {
				const n = (Math.random() - 0.5) * 30;
				d[i] += n;
				d[i + 1] += n;
				d[i + 2] += n;
			}
			ctx.putImageData(imgData, 0, 0);
			break;
		}
		case "posterize": {
			const imgData = ctx.getImageData(0, 0, w, h);
			const d = imgData.data;
			const levels = 5;
			const step = 255 / levels;
			for (let i = 0; i < d.length; i += 4) {
				d[i] = Math.round(d[i] / step) * step;
				d[i + 1] = Math.round(d[i + 1] / step) * step;
				d[i + 2] = Math.round(d[i + 2] / step) * step;
			}
			ctx.putImageData(imgData, 0, 0);
			break;
		}
		case "colorHalftone": {
			const imgData = ctx.getImageData(0, 0, w, h);
			ctx.clearRect(0, 0, w, h);
			ctx.fillStyle = "#111";
			ctx.fillRect(0, 0, w, h);
			const dotSpacing = 5;
			for (let y = 0; y < h; y += dotSpacing) {
				for (let x = 0; x < w; x += dotSpacing) {
					const i = (y * w + x) * 4;
					const r = imgData.data[i], g = imgData.data[i + 1], b = imgData.data[i + 2];
					const brightness = (r + g + b) / 3 / 255;
					const radius = brightness * dotSpacing * 0.45;
					ctx.fillStyle = `rgb(${r},${g},${b})`;
					ctx.beginPath();
					ctx.arc(x + dotSpacing / 2, y + dotSpacing / 2, radius, 0, Math.PI * 2);
					ctx.fill();
				}
			}
			break;
		}
		case "motionBlur": {
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = w;
			tempCanvas.height = h;
			const tCtx = tempCanvas.getContext("2d")!;
			tCtx.drawImage(ctx.canvas, 0, 0);
			ctx.globalAlpha = 0.3;
			for (let i = 1; i <= 4; i++) {
				ctx.drawImage(tempCanvas, i * 2, 0);
			}
			ctx.globalAlpha = 1;
			break;
		}
		case "radialBlur": {
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = w;
			tempCanvas.height = h;
			const tCtx = tempCanvas.getContext("2d")!;
			tCtx.drawImage(ctx.canvas, 0, 0);
			ctx.globalAlpha = 0.25;
			for (let i = 1; i <= 3; i++) {
				const s = 1 + i * 0.015;
				ctx.drawImage(tempCanvas, -(w * (s - 1)) / 2, -(h * (s - 1)) / 2, w * s, h * s);
			}
			ctx.globalAlpha = 1;
			break;
		}
		case "hueShift": {
			ctx.filter = "hue-rotate(120deg)";
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = w;
			tempCanvas.height = h;
			const tCtx = tempCanvas.getContext("2d")!;
			tCtx.drawImage(ctx.canvas, 0, 0);
			ctx.clearRect(0, 0, w, h);
			ctx.drawImage(tempCanvas, 0, 0);
			ctx.filter = "none";
			break;
		}
		case "lensDistortion": {
			// Barrel distortion approximation
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = w;
			tempCanvas.height = h;
			const tCtx = tempCanvas.getContext("2d")!;
			tCtx.drawImage(ctx.canvas, 0, 0);
			ctx.clearRect(0, 0, w, h);
			// Draw slightly scaled center + dark edges
			ctx.drawImage(tempCanvas, -w * 0.04, -h * 0.04, w * 1.08, h * 1.08);
			// Dark rounded corners
			ctx.globalCompositeOperation = "destination-in";
			const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.55);
			grad.addColorStop(0, "white");
			grad.addColorStop(0.85, "white");
			grad.addColorStop(1, "rgba(255,255,255,0.3)");
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, w, h);
			ctx.globalCompositeOperation = "source-over";
			break;
		}
		default:
			break;
	}
}

function renderTransitionPreview(
	ctx: CanvasRenderingContext2D,
	transitionType: string,
	w: number,
	h: number,
) {
	// Draw scene A on left half, scene B on right half with transition effect in middle
	const tempA = document.createElement("canvas");
	tempA.width = w;
	tempA.height = h;
	const ctxA = tempA.getContext("2d")!;
	drawSampleScene(ctxA, w, h);

	const tempB = document.createElement("canvas");
	tempB.width = w;
	tempB.height = h;
	const ctxB = tempB.getContext("2d")!;
	drawSampleSceneB(ctxB, w, h);

	// Show transition at ~50% progress
	const progress = 0.5;

	switch (transitionType) {
		case "crossfade": {
			ctx.drawImage(tempA, 0, 0);
			ctx.globalAlpha = progress;
			ctx.drawImage(tempB, 0, 0);
			ctx.globalAlpha = 1;
			break;
		}
		case "fadeToBlack": {
			// Left half: scene A fading to black, right half: scene B fading from black
			ctx.drawImage(tempA, 0, 0, w / 2, h, 0, 0, w / 2, h);
			ctx.fillStyle = `rgba(0,0,0,${progress * 0.8})`;
			ctx.fillRect(0, 0, w / 2, h);
			ctx.drawImage(tempB, w / 2, 0, w / 2, h, w / 2, 0, w / 2, h);
			ctx.fillStyle = `rgba(0,0,0,${(1 - progress) * 0.8})`;
			ctx.fillRect(w / 2, 0, w / 2, h);
			// Center divider
			ctx.fillStyle = "rgba(0,0,0,0.9)";
			ctx.fillRect(w / 2 - 2, 0, 4, h);
			break;
		}
		case "fadeToWhite": {
			ctx.drawImage(tempA, 0, 0, w / 2, h, 0, 0, w / 2, h);
			ctx.fillStyle = `rgba(255,255,255,${progress * 0.8})`;
			ctx.fillRect(0, 0, w / 2, h);
			ctx.drawImage(tempB, w / 2, 0, w / 2, h, w / 2, 0, w / 2, h);
			ctx.fillStyle = `rgba(255,255,255,${(1 - progress) * 0.8})`;
			ctx.fillRect(w / 2, 0, w / 2, h);
			ctx.fillStyle = "rgba(255,255,255,0.9)";
			ctx.fillRect(w / 2 - 2, 0, 4, h);
			break;
		}
		case "dissolve": {
			ctx.drawImage(tempA, 0, 0);
			// Random pixel dissolve
			const imgB = ctxB.getImageData(0, 0, w, h);
			const imgOut = ctx.getImageData(0, 0, w, h);
			for (let i = 0; i < imgOut.data.length; i += 4) {
				if (Math.random() < progress) {
					imgOut.data[i] = imgB.data[i];
					imgOut.data[i + 1] = imgB.data[i + 1];
					imgOut.data[i + 2] = imgB.data[i + 2];
				}
			}
			ctx.putImageData(imgOut, 0, 0);
			break;
		}
		case "slideLeft": {
			const offset = w * progress;
			ctx.drawImage(tempA, -offset, 0);
			ctx.drawImage(tempB, w - offset, 0);
			break;
		}
		case "slideRight": {
			const offset = w * progress;
			ctx.drawImage(tempA, offset, 0);
			ctx.drawImage(tempB, -(w - offset), 0);
			break;
		}
		case "slideUp": {
			const offset = h * progress;
			ctx.drawImage(tempA, 0, -offset);
			ctx.drawImage(tempB, 0, h - offset);
			break;
		}
		case "slideDown": {
			const offset = h * progress;
			ctx.drawImage(tempA, 0, offset);
			ctx.drawImage(tempB, 0, -(h - offset));
			break;
		}
		case "wipeLeft": {
			const boundary = w * (1 - progress);
			ctx.drawImage(tempA, 0, 0);
			ctx.save();
			ctx.beginPath();
			ctx.rect(0, 0, boundary, h);
			ctx.clip();
			ctx.drawImage(tempB, 0, 0);
			ctx.restore();
			// Wipe edge
			ctx.fillStyle = "rgba(255,255,255,0.4)";
			ctx.fillRect(boundary - 1, 0, 2, h);
			break;
		}
		case "wipeRight": {
			const boundary = w * progress;
			ctx.drawImage(tempA, 0, 0);
			ctx.save();
			ctx.beginPath();
			ctx.rect(boundary, 0, w - boundary, h);
			ctx.clip();
			ctx.drawImage(tempB, 0, 0);
			ctx.restore();
			ctx.fillStyle = "rgba(255,255,255,0.4)";
			ctx.fillRect(boundary - 1, 0, 2, h);
			break;
		}
		case "wipeUp": {
			const boundary = h * (1 - progress);
			ctx.drawImage(tempA, 0, 0);
			ctx.save();
			ctx.beginPath();
			ctx.rect(0, 0, w, boundary);
			ctx.clip();
			ctx.drawImage(tempB, 0, 0);
			ctx.restore();
			ctx.fillStyle = "rgba(255,255,255,0.4)";
			ctx.fillRect(0, boundary - 1, w, 2);
			break;
		}
		case "wipeDown": {
			const boundary = h * progress;
			ctx.drawImage(tempA, 0, 0);
			ctx.save();
			ctx.beginPath();
			ctx.rect(0, boundary, w, h - boundary);
			ctx.clip();
			ctx.drawImage(tempB, 0, 0);
			ctx.restore();
			ctx.fillStyle = "rgba(255,255,255,0.4)";
			ctx.fillRect(0, boundary - 1, w, 2);
			break;
		}
		case "zoomIn": {
			const scale = 1 + progress * 0.5;
			ctx.drawImage(
				tempA,
				-(w * (scale - 1)) / 2,
				-(h * (scale - 1)) / 2,
				w * scale,
				h * scale,
			);
			ctx.globalAlpha = progress;
			ctx.drawImage(tempB, 0, 0);
			ctx.globalAlpha = 1;
			break;
		}
		case "zoomOut": {
			ctx.drawImage(tempA, 0, 0);
			const scale = progress;
			const sw = w * scale;
			const sh = h * scale;
			ctx.drawImage(tempB, (w - sw) / 2, (h - sh) / 2, sw, sh);
			break;
		}
		case "blur": {
			ctx.drawImage(tempA, 0, 0);
			ctx.globalAlpha = progress;
			ctx.filter = `blur(${3 * (1 - progress)}px)`;
			ctx.drawImage(tempB, 0, 0);
			ctx.filter = "none";
			ctx.globalAlpha = 1;
			break;
		}
		default: {
			// Fallback: simple crossfade
			ctx.drawImage(tempA, 0, 0);
			ctx.globalAlpha = progress;
			ctx.drawImage(tempB, 0, 0);
			ctx.globalAlpha = 1;
			break;
		}
	}
}

/**
 * Generate a data URL preview thumbnail for a given effect type.
 * Returns a map of effectType → dataURL.
 */
export function useEffectPreviews(effectTypes: string[]) {
	const previews = ref<Record<string, string>>({});

	onMounted(() => {
		const canvas = document.createElement("canvas");
		canvas.width = THUMB_W;
		canvas.height = THUMB_H;
		const ctx = canvas.getContext("2d")!;

		for (const effectType of effectTypes) {
			// Draw fresh scene
			ctx.clearRect(0, 0, THUMB_W, THUMB_H);
			drawSampleScene(ctx, THUMB_W, THUMB_H);
			// Apply effect
			applyEffectToCanvas(ctx, effectType, THUMB_W, THUMB_H);
			previews.value[effectType] = canvas.toDataURL("image/png");
		}
	});

	return previews;
}

/**
 * Generate a data URL preview thumbnail for a given transition type.
 * Returns a map of transitionType → dataURL.
 */
export function useTransitionPreviews(transitionTypes: string[]) {
	const previews = ref<Record<string, string>>({});

	onMounted(() => {
		const canvas = document.createElement("canvas");
		canvas.width = THUMB_W;
		canvas.height = THUMB_H;
		const ctx = canvas.getContext("2d")!;

		for (const transitionType of transitionTypes) {
			ctx.clearRect(0, 0, THUMB_W, THUMB_H);
			renderTransitionPreview(ctx, transitionType, THUMB_W, THUMB_H);
			previews.value[transitionType] = canvas.toDataURL("image/png");
		}
	});

	return previews;
}
