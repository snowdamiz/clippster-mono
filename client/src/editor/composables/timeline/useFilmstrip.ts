import { ref, watch, computed, onUnmounted, type Ref } from "vue";
import { filmstripService } from "../../services/filmstrip-service";
import type { TimelineElement as TimelineElementType } from "../../types/timeline";
import type { MediaAsset } from "../../types/assets";

const DEBOUNCE_MS = 200;
const THUMBNAIL_HEIGHT = 54;
const DEFAULT_ASPECT_RATIO = 16 / 9;

interface FilmstripFrame {
	timestamp: number;
	bitmap: ImageBitmap;
	objectUrl: string;
}

// Shared reusable canvas for bitmap→blob conversion.
// Avoids creating a new GPU-backed canvas per frame, which crashes WKWebView on macOS.
let sharedConversionCanvas: HTMLCanvasElement | null = null;
function getConversionCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
	if (!sharedConversionCanvas) {
		sharedConversionCanvas = document.createElement("canvas");
	}
	sharedConversionCanvas.width = width;
	sharedConversionCanvas.height = height;
	const ctx = sharedConversionCanvas.getContext("2d");
	if (!ctx) return null;
	return { canvas: sharedConversionCanvas, ctx };
}

/** Round timestamp to the same precision used by the service cache key. */
function roundTs(ts: number): number {
	return Math.round(ts * 100) / 100;
}

