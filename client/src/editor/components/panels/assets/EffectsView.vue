<script setup lang="ts">
import { ref, computed } from "vue";
import { EFFECT_PRESETS } from "../../../constants/effect-constants";
import type { VideoEffectPreset } from "../../../types/effects";
import { setDragData } from "../../../lib/drag-data";
import { useEffectPreviews } from "../../../composables/usePreviewThumbnails";
import PanelSearchBar from "./PanelSearchBar.vue";

const searchQuery = ref("");

const effectTypes = EFFECT_PRESETS.map((p) => p.type);
const previews = useEffectPreviews(effectTypes);

const filteredPresets = computed(() => {
	const q = searchQuery.value.trim().toLowerCase();
	if (!q) return EFFECT_PRESETS;
	return EFFECT_PRESETS.filter(
		(p) => p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
	);
});

function handleDragStart(e: DragEvent, preset: VideoEffectPreset) {
	if (!e.dataTransfer) return;
	const params: Record<string, number | string> = {};
	for (const [key, value] of Object.entries(preset.defaults)) {
		if (key === "type" || key === "enabled" || key === "intensity") continue;
		if (typeof value === "number" || typeof value === "string") params[key] = value;
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
</script>

<template>
	<div class="flex h-full flex-col">
		<PanelSearchBar v-model="searchQuery" placeholder="Search effects..." />

		<div class="flex-1 overflow-y-auto p-2">
			<div v-if="filteredPresets.length === 0" class="flex h-full items-center justify-center">
				<p class="text-xs text-zinc-500">No effects found</p>
			</div>

			<div v-else class="grid grid-cols-2 gap-1.5">
				<div
					v-for="preset in filteredPresets"
					:key="preset.type"
					class="group relative cursor-grab overflow-hidden rounded-lg border border-white/[0.06] bg-zinc-950 transition-all hover:border-white/15 active:cursor-grabbing active:scale-[0.97]"
					draggable="true"
					@dragstart="(e: DragEvent) => handleDragStart(e, preset)"
				>
					<!-- Thumbnail -->
					<div class="aspect-[4/3] w-full overflow-hidden">
						<img
							v-if="previews[preset.type]"
							:src="previews[preset.type]"
							:alt="preset.label"
							class="size-full object-cover"
						/>
						<div v-else class="flex size-full items-center justify-center">
							<div class="size-4 animate-pulse rounded-full bg-white/10" />
						</div>
					</div>
					<!-- Label overlay -->
					<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4">
						<p class="text-[10px] font-medium leading-tight text-zinc-200 group-hover:text-white">{{ preset.label }}</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
