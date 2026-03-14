interface BaseDragData {
	id: string;
	name: string;
}

export interface MediaDragData extends BaseDragData {
	type: "media";
	mediaType: "image" | "video" | "audio";
}

export interface TextDragData extends BaseDragData {
	type: "text";
	content: string;
	/** Full preset element properties for styled text presets */
	presetElement?: Record<string, unknown>;
}

export interface StickerDragData extends BaseDragData {
	type: "sticker";
	iconName: string;
}

export interface EffectDragData extends BaseDragData {
	type: "effect";
	effectType: string;
	intensity: number;
	params: Record<string, number | string>;
}

export interface TransitionDragData extends BaseDragData {
	type: "transition";
	transitionType: string;
	duration: number;
}

export type TimelineDragData = MediaDragData | TextDragData | StickerDragData | EffectDragData | TransitionDragData;
