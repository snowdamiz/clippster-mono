<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { useEditorUIState } from "../../composables/useEditorUIState";
import type { VideoElement, ImageElement, CropRect } from "../../types/timeline";
import { Check, X, ChevronDown } from "lucide-vue-next";

const props = defineProps<{
	canvasRef: HTMLCanvasElement | null;
	canvasWidth: number;
	canvasHeight: number;
}>();

const { editor, version } = useEditor({
	subscribe: {
		timeline: true,
		media: true,
		selection: true,
		playback: false,
		scenes: false,
		project: false,
	},
});
const { selectedElements } = useElementSelection();
const { isCropMode, confirmCrop, cancelCrop, pendingCrop, originalCrop } = useEditorUIState();

const BRACKET_LENGTH = 18;
const BRACKET_THICKNESS = 3;
const EDGE_HIT_SIZE = 8;
const EDGE_BAR_LENGTH = 28;

// --- Grid overlay modes ---
type GridMode = "none" | "thirds" | "golden" | "diagonal" | "grid4x4";
const gridMode = ref<GridMode>("thirds");
const GRID_MODES: GridMode[] = ["none", "thirds", "golden", "diagonal", "grid4x4"];
const gridModeLabels: Record<GridMode, string> = {
	none: "No Grid",
	thirds: "Rule of Thirds",
	golden: "Golden Ratio",
	diagonal: "Diagonals",
	grid4x4: "4×4 Grid",
};

function cycleGridMode() {
	const idx = GRID_MODES.indexOf(gridMode.value);
	gridMode.value = GRID_MODES[(idx + 1) % GRID_MODES.length];
}

// --- Aspect ratio presets for floating toolbar ---
interface CropPreset {
	label: string;
	ratio: [number, number]; // [0,0] = free
}
const cropPresets: CropPreset[] = [
	{ label: "Free", ratio: [0, 0] },
	{ label: "16:9", ratio: [16, 9] },
	{ label: "9:16", ratio: [9, 16] },
	{ label: "4:3", ratio: [4, 3] },
	{ label: "1:1", ratio: [1, 1] },
	{ label: "4:5", ratio: [4, 5] },
	{ label: "21:9", ratio: [21, 9] },
];
const showPresetDropdown = ref(false);
const lockedAspectRatio = ref<number | null>(null);

function applyCropPreset(preset: CropPreset) {
	showPresetDropdown.value = false;
	if (preset.ratio[0] === 0) {
		lockedAspectRatio.value = null;
		return;
	}

	const targetAR = preset.ratio[0] / preset.ratio[1];
	lockedAspectRatio.value = targetAR;

	const asset = editor.media.getAssets().find((a) => a.id === selectedElement.value?.element.mediaId);
	const srcW = asset?.width ?? 1920;
	const srcH = asset?.height ?? 1080;
	const srcAR = srcW / srcH;

	let cropH = 0, cropV = 0;
	if (srcAR > targetAR) {
		const visibleW = srcH * targetAR;
		cropH = (srcW - visibleW) / srcW / 2;
	} else if (srcAR < targetAR) {
		const visibleH = srcW / targetAR;
		cropV = (srcH - visibleH) / srcH / 2;
	}

	localCrop.value = { top: cropV, right: cropH, bottom: cropV, left: cropH };
}

const activeCropPresetLabel = computed(() => {
	const c = localCrop.value;
	if (c.top === 0 && c.right === 0 && c.bottom === 0 && c.left === 0) return "Free";
	const asset = editor.media.getAssets().find((a) => a.id === selectedElement.value?.element.mediaId);
	const srcW = asset?.width ?? 1920;
	const srcH = asset?.height ?? 1080;
	const visW = srcW * (1 - c.left - c.right);
	const visH = srcH * (1 - c.top - c.bottom);
	const visAR = visW / visH;
	for (const p of cropPresets) {
		if (p.ratio[0] === 0) continue;
		const pAR = p.ratio[0] / p.ratio[1];
		if (Math.abs(visAR - pAR) < 0.02) return p.label;
	}
	return "Custom";
});

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
	if (!el && isCropMode.value) handleCancel();
});

// --- Crop values ---
const cropDefaults: CropRect = { top: 0, right: 0, bottom: 0, left: 0 };
const elementCrop = computed(() => selectedElement.value?.element.crop ?? cropDefaults);

// Local crop state for visual overlay — only committed on confirm
const localCrop = ref<CropRect>({ ...cropDefaults });
const isDragging = ref(false);

