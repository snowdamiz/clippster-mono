import type {
	CaptionPresetId,
	CaptionHighlightStyle,
	CaptionElement,
} from "../types/timeline";

export interface CaptionPreset {
	id: CaptionPresetId;
	name: string;
	description: string;
	highlightStyle: CaptionHighlightStyle;
	highlightColor: string;
	color: string;
	backgroundColor: string;
	fontSize: number;
	fontFamily: string;
	fontWeight: CaptionElement["fontWeight"];
	fontStyle: CaptionElement["fontStyle"];
	letterSpacing: number;
	lineHeight: number;
	stroke?: CaptionElement["stroke"];
	shadow?: CaptionElement["shadow"];
	glow?: CaptionElement["glow"];
	gradient?: CaptionElement["gradient"];
	maxWordsPerLine: number;
}

export const CAPTION_PRESETS: CaptionPreset[] = [
	{
		id: "default",
		name: "Default",
		description: "Clean white text with shadow",
		highlightStyle: "none",
		highlightColor: "#FACC15",
		color: "#FFFFFF",
		backgroundColor: "transparent",
		fontSize: 42,
		fontFamily: "Montserrat",
		fontWeight: "bold",
		fontStyle: "normal",
		letterSpacing: 0,
		lineHeight: 1.3,
		shadow: { color: "rgba(0,0,0,0.8)", offsetX: 2, offsetY: 2, blur: 4 },
		maxWordsPerLine: 4,
	},
	{
		id: "karaoke",
		name: "Karaoke",
		description: "Word-by-word color highlight",
		highlightStyle: "karaoke",
		highlightColor: "#FACC15",
		color: "#FFFFFF",
		backgroundColor: "transparent",
		fontSize: 48,
		fontFamily: "Montserrat",
		fontWeight: "bold",
		fontStyle: "normal",
		letterSpacing: 0,
		lineHeight: 1.3,
		stroke: { color: "#000000", width: 3 },
		maxWordsPerLine: 4,
	},
	{
		id: "karaoke-pop",
		name: "Karaoke Pop",
		description: "Word-by-word highlight with scale pop",
		highlightStyle: "karaoke-scale",
		highlightColor: "#F97316",
		color: "#FFFFFF",
		backgroundColor: "transparent",
		fontSize: 48,
		fontFamily: "Montserrat",
		fontWeight: "900",
		fontStyle: "normal",
		letterSpacing: 1,
		lineHeight: 1.4,
		stroke: { color: "#000000", width: 4 },
		maxWordsPerLine: 3,
	},
	{
		id: "bold-outline",
		name: "Bold Outline",
		description: "Thick outlined text",
		highlightStyle: "karaoke",
		highlightColor: "#EF4444",
		color: "#FFFFFF",
		backgroundColor: "transparent",
		fontSize: 52,
		fontFamily: "Montserrat",
		fontWeight: "900",
		fontStyle: "normal",
		letterSpacing: 0,
		lineHeight: 1.3,
		stroke: { color: "#000000", width: 5 },
		maxWordsPerLine: 3,
	},
	{
		id: "neon-glow",
		name: "Neon Glow",
		description: "Glowing neon text",
		highlightStyle: "glow",
		highlightColor: "#22D3EE",
		color: "#FFFFFF",
		backgroundColor: "transparent",
		fontSize: 44,
		fontFamily: "Montserrat",
		fontWeight: "bold",
		fontStyle: "normal",
		letterSpacing: 1,
		lineHeight: 1.3,
		glow: { color: "#22D3EE", intensity: 15 },
		maxWordsPerLine: 4,
	},
	{
		id: "boxed",
		name: "Boxed",
		description: "Words in colored boxes",
		highlightStyle: "background",
		highlightColor: "#EF4444",
		color: "#FFFFFF",
		backgroundColor: "rgba(0,0,0,0.6)",
		fontSize: 40,
		fontFamily: "Montserrat",
		fontWeight: "bold",
		fontStyle: "normal",
		letterSpacing: 0,
		lineHeight: 1.5,
		maxWordsPerLine: 4,
	},
	{
		id: "typewriter",
		name: "Typewriter",
		description: "Monospace with underline highlight",
		highlightStyle: "underline",
		highlightColor: "#FACC15",
		color: "#FFFFFF",
		backgroundColor: "transparent",
		fontSize: 36,
		fontFamily: "Roboto Condensed",
		fontWeight: "normal",
		fontStyle: "normal",
		letterSpacing: 2,
		lineHeight: 1.4,
		shadow: { color: "rgba(0,0,0,0.9)", offsetX: 1, offsetY: 1, blur: 3 },
		maxWordsPerLine: 5,
	},
	{
		id: "minimal",
		name: "Minimal",
		description: "Simple clean subtitles",
		highlightStyle: "none",
		highlightColor: "#FFFFFF",
		color: "#FFFFFF",
		backgroundColor: "rgba(0,0,0,0.5)",
		fontSize: 32,
		fontFamily: "Inter",
		fontWeight: "normal",
		fontStyle: "normal",
		letterSpacing: 0,
		lineHeight: 1.3,
		maxWordsPerLine: 6,
	},
	{
		id: "gradient-pop",
		name: "Gradient Pop",
		description: "Gradient text with pop highlight",
		highlightStyle: "karaoke-scale",
		highlightColor: "#EC4899",
		color: "#FFFFFF",
		backgroundColor: "transparent",
		fontSize: 48,
		fontFamily: "Montserrat",
		fontWeight: "900",
		fontStyle: "normal",
		letterSpacing: 0,
		lineHeight: 1.3,
		gradient: { enabled: true, colors: ["#F97316", "#EC4899"], angle: 135 },
		stroke: { color: "#000000", width: 3 },
		maxWordsPerLine: 3,
	},
];

export const DEFAULT_CAPTION_ELEMENT: Omit<CaptionElement, "id" | "lines" | "startTime" | "duration" | "trimStart" | "trimEnd" | "name" | "type"> = {
	presetId: "karaoke",
	highlightStyle: "karaoke",
	highlightColor: "#FACC15",
	fontSize: 48,
	fontFamily: "Montserrat",
	color: "#FFFFFF",
	backgroundColor: "transparent",
	textAlign: "center",
	fontWeight: "bold",
	fontStyle: "normal",
	letterSpacing: 0,
	lineHeight: 1.3,
	textCase: "none",
	stroke: { color: "#000000", width: 3 },
	transform: { scale: 1, position: { x: 0, y: 200 }, rotate: 0 },
	opacity: 1,
	maxWordsPerLine: 4,
};

export function getPresetById(id: CaptionPresetId): CaptionPreset {
	return CAPTION_PRESETS.find((p) => p.id === id) ?? CAPTION_PRESETS[0];
}
