<script setup lang="ts">
import { ref, computed } from "vue";
import { EFFECT_PRESETS, EFFECT_CATEGORIES } from "../../../constants/effect-constants";
import type { VideoEffectCategory, VideoEffectPreset } from "../../../types/effects";
import { setDragData } from "../../../lib/drag-data";
import { Wand2, Search, GripVertical } from "lucide-vue-next";

const activeCategory = ref<VideoEffectCategory | "all">("all");
const searchQuery = ref("");

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
		<div class="border-b border-white/10 px-3 py-2">
			<div class="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2">
				<Search class="size-3.5 shrink-0 text-zinc-500" />
				<input
					v-model="searchQuery"
					type="text"
					placeholder="Search effects..."
					class="h-7 w-full bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
				/>
			</div>
		</div>

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
				<p class="text-[11px] text-zinc-500">Drag an effect onto the timeline</p>
			</div>

			<div v-if="filteredPresets.length === 0" class="flex h-full items-center justify-center">
				<p class="text-xs text-zinc-500">No effects found</p>
			</div>

			<div v-else class="grid grid-cols-2 gap-2">
				<div
					v-for="preset in filteredPresets"
					:key="preset.type"
					class="group flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-all hover:border-[#E040FB]/30 hover:bg-[#E040FB]/5 active:cursor-grabbing active:scale-95"
					draggable="true"
					@dragstart="(e: DragEvent) => handleDragStart(e, preset)"
				>
					<!-- Effect preview icon -->
					<div class="flex size-10 items-center justify-center rounded-md bg-white/5">
						<svg viewBox="0 0 24 24" class="size-5 text-zinc-400 group-hover:text-zinc-200">
							<template v-if="preset.icon === 'blur'">
								<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
								<circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6" />
								<circle cx="12" cy="12" r="2" fill="currentColor" />
							</template>
							<template v-else-if="preset.icon === 'pixelate'">
								<rect x="3" y="3" width="4" height="4" fill="currentColor" opacity="0.8" />
								<rect x="10" y="3" width="4" height="4" fill="currentColor" opacity="0.5" />
								<rect x="17" y="3" width="4" height="4" fill="currentColor" opacity="0.7" />
								<rect x="3" y="10" width="4" height="4" fill="currentColor" opacity="0.4" />
								<rect x="10" y="10" width="4" height="4" fill="currentColor" opacity="0.9" />
								<rect x="17" y="10" width="4" height="4" fill="currentColor" opacity="0.3" />
								<rect x="3" y="17" width="4" height="4" fill="currentColor" opacity="0.6" />
								<rect x="10" y="17" width="4" height="4" fill="currentColor" opacity="0.8" />
								<rect x="17" y="17" width="4" height="4" fill="currentColor" opacity="0.5" />
							</template>
							<template v-else-if="preset.icon === 'sharpen'">
								<polygon points="12,3 21,21 3,21" fill="none" stroke="currentColor" stroke-width="1.5" />
								<line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" stroke-width="1.5" />
							</template>
							<template v-else-if="preset.icon === 'sepia'">
								<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" />
								<circle cx="9" cy="9" r="2" fill="currentColor" opacity="0.6" />
								<path d="M3 15 L8 11 L13 14 L17 10 L21 13" stroke="currentColor" stroke-width="1.5" fill="none" />
							</template>
							<template v-else-if="preset.icon === 'grayscale'">
								<rect x="3" y="3" width="8" height="18" rx="2" fill="currentColor" opacity="0.3" />
								<rect x="13" y="3" width="8" height="18" rx="2" fill="currentColor" opacity="0.7" />
							</template>
							<template v-else-if="preset.icon === 'negative'">
								<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5" />
								<path d="M12 3 A9 9 0 0 1 12 21" fill="currentColor" opacity="0.7" />
							</template>
							<template v-else-if="preset.icon === 'vignette'">
								<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" />
								<rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" opacity="0.15" />
								<rect x="7" y="7" width="10" height="10" rx="5" fill="black" opacity="0.3" />
							</template>
							<template v-else-if="preset.icon === 'wave'">
								<path d="M3 12 Q6 6, 9 12 Q12 18, 15 12 Q18 6, 21 12" fill="none" stroke="currentColor" stroke-width="1.5" />
							</template>
							<template v-else-if="preset.icon === 'glitch'">
								<rect x="3" y="4" width="18" height="3" fill="currentColor" opacity="0.7" />
								<rect x="5" y="9" width="16" height="3" fill="currentColor" opacity="0.5" class="text-red-400" />
								<rect x="2" y="14" width="18" height="3" fill="currentColor" opacity="0.6" class="text-cyan-400" />
								<rect x="6" y="19" width="14" height="2" fill="currentColor" opacity="0.4" />
							</template>
							<template v-else-if="preset.icon === 'colorShift'">
								<circle cx="10" cy="10" r="5" fill="none" stroke="currentColor" stroke-width="1.5" class="text-red-400" opacity="0.7" />
								<circle cx="14" cy="10" r="5" fill="none" stroke="currentColor" stroke-width="1.5" class="text-blue-400" opacity="0.7" />
								<circle cx="12" cy="14" r="5" fill="none" stroke="currentColor" stroke-width="1.5" class="text-green-400" opacity="0.7" />
							</template>
							<template v-else-if="preset.icon === 'zoomPulse'">
								<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.5" />
								<circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1" opacity="0.5" />
								<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.3" />
							</template>
							<template v-else-if="preset.icon === 'flash'">
								<polygon points="13,2 3,14 10,14 11,22 21,10 14,10" fill="currentColor" opacity="0.8" />
							</template>
							<template v-else>
								<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5" />
								<path d="M12 8v4l3 3" stroke="currentColor" stroke-width="1.5" fill="none" />
							</template>
						</svg>
					</div>
					<div class="text-center">
						<p class="text-[11px] font-medium text-zinc-300 group-hover:text-zinc-100">{{ preset.label }}</p>
						<p class="mt-0.5 text-[9px] leading-tight text-zinc-600">{{ preset.description }}</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
