import type { EditorCore } from "../../core";
import type { MediaAsset } from "../../types/assets";
import { storageService } from "../../storage/service";
import { generateUUID } from "../../utils/id";
import { videoCache } from "../../video-cache/service";
import { filmstripService } from "../../services/filmstrip-service";
import { hasMediaId } from "../../lib/timeline/element-utils";
import { healOrphanVideoMediaReferences } from "../../lib/timeline/heal-orphan-video-media";
import { waveformService } from "@/services/waveformService";
import { fileNameFromPathOrName } from "@/utils/fsNames";

export class MediaManager {
	private static readonly MAX_UNUSED_HYDRATED_ASSETS = 4;
	private assets: MediaAsset[] = [];
	private isLoading = false;
	private processingAssets = new Set<string>();
	private hydrationPromises = new Map<string, Promise<MediaAsset>>();
	private hydrationAccess = new Map<string, number>();
	private listeners = new Set<() => void>();

	constructor(private editor: EditorCore) {}

	async addMediaAsset({
		projectId,
		asset,
		mediaAssetId,
	}: {
		projectId: string;
		asset: Omit<MediaAsset, "id">;
		/** When set, used as the media asset id (must match pre-copied editor-media filename prefix). */
		mediaAssetId?: string;
	}): Promise<string> {
		const newAsset: MediaAsset = {
			...asset,
			id: mediaAssetId ?? generateUUID(),
			name: fileNameFromPathOrName(asset.name),
		};

		this.assets = [...this.assets, newAsset];
		this.processingAssets.add(newAsset.id);
		this.notify();

		try {
			const resolvedPath = await storageService.saveMediaAsset({ projectId, mediaAsset: newAsset });
			// Populate filePath on the in-memory asset so export can find it
			newAsset.filePath = resolvedPath;
			delete newAsset.alreadyResolvedFilePath;
			delete newAsset.importFileSizeBytes;
			delete newAsset.importFileLastModifiedMs;
			this.notify();

			// Pre-load waveform for video/audio assets so it's ready when added to timeline.
			// Video-only stock B-roll has no audio stream; waveformService handles that silently.
			if ((newAsset.type === "video" || newAsset.type === "audio") && resolvedPath) {
				void waveformService.loadAudio(resolvedPath).catch(() => {});
			}
		} catch (error) {
			console.error("Failed to save media asset:", error);
			this.assets = this.assets.filter((asset) => asset.id !== newAsset.id);
		} finally {
			this.processingAssets.delete(newAsset.id);
			this.notify();
		}

		return newAsset.id;
	}

	async removeMediaAsset({
		projectId,
		id,
	}: {
		projectId: string;
		id: string;
	}): Promise<void> {
		const asset = this.assets.find((asset) => asset.id === id);

		videoCache.clearAll();
		filmstripService.clearMedia({ mediaId: id });

		if (asset?.url) {
			URL.revokeObjectURL(asset.url);
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		}

		this.assets = this.assets.filter((asset) => asset.id !== id);
		this.notify();

		const tracks = this.editor.timeline.getTracks();
		const elementsToRemove: Array<{ trackId: string; elementId: string }> = [];

		for (const track of tracks) {
			for (const element of track.elements) {
				if (hasMediaId(element) && element.mediaId === id) {
					elementsToRemove.push({ trackId: track.id, elementId: element.id });
				}
			}
		}

		if (elementsToRemove.length > 0) {
			this.editor.timeline.deleteElements({ elements: elementsToRemove });
		}

		try {
			await storageService.deleteMediaAsset({ projectId, id });
		} catch (error) {
			console.error("Failed to delete media asset:", error);
		}
	}

	async loadProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		// Do NOT notify() here: assets are still [] (see clearAllAssets) while scenes already
		// reference mediaIds — audio would run collectAudioClips on an empty map and spam warnings,
		// and clip cache can stay wrong for the rest of the session.
		this.isLoading = true;

