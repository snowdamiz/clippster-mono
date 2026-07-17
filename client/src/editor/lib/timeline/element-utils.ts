import { DEFAULT_TEXT_ELEMENT } from "../../constants/text-constants";
import { DEFAULT_CAPTION_ELEMENT } from "../../constants/caption-constants";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import type {
	CreateTimelineElement,
	CreateVideoElement,
	CreateImageElement,
	CreateStickerElement,
	CreateEffectElement,
	CreateCaptionElement,
	CreateUploadAudioElement,
	CreateLibraryAudioElement,
	TextElement,
	CaptionElement,
	CaptionLine,
	TimelineElement,
	TimelineTrack,
	AudioElement,
	VideoElement,
	ImageElement,
	StickerElement,
	UploadAudioElement,
} from "../../types/timeline";
import type { VideoEffectType } from "../../types/effects";

export function canElementHaveAudio(
	element: TimelineElement,
): element is AudioElement | VideoElement {
	return element.type === "audio" || element.type === "video";
}

export function canElementBeHidden(
	element: TimelineElement,
): element is VideoElement | ImageElement | TextElement | StickerElement {
	return element.type !== "audio";
}

export function hasMediaId(
	element: TimelineElement,
): element is UploadAudioElement | VideoElement | ImageElement {
	return "mediaId" in element;
}

export function requiresMediaId({
	element,
}: {
	element: CreateTimelineElement;
}): boolean {
	return (
		element.type === "video" ||
		element.type === "image" ||
		(element.type === "audio" && element.sourceType === "upload")
	);
}

export function checkElementOverlaps({
	elements,
}: {
	elements: TimelineElement[];
}): boolean {
	const sortedElements = [...elements].sort(
		(a, b) => a.startTime - b.startTime,
	);

	for (let i = 0; i < sortedElements.length - 1; i++) {
		const current = sortedElements[i];
		const next = sortedElements[i + 1];

		const currentEnd = current.startTime + current.duration;

		if (currentEnd > next.startTime) return true;
	}

	return false;
}

export function resolveElementOverlaps({
	elements,
}: {
	elements: TimelineElement[];
}): TimelineElement[] {
	const sortedElements = [...elements].sort(
		(a, b) => a.startTime - b.startTime,
	);
	const resolvedElements: TimelineElement[] = [];

	for (let i = 0; i < sortedElements.length; i++) {
		const current = { ...sortedElements[i] };

		if (resolvedElements.length > 0) {
			const previous = resolvedElements[resolvedElements.length - 1];
			const previousEnd = previous.startTime + previous.duration;

			if (current.startTime < previousEnd) {
				current.startTime = previousEnd;
			}
		}

		resolvedElements.push(current);
	}

	return resolvedElements;
}

export function wouldElementOverlap({
	elements,
	startTime,
	endTime,
	excludeElementId,
}: {
	elements: TimelineElement[];
	startTime: number;
	endTime: number;
	excludeElementId?: string;
}): boolean {
	return elements.some((el) => {
		if (excludeElementId && el.id === excludeElementId) return false;
		const elEnd = el.startTime + el.duration;
		return startTime < elEnd && endTime > el.startTime;
	});
}

/** Snap audio inserts near t=0 to the exact timeline origin when nothing blocks it. */
export function normalizeAudioInsertStartTime({
	startTime,
	duration,
	existingElements,
	fps = 30,
}: {
	startTime: number;
	duration: number;
	existingElements: TimelineElement[];
	fps?: number;
}): number {
	const frameDuration = 1 / fps;
	if (startTime > frameDuration) return startTime;

	const fitsAtOrigin = !wouldElementOverlap({
		elements: existingElements,
		startTime: 0,
		endTime: duration,
	});
	if (!fitsAtOrigin) return startTime;

	return 0;
}

