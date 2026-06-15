<script setup lang="ts">
import { computed, onUnmounted, ref, type Ref } from "vue";
import {
	usePreviewInteraction,
	type ElementBounds,
	type HandlePosition,
} from "../../composables/preview/usePreviewInteraction";
import { useEditorUIState } from "../../composables/useEditorUIState";
import { useEditor } from "../../composables/useEditor";
import type { ManualSourceFramingPayload } from "@/types";
import type { MaskShape, TimelineTrack } from "../../types/timeline";
import { SetCanvasSourceFramingCommand } from "../../lib/commands/project/set-canvas-source-framing";
import { getPlateRectLogical } from "../../renderer/canvas-169-framing-draw";
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
	selectedElementIdSet,
	selectedVisibleBoundsList,
	selectedBounds,
	dragState,
	hoveredElementId,
	showCenterGuideX,
	showCenterGuideY,
	handleCanvasMouseDown,
	handleHandleMouseDown,
	handleCanvasMouseMove,
} = usePreviewInteraction({
	canvasRef: canvasRefRef,
	canvasWidth: canvasWidthRef,
	canvasHeight: canvasHeightRef,
});

const { isCropMode, enterCropMode, maskEditMode } = useEditorUIState();

const overlayRef = ref<HTMLDivElement | null>(null);

function getCanvasLocalMetrics() {
	const canvas = props.canvasRef;
	if (!canvas) return null;

	const canvasRect = canvas.getBoundingClientRect();
	const overlayRect = overlayRef.value?.getBoundingClientRect();
	const localWidth = canvas.clientWidth || canvas.offsetWidth || canvasRect.width;
	const localHeight = canvas.clientHeight || canvas.offsetHeight || canvasRect.height;
	const screenScaleX = localWidth > 0 ? canvasRect.width / localWidth : 1;
	const screenScaleY = localHeight > 0 ? canvasRect.height / localHeight : 1;

	return {
		left: overlayRect ? (canvasRect.left - overlayRect.left) / screenScaleX : 0,
		top: overlayRect ? (canvasRect.top - overlayRect.top) / screenScaleY : 0,
		width: localWidth,
		height: localHeight,
		scaleX: localWidth / props.canvasWidth,
		scaleY: localHeight / props.canvasHeight,
	};
}

// Canvas center and size in screen (overlay) coordinates for guide lines.
// Reads canvasWidth/canvasHeight props directly so Vue recomputes on aspect ratio change.
const canvasScreenCenter = computed(() => {
	const metrics = getCanvasLocalMetrics();
	if (!metrics) return { x: 0, y: 0 };
	return {
		x: metrics.left + (props.canvasWidth / 2) * metrics.scaleX,
		y: metrics.top + (props.canvasHeight / 2) * metrics.scaleY,
	};
});

const canvasScreenSize = computed(() => {
	const metrics = getCanvasLocalMetrics();
	if (!metrics) return { left: 0, top: 0, w: 0, h: 0 };
	return {
		left: metrics.left,
		top: metrics.top,
		w: metrics.width,
		h: metrics.height,
	};
});

const HANDLE_SIZE = 10;
const ROTATE_HANDLE_OFFSET = 30;

/**
 * Convert element bounds from canvas coords to screen-relative coords
 * (relative to the overlay container which is positioned over the canvas).
 */
function boundsToScreen(bounds: ElementBounds) {
	const metrics = getCanvasLocalMetrics();
	if (!metrics) return null;

	return {
		cx: metrics.left + bounds.cx * metrics.scaleX,
		cy: metrics.top + bounds.cy * metrics.scaleY,
		width: bounds.width * metrics.scaleX,
		height: bounds.height * metrics.scaleY,
		rotation: bounds.rotation,
	};
}

const selectedScreenBounds = computed(() => {
	if (!selectedBounds.value) return null;
	return boundsToScreen(selectedBounds.value);
});

