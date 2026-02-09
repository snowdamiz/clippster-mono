<script setup lang="ts">
import { computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import type { ColorAdjustments } from "../../../types/timeline";
import { DEFAULT_COLOR_ADJUSTMENTS } from "../../../types/timeline";
import { SlidersHorizontal, RotateCcw } from "lucide-vue-next";

const { editor } = useEditor();
const { selectedElements } = useElementSelection();

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

const ca = computed(() => {
	const sel = selectedElement.value;
	if (!sel) return { ...DEFAULT_COLOR_ADJUSTMENTS };
	const el = sel.element as any;
	return { ...DEFAULT_COLOR_ADJUSTMENTS, ...el.colorAdjustments };
});

function updateColor(partial: Partial<ColorAdjustments>) {
	const sel = selectedElement.value;
	if (!sel) return;
	editor.timeline.updateElement({
		trackId: sel.trackId,
		elementId: sel.element.id,
		updates: { colorAdjustments: { ...ca.value, ...partial } } as any,
	});
}

function resetAll() {
	const sel = selectedElement.value;
	if (!sel) return;
	editor.timeline.updateElement({
		trackId: sel.trackId,
		elementId: sel.element.id,
		updates: { colorAdjustments: { ...DEFAULT_COLOR_ADJUSTMENTS } } as any,
	});
}

interface AdjustmentDef {
	key: keyof ColorAdjustments;
	label: string;
	min: number;
	max: number;
	isColor?: boolean;
}

const adjustments: AdjustmentDef[] = [
	{ key: "brightness", label: "Brightness", min: -100, max: 100 },
	{ key: "contrast", label: "Contrast", min: -100, max: 100 },
	{ key: "saturation", label: "Saturation", min: -100, max: 100 },
	{ key: "temperature", label: "Temperature", min: -100, max: 100 },
	{ key: "exposure", label: "Exposure", min: -100, max: 100 },
	{ key: "highlights", label: "Highlights", min: -100, max: 100 },
	{ key: "shadows", label: "Shadows", min: -100, max: 100 },
	{ key: "fade", label: "Fade", min: 0, max: 100 },
	{ key: "sharpness", label: "Sharpness", min: 0, max: 100 },
	{ key: "tint", label: "Tint", min: 0, max: 0, isColor: true },
];

function isNonDefault(key: keyof ColorAdjustments): boolean {
	const val = ca.value[key];
	if (key === "tint") return val !== "" && val !== undefined;
	return val !== 0;
}

const hasAnyNonDefault = computed(() =>
	adjustments.some((a) => isNonDefault(a.key)),
);
</script>

<template>
	<div class="flex h-full flex-col">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-white/10 px-4 py-2">
			<div class="flex items-center gap-1.5">
				<SlidersHorizontal class="size-3.5 text-zinc-500" />
				<span class="text-xs font-medium text-zinc-400">Adjustments</span>
			</div>
			<button
				v-if="hasAnyNonDefault && selectedElement"
				class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
				@click="resetAll"
			>
				<RotateCcw class="size-3" />
				Reset All
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-3">
			<!-- No element selected -->
			<div v-if="!selectedElement" class="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
				<SlidersHorizontal class="size-8 text-zinc-600" :stroke-width="1" />
				<p class="text-xs text-zinc-500">Select a video or image element to adjust</p>
			</div>

			<div v-else class="space-y-3">
				<template v-for="adj in adjustments" :key="adj.key">
					<!-- Color picker for tint -->
					<div v-if="adj.isColor" class="space-y-1">
						<label class="text-xs text-zinc-500">{{ adj.label }}</label>
						<div class="flex items-center gap-2">
							<div class="relative">
								<input
									type="color"
									:value="(ca.tint as string) || '#000000'"
									class="absolute inset-0 h-7 w-7 cursor-pointer opacity-0"
									@input="(e) => updateColor({ tint: (e.target as HTMLInputElement).value })"
								/>
								<div class="size-7 rounded border border-white/10" :style="{ backgroundColor: (ca.tint as string) || 'transparent' }" />
							</div>
							<span class="flex-1 text-xs text-zinc-400">{{ (ca.tint as string) || 'None' }}</span>
							<button
								v-if="ca.tint"
								class="text-[10px] text-zinc-500 hover:text-zinc-300"
								@click="updateColor({ tint: '' })"
							>
								Clear
							</button>
						</div>
					</div>

					<!-- Slider for numeric adjustments -->
					<div v-else class="space-y-1">
						<div class="flex items-center justify-between">
							<label class="text-xs text-zinc-500">{{ adj.label }}</label>
							<span
								class="text-[10px] font-mono"
								:class="isNonDefault(adj.key) ? 'text-blue-400' : 'text-zinc-600'"
							>
								{{ ca[adj.key] }}
							</span>
						</div>
						<input
							type="range"
							:value="ca[adj.key]"
							:min="adj.min"
							:max="adj.max"
							step="1"
							class="w-full"
							@input="(e) => updateColor({ [adj.key]: Number((e.target as HTMLInputElement).value) })"
						/>
					</div>
				</template>
			</div>
		</div>
	</div>
</template>
