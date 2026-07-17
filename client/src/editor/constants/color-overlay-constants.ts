import type { ColorOverlayBlendMode } from "../types/effects";

/** UI options for Solid Color / colorOverlay blend modes (export-backed). */
export const COLOR_OVERLAY_BLEND_OPTIONS: { value: ColorOverlayBlendMode; label: string }[] = [
	{ value: "multiply", label: "Multiply" },
	{ value: "screen", label: "Screen" },
	{ value: "overlay", label: "Overlay" },
	{ value: "soft-light", label: "Soft Light" },
	{ value: "hard-light", label: "Hard Light" },
	{ value: "darken", label: "Darken" },
	{ value: "lighten", label: "Lighten" },
	{ value: "color-dodge", label: "Color Dodge" },
	{ value: "color-burn", label: "Color Burn" },
	{ value: "difference", label: "Difference" },
	{ value: "exclusion", label: "Exclusion" },
];
