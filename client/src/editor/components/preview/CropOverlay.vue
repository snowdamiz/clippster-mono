<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { useEditorUIState } from "../../composables/useEditorUIState";
import type { VideoElement, ImageElement, CropRect } from "../../types/timeline";

const props = defineProps<{
	canvasRef: HTMLCanvasElement | null;
	canvasWidth: number;
	canvasHeight: number;
}>();

const { editor, version } = useEditor();
const { selectedElements } = useElementSelection();
const { isCropMode, exitCropMode } = useEditorUIState();

const HANDLE_SIZE = 10;
const EDGE_HANDLE_LENGTH = 24;

// --- Get the selected video/image element ---
const selectedElement = computed((): { element: VideoElement | ImageElement; trackId: string } | null => {
	void version.value;
	if (selectedElements.value.length === 0) return null;
	const sel = selectedElements.value[0];
	const track = editor.timeline.getTracks().find((t) => t.id === sel.trackId);
	if (!track) return null;
	const el = track.elements.find((e) => e.id === sel.elementId);
	if (!el || (el.type !== "video" && el.type !== "image")) return null;
	return { element: el as VideoElement | ImageElement, trackId: sel.trackId };
});

// Exit crop mode if selection changes to non-video/image
watch(selectedElement, (el) => {
	if (!el && isCropMode.value) exitCropMode();
});

// --- Crop values ---
const cropDefaults: CropRect = { top: 0, right: 0, bottom: 0, left: 0 };
const elementCrop = computed(() => selectedElement.value?.element.crop ?? cropDefaults);

// Local crop state for visual overlay — only committed to element on drag end
const localCrop = ref<CropRect>({ ...cropDefaults });
const isDragging = ref(false);

// Sync local crop from element when not dragging
watch(elementCrop, (c) => {
	if (!isDragging.value) {
		localCrop.value = { ...c };
	}
}, { immediate: true, deep: true });

// Also sync when entering crop mode
watch(isCropMode, (active) => {
	if (active) {
		localCrop.value = { ...elementCrop.value };
	}
});

// The crop value used for the overlay display
const cropVal = computed(() => localCrop.value);

// --- Media source dimensions ---
const mediaDims = computed(() => {
	const el = selectedElement.value?.element;
	if (!el) return { w: props.canvasWidth, h: props.canvasHeight };
	const asset = editor.media.getAssets().find((a) => a.id === el.mediaId);
	return { w: asset?.width ?? props.canvasWidth, h: asset?.height ?? props.canvasHeight };
});

// --- Contain-fit rect of media within the canvas (in canvas logical coords, no transform) ---
const containFitRect = computed(() => {
	const cw = props.canvasWidth;
	const ch = props.canvasHeight;
	const mw = mediaDims.value.w;
	const mh = mediaDims.value.h;
	const containScale = Math.min(cw / mw, ch / mh);
	const drawW = mw * containScale;
	const drawH = mh * containScale;
	const drawX = (cw - drawW) / 2;
	const drawY = (ch - drawH) / 2;
	return { x: drawX, y: drawY, w: drawW, h: drawH };
});

// --- Element transform ---
const elementTransform = computed(() => {
	const el = selectedElement.value?.element;
	return el?.transform ?? { scale: 1, position: { x: 0, y: 0 }, rotate: 0 };
});

// --- Scale factor: canvas logical coords → overlay display coords ---
const displayScale = computed(() => {
	const canvas = props.canvasRef;
	if (!canvas) return { x: 1, y: 1 };
	const rect = canvas.getBoundingClientRect();
	return { x: rect.width / props.canvasWidth, y: rect.height / props.canvasHeight };
});

/**
 * Transform a point from canvas logical coords to overlay display coords,
 * applying the element's transform (matching VideoNode render exactly).
 *
 * VideoNode transform chain:
 *   translate(centerX, centerY)  // center + position offset
 *   rotate(angle)
 *   scale(s, s)
 *   translate(-canvasW/2, -canvasH/2)
 *   drawImage at (containFitRect)
 *
 * So a point (px, py) in the contain-fit space maps to canvas coords:
 *   local = (px - canvasW/2, py - canvasH/2)
 *   scaled = local * elementScale
 *   rotated = rotate(scaled, angle)
 *   final = rotated + (canvasW/2 + posX, canvasH/2 + posY)
 */
