import type { VideoEffect, VideoEffectType } from "./effects";
import type { Transition } from "./transitions";

export interface TScene {
	id: string;
	name: string;
	isMain: boolean;
	tracks: TimelineTrack[];
	transitions?: Transition[];
	bookmarks: number[];
	createdAt: Date;
	updatedAt: Date;
}

export type TrackType = "video" | "text" | "audio" | "sticker" | "effect" | "caption";

interface BaseTrack {
	id: string;
	name: string;
	locked?: boolean;
}

export interface VideoTrack extends BaseTrack {
	type: "video";
	elements: (VideoElement | ImageElement)[];
	isMain: boolean;
	muted: boolean;
	hidden: boolean;
}

export interface TextTrack extends BaseTrack {
	type: "text";
	elements: TextElement[];
	hidden: boolean;
}

export interface AudioTrack extends BaseTrack {
	type: "audio";
	elements: AudioElement[];
	muted: boolean;
}

export interface StickerTrack extends BaseTrack {
	type: "sticker";
	elements: StickerElement[];
	hidden: boolean;
}

export interface EffectTrack extends BaseTrack {
	type: "effect";
	elements: EffectElement[];
	hidden: boolean;
}

export interface CaptionTrack extends BaseTrack {
	type: "caption";
	elements: CaptionElement[];
	hidden: boolean;
}

export type TimelineTrack = VideoTrack | TextTrack | AudioTrack | StickerTrack | EffectTrack | CaptionTrack;

export interface Transform {
	scale: number;
	position: {
		x: number;
		y: number;
	};
	rotate: number;
}

export interface ColorAdjustments {
	brightness: number; // -100 to 100, default 0
	contrast: number; // -100 to 100, default 0
	saturation: number; // -100 to 100, default 0
	temperature: number; // -100 to 100, default 0
	highlights: number; // -100 to 100, default 0
	shadows: number; // -100 to 100, default 0
	exposure: number; // -100 to 100, default 0
	fade: number; // 0 to 100, default 0
	tint: string; // hex color, default ""
	sharpness: number; // 0 to 100, default 0
}

export const DEFAULT_COLOR_ADJUSTMENTS: ColorAdjustments = {
	brightness: 0,
	contrast: 0,
	saturation: 0,
	temperature: 0,
	highlights: 0,
	shadows: 0,
	exposure: 0,
	fade: 0,
	tint: "",
	sharpness: 0,
};

/** A control point on an RGB curve (both axes 0–1) */
export interface ColorCurvePoint {
	x: number;
	y: number;
}

/** Per-channel RGB curves for color grading */
export interface ColorCurves {
	master?: ColorCurvePoint[];
	red?: ColorCurvePoint[];
	green?: ColorCurvePoint[];
	blue?: ColorCurvePoint[];
}

/** Hue/Saturation/Luminance offset for one tonal range */
export interface ColorWheelValues {
	/** Hue rotation in degrees (-180 to 180) */
	hue: number;
	/** Saturation boost (-1 to 1) */
	saturation: number;
	/** Luminance offset (-1 to 1) */
	luminance: number;
}

/** Three-way (shadows / midtones / highlights) color correction */
export interface ColorWheels {
	shadows?: ColorWheelValues;
	midtones?: ColorWheelValues;
	highlights?: ColorWheelValues;
}

export type BlendMode =
	| "normal"
	| "multiply"
	| "screen"
	| "overlay"
	| "soft-light"
	| "hard-light"
	| "darken"
	| "lighten"
	| "color-dodge"
	| "color-burn"
	| "difference"
	| "exclusion";

export interface FlipState {
	horizontal: boolean;
	vertical: boolean;
}

export interface CropRect {
	top: number; // 0-1, fraction of source height cropped from top
	right: number; // 0-1, fraction of source width cropped from right
	bottom: number; // 0-1, fraction of source height cropped from bottom
	left: number; // 0-1, fraction of source width cropped from left
}

interface BaseAudioElement extends BaseTimelineElement {
	type: "audio";
	volume: number;
	muted?: boolean;
	buffer?: AudioBuffer;
	speed?: number; // 0.1-16, default 1
	reversed?: boolean;
	fadeIn?: number; // seconds
	fadeOut?: number; // seconds
	audioEffects?: import("./audio-effects").AudioEffect[];
	pan?: number; // stereo pan: -1 (left) to +1 (right), 0 = center
}

export interface UploadAudioElement extends BaseAudioElement {
	sourceType: "upload";
	mediaId: string;
}

export interface LibraryAudioElement extends BaseAudioElement {
	sourceType: "library";
	sourceUrl: string;
}

export type AudioElement = UploadAudioElement | LibraryAudioElement;

interface BaseTimelineElement {
	id: string;
	name: string;
	duration: number;
	startTime: number;
	trimStart: number;
	trimEnd: number;
	fadeIn?: number; // seconds
	fadeOut?: number; // seconds
	linkedElementId?: string; // ID of a linked element (e.g. extracted audio ↔ source video)
	keyframes?: import("./keyframes").ElementKeyframes;
	animationIn?: import("./animations").ElementAnimation;
	animationOut?: import("./animations").ElementAnimation;
	animationLoop?: import("./animations").ElementAnimation;
	orderIndex?: number; // Layer order within track (higher = renders on top), CapCut-style
	/** Per-element lock (image editor layers); track.locked remains supported */
	locked?: boolean;
	/** Optional nested group id for Photoshop-style layer groups */
	groupId?: string | null;
}

