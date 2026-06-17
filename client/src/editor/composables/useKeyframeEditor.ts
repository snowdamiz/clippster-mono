/**
 * State + actions for the keyframe editor panel.
 *
 * Accepts an explicit track/element when embedded in an inspector tab, or falls
 * back to the single selected timeline element when used standalone.
 */
import { computed, onMounted, onUnmounted, ref, shallowRef, type Ref } from "vue";
import { useEditor } from "./useEditor";
import { useElementSelection } from "./timeline/element/useElementSelection";
import { useKeyframes } from "./useKeyframes";
import type { KeyframableProperty, KeyframeInterpolation, Keyframe } from "../types/keyframes";
import { sortedKeyframes, evaluateKeyframeTrack } from "../types/keyframes";
import type { TimelineTrack, TimelineElement } from "../types/timeline";
import {
	getApplicableKeyframeProperties,
	getKeyframePropertyDef,
} from "../lib/keyframe-editor-properties";
import {
	getKeyframePropertyStaticDefault,
	getValueForNewKeyframeAtOffset,
} from "../lib/keyframe-property-defaults";

const ON_KEYFRAME_EPSILON = 0.005;

const FALLBACK_TRACK = {
	id: "__none__", type: "video", name: "", elements: [],
	muted: false, hidden: false, locked: false, isMain: true,
} as TimelineTrack;

const FALLBACK_ELEMENT = {
	id: "__none__", type: "video", name: "", duration: 1, startTime: 0,
	trimStart: 0, trimEnd: 0, mediaId: "",
	transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 }, opacity: 1,
} as TimelineElement;

