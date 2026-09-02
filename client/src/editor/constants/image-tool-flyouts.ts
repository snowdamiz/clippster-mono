/**
 * Photoshop-style toolbar flyout layout for Image Editor.
 *
 * Each slot shows one icon (last-selected tool). A corner triangle means
 * related tools are nested — reveal via click-hold, right-click, or hover.
 * Shared shortcut letters cycle with Shift (Photoshop convention).
 *
 * Reference: Photoshop 2025 toolbar groups (Move → Selection → Crop →
 * Measure → Retouch/Paint → Draw/Type → Navigate).
 */
import type { PixelToolId } from "../types/image-document";

export type ToolRailSection = "select" | "crop" | "measure" | "retouch" | "draw" | "nav";

export interface ImageToolDef {
	id: PixelToolId;
	label: string;
	/** Shared letter shortcut for the flyout group (Photoshop). */
	shortcut: string;
	/** Short hint shown in the flyout / options bar. */
	hint?: string;
}

export interface ImageToolFlyoutSlot {
	/** Stable slot id (not a tool id) — e.g. "eraser". */
	id: string;
	section: ToolRailSection;
	/** Default / first tool in the flyout. */
	defaultTool: PixelToolId;
	tools: ImageToolDef[];
}

/** Full flyout map — only tools that are wired in the editor. */
export const IMAGE_TOOL_FLYouts: ImageToolFlyoutSlot[] = [
	{
		id: "move",
		section: "select",
		defaultTool: "move",
		tools: [{ id: "move", label: "Move Tool", shortcut: "V", hint: "Drag to move layers" }],
	},
	{
		id: "marquee",
		section: "select",
		defaultTool: "marquee-rect",
		tools: [
			{ id: "marquee-rect", label: "Rectangular Marquee Tool", shortcut: "M", hint: "Drag a rectangle" },
			{ id: "marquee-ellipse", label: "Elliptical Marquee Tool", shortcut: "M", hint: "Drag an ellipse" },
		],
	},
	{
		id: "lasso",
		section: "select",
		defaultTool: "lasso",
		tools: [
			{ id: "lasso", label: "Lasso Tool", shortcut: "L", hint: "Freehand selection" },
			{ id: "polygonal-lasso", label: "Polygonal Lasso Tool", shortcut: "L", hint: "Click for straight edges · Double-click to close" },
		],
	},
	{
		id: "wand",
		section: "select",
		defaultTool: "magic-wand",
		tools: [
			{ id: "magic-wand", label: "Magic Wand Tool", shortcut: "W", hint: "Click similar colors" },
		],
	},
	{
		id: "crop",
		section: "crop",
		defaultTool: "crop",
		tools: [{ id: "crop", label: "Crop Tool", shortcut: "C", hint: "Drag handles, then confirm" }],
	},
	{
		id: "eyedropper",
		section: "measure",
		defaultTool: "eyedropper",
		tools: [
			{ id: "eyedropper", label: "Eyedropper Tool", shortcut: "I", hint: "Click to sample a color" },
		],
	},
	{
		id: "heal",
		section: "retouch",
		defaultTool: "heal",
		tools: [
			{ id: "heal", label: "Healing Brush Tool", shortcut: "J", hint: "Alt-click source · Drag to heal" },
			{ id: "spot-heal", label: "Spot Healing Brush Tool", shortcut: "J", hint: "Paint over blemishes" },
		],
	},
	{
		id: "brush",
		section: "retouch",
		defaultTool: "brush",
		tools: [
			{ id: "brush", label: "Brush Tool", shortcut: "B", hint: "Paint with soft or hard edges" },
			{ id: "pencil", label: "Pencil Tool", shortcut: "B", hint: "Always hard-edged strokes" },
		],
	},
	{
		id: "clone",
		section: "retouch",
		defaultTool: "clone",
		tools: [
			{ id: "clone", label: "Clone Stamp Tool", shortcut: "S", hint: "Alt-click source · Drag to stamp" },
		],
	},
	{
		id: "eraser",
		section: "retouch",
		defaultTool: "eraser",
		tools: [
			{ id: "eraser", label: "Eraser Tool", shortcut: "E", hint: "Drag to erase pixels" },
			{
				id: "background-eraser",
				label: "Background Eraser Tool",
				shortcut: "E",
				hint: "Erase by sampled color under the crosshair",
			},
			{
				id: "magic-eraser",
				label: "Magic Eraser Tool",
				shortcut: "E",
				hint: "Click to erase similar colors",
			},
		],
	},
	{
		id: "gradient",
		section: "retouch",
		defaultTool: "gradient",
		tools: [
			{ id: "gradient", label: "Gradient Tool", shortcut: "G", hint: "Drag to blend fill → stroke" },
			{ id: "fill", label: "Paint Bucket Tool", shortcut: "G", hint: "Click to flood-fill" },
		],
	},
	{
		id: "type",
		section: "draw",
		defaultTool: "text",
		tools: [{ id: "text", label: "Horizontal Type Tool", shortcut: "T", hint: "Click to place text" }],
	},
	{
		id: "shape",
		section: "draw",
		defaultTool: "shape-rect",
		tools: [
			{ id: "shape-rect", label: "Rectangle Tool", shortcut: "U", hint: "Click to place a rectangle" },
			{ id: "shape-ellipse", label: "Ellipse Tool", shortcut: "U", hint: "Click to place an ellipse" },
		],
	},
	{
		id: "hand",
		section: "nav",
		defaultTool: "hand",
		tools: [{ id: "hand", label: "Hand Tool", shortcut: "H", hint: "Drag to pan" }],
	},
	{
		id: "zoom",
		section: "nav",
		defaultTool: "zoom",
		tools: [{ id: "zoom", label: "Zoom Tool", shortcut: "Z", hint: "Click to zoom in · Alt-click out" }],
	},
];

/** Flat list for lookups / options bar labels. */
export const IMAGE_TOOL_BY_ID: Record<string, ImageToolDef> = Object.fromEntries(
	IMAGE_TOOL_FLYouts.flatMap((slot) => slot.tools.map((t) => [t.id, t])),
);

export function findFlyoutSlotForTool(toolId: PixelToolId): ImageToolFlyoutSlot | null {
	return IMAGE_TOOL_FLYouts.find((slot) => slot.tools.some((t) => t.id === toolId)) ?? null;
}

export function toolsSharingShortcut(shortcut: string): ImageToolDef[] {
	const key = shortcut.toLowerCase();
	const seen = new Set<PixelToolId>();
	const out: ImageToolDef[] = [];
	for (const slot of IMAGE_TOOL_FLYouts) {
		for (const tool of slot.tools) {
			if (tool.shortcut.toLowerCase() !== key || seen.has(tool.id)) continue;
			seen.add(tool.id);
			out.push(tool);
		}
	}
	return out;
}

/** @deprecated Prefer IMAGE_TOOL_FLYouts — kept for any leftover flat-rail imports. */
export const IMAGE_TOOL_RAIL = IMAGE_TOOL_FLYouts.flatMap((slot) =>
	slot.tools.map((t) => ({
		id: t.id,
		label: t.label.replace(/ Tool$/, ""),
		shortcut: t.shortcut,
		group: slot.section === "nav" || slot.section === "draw" ? (slot.section === "nav" ? "nav" : "type") : slot.section === "select" || slot.section === "crop" ? "select" : "paint",
	})),
);
