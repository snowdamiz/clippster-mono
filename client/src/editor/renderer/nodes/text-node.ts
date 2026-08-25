import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { TextElement, TextBubbleStyle } from "../../types/timeline";
import { getKeyframedValue } from "../../types/keyframes";
import { computeAnimationTransforms, applyAnimationToContext } from "../effects/canvas-animations";

type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export type TextNodeParams = TextElement & {
	canvasCenter: { x: number; y: number };
	textBaseline?: CanvasTextBaseline;
};

interface TextLayout {
	lines: string[];
	maxLineWidth: number;
	totalHeight: number;
	lineHeight: number;
}

const TEXT_CANVAS_EDGE_PADDING = 32;
const TEXT_AUTO_FIT_MIN_SCALE = 0.65;
const TEXT_AUTO_FIT_MAX_LINES = 3;

function isHexColor(value: string | undefined): value is string {
	return !!value && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function stripEmbeddedAlpha(color: string): string {
	const rgba = color.match(/^rgba\(\s*([^)]+)\)$/i);
	if (rgba) {
		const [r, g, b] = rgba[1].split(",").map((part) => part.trim());
		if (r && g && b) return `rgb(${r}, ${g}, ${b})`;
	}

	if (/^#[0-9A-Fa-f]{8}$/.test(color)) {
		return color.slice(0, 7);
	}

	return color;
}

export class TextNode extends BaseNode<TextNodeParams> {
	isInRange({ time }: { time: number }) {
		return (
			time >= this.params.startTime &&
			time < this.params.startTime + this.params.duration
		);
	}

