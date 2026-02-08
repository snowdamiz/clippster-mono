import type { FilterPreset, FilterCategory } from "../types/filters";

export const FILTER_CATEGORIES: { key: FilterCategory; label: string }[] = [
	{ key: "warm", label: "Warm" },
	{ key: "cool", label: "Cool" },
	{ key: "cinematic", label: "Cinematic" },
	{ key: "vibrant", label: "Vibrant" },
	{ key: "faded", label: "Faded / Matte" },
];

export const FILTER_PRESETS: FilterPreset[] = [
	// ── Warm ──
	{
		id: "warm-glow",
		label: "Warm Glow",
		description: "Golden warm tone",
		category: "warm",
		adjustments: { brightness: 5, contrast: 0, saturation: 15, temperature: 30 },
	},
	{
		id: "sunset",
		label: "Sunset",
		description: "Deep orange warmth",
		category: "warm",
		adjustments: { brightness: 0, contrast: 10, saturation: 20, temperature: 50 },
	},
	{
		id: "amber",
		label: "Amber",
		description: "Rich amber tone",
		category: "warm",
		adjustments: { brightness: 0, contrast: 0, saturation: 10, temperature: 40 },
		sepiaBlend: 20,
	},

	// ── Cool ──
	{
		id: "cool-blue",
		label: "Cool Blue",
		description: "Subtle blue tint",
		category: "cool",
		adjustments: { brightness: 0, contrast: 0, saturation: 10, temperature: -30 },
	},
	{
		id: "arctic",
		label: "Arctic",
		description: "Icy blue-white",
		category: "cool",
		adjustments: { brightness: 10, contrast: 0, saturation: -20, temperature: -50 },
	},
	{
		id: "moonlight",
		label: "Moonlight",
		description: "Cool night look",
		category: "cool",
		adjustments: { brightness: -10, contrast: 15, saturation: 0, temperature: -25 },
	},

	// ── Cinematic ──
	{
		id: "teal-orange",
		label: "Teal & Orange",
		description: "Hollywood blockbuster",
		category: "cinematic",
		adjustments: { brightness: 0, contrast: 15, saturation: 20, temperature: 10 },
	},
	{
		id: "film-noir",
		label: "Film Noir",
		description: "High contrast B&W",
		category: "cinematic",
		adjustments: { brightness: -10, contrast: 40, saturation: 0, temperature: 0 },
		grayscaleBlend: 100,
	},
	{
		id: "vintage",
		label: "Vintage",
		description: "Faded retro film",
		category: "cinematic",
		adjustments: { brightness: 5, contrast: -15, saturation: -30, temperature: 0 },
		sepiaBlend: 15,
	},
	{
		id: "cinematic",
		label: "Cinematic",
		description: "Subtle cinema grade",
		category: "cinematic",
		adjustments: { brightness: 0, contrast: 20, saturation: 10, temperature: 5 },
	},

	// ── Vibrant ──
	{
		id: "vivid",
		label: "Vivid",
		description: "Punchy colors",
		category: "vibrant",
		adjustments: { brightness: 0, contrast: 15, saturation: 40, temperature: 0 },
	},
	{
		id: "pop",
		label: "Pop",
		description: "Bright and bold",
		category: "vibrant",
		adjustments: { brightness: 10, contrast: 20, saturation: 30, temperature: 0 },
	},
	{
		id: "neon",
		label: "Neon",
		description: "Electric colors",
		category: "vibrant",
		adjustments: { brightness: 0, contrast: 25, saturation: 60, temperature: 0 },
	},

	// ── Faded / Matte ──
	{
		id: "matte",
		label: "Matte",
		description: "Lifted blacks",
		category: "faded",
		adjustments: { brightness: 5, contrast: -10, saturation: -5, temperature: 0 },
	},
	{
		id: "faded",
		label: "Faded",
		description: "Washed out look",
		category: "faded",
		adjustments: { brightness: 15, contrast: -20, saturation: -25, temperature: 0 },
	},
	{
		id: "pastel",
		label: "Pastel",
		description: "Soft pastel tones",
		category: "faded",
		adjustments: { brightness: 20, contrast: -15, saturation: -15, temperature: 0 },
	},
];

export function getFilterPreset(id: string): FilterPreset | undefined {
	return FILTER_PRESETS.find((p) => p.id === id);
}
