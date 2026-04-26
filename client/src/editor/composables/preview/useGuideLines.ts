import { ref, computed } from "vue";
import { nanoid } from "nanoid";

export type GuideAxis = "x" | "y";
export type GuideMode = "custom" | "thirds" | "safe";

export interface GuideLine {
	id: string;
	axis: GuideAxis;
	/** Normalised position 0–1 relative to canvas width (x) or height (y). */
	position: number;
	mode: GuideMode;
}

const customGuides = ref<GuideLine[]>([]);
const showThirds = ref(false);
const showSafeMargins = ref(false);
const guidesVisible = ref(true);

/** Computed rule-of-thirds guides (33% / 66% on each axis). */
const thirdsGuides = computed<GuideLine[]>(() => {
	if (!showThirds.value) return [];
	return [
		{ id: "thirds-x1", axis: "x", position: 1 / 3, mode: "thirds" },
		{ id: "thirds-x2", axis: "x", position: 2 / 3, mode: "thirds" },
		{ id: "thirds-y1", axis: "y", position: 1 / 3, mode: "thirds" },
		{ id: "thirds-y2", axis: "y", position: 2 / 3, mode: "thirds" },
	];
});

/** Computed safe-margin guides (5% and 10% inset on each edge). */
const safeGuides = computed<GuideLine[]>(() => {
	if (!showSafeMargins.value) return [];
	return [
		{ id: "safe-x-5a", axis: "x", position: 0.05, mode: "safe" },
		{ id: "safe-x-5b", axis: "x", position: 0.95, mode: "safe" },
		{ id: "safe-y-5a", axis: "y", position: 0.05, mode: "safe" },
		{ id: "safe-y-5b", axis: "y", position: 0.95, mode: "safe" },
		{ id: "safe-x-10a", axis: "x", position: 0.10, mode: "safe" },
		{ id: "safe-x-10b", axis: "x", position: 0.90, mode: "safe" },
		{ id: "safe-y-10a", axis: "y", position: 0.10, mode: "safe" },
		{ id: "safe-y-10b", axis: "y", position: 0.90, mode: "safe" },
	];
});

/** All visible guide lines combined. */
const allGuides = computed<GuideLine[]>(() => {
	if (!guidesVisible.value) return [];
	return [...customGuides.value, ...thirdsGuides.value, ...safeGuides.value];
});

function addGuide(axis: GuideAxis, position: number): GuideLine {
	const guide: GuideLine = { id: nanoid(8), axis, position, mode: "custom" };
	customGuides.value = [...customGuides.value, guide];
	return guide;
}

function removeGuide(id: string): void {
	customGuides.value = customGuides.value.filter((g) => g.id !== id);
}

function updateGuide(id: string, position: number): void {
	customGuides.value = customGuides.value.map((g) =>
		g.id === id ? { ...g, position: Math.max(0, Math.min(1, position)) } : g,
	);
}

function clearCustomGuides(): void {
	customGuides.value = [];
}

/** Snap threshold in normalised canvas units (0.01 = 1% of canvas dimension). */
const GUIDE_SNAP_THRESHOLD = 0.015;

/**
 * Returns the closest guide position on the given axis if within snap threshold,
 * otherwise returns null.
 */
function snapToGuide(axis: GuideAxis, normalizedPos: number): number | null {
	if (!guidesVisible.value) return null;
	let closest: number | null = null;
	let closestDist = GUIDE_SNAP_THRESHOLD;
	for (const g of allGuides.value) {
		if (g.axis !== axis) continue;
		const dist = Math.abs(g.position - normalizedPos);
		if (dist < closestDist) {
			closestDist = dist;
			closest = g.position;
		}
	}
	return closest;
}

export function useGuideLines() {
	return {
		customGuides,
		allGuides,
		guidesVisible,
		showThirds,
		showSafeMargins,
		addGuide,
		removeGuide,
		updateGuide,
		clearCustomGuides,
		snapToGuide,
	};
}