	/**
	 * Render this text element to a standalone OffscreenCanvas as a transparent PNG.
	 * Used by the export pipeline to composite text as image overlays in FFmpeg.
	 * Returns { blob, width, height } or null if content is empty.
	 */
	async renderToImage({
		canvasWidth,
		canvasHeight,
		sampleTime,
	}: {
		canvasWidth: number;
		canvasHeight: number;
		/** Timeline seconds used to sample keyframes / fades (default: element midpoint). */
		sampleTime?: number;
	}): Promise<{ blob: Blob; width: number; height: number } | null> {
		if (!this.params.content.trim()) return null;

		const oc = new OffscreenCanvas(canvasWidth, canvasHeight);
		const ctx = oc.getContext("2d");
		if (!ctx) return null;

		const t = sampleTime ?? this.params.startTime + this.params.duration / 2;
		const elapsed = t - this.params.startTime;
		const normalizedTime = this.params.duration > 0 ? elapsed / this.params.duration : 0;
		const kf = this.params.keyframes;

		const resolvedScale = getKeyframedValue({
			elementKeyframes: kf,
			property: "scale",
			normalizedTime,
			defaultValue: this.params.transform.scale ?? 1,
		});
		const resolvedPosX = getKeyframedValue({
			elementKeyframes: kf,
			property: "positionX",
			normalizedTime,
			defaultValue: this.params.transform.position.x,
		});
		const resolvedPosY = getKeyframedValue({
			elementKeyframes: kf,
			property: "positionY",
			normalizedTime,
			defaultValue: this.params.transform.position.y,
		});
		const resolvedRotation = getKeyframedValue({
			elementKeyframes: kf,
			property: "rotation",
			normalizedTime,
			defaultValue: this.params.transform.rotate,
		});

		// Translate to element position (canvas center + offset)
		const x = this.params.canvasCenter.x + resolvedPosX;
		const y = this.params.canvasCenter.y + resolvedPosY;
		ctx.translate(x, y);

		if (resolvedScale !== 1) ctx.scale(resolvedScale, resolvedScale);
		if (resolvedRotation) {
			ctx.rotate((resolvedRotation * Math.PI) / 180);
		}

		let resolvedOpacity = getKeyframedValue({
			elementKeyframes: kf,
			property: "opacity",
			normalizedTime,
			defaultValue: this.params.opacity,
		});
		const fadeIn = this.params.fadeIn ?? 0;
		const fadeOut = this.params.fadeOut ?? 0;
		if (fadeIn > 0 && elapsed < fadeIn) {
			resolvedOpacity *= elapsed / fadeIn;
		}
		if (fadeOut > 0 && elapsed > this.params.duration - fadeOut) {
			resolvedOpacity *= (this.params.duration - elapsed) / fadeOut;
		}
		ctx.globalAlpha = resolvedOpacity;

		this.paintText(ctx, {
			maxLineWidth: this.getMaxLocalLineWidth({
				canvasWidth,
				anchorX: x,
				scale: resolvedScale,
			}),
		});

		const blob = await oc.convertToBlob({ type: "image/png" });
		return { blob, width: canvasWidth, height: canvasHeight };
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		if (!this.isInRange({ time })) return;

		const ctx = renderer.context;
		ctx.save();

		if (this.params.blendMode && this.params.blendMode !== "normal") {
			ctx.globalCompositeOperation = this.params.blendMode as GlobalCompositeOperation;
		}

		const elapsed = time - this.params.startTime;
		const normalizedTime = this.params.duration > 0 ? elapsed / this.params.duration : 0;
		const kf = this.params.keyframes;

		const resolvedScale = getKeyframedValue({ elementKeyframes: kf, property: "scale", normalizedTime, defaultValue: this.params.transform.scale ?? 1 });
		const resolvedPosX = getKeyframedValue({ elementKeyframes: kf, property: "positionX", normalizedTime, defaultValue: this.params.transform.position.x });
		const resolvedPosY = getKeyframedValue({ elementKeyframes: kf, property: "positionY", normalizedTime, defaultValue: this.params.transform.position.y });
		const resolvedRotation = getKeyframedValue({ elementKeyframes: kf, property: "rotation", normalizedTime, defaultValue: this.params.transform.rotate });

		const x = resolvedPosX + this.params.canvasCenter.x;
		const y = resolvedPosY + this.params.canvasCenter.y;
		ctx.translate(x, y);

		if (resolvedScale !== 1) ctx.scale(resolvedScale, resolvedScale);

		if (resolvedRotation) {
			ctx.rotate((resolvedRotation * Math.PI) / 180);
		}

		let resolvedOpacity = getKeyframedValue({
			elementKeyframes: kf,
			property: "opacity",
			normalizedTime,
			defaultValue: this.params.opacity,
		});

		// Apply fade in/out opacity ramp
		const fadeIn = this.params.fadeIn ?? 0;
		const fadeOut = this.params.fadeOut ?? 0;
		if (fadeIn > 0 && elapsed < fadeIn) {
			resolvedOpacity *= elapsed / fadeIn;
		}
		if (fadeOut > 0 && elapsed > this.params.duration - fadeOut) {
			resolvedOpacity *= (this.params.duration - elapsed) / fadeOut;
		}

		const prevAlpha = ctx.globalAlpha;
		ctx.globalAlpha = resolvedOpacity;

		// Apply element animations (in/out/loop)
		const animResult = computeAnimationTransforms(
			this.params.animationIn,
			this.params.animationOut,
			this.params.animationLoop,
			{ elapsed, elementDuration: this.params.duration, canvasWidth: renderer.width, canvasHeight: renderer.height },
		);
		applyAnimationToContext(ctx, animResult, 0, 0);

		this.paintText(ctx, {
			maxLineWidth: this.getMaxLocalLineWidth({
				canvasWidth: renderer.width,
				anchorX: x,
				scale: resolvedScale,
			}),
		});

		ctx.globalAlpha = prevAlpha;
		ctx.restore();
	}

	// ── Core paint routine (shared by render + renderToImage) ──

