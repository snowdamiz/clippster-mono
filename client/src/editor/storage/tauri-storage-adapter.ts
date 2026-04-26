/**
 * Tauri SQLite Storage Adapter for OpenCut Editor
 * Replaces IndexedDB/OPFS with Tauri's SQLite plugin.
 * 
 * Key differences from OpenCut's browser storage:
 * - Projects stored as JSON blobs in SQLite (not IndexedDB)
 * - Media files live on disk, referenced by path (not stored in OPFS as File blobs)
 * - File objects are created on-the-fly from filesystem paths via fetch()
 */

import type { TProject, TProjectMetadata } from "../types/project";
import type { MediaAsset } from "../types/assets";
import type { MediaAssetData, SerializedProject, SerializedScene } from "./types";
import type { SavedSoundsData, SavedSound, SoundEffect } from "../types/sounds";
import type { TimelineTrack, TScene } from "../types/timeline";
import { getProjectDurationFromScenes } from "../lib/scenes";
import { getDatabase, getCurrentUserId } from "@/services/database/core";
import { base64ToUtf8, utf8ToBase64Url } from "@/utils/encoding";
import {
	editorMediaDestinationFilename,
	playbackFileLabel,
} from "@/utils/fsNames";

// ==========================================
// Serialization Helpers
// ==========================================

function serializeProject(project: TProject): SerializedProject {
	const duration =
		project.metadata.duration ??
		getProjectDurationFromScenes({ scenes: project.scenes });

	const serializedScenes: SerializedScene[] = project.scenes.map((scene) => ({
		id: scene.id,
		name: scene.name,
		isMain: scene.isMain,
		tracks: stripAudioBuffers({ tracks: scene.tracks }),
		transitions: scene.transitions ?? [],
		bookmarks: scene.bookmarks,
		createdAt: scene.createdAt.toISOString(),
		updatedAt: scene.updatedAt.toISOString(),
	}));

	return {
		metadata: {
			id: project.metadata.id,
			name: project.metadata.name,
			thumbnail: project.metadata.thumbnail,
			duration,
			createdAt: project.metadata.createdAt.toISOString(),
			updatedAt: project.metadata.updatedAt.toISOString(),
		},
		scenes: serializedScenes,
		currentSceneId: project.currentSceneId,
		settings: project.settings,
		version: project.version,
		timelineViewState: project.timelineViewState,
	};
}

function deserializeProject(serialized: SerializedProject): TProject {
	const scenes = (serialized.scenes ?? []).map((scene) => ({
		id: scene.id,
		name: scene.name,
		isMain: scene.isMain,
		tracks: (scene.tracks ?? []).map((track) =>
			track.type === "video"
				? { ...track, isMain: track.isMain ?? false }
				: track,
		),
		transitions: scene.transitions ?? [],
		bookmarks: scene.bookmarks ?? [],
		createdAt: new Date(scene.createdAt),
		updatedAt: new Date(scene.updatedAt),
	}));

	return {
		metadata: {
			id: serialized.metadata.id,
			name: serialized.metadata.name,
			thumbnail: serialized.metadata.thumbnail,
			duration:
				serialized.metadata.duration ??
				getProjectDurationFromScenes({ scenes }),
			createdAt: new Date(serialized.metadata.createdAt),
			updatedAt: new Date(serialized.metadata.updatedAt),
		},
		scenes,
		currentSceneId: serialized.currentSceneId || "",
		settings: serialized.settings,
		version: serialized.version,
		timelineViewState: serialized.timelineViewState,
	};
}

function stripAudioBuffers({ tracks }: { tracks: TimelineTrack[] }): TimelineTrack[] {
	return tracks.map((track) => {
		if (track.type !== "audio") return track;
		return {
			...track,
			elements: track.elements.map((element) => {
				const { buffer: _buffer, ...rest } = element;
				return rest;
			}),
		};
	});
}

// ==========================================
// SQLite row types
// ==========================================

interface ProjectRow {
	id: string;
	project_data: string;
	user_id: number | null;
	created_at: number;
	updated_at: number;
}

interface MediaAssetRow {
	id: string;
	project_id: string;
	name: string;
	type: string;
	file_path: string;
	file_size: number;
	last_modified: number;
	width: number | null;
	height: number | null;
	duration: number | null;
	fps: number | null;
	thumbnail_url: string | null;
	ephemeral: number;
	created_at: number;
}

