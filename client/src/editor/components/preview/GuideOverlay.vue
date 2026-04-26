<script setup lang="ts">
import { ref, computed } from "vue";
import { useGuideLines, type GuideAxis } from "../../composables/preview/useGuideLines";

const props = defineProps<{
	canvasRef: HTMLCanvasElement | null;
	canvasWidth: number;
	canvasHeight: number;
}>();

const {
	allGuides,
	guidesVisible,
	showThirds,
	showSafeMargins,
	addGuide,
	removeGuide,
	updateGuide,
} = useGuideLines();

// Track which guide is being dragged
const draggingId = ref<string | null>(null);
const draggingAxis = ref<GuideAxis | null>(null);

/** Map canvas pixel coords → normalised 0–1 position for the given axis. */
function pixelToNorm(axis: GuideAxis, px: number): number {
	const canvas = props.canvasRef;
	if (!canvas) return 0;
	const rect = canvas.getBoundingClientRect();
	if (axis === "x") return Math.max(0, Math.min(1, (px - rect.left) / rect.width));
	return Math.max(0, Math.min(1, (px - rect.top) / rect.height));
}

/** Canvas screen geometry in overlay-relative px. */
const canvasScreenRect = computed(() => {
	const canvas = props.canvasRef;
	if (!canvas) return { left: 0, top: 0, width: 0, height: 0 };
	const rect = canvas.getBoundingClientRect();
	const overlayRect = canvas.parentElement?.getBoundingClientRect() ?? rect;
	return {
		left: rect.left - overlayRect.left,
		top: rect.top - overlayRect.top,
		width: rect.width,
		height: rect.height,
	};
});

/** Convert normalised guide position to screen px (relative to overlay). */
function guideToScreenPx(axis: GuideAxis, position: number): number {
	const r = canvasScreenRect.value;
	return axis === "x" ? r.left + position * r.width : r.top + position * r.height;
}

function guideColor(mode: string): string {
	if (mode === "thirds") return "#a78bfa"; // violet
	if (mode === "safe") return "#f59e0b";   // amber
	return "#22d3ee";                         // cyan for custom
}

// ── Drag handling ──────────────────────────────────────────────────────────

function onGuideDragStart(event: MouseEvent, id: string, axis: GuideAxis) {
	event.preventDefault();
	event.stopPropagation();
	draggingId.value = id;
	draggingAxis.value = axis;

	function onMove(e: MouseEvent) {
		if (!draggingId.value || !draggingAxis.value) return;
		updateGuide(draggingId.value, pixelToNorm(draggingAxis.value, draggingAxis.value === "x" ? e.clientX : e.clientY));
	}

	function onUp() {
		draggingId.value = null;
		draggingAxis.value = null;
		window.removeEventListener("mousemove", onMove);
		window.removeEventListener("mouseup", onUp);
	}

	window.addEventListener("mousemove", onMove);
	window.addEventListener("mouseup", onUp);
}

function onGuideDblClick(event: MouseEvent, id: string) {
	event.preventDefault();
	event.stopPropagation();
	removeGuide(id);
}

// ── Click on overlay border to add custom guide ────────────────────────────

function onOverlayClick(event: MouseEvent) {
	if (!props.canvasRef) return;
	const rect = props.canvasRef.getBoundingClientRect();
	const EDGE_ZONE = 16; // px — clicking near the left/top edge of the canvas area

	const relX = event.clientX - rect.left;
	const relY = event.clientY - rect.top;

	// Click on left edge → add vertical (x) guide
	if (relX >= -EDGE_ZONE && relX <= EDGE_ZONE) {
		addGuide("x", pixelToNorm("x", event.clientX));
		return;
	}
	// Click on top edge → add horizontal (y) guide
	if (relY >= -EDGE_ZONE && relY <= EDGE_ZONE) {
		addGuide("y", pixelToNorm("y", event.clientY));
	}
}
</script>

<template>
	<div
		v-if="guidesVisible"
		class="pointer-events-none absolute inset-0 overflow-hidden"
		@click.capture="onOverlayClick"
	>
		<svg class="absolute inset-0 size-full overflow-visible">
			<g v-for="guide in allGuides" :key="guide.id">
				<!-- Vertical guide (x axis) -->
				<line
					v-if="guide.axis === 'x'"
					:x1="guideToScreenPx('x', guide.position)"
					:y1="canvasScreenRect.top"
					:x2="guideToScreenPx('x', guide.position)"
					:y2="canvasScreenRect.top + canvasScreenRect.height"
					:stroke="guideColor(guide.mode)"
					stroke-width="1"
					opacity="0.75"
					stroke-dasharray="4 3"
				/>
				<!-- Horizontal guide (y axis) -->
				<line
					v-else
					:x1="canvasScreenRect.left"
					:y1="guideToScreenPx('y', guide.position)"
					:x2="canvasScreenRect.left + canvasScreenRect.width"
					:y2="guideToScreenPx('y', guide.position)"
					:stroke="guideColor(guide.mode)"
					stroke-width="1"
					opacity="0.75"
					stroke-dasharray="4 3"
				/>

				<!-- Draggable hit-area (wider than the visual line) — only for custom guides -->
				<line
					v-if="guide.mode === 'custom'"
					class="pointer-events-auto"
					:x1="guide.axis === 'x' ? guideToScreenPx('x', guide.position) : canvasScreenRect.left"
					:y1="guide.axis === 'x' ? canvasScreenRect.top : guideToScreenPx('y', guide.position)"
					:x2="guide.axis === 'x' ? guideToScreenPx('x', guide.position) : canvasScreenRect.left + canvasScreenRect.width"
					:y2="guide.axis === 'x' ? canvasScreenRect.top + canvasScreenRect.height : guideToScreenPx('y', guide.position)"
					stroke="transparent"
					stroke-width="10"
					:style="{ cursor: guide.axis === 'x' ? 'ew-resize' : 'ns-resize' }"
					@mousedown.stop="onGuideDragStart($event, guide.id, guide.axis)"
					@dblclick.stop="onGuideDblClick($event, guide.id)"
				/>
			</g>
		</svg>

		<!-- Guide legend (top-right corner) — showing only when modes are active -->
		<div
			v-if="showThirds || showSafeMargins"
			class="pointer-events-none absolute right-2 top-2 flex flex-col gap-0.5 rounded bg-black/60 px-2 py-1.5"
		>
			<div v-if="showThirds" class="flex items-center gap-1.5">
				<span class="inline-block h-0.5 w-4 bg-violet-400" />
				<span class="text-[9px] text-zinc-400">Thirds</span>
			</div>
			<div v-if="showSafeMargins" class="flex items-center gap-1.5">
				<span class="inline-block h-0.5 w-4 bg-amber-400" />
				<span class="text-[9px] text-zinc-400">Safe margins</span>
			</div>
		</div>
	</div>
</template>