function canvasPointToOverlay(px: number, py: number) {
	const cw = props.canvasWidth;
	const ch = props.canvasHeight;
	const t = elementTransform.value;
	const ds = displayScale.value;

	// Step 1: translate to local space (centered on canvas)
	let lx = px - cw / 2;
	let ly = py - ch / 2;

	// Step 2: apply element scale
	lx *= t.scale;
	ly *= t.scale;

	// Step 3: apply rotation
	if (t.rotate !== 0) {
		const rad = (t.rotate * Math.PI) / 180;
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		const rx = lx * cos - ly * sin;
		const ry = lx * sin + ly * cos;
		lx = rx;
		ly = ry;
	}

	// Step 4: translate back to canvas coords with position offset
	const cx = lx + cw / 2 + t.position.x;
	const cy = ly + ch / 2 + t.position.y;

	// Step 5: convert canvas coords to overlay display coords
	return { x: cx * ds.x, y: cy * ds.y };
}

// --- Crop region in overlay display coordinates ---
const cropScreenRect = computed(() => {
	const cf = containFitRect.value;
	const c = cropVal.value;

	// Crop edges in canvas logical coords (within the contain-fit rect)
	const left = cf.x + c.left * cf.w;
	const top = cf.y + c.top * cf.h;
	const right = cf.x + cf.w - c.right * cf.w;
	const bottom = cf.y + cf.h - c.bottom * cf.h;

	// Transform all 4 corners through the element transform
	const tl = canvasPointToOverlay(left, top);
	const tr = canvasPointToOverlay(right, top);
	const bl = canvasPointToOverlay(left, bottom);
	const br = canvasPointToOverlay(right, bottom);

	// For non-rotated case, use axis-aligned bounding box
	const minX = Math.min(tl.x, tr.x, bl.x, br.x);
	const minY = Math.min(tl.y, tr.y, bl.y, br.y);
	const maxX = Math.max(tl.x, tr.x, bl.x, br.x);
	const maxY = Math.max(tl.y, tr.y, bl.y, br.y);

	return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
});

// --- Overlay container size ---
const overlaySize = computed(() => {
	const canvas = props.canvasRef;
	if (!canvas) return { w: 0, h: 0 };
	const rect = canvas.getBoundingClientRect();
	return { w: rect.width, h: rect.height };
});

// --- Drag state ---
type CropHandle = "top" | "right" | "bottom" | "left" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

const dragHandle = ref<CropHandle | null>(null);
const dragStartMouse = ref({ x: 0, y: 0 });
const dragStartCrop = ref<CropRect>({ top: 0, right: 0, bottom: 0, left: 0 });

function clamp(v: number, min: number, max: number) {
	return Math.min(max, Math.max(min, v));
}

function onHandleMouseDown(event: MouseEvent, handle: CropHandle) {
	event.preventDefault();
	event.stopPropagation();
	isDragging.value = true;
	dragHandle.value = handle;
	dragStartMouse.value = { x: event.clientX, y: event.clientY };
	dragStartCrop.value = { ...localCrop.value };
	document.addEventListener("mousemove", onDragMove);
	document.addEventListener("mouseup", onDragEnd);
}

