import { computed, onMounted, onUnmounted, shallowRef, type Ref } from "vue";
import { useEditor } from "./useEditor";
import { useKeyframes } from "./useKeyframes";
import { getKeyframePropertyStaticDefault } from "../lib/keyframe-property-defaults";
import type { KeyframableProperty } from "../types/keyframes";
import type { TimelineElement, TimelineTrack } from "../types/timeline";

/**
 * Playhead-aware inspector binding for a single keyframable property.
 * When keyframed, displays the resolved value at the playhead and edits keyframes there.
 */
export function useKeyframedInspectorProperty({
	trackRef,
	elementRef,
	property,
}: {
	trackRef: Ref<TimelineTrack>;
	elementRef: Ref<TimelineElement>;
	property: KeyframableProperty;
}) {
	const { editor } = useEditor({ subscribe: false });
	const kf = useKeyframes({ trackRef, elementRef });

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

	const normalizedTime = computed(() => {
		const el = elementRef.value;
		if (el.duration <= 0) return 0;
		return Math.max(0, Math.min(1, (playbackTime.value - el.startTime) / el.duration));
	});

	const isKeyframed = computed(() => kf.hasKeyframes(property));

	const staticDefault = computed(() =>
		getKeyframePropertyStaticDefault(elementRef.value, property),
	);

	const displayValue = computed(() => {
		if (!isKeyframed.value) return staticDefault.value;
		return kf.getResolvedValue(property, normalizedTime.value, staticDefault.value);
	});

	function toggleKeyframe() {
		if (isKeyframed.value) {
			kf.clearPropertyKeyframes(property);
		} else {
			kf.addKeyframe(property, normalizedTime.value, staticDefault.value);
		}
	}

	function setKeyframedValue(value: number) {
		kf.upsertKeyframeAtPlayhead(property, value);
	}

	return {
		isKeyframed,
		displayValue,
		normalizedTime,
		toggleKeyframe,
		setKeyframedValue,
	};
}
