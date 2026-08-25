/**
 * Bridge: Loads a Clippster video_editor_project into the OpenCut EditorCore.
 * 
 * Converts Clippster's SQLite-based project structure (video_editor_projects,
 * video_editor_sources, video_editor_edits) into OpenCut's TProject format
 * with media assets and timeline elements.
 */

import { invoke, convertFileSrc } from "@tauri-apps/api/core";
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
import { getRawVideosByProjectId } from "@/services/database/raw-videos";
import { getCreatorProfileByProjectId } from "@/services/database/creator-profiles";
import { useBrandingConfig } from "../composables/useBrandingConfig";
import { TIMELINE_CONSTANTS } from "../constants/timeline-constants";
import { normalizeTrimEndToTail } from "../lib/timeline/trim-source-utils";
import { healOrphanVideoMediaReferences } from "../lib/timeline/heal-orphan-video-media";

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
export async function loadClippsterProject(
	projectId: string,
	{ signal }: { signal?: AbortSignal } = {},
): Promise<EditorCore> {
	signal?.throwIfAborted();
	const editor = EditorCore.getInstance();
	try {
		return await loadClippsterProjectIntoEditor({ editor, projectId, signal });
	} catch (error) {
		if (signal?.aborted) {
			// Project/media hydration cannot currently be interrupted inside every
			// storage call, so release anything that completed after cancellation.
			editor.dispose();
		}
		throw error;
	}
}

