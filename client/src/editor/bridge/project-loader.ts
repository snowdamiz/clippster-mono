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
import { getClip } from "@/services/database/clips";
import { getCreatorProfileByProjectId } from "@/services/database/creator-profiles";
import { resolveBrandingProfile } from "@/composables/useBrandingProfileSelection";
import { useBrandingConfig } from "../composables/useBrandingConfig";

const DEFAULT_TRANSFORM: Transform = {
	scale: 1,
	position: { x: 0, y: 0 },
	rotate: 0,
};

const DEFAULT_PROJECT_SETTINGS: TProjectSettings = {
	fps: 30,
	canvasSize: { width: 1920, height: 1080 },
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

		// Initialize branding config from saved project settings or creator profile
		const loadedProject = editor.project.getActive();
		const branding = useBrandingConfig();
		if (loadedProject?.settings?.brandingConfig) {
			branding.initFromSavedConfig(loadedProject.settings.brandingConfig);
		} else {
			const sources = await getVideoEditorSourcesByProjectId(projectId);
			await resolveAndInitBranding(sources);
		}

		// Backfill sourceProjectId if missing (for projects created before this was added)
		if (!loadedProject?.settings?.sourceProjectId) {
			try {
				const sources = await getVideoEditorSourcesByProjectId(projectId);
				const clipSource = sources.find((s) => s.source_type === "clip" && s.source_id);
				if (clipSource?.source_id) {
					const clip = await getClip(clipSource.source_id);
					if (clip?.project_id) {
						editor.project.setActiveProject({
							project: {
								...loadedProject,
								settings: { ...loadedProject.settings, sourceProjectId: clip.project_id },
							},
						});
						await editor.project.saveCurrentProject();
					}
				}
			} catch {
				// Non-fatal
			}
		}

		// Backfill missing media asset dimensions (for projects saved before dimension probing was added)
		try {
			const assets = editor.media.getAssets();
			const needsBackfill = assets.filter((a) => a.type !== "audio" && (!a.width || !a.height) && a.url);
			if (needsBackfill.length > 0) {
				const updatedAssets = [...assets];
				for (const asset of needsBackfill) {
					const dims = await probeMediaDimensions(asset.url!, asset.type as "video" | "image");
					if (dims) {
						const updated: MediaAsset = { ...asset, width: dims.width, height: dims.height };
						await storageService.saveMediaAsset({ projectId, mediaAsset: updated });
						const idx = updatedAssets.findIndex((a) => a.id === asset.id);
						if (idx !== -1) updatedAssets[idx] = updated;
					}
				}
				editor.media.setAssets({ assets: updatedAssets });
			}
		} catch {
			// Non-fatal — dimensions will fall back to canvas size
		}

		return editor;
	}

	// 3. No existing OpenCut project — convert from Clippster format
	const sources = await getVideoEditorSourcesByProjectId(projectId);

	// Build media assets from sources
	const mediaAssets = await buildMediaAssetsFromSources(sources);

	// Build timeline tracks
	const tracks = await buildTimelineTracks(projectId, sources, mediaAssets);

	// Resolve the original Clippster project ID (for transcript lookup)
	// Chain: video_editor_source (source_type='clip') → clip → clip.project_id
	let sourceProjectId: string | null = null;
	try {
		const clipSource = sources.find((s) => s.source_type === "clip" && s.source_id);
		if (clipSource?.source_id) {
			const clip = await getClip(clipSource.source_id);
			if (clip?.project_id) {
				sourceProjectId = clip.project_id;
			}
		}
	} catch {
		// Non-fatal — transcript just won't load
	}

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
		settings: { ...DEFAULT_PROJECT_SETTINGS, sourceProjectId },
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

	// Resolve creator profile for branding config
	await resolveAndInitBranding(sources);

	return editor;
}

/**
 * Probe video/image dimensions from a file path.
 * Returns { width, height } or null if probing fails.
 * Uses FFmpeg probe via Tauri command to avoid browser network restrictions.
 */
async function probeMediaDimensions(filePath: string, mediaType: "video" | "audio" | "image"): Promise<{ width: number; height: number } | null> {
	if (mediaType === "audio") return null;
	
	if (mediaType === "video") {
		try {
			const result = await invoke<{ is_valid: boolean; width?: number; height?: number }>("validate_video_file", { filePath });
			if (result.is_valid && result.width && result.height) {
				return { width: result.width, height: result.height };
			}
		} catch (err) {
			console.warn(`[project-loader] Failed to probe video dimensions for ${filePath}:`, err);
		}
		return null;
	} else {
		// For images, use browser Image element (images don't trigger LNA since they're loaded via asset protocol elsewhere)
		return new Promise((resolve) => {
			const timeout = setTimeout(() => resolve(null), 5000);
			const img = new Image();
			img.onload = () => {
				clearTimeout(timeout);
				resolve(img.naturalWidth > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
			};
			img.onerror = () => { clearTimeout(timeout); resolve(null); };
			// Convert file path to asset URL for image loading
			img.src = `https://asset.localhost/${encodeURIComponent(filePath)}`;
		});
	}
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

		const dims = await probeMediaDimensions(source.source_path, mediaType);

		assets.push({
			id: source.id,
			name: source.source_name || `Source ${source.order_index}`,
			type: mediaType,
			file,
			url,
			width: dims?.width,
			height: dims?.height,
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
						letterSpacing: 0,
						lineHeight: 1.2,
						textCase: "none" as const,
						bubbleStyle: "none" as const,
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

/**
 * Resolve the creator profile from video editor sources and initialize branding config.
 * Chain: source (source_type='clip') → clip → clip.project_id → getCreatorProfileByProjectId()
 */
async function resolveAndInitBranding(sources: VideoEditorSource[]): Promise<void> {
	const branding = useBrandingConfig();

	try {
		// Find the first clip source to trace back to the original project
		const clipSource = sources.find((s) => s.source_type === "clip" && s.source_id);
		if (!clipSource?.source_id) {
			console.log("[bridge] No clip source found, skipping branding resolution");
			return;
		}

		const clip = await getClip(clipSource.source_id);
		if (!clip?.project_id) {
			console.log("[bridge] Clip has no project_id, skipping branding resolution");
			return;
		}

		const profile = await resolveBrandingProfile(clip.project_id);
		if (!profile) {
			console.log("[bridge] No branding profile found for project:", clip.project_id);
			return;
		}

		console.log("[bridge] Found creator profile for branding:", profile.name);
		branding.initFromCreatorProfile(profile);
	} catch (error) {
		console.warn("[bridge] Failed to resolve creator profile for branding:", error);
	}
}
