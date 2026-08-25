import type { MigrationResult, ProjectRecord } from "./types";
import { getProjectId, isRecord } from "./utils";

export function transformProjectV4ToV5({
	project,
}: {
	project: ProjectRecord;
}): MigrationResult<ProjectRecord> {
	const projectId = getProjectId({ project });
	if (!projectId) {
		return { project, skipped: true, reason: "no project id" };
	}

	if (isV5Project({ project })) {
		return { project, skipped: true, reason: "already v5" };
	}

	const scenes = getScenes({ project });
	const migratedScenes = scenes.map(migrateScene);

	const migratedProject = {
		...project,
		scenes: migratedScenes,
		version: 5,
	};

	return { project: migratedProject, skipped: false };
}

function migrateScene(scene: Record<string, unknown>): Record<string, unknown> {
	const tracks = scene.tracks;
	if (!Array.isArray(tracks)) return scene;
	return { ...scene, tracks: tracks.map(migrateTrack) };
}

function migrateTrack(track: unknown): unknown {
	if (!isRecord(track)) return track;
	const elements = track.elements;
	if (!Array.isArray(elements)) return track;
	return { ...track, elements: elements.map(migrateElement) };
}

function migrateElement(element: unknown): unknown {
	if (!isRecord(element)) return element;
	const type = element.type;

	// Add masks field (default empty array) to video and image elements
	if ((type === "video" || type === "image") && !Array.isArray(element.masks)) {
		return { ...element, masks: [] };
	}

	return element;
}

function getScenes({ project }: { project: ProjectRecord }): Record<string, unknown>[] {
	const scenesValue = project.scenes;
	if (!Array.isArray(scenesValue)) return [];
	return scenesValue.filter(isRecord);
}

function isV5Project({ project }: { project: ProjectRecord }): boolean {
	const versionValue = project.version;
	return typeof versionValue === "number" && versionValue >= 5;
}
