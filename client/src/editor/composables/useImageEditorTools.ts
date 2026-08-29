/**
 * Image-mode tool state + compositor helpers (shape insert, selection into ImageDocument).
 */
import { ref, computed } from "vue";
import type { PixelSelection, PixelToolId } from "../types/image-document";
import { IMAGE_DOCUMENT_KEY, createEmptyImageDocument } from "../types/image-document";
import { EditorCore } from "../core";
import { processMediaAssets } from "../lib/media/processing";
import { buildImageElement, buildTextElement } from "../lib/timeline/element-utils";
import { TIMELINE_CONSTANTS } from "../constants/timeline-constants";
import { useEditorUIState } from "./useEditorUIState";
import {
	findFlyoutSlotForTool,
	IMAGE_TOOL_BY_ID,
	IMAGE_TOOL_FLYouts,
	IMAGE_TOOL_RAIL,
	toolsSharingShortcut,
} from "../constants/image-tool-flyouts";

const activeTool = ref<PixelToolId>("move");
/** Last-selected tool id per flyout slot (Photoshop: toolbar shows last used). */
const flyoutLastTool = ref<Record<string, PixelToolId>>(
	Object.fromEntries(IMAGE_TOOL_FLYouts.map((s) => [s.id, s.defaultTool])),
);
const brushSize = ref(24);
const brushOpacity = ref(1);
const brushHardness = ref(0.8);
const fillTolerance = ref(32);
const wandTolerance = ref(32);
const wandContiguous = ref(true);
const fillColor = ref("#ffffff");
const strokeColor = ref("#000000");
const shapeKind = ref<"rect" | "ellipse">("rect");
const marqueeKind = ref<"rect" | "ellipse">("rect");
const marqueeDraft = ref<PixelSelection | null>(null);
/** Softness remembered when switching Brush ↔ Pencil. */
let brushHardnessBeforePencil = 0.8;

