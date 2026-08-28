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

const activeTool = ref<PixelToolId>("move");
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

	function activateTool(id: PixelToolId) {
		setTool(id);
		if (id === "crop") {
			selectFirstImageIfNeeded();
			enterCropMode();
		} else if (id === "magic-wand") {
			selectFirstImageIfNeeded();
			if (isCropMode.value) exitCropMode();
		} else if (isCropMode.value) {
			exitCropMode();
		}
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

export const IMAGE_TOOL_RAIL: Array<{
	id: PixelToolId;
	label: string;
	shortcut: string;
	group: "select" | "paint" | "type" | "nav";
}> = [
	{ id: "move", label: "Move", shortcut: "V", group: "select" },
	{ id: "marquee-rect", label: "Marquee", shortcut: "M", group: "select" },
	{ id: "lasso", label: "Lasso", shortcut: "L", group: "select" },
	{ id: "magic-wand", label: "Wand", shortcut: "W", group: "select" },
	{ id: "crop", label: "Crop", shortcut: "C", group: "select" },
	{ id: "brush", label: "Brush", shortcut: "B", group: "paint" },
	{ id: "eraser", label: "Eraser", shortcut: "E", group: "paint" },
	{ id: "fill", label: "Fill", shortcut: "G", group: "paint" },
	{ id: "gradient", label: "Gradient", shortcut: "R", group: "paint" },
	{ id: "clone", label: "Clone", shortcut: "S", group: "paint" },
	{ id: "heal", label: "Heal", shortcut: "J", group: "paint" },
	{ id: "eyedropper", label: "Eyedropper", shortcut: "I", group: "paint" },
	{ id: "text", label: "Type", shortcut: "T", group: "type" },
	{ id: "shape", label: "Shape", shortcut: "U", group: "type" },
	{ id: "hand", label: "Hand", shortcut: "H", group: "nav" },
	{ id: "zoom", label: "Zoom", shortcut: "Z", group: "nav" },
];
