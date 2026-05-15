import type {
	TimelineTrack,
	TimelineElement,
	VideoElement,
	ImageElement,
	TextElement,
	StickerElement,
	EffectElement,
	CaptionElement,
	AudioElement,
} from "../types/timeline";
import type { MediaAsset } from "../types/assets";
import type { Transition } from "../types/transitions";
import type { TBackground, TCanvasSize } from "../types/project";

/**
 * Per-element payload hashed into `computeSceneInputFingerprint`.
 *
 * **Keep in sync with** [`buildScene`](../renderer/scene-builder.ts): any field passed into
 * `VideoNode`, `ImageNode`, `TextNode`, `StickerNode`, `EffectNode`, `CaptionNode`, or spread
 * into text/caption nodes must appear here — otherwise `getPreviewSceneTreeCached` can reuse a
 * stale `RootNode` while the timeline already holds new values (broken preview during canvas drag,
 * crop, color, etc.).
 */
export function fingerprintTimelineElement(el: TimelineElement): unknown {
	const base = {
		id: el.id,
		type: el.type,
		name: el.name,
		startTime: el.startTime,
		duration: el.duration,
		trimStart: el.trimStart,
		trimEnd: el.trimEnd,
		fadeIn: el.fadeIn,
		fadeOut: el.fadeOut,
		keyframes: el.keyframes,
		animationIn: el.animationIn,
		animationOut: el.animationOut,
		animationLoop: el.animationLoop,
		orderIndex: el.orderIndex,
		linkedElementId: el.linkedElementId,
		hidden: "hidden" in el ? (el as { hidden?: boolean }).hidden : undefined,
	};

	switch (el.type) {
		case "video": {
			const v = el as VideoElement;
			return {
				...base,
				mediaId: v.mediaId,
				muted: v.muted,
				transform: v.transform,
				opacity: v.opacity,
				volume: v.volume,
				speed: v.speed,
				reversed: v.reversed,
				flip: v.flip,
				crop: v.crop,
				colorAdjustments: v.colorAdjustments,
				colorCurves: v.colorCurves,
				colorWheels: v.colorWheels,
				lutPath: v.lutPath,
				blendMode: v.blendMode,
				effects: v.effects,
				filterPreset: v.filterPreset,
				chromakey: v.chromakey,
				pan: v.pan,
				masks: v.masks,
			};
		}
		case "image": {
			const im = el as ImageElement;
			return {
				...base,
				mediaId: im.mediaId,
				transform: im.transform,
				opacity: im.opacity,
				flip: im.flip,
				crop: im.crop,
				colorAdjustments: im.colorAdjustments,
				colorCurves: im.colorCurves,
				colorWheels: im.colorWheels,
				lutPath: im.lutPath,
				blendMode: im.blendMode,
				effects: im.effects,
				filterPreset: im.filterPreset,
				chromakey: im.chromakey,
				pan: im.pan,
				masks: im.masks,
			};
		}
		case "text": {
			const t = el as TextElement;
			return {
				...base,
				content: t.content,
				fontSize: t.fontSize,
				fontFamily: t.fontFamily,
				fontFilePath: t.fontFilePath,
				color: t.color,
				backgroundColor: t.backgroundColor,
				textAlign: t.textAlign,
				fontWeight: t.fontWeight,
				fontStyle: t.fontStyle,
				textDecoration: t.textDecoration,
				letterSpacing: t.letterSpacing,
				lineHeight: t.lineHeight,
				textCase: t.textCase,
				stroke: t.stroke,
				shadow: t.shadow,
				glow: t.glow,
				gradient: t.gradient,
				bubbleStyle: t.bubbleStyle,
				bubbleColor: t.bubbleColor,
				bubblePadding: t.bubblePadding,
				bubbleOpacity: t.bubbleOpacity,
				textOpacity: t.textOpacity,
				transform: t.transform,
				opacity: t.opacity,
				blendMode: t.blendMode,
			};
		}
		case "sticker": {
			const s = el as StickerElement;
			return {
				...base,
				iconName: s.iconName,
				transform: s.transform,
				opacity: s.opacity,
				color: s.color,
				blendMode: s.blendMode,
			};
		}
		case "effect": {
			const e = el as EffectElement;
			return {
				...base,
				effectType: e.effectType,
				enabled: e.enabled,
				intensity: e.intensity,
				params: e.params,
			};
		}
		case "caption": {
			const c = el as CaptionElement;
			return {
				...base,
				lines: c.lines,
				presetId: c.presetId,
				highlightStyle: c.highlightStyle,
				highlightColor: c.highlightColor,
				fontSize: c.fontSize,
				fontFamily: c.fontFamily,
				fontFilePath: c.fontFilePath,
				color: c.color,
				backgroundColor: c.backgroundColor,
				textAlign: c.textAlign,
				fontWeight: c.fontWeight,
				fontStyle: c.fontStyle,
				letterSpacing: c.letterSpacing,
				lineHeight: c.lineHeight,
				textCase: c.textCase,
				stroke: c.stroke,
				shadow: c.shadow,
				glow: c.glow,
				gradient: c.gradient,
				transform: c.transform,
				opacity: c.opacity,
				maxWordsPerLine: c.maxWordsPerLine,
			};
		}
		case "audio": {
			const a = el as AudioElement;
			return {
				...base,
				sourceType: a.sourceType,
				...(a.sourceType === "upload" ? { mediaId: a.mediaId } : { sourceUrl: a.sourceUrl }),
				volume: a.volume,
				muted: a.muted,
				speed: a.speed,
				reversed: a.reversed,
				audioEffects: a.audioEffects,
				pan: a.pan,
			};
		}
		default:
			return base;
	}
}

/**
 * Fast stable string for skipping redundant buildScene when timeline inputs are unchanged.
 * Not cryptographic — only for cache keys.
 */
export function computeSceneInputFingerprint(params: {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	transitions: Transition[];
	canvasSize: TCanvasSize;
	background: TBackground;
	duration: number;
}): string {
	const { tracks, mediaAssets, transitions, canvasSize, background, duration } = params;

	const mediaPart = mediaAssets
		.map((m) => `${m.id}:${m.type}:${m.file?.size ?? 0}:${m.width ?? 0}:${m.height ?? 0}`)
		.sort()
		.join("|");

	const trackPart = JSON.stringify(
		tracks.map((t) => ({
			id: t.id,
			type: t.type,
			hidden: "hidden" in t ? t.hidden : undefined,
			locked: "locked" in t ? t.locked : undefined,
			muted: "muted" in t ? t.muted : undefined,
			isMain: "isMain" in t ? t.isMain : undefined,
			elements: t.elements.map((el) => fingerprintTimelineElement(el)),
		})),
	);

	const trPart = JSON.stringify(
		transitions.map((tr) => ({
			id: tr.id,
			type: tr.type,
			duration: tr.duration,
			targetElementId: tr.targetElementId,
			trackId: tr.trackId,
		})),
	);

	const bgPart = JSON.stringify(background);
	const sizePart = `${canvasSize.width}x${canvasSize.height}`;
	return `${duration.toFixed(4)}|${sizePart}|${bgPart}|${mediaPart}|${trackPart}|${trPart}`;
}