function onDragMove(event: MouseEvent) {
	if (!dragHandle.value) return;
	const canvas = props.canvasRef;
	if (!canvas) return;

	const rect = canvas.getBoundingClientRect();
	const cf = containFitRect.value;
	const t = elementTransform.value;

	// Delta in screen pixels → canvas logical coords, accounting for element scale
	const deltaScreenX = event.clientX - dragStartMouse.value.x;
	const deltaScreenY = event.clientY - dragStartMouse.value.y;
	const deltaCanvasX = deltaScreenX * (props.canvasWidth / rect.width) / t.scale;
	const deltaCanvasY = deltaScreenY * (props.canvasHeight / rect.height) / t.scale;

	// Convert delta to fraction of contain-fit element size
	const dFracX = deltaCanvasX / cf.w;
	const dFracY = deltaCanvasY / cf.h;

	const sc = dragStartCrop.value;
	const MIN_VISIBLE = 0.05; // minimum 5% visible in each dimension
	let newCrop = { ...sc };

	const handle = dragHandle.value;

	// Top edge
	if (handle === "top" || handle === "top-left" || handle === "top-right") {
		newCrop.top = clamp(sc.top + dFracY, 0, 1 - sc.bottom - MIN_VISIBLE);
	}
	// Bottom edge
	if (handle === "bottom" || handle === "bottom-left" || handle === "bottom-right") {
		newCrop.bottom = clamp(sc.bottom - dFracY, 0, 1 - sc.top - MIN_VISIBLE);
	}
	// Left edge
	if (handle === "left" || handle === "top-left" || handle === "bottom-left") {
		newCrop.left = clamp(sc.left + dFracX, 0, 1 - sc.right - MIN_VISIBLE);
	}
	// Right edge
	if (handle === "right" || handle === "top-right" || handle === "bottom-right") {
		newCrop.right = clamp(sc.right - dFracX, 0, 1 - sc.left - MIN_VISIBLE);
	}

	// Update local overlay state only — canvas stays untouched
	localCrop.value = newCrop;
}

function onDragEnd() {
	if (dragHandle.value) {
		// Commit the final crop to the element via command (for undo/redo)
		const el = selectedElement.value;
		if (el) {
			const finalCrop = { ...localCrop.value };
			editor.timeline.updateElement({
				trackId: el.trackId,
				elementId: el.element.id,
				updates: { crop: finalCrop },
			});
		}
	}
	isDragging.value = false;
	dragHandle.value = null;
	document.removeEventListener("mousemove", onDragMove);
	document.removeEventListener("mouseup", onDragEnd);
}

// --- Handle cursors ---
function getHandleCursor(handle: CropHandle): string {
	switch (handle) {
		case "top": return "ns-resize";
		case "bottom": return "ns-resize";
		case "left": return "ew-resize";
		case "right": return "ew-resize";
		case "top-left": return "nwse-resize";
		case "bottom-right": return "nwse-resize";
		case "top-right": return "nesw-resize";
		case "bottom-left": return "nesw-resize";
	}
}

// --- Handle positions (in overlay screen coords) ---
type HandleDef = { handle: CropHandle; x: number; y: number; w: number; h: number; cursor: string };

const handleDefs = computed((): HandleDef[] => {
	const cr = cropScreenRect.value;
	const hs = HANDLE_SIZE;
	const el = EDGE_HANDLE_LENGTH;

	return [
		// Corners
		{ handle: "top-left", x: cr.x - hs / 2, y: cr.y - hs / 2, w: hs, h: hs, cursor: "nwse-resize" },
		{ handle: "top-right", x: cr.x + cr.w - hs / 2, y: cr.y - hs / 2, w: hs, h: hs, cursor: "nesw-resize" },
		{ handle: "bottom-left", x: cr.x - hs / 2, y: cr.y + cr.h - hs / 2, w: hs, h: hs, cursor: "nesw-resize" },
		{ handle: "bottom-right", x: cr.x + cr.w - hs / 2, y: cr.y + cr.h - hs / 2, w: hs, h: hs, cursor: "nwse-resize" },
		// Edge midpoints
		{ handle: "top", x: cr.x + cr.w / 2 - el / 2, y: cr.y - hs / 2, w: el, h: hs, cursor: "ns-resize" },
		{ handle: "bottom", x: cr.x + cr.w / 2 - el / 2, y: cr.y + cr.h - hs / 2, w: el, h: hs, cursor: "ns-resize" },
		{ handle: "left", x: cr.x - hs / 2, y: cr.y + cr.h / 2 - el / 2, w: hs, h: el, cursor: "ew-resize" },
		{ handle: "right", x: cr.x + cr.w - hs / 2, y: cr.y + cr.h / 2 - el / 2, w: hs, h: el, cursor: "ew-resize" },
	];
});

