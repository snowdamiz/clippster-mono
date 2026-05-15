/**
 * Computes the static (non-drag) geometry of a timeline element.
 *
 * Position-during-drag is *not* handled here — the drag controller writes
 * `--drag-x` / `--drag-y` custom properties directly on the DOM, and a CSS
 * rule applies `transform: translate3d(...)` while `data-drag-active="1"`.
 * That means TimelineElement does NOT re-render every animation frame
 * during a drag; only the few clips actually being moved get DOM writes.
 *
 * Resize-time geometry overrides (left edge / duration shrinking) live in
 * the resize composable and continue to flow through Vue reactivity, since
 * only one element resizes at a time.
 */
import { computed, type Ref } from "vue";
import { TIMELINE_CONSTANTS } from "../../../constants/timeline-constants";
import type { TimelineElement } from "../../../types/timeline";

interface UseElementGeometryProps {
	element: Ref<TimelineElement>;
	zoomLevel: Ref<number>;
	/** Ripple-shift preview from a sibling resize on the same track. */
	rippleShifts?: Ref<Map<string, number> | undefined>;
	/** While true, geometry uses these values instead of `element.startTime` / `element.duration`. */
	resizeOverride?: Ref<{ startTime: number; duration: number } | null>;
}

export function useElementGeometry({
	element,
	zoomLevel,
	rippleShifts,
	resizeOverride,
}: UseElementGeometryProps) {
	const startTime = computed(() => {
		const override = resizeOverride?.value;
		if (override) return override.startTime;
		const shift = rippleShifts?.value?.get(element.value.id);
		if (shift !== undefined) return shift;
		return element.value.startTime;
	});

	const duration = computed(() => {
		const override = resizeOverride?.value;
		if (override) return override.duration;
		return element.value.duration;
	});

	const left = computed(() => startTime.value * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value);
	const width = computed(() => duration.value * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value);

	return { startTime, duration, left, width };
}
