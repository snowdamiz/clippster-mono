import { ref, onMounted } from "vue";

export const THUMB_W = 240;
export const THUMB_H = 160;

/**
 * Scene A: Vibrant cityscape at golden hour — bright, colorful, lots of detail.
 * Designed to look like a real photo thumbnail so effects are clearly visible.
 */
export function drawSampleScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
	// Vivid sunset sky
	const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
	sky.addColorStop(0, "#0f1b4c");
	sky.addColorStop(0.3, "#3a1078");
	sky.addColorStop(0.6, "#e94560");
	sky.addColorStop(0.85, "#ff8c32");
	sky.addColorStop(1, "#ffcf48");
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, w, h * 0.55);

	// Sun glow
	const sunGrad = ctx.createRadialGradient(w * 0.65, h * 0.42, 0, w * 0.65, h * 0.42, w * 0.22);
	sunGrad.addColorStop(0, "rgba(255,240,180,0.9)");
	sunGrad.addColorStop(0.3, "rgba(255,180,60,0.5)");
	sunGrad.addColorStop(1, "transparent");
	ctx.fillStyle = sunGrad;
	ctx.fillRect(0, 0, w, h);

	// City buildings silhouette
	ctx.fillStyle = "#1a1a2e";
	const buildings = [
		[0.02, 0.30, 0.06, 0.25],
		[0.09, 0.25, 0.05, 0.30],
		[0.15, 0.18, 0.07, 0.37],
		[0.23, 0.28, 0.05, 0.27],
		[0.29, 0.22, 0.08, 0.33],
		[0.38, 0.15, 0.06, 0.40],
		[0.45, 0.20, 0.07, 0.35],
		[0.53, 0.12, 0.05, 0.43],
		[0.59, 0.24, 0.06, 0.31],
		[0.66, 0.19, 0.08, 0.36],
		[0.75, 0.26, 0.05, 0.29],
		[0.81, 0.14, 0.06, 0.41],
		[0.88, 0.22, 0.07, 0.33],
		[0.96, 0.28, 0.05, 0.27],
	];
	for (const [bx, by, bw, bh] of buildings) {
		ctx.fillRect(w * bx, h * by, w * bw, h * bh);
	}

	// Building windows (yellow dots)
	ctx.fillStyle = "#ffdd44";
	for (const [bx, by, bw, bh] of buildings) {
		const cols = Math.max(2, Math.floor(bw * w / 5));
		const rows = Math.max(3, Math.floor(bh * h / 6));
		for (let r = 1; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				if (Math.random() > 0.5) {
					const wx = w * bx + 2 + c * (w * bw - 4) / cols;
					const wy = h * by + 3 + r * (h * bh - 6) / rows;
					ctx.globalAlpha = 0.4 + Math.random() * 0.6;
					ctx.fillRect(wx, wy, 2, 2);
				}
			}
		}
	}
	ctx.globalAlpha = 1;

	// Water / ground reflection
	const water = ctx.createLinearGradient(0, h * 0.55, 0, h);
	water.addColorStop(0, "#1a0a3e");
	water.addColorStop(0.3, "#2a1555");
	water.addColorStop(1, "#0a0a1a");
	ctx.fillStyle = water;
	ctx.fillRect(0, h * 0.55, w, h * 0.45);

	// Water reflection highlights
	ctx.fillStyle = "rgba(255,140,50,0.15)";
	for (let i = 0; i < 12; i++) {
		const rx = Math.random() * w;
		const ry = h * 0.58 + Math.random() * h * 0.35;
		ctx.fillRect(rx, ry, 8 + Math.random() * 20, 1);
	}

	// Bright reflection streak
	const refl = ctx.createLinearGradient(w * 0.55, h * 0.55, w * 0.75, h);
	refl.addColorStop(0, "rgba(255,200,100,0.25)");
	refl.addColorStop(1, "transparent");
	ctx.fillStyle = refl;
	ctx.fillRect(w * 0.55, h * 0.55, w * 0.2, h * 0.45);
}

/**
 * Scene B: Tropical beach with turquoise water — warm, bright, contrasting with Scene A.
 */