export function useKeyframeEditor(opts?: {
	trackRef?: Ref<TimelineTrack>;
	elementRef?: Ref<TimelineElement>;
}) {
	const { editor, version } = useEditor();
	const { selectedElements } = useElementSelection();

	const playbackTime = shallowRef(editor.playback.getCurrentTime());
	let unsubscribePlayback: (() => void) | null = null;
	onMounted(() => {
		unsubscribePlayback = editor.playback.subscribe(() => {
			playbackTime.value = editor.playback.getCurrentTime();
		});
	});
	onUnmounted(() => {
		unsubscribePlayback?.();
		unsubscribePlayback = null;
	});

	const selectedKeyframe = ref<{ prop: KeyframableProperty; id: string } | null>(null);

	const selectedData = computed(() => {
		void version.value;
		if (opts?.trackRef && opts?.elementRef) {
			return { track: opts.trackRef.value, element: opts.elementRef.value };
		}
		if (selectedElements.value.length !== 1) return null;
		const sel = selectedElements.value[0];
		let scene;
		try { scene = editor.scenes.getActiveScene(); } catch { return null; }
		if (!scene) return null;
		for (const track of scene.tracks) {
			if (track.id !== sel.trackId) continue;
			const el = track.elements.find((e) => e.id === sel.elementId);
			if (el) return { element: el as TimelineElement, track: track as TimelineTrack };
		}
		return null;
	});

	const trackRef = computed(() => selectedData.value?.track ?? FALLBACK_TRACK);
	const elementRef = computed(() => selectedData.value?.element ?? FALLBACK_ELEMENT);
	const element = computed(() => selectedData.value?.element ?? null);

	const kf = useKeyframes({ trackRef, elementRef });

	const applicableProperties = computed(() =>
		getApplicableKeyframeProperties(element.value?.type),
	);

	const normalizedPlayhead = computed(() => {
		const el = element.value;
		if (!el || el.duration <= 0) return 0;
		return Math.max(0, Math.min(1, (playbackTime.value - el.startTime) / el.duration));
	});

function getPropertyKeyframes(prop: KeyframableProperty): Keyframe[] {
	const track = kf.elementKeyframes.value?.tracks[prop];
	return sortedKeyframes(track?.keyframes ?? []);
}

function hasKeyframes(prop: KeyframableProperty): boolean {
	return kf.hasKeyframes(prop);
}

	function getStaticDefault(prop: KeyframableProperty): number {
		const el = element.value;
		return el ? getKeyframePropertyStaticDefault(el, prop) : 1;
	}

	function getCurrentValue(prop: KeyframableProperty): number {
		const staticDefault = getStaticDefault(prop);
		if (!hasKeyframes(prop)) return staticDefault;
		return kf.getResolvedValue(prop, normalizedPlayhead.value, staticDefault);
	}

	function getDisplayValue(prop: KeyframableProperty): string {
		const def = getKeyframePropertyDef(prop);
		return Math.round(getCurrentValue(prop) * def.displayMultiplier).toString();
	}

	function getKeyframeAtPlayhead(prop: KeyframableProperty): Keyframe | undefined {
		return getPropertyKeyframes(prop).find(
			(k) => Math.abs(k.offset - normalizedPlayhead.value) < ON_KEYFRAME_EPSILON,
		);
	}

	function isOnKeyframe(prop: KeyframableProperty): boolean {
		return getKeyframeAtPlayhead(prop) !== undefined;
	}

	function hasPrevKeyframe(prop: KeyframableProperty): boolean {
		const c = normalizedPlayhead.value;
		return getPropertyKeyframes(prop).some((k) => k.offset < c - ON_KEYFRAME_EPSILON);
	}

	function hasNextKeyframe(prop: KeyframableProperty): boolean {
		const c = normalizedPlayhead.value;
		return getPropertyKeyframes(prop).some((k) => k.offset > c + ON_KEYFRAME_EPSILON);
	}

	function sampleValue(prop: KeyframableProperty, offset: number): number {
		const track = element.value?.keyframes?.tracks[prop];
		if (!track || track.keyframes.length === 0) return getStaticDefault(prop);
		return evaluateKeyframeTrack(track, offset, getStaticDefault(prop));
	}

	function seekToOffset(offset: number) {
		const el = element.value;
		if (!el) return;
		editor.playback.seek({ time: el.startTime + Math.max(0, Math.min(1, offset)) * el.duration });
	}

	function goToPrevKeyframe(prop: KeyframableProperty) {
		const keyframes = getPropertyKeyframes(prop);
		const c = normalizedPlayhead.value;
		for (let i = keyframes.length - 1; i >= 0; i--) {
			if (keyframes[i].offset < c - ON_KEYFRAME_EPSILON) return seekToOffset(keyframes[i].offset);
		}
	}

	function goToNextKeyframe(prop: KeyframableProperty) {
		const c = normalizedPlayhead.value;
		for (const k of getPropertyKeyframes(prop)) {
			if (k.offset > c + ON_KEYFRAME_EPSILON) return seekToOffset(k.offset);
		}
	}

	function toggleKeyframing(prop: KeyframableProperty) {
		if (hasKeyframes(prop)) {
			kf.clearPropertyKeyframes(prop);
			if (selectedKeyframe.value?.prop === prop) selectedKeyframe.value = null;
		} else {
			kf.addKeyframe(prop, normalizedPlayhead.value, getStaticDefault(prop));
		}
	}

	function addOrRemoveKeyframeAtPlayhead(prop: KeyframableProperty) {
		const existing = getKeyframeAtPlayhead(prop);
		if (existing) {
			kf.removeKeyframe(prop, existing.id);
			if (selectedKeyframe.value?.id === existing.id) selectedKeyframe.value = null;
			return;
		}
		const value = getValueForNewKeyframeAtOffset({
			elementKeyframes: element.value?.keyframes,
			property: prop,
			offset: normalizedPlayhead.value,
			staticDefault: getStaticDefault(prop),
		});
		kf.addKeyframe(prop, normalizedPlayhead.value, value);
	}

	function onValueInput(prop: KeyframableProperty, rawDisplayValue: string) {
		const def = getKeyframePropertyDef(prop);
		const parsed = parseInt(rawDisplayValue, 10);
		if (Number.isNaN(parsed)) return;
		const clamped = Math.max(def.min, Math.min(def.max, parsed));
		const stored = clamped / def.displayMultiplier;
		if (hasKeyframes(prop)) kf.upsertKeyframeAtPlayhead(prop, stored);
	}

	function nudgeValue(prop: KeyframableProperty, direction: 1 | -1) {
		if (!hasKeyframes(prop)) return;
		const def = getKeyframePropertyDef(prop);
		const parsed = parseInt(getDisplayValue(prop), 10);
		if (Number.isNaN(parsed)) return;
		const next = Math.max(def.min, Math.min(def.max, parsed + direction * def.step));
		onValueInput(prop, String(next));
	}

	function setInterpolation(prop: KeyframableProperty, id: string, interpolation: KeyframeInterpolation) {
		kf.updateKeyframe(prop, id, { interpolation });
	}

	function deleteKeyframe(prop: KeyframableProperty, id: string) {
		kf.removeKeyframe(prop, id);
		if (selectedKeyframe.value?.id === id) selectedKeyframe.value = null;
	}

	return {
		editor,
		kf,
		selectedData,
		trackRef,
		elementRef,
		element,
		applicableProperties,
		normalizedPlayhead,
		selectedKeyframe,
		getPropertyKeyframes,
		hasKeyframes,
		getStaticDefault,
		getCurrentValue,
		getDisplayValue,
		getKeyframeAtPlayhead,
		isOnKeyframe,
		hasPrevKeyframe,
		hasNextKeyframe,
		sampleValue,
		seekToOffset,
		goToPrevKeyframe,
		goToNextKeyframe,
		toggleKeyframing,
		addOrRemoveKeyframeAtPlayhead,
		onValueInput,
		nudgeValue,
		setInterpolation,
		deleteKeyframe,
	};
}