export function useFilmstrip({
	element,
	mediaAsset,
	zoomLevel,
	elementWidth,
}: {
	element: Ref<TimelineElementType>;
	mediaAsset: Ref<MediaAsset | null>;
	zoomLevel: Ref<number>;
	elementWidth: Ref<number>;
}): {
	frames: Ref<FilmstripFrame[]>;
	thumbnailWidth: Ref<number>;
	isLoading: Ref<boolean>;
} {
	/**
	 * Map<roundedTsKey, FilmstripFrame> as the primary reactive store.
	 * Vue 3 tracks Map mutations (set/delete) via its Proxy-based reactivity.
	 * This avoids the per-frame O(n log n) array rebuild that the old ref<[]> caused.
	 */
	const frameMap = ref(new Map<string, FilmstripFrame>());

	/**
	 * Sorted array computed once from the Map. Only re-runs when the Map changes,
	 * not on every frame's individual sort call.
	 */
	const frames = computed<FilmstripFrame[]>(() =>
		[...frameMap.value.values()].sort((a, b) => a.timestamp - b.timestamp),
	);

	const isLoading = ref(false);
	const objectUrls = new Set<string>();
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let currentController: AbortController | null = null;
	let extractionGeneration = 0;

	const thumbnailWidth = computed(() => {
		const asset = mediaAsset.value;
		if (!asset) return THUMBNAIL_HEIGHT * DEFAULT_ASPECT_RATIO;

		const el = element.value;
		if (el.type !== "video" && el.type !== "image") {
			return THUMBNAIL_HEIGHT * DEFAULT_ASPECT_RATIO;
		}

		const ar = asset.width && asset.height
			? asset.width / asset.height
			: filmstripService.getAspectRatio({ mediaId: (el as any).mediaId });
		return THUMBNAIL_HEIGHT * ar;
	});

	function revokeAllUrls() {
		for (const url of objectUrls) {
			URL.revokeObjectURL(url);
		}
		objectUrls.clear();
		// Clear the frame map so stale frames aren't shown on remount
		frameMap.value.clear();
	}

	function requestExtraction() {
		const el = element.value;
		const asset = mediaAsset.value;

		if (!asset || !asset.file || (el.type !== "video" && el.type !== "image")) {
			revokeAllUrls();
			return;
		}

		if (el.type === "image") {
			// Images don't need filmstrip — single thumbnail is fine
			return;
		}

		const widthPx = elementWidth.value;
		if (widthPx <= 0) {
			revokeAllUrls();
			return;
		}

		const mediaId = (el as any).mediaId as string;
		const trimStart = (el as any).trimStart ?? 0;
		const duration = el.duration;
		const speed = (el as any).speed ?? 1;

		const ar = asset.width && asset.height
			? asset.width / asset.height
			: DEFAULT_ASPECT_RATIO;

		const allTimestamps = filmstripService.computeTimestamps({
			trimStart,
			duration,
			speed,
			elementWidthPx: widthPx,
			aspectRatio: ar,
		});

		if (allTimestamps.length === 0) {
			revokeAllUrls();
			return;
		}

		/**
		 * Zoom de-duplication: only request timestamps that aren't already in
		 * the frame map. When the user zooms slightly, tiles already decoded at
		 * those exact timestamps are reused instantly without re-decoding.
		 */
		const missingTimestamps = allTimestamps.filter(
			(ts) => !frameMap.value.has(String(roundTs(ts))),
		);

		// If all timestamps are already decoded, just mark loading done.
		if (missingTimestamps.length === 0) {
			isLoading.value = false;
			return;
		}

		// Cancel previous extraction
		if (currentController) {
			currentController.abort();
		}

		// Revoke old object URLs and clear the map before a full re-extraction
		// (i.e. when element/media changed, not just a zoom tile fill-in)
		const isFullReset = missingTimestamps.length === allTimestamps.length;
		if (isFullReset) {
			revokeAllUrls();
		}

		isLoading.value = true;

		// Serialize canvas write + toBlob operations so the shared canvas is never
		// overwritten before the previous toBlob callback fires.
		let conversionQueue: Promise<void> = Promise.resolve();

		const myGeneration = ++extractionGeneration;

		currentController = filmstripService.requestFilmstrip({
			taskKey: el.id,
			mediaId,
			file: asset.file,
			timestamps: missingTimestamps,
			onFrame: (timestamp: number, bitmap: ImageBitmap) => {
				if (extractionGeneration !== myGeneration) return;

				conversionQueue = conversionQueue.then(
					() =>
						new Promise<void>((resolve) => {
							if (extractionGeneration !== myGeneration) {
								resolve();
								return;
							}

							// Reuse a single shared canvas to avoid creating GPU-backed canvases per frame
							// (WKWebView on macOS has a hard limit on canvas contexts and will crash)
							const conversion = getConversionCanvas(bitmap.width, bitmap.height);
							if (!conversion) {
								resolve();
								return;
							}

							conversion.ctx.drawImage(bitmap, 0, 0);
							conversion.canvas.toBlob((blob) => {
								resolve();
								if (!blob || extractionGeneration !== myGeneration) return;
								const objectUrl = URL.createObjectURL(blob);
								objectUrls.add(objectUrl);
								const key = String(roundTs(timestamp));
								// Map.set triggers Vue reactivity — O(1) update, no full array rebuild
								frameMap.value.set(key, { timestamp, bitmap, objectUrl });
							}, "image/jpeg", 0.7);
						}),
				);
			},
			onDone: () => {
				isLoading.value = false;
			},
		});
	}

	function debouncedRequest() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		debounceTimer = setTimeout(() => {
			requestExtraction();
		}, DEBOUNCE_MS);
	}

	// Watch for changes that require re-extraction.
	// When element identity/trim/speed/media changes, we do a full reset.
	// When only zoom/width changes, requestExtraction() filters already-cached timestamps.
	watch(
		[
			() => element.value.id,
			() => element.value.duration,
			() => (element.value as any).trimStart,
			() => (element.value as any).speed,
			() => mediaAsset.value?.id,
		],
		() => {
			// Force full reset on identity change
			extractionGeneration++;
			if (currentController) currentController.abort();
			revokeAllUrls();
			debouncedRequest();
		},
	);

	// Zoom/width changes only trigger incremental fill-in (not a full reset)
	watch([zoomLevel, elementWidth], () => {
		debouncedRequest();
	}, { immediate: true });

	onUnmounted(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		if (currentController) {
			currentController.abort();
		}
		filmstripService.cancelExtraction({ taskKey: element.value.id });
		revokeAllUrls();
	});

	return {
		frames: frames as unknown as Ref<FilmstripFrame[]>,
		thumbnailWidth,
		isLoading,
	};
}
