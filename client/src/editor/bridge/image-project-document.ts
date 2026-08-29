/**
 * Helpers to snapshot / restore Image Editor documents for server + library persistence.
 * Local SQLite (opencut_projects) remains the live store; server project_data mirrors it.
 */

import { EditorCore } from "../core";
import { getProjectDurationFromScenes } from "../lib/scenes";
import {
	deserializeProject,
	serializeProject,
	storageService,
} from "../storage/tauri-storage-adapter";
import type { SerializedProject } from "../storage/types";
import type { TProject } from "../types/project";

/** Resolve the local EditorCore UUID from a backend project_data payload. */
export function resolveLocalProjectId(projectData: unknown): string | null {
	if (!projectData || typeof projectData !== "object") return null;
	const data = projectData as Record<string, unknown>;

	const metadata = data.metadata;
	if (metadata && typeof metadata === "object") {
		const id = (metadata as Record<string, unknown>).id;
		if (typeof id === "string" && id.length > 0) return id;
	}

	// Legacy stub: { id, name }
	if (typeof data.id === "string" && data.id.length > 0) return data.id;

	return null;
}

/** Build a live TProject from the active editor (scenes merged in). */
export function getActiveImageProject(): TProject | null {
	const editor = EditorCore.getInstance();
	const active = editor.project.getActiveOrNull();
	if (!active) return null;

	const scenes = editor.scenes.getScenes();
	return {
		...active,
		scenes,
		metadata: {
			...active.metadata,
			duration: getProjectDurationFromScenes({ scenes }),
			updatedAt: new Date(),
		},
	};
}

/** Serialize the active image project for API / library storage. */
export function getSerializedActiveImageProject(): SerializedProject | null {
	const project = getActiveImageProject();
	if (!project) return null;
	return serializeProject(project);
}

/**
 * Flush local autosave, then return the serialized document for backend sync.
 */
export async function flushAndSerializeActiveImageProject(): Promise<SerializedProject | null> {
	const editor = EditorCore.getInstance();
	await editor.save.flush();
	return getSerializedActiveImageProject();
}

/**
 * Ensure a SerializedProject exists in local SQLite, then load it in image mode.
 * Used when opening a project whose document lives primarily on the server.
 */
export async function hydrateImageProjectFromDocument(
	serialized: SerializedProject,
): Promise<EditorCore> {
	const project = deserializeProject(serialized);
	await storageService.saveProject({ project });

	EditorCore.reset();
	EditorCore.setNextImageMode(true);
	const editor = EditorCore.getInstance();
	await editor.project.loadProject({ id: project.metadata.id });
	return editor;
}

export { serializeProject, deserializeProject };
