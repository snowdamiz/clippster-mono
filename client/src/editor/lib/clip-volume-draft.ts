import { shallowRef } from "vue";

const draftVolumeByElementId = new Map<string, number>();

/**
 * Lightweight UI-only volume draft channel. Inspector sliders update this while
 * dragging so timeline waveforms can redraw live without committing timeline
 * commands / audio cache invalidations on every pointer move.
 */
export const clipVolumeDraftVersion = shallowRef(0);

export function setClipVolumeDraft(elementId: string, gain: number): void {
	draftVolumeByElementId.set(elementId, gain);
	clipVolumeDraftVersion.value++;
}

export function clearClipVolumeDraft(elementId: string): void {
	if (!draftVolumeByElementId.delete(elementId)) return;
	clipVolumeDraftVersion.value++;
}

export function getClipVolumeDraft(elementId: string): number | undefined {
	return draftVolumeByElementId.get(elementId);
}
