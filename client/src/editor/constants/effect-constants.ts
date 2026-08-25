import type { VideoEffectPreset, VideoEffectCategory } from "../types/effects";

/** Every preset listed here has a matching FFmpeg chain in `video_editor_export::build_effects_filter`. */
export const EFFECT_CATEGORIES: { key: VideoEffectCategory; label: string }[] = [
	{ key: "blur", label: "Blur & focus" },
	{ key: "color", label: "Color" },
	{ key: "distortion", label: "Distortion" },
	{ key: "stylize", label: "Stylize" },
	{ key: "retro", label: "Retro & film" },
];

type EffectPresetInput = Omit<VideoEffectPreset, "exportSupported" | "ffmpegFilterKind"> & {
	ffmpegFilterKind: string;
	exportSupported?: boolean;
};

function defineEffectPresets(presets: EffectPresetInput[]): VideoEffectPreset[] {
	return presets.map((preset) => ({
		...preset,
		exportSupported: preset.exportSupported ?? true,
	}));
}

export const EFFECT_PRESETS: VideoEffectPreset[] = defineEffectPresets([
	{
		type: "blur",
		label: "Blur",
		description: "Box blur (export-matched)",
		category: "blur",
		icon: "blur",
		ffmpegFilterKind: "boxblur",
		defaults: { type: "blur", enabled: true, intensity: 50, radius: 8 },
	},
	{
		type: "pixelate",
		label: "Pixelate",
		description: "Scale mosaic blocks",
		category: "blur",
		icon: "pixelate",
		ffmpegFilterKind: "scale-neighbor",
		defaults: { type: "pixelate", enabled: true, intensity: 50, blockSize: 12 },
	},
	{
		type: "sharpen",
		label: "Sharpen",
		description: "Unsharp mask",
		category: "blur",
		icon: "sharpen",
		ffmpegFilterKind: "unsharp",
		defaults: { type: "sharpen", enabled: true, intensity: 50, amount: 3 },
	},
	{
		type: "sepia",
		label: "Sepia",
		description: "Warm vintage tone",
		category: "color",
		icon: "sepia",
		ffmpegFilterKind: "colorchannelmixer",
		defaults: { type: "sepia", enabled: true, intensity: 80 },
	},
	{
		type: "grayscale",
		label: "Grayscale",
		description: "Desaturate",
		category: "color",
		icon: "grayscale",
		ffmpegFilterKind: "colorchannelmixer",
		defaults: { type: "grayscale", enabled: true, intensity: 100 },
	},
	{
		type: "negative",
		label: "Negative",
		description: "Invert / curves blend",
		category: "color",
		icon: "negative",
		ffmpegFilterKind: "negate-curves",
		defaults: { type: "negative", enabled: true, intensity: 100 },
	},
	{
		type: "vignette",
		label: "Vignette",
		description: "Vignette filter",
		category: "color",
		icon: "vignette",
		ffmpegFilterKind: "vignette",
		defaults: { type: "vignette", enabled: true, intensity: 60, radius: 50, softness: 60 },
	},
	{
		type: "wave",
		label: "Wave",
		description: "geq sine displacement",
		category: "distortion",
		icon: "wave",
		ffmpegFilterKind: "geq-wave",
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
		description: "RGB shift + noise",
		category: "distortion",
		icon: "glitch",
		ffmpegFilterKind: "rgbashift-noise",
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
		description: "rgbashift",
		category: "distortion",
		icon: "colorShift",
		ffmpegFilterKind: "rgbashift",
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
	{
		type: "rgbSplit",
		label: "RGB Split",
		description: "Directional rgbashift",
		category: "distortion",
		icon: "rgbSplit",
		ffmpegFilterKind: "rgbashift",
		defaults: { type: "rgbSplit", enabled: true, intensity: 50, amount: 8, angle: 0 },
	},
	{
		type: "zoomPulse",
		label: "Zoom Pulse",
		description: "zoompan sinusoid",
		category: "stylize",
		icon: "zoomPulse",
		ffmpegFilterKind: "zoompan",
		defaults: { type: "zoomPulse", enabled: true, intensity: 50, amount: 15, speed: 2 },
	},
	{
		type: "flash",
		label: "Flash",
		description: "Periodic brightness",
		category: "stylize",
		icon: "flash",
		ffmpegFilterKind: "eq-brightness",
		defaults: { type: "flash", enabled: true, intensity: 60, color: "#ffffff", speed: 2 },
	},
	{
		type: "noise",
		label: "Film Grain",
		description: "noise filter",
		category: "retro",
		icon: "noise",
		ffmpegFilterKind: "noise",
		defaults: { type: "noise", enabled: true, intensity: 40, amount: 30 },
	},
	{
		type: "posterize",
		label: "Posterize",
		description: "posterize filter",
		category: "retro",
		icon: "posterize",
		ffmpegFilterKind: "posterize",
		defaults: { type: "posterize", enabled: true, intensity: 50, levels: 6 },
	},
	{
		type: "scanlines",
		label: "Scanlines",
		description: "horizontal dim stripes (geq)",
		category: "retro",
		icon: "scanlines",
		ffmpegFilterKind: "geq-scanlines",
		defaults: { type: "scanlines", enabled: true, intensity: 50, spacing: 4, opacity: 40 },
	},
	{
		type: "letterbox",
		label: "Letterbox",
		description: "pad black bars",
		category: "stylize",
		icon: "letterbox",
		ffmpegFilterKind: "drawbox-letterbox",
		defaults: { type: "letterbox", enabled: true, intensity: 100, barSize: 12, color: "#000000" },
	},
	{
		type: "colorOverlay",
		label: "Solid Color",
		description: "Solid color tint with blend modes (Color Burn default)",
		category: "color",
		icon: "colorOverlay",
		ffmpegFilterKind: "geq-color-overlay",
		defaults: {
			type: "colorOverlay",
			enabled: true,
			intensity: 50,
			color: "#ff4500",
			blendMode: "color-burn",
		},
	},
]);

export function getEffectPreset(type: string): VideoEffectPreset | undefined {
	return EFFECT_PRESETS.find((p) => p.type === type);
}
