import type { TransitionPreset, TransitionCategory } from "../types/transitions";

export const TRANSITION_CATEGORIES: { key: TransitionCategory; label: string }[] = [
	{ key: "fade", label: "Fade" },
	{ key: "slide", label: "Slide" },
	{ key: "wipe", label: "Wipe" },
	{ key: "zoom", label: "Zoom" },
	{ key: "push", label: "Push" },
	{ key: "cover", label: "Cover & Reveal" },
	{ key: "stylize", label: "Stylize" },
];

export const TRANSITION_PRESETS: TransitionPreset[] = [
	// ── Fade ──
	{
		type: "crossfade",
		label: "Crossfade",
		description: "Smooth opacity blend between clips",
		category: "fade",
		defaultDuration: 0.5,
	},
	{
		type: "fadeToBlack",
		label: "Fade to Black",
		description: "Fade out to black, then fade in",
		category: "fade",
		defaultDuration: 0.5,
	},
	{
		type: "fadeToWhite",
		label: "Fade to White",
		description: "Fade out to white, then fade in",
		category: "fade",
		defaultDuration: 0.5,
	},
	{
		type: "dissolve",
		label: "Dissolve",
		description: "Pixel dissolve transition",
		category: "fade",
		defaultDuration: 0.5,
	},

	// ── Slide ──
	{
		type: "slideLeft",
		label: "Slide Left",
		description: "New clip slides in from right",
		category: "slide",
		defaultDuration: 0.4,
	},
	{
		type: "slideRight",
		label: "Slide Right",
		description: "New clip slides in from left",
		category: "slide",
		defaultDuration: 0.4,
	},
	{
		type: "slideUp",
		label: "Slide Up",
		description: "New clip slides in from bottom",
		category: "slide",
		defaultDuration: 0.4,
	},
	{
		type: "slideDown",
		label: "Slide Down",
		description: "New clip slides in from top",
		category: "slide",
		defaultDuration: 0.4,
	},

	// ── Wipe ──
	{
		type: "wipeLeft",
		label: "Wipe Left",
		description: "Wipe reveals new clip from right to left",
		category: "wipe",
		defaultDuration: 0.4,
	},
	{
		type: "wipeRight",
		label: "Wipe Right",
		description: "Wipe reveals new clip from left to right",
		category: "wipe",
		defaultDuration: 0.4,
	},
	{
		type: "wipeUp",
		label: "Wipe Up",
		description: "Wipe reveals new clip from bottom to top",
		category: "wipe",
		defaultDuration: 0.4,
	},
	{
		type: "wipeDown",
		label: "Wipe Down",
		description: "Wipe reveals new clip from top to bottom",
		category: "wipe",
		defaultDuration: 0.4,
	},

	// ── Zoom ──
	{
		type: "zoomIn",
		label: "Zoom In",
		description: "Zoom into outgoing clip, reveal incoming",
		category: "zoom",
		defaultDuration: 0.5,
	},
	{
		type: "zoomOut",
		label: "Zoom Out",
		description: "Zoom out from incoming clip",
		category: "zoom",
		defaultDuration: 0.5,
	},

	// ── Wipe (shape) ──
	{
		type: "circleWipe",
		label: "Circle Wipe",
		description: "Circular iris wipe from center",
		category: "wipe",
		defaultDuration: 0.5,
	},
	{
		type: "diamondWipe",
		label: "Diamond Wipe",
		description: "Diamond-shaped wipe from center",
		category: "wipe",
		defaultDuration: 0.5,
	},
	{
		type: "clockWipe",
		label: "Clock Wipe",
		description: "Clockwise radial wipe",
		category: "wipe",
		defaultDuration: 0.6,
	},

	// ── Push ──
	{
		type: "pushLeft",
		label: "Push Left",
		description: "Incoming pushes outgoing to the left",
		category: "push",
		defaultDuration: 0.4,
	},
	{
		type: "pushRight",
		label: "Push Right",
		description: "Incoming pushes outgoing to the right",
		category: "push",
		defaultDuration: 0.4,
	},
	{
		type: "pushUp",
		label: "Push Up",
		description: "Incoming pushes outgoing upward",
		category: "push",
		defaultDuration: 0.4,
	},
	{
		type: "pushDown",
		label: "Push Down",
		description: "Incoming pushes outgoing downward",
		category: "push",
		defaultDuration: 0.4,
	},

	// ── Cover & Reveal ──
	{
		type: "coverLeft",
		label: "Cover Left",
		description: "Incoming slides over outgoing from right",
		category: "cover",
		defaultDuration: 0.4,
	},
	{
		type: "coverRight",
		label: "Cover Right",
		description: "Incoming slides over outgoing from left",
		category: "cover",
		defaultDuration: 0.4,
	},
	{
		type: "revealLeft",
		label: "Reveal Left",
		description: "Outgoing slides away revealing incoming",
		category: "cover",
		defaultDuration: 0.4,
	},
	{
		type: "revealRight",
		label: "Reveal Right",
		description: "Outgoing slides away revealing incoming",
		category: "cover",
		defaultDuration: 0.4,
	},

	// ── Stylize ──
	{
		type: "blur",
		label: "Blur",
		description: "Blur transition between clips",
		category: "stylize",
		defaultDuration: 0.5,
	},
	{
		type: "rotateIn",
		label: "Rotate In",
		description: "Incoming rotates in from center",
		category: "stylize",
		defaultDuration: 0.5,
	},
	{
		type: "flipHorizontal",
		label: "Flip Horizontal",
		description: "3D horizontal flip between clips",
		category: "stylize",
		defaultDuration: 0.5,
	},
	{
		type: "flipVertical",
		label: "Flip Vertical",
		description: "3D vertical flip between clips",
		category: "stylize",
		defaultDuration: 0.5,
	},
	{
		type: "glitch",
		label: "Glitch",
		description: "Digital glitch distortion transition",
		category: "stylize",
		defaultDuration: 0.4,
	},
];

export function getTransitionPreset(type: string): TransitionPreset | undefined {
	return TRANSITION_PRESETS.find((p) => p.type === type);
}