interface SavedSoundRow {
	id: number;
	name: string;
	username: string;
	preview_url: string | null;
	download_url: string | null;
	duration: number;
	tags: string | null;
	license: string | null;
	saved_at: string;
	user_id: number | null;
}

// ==========================================
// TauriStorageService
// ==========================================

class TauriStorageService {
	// ------------------------------------------
	// Project Operations
	// ------------------------------------------

	async saveProject({ project }: { project: TProject }): Promise<void> {
		const db = await getDatabase();
		const serialized = serializeProject(project);
		const projectData = JSON.stringify(serialized);
		const userId = getCurrentUserId();
		const now = Math.floor(Date.now() / 1000);

		// Upsert: insert or replace
		await db.execute(
			`INSERT INTO opencut_projects (id, project_data, user_id, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
			   project_data = excluded.project_data,
			   updated_at = excluded.updated_at`,
			[project.metadata.id, projectData, userId, now, now],
		);
	}

	async loadProject({ id }: { id: string }): Promise<{ project: TProject } | null> {
		const db = await getDatabase();
		const rows = await db.select<ProjectRow[]>(
			"SELECT * FROM opencut_projects WHERE id = ?",
			[id],
		);

		if (rows.length === 0) return null;

		try {
			const serialized: SerializedProject = JSON.parse(rows[0].project_data);
			return { project: deserializeProject(serialized) };
		} catch (error) {
			console.error("[TauriStorage] Failed to parse project data:", error);
			return null;
		}
	}

	async loadAllProjectsMetadata(): Promise<TProjectMetadata[]> {
		const db = await getDatabase();
		const userId = getCurrentUserId();

		let rows: ProjectRow[];
		if (userId === null) {
			rows = await db.select<ProjectRow[]>(
				"SELECT * FROM opencut_projects WHERE user_id IS NULL ORDER BY updated_at DESC",
			);
		} else {
			rows = await db.select<ProjectRow[]>(
				"SELECT * FROM opencut_projects WHERE user_id = ? OR user_id IS NULL ORDER BY updated_at DESC",
				[userId],
			);
		}

		const metadata: TProjectMetadata[] = [];
		for (const row of rows) {
			try {
				const serialized: SerializedProject = JSON.parse(row.project_data);
				metadata.push({
					id: serialized.metadata.id,
					name: serialized.metadata.name,
					thumbnail: serialized.metadata.thumbnail,
					duration:
						serialized.metadata.duration ??
						getProjectDurationFromScenes({
							scenes: (serialized.scenes ?? []) as unknown as TScene[],
						}),
					createdAt: new Date(serialized.metadata.createdAt),
					updatedAt: new Date(serialized.metadata.updatedAt),
				});
			} catch (error) {
				console.error("[TauriStorage] Failed to parse project:", row.id, error);
			}
		}

		return metadata.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
	}

	async deleteProject({ id }: { id: string }): Promise<void> {
		const db = await getDatabase();
		await db.execute("DELETE FROM opencut_projects WHERE id = ?", [id]);
	}

	// ------------------------------------------
	// Media Asset Operations
	// ------------------------------------------

	async saveMediaAsset({
		projectId,
		mediaAsset,
	}: {
		projectId: string;
		mediaAsset: MediaAsset;
	}): Promise<string> {
		const db = await getDatabase();

		// For Tauri desktop, we store the file path.
		// The File object has a webkitRelativePath or we derive path from the URL.
		// Media files added from our clip system will have a known filesystem path.
		// For drag-and-drop files, we store them in a project media directory.
		const filePath = await this.resolveFilePath({ mediaAsset, projectId });

		await db.execute(
			`INSERT INTO opencut_media_assets
			 (id, project_id, name, type, file_path, file_size, last_modified, width, height, duration, fps, thumbnail_url, ephemeral)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
			   name = excluded.name,
			   file_path = excluded.file_path,
			   file_size = excluded.file_size,
			   width = excluded.width,
			   height = excluded.height,
			   duration = excluded.duration,
			   fps = excluded.fps,
			   thumbnail_url = excluded.thumbnail_url`,
			[
				mediaAsset.id,
				projectId,
				mediaAsset.name,
				mediaAsset.type,
				filePath,
				mediaAsset.file.size,
				mediaAsset.file.lastModified,
				mediaAsset.width ?? null,
				mediaAsset.height ?? null,
				mediaAsset.duration ?? null,
				mediaAsset.fps ?? null,
				mediaAsset.thumbnailUrl ?? null,
				mediaAsset.ephemeral ? 1 : 0,
			],
		);

		// Fire-and-forget: generate a persistent thumbnail for video assets that don't have one
		const hasPersistentThumbnail =
			mediaAsset.thumbnailUrl && !mediaAsset.thumbnailUrl.startsWith("blob:");
		if (mediaAsset.type === "video" && !hasPersistentThumbnail) {
			this.generateAndPersistThumbnail(mediaAsset.id, projectId, filePath).catch(() => {});
		}

		return filePath;
	}