// --- Dim mask path (SVG clip path for the dimmed region) ---
// We draw the full overlay rect, then cut out the crop rect
const dimClipPath = computed(() => {
	const ow = overlaySize.value.w;
	const oh = overlaySize.value.h;
	const cr = cropScreenRect.value;
	// Outer rect (clockwise) + inner rect (counter-clockwise) = hole
	return `M0,0 L${ow},0 L${ow},${oh} L0,${oh} Z M${cr.x},${cr.y} L${cr.x},${cr.y + cr.h} L${cr.x + cr.w},${cr.y + cr.h} L${cr.x + cr.w},${cr.y} Z`;
});

// --- Keyboard: Escape exits crop mode ---
function onKeyDown(event: KeyboardEvent) {
	if (event.key === "Escape" && isCropMode.value) {
		exitCropMode();
	}
}

onMounted(() => {
	document.addEventListener("keydown", onKeyDown);
});

// Cleanup on unmount
onUnmounted(() => {
	document.removeEventListener("mousemove", onDragMove);
	document.removeEventListener("mouseup", onDragEnd);
	document.removeEventListener("keydown", onKeyDown);
});
</script>

<template>
	<div v-if="isCropMode && selectedElement" class="absolute inset-0 z-10">
		<!-- Dim overlay outside crop region -->
		<svg class="pointer-events-none absolute inset-0 size-full">
			<path :d="dimClipPath" fill="rgba(0,0,0,0.6)" fill-rule="evenodd" />
		</svg>

		<!-- Crop border -->
		<svg class="pointer-events-none absolute inset-0 size-full overflow-visible">
			<rect
				:x="cropScreenRect.x"
				:y="cropScreenRect.y"
				:width="cropScreenRect.w"
				:height="cropScreenRect.h"
				fill="none"
				stroke="white"
				stroke-width="2"
			/>
			<!-- Rule of thirds grid lines -->
			<line
				:x1="cropScreenRect.x + cropScreenRect.w / 3"
				:y1="cropScreenRect.y"
				:x2="cropScreenRect.x + cropScreenRect.w / 3"
				:y2="cropScreenRect.y + cropScreenRect.h"
				stroke="rgba(255,255,255,0.25)"
				stroke-width="1"
			/>
			<line
				:x1="cropScreenRect.x + (cropScreenRect.w * 2) / 3"
				:y1="cropScreenRect.y"
				:x2="cropScreenRect.x + (cropScreenRect.w * 2) / 3"
				:y2="cropScreenRect.y + cropScreenRect.h"
				stroke="rgba(255,255,255,0.25)"
				stroke-width="1"
			/>
			<line
				:x1="cropScreenRect.x"
				:y1="cropScreenRect.y + cropScreenRect.h / 3"
				:x2="cropScreenRect.x + cropScreenRect.w"
				:y2="cropScreenRect.y + cropScreenRect.h / 3"
				stroke="rgba(255,255,255,0.25)"
				stroke-width="1"
			/>
			<line
				:x1="cropScreenRect.x"
				:y1="cropScreenRect.y + (cropScreenRect.h * 2) / 3"
				:x2="cropScreenRect.x + cropScreenRect.w"
				:y2="cropScreenRect.y + (cropScreenRect.h * 2) / 3"
				stroke="rgba(255,255,255,0.25)"
				stroke-width="1"
			/>
		</svg>

		<!-- Drag handles -->
		<div
			v-for="hd in handleDefs"
			:key="hd.handle"
			class="absolute rounded-sm bg-white shadow-md"
			:class="hd.handle.includes('-') ? 'border-2 border-primary' : 'border border-white/80'"
			:style="{
				left: `${hd.x}px`,
				top: `${hd.y}px`,
				width: `${hd.w}px`,
				height: `${hd.h}px`,
				cursor: hd.cursor,
			}"
			@mousedown="onHandleMouseDown($event, hd.handle)"
		/>
	</div>
</template>
