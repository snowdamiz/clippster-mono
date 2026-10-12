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
import AssetGrid from "../shared/AssetGrid.vue";
import AssetTile from "../shared/AssetTile.vue";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchX } from "lucide-vue-next";

const { editor, version } = useEditor({
	subscribe: {
		timeline: true,
		selection: true,
		playback: false,
		scenes: false,
		project: false,
		media: false,
	},
});
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
		<PanelSearchBar v-model="searchQuery" placeholder="Search effects…" />

		<div class="flex-1 overflow-y-auto p-3">
			<EmptyState
				v-if="filteredPresets.length === 0"
				size="sm"
				:icon="SearchX"
				title="No effects found"
				description="Try a different search term."
			/>

			<AssetGrid v-else :min="88">
				<AssetTile
					v-for="preset in filteredPresets"
					:key="preset.type"
					as="div"
					:label="preset.label"
					class="cursor-grab active:cursor-grabbing"
					role="button"
					tabindex="0"
					:title="`Drag ${preset.label} to the timeline or click to add`"
					@click="!wasDragCompleted && addEffectToTimeline(preset)"
					@keydown.enter="addEffectToTimeline(preset)"
					@pointerdown="handlePointerDown($event, preset)"
					@dragstart.prevent
				>
					<img
						v-if="previews[preset.type]"
						:src="previews[preset.type]"
						:alt="preset.label"
						draggable="false"
						class="size-full object-cover"
					/>
					<div v-else class="skeleton size-full rounded-none" />
				</AssetTile>
			</AssetGrid>
		</div>
	</div>
</template>