	async loadMediaAsset({
		projectId,
		id,
	}: {
		projectId: string;
		id: string;
	}): Promise<MediaAsset | null> {
		const db = await getDatabase();
		const rows = await db.select<MediaAssetRow[]>(
			"SELECT * FROM opencut_media_assets WHERE id = ? AND project_id = ?",
			[id, projectId],
		);

		if (rows.length === 0) return null;

		const row = rows[0];
		try {
			const file = await this.fileFromPath(
				row.file_path,
				row.name,
				row.type as "video" | "audio" | "image",
			);
			const url = URL.createObjectURL(file);

			// Resolve thumbnail: stored value may be a filesystem path, dead blob URL, or data URL
			let thumbnailUrl = await this.resolveThumbnailUrl(row.thumbnail_url);

			// Fallback: generate thumbnail for video assets that have none
			if (!thumbnailUrl && row.type === "video" && row.file_path) {
				thumbnailUrl = await this.generateAndPersistThumbnail(row.id, projectId, row.file_path);
			}

			return {
				id: row.id,
				name: row.name,

				type: row.type as "image" | "video" | "audio",
				file,
				url,
				filePath: row.file_path,
				width: row.width ?? undefined,
				height: row.height ?? undefined,
				duration: row.duration ?? undefined,
				fps: row.fps ?? undefined,
				thumbnailUrl,
				ephemeral: row.ephemeral === 1,
			};
		} catch (error) {
			console.error("[TauriStorage] Failed to load media file:", row.file_path, error);
			return null;
		}
	}

	async loadAllMediaAssets({
		projectId,
	}: {
		projectId: string;
	}): Promise<MediaAsset[]> {
		const db = await getDatabase();
		const rows = await db.select<MediaAssetRow[]>(
			"SELECT * FROM opencut_media_assets WHERE project_id = ?",
			[projectId],
		);

		const assets: MediaAsset[] = [];
		for (const row of rows) {
			try {
				const file = await this.fileFromPath(
					row.file_path,
					row.name,
					row.type as "video" | "audio" | "image",
				);
				const url = URL.createObjectURL(file);

				// Resolve thumbnail: stored value may be a filesystem path, dead blob URL, or data URL
				let thumbnailUrl = await this.resolveThumbnailUrl(row.thumbnail_url);

				// Fallback: generate thumbnail for video assets that have none
				if (!thumbnailUrl && row.type === "video" && row.file_path) {
					thumbnailUrl = await this.generateAndPersistThumbnail(row.id, projectId, row.file_path);
				}

				assets.push({
					id: row.id,
					name: row.name,
					type: row.type as "image" | "video" | "audio",
					file,
					url,
					filePath: row.file_path,
					width: row.width ?? undefined,
					height: row.height ?? undefined,
					duration: row.duration ?? undefined,
					fps: row.fps ?? undefined,
					thumbnailUrl,
					ephemeral: row.ephemeral === 1,
				});
			} catch (error) {
				console.error("[TauriStorage] Failed to load media:", row.file_path, error);
			}
		}

		return assets;
	}

	async deleteMediaAsset({
		projectId,
		id,
	}: {
		projectId: string;
		id: string;
	}): Promise<void> {
		const db = await getDatabase();
		await db.execute(
			"DELETE FROM opencut_media_assets WHERE id = ? AND project_id = ?",
			[id, projectId],
		);
	}

	async deleteProjectMedia({
		projectId,
	}: {
		projectId: string;
	}): Promise<void> {
		const db = await getDatabase();
		await db.execute(
			"DELETE FROM opencut_media_assets WHERE project_id = ?",
			[projectId],
		);
	}

	// ------------------------------------------
	// Saved Sounds Operations
	// ------------------------------------------