// ── Shape masks ───────────────────────────────────────────────────────────

export type MaskShapeType = "rectangle" | "ellipse" | "polygon";

export interface MaskShape {
	id: string;
	type: MaskShapeType;
	/** Normalised X of mask center, 0–1 relative to canvas width. */
	x: number;
	/** Normalised Y of mask center, 0–1 relative to canvas height. */
	y: number;
	/** Normalised width, 0–1 relative to canvas width. */
	width: number;
	/** Normalised height, 0–1 relative to canvas height. */
	height: number;
	/** Feather radius in canvas pixels (0 = hard edge). */
	feather: number;
	/** If true, the mask punches a hole instead of revealing. */
	invert: boolean;
	/** Rotation in degrees. */
	rotation: number;
	/** Corner radius as fraction of half the shorter side (0 = sharp, 1 = fully rounded). Rectangle only. */
	cornerRadius?: number;
	/** Polygon points in normalized coords. Used when type === "polygon". */
	points?: { x: number; y: number }[];
}

export type MediaFitMode = "contain" | "cover";

export interface VideoElement extends BaseTimelineElement {
	type: "video";
	mediaId: string;
	muted?: boolean;
	hidden?: boolean;
	/** How source media is fitted to the canvas. Overlay B-roll uses `cover`. */
	mediaFit?: MediaFitMode;
	transform: Transform;
	opacity: number;
	volume?: number; // 0-2, default 1
	speed?: number; // 0.1-16, default 1
	reversed?: boolean;
	flip?: FlipState;
	crop?: CropRect;
	colorAdjustments?: ColorAdjustments;
	colorCurves?: ColorCurves;
	colorWheels?: ColorWheels;
	lutPath?: string; // absolute path to a .cube LUT file
	blendMode?: BlendMode;
	effects?: VideoEffect[];
	filterPreset?: string; // active filter preset id, for UI display
	chromakey?: import("./chromakey").ChromakeySettings;
	pan?: number; // stereo pan: -1 (left) to +1 (right), 0 = center
	masks?: MaskShape[];
}

export interface ImageElement extends BaseTimelineElement {
	type: "image";
	mediaId: string;
	hidden?: boolean;
	mediaFit?: MediaFitMode;
	transform: Transform;
	opacity: number;
	flip?: FlipState;
	crop?: CropRect;
	colorAdjustments?: ColorAdjustments;
	colorCurves?: ColorCurves;
	colorWheels?: ColorWheels;
	lutPath?: string;
	blendMode?: BlendMode;
	effects?: VideoEffect[];
	filterPreset?: string; // active filter preset id, for UI display
	chromakey?: import("./chromakey").ChromakeySettings;
	pan?: number;
	masks?: MaskShape[];
}

export interface TextStroke {
	color: string;
	width: number;
}

export interface TextShadow {
	color: string;
	offsetX: number;
	offsetY: number;
	blur: number;
}

export interface TextGlow {
	color: string;
	intensity: number; // 0-20 blur radius
}

export interface TextGradient {
	enabled: boolean;
	colors: [string, string]; // start, end
	angle: number; // degrees
}

export type TextBubbleStyle =
	| "none"
	| "rounded"
	| "pill"
	| "speech"
	| "thought"
	| "label"
	| "neon-box"
	| "glitch";

export type TextCase = "none" | "uppercase" | "lowercase" | "capitalize";

export interface TextElement extends BaseTimelineElement {
	type: "text";
	content: string;
	fontSize: number;
	fontFamily: string;
	fontFilePath?: string; // absolute path to .ttf/.otf for custom fonts
	color: string;
	backgroundColor: string;
	textAlign: "left" | "center" | "right";
	fontWeight: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
	fontStyle: "normal" | "italic";
	textDecoration: "none" | "underline" | "line-through";
	letterSpacing: number; // pixels, default 0
	lineHeight: number; // multiplier, default 1.2
	textCase: TextCase;
	stroke?: TextStroke;
	shadow?: TextShadow;
	glow?: TextGlow;
	gradient?: TextGradient;
	bubbleStyle: TextBubbleStyle;
	bubbleColor?: string;
	bubblePadding?: number;
	bubbleOpacity?: number; // 0-1, background opacity independent of text opacity; default 0.7
	textOpacity?: number; // 0-1, glyph opacity independent of element opacity; default 1
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	blendMode?: BlendMode;
}

export interface StickerElement extends BaseTimelineElement {
	type: "sticker";
	iconName: string;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	color?: string;
	blendMode?: BlendMode;
}

export interface EffectElement extends BaseTimelineElement {
	type: "effect";
	effectType: VideoEffectType;
	enabled: boolean;
	intensity: number; // 0-100
	params: Record<string, number | string>;
}

// ---- Caption Types ----

