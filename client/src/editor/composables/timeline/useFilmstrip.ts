import { ref, watch, computed, onMounted, onUnmounted, type Ref } from "vue";
import { filmstripService } from "../../services/filmstrip-service";
import type { TimelineElement as TimelineElementType } from "../../types/timeline";
import type { MediaAsset } from "../../types/assets";
import { EditorCore } from "../../core";

const DEBOUNCE_MS = 200;
const THUMBNAIL_HEIGHT = 54;
const DEFAULT_ASPECT_RATIO = 16 / 9;

interface FilmstripFrame {
	timestamp: number;
	bitmap: ImageBitmap;
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
	canvasRef,
	suspended,
}: {
	element: Ref<TimelineElementType>;
	mediaAsset: Ref<MediaAsset | null>;
	zoomLevel: Ref<number>;
	elementWidth: Ref<number>;
	canvasRef: Ref<HTMLCanvasElement | null>;
	suspended: Ref<boolean>;
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
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let currentController: AbortController | null = null;
	let extractionGeneration = 0;
	let resizeObserver: ResizeObserver | null = null;
	let drawFrame: number | null = null;

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

	function clearFrames() {
		frameMap.value.clear();
	}

	function drawFrames() {
		drawFrame = null;
		const canvas = canvasRef.value;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const width = Math.max(1, Math.round(rect.width));
		const height = Math.max(1, Math.round(rect.height));
		if (canvas.width !== width) canvas.width = width;
		if (canvas.height !== height) canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, width, height);
		const currentFrames = frames.value;
		if (currentFrames.length === 0) return;
		const cellWidth = width / currentFrames.length;
		for (let index = 0; index < currentFrames.length; index++) {
			const bitmap = currentFrames[index].bitmap;
			const sourceRatio = bitmap.width / bitmap.height;
			const cellRatio = cellWidth / height;
			let sx = 0;
			let sy = 0;
			let sw = bitmap.width;
			let sh = bitmap.height;
			if (sourceRatio > cellRatio) {
				sw = bitmap.height * cellRatio;
				sx = (bitmap.width - sw) / 2;
			} else {
				sh = bitmap.width / cellRatio;
				sy = (bitmap.height - sh) / 2;
			}
			ctx.drawImage(bitmap, sx, sy, sw, sh, index * cellWidth, 0, cellWidth + 0.5, height);
		}
	}

	function scheduleDraw() {
		if (drawFrame !== null) return;
		drawFrame = requestAnimationFrame(drawFrames);
	}

	function requestExtraction() {
		if (suspended.value || EditorCore.getInstance().getInteractiveDrag()) {
			isLoading.value = false;
			return;
		}

		const el = element.value;
		const asset = mediaAsset.value;

		if (!asset || !asset.file || (el.type !== "video" && el.type !== "image")) {
			clearFrames();
			return;
		}

		if (el.type === "image") {
			// Images don't need filmstrip — single thumbnail is fine
			return;
		}

		const widthPx = elementWidth.value;
		if (widthPx <= 0) {
			clearFrames();
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
			clearFrames();
			return;
		}

		const desiredKeys = new Set(allTimestamps.map((ts) => String(roundTs(ts))));
		for (const key of [...frameMap.value.keys()]) {
			if (!desiredKeys.has(key)) {
				frameMap.value.delete(key);
			}
		}
		scheduleDraw();

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

		isLoading.value = true;

		const myGeneration = ++extractionGeneration;

		currentController = filmstripService.requestFilmstrip({
			taskKey: el.id,
			mediaId,
			file: asset.file,
			timestamps: missingTimestamps,
			onFrame: (timestamp: number, bitmap: ImageBitmap) => {
				if (extractionGeneration !== myGeneration) return;
				const key = String(roundTs(timestamp));
				frameMap.value.set(key, { timestamp, bitmap });
				scheduleDraw();
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
			clearFrames();
			debouncedRequest();
		},
	);

	// Zoom/width changes only trigger incremental fill-in (not a full reset)
	watch([zoomLevel, elementWidth], () => {
		debouncedRequest();
	}, { immediate: true });

	watch(suspended, (isSuspended) => {
		if (isSuspended) {
			extractionGeneration++;
			currentController?.abort();
			filmstripService.cancelExtraction({ taskKey: element.value.id });
			isLoading.value = false;
		} else {
			debouncedRequest();
		}
	});

	watch(canvasRef, (canvas) => {
		resizeObserver?.disconnect();
		resizeObserver = null;
		if (canvas) {
			resizeObserver = new ResizeObserver(scheduleDraw);
			resizeObserver.observe(canvas);
			scheduleDraw();
		}
	});

	onMounted(() => {
		if (canvasRef.value) {
			resizeObserver = new ResizeObserver(scheduleDraw);
			resizeObserver.observe(canvasRef.value);
			scheduleDraw();
		}
	});

	onUnmounted(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		if (currentController) {
			currentController.abort();
		}
		resizeObserver?.disconnect();
		if (drawFrame !== null) cancelAnimationFrame(drawFrame);
		filmstripService.cancelExtraction({ taskKey: element.value.id });
		clearFrames();
	});

	return {
		frames: frames as unknown as Ref<FilmstripFrame[]>,
		thumbnailWidth,
		isLoading,
	};
}
