/**
 * Shared reactive state for timeline toolbar toggles.
 * CapCut-style tools: Main Track Magnet, Auto Snapping, Linkage.
 *
 * - Main Track Magnet: When ON, deleting a segment on the main track
 *   auto-collapses gaps (ripple delete). When OFF, gaps are allowed.
 * - Auto Snapping: When ON, clips snap to edges of other clips, playhead, etc.
 * - Linkage: When ON, moving a video element also moves its linked/extracted audio.
 */
import { ref } from "vue";

const mainTrackMagnet = ref(true);
const autoSnapping = ref(true);
const linkage = ref(true);

/** Read-only access for non-Vue contexts (commands, managers) */
export function getMainTrackMagnet(): boolean {
	return mainTrackMagnet.value;
}

export function getAutoSnapping(): boolean {
	return autoSnapping.value;
}

export function getLinkage(): boolean {
	return linkage.value;
}

export function useTimelineTools() {
	function toggleMainTrackMagnet() {
		mainTrackMagnet.value = !mainTrackMagnet.value;
	}

	function toggleAutoSnapping() {
		autoSnapping.value = !autoSnapping.value;
	}

	function toggleLinkage() {
		linkage.value = !linkage.value;
	}

	return {
		mainTrackMagnet,
		autoSnapping,
		linkage,
		toggleMainTrackMagnet,
		toggleAutoSnapping,
		toggleLinkage,
	};
}
