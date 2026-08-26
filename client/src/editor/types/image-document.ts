/**
 * Pixel-document model for Image Editor (Phase 5 architecture).
 *
 * Compositor mode (EditorCore timeline elements) remains the v1 ship path.
 * This module defines the durable document types a WASM/WebGPU pixel engine
 * can mount without rewriting project persistence — `ImageDocument` nests
 * alongside (or eventually replaces) timeline scenes in project_data.
 */

export type PixelBlendMode =
	| "normal"
	| "multiply"
	| "screen"
	| "overlay"
	| "soft-light"
	| "hard-light"
	| "darken"
	| "lighten"
	| "color-dodge"
	| "color-burn"
	| "difference"
	| "exclusion";

export type PixelToolId =
	| "move"
	| "marquee-rect"
	| "marquee-ellipse"
	| "lasso"
	| "crop"
	| "brush"
	| "eraser"
	| "fill"
	| "gradient"
	| "eyedropper"
	| "text"
	| "shape"
	| "hand"
	| "zoom"
	| "clone"
	| "heal";

export interface PixelSelection {
	type: "rect" | "ellipse" | "path" | "mask";
	/** Normalized 0–1 rect when type is rect/ellipse */
	x: number;
	y: number;
	width: number;
	height: number;
	feather?: number;
	inverted?: boolean;
	/** Optional mask bitmap id for path/magic selections */
	maskAssetId?: string;
}

export interface PixelLayerMask {
	id: string;
	/** Greyscale bitmap asset id (white = visible) */
	assetId: string;
	enabled: boolean;
	linked: boolean;
}

export interface PixelRasterLayer {
	id: string;
	kind: "raster";
	name: string;
	/** Bitmap asset id in media store */
	assetId: string;
	opacity: number;
	fill: number;
	blendMode: PixelBlendMode;
	visible: boolean;
	locked: boolean;
	lockTransparent?: boolean;
	lockPosition?: boolean;
	mask?: PixelLayerMask | null;
	clippingMask?: boolean;
}

export interface PixelAdjustmentLayer {
	id: string;
	kind: "adjustment";
	name: string;
	adjustment:
		| { type: "brightnessContrast"; brightness: number; contrast: number }
		| { type: "hsl"; h: number; s: number; l: number }
		| { type: "levels"; shadows: number; midtones: number; highlights: number }
		| { type: "exposure"; exposure: number; gamma: number }
		| { type: "invert" }
		| { type: "blackWhite"; strength: number };
	opacity: number;
	blendMode: PixelBlendMode;
	visible: boolean;
	locked: boolean;
	mask?: PixelLayerMask | null;
}

export interface PixelGroupLayer {
	id: string;
	kind: "group";
	name: string;
	children: PixelLayer[];
	opacity: number;
	blendMode: PixelBlendMode;
	visible: boolean;
	locked: boolean;
	collapsed?: boolean;
}

/** Compositor-linked layer (text/shape still owned by EditorCore until fully migrated) */
export interface PixelCompositorRefLayer {
	id: string;
	kind: "compositor-ref";
	name: string;
	/** Timeline element id */
	elementId: string;
	trackId: string;
	opacity: number;
	visible: boolean;
	locked: boolean;
}

export type PixelLayer =
	| PixelRasterLayer
	| PixelAdjustmentLayer
	| PixelGroupLayer
	| PixelCompositorRefLayer;

export interface PixelHistoryEntry {
	id: string;
	name: string;
	timestamp: number;
	/** Opaque engine snapshot id or serialized patch */
	snapshotRef: string;
}

export interface ImageDocument {
	version: 1;
	width: number;
	height: number;
	dpi?: number;
	colorSpace: "srgb";
	layers: PixelLayer[];
	selection: PixelSelection | null;
	activeLayerId: string | null;
	activeTool: PixelToolId;
	history: PixelHistoryEntry[];
	historyIndex: number;
	/** Checkerboard / guides metadata */
	guides?: Array<{ orientation: "h" | "v"; position: number }>;
}

export const IMAGE_DOCUMENT_KEY = "imageDocument" as const;

export function createEmptyImageDocument(width: number, height: number): ImageDocument {
	const baseId = `raster_${Date.now()}`;
	return {
		version: 1,
		width,
		height,
		colorSpace: "srgb",
		layers: [
			{
				id: baseId,
				kind: "raster",
				name: "Background",
				assetId: "",
				opacity: 1,
				fill: 1,
				blendMode: "normal",
				visible: true,
				locked: false,
				mask: null,
			},
		],
		selection: null,
		activeLayerId: baseId,
		activeTool: "move",
		history: [],
		historyIndex: -1,
		guides: [],
	};
}

/** Read ImageDocument from SerializedProject-like settings bag without breaking old projects. */
export function readImageDocumentFromProjectData(projectData: unknown): ImageDocument | null {
	if (!projectData || typeof projectData !== "object") return null;
	const settings = (projectData as { settings?: Record<string, unknown> }).settings;
	const doc = settings?.[IMAGE_DOCUMENT_KEY];
	if (!doc || typeof doc !== "object") return null;
	const d = doc as ImageDocument;
	if (d.version !== 1 || !Array.isArray(d.layers)) return null;
	return d;
}

export function attachImageDocumentToSettings<T extends Record<string, unknown>>(
	settings: T,
	doc: ImageDocument,
): T & { [IMAGE_DOCUMENT_KEY]: ImageDocument } {
	return { ...settings, [IMAGE_DOCUMENT_KEY]: doc };
}
