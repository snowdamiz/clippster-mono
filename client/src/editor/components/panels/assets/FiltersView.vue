<script setup lang="ts">
import { ref, computed } from "vue";
import { FILTER_PRESETS } from "../../../constants/filter-constants";
import type { FilterPreset } from "../../../types/filters";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import { Palette, Check } from "lucide-vue-next";
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
		<PanelSearchBar v-model="searchQuery" placeholder="Search filters..." />

		<div class="flex-1 overflow-y-auto p-2">
			<!-- No element selected hint -->
			<div v-if="!selectedElement" class="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
				<Palette class="size-8 text-zinc-600" :stroke-width="1" />
				<p class="text-xs text-zinc-500">Select a video or image element to apply a filter</p>
			</div>

			<template v-else>
				<div v-if="filteredPresets.length === 0" class="flex items-center justify-center py-8">
					<p class="text-xs text-zinc-500">No filters found</p>
				</div>

				<div v-else class="grid grid-cols-2 gap-1.5">
					<!-- None / Reset option -->
					<button
						class="group relative cursor-pointer overflow-hidden rounded-lg border transition-all"
						:class="!activeFilterId
							? 'border-white/20 bg-white/[0.06]'
							: 'border-white/[0.06] bg-zinc-950 hover:border-white/15'"
						@click="applyFilter({ id: '__none__', label: 'None', description: '', category: 'warm', adjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0 } })"
					>
						<div class="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-zinc-900">
							<span class="text-2xl text-zinc-600">⊘</span>
						</div>
						<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4">
							<p class="text-[10px] font-medium leading-tight" :class="!activeFilterId ? 'text-white' : 'text-zinc-200 group-hover:text-white'">None</p>
						</div>
						<div v-if="!activeFilterId" class="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-white/20">
							<Check class="size-2.5 text-white" />
						</div>
					</button>

					<button
						v-for="preset in filteredPresets"
						:key="preset.id"
						class="group relative cursor-pointer overflow-hidden rounded-lg border transition-all"
						:class="activeFilterId === preset.id
							? 'border-white/20 bg-white/[0.06]'
							: 'border-white/[0.06] bg-zinc-950 hover:border-white/15'"
						@click="applyFilter(preset)"
					>
						<!-- Filter preview -->
						<div class="aspect-[4/3] w-full overflow-hidden">
							<img
								src="/editor/stock/city-sunset.jpg"
								:alt="preset.label"
								class="size-full object-cover"
								:style="{ filter: getFilterPreviewStyle(preset) }"
							/>
						</div>
						<!-- Label overlay -->
						<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4">
							<p class="text-[10px] font-medium leading-tight" :class="activeFilterId === preset.id ? 'text-white' : 'text-zinc-200 group-hover:text-white'">{{ preset.label }}</p>
						</div>
						<!-- Active checkmark -->
						<div v-if="activeFilterId === preset.id" class="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-white/20">
							<Check class="size-2.5 text-white" />
						</div>
					</button>
				</div>
			</template>
		</div>
	</div>
</template>
