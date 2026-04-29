<script setup lang="ts">
import { ref, computed } from "vue";
import { EFFECT_PRESETS } from "../../../constants/effect-constants";
import type { VideoEffectPreset } from "../../../types/effects";
import { useEffectPreviews } from "../../../composables/usePreviewThumbnails";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import { buildEffectElement } from "../../../lib/timeline/element-utils";
import { usePointerDrag } from "../../../composables/usePointerDrag";
import type { EffectDragData } from "../../../types/drag";
import PanelSearchBar from "./PanelSearchBar.vue";

const { editor, version } = useEditor();
const { selectedElements } = useElementSelection();
const { startDrag, wasDragCompleted } = usePointerDrag();
const searchQuery = ref("");

const visibleEffectPresets = computed(() => EFFECT_PRESETS.filter((p) => p.exportSupported));
const effectTypes = visibleEffectPresets.value.map((p) => p.type);
const previews = useEffectPreviews(effectTypes);

const filteredPresets = computed(() => {
	const q = searchQuery.value.trim().toLowerCase();
	if (!q) return visibleEffectPresets.value;
	return visibleEffectPresets.value.filter(
		(p) => p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
	);
});

function handlePointerDown(e: PointerEvent, preset: VideoEffectPreset) {
	const params: Record<string, number | string> = {};
	for (const [key, value] of Object.entries(preset.defaults)) {
		if (key === "type" || key === "enabled" || key === "intensity") continue;
		if (typeof value === "number" || typeof value === "string") params[key] = value;
	}

	const data: EffectDragData = {
		id: `${preset.type}_${Date.now()}`,
		name: preset.label,
		type: "effect",
		effectType: preset.type,
		intensity: preset.defaults.intensity,
		params,
	};
	startDrag(e, data);
}

function addEffectToTimeline(preset: VideoEffectPreset) {
	const params: Record<string, number | string> = {};
	for (const [key, value] of Object.entries(preset.defaults)) {
		if (key === "type" || key === "enabled" || key === "intensity") continue;
		if (typeof value === "number" || typeof value === "string") params[key] = value;
	}

	// If a video/image element is selected, add the effect to its effects array
	for (const sel of selectedElements.value) {
		void version.value;
		const track = editor.timeline.getTrackById({ trackId: sel.trackId });
		if (!track || track.type !== "video") continue;

		const el = track.elements.find((e) => e.id === sel.elementId);
		if (!el || (el.type !== "video" && el.type !== "image")) continue;

		const existingEffects = (el as any).effects ?? [];
		const newEffect = {
			id: `${preset.type}_${Date.now()}`,
			type: preset.type,
			enabled: true,
			intensity: preset.defaults.intensity,
			...params,
		};

		editor.timeline.updateElement({
			trackId: sel.trackId,
			elementId: sel.elementId,
			updates: { effects: [...existingEffects, newEffect] },
		});
		return;
	}

	// No video element selected — insert as a standalone effect element at the playhead
	const startTime = editor.playback.getCurrentTime();
	const element = buildEffectElement({
		effectType: preset.type as any,
		name: preset.label,
		intensity: preset.defaults.intensity,
		params,
		startTime,
	});
	editor.timeline.insertElement({ element, placement: { mode: "auto" } });
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
					class="group relative cursor-grab overflow-hidden rounded-lg border border-white/[0.06] bg-zinc-950 transition-colors hover:border-white/15 active:cursor-grabbing active:scale-[0.97] active:transition-transform"
					@click="!wasDragCompleted && addEffectToTimeline(preset)"
					@pointerdown="handlePointerDown($event, preset)"
					@dragstart.prevent
				>
					<!-- Thumbnail -->
					<div class="aspect-[4/3] w-full overflow-hidden">
						<img
							v-if="previews[preset.type]"
							:src="previews[preset.type]"
							:alt="preset.label"
							draggable="false"
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
