/**
 * Bridge: Creates a new EditorCore project in image mode.
 *
 * Sets up a minimal project with no video tracks — just a single scene
 * with an empty main track, canvas sized to the chosen preset, and
 * playback frozen at time=0. Seeds ImageDocument for pixel-engine architecture.
 */

import { EditorCore } from "../core";
import type { TCanvasSize } from "../types/project";
import {
	attachImageDocumentToSettings,
	createEmptyImageDocument,
} from "../types/image-document";

export interface ImageProjectOptions {
	name?: string;
	canvasSize?: TCanvasSize;
	background?: { type: "color"; color: string };
}

const DEFAULT_IMAGE_CANVAS: TCanvasSize = { width: 1280, height: 720 };

/**
 * Initialize EditorCore in image mode and create a blank image project.
 * Returns the initialized EditorCore instance.
 */
export async function createImageProject(
	options: ImageProjectOptions = {},
): Promise<EditorCore> {
	const {
		name = "Untitled Design",
		canvasSize = DEFAULT_IMAGE_CANVAS,
		background = { type: "color" as const, color: "transparent" },
	} = options;

	EditorCore.reset();
	EditorCore.setNextImageMode(true);

	const editor = EditorCore.getInstance();
	await editor.project.createNewProject({ name });

	const imageDocument = createEmptyImageDocument(canvasSize.width, canvasSize.height);
	editor.project.updateSettings({
		settings: attachImageDocumentToSettings(
			{
				canvasSize,
				background,
				fps: 1,
			},
			imageDocument,
		) as any,
	});

	return editor;
}

/**
 * Load an existing image project by ID.
 * The project must have been previously saved by the editor.
 */
export async function loadImageProject(projectId: string): Promise<EditorCore> {
	EditorCore.reset();
	EditorCore.setNextImageMode(true);

	const editor = EditorCore.getInstance();
	await editor.project.loadProject({ id: projectId });

	const active = editor.project.getActiveOrNull();
	if (active) {
		const settings = active.settings as unknown as Record<string, unknown>;
		const patches: Record<string, unknown> = {};
		if (!settings.imageDocument) {
			const size = active.settings.canvasSize || DEFAULT_IMAGE_CANVAS;
			Object.assign(
				patches,
				attachImageDocumentToSettings(
					{ ...active.settings },
					createEmptyImageDocument(size.width, size.height),
				),
			);
		}
		// Image designs use a Photoshop-style transparent canvas (checkerboard in UI).
		const bg = active.settings.background;
		if (
			!bg ||
			(bg.type === "color" &&
				(bg.color === "#000000" || bg.color === "#000" || bg.color === "black"))
		) {
			patches.background = { type: "color", color: "transparent" };
		}
		if (Object.keys(patches).length > 0) {
			editor.project.updateSettings({ settings: patches as any });
		}
	}

	return editor;
}
