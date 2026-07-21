/**
 * Composable for managing keyframes on timeline elements.
 * Provides helpers to add, remove, and update keyframes,
 * and to evaluate keyframed values at a given time.
 */
import { computed, type Ref } from "vue";
import { useEditor } from "./useEditor";
import { generateUUID } from "../utils/id";
import type {
	KeyframableProperty,
	KeyframeInterpolation,
	Keyframe,
	KeyframeTrack,
	ElementKeyframes,
} from "../types/keyframes";
import { getKeyframedValue } from "../types/keyframes";
import type { TimelineElement, TimelineTrack } from "../types/timeline";

export function useKeyframes({
	trackRef,
	elementRef,
}: {
	trackRef: Ref<TimelineTrack>;
	elementRef: Ref<TimelineElement>;
}) {
	const { editor, version } = useEditor({
		subscribe: {
			timeline: true,
			playback: false,
			scenes: false,
			project: false,
			media: false,
			selection: false,
		},
	});

	const elementKeyframes = computed((): ElementKeyframes | undefined => {
		void version.value;
		return elementRef.value.keyframes;
	});

	function getResolvedValue(property: KeyframableProperty, normalizedTime: number, defaultValue: number): number {
		return getKeyframedValue({
			elementKeyframes: elementKeyframes.value,
			property,
			normalizedTime,
			defaultValue,
		});
	}

	function hasKeyframes(property: KeyframableProperty): boolean {
		const kf = elementKeyframes.value;
		if (!kf) return false;
		const track = kf.tracks[property];
		return !!track && track.keyframes.length > 0;
	}

	function addKeyframe(
		property: KeyframableProperty,
		offset: number,
		value: number,
		interpolation: KeyframeInterpolation = "linear",
	) {
		const el = elementRef.value;
		const existing: ElementKeyframes = el.keyframes ?? {
			elementId: el.id,
			tracks: {},
		};

		const track: KeyframeTrack = existing.tracks[property] ?? {
			property,
			keyframes: [],
		};

		const newKeyframe: Keyframe = {
			id: generateUUID(),
			offset: Math.max(0, Math.min(1, offset)),
			value,
			interpolation,
		};

		// Replace if same offset exists, otherwise insert sorted
		const filtered = track.keyframes.filter((k) => Math.abs(k.offset - offset) > 0.001);
		filtered.push(newKeyframe);
		filtered.sort((a, b) => a.offset - b.offset);

		const updatedKeyframes: ElementKeyframes = {
			...existing,
			tracks: {
				...existing.tracks,
				[property]: { ...track, keyframes: filtered },
			},
		};

		editor.timeline.updateElementKeyframes({
			trackId: trackRef.value.id,
			elementId: el.id,
			keyframes: updatedKeyframes,
		});
	}

	function removeKeyframe(property: KeyframableProperty, keyframeId: string) {
		const el = elementRef.value;
		const existing = el.keyframes;
		if (!existing) return;

		const track = existing.tracks[property];
		if (!track) return;

		const filtered = track.keyframes.filter((k) => k.id !== keyframeId);

		const updatedKeyframes: ElementKeyframes = {
			...existing,
			tracks: {
				...existing.tracks,
				[property]: { ...track, keyframes: filtered },
			},
		};

		editor.timeline.updateElementKeyframes({
			trackId: trackRef.value.id,
			elementId: el.id,
			keyframes: updatedKeyframes,
		});
	}

	function updateKeyframe(
		property: KeyframableProperty,
		keyframeId: string,
		updates: Partial<Pick<Keyframe, "offset" | "value" | "interpolation">>,
	) {
		const el = elementRef.value;
		const existing = el.keyframes;
		if (!existing) return;

		const track = existing.tracks[property];
		if (!track) return;

		const updatedKfs = track.keyframes.map((k) => {
			if (k.id !== keyframeId) return k;
			return {
				...k,
				...updates,
				offset: updates.offset !== undefined ? Math.max(0, Math.min(1, updates.offset)) : k.offset,
			};
		});
		updatedKfs.sort((a, b) => a.offset - b.offset);

		const updatedKeyframes: ElementKeyframes = {
			...existing,
			tracks: {
				...existing.tracks,
				[property]: { ...track, keyframes: updatedKfs },
			},
		};

		editor.timeline.updateElementKeyframes({
			trackId: trackRef.value.id,
			elementId: el.id,
			keyframes: updatedKeyframes,
		});
	}

	function clearPropertyKeyframes(property: KeyframableProperty) {
		const el = elementRef.value;
		const existing = el.keyframes;
		if (!existing) return;

		const { [property]: _, ...rest } = existing.tracks;

		const updatedKeyframes: ElementKeyframes = {
			...existing,
			tracks: rest,
		};

		editor.timeline.updateElementKeyframes({
			trackId: trackRef.value.id,
			elementId: el.id,
			keyframes: updatedKeyframes,
		});
	}

	function getNormalizedPlayheadOffset(): number {
		const el = elementRef.value;
		const currentTime = editor.playback.getCurrentTime();
		if (el.duration <= 0) return 0;
		return Math.max(0, Math.min(1, (currentTime - el.startTime) / el.duration));
	}

	function findKeyframeAtOffset(
		property: KeyframableProperty,
		offset: number,
		epsilon = 0.001,
	): Keyframe | undefined {
		const track = elementKeyframes.value?.tracks[property];
		return track?.keyframes.find((k) => Math.abs(k.offset - offset) <= epsilon);
	}

	/** Update existing keyframe at offset or insert a new one. */
	function upsertKeyframeAtPlayhead(
		property: KeyframableProperty,
		value: number,
		interpolation: KeyframeInterpolation = "linear",
	) {
		const offset = getNormalizedPlayheadOffset();
		const existing = findKeyframeAtOffset(property, offset);
		if (existing) {
			updateKeyframe(property, existing.id, { value });
		} else {
			addKeyframe(property, offset, value, interpolation);
		}
	}

	return {
		elementKeyframes,
		getResolvedValue,
		hasKeyframes,
		addKeyframe,
		removeKeyframe,
		updateKeyframe,
		clearPropertyKeyframes,
		getNormalizedPlayheadOffset,
		findKeyframeAtOffset,
		upsertKeyframeAtPlayhead,
	};
}
