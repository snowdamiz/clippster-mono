/**
 * In-timeline volume keyframes on the waveform strip (handles only — no curve/fill
 * overlay so waveforms stay readable).
 *
 * Coordinate system:
 *   x  = offset (0–1) mapped to 0–elementWidthPx
 *   y  = volume (0–max boost) mapped to: top=max, middle-ish=unity, bottom=0
 *
 * Export parity: volume keyframes are already serialised and applied in
 * video_editor_export.rs via build_keyframe_expression → FFmpeg volume filter.
 * No Rust changes needed.
 */
import { computed, ref, type Ref } from "vue";
import { useKeyframes } from "../../useKeyframes";
import type { TimelineElement, TimelineTrack } from "../../../types/timeline";
import type { Keyframe, KeyframableProperty } from "../../../types/keyframes";
import { CLIP_GAIN_MAX } from "../../../lib/audio-volume-ui";

/** Volume range: 0 = silence, 1 = unity, CLIP_GAIN_MAX = max inspector boost */
const VOL_MAX = CLIP_GAIN_MAX;

/** Minimum element width below which the rubber-band is hidden. */
const MIN_WIDTH_PX = 30;

export function useVolumeEnvelope({
	elementRef,
	trackRef,
	elementWidthPx,
	placementProperty,
}: {
	elementRef: Ref<TimelineElement>;
	trackRef: Ref<TimelineTrack>;
	elementWidthPx: Ref<number>;
	/** When set, strip clicks only add volume keyframes if this is `volume`. */
	placementProperty?: Ref<KeyframableProperty>;
}) {
	const kf = useKeyframes({ trackRef, elementRef });

	const isDragging = ref(false);
	const draggingKeyframeId = ref<string | null>(null);
	/** True while pointer is over the volume strip (so we can hide the flat line until hover). */
	const stripHovered = ref(false);

	/** Sorted volume keyframes from the element. */
	const volumeKeyframes = computed((): Keyframe[] => {
		const tracks = elementRef.value.keyframes?.tracks;
		if (!tracks) return [];
		return [...(tracks.volume?.keyframes ?? [])].sort((a, b) => a.offset - b.offset);
	});

	/** Whether to show the rubber-band (needs audio capability). */
	const isVisible = computed(() => {
		const type = elementRef.value.type;
		if (type !== "audio" && type !== "video") return false;
		if (elementWidthPx.value < MIN_WIDTH_PX) return false;
		return true;
	});

	/** Keyframe handles — show when there are keyframes, while dragging, or on strip hover. */
	const showEnvelopeGraphics = computed(
		() =>
			volumeKeyframes.value.length > 0 || isDragging.value || stripHovered.value,
	);

	/** Convert volume value (0–VOL_MAX) to Y percentage (0% = top = max). */
	function volToYPct(vol: number): number {
		return (1 - Math.max(0, Math.min(VOL_MAX, vol)) / VOL_MAX) * 100;
	}

	/** Convert Y percentage back to volume. */
	function yPctToVol(yPct: number): number {
		return Math.max(0, Math.min(VOL_MAX, (1 - yPct / 100) * VOL_MAX));
	}

	/** Convert offset (0–1) to X px within the element. */
	function offsetToX(offset: number): number {
		return offset * elementWidthPx.value;
	}

	/** Convert X px to offset (0–1). */
	function xToOffset(x: number): number {
		return Math.max(0, Math.min(1, x / elementWidthPx.value));
	}

	/** Handle positions for each keyframe diamond. */
	const handles = computed(() =>
		volumeKeyframes.value.map((kf) => ({
			id: kf.id,
			x: offsetToX(kf.offset),
			y: volToYPct(kf.value),
			value: kf.value,
			offset: kf.offset,
		})),
	);

	// ── Pointer interaction ────────────────────────────────────────────────

	/**
	 * Pointer down on the envelope line or empty strip area:
	 *  - Click near an existing handle → drag it
	 *  - Click on empty → add a new keyframe
	 */
	function onStripPointerDown(
		event: PointerEvent,
		svgElement: SVGSVGElement,
		stripHeightPx: number,
	) {
		event.stopPropagation();
		stripHovered.value = true;

		if (placementProperty && placementProperty.value !== "volume") {
			return;
		}

		const rect = svgElement.getBoundingClientRect();
		const localX = event.clientX - rect.left;
		const localY = event.clientY - rect.top;
		const offset = xToOffset(localX);
		const vol = yPctToVol((localY / rect.height) * 100);

		// Check if clicking near an existing handle (within 8px)
		for (const h of handles.value) {
			const dx = Math.abs(h.x - localX);
			const dy = Math.abs((h.y / 100) * rect.height - localY);
			if (dx <= 8 && dy <= 8) {
				startDrag(event, h.id, svgElement, rect.height);
				return;
			}
		}

		// No existing handle nearby → add a new keyframe
		kf.addKeyframe("volume", offset, Math.max(0, Math.min(VOL_MAX, vol)));
	}

	function startDrag(
		event: PointerEvent,
		keyframeId: string,
		svgElement: SVGSVGElement,
		svgHeight: number,
	) {
		isDragging.value = true;
		draggingKeyframeId.value = keyframeId;

		const rect = svgElement.getBoundingClientRect();
		const currentSvgHeight = svgHeight || rect.height;

		function onMove(e: PointerEvent) {
			if (!draggingKeyframeId.value) return;
			const localX = e.clientX - rect.left;
			const localY = e.clientY - rect.top;
			const newOffset = xToOffset(localX);
			const newVol = yPctToVol((localY / currentSvgHeight) * 100);
			kf.updateKeyframe("volume", draggingKeyframeId.value, {
				offset: newOffset,
				value: Math.max(0, Math.min(VOL_MAX, newVol)),
			});
		}

		function onUp() {
			isDragging.value = false;
			draggingKeyframeId.value = null;
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		}

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	}

	function onHandleDblClick(event: PointerEvent, keyframeId: string) {
		event.stopPropagation();
		kf.removeKeyframe("volume", keyframeId);
	}

	function onStripPointerEnter() {
		stripHovered.value = true;
	}

	function onStripPointerLeave() {
		stripHovered.value = false;
	}

	return {
		isVisible,
		volumeKeyframes,
		handles,
		isDragging,
		showEnvelopeGraphics,
		onStripPointerEnter,
		onStripPointerLeave,
		onStripPointerDown,
		onHandleDblClick,
		volToYPct,
	};
}
