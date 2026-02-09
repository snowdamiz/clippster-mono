import type { AnimationPreset, AnimationCategory } from "../types/animations";

export const ANIMATION_PRESETS: AnimationPreset[] = [
	// ── Fade ──
	{ type: "fadeIn", label: "Fade In", category: "fade", direction: "in", defaultDuration: 0.5, defaultEasing: "ease-out" },
	{ type: "fadeOut", label: "Fade Out", category: "fade", direction: "out", defaultDuration: 0.5, defaultEasing: "ease-in" },

	// ── Slide ──
	{ type: "slideLeftIn", label: "Slide Left In", category: "slide", direction: "in", defaultDuration: 0.5, defaultEasing: "ease-out-cubic" },
	{ type: "slideRightIn", label: "Slide Right In", category: "slide", direction: "in", defaultDuration: 0.5, defaultEasing: "ease-out-cubic" },
	{ type: "slideUpIn", label: "Slide Up In", category: "slide", direction: "in", defaultDuration: 0.5, defaultEasing: "ease-out-cubic" },
	{ type: "slideDownIn", label: "Slide Down In", category: "slide", direction: "in", defaultDuration: 0.5, defaultEasing: "ease-out-cubic" },
	{ type: "slideLeftOut", label: "Slide Left Out", category: "slide", direction: "out", defaultDuration: 0.5, defaultEasing: "ease-in-cubic" },
	{ type: "slideRightOut", label: "Slide Right Out", category: "slide", direction: "out", defaultDuration: 0.5, defaultEasing: "ease-in-cubic" },
	{ type: "slideUpOut", label: "Slide Up Out", category: "slide", direction: "out", defaultDuration: 0.5, defaultEasing: "ease-in-cubic" },
	{ type: "slideDownOut", label: "Slide Down Out", category: "slide", direction: "out", defaultDuration: 0.5, defaultEasing: "ease-in-cubic" },

	// ── Zoom ──
	{ type: "zoomIn", label: "Zoom In", category: "zoom", direction: "in", defaultDuration: 0.4, defaultEasing: "ease-out-back" },
	{ type: "zoomOut", label: "Zoom Out", category: "zoom", direction: "out", defaultDuration: 0.4, defaultEasing: "ease-in-cubic" },
	{ type: "expandIn", label: "Expand In", category: "zoom", direction: "in", defaultDuration: 0.5, defaultEasing: "ease-out-cubic" },
	{ type: "shrinkOut", label: "Shrink Out", category: "zoom", direction: "out", defaultDuration: 0.5, defaultEasing: "ease-in-cubic" },

	// ── Bounce ──
	{ type: "bounceIn", label: "Bounce In", category: "bounce", direction: "in", defaultDuration: 0.6, defaultEasing: "ease-out-bounce" },
	{ type: "bounceOut", label: "Bounce Out", category: "bounce", direction: "out", defaultDuration: 0.6, defaultEasing: "ease-in-cubic" },
	{ type: "popIn", label: "Pop In", category: "bounce", direction: "in", defaultDuration: 0.3, defaultEasing: "ease-out-back" },
	{ type: "popOut", label: "Pop Out", category: "bounce", direction: "out", defaultDuration: 0.3, defaultEasing: "ease-in-cubic" },

	// ── Spin ──
	{ type: "spinIn", label: "Spin In", category: "spin", direction: "in", defaultDuration: 0.6, defaultEasing: "ease-out-cubic" },
	{ type: "spinOut", label: "Spin Out", category: "spin", direction: "out", defaultDuration: 0.6, defaultEasing: "ease-in-cubic" },
	{ type: "flipIn", label: "Flip In", category: "spin", direction: "in", defaultDuration: 0.5, defaultEasing: "ease-out-cubic" },
	{ type: "flipOut", label: "Flip Out", category: "spin", direction: "out", defaultDuration: 0.5, defaultEasing: "ease-in-cubic" },

	// ── Stylize ──
	{ type: "blurIn", label: "Blur In", category: "stylize", direction: "in", defaultDuration: 0.5, defaultEasing: "ease-out" },
	{ type: "blurOut", label: "Blur Out", category: "stylize", direction: "out", defaultDuration: 0.5, defaultEasing: "ease-in" },
	{ type: "glitchIn", label: "Glitch In", category: "stylize", direction: "in", defaultDuration: 0.4, defaultEasing: "linear" },
	{ type: "glitchOut", label: "Glitch Out", category: "stylize", direction: "out", defaultDuration: 0.4, defaultEasing: "linear" },
	{ type: "typewriterIn", label: "Typewriter", category: "stylize", direction: "in", defaultDuration: 1.0, defaultEasing: "linear" },
	{ type: "wipeLeftIn", label: "Wipe Left", category: "stylize", direction: "in", defaultDuration: 0.5, defaultEasing: "ease-in-out" },
	{ type: "wipeRightIn", label: "Wipe Right", category: "stylize", direction: "in", defaultDuration: 0.5, defaultEasing: "ease-in-out" },
	{ type: "wipeUpIn", label: "Wipe Up", category: "stylize", direction: "in", defaultDuration: 0.5, defaultEasing: "ease-in-out" },
	{ type: "wipeDownIn", label: "Wipe Down", category: "stylize", direction: "in", defaultDuration: 0.5, defaultEasing: "ease-in-out" },

	// ── Loop ──
	{ type: "breathe", label: "Breathe", category: "loop", direction: "loop", defaultDuration: 2.0, defaultEasing: "ease-in-out" },
	{ type: "pulse", label: "Pulse", category: "loop", direction: "loop", defaultDuration: 1.0, defaultEasing: "ease-in-out" },
	{ type: "float", label: "Float", category: "loop", direction: "loop", defaultDuration: 2.0, defaultEasing: "ease-in-out" },
	{ type: "shake", label: "Shake", category: "loop", direction: "loop", defaultDuration: 0.5, defaultEasing: "linear" },
	{ type: "swing", label: "Swing", category: "loop", direction: "loop", defaultDuration: 1.5, defaultEasing: "ease-in-out" },
	{ type: "jello", label: "Jello", category: "loop", direction: "loop", defaultDuration: 1.0, defaultEasing: "ease-in-out" },
	{ type: "heartbeat", label: "Heartbeat", category: "loop", direction: "loop", defaultDuration: 1.0, defaultEasing: "ease-in-out" },
	{ type: "flash", label: "Flash", category: "loop", direction: "loop", defaultDuration: 0.8, defaultEasing: "linear" },
	{ type: "rubberBand", label: "Rubber Band", category: "loop", direction: "loop", defaultDuration: 1.0, defaultEasing: "ease-out" },
];

export const ANIMATION_CATEGORIES: { id: AnimationCategory; label: string }[] = [
	{ id: "fade", label: "Fade" },
	{ id: "slide", label: "Slide" },
	{ id: "zoom", label: "Zoom" },
	{ id: "bounce", label: "Bounce" },
	{ id: "spin", label: "Spin" },
	{ id: "stylize", label: "Stylize" },
	{ id: "loop", label: "Loop" },
];

export function getAnimationPreset(type: string): AnimationPreset | undefined {
	return ANIMATION_PRESETS.find((p) => p.type === type);
}

export function getPresetsForDirection(direction: "in" | "out" | "loop"): AnimationPreset[] {
	return ANIMATION_PRESETS.filter((p) => p.direction === direction);
}

export function getPresetsForCategory(category: AnimationCategory): AnimationPreset[] {
	return ANIMATION_PRESETS.filter((p) => p.category === category);
}