export function drawSampleSceneB(ctx: CanvasRenderingContext2D, w: number, h: number) {
	// Bright blue sky
	const sky = ctx.createLinearGradient(0, 0, 0, h * 0.45);
	sky.addColorStop(0, "#0099ff");
	sky.addColorStop(1, "#66ccff");
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, w, h * 0.45);

	// Clouds
	ctx.fillStyle = "rgba(255,255,255,0.7)";
	const clouds = [[0.15, 0.12, 0.18], [0.55, 0.08, 0.14], [0.8, 0.15, 0.12]];
	for (const [cx, cy, cr] of clouds) {
		ctx.beginPath();
		ctx.ellipse(w * cx, h * cy, w * cr, h * 0.04, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.ellipse(w * cx + w * 0.04, h * cy - h * 0.02, w * cr * 0.7, h * 0.035, 0, 0, Math.PI * 2);
		ctx.fill();
	}

	// Ocean
	const ocean = ctx.createLinearGradient(0, h * 0.4, 0, h * 0.7);
	ocean.addColorStop(0, "#00b4d8");
	ocean.addColorStop(0.5, "#0096c7");
	ocean.addColorStop(1, "#0077b6");
	ctx.fillStyle = ocean;
	ctx.fillRect(0, h * 0.4, w, h * 0.3);

	// Wave lines
	ctx.strokeStyle = "rgba(255,255,255,0.3)";
	ctx.lineWidth = 1;
	for (let i = 0; i < 5; i++) {
		const y = h * 0.45 + i * h * 0.05;
		ctx.beginPath();
		ctx.moveTo(0, y);
		for (let x = 0; x < w; x += 4) {
			ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 2);
		}
		ctx.stroke();
	}

	// Sandy beach
	const sand = ctx.createLinearGradient(0, h * 0.68, 0, h);
	sand.addColorStop(0, "#f4d58d");
	sand.addColorStop(0.5, "#e8c170");
	sand.addColorStop(1, "#d4a853");
	ctx.fillStyle = sand;
	ctx.fillRect(0, h * 0.68, w, h * 0.32);

	// Beach texture dots
	ctx.fillStyle = "rgba(180,140,60,0.3)";
	for (let i = 0; i < 40; i++) {
		const dx = Math.random() * w;
		const dy = h * 0.7 + Math.random() * h * 0.28;
		ctx.fillRect(dx, dy, 1, 1);
	}

	// Palm tree
	ctx.fillStyle = "#5c3a1e";
	ctx.fillRect(w * 0.12, h * 0.15, w * 0.015, h * 0.55);
	// Palm leaves
	ctx.fillStyle = "#2d8a4e";
	const leaves = [[-0.08, -0.06], [0.06, -0.08], [-0.06, -0.1], [0.08, -0.04], [0, -0.12]];
	for (const [lx, ly] of leaves) {
		ctx.beginPath();
		ctx.ellipse(w * 0.13 + w * lx, h * 0.15 + h * ly, w * 0.06, h * 0.025, Math.atan2(ly, lx), 0, Math.PI * 2);
		ctx.fill();
	}

	// Sun
	const sunGrad = ctx.createRadialGradient(w * 0.75, h * 0.18, 0, w * 0.75, h * 0.18, w * 0.08);
	sunGrad.addColorStop(0, "#fff9c4");
	sunGrad.addColorStop(0.5, "#ffee58");
	sunGrad.addColorStop(1, "rgba(255,238,88,0)");
	ctx.fillStyle = sunGrad;
	ctx.beginPath();
	ctx.arc(w * 0.75, h * 0.18, w * 0.08, 0, Math.PI * 2);
	ctx.fill();
}

/** Helper: apply a CSS filter by copying through a temp canvas */
function applyCSSFilter(ctx: CanvasRenderingContext2D, w: number, h: number, filter: string) {
	const tmp = document.createElement("canvas");
	tmp.width = w;
	tmp.height = h;
	const t = tmp.getContext("2d")!;
	t.drawImage(ctx.canvas, 0, 0);
	ctx.clearRect(0, 0, w, h);
	ctx.filter = filter;
	ctx.drawImage(tmp, 0, 0);
	ctx.filter = "none";
}

/** Helper: get a snapshot of the current canvas */
function snapshot(ctx: CanvasRenderingContext2D, w: number, h: number): HTMLCanvasElement {
	const tmp = document.createElement("canvas");
	tmp.width = w;
	tmp.height = h;
	tmp.getContext("2d")!.drawImage(ctx.canvas, 0, 0);
	return tmp;
}

