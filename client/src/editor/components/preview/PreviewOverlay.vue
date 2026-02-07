<script setup lang="ts">
import { computed, ref, type Ref } from "vue";
import {
	usePreviewInteraction,
	type ElementBounds,
	type HandlePosition,
} from "../../composables/preview/usePreviewInteraction";
import { useEditorUIState } from "../../composables/useEditorUIState";
import CropOverlay from "./CropOverlay.vue";

const props = defineProps<{
	canvasRef: HTMLCanvasElement | null;
	canvasWidth: number;
	canvasHeight: number;
}>();

const canvasRefRef = computed(() => props.canvasRef) as unknown as Ref<HTMLCanvasElement | null>;
const canvasWidthRef = computed(() => props.canvasWidth);
const canvasHeightRef = computed(() => props.canvasHeight);

const {
	visibleElements,
	selectedBounds,
	dragState,
	hoveredElementId,
	handleCanvasMouseDown,
	handleHandleMouseDown,
	handleCanvasMouseMove,
} = usePreviewInteraction({
	canvasRef: canvasRefRef,
	canvasWidth: canvasWidthRef,
	canvasHeight: canvasHeightRef,
});

const { isCropMode } = useEditorUIState();

const overlayRef = ref<HTMLDivElement | null>(null);

const HANDLE_SIZE = 10;
const ROTATE_HANDLE_OFFSET = 30;

/**
 * Convert element bounds from canvas coords to screen-relative coords
 * (relative to the overlay container which is positioned over the canvas).
 */
function boundsToScreen(bounds: ElementBounds) {
	const canvas = props.canvasRef;
	if (!canvas) return null;

	const rect = canvas.getBoundingClientRect();
	const scaleX = rect.width / props.canvasWidth;
	const scaleY = rect.height / props.canvasHeight;

	return {
		cx: bounds.cx * scaleX,
		cy: bounds.cy * scaleY,
		width: bounds.width * scaleX,
		height: bounds.height * scaleY,
		rotation: bounds.rotation,
	};
}

const selectedScreenBounds = computed(() => {
	if (!selectedBounds.value) return null;
	return boundsToScreen(selectedBounds.value);
});

const hoveredScreenBounds = computed(() => {
	if (!hoveredElementId.value) return null;
	// Don't show hover outline if it's the selected element
	if (selectedBounds.value && hoveredElementId.value === selectedBounds.value.elementId) return null;
	const hovered = visibleElements.value.find((b) => b.elementId === hoveredElementId.value);
	if (!hovered) return null;
	return boundsToScreen(hovered);
});

const handles: HandlePosition[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

function getHandleOffset(handle: HandlePosition, width: number, height: number) {
	const halfW = width / 2;
	const halfH = height / 2;
	switch (handle) {
		case "top-left":
			return { x: -halfW, y: -halfH };
		case "top-right":
			return { x: halfW, y: -halfH };
		case "bottom-left":
			return { x: -halfW, y: halfH };
		case "bottom-right":
			return { x: halfW, y: halfH };
		default:
			return { x: 0, y: 0 };
	}
}

function getHandleCursor(handle: HandlePosition): string {
	switch (handle) {
		case "top-left":
		case "bottom-right":
			return "nwse-resize";
		case "top-right":
		case "bottom-left":
			return "nesw-resize";
		default:
			return "pointer";
	}
}

function onHandleMouseDown(event: MouseEvent, handle: HandlePosition) {
	if (!selectedBounds.value) return;
	handleHandleMouseDown(event, handle, selectedBounds.value);
}

function onOverlayMouseDown(event: MouseEvent) {
	if (isCropMode.value) return;
	handleCanvasMouseDown(event);
}

function onOverlayMouseMove(event: MouseEvent) {
	if (isCropMode.value) return;
	handleCanvasMouseMove(event);
}

const cursorStyle = computed(() => {
	if (dragState.value) {
		if (dragState.value.type === "move") return "grabbing";
		if (dragState.value.type === "rotate") return "crosshair";
		return "nwse-resize";
	}
	if (hoveredElementId.value) return "pointer";
	return "default";
});
</script>

<template>
	<div
		ref="overlayRef"
		class="pointer-events-auto absolute inset-0"
		:style="{ cursor: cursorStyle }"
		@mousedown="onOverlayMouseDown"
		@mousemove="onOverlayMouseMove"
	>
		<!-- Hover outline (non-selected elements) -->
		<svg
			v-if="hoveredScreenBounds"
			class="pointer-events-none absolute inset-0 size-full overflow-visible"
		>
			<g
				:transform="`translate(${hoveredScreenBounds.cx}, ${hoveredScreenBounds.cy}) rotate(${hoveredScreenBounds.rotation})`"
			>
				<rect
					:x="-hoveredScreenBounds.width / 2"
					:y="-hoveredScreenBounds.height / 2"
					:width="hoveredScreenBounds.width"
					:height="hoveredScreenBounds.height"
					fill="none"
					stroke="rgba(255,255,255,0.4)"
					stroke-width="1"
					stroke-dasharray="4 3"
				/>
			</g>
		</svg>

		<!-- Crop overlay (shown in crop mode) -->
		<CropOverlay
			:canvas-ref="canvasRef"
			:canvas-width="canvasWidth"
			:canvas-height="canvasHeight"
		/>

		<!-- Selection bounding box + handles (hidden in crop mode) -->
		<svg
			v-if="selectedScreenBounds && !isCropMode"
			class="pointer-events-none absolute inset-0 size-full overflow-visible"
		>
			<g
				:transform="`translate(${selectedScreenBounds.cx}, ${selectedScreenBounds.cy}) rotate(${selectedScreenBounds.rotation})`"
			>
				<!-- Bounding box -->
				<rect
					:x="-selectedScreenBounds.width / 2"
					:y="-selectedScreenBounds.height / 2"
					:width="selectedScreenBounds.width"
					:height="selectedScreenBounds.height"
					fill="none"
					stroke="#3b82f6"
					stroke-width="2"
					stroke-dasharray="none"
				/>

				<!-- Resize handles -->
				<rect
					v-for="handle in handles"
					:key="handle"
					class="pointer-events-auto"
					:x="getHandleOffset(handle, selectedScreenBounds.width, selectedScreenBounds.height).x - HANDLE_SIZE / 2"
					:y="getHandleOffset(handle, selectedScreenBounds.width, selectedScreenBounds.height).y - HANDLE_SIZE / 2"
					:width="HANDLE_SIZE"
					:height="HANDLE_SIZE"
					rx="2"
					fill="white"
					stroke="#3b82f6"
					stroke-width="1.5"
					:style="{ cursor: getHandleCursor(handle) }"
					@mousedown.stop="onHandleMouseDown($event, handle)"
				/>

				<!-- Rotation handle line -->
				<line
					:x1="0"
					:y1="-selectedScreenBounds.height / 2"
					:x2="0"
					:y2="-selectedScreenBounds.height / 2 - ROTATE_HANDLE_OFFSET"
					stroke="#3b82f6"
					stroke-width="1.5"
				/>

				<!-- Rotation handle circle -->
				<circle
					class="pointer-events-auto"
					:cx="0"
					:cy="-selectedScreenBounds.height / 2 - ROTATE_HANDLE_OFFSET"
					r="6"
					fill="white"
					stroke="#3b82f6"
					stroke-width="1.5"
					style="cursor: crosshair"
					@mousedown.stop="onHandleMouseDown($event, 'rotate')"
				/>
			</g>
		</svg>
	</div>
</template>