		try {
			const hydrateIds = new Set<string>();
			for (const track of this.editor.timeline.getTracks()) {
				for (const element of track.elements) {
					if (hasMediaId(element)) hydrateIds.add(element.mediaId);
				}
			}
			const mediaAssets = await storageService.loadAllMediaAssets({
				projectId,
				hydrateIds,
			});
			this.assets = mediaAssets;
			// Run before notify(): listeners (audio) call collectAudioClips immediately and need
			// orphan mediaId aliases / timeline rewires applied first — project-manager heal was too late.
			healOrphanVideoMediaReferences({ editor: this.editor, projectId });
			this.notify();
		} catch (error) {
			console.error("Failed to load media assets:", error);
		} finally {
			this.isLoading = false;
			this.notify();
		}
	}

	async ensureAssetHydrated(id: string): Promise<MediaAsset | null> {
		const asset = this.assets.find((item) => item.id === id);
		if (!asset) return null;
		if (asset.isHydrated !== false && asset.file.size > 0) {
			this.hydrationAccess.set(id, performance.now());
			return asset;
		}

		const existing = this.hydrationPromises.get(id);
		if (existing) return existing;

		const hydration = storageService.hydrateMediaAsset({ asset })
			.then((hydrated) => {
				const index = this.assets.findIndex((item) => item.id === id);
				if (index >= 0) {
					const previous = this.assets[index];
					if (previous?.url && previous.url !== hydrated.url) {
						URL.revokeObjectURL(previous.url);
					}
					this.assets = this.assets.map((item) => item.id === id ? hydrated : item);
					this.hydrationAccess.set(id, performance.now());
					this.evictUnusedHydratedAssets();
					this.notify();
				}
				return hydrated;
			})
			.finally(() => {
				this.hydrationPromises.delete(id);
			});
		this.hydrationPromises.set(id, hydration);
		return hydration;
	}

	async clearProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		});

		const mediaIds = this.assets.map((asset) => asset.id);
		this.assets = [];
		this.notify();

		try {
			await Promise.all(
				mediaIds.map((id) =>
					storageService.deleteMediaAsset({ projectId, id }),
				),
			);
		} catch (error) {
			console.error("Failed to clear media assets from storage:", error);
		}
	}

	clearAllAssets(): void {
		videoCache.clearAll();
		filmstripService.clearAll();
		this.hydrationPromises.clear();
		this.hydrationAccess.clear();

		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		});

		this.assets = [];
		this.notify();
	}

	getAssets(): MediaAsset[] {
		return this.assets;
	}

	setAssets({ assets }: { assets: MediaAsset[] }): void {
		this.assets = assets;
		this.notify();
	}

	/** Replace an asset's raster after in-place paint/erase and notify subscribers. */
	replaceAssetRaster({
		id,
		file,
		url,
	}: {
		id: string;
		file: File;
		url: string;
	}): void {
		this.assets = this.assets.map((asset) => {
			if (asset.id !== id) return asset;
			if (asset.url?.startsWith("blob:")) {
				URL.revokeObjectURL(asset.url);
			}
			return {
				...asset,
				file,
				url,
				isHydrated: true,
			};
		});
		this.notify();
	}

	isLoadingMedia(): boolean {
		return this.isLoading;
	}

	isAssetProcessing(id: string): boolean {
		return this.processingAssets.has(id);
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}

	private evictUnusedHydratedAssets(): void {
		const referenced = new Set<string>();
		for (const track of this.editor.timeline.getTracks()) {
			for (const element of track.elements) {
				if (hasMediaId(element)) referenced.add(element.mediaId);
			}
		}
		const candidates = this.assets
			.filter((asset) =>
				!referenced.has(asset.id) &&
				asset.isHydrated !== false &&
				asset.file.size > 0,
			)
			.sort((a, b) =>
				(this.hydrationAccess.get(a.id) ?? 0) - (this.hydrationAccess.get(b.id) ?? 0),
			);
		const removeCount = candidates.length - MediaManager.MAX_UNUSED_HYDRATED_ASSETS;
		if (removeCount <= 0) return;
		const evicted = new Set(candidates.slice(0, removeCount).map((asset) => asset.id));
		this.assets = this.assets.map((asset) => {
			if (!evicted.has(asset.id)) return asset;
			if (asset.url) URL.revokeObjectURL(asset.url);
			this.hydrationAccess.delete(asset.id);
			return {
				...asset,
				file: new File([], asset.file.name, {
					type: asset.file.type,
					lastModified: asset.file.lastModified,
				}),
				url: undefined,
				isHydrated: false,
			};
		});
	}
}
