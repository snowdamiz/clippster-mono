import type { MigrationResult, ProjectRecord } from "./types";
import { getProjectId, isRecord } from "./utils";

export function transformProjectV3ToV4({
	project,
}: {
	project: ProjectRecord;
}): MigrationResult<ProjectRecord> {
	const projectId = getProjectId({ project });
	if (!projectId) {
		return { project, skipped: true, reason: "no project id" };
	}

	if (isV4Project({ project })) {
		return { project, skipped: true, reason: "already v4" };
	}

	const scenes = getScenes({ project });
	const migratedScenes = scenes.map(migrateScene);

	const migratedProject = {
		...project,
		scenes: migratedScenes,
		version: 4,
	};

	return { project: migratedProject, skipped: false };
}

function migrateScene(scene: Record<string, unknown>): Record<string, unknown> {
	const tracks = scene.tracks;
	if (!Array.isArray(tracks)) return scene;

	const migratedTracks = tracks.map(migrateTrack);
	return { ...scene, tracks: migratedTracks };
}

function migrateTrack(track: unknown): unknown {
	if (!isRecord(track)) return track;
	const elements = track.elements;
	if (!Array.isArray(elements)) return track;

	const migratedElements = elements.map(migrateElement);
	return { ...track, elements: migratedElements };
}

function migrateElement(element: unknown): unknown {
	if (!isRecord(element)) return element;
	const type = element.type;

	if (type === "video" || type === "image") {
		const ca = isRecord(element.colorAdjustments)
			? element.colorAdjustments
			: {};

		return {
			...element,
			colorAdjustments: {
				brightness: 0,
				contrast: 0,
				saturation: 0,
				temperature: 0,
				highlights: 0,
				shadows: 0,
				exposure: 0,
				fade: 0,
				tint: "",
				sharpness: 0,
				...ca,
			},
		};
	}

	return element;
}

function getScenes({ project }: { project: ProjectRecord }): Record<string, unknown>[] {
	const scenesValue = project.scenes;
	if (!Array.isArray(scenesValue)) return [];
	return scenesValue.filter(isRecord);
}

function isV4Project({ project }: { project: ProjectRecord }): boolean {
	const versionValue = project.version;
	return typeof versionValue === "number" && versionValue >= 4;
}
