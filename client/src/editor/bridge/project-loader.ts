/**
 * Bridge: Loads a Clippster video_editor_project into the OpenCut EditorCore.
 * 
 * Converts Clippster's SQLite-based project structure (video_editor_projects,
 * video_editor_sources, video_editor_edits) into OpenCut's TProject format
 * with media assets and timeline elements.
 */

import { invoke } from "@tauri-apps/api/core";
import { EditorCore } from "../core";
import { storageService } from "../storage/service";
import type { TProject, TProjectSettings } from "../types/project";
import type { MediaAsset } from "../types/assets";
import type {
	TimelineTrack,
	VideoElement,
	TextElement,
	UploadAudioElement,
	VideoTrack,
	AudioTrack,
	TextTrack,
	Transform,
} from "../types/timeline";
import { generateUUID } from "../utils/id";
import {
	getVideoEditorProject,
	getVideoEditorSourcesByProjectId,
	type VideoEditorSource,
} from "@/services/database/video-editor-projects";
import {
	getFullVideoEditorEdit,
} from "@/services/database/video-editor-edits";
import type {
	VideoEditorTextOverlayRecord,
	VideoEditorAudioTrackRecord,
} from "@/services/database/video-editor-edits";

const DEFAULT_TRANSFORM: Transform = {
	scale: 1,
	position: { x: 0, y: 0 },
	rotate: 0,
};

const DEFAULT_PROJECT_SETTINGS: TProjectSettings = {
	fps: 30,
	canvasSize: { width: 1080, height: 1920 },
	background: { type: "color", color: "#000000" },
};

/**
 * Load a Clippster project into the OpenCut editor.
 * Returns the initialized EditorCore instance.
 */
export async function loadClippsterProject(projectId: string): Promise<EditorCore> {
	const editor = EditorCore.getInstance();

	// 1. Load the Clippster project from SQLite
	const clippsterProject = await getVideoEditorProject(projectId);
	if (!clippsterProject) {
		throw new Error(`Project not found: ${projectId}`);
	}

	// 2. Check if we already have an OpenCut project saved for this ID
	const existingProject = await storageService.loadProject({ id: projectId });
	if (existingProject) {
		await editor.project.loadProject({ id: projectId });
		return editor;
	}

	// 3. No existing OpenCut project — convert from Clippster format
	const sources = await getVideoEditorSourcesByProjectId(projectId);

	// Build media assets from sources
	const mediaAssets = await buildMediaAssetsFromSources(sources);

	// Build timeline tracks
	const tracks = await buildTimelineTracks(projectId, sources, mediaAssets);

	// Create the OpenCut project
	const now = new Date();
	const sceneId = generateUUID();
	const project: TProject = {
		metadata: {
			id: projectId,
			name: clippsterProject.name,
			thumbnail: clippsterProject.thumbnail_path ?? undefined,
			duration: clippsterProject.total_duration || 0,
			createdAt: new Date(clippsterProject.created_at * 1000),
			updatedAt: now,
		},
		scenes: [
			{
				id: sceneId,
				name: "Main",
				isMain: true,
				tracks,
				bookmarks: [],
				createdAt: now,
				updatedAt: now,
			},
		],
		currentSceneId: sceneId,
		settings: DEFAULT_PROJECT_SETTINGS,
		version: 1,
		timelineViewState: {
			zoomLevel: 1,
			scrollLeft: 0,
			playheadTime: 0,
		},
	};

	// Save to OpenCut storage and load into editor
	await storageService.saveProject({ project });

	for (const asset of mediaAssets) {
		await storageService.saveMediaAsset({ projectId, mediaAsset: asset });
	}

	await editor.project.loadProject({ id: projectId });

	return editor;
}

/**
 * Build MediaAsset objects from Clippster video_editor_sources.
 */
async function buildMediaAssetsFromSources(
	sources: VideoEditorSource[],
): Promise<MediaAsset[]> {
	const assets: MediaAsset[] = [];
	let videoServerPort: number;

	try {
		videoServerPort = await invoke<number>("get_video_server_port");
	} catch {
		videoServerPort = 8642;
	}

	for (const source of sources) {
		if (!source.source_path) continue;

		const mediaType = inferMediaType(source.source_path);
		const encodedPath = btoa(source.source_path);
		const url = `http://localhost:${videoServerPort}/video/${encodedPath}`;

		const file = new File([], source.source_name || "source", {
			type: mediaType === "video" ? "video/mp4" : mediaType === "audio" ? "audio/mpeg" : "image/jpeg",
		});

		assets.push({
			id: source.id,
			name: source.source_name || `Source ${source.order_index}`,
			type: mediaType,
			file,
			url,
			width: undefined,
			height: undefined,
			duration: source.source_duration ?? undefined,
			fps: undefined,
			thumbnailUrl: source.source_thumbnail ?? undefined,
			ephemeral: false,
		});
	}

	return assets;
}