/** Screen-space bounds for every selected visible element (multi-select outlines). */
const selectedVisibleScreenBoundsList = computed(() => {
	const out: { elementId: string; screen: NonNullable<ReturnType<typeof boundsToScreen>> }[] = [];
	for (const b of selectedVisibleBoundsList.value) {
		const s = boundsToScreen(b);
		if (s) out.push({ elementId: b.elementId, screen: s });
	}
	return out;
});

const hoveredScreenBounds = computed(() => {
	if (!hoveredElementId.value) return null;
	// Don't show hover outline on any currently selected element
	if (selectedElementIdSet.value.has(hoveredElementId.value)) return null;
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

const { editor: editorCore, version: editorReactiveVersion } = useEditor({
	subscribe: {
		playback: false,
		selection: false,
		timeline: true,
		scenes: false,
		project: true,
		media: false,
	},
});
const maskEditSnapshot = ref<{
	trackId: string;
	elementId: string;
	initialMasks: MaskShape[];
} | null>(null);
const maskDragState = ref<{
	mode: "move" | "resize" | "rotate" | "point";
	maskId: string;
	startClientX: number;
	startClientY: number;
	startX: number;
	startY: number;
	startWidth?: number;
	startHeight?: number;
	startRotation?: number;
	handle?: "tl" | "tr" | "bl" | "br";
	pointIndex?: number;
} | null>(null);

const PLATE_DRAG_SNAP_PX = 6;

const activeCanvasSourceFraming = computed(() => {
	void editorReactiveVersion.value;
	const s = editorCore.project.getActiveOrNull()?.settings?.canvasSourceFraming;
	if (!s || s.mode === "none") return null;
	return s;
});

const plateScreenRect = computed(() => {
	void editorReactiveVersion.value;
	const f = activeCanvasSourceFraming.value;
	if (!f) return null;
	const metrics = getCanvasLocalMetrics();
	if (!metrics) return null;
	const logical = getPlateRectLogical(props.canvasWidth, props.canvasHeight, f);
	if (!logical) return null;
	return {
		left: metrics.left + logical.left * metrics.scaleX,
		top: metrics.top + logical.top * metrics.scaleY,
		width: logical.width * metrics.scaleX,
		height: logical.height * metrics.scaleY,
	};
});

const plateChromeBorderClass = computed(() =>
	activeCanvasSourceFraming.value?.mode === "use16x9" ? "border-cyan-400" : "border-purple-500",
);

const plateHandleClass = computed(() =>
	activeCanvasSourceFraming.value?.mode === "use16x9" ? "bg-cyan-500" : "bg-purple-500",
);

const shouldShowPlateChrome = computed(() => {
	if (isCropMode.value || !activeCanvasSourceFraming.value) return false;
	const selectedType = selectedBounds.value?.elementType;
	return selectedType === "video" || selectedType === "image";
});

const plateDragState = ref<{
	type: "move" | "resize";
	startClientX: number;
	startClientY: number;
	startNormX: number;
	startNormY: number;
	startScale: number;
	corner?: "nw" | "ne" | "sw" | "se";
} | null>(null);

const plateFramingUndoSnapshot = ref<ManualSourceFramingPayload | null>(null);

function persistPlateFramingDuringDrag(patch: Partial<ManualSourceFramingPayload>) {
	const base = editorCore.project.getActiveOrNull()?.settings?.canvasSourceFraming;
	if (!base || base.mode === "none") return;
	void editorCore.project.updateSettings({
		settings: { canvasSourceFraming: { ...base, ...patch } },
		pushHistory: false,
	});
}

function onPlateMouseMove(e: MouseEvent) {
	const d = plateDragState.value;
	if (!d) return;
	const metrics = getCanvasLocalMetrics();
	if (!metrics) return;

	if (d.type === "move") {
		const dxPx = e.clientX - d.startClientX;
		const dyPx = e.clientY - d.startClientY;
		const dCanvasX = dxPx / metrics.scaleX;
		const dCanvasY = dyPx / metrics.scaleY;
		let newX = d.startNormX + dCanvasX / props.canvasWidth;
		let newY = d.startNormY + dCanvasY / props.canvasHeight;
		if (Math.abs(newX * props.canvasWidth) < PLATE_DRAG_SNAP_PX) newX = 0;
		if (Math.abs(newY * props.canvasHeight) < PLATE_DRAG_SNAP_PX) newY = 0;
		persistPlateFramingDuringDrag({ x: newX, y: newY });
		return;
	}

	const deltaX = e.clientX - d.startClientX;
	let scaleDelta = 0;
	if (d.corner === "se" || d.corner === "ne") scaleDelta = deltaX / 200;
	else scaleDelta = -deltaX / 200;
	const scale = Math.max(0.5, Math.min(5, d.startScale + scaleDelta));
	persistPlateFramingDuringDrag({ scale });
}

function endPlateDrag() {
	document.removeEventListener("mousemove", onPlateMouseMove);
	document.removeEventListener("mouseup", onPlateMouseUp);
	editorCore.setInteractiveDrag(false);
	const snap = plateFramingUndoSnapshot.value;
	plateDragState.value = null;
	plateFramingUndoSnapshot.value = null;
	if (!snap) return;
	const cur = editorCore.project.getActiveOrNull()?.settings?.canvasSourceFraming;
	if (!cur || cur.mode === "none") return;
	if (JSON.stringify(snap) === JSON.stringify(cur)) return;
	void editorCore.command.execute({
		command: new SetCanvasSourceFramingCommand(snap, { ...cur }),
	});
}

function onPlateMouseUp() {
	endPlateDrag();
}

function onPlateMouseDown(e: MouseEvent) {
	if (isCropMode.value) return;
	const f = activeCanvasSourceFraming.value;
	if (!f) return;
	e.preventDefault();
	e.stopPropagation();
	plateFramingUndoSnapshot.value = { ...f };
	plateDragState.value = {
		type: "move",
		startClientX: e.clientX,
		startClientY: e.clientY,
		startNormX: f.x,
		startNormY: f.y,
		startScale: f.scale,
	};
	editorCore.setInteractiveDrag(true);
	document.addEventListener("mousemove", onPlateMouseMove);
	document.addEventListener("mouseup", onPlateMouseUp);
}

function onPlateCornerMouseDown(e: MouseEvent, corner: "nw" | "ne" | "sw" | "se") {
	if (isCropMode.value) return;
	const f = activeCanvasSourceFraming.value;
	if (!f) return;
	e.preventDefault();
	e.stopPropagation();
	plateFramingUndoSnapshot.value = { ...f };
	plateDragState.value = {
		type: "resize",
		startClientX: e.clientX,
		startClientY: e.clientY,
		startNormX: f.x,
		startNormY: f.y,
		startScale: f.scale,
		corner,
	};
	editorCore.setInteractiveDrag(true);
	document.addEventListener("mousemove", onPlateMouseMove);
	document.addEventListener("mouseup", onPlateMouseUp);
}

const selectedElementMasks = computed<MaskShape[]>(() => {
	if (!selectedBounds.value) return [];
	const tracks = editorCore.timeline.getTracks();
	for (const track of tracks) {
		const el = track.elements.find((e) => e.id === selectedBounds.value?.elementId);
		if (el && ("masks" in el) && Array.isArray((el as any).masks)) {
			return ((el as any).masks ?? []) as MaskShape[];
		}
	}
	return [];
});

function maskPoints(mask: MaskShape): string {
	const metrics = getCanvasLocalMetrics();
	if (!metrics) return "";
	const pts = (mask.points ?? []).map((p) => `${metrics.left + p.x * metrics.width},${metrics.top + p.y * metrics.height}`);
	return pts.join(" ");
}

function maskScreenX(mask: MaskShape): number {
	const metrics = getCanvasLocalMetrics();
	if (!metrics) return 0;
	return metrics.left + mask.x * metrics.width;
}

function maskScreenY(mask: MaskShape): number {
	const metrics = getCanvasLocalMetrics();
	if (!metrics) return 0;
	return metrics.top + mask.y * metrics.height;
}

function maskScreenW(mask: MaskShape): number {
	const metrics = getCanvasLocalMetrics();
	if (!metrics) return 0;
	return mask.width * metrics.width;
}

function maskScreenH(mask: MaskShape): number {
	const metrics = getCanvasLocalMetrics();
	if (!metrics) return 0;
	return mask.height * metrics.height;
}

function updateMaskById(maskId: string, updates: Partial<MaskShape>) {
	if (!selectedBounds.value) return;
	const trackId = selectedBounds.value.trackId;
	const elementId = selectedBounds.value.elementId;
	const tracks = editorCore.timeline.getTracks();
	const track = tracks.find((t) => t.id === trackId);
	const element = track?.elements.find((e) => e.id === elementId) as any;
	if (!element?.masks) return;
	const nextMasks = (element.masks as MaskShape[]).map((m) =>
		m.id === maskId ? { ...m, ...updates } : m,
	);
	const updatedTracks = tracks.map((t) => {
		if (t.id !== trackId) return t;
		return {
			...t,
			elements: t.elements.map((e) =>
				e.id === elementId ? ({ ...e, masks: nextMasks } as typeof e) : e,
			),
		};
	});
	editorCore.timeline.updateTracks(updatedTracks as TimelineTrack[]);
}

function ensureMaskEditSnapshot(mask: MaskShape) {
	if (!selectedBounds.value || maskEditSnapshot.value) return;
	const trackId = selectedBounds.value.trackId;
	const elementId = selectedBounds.value.elementId;
	const track = editorCore.timeline.getTracks().find((t) => t.id === trackId);
	const element = track?.elements.find((e) => e.id === elementId) as any;
	if (!element?.masks) return;
	maskEditSnapshot.value = {
		trackId,
		elementId,
		initialMasks: (element.masks as MaskShape[]).map((m) =>
			m.id === mask.id ? { ...m } : { ...m },
		),
	};
	editorCore.setInteractiveDrag(true);
}

function onMaskMouseDown(event: MouseEvent, mask: MaskShape) {
	event.preventDefault();
	event.stopPropagation();
	if (!maskEditMode.value) return;
	ensureMaskEditSnapshot(mask);
	maskDragState.value = {
		mode: "move",
		maskId: mask.id,
		startClientX: event.clientX,
		startClientY: event.clientY,
		startX: mask.x,
		startY: mask.y,
		startWidth: mask.width,
		startHeight: mask.height,
		startRotation: mask.rotation,
	};
	document.addEventListener("mousemove", onMaskMouseMove);
	document.addEventListener("mouseup", onMaskMouseUp);
}

function onMaskResizeMouseDown(
	event: MouseEvent,
	mask: MaskShape,
	handle: "tl" | "tr" | "bl" | "br",
) {
	event.preventDefault();
	event.stopPropagation();
	if (!maskEditMode.value) return;
	ensureMaskEditSnapshot(mask);
	maskDragState.value = {
		mode: "resize",
		maskId: mask.id,
		startClientX: event.clientX,
		startClientY: event.clientY,
		startX: mask.x,
		startY: mask.y,
		startWidth: mask.width,
		startHeight: mask.height,
		handle,
	};
	document.addEventListener("mousemove", onMaskMouseMove);
	document.addEventListener("mouseup", onMaskMouseUp);
}

function onMaskRotateMouseDown(event: MouseEvent, mask: MaskShape) {
	event.preventDefault();
	event.stopPropagation();
	if (!maskEditMode.value || !props.canvasRef) return;
	ensureMaskEditSnapshot(mask);
	maskDragState.value = {
		mode: "rotate",
		maskId: mask.id,
		startClientX: event.clientX,
		startClientY: event.clientY,
		startX: mask.x,
		startY: mask.y,
		startRotation: mask.rotation,
	};
	document.addEventListener("mousemove", onMaskMouseMove);
	document.addEventListener("mouseup", onMaskMouseUp);
}

function onMaskPointMouseDown(event: MouseEvent, mask: MaskShape, pointIndex: number) {
	event.preventDefault();
	event.stopPropagation();
	if (!maskEditMode.value) return;
	ensureMaskEditSnapshot(mask);
	maskDragState.value = {
		mode: "point",
		maskId: mask.id,
		pointIndex,
		startClientX: event.clientX,
		startClientY: event.clientY,
		startX: 0,
		startY: 0,
	};
	document.addEventListener("mousemove", onMaskMouseMove);
	document.addEventListener("mouseup", onMaskMouseUp);
}

function onMaskMouseMove(event: MouseEvent) {
	if (!maskDragState.value || !props.canvasRef) return;
	const drag = maskDragState.value;
	const rect = props.canvasRef.getBoundingClientRect();
	const dxNorm = (event.clientX - drag.startClientX) / rect.width;
	const dyNorm = (event.clientY - drag.startClientY) / rect.height;
	if (drag.mode === "move") {
		const newX = Math.max(0, Math.min(1, drag.startX + dxNorm));
		const newY = Math.max(0, Math.min(1, drag.startY + dyNorm));
		updateMaskById(drag.maskId, { x: newX, y: newY });
		return;
	}

	if (drag.mode === "resize") {
		const signX = drag.handle === "tl" || drag.handle === "bl" ? -1 : 1;
		const signY = drag.handle === "tl" || drag.handle === "tr" ? -1 : 1;
		const nextW = Math.max(0.01, Math.min(1, (drag.startWidth ?? 0.4) + dxNorm * signX * 2));
		const nextH = Math.max(0.01, Math.min(1, (drag.startHeight ?? 0.3) + dyNorm * signY * 2));
		updateMaskById(drag.maskId, { width: nextW, height: nextH });
		return;
	}

	if (drag.mode === "rotate") {
		const cx = drag.startX * rect.width + rect.left;
		const cy = drag.startY * rect.height + rect.top;
		const startAngle = Math.atan2(drag.startClientY - cy, drag.startClientX - cx);
		const currentAngle = Math.atan2(event.clientY - cy, event.clientX - cx);
		const deltaDeg = ((currentAngle - startAngle) * 180) / Math.PI;
		updateMaskById(drag.maskId, { rotation: (drag.startRotation ?? 0) + deltaDeg });
		return;
	}

	if (drag.mode === "point") {
		const tracks = editorCore.timeline.getTracks();
		const track = tracks.find((t) => t.id === selectedBounds.value?.trackId);
		const element = track?.elements.find((e) => e.id === selectedBounds.value?.elementId) as any;
		const mask = (element?.masks as MaskShape[] | undefined)?.find((m) => m.id === drag.maskId);
		if (!mask?.points || drag.pointIndex == null || drag.pointIndex < 0 || drag.pointIndex >= mask.points.length) return;
		const nextPoints = [...mask.points];
		nextPoints[drag.pointIndex] = {
			x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
			y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
		};
		updateMaskById(drag.maskId, { points: nextPoints });
	}
}

function onMaskMouseUp() {
	const snapshot = maskEditSnapshot.value;
	if (snapshot) {
		const tracks = editorCore.timeline.getTracks();
		const track = tracks.find((t) => t.id === snapshot.trackId);
		const element = track?.elements.find((e) => e.id === snapshot.elementId) as any;
		const currentMasks = (element?.masks ?? []) as MaskShape[];
		const changed = JSON.stringify(currentMasks) !== JSON.stringify(snapshot.initialMasks);
		if (changed) {
			editorCore.timeline.updateElementMasks({
				trackId: snapshot.trackId,
				elementId: snapshot.elementId,
				previousMasks: snapshot.initialMasks,
				nextMasks: currentMasks,
			});
		}
		editorCore.setInteractiveDrag(false);
		maskEditSnapshot.value = null;
	}
	maskDragState.value = null;
	document.removeEventListener("mousemove", onMaskMouseMove);
	document.removeEventListener("mouseup", onMaskMouseUp);
}

onUnmounted(() => {
	document.removeEventListener("mousemove", onMaskMouseMove);
	document.removeEventListener("mouseup", onMaskMouseUp);
	document.removeEventListener("mousemove", onPlateMouseMove);
	document.removeEventListener("mouseup", onPlateMouseUp);
	maskDragState.value = null;
	maskEditSnapshot.value = null;
	plateDragState.value = null;
	plateFramingUndoSnapshot.value = null;
	editorCore.setInteractiveDrag(false);
});

function onOverlayDblClick(_event: MouseEvent) {
	if (isCropMode.value) return;
	if (!selectedBounds.value) return;

	const tracks = editorCore.timeline.getTracks();
	const selId = selectedBounds.value.elementId;

	for (const track of tracks) {
		const el = track.elements.find((e) => e.id === selId);
		if (el && (el.type === "video" || el.type === "image")) {
			enterCropMode((el as any).crop);
			return;
		}
	}
}

function onOverlayMouseMove(event: MouseEvent) {
	if (isCropMode.value) return;
	handleCanvasMouseMove(event);
}

const cursorStyle = computed(() => {
	if (plateDragState.value) {
		return plateDragState.value.type === "move" ? "grabbing" : "nwse-resize";
	}
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
		@dblclick="onOverlayDblClick"
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
					stroke="rgba(255,255,255,0.15)"
					stroke-width="1"
					stroke-dasharray="4 3"
				/>
			</g>
		</svg>

			<!-- Center alignment guides (CapCut style) -->
		<svg
			v-if="showCenterGuideX || showCenterGuideY"
			class="pointer-events-none absolute inset-0 size-full overflow-visible"
		>
			<!-- Vertical center line (element is centered horizontally, x=0) -->
			<line
				v-if="showCenterGuideX"
				:x1="canvasScreenCenter.x"
				:y1="canvasScreenSize.top"
				:x2="canvasScreenCenter.x"
				:y2="canvasScreenSize.top + canvasScreenSize.h"
				stroke="#22d3ee"
				stroke-width="1"
				opacity="0.9"
			/>
			<!-- Horizontal center line (element is centered vertically, y=0) -->
			<line
				v-if="showCenterGuideY"
				:x1="canvasScreenSize.left"
				:y1="canvasScreenCenter.y"
				:x2="canvasScreenSize.left + canvasScreenSize.w"
				:y2="canvasScreenCenter.y"
				stroke="#22d3ee"
				stroke-width="1"
				opacity="0.9"
			/>
		</svg>

		<!-- Crop overlay (shown in crop mode) -->
		<CropOverlay
			:canvas-ref="canvasRef"
			:canvas-width="canvasWidth"
			:canvas-height="canvasHeight"
		/>

		<!-- Mask outlines for selected element -->
		<svg
			v-if="selectedElementMasks.length > 0 && !isCropMode"
			class="pointer-events-none absolute inset-0 size-full overflow-visible"
			:class="maskEditMode ? 'opacity-100' : 'opacity-80'"
		>
			<g v-for="mask in selectedElementMasks" :key="mask.id">
				<g
					v-if="mask.type === 'rectangle'"
					:transform="`translate(${maskScreenX(mask)}, ${maskScreenY(mask)}) rotate(${mask.rotation})`"
				>
					<rect
						class="pointer-events-auto"
						:x="-maskScreenW(mask) / 2"
						:y="-maskScreenH(mask) / 2"
						:width="maskScreenW(mask)"
						:height="maskScreenH(mask)"
						fill="transparent"
						stroke="white"
						stroke-width="1.5"
						stroke-dasharray="6 4"
						:style="{ cursor: maskEditMode ? 'move' : 'default' }"
						@mousedown="onMaskMouseDown($event, mask)"
					/>
					<rect
						v-for="h in ([
							{ id: 'tl', x: -maskScreenW(mask) / 2, y: -maskScreenH(mask) / 2, c: 'nwse-resize' },
							{ id: 'tr', x: maskScreenW(mask) / 2, y: -maskScreenH(mask) / 2, c: 'nesw-resize' },
							{ id: 'bl', x: -maskScreenW(mask) / 2, y: maskScreenH(mask) / 2, c: 'nesw-resize' },
							{ id: 'br', x: maskScreenW(mask) / 2, y: maskScreenH(mask) / 2, c: 'nwse-resize' },
						])"
						:key="`${mask.id}-${h.id}`"
						class="pointer-events-auto"
						:x="h.x - 4"
						:y="h.y - 4"
						width="8"
						height="8"
						fill="#fff"
						stroke="#3b82f6"
						stroke-width="1"
						:style="{ cursor: maskEditMode ? h.c : 'default' }"
						@mousedown="onMaskResizeMouseDown($event, mask, h.id as any)"
					/>
					<line
						:x1="0"
						:y1="-maskScreenH(mask) / 2"
						x2="0"
						:y2="-maskScreenH(mask) / 2 - 16"
						stroke="#3b82f6"
						stroke-width="1"
					/>
					<circle
						class="pointer-events-auto"
						cx="0"
						:cy="-maskScreenH(mask) / 2 - 16"
						r="4"
						fill="#fff"
						stroke="#3b82f6"
						stroke-width="1"
						:style="{ cursor: maskEditMode ? 'crosshair' : 'default' }"
						@mousedown="onMaskRotateMouseDown($event, mask)"
					/>
				</g>
				<g
					v-else-if="mask.type === 'ellipse'"
					:transform="`translate(${maskScreenX(mask)}, ${maskScreenY(mask)}) rotate(${mask.rotation})`"
				>
					<ellipse
						class="pointer-events-auto"
						cx="0"
						cy="0"
						:rx="maskScreenW(mask) / 2"
						:ry="maskScreenH(mask) / 2"
						fill="transparent"
						stroke="white"
						stroke-width="1.5"
						stroke-dasharray="6 4"
						:style="{ cursor: maskEditMode ? 'move' : 'default' }"
						@mousedown="onMaskMouseDown($event, mask)"
					/>
					<rect
						v-for="h in ([
							{ id: 'tl', x: -maskScreenW(mask) / 2, y: -maskScreenH(mask) / 2, c: 'nwse-resize' },
							{ id: 'tr', x: maskScreenW(mask) / 2, y: -maskScreenH(mask) / 2, c: 'nesw-resize' },
							{ id: 'bl', x: -maskScreenW(mask) / 2, y: maskScreenH(mask) / 2, c: 'nesw-resize' },
							{ id: 'br', x: maskScreenW(mask) / 2, y: maskScreenH(mask) / 2, c: 'nwse-resize' },
						])"
						:key="`${mask.id}-${h.id}`"
						class="pointer-events-auto"
						:x="h.x - 4"
						:y="h.y - 4"
						width="8"
						height="8"
						fill="#fff"
						stroke="#3b82f6"
						stroke-width="1"
						:style="{ cursor: maskEditMode ? h.c : 'default' }"
						@mousedown="onMaskResizeMouseDown($event, mask, h.id as any)"
					/>
					<line
						:x1="0"
						:y1="-maskScreenH(mask) / 2"
						x2="0"
						:y2="-maskScreenH(mask) / 2 - 16"
						stroke="#3b82f6"
						stroke-width="1"
					/>
					<circle
						class="pointer-events-auto"
						cx="0"
						:cy="-maskScreenH(mask) / 2 - 16"
						r="4"
						fill="#fff"
						stroke="#3b82f6"
						stroke-width="1"
						:style="{ cursor: maskEditMode ? 'crosshair' : 'default' }"
						@mousedown="onMaskRotateMouseDown($event, mask)"
					/>
				</g>
				<g v-else>
					<polygon
						class="pointer-events-auto"
						:points="maskPoints(mask)"
						fill="transparent"
						stroke="white"
						stroke-width="1.5"
						stroke-dasharray="6 4"
						:style="{ cursor: maskEditMode ? 'move' : 'default' }"
						@mousedown="onMaskMouseDown($event, mask)"
					/>
					<circle
						v-for="(pt, idx) in (mask.points ?? [])"
						:key="`${mask.id}-p-${idx}`"
						class="pointer-events-auto"
						:cx="canvasScreenSize.left + pt.x * canvasScreenSize.w"
						:cy="canvasScreenSize.top + pt.y * canvasScreenSize.h"
						r="4"
						fill="#fff"
						stroke="#3b82f6"
						stroke-width="1"
						:style="{ cursor: maskEditMode ? 'move' : 'default' }"
						@mousedown="onMaskPointMouseDown($event, mask, idx)"
					/>
				</g>
			</g>
		</svg>

		<!-- Selection: multi-select shows one outline per visible clip; single-select adds resize/rotate handles -->
		<svg
			v-if="selectedVisibleScreenBoundsList.length > 0 && !isCropMode"
			class="pointer-events-none absolute inset-0 size-full overflow-visible"
		>
			<g
				v-for="(item, idx) in selectedVisibleScreenBoundsList"
				:key="`${item.elementId}-${idx}`"
				:transform="`translate(${item.screen.cx}, ${item.screen.cy}) rotate(${item.screen.rotation})`"
			>
				<rect
					:x="-item.screen.width / 2"
					:y="-item.screen.height / 2"
					:width="item.screen.width"
					:height="item.screen.height"
					fill="none"
					:stroke="selectedVisibleScreenBoundsList.length > 1 ? 'rgba(59,130,246,0.95)' : '#3b82f6'"
					stroke-width="2"
					:stroke-dasharray="selectedVisibleScreenBoundsList.length > 1 ? '6 4' : 'none'"
				/>
			</g>

			<g
				v-if="selectedScreenBounds && selectedVisibleScreenBoundsList.length === 1"
				:transform="`translate(${selectedScreenBounds.cx}, ${selectedScreenBounds.cy}) rotate(${selectedScreenBounds.rotation})`"
			>
				<!-- Resize handles (primary selection only; omitted for multi-select — misleading for mixed transforms) -->
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

				<line
					:x1="0"
					:y1="-selectedScreenBounds.height / 2"
					:x2="0"
					:y2="-selectedScreenBounds.height / 2 - ROTATE_HANDLE_OFFSET"
					stroke="#3b82f6"
					stroke-width="1.5"
				/>

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

		<!-- Use 16:9 canvas framing — drag + corner scale like Manual POI -->
		<div
			v-if="plateScreenRect && shouldShowPlateChrome"
			class="pointer-events-none absolute inset-0 z-[15] overflow-visible"
		>
			<div
				class="pointer-events-none absolute box-border border-2"
				:class="plateChromeBorderClass"
				:style="{
					left: `${plateScreenRect.left}px`,
					top: `${plateScreenRect.top}px`,
					width: `${plateScreenRect.width}px`,
					height: `${plateScreenRect.height}px`,
					cursor: 'move',
				}"
			>
				<div class="pointer-events-auto absolute inset-x-0 top-0 h-2 cursor-move" @mousedown.stop="onPlateMouseDown" />
				<div class="pointer-events-auto absolute inset-x-0 bottom-0 h-2 cursor-move" @mousedown.stop="onPlateMouseDown" />
				<div class="pointer-events-auto absolute inset-y-0 left-0 w-2 cursor-move" @mousedown.stop="onPlateMouseDown" />
				<div class="pointer-events-auto absolute inset-y-0 right-0 w-2 cursor-move" @mousedown.stop="onPlateMouseDown" />
				<div
					class="pointer-events-auto absolute left-0 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white"
					:class="plateHandleClass"
					style="cursor: nwse-resize"
					@mousedown.stop="onPlateCornerMouseDown($event, 'nw')"
				/>
				<div
					class="pointer-events-auto absolute left-full top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white"
					:class="plateHandleClass"
					style="cursor: nesw-resize"
					@mousedown.stop="onPlateCornerMouseDown($event, 'ne')"
				/>
				<div
					class="pointer-events-auto absolute left-0 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white"
					:class="plateHandleClass"
					style="cursor: nesw-resize"
					@mousedown.stop="onPlateCornerMouseDown($event, 'sw')"
				/>
				<div
					class="pointer-events-auto absolute left-full top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white"
					:class="plateHandleClass"
					style="cursor: nwse-resize"
					@mousedown.stop="onPlateCornerMouseDown($event, 'se')"
				/>
			</div>
		</div>
	</div>
</template>