	private paintText(ctx: Ctx, options?: { maxLineWidth?: number }) {
		ctx.textAlign = this.params.textAlign;
		ctx.textBaseline = "top";

		const displayText = this.applyTextCase(this.params.content);
		const layout = this.fitTextLayout(ctx, displayText, options?.maxLineWidth);
		ctx.font = this.buildFont(layout.fontSize);

		// Block origin centered on anchor
		// Use "top" baseline; compensate for descender space so text is visually centered.
		const descenderOffset = layout.lineHeight * 0.1;
		let blockX = -layout.maxLineWidth / 2;
		if (this.params.textAlign === "left") blockX = 0;
		if (this.params.textAlign === "right") blockX = -layout.maxLineWidth;
		const blockY = -(layout.totalHeight - descenderOffset) / 2;

		// ── Bubble / background ──
		const pad = this.params.bubblePadding ?? 16;
		const bubble = this.params.bubbleStyle || "none";
		const explicitBackground = this.params.backgroundColor && this.params.backgroundColor !== "transparent"
			? this.params.backgroundColor
			: null;
		const bubbleColor = stripEmbeddedAlpha(
			bubble !== "none"
				? (this.params.bubbleColor || (isHexColor(explicitBackground ?? undefined) ? explicitBackground : null) || "#000000")
				: (explicitBackground || "#000000"),
		);
		const bubbleOpacity = this.params.bubbleOpacity ?? 1;

		if (bubble !== "none") {
			ctx.save();
			ctx.globalCompositeOperation = "source-over";
			ctx.globalAlpha = bubbleOpacity;
			this.drawBubble(ctx, bubble,
				blockX - pad, blockY - pad,
				layout.maxLineWidth + pad * 2, layout.totalHeight + pad * 2,
				bubbleColor);
			ctx.restore();
		} else if (explicitBackground) {
			const px = 8, py = 4;
			ctx.save();
			ctx.globalCompositeOperation = "source-over";
			ctx.globalAlpha = bubbleOpacity;
			ctx.fillStyle = bubbleColor;
			this.roundRect(ctx, blockX - px, blockY - py,
				layout.maxLineWidth + px * 2, layout.totalHeight + py * 2,
				6);
			ctx.fill();
			ctx.restore();
		}

		// ── Shadow / glow (set before drawing text) ──
		this.applyShadowGlow(ctx);

		// ── Gradient ──
		const gradFill = this.createGradient(ctx, layout.maxLineWidth, layout.totalHeight);

		// Apply text-only opacity (independent of element opacity and bubble opacity)
		const textOpacity = this.params.textOpacity ?? 1;
		if (textOpacity !== 1) {
			ctx.save();
			ctx.globalAlpha = ctx.globalAlpha * textOpacity;
		}

		// ── Draw lines ──
		const letterSpacing = this.params.letterSpacing || 0;

		for (let i = 0; i < layout.lines.length; i++) {
			const lineY = blockY + i * layout.lineHeight;
			let lineX = 0;
			if (this.params.textAlign === "left") lineX = blockX;
			else if (this.params.textAlign === "right") lineX = blockX + layout.maxLineWidth;

			// Stroke first (behind fill)
			if (this.params.stroke && this.params.stroke.width > 0) {
				ctx.strokeStyle = this.params.stroke.color;
				ctx.lineWidth = this.params.stroke.width * 2;
				ctx.lineJoin = "round";
				ctx.miterLimit = 2;
				this.drawLine(ctx, layout.lines[i], lineX, lineY, letterSpacing, "stroke");
			}

			// Fill
			ctx.fillStyle = gradFill || this.params.color;
			this.drawLine(ctx, layout.lines[i], lineX, lineY, letterSpacing, "fill");

			// Reset shadow per line so it doesn't compound
			if (i === 0) this.clearShadow(ctx);
			if (i < layout.lines.length - 1) this.applyShadowGlow(ctx);

			// Decorations
			this.drawDecoration(ctx, layout.lines[i], lineX, lineY, letterSpacing, gradFill);
		}

		if (textOpacity !== 1) {
			ctx.restore();
		}
	}

	// ── Text layout ──

	private applyTextCase(text: string): string {
		switch (this.params.textCase) {
			case "uppercase": return text.toUpperCase();
			case "lowercase": return text.toLowerCase();
			case "capitalize": return text.replace(/\b\w/g, (c) => c.toUpperCase());
			default: return text;
		}
	}

	private buildFont(fontSize = this.params.fontSize): string {
		const style = this.params.fontStyle === "italic" ? "italic" : "normal";
		const weight = this.params.fontWeight || "normal";
		return `${style} ${weight} ${fontSize}px "${this.params.fontFamily}", sans-serif`;
	}

