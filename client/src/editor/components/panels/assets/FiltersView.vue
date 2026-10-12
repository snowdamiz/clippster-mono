<script setup lang="ts">
import { ref, computed } from "vue";
import { FILTER_PRESETS } from "../../../constants/filter-constants";
import type { FilterPreset } from "../../../types/filters";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import { Palette, Check, Ban, SearchX } from "lucide-vue-next";
import AssetGrid from "../shared/AssetGrid.vue";
import AssetTile from "../shared/AssetTile.vue";
import { EmptyState } from "@/components/ui/empty-state";
import PanelSearchBar from "./PanelSearchBar.vue";

const { editor } = useEditor({ subscribe: false });
const { selectedElements } = useElementSelection();

const searchQuery = ref("");

const filteredPresets = computed(() => {
	if (!searchQuery.value.trim()) return FILTER_PRESETS;
	const q = searchQuery.value.toLowerCase();
	return FILTER_PRESETS.filter(
		(p) => p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
	);
});

const selectedElement = computed(() => {
	if (selectedElements.value.length !== 1) return null;
	const sel = selectedElements.value[0];
	let scene;
	try { scene = editor.scenes.getActiveScene(); } catch { return null; }
	if (!scene) return null;
	for (const track of scene.tracks) {
		if (track.id !== sel.trackId) continue;
		const el = track.elements.find((e: any) => e.id === sel.elementId);
		if (el && (el.type === "video" || el.type === "image")) return { element: el, trackId: track.id };
	}
	return null;
});

const activeFilterId = computed(() => {
	const sel = selectedElement.value;
	if (!sel) return null;
	const el = sel.element as any;
	return el.filterPreset ?? null;
});

function applyFilter(preset: FilterPreset) {
	const sel = selectedElement.value;
	if (!sel) return;

	const isActive = activeFilterId.value === preset.id;

	if (isActive) {
		editor.timeline.updateElement({
			trackId: sel.trackId,
			elementId: sel.element.id,
			updates: {
				filterPreset: undefined,
				colorAdjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0 },
			} as any,
		});
		return;
	}

	const el = sel.element as any;
	const existingEffects = (el.effects ?? []).filter(
		(e: any) => e.type !== "sepia" && e.type !== "grayscale",
	);

	const newEffects = [...existingEffects];

	if (preset.sepiaBlend && preset.sepiaBlend > 0) {
		newEffects.push({
			id: `filter-sepia-${Date.now()}`,
			type: "sepia",
			enabled: true,
			intensity: preset.sepiaBlend,
		});
	}

	if (preset.grayscaleBlend && preset.grayscaleBlend > 0) {
		newEffects.push({
			id: `filter-grayscale-${Date.now()}`,
			type: "grayscale",
			enabled: true,
			intensity: preset.grayscaleBlend,
		});
	}

	editor.timeline.updateElement({
		trackId: sel.trackId,
		elementId: sel.element.id,
		updates: {
			filterPreset: preset.id,
			colorAdjustments: {
				brightness: preset.adjustments.brightness ?? 0,
				contrast: preset.adjustments.contrast ?? 0,
				saturation: preset.adjustments.saturation ?? 0,
				temperature: preset.adjustments.temperature ?? 0,
			},
			effects: newEffects,
		} as any,
	});
}

function getFilterPreviewStyle(preset: FilterPreset) {
	const parts: string[] = [];
	const a = preset.adjustments;
	if (a.brightness) parts.push(`brightness(${1 + a.brightness / 100})`);
	if (a.contrast) parts.push(`contrast(${1 + a.contrast / 100})`);
	if (a.saturation) parts.push(`saturate(${1 + a.saturation / 100})`);
	if (a.temperature) parts.push(`hue-rotate(${a.temperature * 0.3}deg)`);
	if (preset.sepiaBlend) parts.push(`sepia(${preset.sepiaBlend / 100})`);
	if (preset.grayscaleBlend) parts.push(`grayscale(${preset.grayscaleBlend / 100})`);
	return parts.length > 0 ? parts.join(" ") : "none";
}
</script>

<template>
	<div class="flex h-full flex-col">
		<PanelSearchBar v-model="searchQuery" placeholder="Search filters…" />

		<div class="flex flex-1 flex-col overflow-y-auto p-3">
			<!-- No element selected hint -->
			<EmptyState
				v-if="!selectedElement"
				size="sm"
				:icon="Palette"
				title="No layer selected"
				description="Select an image layer to apply a filter."
				class="flex-1"
			/>

			<template v-else>
				<EmptyState
					v-if="filteredPresets.length === 0"
					size="sm"
					:icon="SearchX"
					title="No filters found"
					description="Try a different search term."
				/>

				<AssetGrid v-else :min="88">
					<!-- None / Reset option -->
					<AssetTile
						label="None"
						:selected="!activeFilterId"
						@click="applyFilter({ id: '__none__', label: 'None', description: '', category: 'warm', adjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0 } })"
					>
						<div class="flex size-full items-center justify-center">
							<Ban class="size-6 text-fg-disabled" :stroke-width="1.5" />
						</div>
					</AssetTile>

					<AssetTile
						v-for="preset in filteredPresets"
						:key="preset.id"
						:label="preset.label"
						:selected="activeFilterId === preset.id"
						@click="applyFilter(preset)"
					>
						<!-- Filter preview (user-content rendering of the preset) -->
						<img
							src="/editor/stock/city-sunset.jpg"
							:alt="preset.label"
							class="size-full object-cover"
							:style="{ filter: getFilterPreviewStyle(preset) }"
						/>
					</AssetTile>
				</AssetGrid>
			</template>
		</div>
	</div>
</template>
