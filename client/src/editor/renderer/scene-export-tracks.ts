import type { TimelineElement, TimelineTrack } from "../types/timeline";

function isVisualExportElement(element: TimelineElement): boolean {
	return (
		element.type === "video" ||
		element.type === "image" ||
		element.type === "text" ||
		element.type === "sticker" ||
		element.type === "effect" ||
		element.type === "caption"
	);
}

/** Match preview stacking: drop empty non-audio tracks; keep only visual element types. */
export function getSceneTracksForExport(tracks: TimelineTrack[]): TimelineTrack[] {
	return tracks
		.map((t) => {
			const nextElements = t.elements.filter(isVisualExportElement);
			return { ...t, elements: nextElements } as typeof t;
		})
		.filter((t) => t.elements.length > 0 || t.type !== "audio");
}