export function buildTextElement({
	raw,
	startTime,
}: {
	raw: Partial<Omit<TextElement, "type" | "id">>;
	startTime: number;
}): CreateTimelineElement {
	const t = raw as Partial<TextElement>;

	return {
		type: "text",
		name: t.name ?? DEFAULT_TEXT_ELEMENT.name,
		content: t.content ?? DEFAULT_TEXT_ELEMENT.content,
		duration: t.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
		startTime,
		trimStart: 0,
		trimEnd: 0,
		fontSize:
			typeof t.fontSize === "number"
				? t.fontSize
				: DEFAULT_TEXT_ELEMENT.fontSize,
		fontFamily: t.fontFamily ?? DEFAULT_TEXT_ELEMENT.fontFamily,
		fontFilePath: t.fontFilePath,
		color: t.color ?? DEFAULT_TEXT_ELEMENT.color,
		backgroundColor: t.backgroundColor ?? DEFAULT_TEXT_ELEMENT.backgroundColor,
		textAlign: t.textAlign ?? DEFAULT_TEXT_ELEMENT.textAlign,
		fontWeight: t.fontWeight ?? DEFAULT_TEXT_ELEMENT.fontWeight,
		fontStyle: t.fontStyle ?? DEFAULT_TEXT_ELEMENT.fontStyle,
		textDecoration: t.textDecoration ?? DEFAULT_TEXT_ELEMENT.textDecoration,
		letterSpacing: t.letterSpacing ?? DEFAULT_TEXT_ELEMENT.letterSpacing,
		lineHeight: t.lineHeight ?? DEFAULT_TEXT_ELEMENT.lineHeight,
		textCase: t.textCase ?? DEFAULT_TEXT_ELEMENT.textCase,
		stroke: t.stroke,
		shadow: t.shadow,
		glow: t.glow,
		gradient: t.gradient,
		bubbleStyle: t.bubbleStyle ?? DEFAULT_TEXT_ELEMENT.bubbleStyle,
		bubbleColor: t.bubbleColor,
		bubblePadding: t.bubblePadding,
		bubbleOpacity: t.bubbleOpacity ?? (
			(t.bubbleStyle && t.bubbleStyle !== "none") ||
			(t.backgroundColor && t.backgroundColor !== "transparent")
				? 1
				: undefined
		),
		textOpacity: t.textOpacity,
		blendMode: t.blendMode,
		fadeIn: t.fadeIn,
		fadeOut: t.fadeOut,
		transform: t.transform ?? DEFAULT_TEXT_ELEMENT.transform,
		opacity: t.opacity ?? DEFAULT_TEXT_ELEMENT.opacity,
	};
}

export function buildStickerElement({
	iconName,
	startTime,
}: {
	iconName: string;
	startTime: number;
}): CreateStickerElement {
	return {
		type: "sticker",
		name: iconName.split(":")[1] || iconName,
		iconName,
		duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
		startTime,
		trimStart: 0,
		trimEnd: 0,
		transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
		opacity: 1,
	};
}

export function buildVideoElement({
	mediaId,
	name,
	duration,
	startTime,
}: {
	mediaId: string;
	name: string;
	duration: number;
	startTime: number;
}): CreateVideoElement {
	return {
		type: "video",
		mediaId,
		name,
		duration,
		startTime,
		trimStart: 0,
		trimEnd: 0,
		muted: false,
		hidden: false,
		transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
		opacity: 1,
		orderIndex: 0,
	};
}

/** Full-canvas overlay B-roll clip (muted, cover-fit). */
export function buildBrollVideoElement({
	mediaId,
	name,
	duration,
	startTime,
	trimStart = 0,
}: {
	mediaId: string;
	name: string;
	duration: number;
	startTime: number;
	trimStart?: number;
}): CreateVideoElement {
	return {
		type: "video",
		mediaId,
		name,
		duration,
		startTime,
		trimStart,
		trimEnd: 0,
		muted: true,
		hidden: false,
		mediaFit: "cover",
		transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
		opacity: 1,
		orderIndex: 0,
	};
}

/** Full-canvas overlay B-roll still (cover-fit). */
export function buildBrollImageElement({
	mediaId,
	name,
	duration,
	startTime,
}: {
	mediaId: string;
	name: string;
	duration: number;
	startTime: number;
}): CreateImageElement {
	return {
		type: "image",
		mediaId,
		name,
		duration,
		startTime,
		trimStart: 0,
		trimEnd: 0,
		hidden: false,
		mediaFit: "cover",
		transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
		opacity: 1,
		orderIndex: 0,
	};
}

export function buildImageElement({
	mediaId,
	name,
	duration,
	startTime,
}: {
	mediaId: string;
	name: string;
	duration: number;
	startTime: number;
}): CreateImageElement {
	return {
		type: "image",
		mediaId,
		name,
		duration,
		startTime,
		trimStart: 0,
		trimEnd: 0,
		hidden: false,
		transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
		opacity: 1,
		orderIndex: 0,
	};
}

export function buildUploadAudioElement({
	mediaId,
	name,
	duration,
	startTime,
	buffer,
}: {
	mediaId: string;
	name: string;
	duration: number;
	startTime: number;
	buffer?: AudioBuffer;
}): CreateUploadAudioElement {
	const element: CreateUploadAudioElement = {
		type: "audio",
		sourceType: "upload",
		mediaId,
		name,
		duration,
		startTime,
		trimStart: 0,
		trimEnd: 0,
		volume: 1,
		muted: false,
	};
	if (buffer) {
		element.buffer = buffer;
	}
	return element;
}