// Sync local crop when entering crop mode
watch(isCropMode, (active) => {
	if (active) {
		localCrop.value = { ...elementCrop.value };
		lockedAspectRatio.value = null;
	}
});

// The crop value used for the overlay display
const cropVal = computed(() => localCrop.value);

// --- Confirm / Cancel ---
function handleConfirm() {
	const el = selectedElement.value;
	const finalCrop = confirmCrop();
	if (el && finalCrop) {
		editor.timeline.updateElement({
			trackId: el.trackId,
			elementId: el.element.id,
			updates: { crop: finalCrop },
		});
	}
}

function handleCancel() {
	const el = selectedElement.value;
	const origCrop = cancelCrop();
	if (el && origCrop) {
		editor.timeline.updateElement({
			trackId: el.trackId,
			elementId: el.element.id,
			updates: { crop: origCrop },
		});
	}
}

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
 */
function canvasPointToOverlay(px: number, py: number) {
	const cw = props.canvasWidth;
	const ch = props.canvasHeight;
	const t = elementTransform.value;
	const ds = displayScale.value;

	let lx = px - cw / 2;
	let ly = py - ch / 2;
	lx *= t.scale;
	ly *= t.scale;

	if (t.rotate !== 0) {
		const rad = (t.rotate * Math.PI) / 180;
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		const rx = lx * cos - ly * sin;
		const ry = lx * sin + ly * cos;
		lx = rx;
		ly = ry;
	}

	const cx = lx + cw / 2 + t.position.x;
	const cy = ly + ch / 2 + t.position.y;
	return { x: cx * ds.x, y: cy * ds.y };
}