	private getMaxLocalLineWidth({
		canvasWidth,
		anchorX,
		scale,
	}: {
		canvasWidth: number;
		anchorX: number;
		scale: number;
	}): number {
		const safeScale = Math.max(0.01, scale || 1);
		const minWidth = this.params.fontSize * 2;
		let available: number;

		if (this.params.textAlign === "left") {
			available = canvasWidth - anchorX - TEXT_CANVAS_EDGE_PADDING;
		} else if (this.params.textAlign === "right") {
			available = anchorX - TEXT_CANVAS_EDGE_PADDING;
		} else {
			const left = anchorX - TEXT_CANVAS_EDGE_PADDING;
			const right = canvasWidth - anchorX - TEXT_CANVAS_EDGE_PADDING;
			available = Math.min(left, right) * 2;
		}

		return Math.max(minWidth, available / safeScale);
	}

	private fitTextLayout(ctx: Ctx, text: string, maxLineWidth?: number): TextLayout & { fontSize: number } {
		const baseFontSize = this.params.fontSize;
		const minFontSize = Math.max(8, baseFontSize * TEXT_AUTO_FIT_MIN_SCALE);
		let fallback: TextLayout & { fontSize: number } | null = null;

		for (let fontSize = baseFontSize; fontSize >= minFontSize; fontSize -= 1) {
			ctx.font = this.buildFont(fontSize);
			const layout = this.layoutText(ctx, text, maxLineWidth, fontSize);
			const fitted = { ...layout, fontSize };
			fallback = fitted;
			if (layout.lines.length <= TEXT_AUTO_FIT_MAX_LINES) return fitted;
		}

		return fallback ?? { ...this.layoutText(ctx, text, maxLineWidth, baseFontSize), fontSize: baseFontSize };
	}

	private layoutText(ctx: Ctx, text: string, maxLineWidth: number | undefined, fontSize: number): TextLayout {
		const lineHeight = fontSize * (this.params.lineHeight || 1.2);
		const lines = this.wrapText(ctx, text, maxLineWidth);
		let maxW = 0;
		const spacing = this.params.letterSpacing || 0;
		for (const line of lines) {
			const w = this.measureLine(ctx, line, spacing);
			if (w > maxW) maxW = w;
		}
		return { lines, maxLineWidth: maxW, totalHeight: lineHeight * lines.length, lineHeight };
	}

	private wrapText(ctx: Ctx, text: string, maxLineWidth?: number): string[] {
		const hardLines = text.split("\n");
		if (!maxLineWidth || maxLineWidth <= 0) return hardLines;

		const wrapped: string[] = [];
		const spacing = this.params.letterSpacing || 0;

		for (const hardLine of hardLines) {
			if (!hardLine) {
				wrapped.push("");
				continue;
			}

			const words = hardLine.split(/(\s+)/).filter((part) => part.length > 0);
			let current = "";

			for (const part of words) {
				const candidate = current ? current + part : part.trimStart();
				if (candidate && this.measureLine(ctx, candidate, spacing) <= maxLineWidth) {
					current = candidate;
					continue;
				}

				if (current.trim().length > 0) {
					wrapped.push(current.trimEnd());
					current = part.trimStart();
				}

				while (current && this.measureLine(ctx, current, spacing) > maxLineWidth) {
					let splitAt = 1;
					for (let i = 1; i <= current.length; i++) {
						if (this.measureLine(ctx, current.slice(0, i), spacing) > maxLineWidth) break;
						splitAt = i;
					}
					wrapped.push(current.slice(0, splitAt));
					current = current.slice(splitAt);
				}
			}

			wrapped.push(current.trimEnd());
		}

		return wrapped.length ? wrapped : [""];
	}

	private measureLine(ctx: Ctx, text: string, spacing: number): number {
		return spacing !== 0 ? this.measureSpaced(ctx, text, spacing) : ctx.measureText(text).width;
	}

	// ── Bubble shapes ──

