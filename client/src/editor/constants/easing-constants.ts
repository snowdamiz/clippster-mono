import type { KeyframeInterpolation } from "../types/keyframes";

export interface EasingPreset {
	id: KeyframeInterpolation;
	label: string;
	category: "basic" | "cubic" | "exponential" | "overshoot" | "special";
}

export const EASING_PRESETS: EasingPreset[] = [
	{ id: "linear", label: "Linear", category: "basic" },
	{ id: "ease-in", label: "Ease In", category: "basic" },
	{ id: "ease-out", label: "Ease Out", category: "basic" },
	{ id: "ease-in-out", label: "Ease In Out", category: "basic" },
	{ id: "hold", label: "Hold (Step)", category: "basic" },
	{ id: "ease-in-cubic", label: "Ease In Cubic", category: "cubic" },
	{ id: "ease-out-cubic", label: "Ease Out Cubic", category: "cubic" },
	{ id: "ease-in-out-cubic", label: "Ease In Out Cubic", category: "cubic" },
	{ id: "ease-in-expo", label: "Ease In Expo", category: "exponential" },
	{ id: "ease-out-expo", label: "Ease Out Expo", category: "exponential" },
	{ id: "ease-in-back", label: "Ease In Back", category: "overshoot" },
	{ id: "ease-out-back", label: "Ease Out Back", category: "overshoot" },
	{ id: "ease-out-bounce", label: "Bounce", category: "special" },
	{ id: "spring", label: "Spring", category: "special" },
];

export const EASING_CATEGORIES = [
	{ key: "basic", label: "Basic" },
	{ key: "cubic", label: "Cubic" },
	{ key: "exponential", label: "Exponential" },
	{ key: "overshoot", label: "Overshoot" },
	{ key: "special", label: "Special" },
] as const;
