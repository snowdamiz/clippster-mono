import type { ColorAdjustments } from "./timeline";

export type FilterCategory = "warm" | "cool" | "cinematic" | "vibrant" | "faded";

export interface FilterPreset {
	id: string;
	label: string;
	description: string;
	category: FilterCategory;
	/** Color adjustment overrides applied when this filter is selected */
	adjustments: Partial<ColorAdjustments>;
	/** Optional: blend a sepia/grayscale effect at a given strength (0-100) */
	sepiaBlend?: number;
	grayscaleBlend?: number;
}
