/**
 * Composable for the in-timeline volume rubber-band envelope.
 *
 * Renders an interactive SVG overlay on the audio waveform strip that lets
 * users add/drag/remove volume keyframes directly on the clip — similar to
 * CapCut and OpenCut's in-timeline volume editing. The line/fill/handles stay
 * hidden until the strip is hovered or the user is dragging (automation still
 * applies on playback/export when not visible).
 *
 * Coordinate system:
 *   x  = offset (0–1) mapped to 0–elementWidthPx
 *   y  = volume (0–2) mapped to: top=2, middle=1, bottom=0
 *        y% = (1 - vol/2) * 100
 *
 * Export parity: volume keyframes are already serialised and applied in
 * video_editor_export.rs via build_keyframe_expression → FFmpeg volume filter.
 * No Rust changes needed.
 */
import { computed, ref, type Ref } from "vue";
import { useKeyframes } from "../../useKeyframes";
import type { TimelineElement, TimelineTrack } from "../../../types/timeline";
import type { Keyframe } from "../../../types/keyframes";

/** Volume range: 0 = silence, 1 = unity, 2 = +6 dB boost */
const VOL_MAX = 2;

/** Minimum element width below which the rubber-band is hidden. */
const MIN_WIDTH_PX = 30;

export function useVolumeEnvelope({
	elementRef,
	trackRef,
	elementWidthPx,
}: {
	elementRef: Ref<TimelineElement>;
	trackRef: Ref<TimelineTrack>;
	elementWidthPx: Ref<number>;
}) {
	const kf = useKeyframes({ trackRef, elementRef });

	const isDragging = ref(false);
	const draggingKeyframeId = ref<string | null>(null);
	/** True while pointer is over the volume strip (so we can show rubber-band before any keyframes). */
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

	/** Line/fill/handles: only while hovering the strip or dragging a handle. */
	const showEnvelopeChrome = computed(() => isDragging.value || stripHovered.value);

	function onStripPointerEnter() {
		stripHovered.value = true;
	}

	function onStripPointerLeave() {
		if (!isDragging.value) stripHovered.value = false;
	}

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

	/**
	 * SVG polyline points string for the envelope path.
	 * Always starts at (0, baseY) and ends at (width, baseY) so the line
	 * spans the full clip even without keyframes.
	 */
	const envelopePath = computed((): string => {
		const w = elementWidthPx.value;
		const kfs = volumeKeyframes.value;
		const baseVol = (elementRef.value as any).volume ?? 1;
		const baseY = volToYPct(baseVol);

		if (kfs.length === 0) {
			return `M 0 ${baseY} L ${w} ${baseY}`;
		}

		const points: string[] = [];
		// Leading segment from clip start to first keyframe
		const first = kfs[0];
		const firstX = offsetToX(first.offset);
		const firstY = volToYPct(first.value);
		points.push(`M 0 ${firstY}`);
		points.push(`L ${firstX} ${firstY}`);

		// Segments between keyframes
		for (let i = 0; i < kfs.length - 1; i++) {
			const cur = kfs[i];
			const next = kfs[i + 1];
			const curX = offsetToX(cur.offset);
			const nextX = offsetToX(next.offset);
			const curY = volToYPct(cur.value);
			const nextY = volToYPct(next.value);
			// Use linear for now (curves are complex in SVG with multiple properties)
			points.push(`L ${curX} ${curY}`);
			points.push(`L ${nextX} ${nextY}`);
		}

		// Trailing segment from last keyframe to clip end
		const last = kfs[kfs.length - 1];
		const lastX = offsetToX(last.offset);
		const lastY = volToYPct(last.value);
		points.push(`L ${lastX} ${lastY}`);
		points.push(`L ${w} ${lastY}`);

		return points.join(" ");
	});

	/** Filled area under the envelope path (for visual fill). */
	const envelopeFillPath = computed((): string => {
		const w = elementWidthPx.value;
		return `${envelopePath.value} L ${w} 100 L 0 100 Z`;
	});

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
		stripHovered.value = true;
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

	return {
		isVisible,
		showEnvelopeChrome,
		volumeKeyframes,
		envelopePath,
		envelopeFillPath,
		handles,
		isDragging,
		onStripPointerEnter,
		onStripPointerLeave,
		onStripPointerDown,
		onHandleDblClick,
		volToYPct,
	};
}
