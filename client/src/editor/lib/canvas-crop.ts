/**
 * Trim the project canvas to a pixel rect and re-offset layers so content stays put.
 * Unlike UpdateProjectSettingsCommand (which scales), this crops — removing margins.
 */

import { EditorCore } from "../core";
import type { TProject } from "../types/project";
import type { TimelineTrack, Transform } from "../types/timeline";
import {
	IMAGE_DOCUMENT_KEY,
	createEmptyImageDocument,
	type ImageDocument,
} from "../types/image-document";

export interface CanvasCropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

function offsetTransform(transform: Transform, dx: number, dy: number): Transform {
	return {
		...transform,
		position: {
			x: transform.position.x + dx,
			y: transform.position.y + dy,
		},
	};
}

function offsetTracks(tracks: TimelineTrack[], dx: number, dy: number): TimelineTrack[] {
	return tracks.map((track) => {
		if (track.type === "audio" || track.type === "effect") return track;

		const elements = track.elements.map((el) => {
			if (
				el.type === "text" ||
				el.type === "sticker" ||
				el.type === "video" ||
				el.type === "image"
			) {
				return { ...el, transform: offsetTransform(el.transform, dx, dy) };
			}
			return el;
		});

		return { ...track, elements } as TimelineTrack;
	});
}

/**
 * Crop the active project canvas to `rect` (canvas pixel coordinates).
 * Returns true when the canvas size changed.
 */
export function applyCanvasCrop(rect: CanvasCropRect): boolean {
	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	if (!project) return false;

	const oldW = project.settings.canvasSize.width;
	const oldH = project.settings.canvasSize.height;

	const x = Math.max(0, Math.min(oldW - 1, rect.x));
	const y = Math.max(0, Math.min(oldH - 1, rect.y));
	const width = Math.max(1, Math.min(oldW - x, Math.round(rect.width)));
	const height = Math.max(1, Math.min(oldH - y, Math.round(rect.height)));

	if (width === oldW && height === oldH && x === 0 && y === 0) {
		return false;
	}

	// Position is relative to canvas center — keep content visually fixed.
	const dx = oldW / 2 - x - width / 2;
	const dy = oldH / 2 - y - height / 2;

	const nextTracks = offsetTracks(editor.timeline.getTracks(), dx, dy);
	editor.timeline.updateTracks(nextTracks);

	const prevDoc = project.settings.imageDocument as ImageDocument | undefined;
	const nextDoc = prevDoc
		? {
				...createEmptyImageDocument(width, height),
				layers: prevDoc.layers,
				activeTool: prevDoc.activeTool,
				selection: null,
			}
		: createEmptyImageDocument(width, height);

	const updatedProject: TProject = {
		...project,
		settings: {
			...project.settings,
			canvasSize: { width, height },
			[IMAGE_DOCUMENT_KEY]: nextDoc,
		} as TProject["settings"],
		metadata: { ...project.metadata, updatedAt: new Date() },
	};

	editor.project.setActiveProject({ project: updatedProject });
	editor.save.markDirty();
	return true;
}
