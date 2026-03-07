import type { TTimelineViewState } from "../types/project";
import type { TrackType } from "../types/timeline";

export const TRACK_COLORS: Record<TrackType, { background: string; border: string }> = {
	video: {
		background: "bg-[#2a2a2e]",
		border: "#3f3f46",
	},
	text: {
		background: "bg-[#5DBAA0]/60",
		border: "#7CCDB8",
	},
	audio: {
		background: "bg-[#915DBE]/60",
		border: "#A87BD4",
	},
	sticker: {
		background: "bg-amber-500",
		border: "#F59E0B",
	},
	effect: {
		background: "bg-[#E040FB]",
		border: "#E040FB",
	},
	caption: {
		background: "bg-[#38BDF8]",
		border: "#38BDF8",
	},
} as const;

export const TRACK_HEIGHTS: Record<TrackType, number> = {
	video: 80,
	text: 25,
	audio: 25,
	sticker: 50,
	effect: 30,
	caption: 30,
} as const;

export const TRACK_GAP = 4;

export const TIMELINE_CONSTANTS = {
	PIXELS_PER_SECOND: 50,
	DEFAULT_ELEMENT_DURATION: 5,
	PADDING_TOP_PX: 0,
	ZOOM_MIN: 0.1,
	ZOOM_MAX: 100,
	ZOOM_BUTTON_FACTOR: 1.7,
	ZOOM_ANCHOR_PLAYHEAD_THRESHOLD: 0.15,
} as const;

export const DEFAULT_TIMELINE_VIEW_STATE: TTimelineViewState = {
	zoomLevel: 0.2,
	scrollLeft: 0,
	playheadTime: 0,
};

export const TRACK_ICON_NAMES: Record<TrackType, string> = {
	video: "video",
	text: "text",
	audio: "music",
	sticker: "smile",
	effect: "wand-2",
	caption: "captions",
} as const;
