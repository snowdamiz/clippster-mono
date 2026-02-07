export type VideoEffectType =
	| "blur"
	| "pixelate"
	| "sharpen"
	| "vignette"
	| "sepia"
	| "grayscale"
	| "colorShift"
	| "glitch"
	| "wave"
	| "zoomPulse"
	| "flash"
	| "negative"
	| "noise"
	| "vhs"
	| "motionBlur"
	| "radialBlur"
	| "hueShift"
	| "colorHalftone"
	| "lensDistortion"
	| "posterize";

export interface VideoEffectBase {
	id: string;
	type: VideoEffectType;
	enabled: boolean;
	intensity: number; // 0-100, normalized per-effect
}

export interface BlurEffect extends VideoEffectBase {
	type: "blur";
	radius: number; // 0-50 pixels
}

export interface PixelateEffect extends VideoEffectBase {
	type: "pixelate";
	blockSize: number; // 2-64 pixel blocks
}

export interface SharpenEffect extends VideoEffectBase {
	type: "sharpen";
	amount: number; // 0-10 strength multiplier
}

export interface VignetteEffect extends VideoEffectBase {
	type: "vignette";
	radius: number; // 0-100, how far the vignette extends
	softness: number; // 0-100, feather amount
}

export interface SepiaEffect extends VideoEffectBase {
	type: "sepia";
	// intensity is the only param (0-100)
}

export interface GrayscaleEffect extends VideoEffectBase {
	type: "grayscale";
	// intensity is the only param (0-100)
}

export interface ColorShiftEffect extends VideoEffectBase {
	type: "colorShift";
	redOffsetX: number; // -20 to 20 pixels
	redOffsetY: number;
	blueOffsetX: number;
	blueOffsetY: number;
}

export interface GlitchEffect extends VideoEffectBase {
	type: "glitch";
	sliceCount: number; // 2-20 horizontal slices
	maxOffset: number; // 0-50 max pixel displacement
	colorBleed: number; // 0-100 RGB channel separation
}

export interface WaveEffect extends VideoEffectBase {
	type: "wave";
	amplitude: number; // 0-50 pixels
	frequency: number; // 0.5-10 wave cycles
	speed: number; // 0-10 animation speed
}

export interface ZoomPulseEffect extends VideoEffectBase {
	type: "zoomPulse";
	amount: number; // 0-50 percent zoom range
	speed: number; // 0.5-5 pulses per second
}

export interface FlashEffect extends VideoEffectBase {
	type: "flash";
	color: string; // hex color, default #ffffff
	speed: number; // 0.5-5 flashes per second
}

export interface NegativeEffect extends VideoEffectBase {
	type: "negative";
	// intensity is the only param (0-100)
}

export interface NoiseEffect extends VideoEffectBase {
	type: "noise";
	amount: number; // 0-100 noise strength
}

export interface VhsEffect extends VideoEffectBase {
	type: "vhs";
	scanlineOpacity: number; // 0-100
	colorBleed: number; // 0-50 pixels
	noiseAmount: number; // 0-100
}

export interface MotionBlurEffect extends VideoEffectBase {
	type: "motionBlur";
	angle: number; // 0-360 degrees
	distance: number; // 1-30 pixels
}

export interface RadialBlurEffect extends VideoEffectBase {
	type: "radialBlur";
	amount: number; // 1-20 blur strength
}

export interface HueShiftEffect extends VideoEffectBase {
	type: "hueShift";
	speed: number; // 0.1-5 rotations per second
}

export interface ColorHalftoneEffect extends VideoEffectBase {
	type: "colorHalftone";
	dotSize: number; // 2-20 pixel dot radius
}

export interface LensDistortionEffect extends VideoEffectBase {
	type: "lensDistortion";
	amount: number; // -100 to 100 (negative=pincushion, positive=barrel)
}

export interface PosterizeEffect extends VideoEffectBase {
	type: "posterize";
	levels: number; // 2-16 color levels
}

export type VideoEffect =
	| BlurEffect
	| PixelateEffect
	| SharpenEffect
	| VignetteEffect
	| SepiaEffect
	| GrayscaleEffect
	| ColorShiftEffect
	| GlitchEffect
	| WaveEffect
	| ZoomPulseEffect
	| FlashEffect
	| NegativeEffect
	| NoiseEffect
	| VhsEffect
	| MotionBlurEffect
	| RadialBlurEffect
	| HueShiftEffect
	| ColorHalftoneEffect
	| LensDistortionEffect
	| PosterizeEffect;

/** Defaults for a preset — same shape as VideoEffect minus the `id` field. */
export type VideoEffectDefaults = {
	[K in VideoEffect["type"]]: Omit<Extract<VideoEffect, { type: K }>, "id">;
}[VideoEffect["type"]];

export interface VideoEffectPreset {
	type: VideoEffectType;
	label: string;
	description: string;
	category: VideoEffectCategory;
	icon: string; // SVG path or identifier
	defaults: VideoEffectDefaults;
}

export type VideoEffectCategory = "blur" | "color" | "distortion" | "stylize" | "retro";
