<script setup lang="ts">
import { ref, computed } from "vue";
import { EFFECT_PRESETS, EFFECT_CATEGORIES } from "../../../constants/effect-constants";
import type { VideoEffectCategory, VideoEffectPreset } from "../../../types/effects";
import { setDragData } from "../../../lib/drag-data";
import { useEffectPreviews } from "../../../composables/usePreviewThumbnails";
import { GripVertical } from "lucide-vue-next";
import PanelSearchBar from "./PanelSearchBar.vue";

const activeCategory = ref<VideoEffectCategory | "all">("all");
const searchQuery = ref("");

const effectTypes = EFFECT_PRESETS.map((p) => p.type);
const previews = useEffectPreviews(effectTypes);

const filteredPresets = computed(() => {
	let presets = EFFECT_PRESETS;
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

function handleDragStart(e: DragEvent, preset: VideoEffectPreset) {
	if (!e.dataTransfer) return;
	const params: Record<string, number | string> = {};
	for (const [key, value] of Object.entries(preset.defaults)) {
		if (key === "type" || key === "enabled" || key === "intensity") continue;
		if (typeof value === "number" || typeof value === "string") {
			params[key] = value;
		}
	}
	setDragData({
		dataTransfer: e.dataTransfer,
		dragData: {
			id: preset.type,
			type: "effect",
			name: preset.label,
			effectType: preset.type,
			intensity: preset.defaults.intensity,
			params,
		},
	});
	e.dataTransfer.effectAllowed = "copy";
}

const categoryTabs = computed(() => [
	{ key: "all" as const, label: "All" },
	...EFFECT_CATEGORIES,
]);
</script>

<template>
	<div class="flex h-full flex-col">
		<!-- Search -->
		<PanelSearchBar v-model="searchQuery" placeholder="Search effects..." />

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

		<!-- Effects grid -->
		<div class="flex-1 overflow-y-auto p-3">
			<div class="mb-3 flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
				<GripVertical class="size-3.5 shrink-0 text-zinc-600" />
				<p class="text-[11px] text-zinc-500">Drag onto a clip to apply, or onto empty space for a track effect</p>
			</div>

			<div v-if="filteredPresets.length === 0" class="flex h-full items-center justify-center">
				<p class="text-xs text-zinc-500">No effects found</p>
			</div>

			<div v-else class="grid grid-cols-2 gap-2.5">
				<div
					v-for="preset in filteredPresets"
					:key="preset.type"
					class="group cursor-grab overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900/40 transition-all hover:border-[#E040FB]/40 hover:bg-[#E040FB]/[0.08] active:cursor-grabbing active:scale-[0.97]"
					draggable="true"
					@dragstart="(e: DragEvent) => handleDragStart(e, preset)"
				>
					<!-- Effect preview thumbnail -->
					<div class="relative aspect-[4/3] w-full overflow-hidden bg-zinc-950">
						<img
							v-if="previews[preset.type]"
							:src="previews[preset.type]"
							:alt="preset.label"
							class="size-full object-cover"
						/>
						<div v-else class="flex size-full items-center justify-center">
							<div class="size-5 animate-pulse rounded-full bg-white/10" />
						</div>
					</div>
					<div class="px-2.5 py-2 text-center">
						<p class="text-[11px] font-medium text-zinc-200 group-hover:text-white">{{ preset.label }}</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