/**
 * Build timeline tracks from Clippster sources and edits.
 */
async function buildTimelineTracks(
	projectId: string,
	sources: VideoEditorSource[],
	mediaAssets: MediaAsset[],
): Promise<TimelineTrack[]> {
	const tracks: TimelineTrack[] = [];

	// Main video track from sources
	const videoElements: VideoElement[] = [];
	let currentTime = 0;

	const sortedSources = [...sources].sort((a, b) => a.order_index - b.order_index);

	for (const source of sortedSources) {
		const asset = mediaAssets.find((a) => a.id === source.id);
		if (!asset) continue;

		const duration = source.end_time - source.start_time;
		if (duration <= 0) continue;

		videoElements.push({
			id: generateUUID(),
			type: "video",
			name: source.source_name || "Video",
			startTime: currentTime,
			duration,
			trimStart: source.trim_start || 0,
			trimEnd: source.trim_end ?? 0,
			mediaId: source.id,
			muted: false,
			hidden: false,
			transform: DEFAULT_TRANSFORM,
			opacity: 1,
		});

		currentTime += duration;
	}

	if (videoElements.length > 0) {
		const mainTrack: VideoTrack = {
			id: generateUUID(),
			name: "Main Video",
			type: "video",
			elements: videoElements,
			hidden: false,
			muted: false,
			isMain: true,
		};
		tracks.push(mainTrack);
	}

	// Load edits (text overlays, audio tracks) from the full edit record
	try {
		const fullEdit = await getFullVideoEditorEdit(projectId);
		if (fullEdit) {
			// Text overlays → text track
			if (fullEdit.textOverlays.length > 0) {
				const textElements: TextElement[] = fullEdit.textOverlays.map(
					(overlay: VideoEditorTextOverlayRecord) => ({
						id: generateUUID(),
						type: "text" as const,
						name: overlay.text?.substring(0, 20) || "Text",
						startTime: overlay.start_time || 0,
						duration: (overlay.end_time || 5) - (overlay.start_time || 0),
						trimStart: 0,
						trimEnd: 0,
						content: overlay.text || "",
						fontSize: 48,
						fontFamily: "Inter",
						color: "#ffffff",
						backgroundColor: "transparent",
						textAlign: "center" as const,
						fontWeight: "normal" as const,
						fontStyle: "normal" as const,
						textDecoration: "none" as const,
						hidden: false,
						transform: DEFAULT_TRANSFORM,
						opacity: 1,
					}),
				);

				const textTrack: TextTrack = {
					id: generateUUID(),
					name: "Text",
					type: "text",
					elements: textElements,
					hidden: false,
				};
				tracks.push(textTrack);
			}

			// Audio tracks
			if (fullEdit.audioTracks.length > 0) {
				const audioElements: UploadAudioElement[] = fullEdit.audioTracks.map(
					(at: VideoEditorAudioTrackRecord) => ({
						id: generateUUID(),
						type: "audio" as const,
						sourceType: "upload" as const,
						name: at.name || "Audio",
						startTime: at.start_time || 0,
						duration: (at.end_time || 5) - (at.start_time || 0),
						trimStart: 0,
						trimEnd: 0,
						mediaId: at.id,
						muted: at.is_muted === 1,
						volume: at.volume ?? 1,
					}),
				);

				const audioTrack: AudioTrack = {
					id: generateUUID(),
					name: "Audio",
					type: "audio",
					elements: audioElements,
					muted: false,
				};
				tracks.push(audioTrack);
			}
		}
	} catch (error) {
		console.warn("[bridge] Failed to load edits:", error);
	}

	return tracks;
}

/**
 * Infer media type from file path extension.
 */
function inferMediaType(filePath: string): "video" | "audio" | "image" {
	const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
	if (["mp4", "webm", "mov", "avi", "mkv", "m4v", "ts"].includes(ext)) return "video";
	if (["mp3", "wav", "ogg", "aac", "m4a", "flac"].includes(ext)) return "audio";
	if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
	return "video";
}