	private drawBubble(ctx: Ctx, style: TextBubbleStyle, bx: number, by: number, bw: number, bh: number, color: string) {
		ctx.save();

		switch (style) {
			case "rounded": {
				const r = Math.min(bh * 0.22, bw * 0.12, 16);
				this.roundRect(ctx, bx, by, bw, bh, r);
				ctx.fillStyle = color;
				ctx.fill();
				break;
			}
			case "pill": {
				const r = Math.min(bh / 2, 18);
				this.roundRect(ctx, bx, by, bw, bh, r);
				ctx.fillStyle = color;
				ctx.fill();
				break;
			}
			case "speech": {
				// Smooth rounded rect body
				const r = Math.min(bh * 0.35, bw * 0.2, 24);
				this.roundRect(ctx, bx, by, bw, bh, r);
				ctx.fillStyle = color;
				ctx.fill();

				// Smooth bezier tail (bottom-left, curves down-left)
				const tailBaseX = bx + bw * 0.22;
				const tailBaseW = bw * 0.12;
				const tailTipX = bx + bw * 0.08;
				const tailTipY = by + bh + bh * 0.3;

				ctx.beginPath();
				ctx.moveTo(tailBaseX, by + bh - 1);
				ctx.bezierCurveTo(
					tailBaseX - tailBaseW * 0.3, by + bh + bh * 0.15,
					tailTipX + tailBaseW * 0.5, tailTipY - bh * 0.05,
					tailTipX, tailTipY,
				);
				ctx.bezierCurveTo(
					tailTipX + tailBaseW * 0.8, tailTipY - bh * 0.12,
					tailBaseX + tailBaseW * 0.6, by + bh + bh * 0.08,
					tailBaseX + tailBaseW, by + bh - 1,
				);
				ctx.closePath();
				ctx.fillStyle = color;
				ctx.fill();
				break;
			}
			case "thought": {
				// Main rounded body
				const r = Math.min(bh * 0.35, bw * 0.2, 24);
				this.roundRect(ctx, bx, by, bw, bh, r);
				ctx.fillStyle = color;
				ctx.fill();

				// Thought dots (3 shrinking circles trailing bottom-left)
				const dotX = bx + bw * 0.18;
				const dotY = by + bh;
				const sizes = [bh * 0.1, bh * 0.065, bh * 0.04];
				for (let d = 0; d < sizes.length; d++) {
					const dx = dotX - d * bh * 0.12;
					const dy = dotY + d * bh * 0.14 + sizes[d] + 2;
					ctx.beginPath();
					ctx.arc(dx, dy, sizes[d], 0, Math.PI * 2);
					ctx.fillStyle = color;
					ctx.fill();
				}
				break;
			}
			case "label": {
				// Rounded rect with arrow pointer on left edge
				const r = Math.min(bh * 0.25, bw * 0.1, 12);
				const arrowW = bh * 0.25;
				const arrowH = bh * 0.35;
				const arrowY = by + bh / 2;

				// Main body (shifted right to make room for arrow)
				this.roundRect(ctx, bx + arrowW, by, bw - arrowW, bh, r);
				ctx.fillStyle = color;
				ctx.fill();

				// Arrow pointing left
				ctx.beginPath();
				ctx.moveTo(bx + arrowW, arrowY - arrowH / 2);
				ctx.lineTo(bx, arrowY);
				ctx.lineTo(bx + arrowW, arrowY + arrowH / 2);
				ctx.closePath();
				ctx.fill();
				break;
			}
			case "neon-box": {
				const r = Math.min(bh * 0.2, 8);
				// Outer glow
				ctx.shadowColor = color;
				ctx.shadowBlur = 18;
				this.roundRect(ctx, bx, by, bw, bh, r);
				ctx.strokeStyle = color;
				ctx.lineWidth = 2.5;
				ctx.stroke();
				// Inner subtle fill
				ctx.shadowBlur = 0;
				ctx.fillStyle = color.replace(/[\d.]+\)$/, "0.08)").replace(/^#/, "");
				// For hex colors, create a transparent version
				if (color.startsWith("#")) {
					ctx.fillStyle = color + "14"; // ~8% opacity
				} else {
					ctx.fillStyle = "rgba(255,255,255,0.04)";
				}
				ctx.fill();
				// Second pass glow for intensity
				ctx.shadowColor = color;
				ctx.shadowBlur = 8;
				ctx.strokeStyle = color;
				ctx.lineWidth = 1;
				ctx.stroke();
				ctx.shadowBlur = 0;
				break;
			}
			case "glitch": {
				// Main rect
				ctx.fillStyle = color;
				ctx.fillRect(bx, by, bw, bh);
				// Offset duplicate (shifted right+down, different color channel)
				ctx.globalCompositeOperation = "screen";
				ctx.fillStyle = "#ff003320";
				ctx.fillRect(bx + 3, by + 2, bw, bh);
				ctx.fillStyle = "#00ffff20";
				ctx.fillRect(bx - 2, by - 1, bw, bh);
				ctx.globalCompositeOperation = "source-over";
				break;
			}
		}

		ctx.restore();
	}