// --- Crop region in overlay display coordinates ---
const cropScreenRect = computed(() => {
	const cf = containFitRect.value;
	const c = cropVal.value;

	const left = cf.x + c.left * cf.w;
	const top = cf.y + c.top * cf.h;
	const right = cf.x + cf.w - c.right * cf.w;
	const bottom = cf.y + cf.h - c.bottom * cf.h;

	const tl = canvasPointToOverlay(left, top);
	const tr = canvasPointToOverlay(right, top);
	const bl = canvasPointToOverlay(left, bottom);
	const br = canvasPointToOverlay(right, bottom);

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
type CropHandle = "top" | "right" | "bottom" | "left" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "move";

const dragHandle = ref<CropHandle | null>(null);
const dragStartMouse = ref({ x: 0, y: 0 });
const dragStartCrop = ref<CropRect>({ top: 0, right: 0, bottom: 0, left: 0 });
const shiftHeld = ref(false);
const dragStartAspectRatio = ref<number | null>(null);

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
	shiftHeld.value = event.shiftKey;

	// Capture aspect ratio at drag start for Shift-lock
	const sc = localCrop.value;
	const visW = 1 - sc.left - sc.right;
	const visH = 1 - sc.top - sc.bottom;
	dragStartAspectRatio.value = visH > 0 ? visW / visH : 1;

	document.addEventListener("mousemove", onDragMove);
	document.addEventListener("mouseup", onDragEnd);
}

// Move drag: click inside crop box to reposition
function onMoveMouseDown(event: MouseEvent) {
	event.preventDefault();
	event.stopPropagation();
	isDragging.value = true;
	dragHandle.value = "move";
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

	const deltaScreenX = event.clientX - dragStartMouse.value.x;
	const deltaScreenY = event.clientY - dragStartMouse.value.y;
	const deltaCanvasX = deltaScreenX * (props.canvasWidth / rect.width) / t.scale;
	const deltaCanvasY = deltaScreenY * (props.canvasHeight / rect.height) / t.scale;

	const dFracX = deltaCanvasX / cf.w;
	const dFracY = deltaCanvasY / cf.h;

	const sc = dragStartCrop.value;
	const MIN_VISIBLE = 0.05;
	const handle = dragHandle.value;

	// --- Move: shift all four edges equally ---
	if (handle === "move") {
		const visW = 1 - sc.left - sc.right;
		const visH = 1 - sc.top - sc.bottom;
		let newLeft = sc.left + dFracX;
		let newTop = sc.top + dFracY;
		// Clamp so crop box stays within media bounds
		newLeft = clamp(newLeft, 0, 1 - visW);
		newTop = clamp(newTop, 0, 1 - visH);
		localCrop.value = {
			top: newTop,
			right: 1 - visW - newLeft,
			bottom: 1 - visH - newTop,
			left: newLeft,
		};
		return;
	}

	// --- Resize handles ---
	shiftHeld.value = event.shiftKey;
	const useAspectLock = shiftHeld.value || lockedAspectRatio.value !== null;
	const lockAR = lockedAspectRatio.value ?? dragStartAspectRatio.value ?? 1;

	let newCrop = { ...sc };

	// Compute raw new crop values
	if (handle === "top" || handle === "top-left" || handle === "top-right") {
		newCrop.top = clamp(sc.top + dFracY, 0, 1 - sc.bottom - MIN_VISIBLE);
	}
	if (handle === "bottom" || handle === "bottom-left" || handle === "bottom-right") {
		newCrop.bottom = clamp(sc.bottom - dFracY, 0, 1 - sc.top - MIN_VISIBLE);
	}
	if (handle === "left" || handle === "top-left" || handle === "bottom-left") {
		newCrop.left = clamp(sc.left + dFracX, 0, 1 - sc.right - MIN_VISIBLE);
	}
	if (handle === "right" || handle === "top-right" || handle === "bottom-right") {
		newCrop.right = clamp(sc.right - dFracX, 0, 1 - sc.left - MIN_VISIBLE);
	}

	// Apply aspect ratio lock for corner handles
	if (useAspectLock && handle.includes("-")) {
		const visW = 1 - newCrop.left - newCrop.right;
		const visH = 1 - newCrop.top - newCrop.bottom;
		const currentAR = visW / visH;

		// Adjust the secondary axis to match the locked AR
		// Use the media's pixel aspect to convert between fractional W and H
		const mw = mediaDims.value.w;
		const mh = mediaDims.value.h;
		const pixelAR = (visW * mw) / (visH * mh);

		if (pixelAR > lockAR) {
			// Too wide — narrow horizontally
			const targetVisW = visH * lockAR * (mh / mw);
			const excessW = visW - targetVisW;
			if (handle === "top-left" || handle === "bottom-left") {
				newCrop.left = clamp(newCrop.left + excessW, 0, 1 - newCrop.right - MIN_VISIBLE);
			} else {
				newCrop.right = clamp(newCrop.right + excessW, 0, 1 - newCrop.left - MIN_VISIBLE);
			}
		} else if (pixelAR < lockAR) {
			// Too tall — shorten vertically
			const targetVisH = visW * mw / (lockAR * mh);
			const excessH = visH - targetVisH;
			if (handle === "top-left" || handle === "top-right") {
				newCrop.top = clamp(newCrop.top + excessH, 0, 1 - newCrop.bottom - MIN_VISIBLE);
			} else {
				newCrop.bottom = clamp(newCrop.bottom + excessH, 0, 1 - newCrop.top - MIN_VISIBLE);
			}
		}
	}

	localCrop.value = newCrop;

	// Sync to pendingCrop for external consumers
	if (pendingCrop.value) {
		pendingCrop.value = { ...newCrop };
	}
}

function onDragEnd() {
	isDragging.value = false;
	dragHandle.value = null;
	shiftHeld.value = false;
	document.removeEventListener("mousemove", onDragMove);
	document.removeEventListener("mouseup", onDragEnd);

	// Sync final state to pendingCrop
	if (pendingCrop.value) {
		pendingCrop.value = { ...localCrop.value };
	}
}

// --- L-bracket corner paths ---
function cornerBracketPath(corner: string, cr: { x: number; y: number; w: number; h: number }): string {
	const L = BRACKET_LENGTH;
	switch (corner) {
		case "top-left":
			return `M${cr.x},${cr.y + L} L${cr.x},${cr.y} L${cr.x + L},${cr.y}`;
		case "top-right":
			return `M${cr.x + cr.w - L},${cr.y} L${cr.x + cr.w},${cr.y} L${cr.x + cr.w},${cr.y + L}`;
		case "bottom-left":
			return `M${cr.x},${cr.y + cr.h - L} L${cr.x},${cr.y + cr.h} L${cr.x + L},${cr.y + cr.h}`;
		case "bottom-right":
			return `M${cr.x + cr.w - L},${cr.y + cr.h} L${cr.x + cr.w},${cr.y + cr.h} L${cr.x + cr.w},${cr.y + cr.h - L}`;
		default:
			return "";
	}
}

// --- Edge midpoint bar positions ---
type EdgeBarDef = { handle: CropHandle; x: number; y: number; w: number; h: number; cursor: string };

const edgeBarDefs = computed((): EdgeBarDef[] => {
	const cr = cropScreenRect.value;
	const barLen = EDGE_BAR_LENGTH;
	const hitSize = EDGE_HIT_SIZE;
	return [
		{ handle: "top", x: cr.x + cr.w / 2 - barLen / 2, y: cr.y - hitSize / 2, w: barLen, h: hitSize, cursor: "ns-resize" },
		{ handle: "bottom", x: cr.x + cr.w / 2 - barLen / 2, y: cr.y + cr.h - hitSize / 2, w: barLen, h: hitSize, cursor: "ns-resize" },
		{ handle: "left", x: cr.x - hitSize / 2, y: cr.y + cr.h / 2 - barLen / 2, w: hitSize, h: barLen, cursor: "ew-resize" },
		{ handle: "right", x: cr.x + cr.w - hitSize / 2, y: cr.y + cr.h / 2 - barLen / 2, w: hitSize, h: barLen, cursor: "ew-resize" },
	];
});

// --- Corner hit zones (invisible, larger than the visual brackets) ---
type CornerHitDef = { handle: CropHandle; x: number; y: number; cursor: string };
const CORNER_HIT_SIZE = 20;

const cornerHitDefs = computed((): CornerHitDef[] => {
	const cr = cropScreenRect.value;
	const hs = CORNER_HIT_SIZE;
	return [
		{ handle: "top-left", x: cr.x - hs / 2, y: cr.y - hs / 2, cursor: "nwse-resize" },
		{ handle: "top-right", x: cr.x + cr.w - hs / 2, y: cr.y - hs / 2, cursor: "nesw-resize" },
		{ handle: "bottom-left", x: cr.x - hs / 2, y: cr.y + cr.h - hs / 2, cursor: "nesw-resize" },
		{ handle: "bottom-right", x: cr.x + cr.w - hs / 2, y: cr.y + cr.h - hs / 2, cursor: "nwse-resize" },
	];
});

// --- Dim mask path ---
const dimClipPath = computed(() => {
	const ow = overlaySize.value.w;
	const oh = overlaySize.value.h;
	const cr = cropScreenRect.value;
	return `M0,0 L${ow},0 L${ow},${oh} L0,${oh} Z M${cr.x},${cr.y} L${cr.x},${cr.y + cr.h} L${cr.x + cr.w},${cr.y + cr.h} L${cr.x + cr.w},${cr.y} Z`;
});

// --- Grid line computations ---
const GOLDEN = 0.381966; // 1 - 1/φ ≈ 0.382

const gridLines = computed(() => {
	const cr = cropScreenRect.value;
	const mode = gridMode.value;
	const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

	if (mode === "none") return lines;

	if (mode === "thirds") {
		for (let i = 1; i <= 2; i++) {
			lines.push({ x1: cr.x + (cr.w * i) / 3, y1: cr.y, x2: cr.x + (cr.w * i) / 3, y2: cr.y + cr.h });
			lines.push({ x1: cr.x, y1: cr.y + (cr.h * i) / 3, x2: cr.x + cr.w, y2: cr.y + (cr.h * i) / 3 });
		}
	} else if (mode === "golden") {
		const gx1 = cr.x + cr.w * GOLDEN;
		const gx2 = cr.x + cr.w * (1 - GOLDEN);
		const gy1 = cr.y + cr.h * GOLDEN;
		const gy2 = cr.y + cr.h * (1 - GOLDEN);
		lines.push({ x1: gx1, y1: cr.y, x2: gx1, y2: cr.y + cr.h });
		lines.push({ x1: gx2, y1: cr.y, x2: gx2, y2: cr.y + cr.h });
		lines.push({ x1: cr.x, y1: gy1, x2: cr.x + cr.w, y2: gy1 });
		lines.push({ x1: cr.x, y1: gy2, x2: cr.x + cr.w, y2: gy2 });
	} else if (mode === "diagonal") {
		lines.push({ x1: cr.x, y1: cr.y, x2: cr.x + cr.w, y2: cr.y + cr.h });
		lines.push({ x1: cr.x + cr.w, y1: cr.y, x2: cr.x, y2: cr.y + cr.h });
	} else if (mode === "grid4x4") {
		for (let i = 1; i <= 3; i++) {
			lines.push({ x1: cr.x + (cr.w * i) / 4, y1: cr.y, x2: cr.x + (cr.w * i) / 4, y2: cr.y + cr.h });
			lines.push({ x1: cr.x, y1: cr.y + (cr.h * i) / 4, x2: cr.x + cr.w, y2: cr.y + (cr.h * i) / 4 });
		}
	}

	return lines;
});

// --- Crop dimensions display ---
const cropDimsDisplay = computed(() => {
	const c = localCrop.value;
	const asset = editor.media.getAssets().find((a) => a.id === selectedElement.value?.element.mediaId);
	const srcW = asset?.width ?? 1920;
	const srcH = asset?.height ?? 1080;
	const visW = Math.round(srcW * (1 - c.left - c.right));
	const visH = Math.round(srcH * (1 - c.top - c.bottom));
	return `${visW}×${visH}`;
});

// --- Keyboard: Enter confirms, Escape cancels, O cycles grid ---
function onKeyDown(event: KeyboardEvent) {
	if (!isCropMode.value) return;

	if (event.key === "Escape") {
		event.preventDefault();
		event.stopPropagation();
		handleCancel();
	} else if (event.key === "Enter") {
		event.preventDefault();
		event.stopPropagation();
		handleConfirm();
	} else if (event.key === "o" || event.key === "O") {
		event.preventDefault();
		cycleGridMode();
	}
}

onMounted(() => {
	document.addEventListener("keydown", onKeyDown, true);
});

onUnmounted(() => {
	document.removeEventListener("mousemove", onDragMove);
	document.removeEventListener("mouseup", onDragEnd);
	document.removeEventListener("keydown", onKeyDown, true);
});
</script>

<template>
	<div v-if="isCropMode && selectedElement" class="absolute inset-0 z-10">
		<!-- Dim overlay outside crop region -->
		<svg class="pointer-events-none absolute inset-0 size-full">
			<path :d="dimClipPath" fill="rgba(0,0,0,0.55)" fill-rule="evenodd" />
		</svg>

		<!-- Crop border + grid lines + L-bracket corners -->
		<svg class="pointer-events-none absolute inset-0 size-full overflow-visible">
			<!-- Thin white border -->
			<rect
				:x="cropScreenRect.x"
				:y="cropScreenRect.y"
				:width="cropScreenRect.w"
				:height="cropScreenRect.h"
				fill="none"
				stroke="rgba(255,255,255,0.7)"
				stroke-width="1"
			/>

			<!-- Grid lines -->
			<line
				v-for="(line, i) in gridLines"
				:key="'grid-' + i"
				:x1="line.x1"
				:y1="line.y1"
				:x2="line.x2"
				:y2="line.y2"
				stroke="rgba(255,255,255,0.2)"
				stroke-width="1"
			/>

			<!-- L-bracket corner handles -->
			<path
				v-for="corner in ['top-left', 'top-right', 'bottom-left', 'bottom-right']"
				:key="'bracket-' + corner"
				:d="cornerBracketPath(corner, cropScreenRect)"
				fill="none"
				stroke="white"
				:stroke-width="BRACKET_THICKNESS"
				stroke-linecap="square"
			/>

			<!-- Edge midpoint bars (visual only) -->
			<line
				:x1="cropScreenRect.x + cropScreenRect.w / 2 - 10"
				:y1="cropScreenRect.y"
				:x2="cropScreenRect.x + cropScreenRect.w / 2 + 10"
				:y2="cropScreenRect.y"
				stroke="white"
				:stroke-width="BRACKET_THICKNESS"
				stroke-linecap="round"
			/>
			<line
				:x1="cropScreenRect.x + cropScreenRect.w / 2 - 10"
				:y1="cropScreenRect.y + cropScreenRect.h"
				:x2="cropScreenRect.x + cropScreenRect.w / 2 + 10"
				:y2="cropScreenRect.y + cropScreenRect.h"
				stroke="white"
				:stroke-width="BRACKET_THICKNESS"
				stroke-linecap="round"
			/>
			<line
				:x1="cropScreenRect.x"
				:y1="cropScreenRect.y + cropScreenRect.h / 2 - 10"
				:x2="cropScreenRect.x"
				:y2="cropScreenRect.y + cropScreenRect.h / 2 + 10"
				stroke="white"
				:stroke-width="BRACKET_THICKNESS"
				stroke-linecap="round"
			/>
			<line
				:x1="cropScreenRect.x + cropScreenRect.w"
				:y1="cropScreenRect.y + cropScreenRect.h / 2 - 10"
				:x2="cropScreenRect.x + cropScreenRect.w"
				:y2="cropScreenRect.y + cropScreenRect.h / 2 + 10"
				stroke="white"
				:stroke-width="BRACKET_THICKNESS"
				stroke-linecap="round"
			/>
		</svg>

		<!-- Move drag zone: the interior of the crop box -->
		<div
			class="absolute"
			:style="{
				left: `${cropScreenRect.x}px`,
				top: `${cropScreenRect.y}px`,
				width: `${cropScreenRect.w}px`,
				height: `${cropScreenRect.h}px`,
				cursor: 'move',
			}"
			@mousedown="onMoveMouseDown"
		/>

		<!-- Corner hit zones (invisible, larger than visual brackets) -->
		<div
			v-for="ch in cornerHitDefs"
			:key="'corner-' + ch.handle"
			class="absolute"
			:style="{
				left: `${ch.x}px`,
				top: `${ch.y}px`,
				width: `${CORNER_HIT_SIZE}px`,
				height: `${CORNER_HIT_SIZE}px`,
				cursor: ch.cursor,
			}"
			@mousedown="onHandleMouseDown($event, ch.handle)"
		/>

		<!-- Edge hit zones -->
		<div
			v-for="eb in edgeBarDefs"
			:key="'edge-' + eb.handle"
			class="absolute"
			:style="{
				left: `${eb.x}px`,
				top: `${eb.y}px`,
				width: `${eb.w}px`,
				height: `${eb.h}px`,
				cursor: eb.cursor,
			}"
			@mousedown="onHandleMouseDown($event, eb.handle)"
		/>

		<!-- Floating toolbar at bottom of crop region -->
		<div
			class="absolute z-20 flex items-center gap-1.5 rounded-md border border-white/15 bg-[#1a1a1e]/95 px-2 py-1 shadow-xl backdrop-blur-sm"
			:style="{
				left: `${cropScreenRect.x + cropScreenRect.w / 2}px`,
				top: `${cropScreenRect.y + cropScreenRect.h + 10}px`,
				transform: 'translateX(-50%)',
			}"
			@mousedown.stop
		>
			<!-- Aspect ratio dropdown -->
			<div class="relative">
				<button
					type="button"
					class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-300 transition-colors hover:bg-white/10"
					@click.stop="showPresetDropdown = !showPresetDropdown"
				>
					{{ activeCropPresetLabel }}
					<ChevronDown class="size-2.5 text-zinc-500" />
				</button>
				<div
					v-if="showPresetDropdown"
					class="absolute bottom-full left-0 mb-1 rounded-md border border-white/10 bg-[#1e1e22] py-0.5 shadow-lg"
				>
					<button
						v-for="preset in cropPresets"
						:key="preset.label"
						type="button"
						:class="[
							'flex w-full items-center px-3 py-1 text-[10px] transition-colors whitespace-nowrap',
							activeCropPresetLabel === preset.label
								? 'text-primary bg-primary/10'
								: 'text-zinc-300 hover:bg-white/5',
						]"
						@click.stop="applyCropPreset(preset)"
					>
						{{ preset.label }}
					</button>
				</div>
				<div v-if="showPresetDropdown" class="fixed inset-0 z-10" @click="showPresetDropdown = false" />
			</div>

			<div class="h-4 w-px bg-white/10" />

			<!-- Dimensions display -->
			<span class="text-[10px] tabular-nums text-zinc-500">{{ cropDimsDisplay }}</span>

			<div class="h-4 w-px bg-white/10" />

			<!-- Grid mode button -->
			<button
				type="button"
				class="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
				:title="`Grid: ${gridModeLabels[gridMode]} (O)`"
				@click.stop="cycleGridMode"
			>
				{{ gridModeLabels[gridMode] }}
			</button>

			<div class="h-4 w-px bg-white/10" />

			<!-- Cancel -->
			<button
				type="button"
				class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
				title="Cancel (Esc)"
				@click.stop="handleCancel"
			>
				<X class="size-3" />
			</button>

			<!-- Confirm -->
			<button
				type="button"
				class="flex items-center gap-0.5 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/30"
				title="Apply (Enter)"
				@click.stop="handleConfirm"
			>
				<Check class="size-3" />
			</button>
		</div>

		<!-- Shift-lock indicator -->
		<div
			v-if="shiftHeld && isDragging"
			class="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-medium text-yellow-400"
		>
			Aspect Ratio Locked
		</div>
	</div>
</template>
