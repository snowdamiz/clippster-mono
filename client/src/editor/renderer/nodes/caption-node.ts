import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type {
	CaptionElement,
	CaptionLine,
	CaptionWord,
	CaptionHighlightStyle,
	TextCase,
	TextGradient,
} from "../../types/timeline";
import { getKeyframedValue } from "../../types/keyframes";

type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export type CaptionNodeParams = CaptionElement & {
	canvasCenter: { x: number; y: number };
};

interface WordLayout {
	word: CaptionWord;
	text: string;
	x: number;
	y: number;
	width: number;
	lineIndex: number;
}

export class CaptionNode extends BaseNode<CaptionNodeParams> {
	isInRange({ time }: { time: number }) {
		return (
			time >= this.params.startTime &&
			time < this.params.startTime + this.params.duration
		);
	}

	async renderToImage({
		canvasWidth,
		canvasHeight,
		time,
	}: {
		canvasWidth: number;
		canvasHeight: number;
		time: number;
	}): Promise<{ blob: Blob; width: number; height: number } | null> {
		if (!this.params.lines || this.params.lines.length === 0) return null;

		const oc = new OffscreenCanvas(canvasWidth, canvasHeight);
		const ctx = oc.getContext("2d");
		if (!ctx) return null;

		const x =
			this.params.canvasCenter.x +
			(this.params.transform.position?.x ?? 0);
		const y =
			this.params.canvasCenter.y +
			(this.params.transform.position?.y ?? 0);
		ctx.translate(x, y);

		const scale = this.params.transform.scale ?? 1;
		if (scale !== 1) ctx.scale(scale, scale);
		if (this.params.transform.rotate) {
			ctx.rotate((this.params.transform.rotate * Math.PI) / 180);
		}

		ctx.globalAlpha = this.params.opacity ?? 1;

		this.paintCaption(ctx, time);

		const blob = await oc.convertToBlob({ type: "image/png" });
		return { blob, width: canvasWidth, height: canvasHeight };
	}

	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}) {
		if (!this.isInRange({ time })) return;

		const ctx = renderer.context;
		ctx.save();

		const x =
			this.params.transform.position.x + this.params.canvasCenter.x;
		const y =
			this.params.transform.position.y + this.params.canvasCenter.y;
		ctx.translate(x, y);

		const scale = this.params.transform.scale ?? 1;
		if (scale !== 1) ctx.scale(scale, scale);

		if (this.params.transform.rotate) {
			ctx.rotate((this.params.transform.rotate * Math.PI) / 180);
		}

		const elapsed = time - this.params.startTime;
		const normalizedTime =
			this.params.duration > 0 ? elapsed / this.params.duration : 0;
		const resolvedOpacity = getKeyframedValue({
			elementKeyframes: this.params.keyframes,
			property: "opacity",
			normalizedTime,
			defaultValue: this.params.opacity,
		});
		const prevAlpha = ctx.globalAlpha;
		ctx.globalAlpha = resolvedOpacity;

		this.paintCaption(ctx, time);

		ctx.globalAlpha = prevAlpha;
		ctx.restore();
	}

	// ── Core paint routine ──

	private paintCaption(ctx: Ctx, time: number) {
		const activeLine = this.getActiveLineAtTime(time);
		if (!activeLine) return;

		const font = this.buildFont();
		ctx.font = font;
		ctx.textAlign = "left";
		ctx.textBaseline = "top";

		const displayWords = this.getDisplayWords(activeLine);
		const wordLayouts = this.layoutWords(ctx, displayWords, activeLine);
		if (wordLayouts.length === 0) return;

		// Compute bounding box for background
		const { blockWidth, blockHeight, lineCount } =
			this.computeBlockMetrics(wordLayouts);
		const blockX = this.getBlockX(blockWidth);
		const blockY = -blockHeight / 2;

		// Draw background if set
		if (
			this.params.backgroundColor &&
			this.params.backgroundColor !== "transparent"
		) {
			const px = 12,
				py = 8;
			ctx.fillStyle = this.params.backgroundColor;
			this.roundRect(
				ctx,
				blockX - px,
				blockY - py,
				blockWidth + px * 2,
				blockHeight + py * 2,
				8,
			);
			ctx.fill();
		}

		// Draw each word with highlight logic
		for (const wl of wordLayouts) {
			const isActive = this.isWordActive(wl.word, time);
			this.drawWord(ctx, wl, isActive, time);
		}
	}

	private getActiveLineAtTime(time: number): CaptionLine | null {
		for (const line of this.params.lines) {
			if (time >= line.startTime && time < line.endTime) {
				return line;
			}
		}
		return null;
	}

	private getDisplayWords(line: CaptionLine): CaptionWord[] {
		return line.words;
	}

	private isWordActive(word: CaptionWord, time: number): boolean {
		return time >= word.start && time < word.end;
	}

	private layoutWords(
		ctx: Ctx,
		words: CaptionWord[],
		_line: CaptionLine,
	): WordLayout[] {
		const layouts: WordLayout[] = [];
		const fontSize = this.params.fontSize;
		const lh = fontSize * this.params.lineHeight;
		const letterSpacing = this.params.letterSpacing || 0;
		const maxPerLine = this.params.maxWordsPerLine || 4;
		const spaceWidth = this.measureText(ctx, " ") + letterSpacing;

		// Split words into visual lines based on maxWordsPerLine
		const visualLines: CaptionWord[][] = [];
		for (let i = 0; i < words.length; i += maxPerLine) {
			visualLines.push(words.slice(i, i + maxPerLine));
		}

		// Measure each visual line width
		const lineWidths: number[] = [];
		for (const vl of visualLines) {
			let w = 0;
			for (let i = 0; i < vl.length; i++) {
				const text = this.applyTextCase(vl[i].word);
				w += this.measureText(ctx, text) + letterSpacing * text.length;
				if (i < vl.length - 1) w += spaceWidth;
			}
			lineWidths.push(w);
		}

		const totalHeight = visualLines.length * lh;
		const startY = -totalHeight / 2;

		for (let li = 0; li < visualLines.length; li++) {
			const vl = visualLines[li];
			const lineWidth = lineWidths[li];
			let curX = this.getLineStartX(lineWidth);
			const curY = startY + li * lh;

			for (let wi = 0; wi < vl.length; wi++) {
				const text = this.applyTextCase(vl[wi].word);
				const wordWidth =
					this.measureText(ctx, text) + letterSpacing * text.length;

				layouts.push({
					word: vl[wi],
					text,
					x: curX,
					y: curY,
					width: wordWidth,
					lineIndex: li,
				});

				curX += wordWidth + spaceWidth;
			}
		}

		return layouts;
	}

	private computeBlockMetrics(layouts: WordLayout[]): {
		blockWidth: number;
		blockHeight: number;
		lineCount: number;
	} {
		if (layouts.length === 0)
			return { blockWidth: 0, blockHeight: 0, lineCount: 0 };

		const lh = this.params.fontSize * this.params.lineHeight;
		const lineIndices = new Set(layouts.map((l) => l.lineIndex));
		const lineCount = lineIndices.size;

		let maxRight = -Infinity;
		let minLeft = Infinity;
		for (const l of layouts) {
			minLeft = Math.min(minLeft, l.x);
			maxRight = Math.max(maxRight, l.x + l.width);
		}

		return {
			blockWidth: maxRight - minLeft,
			blockHeight: lineCount * lh,
			lineCount,
		};
	}

	private getBlockX(blockWidth: number): number {
		if (this.params.textAlign === "left") return 0;
		if (this.params.textAlign === "right") return -blockWidth;
		return -blockWidth / 2;
	}

	private getLineStartX(lineWidth: number): number {
		if (this.params.textAlign === "left") return 0;
		if (this.params.textAlign === "right") return -lineWidth;
		return -lineWidth / 2;
	}

	private drawWord(
		ctx: Ctx,
		wl: WordLayout,
		isActive: boolean,
		_time: number,
	) {
		const style = this.params.highlightStyle;
		const highlightColor = this.params.highlightColor;
		const baseColor = this.params.color;

		ctx.save();

		// Apply scale pop for karaoke-scale
		if (isActive && style === "karaoke-scale") {
			const cx = wl.x + wl.width / 2;
			const cy = wl.y + this.params.fontSize / 2;
			ctx.translate(cx, cy);
			ctx.scale(1.15, 1.15);
			ctx.translate(-cx, -cy);
		}

		// Shadow / glow
		this.applyShadowGlow(ctx, isActive);

		// Background highlight
		if (isActive && style === "background") {
			const px = 4,
				py = 2;
			ctx.fillStyle = highlightColor;
			this.roundRect(
				ctx,
				wl.x - px,
				wl.y - py,
				wl.width + px * 2,
				this.params.fontSize + py * 2,
				4,
			);
			ctx.fill();
		}

		// Stroke
		if (this.params.stroke && this.params.stroke.width > 0) {
			ctx.strokeStyle = this.params.stroke.color;
			ctx.lineWidth = this.params.stroke.width * 2;
			ctx.lineJoin = "round";
			ctx.miterLimit = 2;
			ctx.strokeText(wl.text, wl.x, wl.y);
		}

		// Fill color based on highlight state
		let fillColor = baseColor;
		if (isActive) {
			if (
				style === "karaoke" ||
				style === "karaoke-scale" ||
				style === "glow"
			) {
				fillColor = highlightColor;
			}
		}

		// Gradient fill
		const gradFill = this.createGradient(ctx, wl);
		ctx.fillStyle = gradFill || fillColor;
		ctx.fillText(wl.text, wl.x, wl.y);

		// Underline highlight
		if (isActive && style === "underline") {
			const underlineY = wl.y + this.params.fontSize + 2;
			ctx.strokeStyle = highlightColor;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(wl.x, underlineY);
			ctx.lineTo(wl.x + wl.width, underlineY);
			ctx.stroke();
		}

		// Reset shadow
		ctx.shadowColor = "transparent";
		ctx.shadowBlur = 0;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;

		ctx.restore();
	}

	private applyShadowGlow(ctx: Ctx, isActive: boolean) {
		const style = this.params.highlightStyle;

		// Glow effect for active word
		if (isActive && style === "glow" && this.params.glow) {
			ctx.shadowColor = this.params.highlightColor;
			ctx.shadowBlur = this.params.glow.intensity * 1.5;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			return;
		}

		// Regular glow
		if (this.params.glow) {
			ctx.shadowColor = this.params.glow.color;
			ctx.shadowBlur = this.params.glow.intensity;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			return;
		}

		// Regular shadow
		if (this.params.shadow) {
			ctx.shadowColor = this.params.shadow.color;
			ctx.shadowBlur = this.params.shadow.blur;
			ctx.shadowOffsetX = this.params.shadow.offsetX;
			ctx.shadowOffsetY = this.params.shadow.offsetY;
		}
	}

	private createGradient(
		ctx: Ctx,
		wl: WordLayout,
	): CanvasGradient | null {
		if (!this.params.gradient?.enabled) return null;
		const g = this.params.gradient;
		const angleRad = ((g.angle || 0) * Math.PI) / 180;
		const dx = Math.cos(angleRad) * wl.width;
		const dy = Math.sin(angleRad) * this.params.fontSize;
		const grad = ctx.createLinearGradient(
			wl.x,
			wl.y,
			wl.x + dx,
			wl.y + dy,
		);
		grad.addColorStop(0, g.colors[0]);
		grad.addColorStop(1, g.colors[1]);
		return grad;
	}

	private buildFont(): string {
		const style = this.params.fontStyle === "italic" ? "italic " : "";
		const weight = this.params.fontWeight || "bold";
		return `${style}${weight} ${this.params.fontSize}px "${this.params.fontFamily}", sans-serif`;
	}

	private applyTextCase(text: string): string {
		switch (this.params.textCase) {
			case "uppercase":
				return text.toUpperCase();
			case "lowercase":
				return text.toLowerCase();
			case "capitalize":
				return text.charAt(0).toUpperCase() + text.slice(1);
			default:
				return text;
		}
	}

	private measureText(ctx: Ctx, text: string): number {
		return ctx.measureText(text).width;
	}

	private roundRect(
		ctx: Ctx,
		x: number,
		y: number,
		w: number,
		h: number,
		r: number,
	) {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + r);
		ctx.lineTo(x + w, y + h - r);
		ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
		ctx.lineTo(x + r, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.closePath();
	}
}
