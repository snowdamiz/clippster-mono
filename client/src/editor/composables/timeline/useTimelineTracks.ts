/**
 * Shared `tracks` + `totalDuration` accessor for the timeline.
 *
 * Centralizes the subscription set so consumers don't accidentally subscribe
 * to playback/media/selection (which would invalidate them on every playback
 * tick or selection click).
 *
 * Each caller still gets its own subscription via `useEditor`, but the
 * subscription mask is locked to `{ timeline, scenes }`. The actual computed
 * evaluations are cheap (just an array reference fetch) — the cost we are
 * eliminating is **invalidating** them on irrelevant events.
 */
import { computed, type ComputedRef } from "vue";
import { useEditor } from "../useEditor";
import type { TimelineTrack } from "../../types/timeline";

export interface TimelineTracksApi {
	tracks: ComputedRef<TimelineTrack[]>;
	totalDuration: ComputedRef<number>;
}

export function useTimelineTracks(): TimelineTracksApi {
	const { editor, version } = useEditor({
		subscribe: {
			playback: false,
			timeline: true,
			scenes: true,
			project: false,
			media: false,
			selection: false,
		},
	});

	const tracks = computed(() => {
		void version.value;
		return editor.timeline.getTracks();
	});

	const totalDuration = computed(() => {
		void version.value;
		return editor.timeline.getTotalDuration();
	});

	return { tracks, totalDuration };
}
