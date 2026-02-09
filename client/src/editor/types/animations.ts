/**
 * Element animation types for CapCut-style In/Out/Loop animations.
 * Applied to any visual element (video, image, text, sticker).
 */

export type AnimationDirection = "in" | "out" | "loop";

export type AnimationCategory =
	| "fade"
	| "slide"
	| "zoom"
	| "bounce"
	| "spin"
	| "stylize"
	| "loop";

export type AnimationType =
	// In animations
	| "fadeIn"
	| "fadeOut"
	| "slideLeftIn"
	| "slideRightIn"
	| "slideUpIn"
	| "slideDownIn"
	| "slideLeftOut"
	| "slideRightOut"
	| "slideUpOut"
	| "slideDownOut"
	| "zoomIn"
	| "zoomOut"
	| "bounceIn"
	| "bounceOut"
	| "popIn"
	| "popOut"
	| "spinIn"
	| "spinOut"
	| "flipIn"
	| "flipOut"
	| "expandIn"
	| "shrinkOut"
	| "blurIn"
	| "blurOut"
	| "glitchIn"
	| "glitchOut"
	| "typewriterIn"
	| "wipeLeftIn"
	| "wipeRightIn"
	| "wipeUpIn"
	| "wipeDownIn"
	// Loop animations
	| "breathe"
	| "pulse"
	| "float"
	| "shake"
	| "swing"
	| "jello"
	| "heartbeat"
	| "flash"
	| "rubberBand";

export interface ElementAnimation {
	type: AnimationType;
	duration: number; // seconds
	easing: AnimationEasing;
}

export type AnimationEasing =
	| "linear"
	| "ease-in"
	| "ease-out"
	| "ease-in-out"
	| "ease-in-cubic"
	| "ease-out-cubic"
	| "ease-in-out-cubic"
	| "ease-out-back"
	| "ease-out-bounce"
	| "spring";

export interface AnimationPreset {
	type: AnimationType;
	label: string;
	category: AnimationCategory;
	direction: AnimationDirection;
	defaultDuration: number;
	defaultEasing: AnimationEasing;
}