function applyEffectToCanvas(
	ctx: CanvasRenderingContext2D,
	effectType: string,
	w: number,
	h: number,
) {
	switch (effectType) {
		case "blur": {
			applyCSSFilter(ctx, w, h, "blur(6px)");
			break;
		}
		case "pixelate": {
			const blockSize = 12;
			const imgData = ctx.getImageData(0, 0, w, h);
			const d = imgData.data;
			for (let y = 0; y < h; y += blockSize) {
				for (let x = 0; x < w; x += blockSize) {
					// Average the block
					let rr = 0, gg = 0, bb = 0, count = 0;
					for (let dy = 0; dy < blockSize && y + dy < h; dy++) {
						for (let dx = 0; dx < blockSize && x + dx < w; dx++) {
							const i = ((y + dy) * w + (x + dx)) * 4;
							rr += d[i]; gg += d[i + 1]; bb += d[i + 2]; count++;
						}
					}
					rr = Math.round(rr / count); gg = Math.round(gg / count); bb = Math.round(bb / count);
					ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
					ctx.fillRect(x, y, blockSize, blockSize);
				}
			}
			break;
		}
		case "sharpen": {
			applyCSSFilter(ctx, w, h, "contrast(1.5) brightness(1.1)");
			break;
		}
		case "sepia": {
			applyCSSFilter(ctx, w, h, "sepia(1) saturate(1.3)");
			break;
		}
		case "grayscale": {
			applyCSSFilter(ctx, w, h, "grayscale(1)");
			break;
		}
		case "negative": {
			applyCSSFilter(ctx, w, h, "invert(1)");
			break;
		}
		case "vignette": {
			const diag = Math.sqrt(w * w + h * h) / 2;
			const grad = ctx.createRadialGradient(w / 2, h / 2, diag * 0.25, w / 2, h / 2, diag * 0.85);
			grad.addColorStop(0, "transparent");
			grad.addColorStop(0.6, "transparent");
			grad.addColorStop(1, "rgba(0,0,0,0.85)");
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, w, h);
			break;
		}
		case "wave": {
			const src = snapshot(ctx, w, h);
			const srcCtx = src.getContext("2d")!;
			const imgData = srcCtx.getImageData(0, 0, w, h);
			const outData = ctx.createImageData(w, h);
			ctx.clearRect(0, 0, w, h);
			for (let y = 0; y < h; y++) {
				const shift = Math.round(Math.sin(y * 0.08) * 12);
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
			const src = snapshot(ctx, w, h);
			// Displaced slices
			const sliceCount = 8;
			const sliceH = Math.ceil(h / sliceCount);
			for (let i = 0; i < sliceCount; i++) {
				const offset = (i % 2 === 0 ? 1 : -1) * (4 + Math.random() * 12);
				ctx.drawImage(src, 0, i * sliceH, w, sliceH, offset, i * sliceH, w, sliceH);
			}
			// Strong RGB channel split
			ctx.globalCompositeOperation = "screen";
			ctx.fillStyle = "rgba(255,0,50,0.15)";
			ctx.fillRect(6, 0, w, h);
			ctx.fillStyle = "rgba(0,200,255,0.15)";
			ctx.fillRect(-6, 0, w, h);
			ctx.globalCompositeOperation = "source-over";
			// Horizontal glitch bars
			ctx.fillStyle = "rgba(255,0,100,0.2)";
			ctx.fillRect(0, h * 0.3, w, 3);
			ctx.fillStyle = "rgba(0,255,200,0.2)";
			ctx.fillRect(0, h * 0.65, w, 2);
			break;
		}
		case "colorShift": {
			const src = snapshot(ctx, w, h);
			// Draw red channel shifted right
			ctx.globalCompositeOperation = "screen";
			ctx.drawImage(src, 6, 0);
			ctx.fillStyle = "rgba(255,0,0,0.18)";
			ctx.fillRect(6, 0, w, h);
			// Draw blue channel shifted left
			ctx.drawImage(src, -6, 0);
			ctx.fillStyle = "rgba(0,80,255,0.18)";
			ctx.fillRect(-6, 0, w, h);
			ctx.globalCompositeOperation = "source-over";
			break;
		}
		case "zoomPulse": {
			const src = snapshot(ctx, w, h);
			ctx.clearRect(0, 0, w, h);
			const s = 1.15;
			ctx.drawImage(src, -(w * (s - 1)) / 2, -(h * (s - 1)) / 2, w * s, h * s);
			// Radial speed lines
			ctx.strokeStyle = "rgba(255,255,255,0.15)";
			ctx.lineWidth = 1;
			for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
				ctx.beginPath();
				ctx.moveTo(w / 2 + Math.cos(a) * w * 0.2, h / 2 + Math.sin(a) * h * 0.2);
				ctx.lineTo(w / 2 + Math.cos(a) * w, h / 2 + Math.sin(a) * h);
				ctx.stroke();
			}
			break;
		}
		case "flash": {
			ctx.fillStyle = "rgba(255,255,255,0.55)";
			ctx.fillRect(0, 0, w, h);
			break;
		}
		case "noise": {
			const imgData = ctx.getImageData(0, 0, w, h);
			const d = imgData.data;
			for (let i = 0; i < d.length; i += 4) {
				const n = (Math.random() - 0.5) * 100;
				d[i] = Math.min(255, Math.max(0, d[i] + n));
				d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
				d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
			}
			ctx.putImageData(imgData, 0, 0);
			break;
		}
		case "vhs": {
			// Heavy scanlines
			for (let y = 0; y < h; y += 3) {
				ctx.fillStyle = "rgba(0,0,0,0.25)";
				ctx.fillRect(0, y, w, 1);
			}
			// Color bleed
			ctx.globalCompositeOperation = "screen";
			ctx.fillStyle = "rgba(255,0,0,0.1)";
			ctx.fillRect(3, 0, w, h);
			ctx.fillStyle = "rgba(0,255,255,0.1)";
			ctx.fillRect(-3, 0, w, h);
			ctx.globalCompositeOperation = "source-over";
			// Noise
			const imgData = ctx.getImageData(0, 0, w, h);
			const d = imgData.data;
			for (let i = 0; i < d.length; i += 8) {
				const n = (Math.random() - 0.5) * 50;
				d[i] = Math.min(255, Math.max(0, d[i] + n));
				d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
				d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
			}
			ctx.putImageData(imgData, 0, 0);
			// Tracking line
			ctx.fillStyle = "rgba(255,255,255,0.3)";
			ctx.fillRect(0, h * 0.4, w, 2);
			break;
		}
		case "posterize": {
			const imgData = ctx.getImageData(0, 0, w, h);
			const d = imgData.data;
			const levels = 4;
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
			ctx.fillStyle = "#0a0a0a";
			ctx.fillRect(0, 0, w, h);
			const dotSpacing = 6;
			for (let y = 0; y < h; y += dotSpacing) {
				for (let x = 0; x < w; x += dotSpacing) {
					const i = (y * w + x) * 4;
					const r = imgData.data[i], g = imgData.data[i + 1], b = imgData.data[i + 2];
					const brightness = (r + g + b) / 3 / 255;
					const radius = brightness * dotSpacing * 0.48;
					if (radius > 0.5) {
						ctx.fillStyle = `rgb(${r},${g},${b})`;
						ctx.beginPath();
						ctx.arc(x + dotSpacing / 2, y + dotSpacing / 2, radius, 0, Math.PI * 2);
						ctx.fill();
					}
				}
			}
			break;
		}
		case "motionBlur": {
			const src = snapshot(ctx, w, h);
			ctx.globalAlpha = 0.2;
			for (let i = 1; i <= 8; i++) {
				ctx.drawImage(src, i * 3, 0);
			}
			ctx.globalAlpha = 1;
			break;
		}
		case "radialBlur": {
			const src = snapshot(ctx, w, h);
			ctx.globalAlpha = 0.2;
			for (let i = 1; i <= 5; i++) {
				const s = 1 + i * 0.02;
				ctx.drawImage(src, -(w * (s - 1)) / 2, -(h * (s - 1)) / 2, w * s, h * s);
			}
			ctx.globalAlpha = 1;
			break;
		}
		case "hueShift": {
			applyCSSFilter(ctx, w, h, "hue-rotate(150deg) saturate(1.4)");
			break;
		}
		case "lensDistortion": {
			const src = snapshot(ctx, w, h);
			ctx.clearRect(0, 0, w, h);
			ctx.fillStyle = "#000";
			ctx.fillRect(0, 0, w, h);
			// Barrel distortion: draw zoomed center
			ctx.drawImage(src, -w * 0.06, -h * 0.06, w * 1.12, h * 1.12);
			// Rounded mask for barrel effect
			ctx.globalCompositeOperation = "destination-in";
			const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.52);
			grad.addColorStop(0, "white");
			grad.addColorStop(0.8, "white");
			grad.addColorStop(1, "rgba(255,255,255,0.15)");
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, w, h);
			ctx.globalCompositeOperation = "source-over";
			break;
		}
		default:
			break;
	}
}

/**
 * Render a transition at a given progress (0-1) using pre-rendered scene canvases.
 * If sceneA/sceneB are not provided, they are generated internally.
 */
export function renderTransitionPreview(
	ctx: CanvasRenderingContext2D,
	transitionType: string,
	w: number,
	h: number,
	progress = 0.5,
	sceneA?: HTMLCanvasElement,
	sceneB?: HTMLCanvasElement,
) {
	const tempA = sceneA ?? (() => {
		const c = document.createElement("canvas");
		c.width = w; c.height = h;
		drawSampleScene(c.getContext("2d")!, w, h);
		return c;
	})();
	const tempB = sceneB ?? (() => {
		const c = document.createElement("canvas");
		c.width = w; c.height = h;
		drawSampleSceneB(c.getContext("2d")!, w, h);
		return c;
	})();
	const ctxB = tempB.getContext("2d")!;

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