async function loadClippsterProjectIntoEditor({
	editor,
	projectId,
	signal,
}: {
	editor: EditorCore;
	projectId: string;
	signal?: AbortSignal;
}): Promise<EditorCore> {
	// 1. Load the Clippster project from SQLite
	const clippsterProject = await getVideoEditorProject(projectId);
	signal?.throwIfAborted();
	if (!clippsterProject) {
		throw new Error(`Project not found: ${projectId}`);
	}

	// 2. Check if we already have an OpenCut project saved for this ID
	const existingProject = await storageService.loadProject({ id: projectId });
	signal?.throwIfAborted();
	if (existingProject) {
		await editor.project.loadProject({ id: projectId });
		signal?.throwIfAborted();

		// Initialize branding config from saved project settings or creator profile
		const loadedProject = editor.project.getActive();
		const branding = useBrandingConfig();
		if (loadedProject?.settings?.brandingConfig) {
			branding.initFromSavedConfig(loadedProject.settings.brandingConfig);
		} else {
			branding.reset();
		}

		// The project shell and media metadata are now usable. Reconciliation,
		// transcript hydration, dimension repair, and orphan healing are
		// non-critical startup work and must not block first editor paint.
		void (async () => {
		try {
			const sources = await getVideoEditorSourcesByProjectId(projectId);
			signal?.throwIfAborted();
			const tracks = editor.timeline.getTracks();
			const assets = editor.media.getAssets();
			const resolvedFromTimeline = await resolveSourceProjectFromTimeline({
				tracks,
				assets,
			});
			let resolved = resolvedFromTimeline ?? await resolveSourceProject(sources);

			// If sources are empty/unhelpful, try resolving from media asset file paths
			if (!resolved) {
				resolved = await resolveSourceProjectFromAssets(assets);
			}

			const refreshedAssets = await refreshDerivedClipAssets({
				projectId,
				tracks,
				assets,
				preferredClipId: resolved?.sourceClipId ?? null,
			});
			signal?.throwIfAborted();
			if (refreshedAssets) {
				editor.media.setAssets({ assets: refreshedAssets });
			}

			if (resolved && loadedProject) {
				const currentSettings = loadedProject.settings ?? DEFAULT_PROJECT_SETTINGS;
				const shouldUpdateSourceSettings =
					currentSettings.sourceProjectId !== resolved.sourceProjectId ||
					currentSettings.sourceClipId !== resolved.sourceClipId ||
					currentSettings.sourceClipStartTime !== resolved.sourceClipStartTime ||
					currentSettings.sourceClipEndTime !== resolved.sourceClipEndTime;

				if (shouldUpdateSourceSettings) {
					console.log("[bridge] Reconciling transcript source settings", {
						projectId,
						current: {
							sourceProjectId: currentSettings.sourceProjectId ?? null,
							sourceClipId: currentSettings.sourceClipId ?? null,
							sourceClipStartTime: currentSettings.sourceClipStartTime ?? null,
							sourceClipEndTime: currentSettings.sourceClipEndTime ?? null,
						},
						resolved,
						resolutionSource: resolvedFromTimeline ? "timeline" : "fallback",
					});
					editor.project.setActiveProject({
						project: {
							...loadedProject,
							settings: {
								...currentSettings,
								sourceProjectId: resolved.sourceProjectId,
								sourceClipId: resolved.sourceClipId,
								sourceClipStartTime: resolved.sourceClipStartTime,
								sourceClipEndTime: resolved.sourceClipEndTime,
							},
						},
					});
					await editor.project.saveCurrentProject();
				}
			}
		} catch (error) {
			console.warn("[bridge] Failed to reconcile transcript source settings:", error);
		}

		// Load transcript data from source project if available
		const finalProject = editor.project.getActive();
		if (finalProject?.settings?.sourceProjectId) {
			await loadTranscriptData(finalProject.settings.sourceProjectId, {
				sourceClipId: finalProject.settings.sourceClipId ?? null,
				sourceClipStartTime: finalProject.settings.sourceClipStartTime ?? null,
				sourceClipEndTime: finalProject.settings.sourceClipEndTime ?? null,
			}, signal);
			signal?.throwIfAborted();
		}

		// Backfill missing media asset dimensions (for projects saved before dimension probing was added)
		try {
			const assets = editor.media.getAssets();
			const needsBackfill = assets.filter((a) => a.type !== "audio" && (!a.width || !a.height) && a.url);
			if (needsBackfill.length > 0) {
				const updatedAssets = [...assets];
				for (const asset of needsBackfill) {
					signal?.throwIfAborted();
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

		// Re-run after bridge asset refresh: loadProject may have healed, but setAssets / dimensions
		// can leave timeline pointing at unusable video rows; persist so a second /editor load
		// does not resurrect stale mediaIds from SQLite.
		if (healOrphanVideoMediaReferences({ editor, projectId })) {
			await editor.project.saveCurrentProject();
		}
		})().catch((error) => {
			if (!signal?.aborted) {
				console.warn("[bridge] Deferred project repair failed:", error);
			}
		});

		signal?.throwIfAborted();
		return editor;
	}

	// 3. No existing OpenCut project — convert from Clippster format
	const sources = await getVideoEditorSourcesByProjectId(projectId);
	signal?.throwIfAborted();

	// Build media assets from sources
	const mediaAssets = await buildMediaAssetsFromSources(sources);
	signal?.throwIfAborted();

	// Build timeline tracks
	const tracks = await buildTimelineTracks(projectId, sources, mediaAssets);
	signal?.throwIfAborted();

	// Resolve the original Clippster project ID and clip timing (for transcript lookup)
	let sourceProjectId: string | null = null;
	let sourceClipId: string | null = null;
	let sourceClipStartTime: number | null = null;
	let sourceClipEndTime: number | null = null;
	try {
		const resolved = await resolveSourceProject(sources);
		signal?.throwIfAborted();
		if (resolved) {
			sourceProjectId = resolved.sourceProjectId;
			sourceClipId = resolved.sourceClipId;
			sourceClipStartTime = resolved.sourceClipStartTime;
			sourceClipEndTime = resolved.sourceClipEndTime;
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
		settings: { ...DEFAULT_PROJECT_SETTINGS, sourceProjectId, sourceClipId, sourceClipStartTime, sourceClipEndTime },
		version: 1,
		timelineViewState: {
			zoomLevel: TIMELINE_CONSTANTS.ZOOM_MIN,
			scrollLeft: 0,
			playheadTime: 0,
		},
	};

	// Save to OpenCut storage and load into editor
	await storageService.saveProject({ project });
	signal?.throwIfAborted();

	for (const asset of mediaAssets) {
		await storageService.saveMediaAsset({ projectId, mediaAsset: asset });
		signal?.throwIfAborted();
	}

	await editor.project.loadProject({ id: projectId });
	signal?.throwIfAborted();
	useBrandingConfig().reset();

	// Load transcript data from source project if available
	if (sourceProjectId) {
		void loadTranscriptData(sourceProjectId, {
			sourceClipId,
			sourceClipStartTime,
			sourceClipEndTime,
		}, signal).catch((error) => {
			if (!signal?.aborted) {
				console.warn("[bridge] Deferred transcript load failed:", error);
			}
		});
	}

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

	for (const source of sources) {
		if (!source.source_path) continue;

		const mediaType = inferMediaType(source.source_path);
		const url = convertFileSrc(source.source_path);

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
			filePath: source.source_path,
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

		const trimStart = source.trim_start || 0;
		const trimEnd = normalizeTrimEndToTail({
			trimStart,
			duration,
			trimEnd: source.trim_end,
			speed: source.speed,
		});

		videoElements.push({
			id: generateUUID(),
			type: "video",
			name: source.source_name || "Video",
			startTime: currentTime,
			duration,
			trimStart,
			trimEnd,
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
 * Resolve the source Clippster project from video editor sources.
 * Tries multiple strategies:
 * 1. source_type='clip' → clips table → clip.project_id
 * 2. source_type='raw_video' → raw_videos table → raw_video.project_id
 * 3. Any source with source_id → try as clip, then as raw_video
 * 4. Extract clip ID from source file path (clip_XXXX.mp4 pattern)
 */
async function resolveSourceProject(
	sources: import("@/services/database/video-editor-projects").VideoEditorSource[],
): Promise<{
	sourceProjectId: string;
	sourceClipId: string | null;
	sourceClipStartTime: number | null;
	sourceClipEndTime: number | null;
} | null> {
	// Strategy A: explicit clip source
	const clipSource = sources.find((s) => s.source_type === "clip" && s.source_id);
	if (clipSource?.source_id) {
		const clip = await getClip(clipSource.source_id);
		if (clip?.project_id) {
			return {
				sourceProjectId: clip.project_id,
				sourceClipId: clip.id,
				sourceClipStartTime: clip.start_time ?? null,
				sourceClipEndTime: clip.end_time ?? null,
			};
		}
	}

	const { getRawVideo, getRawVideosByProjectId } = await import("@/services/database/raw-videos");

	// Strategy B: explicit raw_video source
	const rawVideoSource = sources.find((s) => s.source_type === "raw_video" && s.source_id);
	if (rawVideoSource?.source_id) {
		const rawVideo = await getRawVideo(rawVideoSource.source_id);
		if (rawVideo?.project_id) {
			return { sourceProjectId: rawVideo.project_id, sourceClipId: null, sourceClipStartTime: null, sourceClipEndTime: null };
		}
	}

	// Strategy C: any source with a source_id — try as clip first, then raw_video
	for (const source of sources) {
		if (!source.source_id) continue;
		try {
			const clip = await getClip(source.source_id);
			if (clip?.project_id) {
				return {
					sourceProjectId: clip.project_id,
					sourceClipId: clip.id,
					sourceClipStartTime: clip.start_time ?? null,
					sourceClipEndTime: clip.end_time ?? null,
				};
			}
		} catch { /* not a clip */ }
		try {
			const rawVideo = await getRawVideo(source.source_id);
			if (rawVideo?.project_id) {
				return { sourceProjectId: rawVideo.project_id, sourceClipId: null, sourceClipStartTime: null, sourceClipEndTime: null };
			}
		} catch { /* not a raw_video */ }
	}

	// Strategy D: extract clip ID from source_path pattern (clip_UUID.mp4)
	for (const source of sources) {
		if (!source.source_path) continue;
		const match = source.source_path.match(/clip_([0-9a-f-]{36})\./i);
		if (match) {
			const extractedClipId = match[1];
			try {
				const clip = await getClip(extractedClipId);
				if (clip?.project_id) {
					console.log("[bridge] Resolved source project from file path clip ID:", extractedClipId);
					return {
						sourceProjectId: clip.project_id,
						sourceClipId: clip.id,
						sourceClipStartTime: clip.start_time ?? null,
						sourceClipEndTime: clip.end_time ?? null,
					};
				}
			} catch { /* not found */ }
		}
	}

	console.log("[bridge] Could not resolve source project from any source");
	return null;
}

/**
 * Resolve the source project from media asset file paths.
 * Looks for clip_UUID.mp4 patterns in asset paths/URLs.
 */
async function resolveSourceProjectFromAssets(
	assets: MediaAsset[],
): Promise<{
	sourceProjectId: string;
	sourceClipId: string | null;
	sourceClipStartTime: number | null;
	sourceClipEndTime: number | null;
} | null> {
	for (const asset of assets) {
		const pathToCheck = asset.filePath || asset.url || "";
		const match = pathToCheck.match(/clip_([0-9a-f-]{36})\./i);
		if (match) {
			const clipId = match[1];
			try {
				const clip = await getClip(clipId);
				if (clip?.project_id) {
					console.log("[bridge] Resolved source project from media asset path, clip:", clipId);
					return {
						sourceProjectId: clip.project_id,
						sourceClipId: clip.id,
						sourceClipStartTime: clip.start_time ?? null,
						sourceClipEndTime: clip.end_time ?? null,
					};
				}
			} catch { /* not found */ }
		}
	}
	return null;
}

async function resolveSourceProjectFromTimeline({
	tracks,
	assets,
}: {
	tracks: TimelineTrack[];
	assets: MediaAsset[];
}): Promise<{
	sourceProjectId: string;
	sourceClipId: string | null;
	sourceClipStartTime: number | null;
	sourceClipEndTime: number | null;
} | null> {
	const mediaById = new Map<string, MediaAsset>(
		assets.map((asset) => [asset.id, asset]),
	);
	const clipUsage = new Map<
		string,
		{ totalDuration: number; assetPaths: Set<string> }
	>();

	for (const track of tracks) {
		if (track.type !== "video") continue;

		for (const element of track.elements) {
			if (element.type !== "video") continue;

			const asset = mediaById.get(element.mediaId);
			const pathToCheck = asset?.filePath || asset?.url || "";
			const match = pathToCheck.match(/clip_([0-9a-f-]{36})\./i);
			if (!match) continue;

			const clipId = match[1];
			const existing = clipUsage.get(clipId) ?? {
				totalDuration: 0,
				assetPaths: new Set<string>(),
			};
			existing.totalDuration += element.duration ?? 0;
			if (pathToCheck) {
				existing.assetPaths.add(pathToCheck);
			}
			clipUsage.set(clipId, existing);
		}
	}

	if (clipUsage.size === 0) {
		return null;
	}

	const sortedCandidates = [...clipUsage.entries()].sort(
		(a, b) => b[1].totalDuration - a[1].totalDuration,
	);

	if (sortedCandidates.length > 1) {
		console.log("[bridge] Multiple clip-derived assets found on timeline; using primary candidate", {
			candidates: sortedCandidates.map(([clipId, data]) => ({
				clipId,
				totalDuration: data.totalDuration,
				assetPaths: [...data.assetPaths],
			})),
		});
	}

	const [clipId, usage] = sortedCandidates[0];
	const clip = await getClip(clipId);
	if (!clip?.project_id) {
		return null;
	}

	console.log("[bridge] Resolved source project from timeline clip asset", {
		clipId,
		totalDuration: usage.totalDuration,
		assetPaths: [...usage.assetPaths],
		clipStartTime: clip.start_time ?? null,
		clipEndTime: clip.end_time ?? null,
	});

	return {
		sourceProjectId: clip.project_id,
		sourceClipId: clip.id,
		sourceClipStartTime: clip.start_time ?? null,
		sourceClipEndTime: clip.end_time ?? null,
	};
}

async function refreshDerivedClipAssets({
	projectId,
	tracks,
	assets,
	preferredClipId,
}: {
	projectId: string;
	tracks: TimelineTrack[];
	assets: MediaAsset[];
	preferredClipId?: string | null;
}): Promise<MediaAsset[] | null> {
	const mediaById = new Map<string, MediaAsset>(
		assets.map((asset) => [asset.id, asset]),
	);
	const refreshedAssetIds = new Set<string>();
	let updatedAssets: MediaAsset[] | null = null;

	for (const track of tracks) {
		if (track.type !== "video") continue;

		for (const element of track.elements) {
			if (element.type !== "video") continue;

			const asset = mediaById.get(element.mediaId);
			const filePath = asset?.filePath;
			if (!asset || !filePath || refreshedAssetIds.has(asset.id)) continue;

			const match = filePath.match(/clip_([0-9a-f-]{36})\./i);
			if (!match) continue;

			const clipId = match[1];
			if (preferredClipId && clipId !== preferredClipId) continue;

			const clip = await getClip(clipId);
			if (!clip?.project_id || clip.built_file_path === filePath) continue;
			if (clip.start_time == null || clip.end_time == null) continue;

			const rawVideos = await getRawVideosByProjectId(clip.project_id);
			const rawVideo = rawVideos[0];
			if (!rawVideo?.file_path) continue;

			const expectedDuration = Math.max(0, clip.end_time - clip.start_time);
			let actualDuration: number | null = null;

			try {
				const metadata = await invoke<{ duration: number }>("get_video_metadata", {
					videoPath: filePath,
				});
				actualDuration = metadata.duration;
			} catch (error) {
				console.warn("[bridge] Failed to probe extracted clip asset duration", {
					projectId,
					clipId,
					filePath,
					error,
				});
			}

			const needsRefresh =
				actualDuration == null ||
				Math.abs(actualDuration - expectedDuration) > 0.05;

			console.log("[bridge] Checking derived clip asset timing", {
				projectId,
				clipId,
				filePath,
				expectedDuration,
				actualDuration,
				needsRefresh,
			});

			if (!needsRefresh) {
				refreshedAssetIds.add(asset.id);
				continue;
			}

			await invoke("extract_clip", {
				sourcePath: rawVideo.file_path,
				outputPath: filePath,
				startTime: clip.start_time,
				endTime: clip.end_time,
			});

			console.log("[bridge] Refreshed derived clip asset from source clip", {
				projectId,
				clipId,
				filePath,
				startTime: clip.start_time,
				endTime: clip.end_time,
				expectedDuration,
			});

			const refreshedAsset = await storageService.loadMediaAsset({
				projectId,
				id: asset.id,
			});
			if (refreshedAsset) {
				if (!updatedAssets) {
					updatedAssets = [...assets];
				}

				const assetIndex = updatedAssets.findIndex((candidate) => candidate.id === asset.id);
				if (assetIndex !== -1) {
					const previousAsset = updatedAssets[assetIndex];
					if (previousAsset.url) {
						URL.revokeObjectURL(previousAsset.url);
					}
					if (previousAsset.thumbnailUrl?.startsWith("blob:")) {
						URL.revokeObjectURL(previousAsset.thumbnailUrl);
					}
					updatedAssets[assetIndex] = refreshedAsset;
				}
			}

			refreshedAssetIds.add(asset.id);
		}
	}

	return updatedAssets;
}

/**
 * Filter words to a clip's segments and rebase timing.
 * For multi-segment clips, each segment's words are placed sequentially
 * in the output, matching how extract_clip concatenates segments.
 *
 * Falls back to simple start/end range if no segments provided.
 */
function filterAndRebaseWords(
	words: Array<{ word: string; start: number; end: number; confidence?: number }>,
	clipStart: number | null | undefined,
	clipEnd: number | null | undefined,
	segments?: Array<{ start_time: number; end_time: number }>,
): Array<{ word: string; start: number; end: number; confidence?: number }> {
	if (clipStart == null || clipEnd == null) return words;

	// Use segments if available for accurate multi-segment mapping
	if (segments && segments.length > 0) {
		const result: Array<{ word: string; start: number; end: number; confidence?: number }> = [];
		let outputOffset = 0;
		for (const seg of segments) {
			const segWords = words
				.filter((w) => w.start >= seg.start_time && w.start < seg.end_time)
				.map((w) => ({
					...w,
					start: w.start - seg.start_time + outputOffset,
					end: w.end - seg.start_time + outputOffset,
				}));
			result.push(...segWords);
			outputOffset += seg.end_time - seg.start_time;
		}
		console.log("[bridge] filterAndRebase (segments): segments=", segments.map((s) => `${s.start_time.toFixed(1)}-${s.end_time.toFixed(1)}`), "matched=", result.length);
		return result;
	}

	const filtered = words
		.filter((w) => w.start >= clipStart && w.start < clipEnd)
		.map((w) => ({ ...w, start: w.start - clipStart, end: w.end - clipStart }));
	console.log("[bridge] filterAndRebase: clipStart=", clipStart, "clipEnd=", clipEnd, "matched=", filtered.length,
		words.length > 0 ? `wordTimeRange=[${words[0].start.toFixed(1)}..${words[words.length - 1].end.toFixed(1)}]` : "");
	return filtered;
}

/**
 * Load transcript data from the source project and set it in the transcript manager.
 * For clip-based projects, filters the VOD transcript to only include the clip's
 * time range and rebases word timings to start at 0.
 *
 * Tries three strategies in order:
 * 1. Clip segment transcript_raw_json (available for previously built clips)
 * 2. Stitched VOD transcript from the transcripts table
 * 3. Raw chunked transcript chunks (fallback when stitching failed)
 */
async function loadTranscriptData(
	sourceProjectId: string,
	clipTiming?: {
		sourceClipId?: string | null;
		sourceClipStartTime?: number | null;
		sourceClipEndTime?: number | null;
	},
	signal?: AbortSignal,
): Promise<void> {
	try {
		const { parseTranscriptToWords } = await import("@/utils/timelineUtils");
		signal?.throwIfAborted();
		const editor = EditorCore.getInstance();
		console.log("[bridge] loadTranscriptData request", {
			sourceProjectId,
			sourceClipId: clipTiming?.sourceClipId ?? null,
			sourceClipStartTime: clipTiming?.sourceClipStartTime ?? null,
			sourceClipEndTime: clipTiming?.sourceClipEndTime ?? null,
		});

		// Strategy 1: Try clip segments' transcript_raw_json (available for previously built clips)
		if (clipTiming?.sourceClipId) {
			try {
				const { getClipSegmentsByClipId } = await import("@/services/database/clip-segments");
				const segments = await getClipSegmentsByClipId(clipTiming.sourceClipId);
				const segmentWords: Array<{ word: string; start: number; end: number; confidence?: number }> = [];

				for (const seg of segments) {
					if (!seg.transcript_raw_json) continue;
					const parsed = parseTranscriptToWords(seg.transcript_raw_json);
					for (const w of parsed) {
						const wa = w as any;
						segmentWords.push({
							word: wa.word || wa.text || String(wa),
							start: wa.start || wa.begin || 0,
							end: wa.end || wa.finish || 0,
							confidence: wa.confidence,
						});
					}
				}

				if (segmentWords.length > 0) {
					segmentWords.sort((a, b) => a.start - b.start);
					signal?.throwIfAborted();
					editor.transcript.setWords(segmentWords);
					console.log("[bridge] Loaded transcript with", segmentWords.length, "words from clip segments", {
						firstWord: segmentWords[0]?.word,
						lastWord: segmentWords[segmentWords.length - 1]?.word,
					});
					return;
				}
				console.log("[bridge] Strategy 1: no transcript_raw_json in clip segments, trying next");
			} catch (e) {
				console.log("[bridge] Strategy 1 failed:", e);
			}
		}

		// Strategy 2: Load stitched VOD transcript and filter/rebase to clip time range
		const { getTranscriptWithSegmentsByProjectId } = await import("@/services/database/transcripts");
		const { transcript } = await getTranscriptWithSegmentsByProjectId(sourceProjectId);

		if (transcript && transcript.raw_json) {
			const words = parseTranscriptToWords(transcript.raw_json);

			if (words.length > 0) {
				let transcriptWords: Array<{ word: string; start: number; end: number; confidence?: number }> = words.map((w: any) => ({
					word: w.word || w.text || String(w),
					start: w.start || w.begin || 0,
					end: w.end || w.finish || 0,
					confidence: w.confidence,
				}));

				// Load clip segments for accurate multi-segment filtering
				let clipSegments: Array<{ start_time: number; end_time: number }> | undefined;
				if (clipTiming?.sourceClipId) {
					try {
						const { getClipSegmentsByClipId } = await import("@/services/database/clip-segments");
						const segs = await getClipSegmentsByClipId(clipTiming.sourceClipId);
						if (segs.length > 0) {
							clipSegments = segs.map((s) => ({ start_time: s.start_time, end_time: s.end_time }));
						}
					} catch { /* use fallback range */ }
				}

				transcriptWords = filterAndRebaseWords(transcriptWords, clipTiming?.sourceClipStartTime, clipTiming?.sourceClipEndTime, clipSegments);

				if (transcriptWords.length > 0) {
					signal?.throwIfAborted();
					editor.transcript.setWords(transcriptWords);
					console.log("[bridge] Loaded transcript with", transcriptWords.length, "words from stitched VOD transcript", {
						firstWord: transcriptWords[0]?.word,
						lastWord: transcriptWords[transcriptWords.length - 1]?.word,
					});
					return;
				}
				console.log("[bridge] Strategy 2: stitched transcript had words but none in clip range");
			} else {
				console.log("[bridge] Strategy 2: stitched transcript exists but parseTranscriptToWords returned 0 words");
			}
		} else {
			console.log("[bridge] Strategy 2: no stitched transcript found for project", sourceProjectId);
		}

		// Strategy 3: Fall back to chunked transcript chunks (when stitching failed or never ran)
		try {
			const { getRawVideosByProjectId } = await import("@/services/database/raw-videos");
			const { getChunkedTranscriptByRawVideoId, getTranscriptChunks } = await import("@/services/database/chunked-transcripts");

			const rawVideos = await getRawVideosByProjectId(sourceProjectId);
			if (rawVideos.length === 0) {
				console.log("[bridge] Strategy 3: no raw videos for project", sourceProjectId);
				return;
			}

			const chunkedTranscript = await getChunkedTranscriptByRawVideoId(rawVideos[0].id);
			if (!chunkedTranscript) {
				console.log("[bridge] Strategy 3: no chunked transcript for raw video", rawVideos[0].id);
				return;
			}

			const chunks = await getTranscriptChunks(chunkedTranscript.id);
			if (chunks.length === 0) {
				console.log("[bridge] Strategy 3: chunked transcript has 0 chunks");
				return;
			}

			// Stitch words from chunks with time offsets (mirrors processWithCachedChunks logic)
			const allWords: Array<{ word: string; start: number; end: number; confidence?: number }> = [];
			for (const chunk of chunks) {
				try {
					const chunkData = JSON.parse(chunk.raw_json);
					// Parse words from segments within each chunk
					if (chunkData.segments && Array.isArray(chunkData.segments)) {
						for (const seg of chunkData.segments) {
							if (seg.words && Array.isArray(seg.words)) {
								for (const w of seg.words) {
									const wordText = w.word || w.text;
									const start = w.start ?? w.startTime;
									const end = w.end ?? w.endTime;
									if (wordText && typeof start === "number" && typeof end === "number") {
										allWords.push({
											word: wordText,
											start: start + chunk.start_time,
											end: end + chunk.start_time,
											confidence: w.confidence ?? w.prob,
										});
									}
								}
							}
						}
					}
					// Also check top-level words array
					if (chunkData.words && Array.isArray(chunkData.words)) {
						for (const w of chunkData.words) {
							const wordText = w.word || w.text;
							const start = w.start ?? w.startTime;
							const end = w.end ?? w.endTime;
							if (wordText && typeof start === "number" && typeof end === "number") {
								allWords.push({
									word: wordText,
									start: start + chunk.start_time,
									end: end + chunk.start_time,
									confidence: w.confidence ?? w.prob,
								});
							}
						}
					}
				} catch {
					// Skip unparseable chunks
				}
			}

			if (allWords.length > 0) {
				allWords.sort((a, b) => a.start - b.start);
				// Deduplicate
				const unique = allWords.filter((w, i, arr) =>
					i === 0 || !(Math.abs(w.start - arr[i - 1].start) < 0.01 && w.word === arr[i - 1].word)
				);

				const finalWords = filterAndRebaseWords(unique, clipTiming?.sourceClipStartTime, clipTiming?.sourceClipEndTime);

				if (finalWords.length > 0) {
					signal?.throwIfAborted();
					editor.transcript.setWords(finalWords);
					console.log("[bridge] Loaded transcript with", finalWords.length, "words from chunked transcript chunks", {
						firstWord: finalWords[0]?.word,
						lastWord: finalWords[finalWords.length - 1]?.word,
					});
					return;
				}
				console.log("[bridge] Strategy 3: chunked transcript had words but none in clip range");
			} else {
				console.log("[bridge] Strategy 3: no word-level data in chunked transcript chunks");
			}
		} catch (e) {
			console.log("[bridge] Strategy 3 failed:", e);
		}
	} catch (error) {
		console.warn("[bridge] Failed to load transcript data:", error);
		// Non-fatal — user can generate transcript manually
	}
}