	async loadSavedSounds(): Promise<SavedSoundsData> {
		try {
			const db = await getDatabase();
			const rows = await db.select<SavedSoundRow[]>(
				"SELECT * FROM opencut_saved_sounds ORDER BY saved_at DESC",
			);

			const sounds: SavedSound[] = rows.map((row: SavedSoundRow) => ({
				id: row.id,
				name: row.name,
				username: row.username,
				previewUrl: row.preview_url ?? undefined,
				downloadUrl: row.download_url ?? undefined,
				duration: row.duration,
				tags: row.tags ? JSON.parse(row.tags) : [],
				license: row.license ?? "",
				savedAt: row.saved_at,
			}));

			return {
				sounds,
				lastModified: new Date().toISOString(),
			};
		} catch (error) {
			console.error("[TauriStorage] Failed to load saved sounds:", error);
			return { sounds: [], lastModified: new Date().toISOString() };
		}
	}

	async saveSoundEffect({ soundEffect }: { soundEffect: SoundEffect }): Promise<void> {
		const db = await getDatabase();
		const userId = getCurrentUserId();

		await db.execute(
			`INSERT OR IGNORE INTO opencut_saved_sounds 
			 (id, name, username, preview_url, download_url, duration, tags, license, saved_at, user_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				soundEffect.id,
				soundEffect.name,
				soundEffect.username,
				soundEffect.previewUrl ?? null,
				soundEffect.downloadUrl ?? null,
				soundEffect.duration,
				JSON.stringify(soundEffect.tags),
				soundEffect.license,
				new Date().toISOString(),
				userId,
			],
		);
	}

	async removeSavedSound({ soundId }: { soundId: number }): Promise<void> {
		const db = await getDatabase();
		await db.execute("DELETE FROM opencut_saved_sounds WHERE id = ?", [soundId]);
	}

	async isSoundSaved({ soundId }: { soundId: number }): Promise<boolean> {
		const db = await getDatabase();
		const rows = await db.select<{ count: number }[]>(
			"SELECT COUNT(*) as count FROM opencut_saved_sounds WHERE id = ?",
			[soundId],
		);
		return (rows[0]?.count ?? 0) > 0;
	}

	async clearSavedSounds(): Promise<void> {
		const db = await getDatabase();
		await db.execute("DELETE FROM opencut_saved_sounds");
	}

	// ------------------------------------------
	// Storage Info
	// ------------------------------------------

	async getStorageInfo(): Promise<{
		projects: number;
		isOPFSSupported: boolean;
		isIndexedDBSupported: boolean;
	}> {
		const db = await getDatabase();
		const rows = await db.select<{ count: number }[]>(
			"SELECT COUNT(*) as count FROM opencut_projects",
		);

		return {
			projects: rows[0]?.count ?? 0,
			isOPFSSupported: true, // Not relevant for Tauri, but keep interface
			isIndexedDBSupported: true,
		};
	}

	async getProjectStorageInfo({ projectId }: { projectId: string }): Promise<{
		mediaItems: number;
	}> {
		const db = await getDatabase();
		const rows = await db.select<{ count: number }[]>(
			"SELECT COUNT(*) as count FROM opencut_media_assets WHERE project_id = ?",
			[projectId],
		);

		return {
			mediaItems: rows[0]?.count ?? 0,
		};
	}

	async clearAllData(): Promise<void> {
		const db = await getDatabase();
		await db.execute("DELETE FROM opencut_media_assets");
		await db.execute("DELETE FROM opencut_projects");
		await db.execute("DELETE FROM opencut_saved_sounds");
	}

	/**
	 * Get the thumbnail for the first video element in a project's video track.
	 * Used by the project listing page to show a preview thumbnail for each project.
	 */
	async getProjectFirstVideoThumbnail({ projectId }: { projectId: string }): Promise<string | undefined> {
		try {
			const db = await getDatabase();
			const rows = await db.select<ProjectRow[]>(
				"SELECT project_data FROM opencut_projects WHERE id = ?",
				[projectId],
			);
			if (!rows.length) return undefined;

			const serialized: SerializedProject = JSON.parse(rows[0].project_data);
			const firstScene = serialized.scenes?.[0];
			const videoTrack = firstScene?.tracks?.find((t: any) => t.type === "video") as any;
			const mediaId = videoTrack?.elements?.[0]?.mediaId;
			if (!mediaId) return undefined;

			const assetRows = await db.select<MediaAssetRow[]>(
				"SELECT id, thumbnail_url, file_path, type FROM opencut_media_assets WHERE id = ? AND project_id = ?",
				[mediaId, projectId],
			);
			if (!assetRows.length) return undefined;

			const row = assetRows[0];
			let thumbnailUrl = await this.resolveThumbnailUrl(row.thumbnail_url);
			if (!thumbnailUrl && row.type === "video" && row.file_path) {
				thumbnailUrl = await this.generateAndPersistThumbnail(row.id, projectId, row.file_path);
			}
			return thumbnailUrl;
		} catch (err) {
			console.warn("[TauriStorage] Failed to get project first video thumbnail:", err);
			return undefined;
		}
	}

	isOPFSSupported(): boolean {
		return true;
	}

	isIndexedDBSupported(): boolean {
		return true;
	}

	isFullySupported(): boolean {
		return true;
	}

	// ------------------------------------------
	// Private Helpers
	// ------------------------------------------

	/**
	 * Create a File object from a filesystem path.
	 * Uses the Rust video server which has no scope restrictions.
	 * For large files (>50MB), the server requires Range requests,
	 * so we use HEAD first to determine size and avoid 416 errors.
	 */
	private async fileFromPath(
		filePath: string,
		displayName: string,
		kind: "video" | "audio" | "image",
	): Promise<File> {
		const fileLabel = playbackFileLabel(filePath, displayName, kind);
		const { invoke } = await import("@tauri-apps/api/core");
		let videoServerPort: number;
		try {
			videoServerPort = await invoke<number>("get_video_server_port");
		} catch {
			videoServerPort = 8642;
		}

		const encodedPath = utf8ToBase64Url(filePath);
		const serverUrl = `http://localhost:${videoServerPort}/video/${encodedPath}`;

		// Use HEAD to determine file size before fetching
		const headResp = await fetch(serverUrl, { method: "HEAD" });
		if (!headResp.ok) {
			throw new Error(`Failed to HEAD file from video server (${headResp.status}): ${filePath}`);
		}
		const fileSize = parseInt(headResp.headers.get("Content-Length") || "0", 10);
		if (fileSize === 0) {
			throw new Error(`Cannot determine file size for: ${filePath}`);
		}

		const mimeType = this.mimeFromPath(filePath, kind);

		const MAX_SIMPLE_SIZE = 50 * 1024 * 1024; // 50MB

		// Small files: simple fetch
		if (fileSize <= MAX_SIMPLE_SIZE) {
			const response = await fetch(serverUrl);
			if (!response.ok) {
				throw new Error(`Failed to load file from video server (${response.status}): ${filePath}`);
			}
			const blob = await response.blob();
			return new File([blob], fileLabel, {
				type: blob.type || mimeType,
				lastModified: Date.now(),
			});
		}

		// Large files: fetch in chunks via Range requests
		const CHUNK_SIZE = MAX_SIMPLE_SIZE;
		const chunks: Blob[] = [];

		for (let start = 0; start < fileSize; start += CHUNK_SIZE) {
			const end = Math.min(start + CHUNK_SIZE - 1, fileSize - 1);
			const chunkResp = await fetch(serverUrl, {
				headers: { Range: `bytes=${start}-${end}` },
			});
			if (!chunkResp.ok && chunkResp.status !== 206) {
				throw new Error(`Failed to fetch chunk ${start}-${end} (${chunkResp.status}): ${filePath}`);
			}
			chunks.push(await chunkResp.blob());
		}

		const fullBlob = new Blob(chunks, { type: mimeType });
		return new File([fullBlob], fileLabel, {
			type: mimeType,
			lastModified: Date.now(),
		});
	}

	private mimeFromPath(filePath: string, kind?: "video" | "audio" | "image"): string {
		const fromPath = filePath.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() ?? "";
		const ext = fromPath || "";

		const map: Record<string, string> = {
			mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
			avi: "video/x-msvideo", mkv: "video/x-matroska",
			mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
			aac: "audio/aac", m4a: "audio/mp4", flac: "audio/flac",
			jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
			gif: "image/gif", webp: "image/webp",
		};
		if (map[ext]) return map[ext];
		if (kind === "video") return "video/mp4";
		if (kind === "audio") return "audio/mpeg";
		if (kind === "image") return "image/png";
		return "application/octet-stream";
	}

	/**
	 * Resolve the filesystem path for a media asset.
	 * For files from our clip system, the path is already known.
	 * For user-uploaded files, we need to save them to a project directory.
	 */
	private async resolveFilePath({
		mediaAsset,
		projectId: _projectId,
	}: {
		mediaAsset: MediaAsset;
		projectId: string;
	}): Promise<string> {
		// If the file has a path property (from Tauri file picker), copy it to the
		// project's managed media directory so the asset persists after reload.
		const fileWithPath = mediaAsset.file as File & { path?: string };
		const diskSource =
			mediaAsset.diskImportPath?.trim() ||
			(typeof fileWithPath.path === "string" ? fileWithPath.path.trim() : "");
		if (diskSource) {
			const { invoke } = await import("@tauri-apps/api/core");
			const fileName = editorMediaDestinationFilename({
				id: mediaAsset.id,
				displayName: mediaAsset.name,
				sourcePathHint: diskSource,
				kind: mediaAsset.type,
			});
			return await invoke<string>("copy_file_to_project_media", {
				sourcePath: diskSource,
				projectId: _projectId,
				fileName,
			});
		}

		// If the URL is a convertFileSrc URL, extract the path
		if (mediaAsset.url) {
			// Tauri asset URLs look like: https://asset.localhost/path/to/file
			// or http://asset.localhost/path/to/file
			const assetMatch = mediaAsset.url.match(/asset\.localhost\/(.+)/);
			if (assetMatch) {
				return decodeURIComponent(assetMatch[1]);
			}

			// Our video server URLs look like: http://localhost:PORT/video/BASE64PATH
			const videoMatch = mediaAsset.url.match(/\/video\/([^?]+)/);
			if (videoMatch) {
				try {
					return base64ToUtf8(videoMatch[1]);
				} catch {
					// Not a base64 path
				}
			}
		}

		// For uploaded files without a path, save to editor-media via Rust command
		const { invoke } = await import("@tauri-apps/api/core");
		const arrayBuffer = await mediaAsset.file.arrayBuffer();
		const fileName = editorMediaDestinationFilename({
			id: mediaAsset.id,
			displayName: mediaAsset.name,
			sourcePathHint: mediaAsset.file.name,
			kind: mediaAsset.type,
		});
		const filePath = await invoke<string>("save_editor_media_file", {
			projectId: _projectId,
			fileName,
			bytes: Array.from(new Uint8Array(arrayBuffer)),
		});
		return filePath;
	}

	/**
	 * Resolve a stored thumbnail URL into something renderable.
	 * Handles three cases:
	 * 1. data: URL — already renderable, pass through
	 * 2. Filesystem path — read via Tauri command and convert to data URL
	 * 3. blob: URL — dead after reload, return undefined
	 */
	private async resolveThumbnailUrl(storedUrl: string | null): Promise<string | undefined> {
		if (!storedUrl) return undefined;

		// Data URLs are already renderable
		if (storedUrl.startsWith("data:")) return storedUrl;

		// Blob URLs are ephemeral and dead after reload
		if (storedUrl.startsWith("blob:")) return undefined;

		// HTTP URLs (e.g. video server URLs) — unlikely for thumbnails but pass through
		if (storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) return storedUrl;

		// Assume it's a filesystem path — convert to data URL via Tauri
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			const dataUrl = await invoke<string>("read_file_as_data_url", {
				filePath: storedUrl,
			});
			return dataUrl;
		} catch (error) {
			console.warn("[TauriStorage] Failed to load thumbnail from path:", storedUrl, error);
			return undefined;
		}
	}