export function useImageEditorTools() {
	const tool = computed(() => activeTool.value);
	const { isCropMode, enterCropMode, exitCropMode } = useEditorUIState();

	function setTool(id: PixelToolId) {
		activeTool.value = id;
	}

	function selectFirstImageIfNeeded() {
		const editor = EditorCore.getInstance();
		const selected = editor.selection.getSelectedElements();
		if (selected.length === 1) {
			const track = editor.timeline.getTracks().find((t) => t.id === selected[0].trackId);
			const el = track?.elements.find((e) => e.id === selected[0].elementId);
			if (el && (el.type === "image" || el.type === "video")) return;
		}
		for (const track of [...editor.timeline.getTracks()].reverse()) {
			for (const el of [...track.elements].reverse()) {
				if (el.type === "image" || el.type === "video") {
					editor.selection.setSelectedElements({
						elements: [{ trackId: track.id, elementId: el.id }],
					});
					return;
				}
			}
		}
	}

	const TOOLS_NEEDING_IMAGE: PixelToolId[] = [
		"crop",
		"magic-wand",
		"brush",
		"pencil",
		"eraser",
		"background-eraser",
		"magic-eraser",
		"fill",
		"clone",
		"heal",
		"spot-heal",
		"gradient",
	];

	function syncToolAliases(id: PixelToolId) {
		if (id === "marquee-rect") marqueeKind.value = "rect";
		if (id === "marquee-ellipse") marqueeKind.value = "ellipse";
		if (id === "shape-rect" || id === "shape") {
			shapeKind.value = "rect";
		}
		if (id === "shape-ellipse") shapeKind.value = "ellipse";

		if (id === "pencil") {
			if (brushHardness.value < 0.99) brushHardnessBeforePencil = brushHardness.value;
			brushHardness.value = 1;
		} else if (id === "brush" && brushHardness.value >= 0.99 && brushHardnessBeforePencil < 0.99) {
			brushHardness.value = brushHardnessBeforePencil;
		}
	}

	function activateTool(id: PixelToolId) {
		const normalized: PixelToolId = id === "shape" ? "shape-rect" : id;
		syncToolAliases(normalized);
		setTool(normalized);

		const slot = findFlyoutSlotForTool(normalized);
		if (slot) {
			flyoutLastTool.value = { ...flyoutLastTool.value, [slot.id]: normalized };
		}

		if (TOOLS_NEEDING_IMAGE.includes(normalized)) {
			selectFirstImageIfNeeded();
		}
		if (normalized === "crop") {
			queueMicrotask(() => {
				if (activeTool.value === "crop") enterCropMode();
			});
		} else if (isCropMode.value) {
			exitCropMode();
		}
	}

	/** Visible tool for a flyout slot (last selected or default). */
	function getSlotVisibleTool(slotId: string): PixelToolId {
		const slot = IMAGE_TOOL_FLYouts.find((s) => s.id === slotId);
		if (!slot) return "move";
		return flyoutLastTool.value[slotId] ?? slot.defaultTool;
	}

	/** Photoshop: Shift+letter cycles tools that share a shortcut. */
	function cycleToolsByShortcut(shortcut: string) {
		const tools = toolsSharingShortcut(shortcut);
		if (tools.length === 0) return;
		const idx = tools.findIndex((t) => t.id === activeTool.value);
		const next = tools[idx < 0 ? 0 : (idx + 1) % tools.length];
		activateTool(next.id);
	}

	/** @deprecated Prefer cycleToolsByShortcut("E") */
	function cycleEraserTools() {
		cycleToolsByShortcut("E");
	}

	function getOrCreateImageDocument() {
		const editor = EditorCore.getInstance();
		const project = editor.project.getActiveOrNull();
		if (!project) return null;
		const size = project.settings.canvasSize;
		let doc = project.settings.imageDocument;
		if (!doc) {
			doc = createEmptyImageDocument(size.width, size.height);
		}
		return { editor, project, doc, size };
	}

	function commitImageDocument(doc: NonNullable<ReturnType<typeof getOrCreateImageDocument>>["doc"]) {
		const ctx = getOrCreateImageDocument();
		if (!ctx) return;
		void ctx.editor.project.updateSettings({
			settings: {
				[IMAGE_DOCUMENT_KEY]: {
					...doc,
					activeTool: activeTool.value,
				},
			} as any,
		});
	}

	function setSelection(selection: PixelSelection | null) {
		marqueeDraft.value = selection;
		const ctx = getOrCreateImageDocument();
		if (!ctx) return;
		commitImageDocument({ ...ctx.doc, selection, activeTool: activeTool.value });
	}

	function isUsableSelection(sel: PixelSelection | null): sel is PixelSelection {
		if (!sel) return false;
		if (sel.type === "path") {
			if (sel.rings?.some((ring) => ring.length >= 3)) return true;
			return !!sel.points && sel.points.length >= 3;
		}
		return sel.width > 0.005 && sel.height > 0.005;
	}

	function getLiveSelection(): PixelSelection | null {
		if (isUsableSelection(marqueeDraft.value)) return marqueeDraft.value;
		const docSel = getOrCreateImageDocument()?.doc.selection ?? null;
		return isUsableSelection(docSel) ? docSel : null;
	}

	async function insertShapeLayer(
		kind: "rect" | "ellipse" = "rect",
		position?: { x: number; y: number },
	) {
		const editor = EditorCore.getInstance();
		const project = editor.project.getActiveOrNull();
		if (!project) return;

		const { width: cw, height: ch } = project.settings.canvasSize;
		const w = Math.round(cw * 0.25);
		const h = Math.round(ch * 0.18);
		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const inset = 2;
		ctx.fillStyle = fillColor.value;
		ctx.strokeStyle = strokeColor.value;
		ctx.lineWidth = 2;
		if (kind === "ellipse") {
			ctx.beginPath();
			ctx.ellipse(w / 2, h / 2, w / 2 - inset, h / 2 - inset, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		} else {
			ctx.fillRect(inset, inset, w - inset * 2, h - inset * 2);
			ctx.strokeRect(inset + 1, inset + 1, w - inset * 2 - 2, h - inset * 2 - 2);
		}

		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("shape encode failed"))), "image/png");
		});
		const file = new File([blob], `shape_${kind}_${Date.now()}.png`, { type: "image/png" });
		const dt = new DataTransfer();
		dt.items.add(file);
		const processed = await processMediaAssets({ files: dt.files, onProgress: () => {} });
		for (const asset of processed) {
			const mediaId = await editor.media.addMediaAsset({
				projectId: project.metadata.id,
				asset,
			});
			const element = buildImageElement({
				mediaId,
				name: kind === "ellipse" ? "Ellipse" : "Rectangle",
				duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
				startTime: 0,
			});
			if (position) {
				element.transform = {
					scale: 1,
					position: { x: position.x, y: position.y },
					rotate: 0,
				};
			}
			editor.timeline.insertElement({ element, placement: { mode: "auto" } });
		}
	}

	function insertTextLayer(position?: { x: number; y: number }) {
		const editor = EditorCore.getInstance();
		const element = buildTextElement({
			raw: {
				content: "Text",
				name: "Text",
				duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
				color: fillColor.value,
				transform: position
					? { scale: 1, position: { x: position.x, y: position.y }, rotate: 0 }
					: undefined,
			},
			startTime: editor.playback.getCurrentTime(),
		});
		editor.timeline.insertElement({ element, placement: { mode: "auto" } });
	}

	function swapFillStroke() {
		const nextFill = strokeColor.value;
		strokeColor.value = fillColor.value;
		fillColor.value = nextFill;
	}

	async function applyFillAtCanvasPoint(canvasX: number, canvasY: number) {
		const { floodFillAtCanvasPoint } = await import("../lib/image-pixel-edits");
		const filled = await floodFillAtCanvasPoint({
			canvasX,
			canvasY,
			color: fillColor.value,
			tolerance: fillTolerance.value,
			selection: getLiveSelection(),
		});
		if (filled) return;
		const selected = EditorCore.getInstance().selection.getSelectedElements();
		const track = selected[0]
			? EditorCore.getInstance().timeline.getTracks().find((t) => t.id === selected[0].trackId)
			: null;
		const el = track?.elements.find((e) => e.id === selected[0]?.elementId);
		if (el?.type === "image") return;
		await fillCanvasBackground();
	}

	async function applyMagicWandAtCanvasPoint(canvasX: number, canvasY: number) {
		const { magicWandAtCanvasPoint } = await import("../lib/image-pixel-edits");
		const selection = await magicWandAtCanvasPoint({
			canvasX,
			canvasY,
			tolerance: wandTolerance.value,
			contiguous: wandContiguous.value,
		});
		setSelection(selection);
	}

	async function fillCanvasBackground() {
		const editor = EditorCore.getInstance();
		const project = editor.project.getActiveOrNull();
		if (!project) return;
		const selection = getLiveSelection();
		if (selection && (selection.type === "path" || (selection.width > 0.005 && selection.height > 0.005))) {
			const { width: cw, height: ch } = project.settings.canvasSize;
			const w = Math.max(1, Math.round(selection.width * cw));
			const h = Math.max(1, Math.round(selection.height * ch));
			const canvas = document.createElement("canvas");
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.fillStyle = fillColor.value;
			if (selection.type === "path") {
				const rings = selection.rings?.length ? selection.rings : selection.points ? [selection.points] : [];
				ctx.beginPath();
				for (const ring of rings) {
					ring.forEach((p, i) => {
						const px = ((p.x - selection.x) / Math.max(selection.width, 1e-6)) * w;
						const py = ((p.y - selection.y) / Math.max(selection.height, 1e-6)) * h;
						if (i === 0) ctx.moveTo(px, py);
						else ctx.lineTo(px, py);
					});
					ctx.closePath();
				}
				ctx.fill(rings.length > 1 ? "evenodd" : "nonzero");
			} else if (selection.type === "ellipse") {
				ctx.beginPath();
				ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
				ctx.fill();
			} else {
				ctx.fillRect(0, 0, w, h);
			}
			const blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("fill encode failed"))), "image/png");
			});
			const file = new File([blob], `fill_${Date.now()}.png`, { type: "image/png" });
			const dt = new DataTransfer();
			dt.items.add(file);
			const processed = await processMediaAssets({ files: dt.files, onProgress: () => {} });
			for (const asset of processed) {
				const mediaId = await editor.media.addMediaAsset({
					projectId: project.metadata.id,
					asset,
				});
				const element = buildImageElement({
					mediaId,
					name: "Fill",
					duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
					startTime: 0,
				});
				element.transform = {
					scale: 1,
					position: {
						x: (selection.x + selection.width / 2 - 0.5) * cw,
						y: (selection.y + selection.height / 2 - 0.5) * ch,
					},
					rotate: 0,
				};
				editor.timeline.insertElement({ element, placement: { mode: "auto" } });
			}
			return;
		}
		await editor.project.updateSettings({
			settings: {
				background: { type: "color", color: fillColor.value },
			},
		});
	}

	return {
		activeTool: tool,
		setTool,
		activateTool,
		cycleEraserTools,
		cycleToolsByShortcut,
		getSlotVisibleTool,
		flyoutLastTool,
		selectFirstImageIfNeeded,
		brushSize,
		brushOpacity,
		brushHardness,
		fillTolerance,
		wandTolerance,
		wandContiguous,
		fillColor,
		strokeColor,
		shapeKind,
		marqueeKind,
		marqueeDraft,
		setSelection,
		getLiveSelection,
		applyFillAtCanvasPoint,
		applyMagicWandAtCanvasPoint,
		insertShapeLayer,
		insertTextLayer,
		fillCanvasBackground,
		swapFillStroke,
	};
}

export { IMAGE_TOOL_RAIL, IMAGE_TOOL_FLYouts, IMAGE_TOOL_BY_ID, findFlyoutSlotForTool };
