/**
 * Shared definitions for the keyframe editor UI.
 *
 * Centralises the animatable property metadata (label, unit, range, display
 * scaling, graph colour), the per-element-type applicability rules, and the
 * interpolation/easing option list so the dope-sheet panel, curve editor, and
 * timeline keyframe popup all speak the same language.
 */
import type { KeyframableProperty, KeyframeInterpolation } from "../types/keyframes";
import { CLIP_GAIN_MAX } from "./audio-volume-ui";

export interface KeyframePropertyDef {
	key: KeyframableProperty;
	label: string;
	/** Label shown inside the inspector input row (matches Video tab). */
	inputLabel: string;
	/** Short unit suffix shown next to the value field. */
	unit: string;
	/** Clamp bounds in display units (i.e. after applying displayMultiplier). */
	min: number;
	max: number;
	step: number;
	/** Stored value × multiplier = displayed value (e.g. scale 1 → 100%). */
	displayMultiplier: number;
	/** Curve colour in graph mode. */
	color: string;
}

/** All keyframable properties in canonical display order. */
export const KEYFRAME_PROPERTY_DEFS: KeyframePropertyDef[] = [
	{ key: "scale", label: "Scale", inputLabel: "Scale", unit: "%", min: 10, max: 500, step: 1, displayMultiplier: 100, color: "#22c55e" },
	{ key: "positionX", label: "Position X", inputLabel: "X", unit: "px", min: -2000, max: 2000, step: 1, displayMultiplier: 1, color: "#f97316" },
	{ key: "positionY", label: "Position Y", inputLabel: "Y", unit: "px", min: -2000, max: 2000, step: 1, displayMultiplier: 1, color: "#ef4444" },
	{ key: "rotation", label: "Rotation", inputLabel: "Rotate", unit: "°", min: -360, max: 360, step: 1, displayMultiplier: 1, color: "#a855f7" },
	{ key: "opacity", label: "Opacity", inputLabel: "Opacity", unit: "%", min: 0, max: 100, step: 1, displayMultiplier: 100, color: "#3b82f6" },
	{ key: "volume", label: "Volume", inputLabel: "Volume", unit: "%", min: 0, max: Math.round(CLIP_GAIN_MAX * 100), step: 1, displayMultiplier: 100, color: "#facc15" },
	{ key: "speed", label: "Speed", inputLabel: "Speed", unit: "x", min: 10, max: 1000, step: 1, displayMultiplier: 100, color: "#06b6d4" },
];

const PROPERTY_DEF_BY_KEY = new Map(KEYFRAME_PROPERTY_DEFS.map((p) => [p.key, p]));

export function getKeyframePropertyDef(key: KeyframableProperty): KeyframePropertyDef {
	return PROPERTY_DEF_BY_KEY.get(key) ?? KEYFRAME_PROPERTY_DEFS[0];
}

export function getKeyframePropertyLabel(key: KeyframableProperty): string {
	return PROPERTY_DEF_BY_KEY.get(key)?.label ?? key;
}

/** Which properties can be animated for a given element type. */
export function getApplicableKeyframeProperties(elementType: string | undefined): KeyframePropertyDef[] {
	if (!elementType) return [];
	if (elementType === "audio") return KEYFRAME_PROPERTY_DEFS.filter((p) => p.key === "volume");
	if (elementType === "video") return KEYFRAME_PROPERTY_DEFS;
	// image / text / sticker / caption / effect: visual transform + opacity only
	return KEYFRAME_PROPERTY_DEFS.filter((p) => p.key !== "volume" && p.key !== "speed");
}

export interface EasingOption {
	id: KeyframeInterpolation;
	label: string;
	/** Grouping for the context menu, roughly mirroring DaVinci/AE categories. */
	group: "Basic" | "Smooth" | "Dynamic";
}

/**
 * Interpolation options for the easing picker. The interpolation is applied to
 * the segment leaving each keyframe (matches the data model in keyframes.ts).
 */
export const KEYFRAME_EASING_OPTIONS: EasingOption[] = [
	{ id: "linear", label: "Linear", group: "Basic" },
	{ id: "hold", label: "Hold (Step)", group: "Basic" },
	{ id: "ease-in", label: "Ease In", group: "Smooth" },
	{ id: "ease-out", label: "Ease Out", group: "Smooth" },
	{ id: "ease-in-out", label: "Ease In-Out", group: "Smooth" },
	{ id: "ease-in-cubic", label: "Cubic In", group: "Smooth" },
	{ id: "ease-out-cubic", label: "Cubic Out", group: "Smooth" },
	{ id: "ease-in-out-cubic", label: "Cubic In-Out", group: "Smooth" },
	{ id: "ease-in-expo", label: "Expo In", group: "Dynamic" },
	{ id: "ease-out-expo", label: "Expo Out", group: "Dynamic" },
	{ id: "ease-in-back", label: "Back In", group: "Dynamic" },
	{ id: "ease-out-back", label: "Back Out", group: "Dynamic" },
	{ id: "ease-out-bounce", label: "Bounce", group: "Dynamic" },
	{ id: "spring", label: "Spring", group: "Dynamic" },
];

const EASING_LABEL_BY_ID = new Map(KEYFRAME_EASING_OPTIONS.map((o) => [o.id, o.label]));

export function getEasingLabel(id: KeyframeInterpolation): string {
	return EASING_LABEL_BY_ID.get(id) ?? id;
}