export interface CaptionWord {
	word: string;
	start: number; // absolute time in seconds
	end: number; // absolute time in seconds
	confidence?: number;
}

export interface CaptionLine {
	text: string;
	words: CaptionWord[];
	startTime: number;
	endTime: number;
}

export type CaptionHighlightStyle =
	| "none" // no word highlight
	| "karaoke" // word-by-word color change
	| "karaoke-scale" // word-by-word color change + scale pop
	| "underline" // word-by-word underline
	| "background" // word-by-word background highlight
	| "glow"; // word-by-word glow pulse

export type CaptionPresetId =
	| "default"
	| "karaoke"
	| "karaoke-pop"
	| "neon-glow"
	| "boxed"
	| "gradient-pop"
	| "gradient-neon"
	// Single-word styles
	| "single-bold"
	| "single-yellow"
	| "single-red"
	| "single-green"
	| "single-boxed"
	| "single-glow"
	| "single-outline"
	| "single-gradient"
	// Multi-line / phrase styles
	| "hormozi"
	| "mr-beast"
	// TikTok pack
	| "tiktok-bold"
	| "tiktok-gen-z"
	| "tiktok-mobile"
	// YouTube pack
	| "youtube-tutorial"
	| "youtube-pro"
	| "youtube-vlog"
	// Instagram pack
	| "instagram-aesthetic"
	| "instagram-story"
	| "instagram-reel"
	// Podcast pack
	| "podcast-minimal"
	| "podcast-highlight"
	| "podcast-pro"
	// Gaming pack
	| "gaming-neon"
	| "gaming-cyber"
	| "gaming-action"
	// Business pack
	| "business-clean"
	| "business-accent"
	| "business-modern"
	// Motivational pack
	| "motivational-bold"
	| "motivational-gradient"
	// Subtitle pack
	| "subtitle-documentary"
	| "subtitle-tutorial"
	| "subtitle-cinematic"
	// Additional creator styles
	| "ali-abdaal"
	| "mkbhd"
	| "gary-vee";

export interface CaptionElement extends BaseTimelineElement {
	type: "caption";
	lines: CaptionLine[];
	presetId: CaptionPresetId;
	highlightStyle: CaptionHighlightStyle;
	highlightColor: string; // color for the active/highlighted word
	fontSize: number;
	fontFamily: string;
	fontFilePath?: string;
	color: string; // base text color (inactive words)
	backgroundColor: string;
	textAlign: "left" | "center" | "right";
	fontWeight: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
	fontStyle: "normal" | "italic";
	letterSpacing: number;
	lineHeight: number;
	textCase: TextCase;
	stroke?: TextStroke;
	shadow?: TextShadow;
	glow?: TextGlow;
	gradient?: TextGradient;
	animationIn?: import("./animations").ElementAnimation;
	animationOut?: import("./animations").ElementAnimation;
	animationLoop?: import("./animations").ElementAnimation;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	maxWordsPerLine: number; // how many words per visual line
}

export type TimelineElement =
	| AudioElement
	| VideoElement
	| ImageElement
	| TextElement
	| StickerElement
	| EffectElement
	| CaptionElement;

export type ElementType = TimelineElement["type"];

export type CreateUploadAudioElement = Omit<UploadAudioElement, "id">;
export type CreateLibraryAudioElement = Omit<LibraryAudioElement, "id">;
export type CreateAudioElement =
	| CreateUploadAudioElement
	| CreateLibraryAudioElement;
export type CreateVideoElement = Omit<VideoElement, "id">;
export type CreateImageElement = Omit<ImageElement, "id">;
export type CreateTextElement = Omit<TextElement, "id">;
export type CreateStickerElement = Omit<StickerElement, "id">;
export type CreateEffectElement = Omit<EffectElement, "id">;
export type CreateCaptionElement = Omit<CaptionElement, "id">;
export type CreateTimelineElement =
	| CreateAudioElement
	| CreateVideoElement
	| CreateImageElement
	| CreateTextElement
	| CreateStickerElement
	| CreateEffectElement
	| CreateCaptionElement;

// ---- Drag State ----

export interface ElementDragState {
	isDragging: boolean;
	elementId: string | null;
	trackId: string | null;
	startMouseX: number;
	startMouseY: number;
	startElementTime: number;
	clickOffsetTime: number;
	currentTime: number;
	currentMouseY: number;
}

export interface DropTarget {
	trackIndex: number;
	isNewTrack: boolean;
	insertPosition: "above" | "below" | null;
	xPosition: number;
	targetElementId?: string;
	targetTrackId?: string;
}

export interface ComputeDropTargetParams {
	elementType: ElementType;
	mouseX: number;
	mouseY: number;
	tracks: TimelineTrack[];
	playheadTime: number;
	isExternalDrop: boolean;
	elementDuration: number;
	pixelsPerSecond: number;
	zoomLevel: number;
	verticalDragDirection?: "up" | "down" | null;
	startTimeOverride?: number;
	excludeElementId?: string;
}

export interface ClipboardItem {
	trackId: string;
	trackType: TrackType;
	element: CreateTimelineElement;
}
