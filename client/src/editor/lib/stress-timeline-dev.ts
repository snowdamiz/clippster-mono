/**
 * Dev-only: append many effect / text / caption layers to stress-test buildScene + preview.
 * Call from DevTools: `window.__clippsterApplyStressTimeline()` after enabling a project.
 */
import type { EditorCore } from "../core";
import type {
	CaptionElement,
	CaptionLine,
	EffectElement,
	TextElement,
	TimelineTrack,
	EffectTrack,
	TextTrack,
	CaptionTrack,
} from "../types/timeline";
import type { VideoEffectType } from "../types/effects";
import { DEFAULT_TEXT_ELEMENT } from "../constants/text-constants";
import { DEFAULT_CAPTION_ELEMENT } from "../constants/caption-constants";

const EFFECT_TYPES: VideoEffectType[] = [
	"blur",
	"vignette",
	"glitch",
	"noise",
	"scanlines",
	"rgbSplit",
	"hueShift",
];

function id(prefix: string, i: number): string {
	return `${prefix}-stress-${i}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Appends stress tracks (40 effects + 35 text + 25 caption elements = 100 items).
 * Does not duplicate video clips (requires real media); focuses on overlay/effect scale.
 */
export function applyStressTimelineLayers(editor: EditorCore): { added: number } {
	const tracks = editor.timeline.getTracks();
	const newTracks: TimelineTrack[] = [...tracks];

	const effectTrack: EffectTrack = {
		id: id("track", 0),
		type: "effect",
		name: "Stress Effects",
		hidden: false,
		elements: [],
	};

	for (let i = 0; i < 40; i++) {
		const start = i * 0.15;
		const fx: EffectElement = {
			id: id("eff", i),
			type: "effect",
			name: `Stress ${i}`,
			duration: 0.12,
			startTime: start,
			trimStart: 0,
			trimEnd: 0,
			effectType: EFFECT_TYPES[i % EFFECT_TYPES.length]!,
			enabled: true,
			intensity: 40 + (i % 60),
			params: { seed: i },
			orderIndex: i,
		};
		effectTrack.elements.push(fx);
	}

	const textTrack: TextTrack = {
		id: id("track", 1),
		type: "text",
		name: "Stress Text",
		hidden: false,
		elements: [],
	};

	for (let i = 0; i < 35; i++) {
		const start = i * 0.12;
		const te: TextElement = {
			...DEFAULT_TEXT_ELEMENT,
			id: id("txt", i),
			name: `T${i}`,
			content: `Stress ${i}`,
			duration: 0.1,
			startTime: start,
			trimStart: 0,
			trimEnd: 0,
			fontSize: 24 + (i % 20),
			transform: {
				scale: 1,
				position: { x: (i % 5) * 40 - 80, y: (i % 7) * 20 - 60 },
				rotate: 0,
			},
			orderIndex: i,
		};
		textTrack.elements.push(te);
	}

	const capTrack: CaptionTrack = {
		id: id("track", 2),
		type: "caption",
		name: "Stress Captions",
		hidden: false,
		elements: [],
	};

	for (let i = 0; i < 25; i++) {
		const lineStart = i * 0.2;
		const lineEnd = lineStart + 0.18;
		const line: CaptionLine = {
			text: `Line ${i}`,
			startTime: lineStart,
			endTime: lineEnd,
			words: [
				{ word: "Stress", start: lineStart, end: lineStart + 0.09 },
				{ word: `${i}`, start: lineStart + 0.09, end: lineEnd },
			],
		};
		const ce: CaptionElement = {
			...DEFAULT_CAPTION_ELEMENT,
			id: id("cap", i),
			type: "caption",
			name: `C${i}`,
			duration: 0.18,
			startTime: lineStart,
			trimStart: 0,
			trimEnd: 0,
			lines: [line],
			highlightStyle: "karaoke",
			transform: {
				scale: 1,
				position: { x: 0, y: 200 },
				rotate: 0,
			},
			orderIndex: i,
		};
		capTrack.elements.push(ce);
	}

	newTracks.push(effectTrack, textTrack, capTrack);
	editor.timeline.updateTracks(newTracks);
	return { added: 100 };
}

export function exposeStressTimelineGlobal(editor: EditorCore): void {
	if (typeof window === "undefined") return;
	(
		window as unknown as {
			__clippsterApplyStressTimeline?: () => { added: number };
		}
	).__clippsterApplyStressTimeline = () => applyStressTimelineLayers(editor);
}
