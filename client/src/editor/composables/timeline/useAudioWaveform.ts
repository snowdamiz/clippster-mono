/**
 * Audio Waveform composable for editor timeline elements.
 *
 * Reuses the shared waveformService + waveformRenderer from the ProjectWorkspace
 * so that audio elements on the editor timeline display the exact same CapCut-style
 * waveform (teal base, white played portion, yellow/orange/red gradient for loud peaks,
 * bars growing upward from bottom).
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted, type Ref } from "vue";
import { waveformService, useWaveform } from "@/services/waveformService";
import { renderWaveformWithPlayhead, createThrottledRenderer } from "@/utils/waveformRenderer";
import type { TimelineElement, AudioElement, VideoElement } from "../../types/timeline";
import type { MediaAsset } from "../../types/assets";

interface UseAudioWaveformOptions {
	element: Ref<TimelineElement>;
	mediaAsset: Ref<MediaAsset | null>;
	zoomLevel: Ref<number>;
	elementWidth: Ref<number>;
	canvasRef: Ref<HTMLCanvasElement | null>;
	/** Current playhead time in seconds (global timeline time) */
	currentTime: Ref<number>;
}

/**
 * Normalize peaks for display - scales quiet audio to be visible.
 * Matches the exact logic from TimelineVideoTrack.vue.
 */
function normalizePeaks(peaks: { min: number; max: number }[]): { min: number; max: number }[] {
	if (peaks.length === 0) return peaks;

	let maxAmplitude = 0;
	for (const peak of peaks) {
		const peakMax = Math.max(Math.abs(peak.min), Math.abs(peak.max));
		if (peakMax > maxAmplitude) {
			maxAmplitude = peakMax;
		}
	}

	// If waveform is already loud enough (>50% of full scale), don't normalize
	if (maxAmplitude >= 0.5 || maxAmplitude === 0) {
		return peaks;
	}

	// Calculate scale factor to bring max amplitude to ~85% of full scale
	const targetAmplitude = 0.85;
	const scaleFactor = targetAmplitude / maxAmplitude;

	// Cap at 10x to avoid over-amplification of noise
	const maxScale = 10;
	const finalScale = Math.min(scaleFactor, maxScale);

	return peaks.map((peak) => ({
		min: peak.min * finalScale,
		max: peak.max * finalScale,
	}));
}

