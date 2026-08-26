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

const activeTool = ref<PixelToolId>("move");
const brushSize = ref(24);
const brushOpacity = ref(1);
const brushHardness = ref(0.8);
const fillColor = ref("#ffffff");
const strokeColor = ref("#000000");
const marqueeDraft = ref<PixelSelection | null>(null);

export function useImageEditorTools() {
	const tool = computed(() => activeTool.value);

	function setTool(id: PixelToolId) {
		activeTool.value = id;
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

	async function insertShapeLayer(kind: "rect" | "ellipse" = "rect") {
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

		ctx.fillStyle = fillColor.value;
		if (kind === "ellipse") {
			ctx.beginPath();
			ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
			ctx.fill();
		} else {
			ctx.fillRect(0, 0, w, h);
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
			editor.timeline.insertElement({ element, placement: { mode: "auto" } });
		}
	}

	function insertTextLayer() {
		const editor = EditorCore.getInstance();
		const element = buildTextElement({
			raw: {
				content: "Text",
				name: "Text",
				duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
				color: fillColor.value,
			},
			startTime: editor.playback.getCurrentTime(),
		});
		editor.timeline.insertElement({ element, placement: { mode: "auto" } });
	}

	async function fillCanvasBackground() {
		const editor = EditorCore.getInstance();
		const project = editor.project.getActiveOrNull();
		if (!project) return;
		await editor.project.updateSettings({
			settings: {
				background: { type: "color", color: fillColor.value },
			},
		});
	}

	return {
		activeTool: tool,
		setTool,
		brushSize,
		brushOpacity,
		brushHardness,
		fillColor,
		strokeColor,
		marqueeDraft,
		setSelection,
		insertShapeLayer,
		insertTextLayer,
		fillCanvasBackground,
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
	{ id: "crop", label: "Crop", shortcut: "C", group: "select" },
	{ id: "brush", label: "Brush", shortcut: "B", group: "paint" },
	{ id: "eraser", label: "Eraser", shortcut: "E", group: "paint" },
	{ id: "fill", label: "Fill", shortcut: "G", group: "paint" },
	{ id: "eyedropper", label: "Eyedropper", shortcut: "I", group: "paint" },
	{ id: "text", label: "Type", shortcut: "T", group: "type" },
	{ id: "shape", label: "Shape", shortcut: "U", group: "type" },
	{ id: "hand", label: "Hand", shortcut: "H", group: "nav" },
	{ id: "zoom", label: "Zoom", shortcut: "Z", group: "nav" },
];
