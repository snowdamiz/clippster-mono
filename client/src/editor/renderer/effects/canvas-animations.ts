/**
 * Canvas animation system for CapCut-style In/Out/Loop animations.
 *
 * applyAnimationPre() is called BEFORE the element draws — it manipulates
 * the canvas context (translate, scale, rotate, globalAlpha, filter).
 *
 * applyAnimationPost() is called AFTER the element draws — for clip-mask
 * based animations (wipes) that need to erase parts of the drawn content.
 */

import type { ElementAnimation, AnimationEasing } from "../../types/animations";

// ── Easing ──

function applyEasing(t: number, easing: AnimationEasing): number {
	switch (easing) {
		case "linear":
			return t;
		case "ease-in":
			return t * t;
		case "ease-out":
			return t * (2 - t);
		case "ease-in-out":
			return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
		case "ease-in-cubic":
			return t * t * t;
		case "ease-out-cubic":
			return 1 - Math.pow(1 - t, 3);
		case "ease-in-out-cubic":
			return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
		case "ease-out-back": {
			const c1 = 1.70158;
			const c3 = c1 + 1;
			return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
		}
		case "ease-out-bounce": {
			const n1 = 7.5625;
			const d1 = 2.75;
			let x = t;
			if (x < 1 / d1) return n1 * x * x;
			if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75; }
			if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375; }
			x -= 2.625 / d1;
			return n1 * x * x + 0.984375;
		}
		case "spring": {
			const w = 4.71238;
			const decay = 4;
			return 1 - Math.exp(-decay * t) * Math.cos(w * t);
		}
		default:
			return t;
	}
}

// ── Progress Calculation ──

export interface AnimationContext {
	elapsed: number; // seconds since element start
	elementDuration: number; // total element duration in seconds
	canvasWidth: number;
	canvasHeight: number;
}

/**
 * Compute the animation progress (0→1) for an "in" animation.
 * Returns -1 if the animation is not active at this time.
 */
function getInProgress(anim: ElementAnimation, ctx: AnimationContext): number {
	if (ctx.elapsed < 0 || ctx.elapsed >= anim.duration) return -1;
	const raw = ctx.elapsed / anim.duration;
	return applyEasing(Math.max(0, Math.min(1, raw)), anim.easing);
}

/**
 * Compute the animation progress (1→0) for an "out" animation.
 * Returns -1 if the animation is not active at this time.
 */
function getOutProgress(anim: ElementAnimation, ctx: AnimationContext): number {
	const outStart = ctx.elementDuration - anim.duration;
	if (ctx.elapsed < outStart || ctx.elapsed > ctx.elementDuration) return -1;
	const raw = (ctx.elapsed - outStart) / anim.duration;
	return 1 - applyEasing(Math.max(0, Math.min(1, raw)), anim.easing);
}

/**
 * Compute the loop animation cycle position (0→1→0→1...).
 */
function getLoopProgress(anim: ElementAnimation, ctx: AnimationContext): number {
	if (anim.duration <= 0) return 0;
	const cyclePos = (ctx.elapsed % anim.duration) / anim.duration;
	return cyclePos;
}

// ── Animation Application ──

export interface AnimationResult {
	opacity: number; // multiplier (1 = no change)
	translateX: number; // pixels
	translateY: number; // pixels
	scaleX: number; // multiplier (1 = no change)
	scaleY: number; // multiplier (1 = no change)
	rotation: number; // radians
	blur: number; // pixels (0 = no blur)
	clipRect?: { x: number; y: number; w: number; h: number }; // wipe clip region
}

const IDENTITY: AnimationResult = {
	opacity: 1,
	translateX: 0,
	translateY: 0,
	scaleX: 1,
	scaleY: 1,
	rotation: 0,
	blur: 0,
};

/**
 * Compute the combined animation transforms for an element at the current time.
 * Returns an AnimationResult that should be applied to the canvas context.
 */
export function computeAnimationTransforms(
	animIn: ElementAnimation | undefined,
	animOut: ElementAnimation | undefined,
	animLoop: ElementAnimation | undefined,
	ctx: AnimationContext,
): AnimationResult {
	const result: AnimationResult = { ...IDENTITY };

	// Apply "in" animation
	if (animIn) {
		const p = getInProgress(animIn, ctx);
		if (p >= 0) {
			applyInAnimation(animIn.type, p, ctx, result);
		}
	}

	// Apply "out" animation
	if (animOut) {
		const p = getOutProgress(animOut, ctx);
		if (p >= 0) {
			applyOutAnimation(animOut.type, p, ctx, result);
		}
	}

	// Apply "loop" animation (always active while element is visible)
	if (animLoop) {
		const p = getLoopProgress(animLoop, ctx);
		applyLoopAnimation(animLoop.type, p, ctx, result);
	}

	return result;
}