export function useAudioWaveform({
	element,
	mediaAsset,
	zoomLevel,
	elementWidth,
	canvasRef,
	currentTime,
}: UseAudioWaveformOptions) {
	const waveform = useWaveform();
	const isLoading = computed(() => waveform.isLoading.value);
	const isLoaded = computed(() => waveform.isLoaded.value);

	let resizeObserver: ResizeObserver | null = null;

	/**
	 * Resolve the audio file URL from the element + media asset.
	 * Audio upload → blob URL from MediaAsset.
	 * Audio library → sourceUrl directly.
	 * Video → media asset file (contains audio track).
	 */
	function resolveAudioUrl(): string | null {
		const el = element.value;

		// Video elements: audio comes from the video file itself
		if (el.type === "video") {
			const asset = mediaAsset.value;
			if (!asset || asset.type !== "video") return null;
			if (asset.filePath) return asset.filePath;
			if (asset.url) return asset.url;
			if (asset.file) return URL.createObjectURL(asset.file);
			return null;
		}

		// Audio elements
		if (el.type !== "audio") return null;

		const audioEl = el as AudioElement;

		if (audioEl.sourceType === "upload") {
			const asset = mediaAsset.value;
			if (!asset) return null;
			if (asset.filePath) return asset.filePath;
			if (asset.url) return asset.url;
			if (asset.file) return URL.createObjectURL(asset.file);
			return null;
		}

		if (audioEl.sourceType === "library") {
			return audioEl.sourceUrl || null;
		}

		return null;
	}

	/** Render waveform on canvas */
	async function renderWaveformOnCanvas(): Promise<void> {
		const canvas = canvasRef.value;
		if (!canvas || !isLoaded.value) return;

		const el = element.value;
		if (el.type !== "audio" && el.type !== "video") return;

		const duration = el.duration;
		if (!duration || duration <= 0) return;

		try {
			const rect = canvas.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) return;

			const audioUrl = resolveAudioUrl();
			if (!audioUrl) return;

			// Limit peak density like TimelineVideoTrack does
			const MAX_PEAKS = 10000;
			const requestedPeaks = Math.min(Math.floor(rect.width), MAX_PEAKS);

			// Both audio and video elements have trimStart
			const trimStart = el.trimStart || 0;
			const speed = el.type === "audio" ? ((el as AudioElement).speed || 1) : ((el as VideoElement).speed || 1);
			// Source duration = timeline duration * speed
			const sourceDuration = duration * speed;

			const peaks = await waveformService.getPeaksForRange(audioUrl, {
				startTime: trimStart,
				endTime: trimStart + sourceDuration,
				pixelWidth: requestedPeaks,
				gainMultiplier: 1.0,
			});

			if (!peaks || peaks.length === 0) return;

			const normalizedPeaks = normalizePeaks(peaks);

			// Calculate playhead ratio relative to this element
			// currentTime is global timeline time; element occupies [startTime, startTime + duration]
			const elStart = el.startTime;
			const elEnd = elStart + duration;
			const time = currentTime.value;

			let playheadCurrentTime: number;
			let playheadDuration: number;

			if (time < elStart) {
				// Playhead is before this element — nothing played
				playheadCurrentTime = 0;
				playheadDuration = duration;
			} else if (time > elEnd) {
				// Playhead is past this element — fully played
				playheadCurrentTime = duration;
				playheadDuration = duration;
			} else {
				// Playhead is within this element
				playheadCurrentTime = time - elStart;
				playheadDuration = duration;
			}

			renderWaveformWithPlayhead(
				canvas,
				normalizedPeaks,
				rect.width,
				rect.height,
				playheadCurrentTime,
				playheadDuration,
				{
					style: "bars",
					useGradientColors: true,
				},
			);
		} catch (error) {
			console.error("[useAudioWaveform] Error rendering waveform:", error);
		}
	}

	const throttledRender = createThrottledRenderer(renderWaveformOnCanvas);

	function setupResizeObserver(): void {
		const canvas = canvasRef.value;
		if (!canvas) return;

		resizeObserver = new ResizeObserver(() => {
			throttledRender();
		});
		resizeObserver.observe(canvas);
	}

	function cleanupResizeObserver(): void {
		if (resizeObserver) {
			resizeObserver.disconnect();
			resizeObserver = null;
		}
	}

	// Watch for canvas ref changes (e.g. when filmstrip loads and the v-else-if branch switches)
	watch(canvasRef, (newCanvas, oldCanvas) => {
		if (newCanvas !== oldCanvas) {
			cleanupResizeObserver();
			if (newCanvas) {
				setupResizeObserver();
				if (isLoaded.value) {
					nextTick(() => {
						throttledRender();
					});
				}
			}
		}
	});

	// Watch for audio source changes and load waveform data
	watch(
		[element, mediaAsset],
		async () => {
			const url = resolveAudioUrl();
			if (url) {
				await waveform.load(url);
			}
		},
		{ immediate: true },
	);

	// Re-render when waveform data loads, zoom changes, playhead moves, or element width changes
	watch(
		[isLoaded, zoomLevel, currentTime, elementWidth],
		([loaded]) => {
			if (loaded) {
				nextTick(() => {
					throttledRender();
				});
			}
		},
		{ immediate: true },
	);

	onMounted(() => {
		nextTick(() => {
			setupResizeObserver();
			const url = resolveAudioUrl();
			if (url) {
				waveform.load(url);
			}
		});
	});

	onUnmounted(() => {
		cleanupResizeObserver();
	});

	return {
		isLoading,
		isLoaded,
	};
}
