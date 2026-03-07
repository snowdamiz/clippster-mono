<script setup lang="ts">
import { ref, computed } from "vue";
import { FILTER_PRESETS, FILTER_CATEGORIES } from "../../../constants/filter-constants";
import type { FilterCategory, FilterPreset } from "../../../types/filters";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import { Palette, Check } from "lucide-vue-next";
import PanelSearchBar from "./PanelSearchBar.vue";

const { editor } = useEditor();
const { selectedElements } = useElementSelection();

const activeCategory = ref<FilterCategory | "all">("all");
const searchQuery = ref("");

const filteredPresets = computed(() => {
	let presets = FILTER_PRESETS;
	if (activeCategory.value !== "all") {
		presets = presets.filter((p) => p.category === activeCategory.value);
	}
	if (searchQuery.value.trim()) {
		const q = searchQuery.value.toLowerCase();
		presets = presets.filter(
			(p) => p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
		);
	}
	return presets;
});

const categoryTabs = computed(() => [
	{ key: "all" as const, label: "All" },
	...FILTER_CATEGORIES,
]);

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
		// Remove filter — reset color adjustments
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

	// Build effects array: keep non-sepia/grayscale effects, add filter blend effects
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
		<!-- Search -->
		<PanelSearchBar v-model="searchQuery" placeholder="Search filters..." />

		<!-- Category tabs -->
		<div class="flex items-center gap-0.5 overflow-x-auto border-b border-white/10 px-2 py-1">
			<button
				v-for="cat in categoryTabs"
				:key="cat.key"
				:class="[
					'whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
					activeCategory === cat.key
						? 'bg-blue-500/20 text-blue-400'
						: 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
				]"
				@click="activeCategory = cat.key"
			>
				{{ cat.label }}
			</button>
		</div>

		<!-- Filters grid -->
		<div class="flex-1 overflow-y-auto p-3">
			<!-- No element selected hint -->
			<div v-if="!selectedElement" class="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
				<Palette class="size-8 text-zinc-600" :stroke-width="1" />
				<p class="text-xs text-zinc-500">Select a video or image element to apply a filter</p>
			</div>

			<template v-else>
				<!-- None / Reset option -->
				<button
					:class="[
						'mb-3 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
						!activeFilterId
							? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
							: 'border-white/5 bg-white/[0.02] text-zinc-400 hover:border-white/10 hover:bg-white/5',
					]"
					@click="applyFilter({ id: '__none__', label: 'None', description: '', category: 'warm', adjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0 } })"
				>
					<div class="flex size-10 items-center justify-center rounded-md bg-white/5">
						<span class="text-lg">⊘</span>
					</div>
					<span>None</span>
					<Check v-if="!activeFilterId" class="ml-auto size-3.5" />
				</button>

				<div v-if="filteredPresets.length === 0" class="flex items-center justify-center py-8">
					<p class="text-xs text-zinc-500">No filters found</p>
				</div>

				<div v-else class="grid grid-cols-2 gap-2">
					<button
						v-for="preset in filteredPresets"
						:key="preset.id"
						:class="[
							'group flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all',
							activeFilterId === preset.id
								? 'border-blue-500/40 bg-blue-500/10'
								: 'border-white/5 bg-white/[0.02] hover:border-[#E040FB]/30 hover:bg-[#E040FB]/5',
						]"
						@click="applyFilter(preset)"
					>
						<!-- Filter preview (gradient with filter applied) -->
						<div class="relative w-full overflow-hidden rounded-md">
							<div
								class="aspect-video w-full"
								:style="{
									background: 'linear-gradient(135deg, #f97316 0%, #06b6d4 50%, #8b5cf6 100%)',
									filter: getFilterPreviewStyle(preset),
								}"
							/>
							<div v-if="activeFilterId === preset.id" class="absolute inset-0 flex items-center justify-center bg-black/30">
								<Check class="size-4 text-blue-400" />
							</div>
						</div>
						<div class="text-center">
							<p class="text-[11px] font-medium" :class="activeFilterId === preset.id ? 'text-blue-400' : 'text-zinc-300 group-hover:text-zinc-100'">{{ preset.label }}</p>
							<p class="mt-0.5 text-[9px] leading-tight text-zinc-600">{{ preset.description }}</p>
						</div>
					</button>
				</div>
			</template>
		</div>
	</div>
</template>
