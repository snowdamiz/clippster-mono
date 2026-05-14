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
import {
	renderWaveformWithPlayhead,
	createThrottledRenderer,
	WAVEFORM_MAX_BACKING_EDGE,
} from "@/utils/waveformRenderer";
import type { TimelineElement, AudioElement, VideoElement } from "../../types/timeline";
import type { MediaAsset } from "../../types/assets";
import { clipVolumeDraftVersion, getClipVolumeDraft } from "../../lib/clip-volume-draft";

interface UseAudioWaveformOptions {
	element: Ref<TimelineElement>;
	mediaAsset: Ref<MediaAsset | null>;
	zoomLevel: Ref<number>;
	elementWidth: Ref<number>;
	canvasRef: Ref<HTMLCanvasElement | null>;
	/** Current playhead time in seconds (global timeline time) */
	currentTime: Ref<number>;
}

function visualVolumeScale(volume: number): number {
	if (!Number.isFinite(volume) || volume <= 0) return 0;
	return Math.min(1.6, Math.sqrt(volume));
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

/** Slightly more lift than normalizePeaks so timeline strips stay readable on short tracks. */
function normalizePeaksForTimeline(peaks: { min: number; max: number }[]): { min: number; max: number }[] {
	if (peaks.length === 0) return peaks;

	let maxAmplitude = 0;
	for (const peak of peaks) {
		const peakMax = Math.max(Math.abs(peak.min), Math.abs(peak.max));
		if (peakMax > maxAmplitude) maxAmplitude = peakMax;
	}

	if (maxAmplitude >= 0.62 || maxAmplitude === 0) {
		return peaks;
	}

	const targetAmplitude = 0.92;
	const scaleFactor = targetAmplitude / maxAmplitude;
	const maxScale = 12;
	const finalScale = Math.min(scaleFactor, maxScale);

	return peaks.map((peak) => ({
		min: peak.min * finalScale,
		max: peak.max * finalScale,
	}));
}

/** Ensure sub-pixel peak density never exceeds ~1 column per CSS px (avoids mush when zoomed in). */
function timelinePeakCount(cssWidth: number): number {
	const w = Math.ceil(cssWidth);
	return Math.max(300, Math.min(w, WAVEFORM_MAX_BACKING_EDGE));
}

/**
 * Gentle lift for thin timeline lanes — preserves relative level between samples so we do not
 * paint thousands of identical magnitudes (that reads as a solid horizontal line on the baseline).
 * True silence stays at zero.
 */
function liftPeaksForThinLane(
	peaks: { min: number; max: number }[],
	cssHeight: number,
): { min: number; max: number }[] {
	const targetFloor = cssHeight < 30 ? 0.055 : cssHeight < 44 ? 0.04 : 0.028;
	return peaks.map((p) => {
		const mag = Math.max(Math.abs(p.min), Math.abs(p.max));
		if (mag <= 1e-8) return { min: 0, max: 0 };
		if (mag >= targetFloor) return { min: p.min, max: p.max };
		const scale = Math.min(2.4, targetFloor / mag);
		return {
			min: Math.max(-1, Math.min(1, p.min * scale)),
			max: Math.max(-1, Math.min(1, p.max * scale)),
		};
	});
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

			// ~1 peak per CSS px max. Using width×DPR here makes step < 1 when zoomed in, so bars stack
			// into a hairline; backing-store DPR is handled inside renderWaveform.
			const requestedPeaks = timelinePeakCount(rect.width);

			// Both audio and video elements have trimStart
			const trimStart = el.trimStart || 0;
			const speed = el.type === "audio" ? ((el as AudioElement).speed || 1) : ((el as VideoElement).speed || 1);
			// Source duration = timeline duration * speed
			const sourceDuration = duration * speed;

			// Use element volume only for *visual* scaling. Draft volume lets the waveform
			// follow the inspector slider live without committing timeline/audio reload work.
			const draftVolume = getClipVolumeDraft(el.id);
			const volume = draftVolume ?? (el.type === "audio" ? ((el as AudioElement).volume ?? 1) : ((el as VideoElement).volume ?? 1));

			const peaks = await waveformService.getPeaksForRange(audioUrl, {
				startTime: trimStart,
				endTime: trimStart + sourceDuration,
				pixelWidth: requestedPeaks,
				gainMultiplier: 1,
			});

			if (!peaks || peaks.length === 0) return;

			const shaped = normalizePeaksForTimeline(normalizePeaks(peaks));
			const vScale = visualVolumeScale(volume);
			let normalizedPeaks = shaped.map((p) => ({
				min: p.min * vScale,
				max: p.max * vScale,
			}));

			// Apply fade-in/fade-out tapering so waveform bars visually shrink toward zero
			const fadeIn = el.fadeIn ?? 0;
			const fadeOut = el.fadeOut ?? 0;
			if ((fadeIn > 0 || fadeOut > 0) && normalizedPeaks.length > 0) {
				const fadeInFraction = fadeIn / duration;
				const fadeOutFraction = fadeOut / duration;
				normalizedPeaks = normalizedPeaks.map((peak, i) => {
					const progress = i / normalizedPeaks.length;
					let multiplier = 1;
					if (fadeInFraction > 0 && progress < fadeInFraction) {
						multiplier = progress / fadeInFraction;
					}
					if (fadeOutFraction > 0 && progress > (1 - fadeOutFraction)) {
						multiplier = Math.min(multiplier, (1 - progress) / fadeOutFraction);
					}
					return { min: peak.min * multiplier, max: peak.max * multiplier };
				});
			}

			normalizedPeaks = liftPeaksForThinLane(normalizedPeaks, rect.height);

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
					amplitude: 1,
					// Avoid Math.max(1, …) per column — that draws a full-width cyan hairline on the baseline.
					minBarHeight: 0,
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

	// Re-trigger waveform load when filePath is populated (async save completing)
	watch(
		() => mediaAsset.value?.filePath,
		async (newPath, oldPath) => {
			if (newPath && newPath !== oldPath) {
				await waveform.load(newPath);
			}
		},
	);

	// Re-render when waveform data loads, zoom changes, playhead moves, element width changes, volume or fade changes
	watch(
		[isLoaded, zoomLevel, currentTime, elementWidth, () => {
			const el = element.value;
			const draftVolume = getClipVolumeDraft(el.id);
			if (draftVolume != null) return draftVolume;
			if (el.type === "audio") return (el as AudioElement).volume;
			if (el.type === "video") return (el as VideoElement).volume;
			return 1;
		}, clipVolumeDraftVersion, () => element.value.fadeIn ?? 0, () => element.value.fadeOut ?? 0],
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
