/**
 * Bridge: Creates a new EditorCore project in image mode.
 *
 * Sets up a minimal project with no video tracks — just a single scene
 * with an empty main track, canvas sized to the chosen preset, and
 * playback frozen at time=0.
 */

import { EditorCore } from "../core";
import type { TCanvasSize } from "../types/project";

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
		background = { type: "color" as const, color: "#000000" },
	} = options;

	// Reset any existing editor instance
	EditorCore.reset();

	// Flag the next instance as image mode
	EditorCore.setNextImageMode(true);

	const editor = EditorCore.getInstance();

	// Create a new project via the project manager
	await editor.project.createNewProject({ name });

	// Update settings to match the requested canvas size and background
	editor.project.updateSettings({
		settings: {
			canvasSize,
			background,
			fps: 1, // Static image — fps is irrelevant but must be > 0
		},
	});

	return editor;
}

/**
 * Load an existing image project by ID.
 * The project must have been previously saved by the editor.
 */
export async function loadImageProject(projectId: string): Promise<EditorCore> {
	// Reset any existing editor instance
	EditorCore.reset();

	// Flag the next instance as image mode
	EditorCore.setNextImageMode(true);

	const editor = EditorCore.getInstance();

	await editor.project.loadProject({ id: projectId });

	return editor;
}
