import type { VideoEffectPreset, VideoEffectCategory } from "../types/effects";

export const EFFECT_CATEGORIES: { key: VideoEffectCategory; label: string }[] = [
	{ key: "blur", label: "Blur & Focus" },
	{ key: "color", label: "Color" },
	{ key: "distortion", label: "Distortion" },
	{ key: "stylize", label: "Stylize" },
	{ key: "retro", label: "Retro & Film" },
];

export const EFFECT_PRESETS: VideoEffectPreset[] = [
	// ── Blur & Focus ──
	{
		type: "blur",
		label: "Blur",
		description: "Gaussian blur to soften the image",
		category: "blur",
		icon: "blur",
		defaults: {
			type: "blur",
			enabled: true,
			intensity: 50,
			radius: 8,
		},
	},
	{
		type: "pixelate",
		label: "Pixelate",
		description: "Mosaic pixel blocks for a retro look",
		category: "blur",
		icon: "pixelate",
		defaults: {
			type: "pixelate",
			enabled: true,
			intensity: 50,
			blockSize: 12,
		},
	},
	{
		type: "sharpen",
		label: "Sharpen",
		description: "Enhance edges and detail",
		category: "blur",
		icon: "sharpen",
		defaults: {
			type: "sharpen",
			enabled: true,
			intensity: 50,
			amount: 3,
		},
	},

	// ── Color ──
	{
		type: "sepia",
		label: "Sepia",
		description: "Warm vintage brown tone",
		category: "color",
		icon: "sepia",
		defaults: {
			type: "sepia",
			enabled: true,
			intensity: 80,
		},
	},
	{
		type: "grayscale",
		label: "Grayscale",
		description: "Remove all color",
		category: "color",
		icon: "grayscale",
		defaults: {
			type: "grayscale",
			enabled: true,
			intensity: 100,
		},
	},
	{
		type: "negative",
		label: "Negative",
		description: "Invert all colors",
		category: "color",
		icon: "negative",
		defaults: {
			type: "negative",
			enabled: true,
			intensity: 100,
		},
	},
	{
		type: "vignette",
		label: "Vignette",
		description: "Darken edges for cinematic focus",
		category: "color",
		icon: "vignette",
		defaults: {
			type: "vignette",
			enabled: true,
			intensity: 60,
			radius: 50,
			softness: 60,
		},
	},

	// ── Distortion ──
	{
		type: "wave",
		label: "Wave",
		description: "Wavy distortion like heat haze",
		category: "distortion",
		icon: "wave",
		defaults: {
			type: "wave",
			enabled: true,
			intensity: 50,
			amplitude: 10,
			frequency: 3,
			speed: 2,
		},
	},
	{
		type: "glitch",
		label: "Glitch",
		description: "Digital glitch with RGB split",
		category: "distortion",
		icon: "glitch",
		defaults: {
			type: "glitch",
			enabled: true,
			intensity: 50,
			sliceCount: 8,
			maxOffset: 15,
			colorBleed: 40,
		},
	},
	{
		type: "colorShift",
		label: "Chromatic Aberration",
		description: "RGB channel separation",
		category: "distortion",
		icon: "colorShift",
		defaults: {
			type: "colorShift",
			enabled: true,
			intensity: 50,
			redOffsetX: 5,
			redOffsetY: 0,
			blueOffsetX: -5,
			blueOffsetY: 0,
		},
	},

	// ── Stylize ──
	{
		type: "zoomPulse",
		label: "Zoom Pulse",
		description: "Rhythmic zoom in/out",
		category: "stylize",
		icon: "zoomPulse",
		defaults: {
			type: "zoomPulse",
			enabled: true,
			intensity: 50,
			amount: 15,
			speed: 2,
		},
	},
	{
		type: "flash",
		label: "Flash",
		description: "Strobe flash overlay",
		category: "stylize",
		icon: "flash",
		defaults: {
			type: "flash",
			enabled: true,
			intensity: 60,
			color: "#ffffff",
			speed: 2,
		},
	},

	// ── Retro & Film ──
	{
		type: "noise",
		label: "Film Grain",
		description: "Add organic film grain noise",
		category: "retro",
		icon: "noise",
		defaults: {
			type: "noise",
			enabled: true,
			intensity: 40,
			amount: 30,
		},
	},
	{
		type: "vhs",
		label: "VHS",
		description: "Retro VHS tape look with scanlines",
		category: "retro",
		icon: "vhs",
		defaults: {
			type: "vhs",
			enabled: true,
			intensity: 60,
			scanlineOpacity: 30,
			colorBleed: 8,
			noiseAmount: 20,
		},
	},
	{
		type: "posterize",
		label: "Posterize",
		description: "Reduce color levels for a poster look",
		category: "retro",
		icon: "posterize",
		defaults: {
			type: "posterize",
			enabled: true,
			intensity: 50,
			levels: 6,
		},
	},
	{
		type: "colorHalftone",
		label: "Halftone",
		description: "Comic book dot pattern",
		category: "retro",
		icon: "colorHalftone",
		defaults: {
			type: "colorHalftone",
			enabled: true,
			intensity: 50,
			dotSize: 6,
		},
	},

	// ── Additional Blur ──
	{
		type: "motionBlur",
		label: "Motion Blur",
		description: "Directional blur simulating movement",
		category: "blur",
		icon: "motionBlur",
		defaults: {
			type: "motionBlur",
			enabled: true,
			intensity: 50,
			angle: 0,
			distance: 10,
		},
	},
	{
		type: "radialBlur",
		label: "Radial Blur",
		description: "Circular blur from center outward",
		category: "blur",
		icon: "radialBlur",
		defaults: {
			type: "radialBlur",
			enabled: true,
			intensity: 50,
			amount: 5,
		},
	},

	// ── Additional Distortion ──
	{
		type: "lensDistortion",
		label: "Lens Distortion",
		description: "Barrel or pincushion lens warp",
		category: "distortion",
		icon: "lensDistortion",
		defaults: {
			type: "lensDistortion",
			enabled: true,
			intensity: 50,
			amount: 30,
		},
	},

	// ── Additional Color ──
	{
		type: "hueShift",
		label: "Hue Shift",
		description: "Animated rainbow color rotation",
		category: "color",
		icon: "hueShift",
		defaults: {
			type: "hueShift",
			enabled: true,
			intensity: 50,
			speed: 1,
		},
	},
];

export function getEffectPreset(type: string): VideoEffectPreset | undefined {
	return EFFECT_PRESETS.find((p) => p.type === type);
}
