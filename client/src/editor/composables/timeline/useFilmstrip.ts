import { ref, watch, onUnmounted, type Ref, computed } from "vue";
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
	const frames = ref<FilmstripFrame[]>([]);
	const isLoading = ref(false);
	const objectUrls = new Set<string>();
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let currentController: AbortController | null = null;
	// Monotonically-increasing counter. Incremented before each requestFilmstrip call.
	// Each onFrame closure captures its own generation so that:
	//   - Synchronously-delivered cached frames (delivered before requestFilmstrip returns
	//     and before currentController is updated) are NOT falsely treated as stale.
	//   - Callbacks from a superseded extraction are correctly discarded.
	let extractionGeneration = 0;

	const taskKey = computed(() => element.value.id);

	const thumbnailWidth = computed(() => {
		const asset = mediaAsset.value;
		if (!asset) return THUMBNAIL_HEIGHT * DEFAULT_ASPECT_RATIO;

		const el = element.value;
		if (el.type !== "video" && el.type !== "image") {
			return THUMBNAIL_HEIGHT * DEFAULT_ASPECT_RATIO;
		}

		const ar = asset.width && asset.height
			? asset.width / asset.height
			: filmstripService.getAspectRatio({ mediaId: el.mediaId });
		return THUMBNAIL_HEIGHT * ar;
	});

	function revokeAllUrls() {
		for (const url of objectUrls) {
			URL.revokeObjectURL(url);
		}
		objectUrls.clear();
	}

	function requestExtraction() {
		const el = element.value;
		const asset = mediaAsset.value;

		if (!asset || !asset.file || (el.type !== "video" && el.type !== "image")) {
			frames.value = [];
			return;
		}

		if (el.type === "image") {
			// Images don't need filmstrip — single thumbnail is fine
			return;
		}

		const widthPx = elementWidth.value;
		if (widthPx <= 0) {
			frames.value = [];
			return;
		}

		const mediaId = el.mediaId;
		const trimStart = el.trimStart ?? 0;
		const duration = el.duration;
		const speed = el.speed ?? 1;

		const ar = asset.width && asset.height
			? asset.width / asset.height
			: DEFAULT_ASPECT_RATIO;

		const timestamps = filmstripService.computeTimestamps({
			trimStart,
			duration,
			speed,
			elementWidthPx: widthPx,
			aspectRatio: ar,
		});

		if (timestamps.length === 0) {
			frames.value = [];
			return;
		}

		// Cancel previous extraction
		if (currentController) {
			currentController.abort();
		}

		// Revoke old object URLs to free memory before starting new extraction
		revokeAllUrls();

		isLoading.value = true;

		// Collect new frames progressively
		const newFrames: FilmstripFrame[] = [];

		// Serialize canvas write + toBlob operations so the shared canvas is never
		// overwritten before the previous toBlob callback fires.
		let conversionQueue: Promise<void> = Promise.resolve();

		// Increment generation BEFORE calling requestFilmstrip. The service may
		// deliver cached frames synchronously (inside requestFilmstrip, before it
		// returns). If we used currentController for the abort check, those frames
		// would see the OLD (already-aborted) controller and be silently dropped —
		// causing blank thumbnails on zoom-out when timestamps are cache-hits.
		// The generation counter is captured in the closure before the call, so
		// synchronous and asynchronous frames are treated identically.
		const myGeneration = ++extractionGeneration;

		currentController = filmstripService.requestFilmstrip({
			taskKey: taskKey.value,
			mediaId,
			file: asset.file,
			timestamps,
			onFrame: (timestamp: number, bitmap: ImageBitmap) => {
				if (extractionGeneration !== myGeneration) return;

				// Chain onto the queue so only one drawImage+toBlob runs at a time.
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
								resolve(); // always advance the queue
								if (!blob || extractionGeneration !== myGeneration) return;
								const objectUrl = URL.createObjectURL(blob);
								objectUrls.add(objectUrl);
								newFrames.push({ timestamp, bitmap, objectUrl });
								// Sort by timestamp and update reactively
								newFrames.sort((a, b) => a.timestamp - b.timestamp);
								frames.value = [...newFrames];
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

	// Watch for changes that require re-extraction
	watch(
		[
			() => element.value.id,
			() => element.value.duration,
			() => (element.value as any).trimStart,
			() => (element.value as any).speed,
			() => mediaAsset.value?.id,
			zoomLevel,
			elementWidth,
		],
		() => {
			debouncedRequest();
		},
		{ immediate: true },
	);

	onUnmounted(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		if (currentController) {
			currentController.abort();
		}
		filmstripService.cancelExtraction({ taskKey: taskKey.value });
		revokeAllUrls();
	});

	return {
		frames,
		thumbnailWidth,
		isLoading,
	};
}
