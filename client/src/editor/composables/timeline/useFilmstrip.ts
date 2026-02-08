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

		isLoading.value = true;

		// Collect new frames progressively
		const newFrames: FilmstripFrame[] = [];

		currentController = filmstripService.requestFilmstrip({
			taskKey: taskKey.value,
			mediaId,
			file: asset.file,
			timestamps,
			onFrame: (timestamp: number, bitmap: ImageBitmap) => {
				// Create a canvas to convert bitmap to an object URL for CSS background-image
				const canvas = document.createElement("canvas");
				canvas.width = bitmap.width;
				canvas.height = bitmap.height;
				const ctx = canvas.getContext("2d");
				if (ctx) {
					ctx.drawImage(bitmap, 0, 0);
				}
				canvas.toBlob((blob) => {
					if (!blob) return;
					const objectUrl = URL.createObjectURL(blob);
					objectUrls.add(objectUrl);
					newFrames.push({ timestamp, bitmap, objectUrl });
					// Sort by timestamp and update reactively
					newFrames.sort((a, b) => a.timestamp - b.timestamp);
					frames.value = [...newFrames];
				}, "image/jpeg", 0.7);
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