	/**
	 * Generate a thumbnail for a video asset that has none, persist the path
	 * to the DB so it only needs to be generated once, and return a data URL.
	 */
	private async generateAndPersistThumbnail(
		assetId: string,
		projectId: string,
		videoFilePath: string,
	): Promise<string | undefined> {
		try {
			const { invoke } = await import("@tauri-apps/api/core");

			// Generate thumbnail at 1 second into the video
			const thumbnailPath = await invoke<string>("generate_thumbnail_at_timestamp", {
				videoPath: videoFilePath,
				timestampSeconds: 1.0,
				outputFilename: `editor_asset_${assetId}`,
			});

			// Read the generated thumbnail as a data URL
			const dataUrl = await invoke<string>("read_file_as_data_url", {
				filePath: thumbnailPath,
			});

			// Persist the thumbnail path to the DB so we don't regenerate next time
			const db = await getDatabase();
			await db.execute(
				"UPDATE opencut_media_assets SET thumbnail_url = ? WHERE id = ? AND project_id = ?",
				[thumbnailPath, assetId, projectId],
			);

			return dataUrl;
		} catch (error) {
			console.warn("[TauriStorage] Failed to generate thumbnail for video:", videoFilePath, error);
			return undefined;
		}
	}
}

export const storageService = new TauriStorageService();
export { TauriStorageService as StorageService };
