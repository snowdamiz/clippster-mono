/**
 * Dev-only deterministic timelines for stress-testing buildScene + preview.
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

export type StressTimelineScenario = "dense" | "stacked" | "long";

type ScenarioConfig = {
	effects: number;
	texts: number;
	captions: number;
	startTime: (index: number, kind: "effect" | "text" | "caption") => number;
	duration: (kind: "effect" | "text" | "caption") => number;
};

const SCENARIOS: Record<StressTimelineScenario, ScenarioConfig> = {
	dense: {
		effects: 40,
		texts: 35,
		captions: 25,
		startTime: (index, kind) => index * (kind === "caption" ? 0.2 : kind === "effect" ? 0.15 : 0.12),
		duration: (kind) => (kind === "caption" ? 0.18 : kind === "effect" ? 0.12 : 0.1),
	},
	stacked: {
		effects: 24,
		texts: 24,
		captions: 12,
		startTime: () => 5,
		duration: () => 10,
	},
	long: {
		effects: 40,
		texts: 40,
		captions: 40,
		startTime: (index, kind) => index * 90 + (kind === "effect" ? 0 : kind === "text" ? 20 : 40),
		duration: () => 8,
	},
};

function id(scenario: StressTimelineScenario, run: number, prefix: string, index: number): string {
	return `${prefix}-stress-${scenario}-${run}-${index}`;
}

function createCaptionLine(index: number, startTime: number, duration: number): CaptionLine {
	const endTime = startTime + duration;
	const midpoint = startTime + duration / 2;
	return {
		text: `Line ${index}`,
		startTime,
		endTime,
		words: [
			{ word: "Stress", start: startTime, end: midpoint },
			{ word: `${index}`, start: midpoint, end: endTime },
		],
	};
}

/**
 * Creates scenario tracks without media dependencies. IDs and contents are stable for
 * a given scenario/run, making benchmark comparisons and tests reproducible.
 */
export function createStressTimelineTracks(
	scenario: StressTimelineScenario = "dense",
	run = 0,
): TimelineTrack[] {
	const config = SCENARIOS[scenario];

	const effectTrack: EffectTrack = {
		id: id(scenario, run, "track-effect", 0),
		type: "effect",
		name: `Stress Effects (${scenario})`,
		hidden: false,
		elements: [],
	};

	for (let i = 0; i < config.effects; i++) {
		const start = config.startTime(i, "effect");
		const fx: EffectElement = {
			id: id(scenario, run, "effect", i),
			type: "effect",
			name: `Stress ${i}`,
			duration: config.duration("effect"),
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
		id: id(scenario, run, "track-text", 0),
		type: "text",
		name: `Stress Text (${scenario})`,
		hidden: false,
		elements: [],
	};

	for (let i = 0; i < config.texts; i++) {
		const start = config.startTime(i, "text");
		const te: TextElement = {
			...DEFAULT_TEXT_ELEMENT,
			id: id(scenario, run, "text", i),
			name: `T${i}`,
			content: `Stress ${i}`,
			duration: config.duration("text"),
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
		id: id(scenario, run, "track-caption", 0),
		type: "caption",
		name: `Stress Captions (${scenario})`,
		hidden: false,
		elements: [],
	};

	for (let i = 0; i < config.captions; i++) {
		const lineStart = config.startTime(i, "caption");
		const duration = config.duration("caption");
		const ce: CaptionElement = {
			...DEFAULT_CAPTION_ELEMENT,
			id: id(scenario, run, "caption", i),
			type: "caption",
			name: `C${i}`,
			duration,
			startTime: lineStart,
			trimStart: 0,
			trimEnd: 0,
			lines: [createCaptionLine(i, lineStart, duration)],
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

	return [effectTrack, textTrack, capTrack];
}

export function applyStressTimelineScenario(
	editor: EditorCore,
	scenario: StressTimelineScenario,
): { added: number } {
	const tracks = editor.timeline.getTracks();
	const run = tracks.filter((track) => track.id.startsWith(`track-effect-stress-${scenario}-`)).length;
	const stressTracks = createStressTimelineTracks(scenario, run);
	editor.timeline.updateTracks([...tracks, ...stressTracks]);
	return {
		added: stressTracks.reduce((total, track) => total + track.elements.length, 0),
	};
}

/**
 * Backwards-compatible default: appends the original 100-item dense scenario.
 */
export function applyStressTimelineLayers(editor: EditorCore): { added: number } {
	return applyStressTimelineScenario(editor, "dense");
}

export function exposeStressTimelineGlobal(editor: EditorCore): void {
	if (typeof window === "undefined") return;
	(
		window as unknown as {
			__clippsterApplyStressTimeline?: (scenario?: StressTimelineScenario) => { added: number };
		}
	).__clippsterApplyStressTimeline = (scenario = "dense") => applyStressTimelineScenario(editor, scenario);
}