export function buildLibraryAudioElement({
	sourceUrl,
	name,
	duration,
	startTime,
	buffer,
}: {
	sourceUrl: string;
	name: string;
	duration: number;
	startTime: number;
	buffer?: AudioBuffer;
}): CreateLibraryAudioElement {
	const element: CreateLibraryAudioElement = {
		type: "audio",
		sourceType: "library",
		sourceUrl,
		name,
		duration,
		startTime,
		trimStart: 0,
		trimEnd: 0,
		volume: 1,
		muted: false,
	};
	if (buffer) {
		element.buffer = buffer;
	}
	return element;
}

export function buildEffectElement({
	effectType,
	name,
	intensity,
	params,
	startTime,
	duration,
}: {
	effectType: VideoEffectType;
	name: string;
	intensity: number;
	params: Record<string, number | string>;
	startTime: number;
	duration?: number;
}): CreateEffectElement {
	return {
		type: "effect",
		effectType,
		name,
		enabled: true,
		intensity,
		params,
		duration: duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
		startTime,
		trimStart: 0,
		trimEnd: 0,
	};
}

export function buildCaptionElement({
	lines,
	startTime,
	duration,
	raw,
}: {
	lines: CaptionLine[];
	startTime: number;
	duration: number;
	raw?: Partial<Omit<CaptionElement, "type" | "id" | "lines">>;
}): CreateCaptionElement {
	const c = raw as Partial<CaptionElement> | undefined;

	return {
		type: "caption",
		name: c?.name ?? "Caption",
		lines,
		startTime,
		duration,
		trimStart: 0,
		trimEnd: 0,
		presetId: c?.presetId ?? DEFAULT_CAPTION_ELEMENT.presetId,
		highlightStyle: c?.highlightStyle ?? DEFAULT_CAPTION_ELEMENT.highlightStyle,
		highlightColor: c?.highlightColor ?? DEFAULT_CAPTION_ELEMENT.highlightColor,
		fontSize: c?.fontSize ?? DEFAULT_CAPTION_ELEMENT.fontSize,
		fontFamily: c?.fontFamily ?? DEFAULT_CAPTION_ELEMENT.fontFamily,
		fontFilePath: c?.fontFilePath,
		color: c?.color ?? DEFAULT_CAPTION_ELEMENT.color,
		backgroundColor: c?.backgroundColor ?? DEFAULT_CAPTION_ELEMENT.backgroundColor,
		textAlign: c?.textAlign ?? DEFAULT_CAPTION_ELEMENT.textAlign,
		fontWeight: c?.fontWeight ?? DEFAULT_CAPTION_ELEMENT.fontWeight,
		fontStyle: c?.fontStyle ?? DEFAULT_CAPTION_ELEMENT.fontStyle,
		letterSpacing: c?.letterSpacing ?? DEFAULT_CAPTION_ELEMENT.letterSpacing,
		lineHeight: c?.lineHeight ?? DEFAULT_CAPTION_ELEMENT.lineHeight,
		textCase: c?.textCase ?? DEFAULT_CAPTION_ELEMENT.textCase,
		stroke: c?.stroke ?? DEFAULT_CAPTION_ELEMENT.stroke,
		shadow: c?.shadow,
		glow: c?.glow,
		gradient: c?.gradient,
		transform: c?.transform ?? DEFAULT_CAPTION_ELEMENT.transform,
		opacity: c?.opacity ?? DEFAULT_CAPTION_ELEMENT.opacity,
		maxWordsPerLine: c?.maxWordsPerLine ?? DEFAULT_CAPTION_ELEMENT.maxWordsPerLine,
	};
}

export function getElementsAtTime({
	tracks,
	time,
}: {
	tracks: TimelineTrack[];
	time: number;
}): { trackId: string; elementId: string }[] {
	const result: { trackId: string; elementId: string }[] = [];

	for (const track of tracks) {
		for (const element of track.elements) {
			const elementStart = element.startTime;
			const elementEnd = element.startTime + element.duration;

			if (time > elementStart && time < elementEnd) {
				result.push({ trackId: track.id, elementId: element.id });
			}
		}
	}

	return result;
}

export function getExportRangeFromSelectedElements({
	elements,
	getElement,
}: {
	elements: { trackId: string; elementId: string }[];
	getElement: (ref: { trackId: string; elementId: string }) => TimelineElement | null;
}): { timeRange: { startTime: number; endTime: number }; segmentName: string } | null {
	if (elements.length === 0) return null;

	const resolved = elements
		.map((ref) => getElement(ref))
		.filter((el): el is TimelineElement => el !== null);
	if (resolved.length === 0) return null;

	const startTime = Math.min(...resolved.map((el) => el.startTime));
	const endTime = Math.max(...resolved.map((el) => el.startTime + el.duration));
	const segmentName =
		resolved.length === 1
			? resolved[0].name?.trim() || "Selected segment"
			: `${resolved.length} selected segments`;

	return { timeRange: { startTime, endTime }, segmentName };
}