// ── In Animations ──
// p goes from 0 (start) to 1 (fully visible) — already eased

function applyInAnimation(type: string, p: number, ctx: AnimationContext, r: AnimationResult) {
	switch (type) {
		case "fadeIn":
			r.opacity *= p;
			break;
		case "slideLeftIn":
			r.translateX += (1 - p) * -ctx.canvasWidth;
			break;
		case "slideRightIn":
			r.translateX += (1 - p) * ctx.canvasWidth;
			break;
		case "slideUpIn":
			r.translateY += (1 - p) * -ctx.canvasHeight;
			break;
		case "slideDownIn":
			r.translateY += (1 - p) * ctx.canvasHeight;
			break;
		case "zoomIn":
			r.scaleX *= p;
			r.scaleY *= p;
			r.opacity *= p;
			break;
		case "expandIn": {
			// Scale from 3x down to 1x
			const s = 1 + (1 - p) * 2;
			r.scaleX *= s;
			r.scaleY *= s;
			r.opacity *= p;
			break;
		}
		case "bounceIn":
			r.scaleX *= p;
			r.scaleY *= p;
			r.opacity *= Math.min(1, p * 2);
			break;
		case "popIn": {
			// Overshoot scale then settle
			const overshoot = p < 0.7 ? p / 0.7 * 1.15 : 1.15 - (p - 0.7) / 0.3 * 0.15;
			r.scaleX *= overshoot;
			r.scaleY *= overshoot;
			r.opacity *= Math.min(1, p * 3);
			break;
		}
		case "spinIn":
			r.rotation += (1 - p) * -Math.PI * 2;
			r.scaleX *= p;
			r.scaleY *= p;
			r.opacity *= p;
			break;
		case "flipIn":
			r.scaleX *= p;
			r.opacity *= p;
			break;
		case "blurIn":
			r.blur += (1 - p) * 20;
			r.opacity *= p;
			break;
		case "glitchIn": {
			const intensity = 1 - p;
			r.translateX += Math.sin(p * 30) * intensity * 20;
			r.opacity *= Math.min(1, p * 2);
			break;
		}
		case "typewriterIn":
			// Typewriter is handled as a clip — reveal from left
			r.clipRect = { x: 0, y: 0, w: ctx.canvasWidth * p, h: ctx.canvasHeight };
			break;
		case "wipeLeftIn":
			r.clipRect = { x: 0, y: 0, w: ctx.canvasWidth * p, h: ctx.canvasHeight };
			break;
		case "wipeRightIn":
			r.clipRect = { x: ctx.canvasWidth * (1 - p), y: 0, w: ctx.canvasWidth * p, h: ctx.canvasHeight };
			break;
		case "wipeUpIn":
			r.clipRect = { x: 0, y: 0, w: ctx.canvasWidth, h: ctx.canvasHeight * p };
			break;
		case "wipeDownIn":
			r.clipRect = { x: 0, y: ctx.canvasHeight * (1 - p), w: ctx.canvasWidth, h: ctx.canvasHeight * p };
			break;
	}
}

// ── Out Animations ──
// p goes from 1 (fully visible) to 0 (gone) — already eased

function applyOutAnimation(type: string, p: number, ctx: AnimationContext, r: AnimationResult) {
	switch (type) {
		case "fadeOut":
			r.opacity *= p;
			break;
		case "slideLeftOut":
			r.translateX += (1 - p) * -ctx.canvasWidth;
			break;
		case "slideRightOut":
			r.translateX += (1 - p) * ctx.canvasWidth;
			break;
		case "slideUpOut":
			r.translateY += (1 - p) * -ctx.canvasHeight;
			break;
		case "slideDownOut":
			r.translateY += (1 - p) * ctx.canvasHeight;
			break;
		case "zoomOut":
			r.scaleX *= p;
			r.scaleY *= p;
			r.opacity *= p;
			break;
		case "shrinkOut": {
			r.scaleX *= p;
			r.scaleY *= p;
			r.opacity *= p;
			break;
		}
		case "bounceOut":
			r.scaleX *= p;
			r.scaleY *= p;
			r.opacity *= p;
			break;
		case "popOut":
			r.scaleX *= p;
			r.scaleY *= p;
			r.opacity *= Math.min(1, p * 2);
			break;
		case "spinOut":
			r.rotation += (1 - p) * Math.PI * 2;
			r.scaleX *= p;
			r.scaleY *= p;
			r.opacity *= p;
			break;
		case "flipOut":
			r.scaleX *= p;
			r.opacity *= p;
			break;
		case "blurOut":
			r.blur += (1 - p) * 20;
			r.opacity *= p;
			break;
		case "glitchOut": {
			const intensity = 1 - p;
			r.translateX += Math.sin((1 - p) * 30) * intensity * 20;
			r.opacity *= Math.min(1, p * 2);
			break;
		}
	}
}