	private roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
		r = Math.min(r, w / 2, h / 2);
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
	}

	// ── Effects ──

	private applyShadowGlow(ctx: Ctx) {
		if (this.params.glow) {
			ctx.shadowColor = this.params.glow.color;
			ctx.shadowBlur = this.params.glow.intensity;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
		} else if (this.params.shadow) {
			ctx.shadowColor = this.params.shadow.color;
			ctx.shadowBlur = this.params.shadow.blur;
			ctx.shadowOffsetX = this.params.shadow.offsetX;
			ctx.shadowOffsetY = this.params.shadow.offsetY;
		}
	}

	private clearShadow(ctx: Ctx) {
		ctx.shadowColor = "transparent";
		ctx.shadowBlur = 0;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
	}

	private createGradient(ctx: Ctx, w: number, h: number): CanvasGradient | null {
		const g = this.params.gradient;
		if (!g?.enabled) return null;
		const a = ((g.angle || 0) * Math.PI) / 180;
		const hw = w / 2, hh = h / 2;
		const grad = ctx.createLinearGradient(-hw * Math.cos(a), -hh * Math.sin(a), hw * Math.cos(a), hh * Math.sin(a));
		grad.addColorStop(0, g.colors[0]);
		grad.addColorStop(1, g.colors[1]);
		return grad;
	}

	// ── Line drawing ──

	private drawLine(ctx: Ctx, text: string, x: number, y: number, spacing: number, mode: "fill" | "stroke") {
		if (spacing !== 0) {
			this.drawSpaced(ctx, text, x, y, spacing, mode);
		} else if (mode === "fill") {
			ctx.fillText(text, x, y);
		} else {
			ctx.strokeText(text, x, y);
		}
	}

	private drawSpaced(ctx: Ctx, text: string, startX: number, y: number, spacing: number, mode: "fill" | "stroke") {
		let cx = startX;
		if (this.params.textAlign === "center") cx -= this.measureSpaced(ctx, text, spacing) / 2;
		else if (this.params.textAlign === "right") cx -= this.measureSpaced(ctx, text, spacing);

		const saved = ctx.textAlign;
		ctx.textAlign = "left";
		for (const char of text) {
			mode === "fill" ? ctx.fillText(char, cx, y) : ctx.strokeText(char, cx, y);
			cx += ctx.measureText(char).width + spacing;
		}
		ctx.textAlign = saved;
	}

	private measureSpaced(ctx: Ctx, text: string, spacing: number): number {
		let w = 0;
		for (let i = 0; i < text.length; i++) {
			w += ctx.measureText(text[i]).width;
			if (i < text.length - 1) w += spacing;
		}
		return w;
	}

	private drawDecoration(ctx: Ctx, text: string, lineX: number, lineY: number, spacing: number, gradFill: CanvasGradient | null) {
		if (this.params.textDecoration === "none") return;
		this.clearShadow(ctx);

		const textW = spacing !== 0 ? this.measureSpaced(ctx, text, spacing) : ctx.measureText(text).width;
		let dx = lineX;
		if (this.params.textAlign === "center") dx = -textW / 2;
		else if (this.params.textAlign === "right") dx = lineX - textW;

		ctx.strokeStyle = gradFill || this.params.color;
		ctx.lineWidth = Math.max(1, this.params.fontSize / 18);

		const yOff = this.params.textDecoration === "underline"
			? lineY + this.params.fontSize * 1.05
			: lineY + this.params.fontSize * 0.45;

		ctx.beginPath();
		ctx.moveTo(dx, yOff);
		ctx.lineTo(dx + textW, yOff);
		ctx.stroke();
	}
}
