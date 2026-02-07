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

export type TimelineDragData = MediaDragData | TextDragData | StickerDragData | EffectDragData;