// ── Loop Animations ──
// p is the cycle position 0→1 (repeating)

function applyLoopAnimation(type: string, p: number, _ctx: AnimationContext, r: AnimationResult) {
	const cycle = Math.sin(p * Math.PI * 2); // -1 to 1
	const halfCycle = Math.sin(p * Math.PI); // 0 to 1 to 0

	switch (type) {
		case "breathe":
			r.scaleX *= 1 + halfCycle * 0.05;
			r.scaleY *= 1 + halfCycle * 0.05;
			break;
		case "pulse":
			r.scaleX *= 1 + halfCycle * 0.1;
			r.scaleY *= 1 + halfCycle * 0.1;
			break;
		case "float":
			r.translateY += cycle * 10;
			break;
		case "shake": {
			const shakeX = Math.sin(p * Math.PI * 8) * 5;
			r.translateX += shakeX;
			break;
		}
		case "swing":
			r.rotation += cycle * 0.15; // ~8.5 degrees
			break;
		case "jello": {
			const skewAmount = Math.sin(p * Math.PI * 2) * 0.05;
			// Approximate jello with asymmetric scale
			r.scaleX *= 1 + skewAmount;
			r.scaleY *= 1 - skewAmount * 0.5;
			break;
		}
		case "heartbeat": {
			// Double-beat pattern
			const beat1 = p < 0.15 ? Math.sin(p / 0.15 * Math.PI) : 0;
			const beat2 = p > 0.25 && p < 0.4 ? Math.sin((p - 0.25) / 0.15 * Math.PI) * 0.7 : 0;
			const beatScale = 1 + (beat1 + beat2) * 0.15;
			r.scaleX *= beatScale;
			r.scaleY *= beatScale;
			break;
		}
		case "flash":
			r.opacity *= 0.3 + halfCycle * 0.7;
			break;
		case "rubberBand": {
			// Stretch horizontally then vertically
			if (p < 0.5) {
				const t = p / 0.5;
				r.scaleX *= 1 + Math.sin(t * Math.PI) * 0.2;
				r.scaleY *= 1 - Math.sin(t * Math.PI) * 0.1;
			} else {
				const t = (p - 0.5) / 0.5;
				r.scaleX *= 1 - Math.sin(t * Math.PI) * 0.1;
				r.scaleY *= 1 + Math.sin(t * Math.PI) * 0.15;
			}
			break;
		}
	}
}

/**
 * Apply animation transforms to a CanvasRenderingContext2D BEFORE the element draws.
 * Call this after ctx.save() and before drawing content.
 * Returns true if a clip rect was set (caller should handle).
 */
export function applyAnimationToContext(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	result: AnimationResult,
	centerX: number,
	centerY: number,
): boolean {
	// Opacity
	if (result.opacity !== 1) {
		ctx.globalAlpha *= result.opacity;
	}

	// Translate
	if (result.translateX !== 0 || result.translateY !== 0) {
		ctx.translate(result.translateX, result.translateY);
	}

	// Scale + Rotation around center
	if (result.scaleX !== 1 || result.scaleY !== 1 || result.rotation !== 0) {
		ctx.translate(centerX, centerY);
		if (result.rotation !== 0) {
			ctx.rotate(result.rotation);
		}
		if (result.scaleX !== 1 || result.scaleY !== 1) {
			ctx.scale(result.scaleX, result.scaleY);
		}
		ctx.translate(-centerX, -centerY);
	}

	// Blur
	if (result.blur > 0) {
		const currentFilter = ctx.filter === "none" ? "" : ctx.filter + " ";
		ctx.filter = currentFilter + `blur(${result.blur.toFixed(1)}px)`;
	}

	// Clip rect (for wipe animations)
	if (result.clipRect) {
		ctx.beginPath();
		ctx.rect(result.clipRect.x, result.clipRect.y, result.clipRect.w, result.clipRect.h);
		ctx.clip();
		return true;
	}

	return false;
}

/**
 * Check if any animation is currently active for the given element timing.
 */
export function hasActiveAnimation(
	animIn: ElementAnimation | undefined,
	animOut: ElementAnimation | undefined,
	animLoop: ElementAnimation | undefined,
	elapsed: number,
	elementDuration: number,
): boolean {
	if (animLoop) return true;
	if (animIn && elapsed >= 0 && elapsed < animIn.duration) return true;
	if (animOut && elapsed > elementDuration - animOut.duration) return true;
	return false;
}
