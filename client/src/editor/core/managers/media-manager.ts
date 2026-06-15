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
	private assets: MediaAsset[] = [];
	private isLoading = false;
	private processingAssets = new Set<string>();
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
	}): Promise<void> {
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
			const mediaAssets = await storageService.loadAllMediaAssets({
				projectId,
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
}
