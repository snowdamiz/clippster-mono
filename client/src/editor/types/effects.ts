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
	| "posterize"
	| "bokehBlur"
	| "tiltShift"
	| "letterbox"
	| "mirror"
	| "kaleidoscope"
	| "edgeDetect"
	| "emboss"
	| "colorOverlay"
	| "duotone"
	| "thermal"
	| "nightVision"
	| "oldFilm"
	| "tvStatic"
	| "scanlines"
	| "rgbSplit"
	| "zoomBlur"
	| "shake"
	| "strobe"
	| "colorPulse"
	| "filmBurn";

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

export interface BokehBlurEffect extends VideoEffectBase {
	type: "bokehBlur";
	radius: number; // 1-30 blur radius
	focusX: number; // 0-100 focus point X %
	focusY: number; // 0-100 focus point Y %
	focusSize: number; // 10-80 focus area size %
}

export interface TiltShiftEffect extends VideoEffectBase {
	type: "tiltShift";
	blurAmount: number; // 1-20 blur strength
	position: number; // 0-100 band position %
	bandWidth: number; // 5-50 clear band width %
}

export interface LetterboxEffect extends VideoEffectBase {
	type: "letterbox";
	barSize: number; // 0-30 bar size %
	color: string; // bar color
}

export interface MirrorEffect extends VideoEffectBase {
	type: "mirror";
	axis: "horizontal" | "vertical"; // mirror axis
}

export interface KaleidoscopeEffect extends VideoEffectBase {
	type: "kaleidoscope";
	segments: number; // 2-12 number of segments
	rotation: number; // 0-360 rotation angle
}

export interface EdgeDetectEffect extends VideoEffectBase {
	type: "edgeDetect";
	threshold: number; // 0-100 edge sensitivity
}

export interface EmbossEffect extends VideoEffectBase {
	type: "emboss";
	strength: number; // 0.5-5 emboss depth
	angle: number; // 0-360 light direction
}

export interface ColorOverlayEffect extends VideoEffectBase {
	type: "colorOverlay";
	color: string; // overlay color
	blendMode: "multiply" | "screen" | "overlay" | "color"; // blend mode
}

export interface DuotoneEffect extends VideoEffectBase {
	type: "duotone";
	shadowColor: string; // dark tone color
	highlightColor: string; // light tone color
}

export interface ThermalEffect extends VideoEffectBase {
	type: "thermal";
}

export interface NightVisionEffect extends VideoEffectBase {
	type: "nightVision";
	noiseAmount: number; // 0-50 noise strength
}

export interface OldFilmEffect extends VideoEffectBase {
	type: "oldFilm";
	scratchDensity: number; // 0-100 scratch density
	flickerAmount: number; // 0-100 brightness flicker
}

export interface TvStaticEffect extends VideoEffectBase {
	type: "tvStatic";
	density: number; // 0-100 static density
}

export interface ScanlinesEffect extends VideoEffectBase {
	type: "scanlines";
	spacing: number; // 2-10 line spacing
	opacity: number; // 0-100 line opacity
}

export interface RgbSplitEffect extends VideoEffectBase {
	type: "rgbSplit";
	amount: number; // 1-30 split distance
	angle: number; // 0-360 split direction
}

export interface ZoomBlurEffect extends VideoEffectBase {
	type: "zoomBlur";
	strength: number; // 1-20 blur strength
}

export interface ShakeEffect extends VideoEffectBase {
	type: "shake";
	amount: number; // 1-30 shake pixels
	speed: number; // 1-10 shake speed
}

export interface StrobeEffect extends VideoEffectBase {
	type: "strobe";
	speed: number; // 1-20 flashes per second
}

export interface ColorPulseEffect extends VideoEffectBase {
	type: "colorPulse";
	speed: number; // 0.5-5 pulse speed
}

export interface FilmBurnEffect extends VideoEffectBase {
	type: "filmBurn";
	speed: number; // 0.5-3 burn speed
	color: string; // burn color
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
	| PosterizeEffect
	| BokehBlurEffect
	| TiltShiftEffect
	| LetterboxEffect
	| MirrorEffect
	| KaleidoscopeEffect
	| EdgeDetectEffect
	| EmbossEffect
	| ColorOverlayEffect
	| DuotoneEffect
	| ThermalEffect
	| NightVisionEffect
	| OldFilmEffect
	| TvStaticEffect
	| ScanlinesEffect
	| RgbSplitEffect
	| ZoomBlurEffect
	| ShakeEffect
	| StrobeEffect
	| ColorPulseEffect
	| FilmBurnEffect;

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
	/** User-facing presets must have an FFmpeg export implementation. */
	exportSupported: boolean;
	/** Name of the FFmpeg filter family / chain used by export. */
	ffmpegFilterKind: string;
}

export type VideoEffectCategory = "blur" | "color" | "distortion" | "stylize" | "retro";
