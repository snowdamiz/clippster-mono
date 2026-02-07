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

export type TrackType = "video" | "text" | "audio" | "sticker" | "effect";

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

export type TimelineTrack = VideoTrack | TextTrack | AudioTrack | StickerTrack | EffectTrack;

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
	fadeIn?: number; // seconds
	fadeOut?: number; // seconds
	audioEffects?: import("./audio-effects").AudioEffect[];
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
	keyframes?: import("./keyframes").ElementKeyframes;
}

export interface VideoElement extends BaseTimelineElement {
	type: "video";
	mediaId: string;
	muted?: boolean;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	volume?: number; // 0-2, default 1
	speed?: number; // 0.1-16, default 1
	flip?: FlipState;
	crop?: CropRect;
	colorAdjustments?: ColorAdjustments;
	effects?: VideoEffect[];
	filterPreset?: string; // active filter preset id, for UI display
	chromakey?: import("./chromakey").ChromakeySettings;
}

export interface ImageElement extends BaseTimelineElement {
	type: "image";
	mediaId: string;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	flip?: FlipState;
	crop?: CropRect;
	colorAdjustments?: ColorAdjustments;
	effects?: VideoEffect[];
	filterPreset?: string; // active filter preset id, for UI display
	chromakey?: import("./chromakey").ChromakeySettings;
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
	hidden?: boolean;
	transform: Transform;
	opacity: number;
}

export interface StickerElement extends BaseTimelineElement {
	type: "sticker";
	iconName: string;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	color?: string;
}

export interface EffectElement extends BaseTimelineElement {
	type: "effect";
	effectType: VideoEffectType;
	enabled: boolean;
	intensity: number; // 0-100
	params: Record<string, number | string>;
}

export type TimelineElement =
	| AudioElement
	| VideoElement
	| ImageElement
	| TextElement
	| StickerElement
	| EffectElement;

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
export type CreateTimelineElement =
	| CreateAudioElement
	| CreateVideoElement
	| CreateImageElement
	| CreateTextElement
	| CreateStickerElement
	| CreateEffectElement;

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
