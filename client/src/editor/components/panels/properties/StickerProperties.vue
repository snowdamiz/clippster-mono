<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import { useImageMode } from "../../../composables/useImageMode";
import type { StickerElement } from "../../../types/timeline";
import { Sticker, Trash2, RotateCcw, Diamond } from "lucide-vue-next";
import AnimationProperties from "./AnimationProperties.vue";
import ElementTimingFields from "./ElementTimingFields.vue";
import KeyframeEditorPanel from "../KeyframeEditorPanel.vue";

const props = defineProps<{
	element: StickerElement;
	trackId: string;
}>();

type TopTab = "sticker" | "keyframes";
const activeTab = ref<TopTab>("sticker");
const allTopTabs: { id: TopTab; label: string; icon: typeof Sticker }[] = [
	{ id: "sticker", label: "Sticker", icon: Sticker },
	{ id: "keyframes", label: "Keyframes", icon: Diamond },
];
const { isImageMode } = useImageMode();
const topTabs = computed(() =>
	isImageMode.value ? allTopTabs.filter((t) => t.id !== "keyframes") : allTopTabs,
);
watch(topTabs, (tabs) => {
	if (!tabs.some((t) => t.id === activeTab.value)) activeTab.value = "sticker";
});

const { editor } = useEditor({ subscribe: false });
const { selectedElements } = useElementSelection();

const opacityInput = ref(Math.round(props.element.opacity * 100).toString());
const scaleInput = ref(Math.round(props.element.transform.scale * 100).toString());
const posXInput = ref(props.element.transform.position.x.toString());
const posYInput = ref(props.element.transform.position.y.toString());
const rotateInput = ref(props.element.transform.rotate.toString());

watch(() => props.element.opacity, (v) => { opacityInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.transform.scale, (v) => { scaleInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.transform.position.x, (v) => { posXInput.value = v.toString(); });
watch(() => props.element.transform.position.y, (v) => { posYInput.value = v.toString(); });
watch(() => props.element.transform.rotate, (v) => { rotateInput.value = v.toString(); });

function update(updates: Record<string, unknown>) {
	editor.timeline.updateElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates,
	});
}

function updateTransform(partial: Record<string, unknown>) {
	update({
		transform: {
			...props.element.transform,
			...partial,
			position: {
				...props.element.transform.position,
				...(partial.position as Record<string, unknown> ?? {}),
			},
		},
	});
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function handleOpacitySlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value);
	opacityInput.value = val.toString();
	update({ opacity: val / 100 });
}

function handleOpacityInput(value: string) {
	opacityInput.value = value;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) {
		update({ opacity: clamp(parsed, 0, 100) / 100 });
	}
}

function handleOpacityBlur() {
	const parsed = parseInt(opacityInput.value, 10);
	const pct = Number.isNaN(parsed) ? Math.round(props.element.opacity * 100) : clamp(parsed, 0, 100);
	opacityInput.value = pct.toString();
	update({ opacity: pct / 100 });
}

function handleScaleSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value);
	scaleInput.value = val.toString();
	updateTransform({ scale: val / 100 });
}

function handleScaleInput(value: string) {
	scaleInput.value = value;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) {
		updateTransform({ scale: clamp(parsed, 10, 500) / 100 });
	}
}

function handleScaleBlur() {
	const parsed = parseInt(scaleInput.value, 10);
	const pct = Number.isNaN(parsed) ? Math.round(props.element.transform.scale * 100) : clamp(parsed, 10, 500);
	scaleInput.value = pct.toString();
	updateTransform({ scale: pct / 100 });
}

function handlePosX(value: string) {
	posXInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		updateTransform({ position: { x: parsed, y: props.element.transform.position.y } });
	}
}

function handlePosY(value: string) {
	posYInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		updateTransform({ position: { x: props.element.transform.position.x, y: parsed } });
	}
}

function handleRotateSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value);
	rotateInput.value = val.toString();
	updateTransform({ rotate: val });
}

function handleRotateInput(value: string) {
	rotateInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		updateTransform({ rotate: clamp(parsed, -360, 360) });
	}
}

function resetTransform() {
	update({
		transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
	});
}

function handleDelete() {
	editor.timeline.deleteElements({
		elements: selectedElements.value.length > 0
			? selectedElements.value
			: [{ trackId: props.trackId, elementId: props.element.id }],
	});
}

</script>

<template>
	<div class="flex h-full min-h-0 flex-row">
		<div class="min-h-0 flex-1 overflow-y-auto">
			<div v-if="activeTab === 'sticker'" class="space-y-5 p-4">
		<!-- Header -->
		<div class="flex items-center gap-2">
			<Sticker class="size-4 text-zinc-500" />
			<h3 class="text-sm font-medium">Sticker</h3>
		</div>

		<!-- Info -->
		<div class="space-y-3">
			<div class="space-y-1">
				<label class="text-xs text-zinc-500">Name</label>
				<p class="text-sm">{{ element.name }}</p>
			</div>
			<ElementTimingFields :element="element" :track-id="trackId" />
		</div>

		<!-- Opacity -->
		<div class="space-y-1.5">
			<label class="text-xs text-zinc-500">Opacity</label>
			<div class="flex items-center gap-2">
				<input
					type="range"
					:value="element.opacity * 100"
					min="0"
					max="100"
					step="1"
					class="flex-1"
					@input="handleOpacitySlider"
				/>
				<input
					type="number"
					:value="opacityInput"
					min="0"
					max="100"
					class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200"
					@input="(e) => handleOpacityInput((e.target as HTMLInputElement).value)"
					@blur="handleOpacityBlur"
				/>
			</div>
		</div>

		<!-- Blend Mode -->
		<div class="space-y-1">
			<label class="text-xs text-zinc-500">Blend Mode</label>
			<select
				:value="element.blendMode ?? 'normal'"
				class="w-full rounded border border-white/10 bg-[#1a1a1e] px-2 py-1 text-xs text-zinc-200 outline-none"
				@change="(e) => update({ blendMode: (e.target as HTMLSelectElement).value === 'normal' ? undefined : (e.target as HTMLSelectElement).value })"
			>
				<option value="normal">Normal</option>
				<option value="multiply">Multiply</option>
				<option value="screen">Screen</option>
				<option value="overlay">Overlay</option>
				<option value="soft-light">Soft Light</option>
				<option value="hard-light">Hard Light</option>
				<option value="darken">Darken</option>
				<option value="lighten">Lighten</option>
				<option value="color-dodge">Color Dodge</option>
				<option value="color-burn">Color Burn</option>
				<option value="difference">Difference</option>
				<option value="exclusion">Exclusion</option>
			</select>
		</div>

		<!-- Color -->
		<div class="space-y-1.5">
			<label class="text-xs text-zinc-500">Color</label>
			<div class="flex items-center gap-2">
				<input
					type="color"
					:value="element.color || '#000000'"
					class="h-8 w-8 cursor-pointer rounded border-0"
					@input="(e) => update({ color: (e.target as HTMLInputElement).value })"
				/>
				<span class="text-xs uppercase">{{ element.color || 'Default' }}</span>
				<button
					v-if="element.color"
					class="ml-auto rounded px-2 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
					@click="update({ color: undefined })"
				>
					Clear
				</button>
			</div>
		</div>

		<!-- Transform section -->
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<label class="text-xs font-medium text-zinc-300">Transform</label>
				<button
					class="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
					title="Reset transform"
					@click="resetTransform"
				>
					<RotateCcw class="size-3" />
					Reset
				</button>
			</div>

			<!-- Scale -->
			<div class="space-y-1.5">
				<label class="text-xs text-zinc-500">Scale</label>
				<div class="flex items-center gap-2">
					<input
						type="range"
						:value="element.transform.scale * 100"
						min="10"
						max="500"
						step="1"
						class="flex-1"
						@input="handleScaleSlider"
					/>
					<input
						type="number"
						:value="scaleInput"
						min="10"
						max="500"
						class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200"
						@input="(e) => handleScaleInput((e.target as HTMLInputElement).value)"
						@blur="handleScaleBlur"
					/>
				</div>
			</div>

			<!-- Position -->
			<div class="grid grid-cols-2 gap-2">
				<div class="space-y-1">
					<label class="text-xs text-zinc-500">Position X</label>
					<input
						type="number"
						:value="posXInput"
						step="1"
						class="h-7 w-full rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200"
						@input="(e) => handlePosX((e.target as HTMLInputElement).value)"
					/>
				</div>
				<div class="space-y-1">
					<label class="text-xs text-zinc-500">Position Y</label>
					<input
						type="number"
						:value="posYInput"
						step="1"
						class="h-7 w-full rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200"
						@input="(e) => handlePosY((e.target as HTMLInputElement).value)"
					/>
				</div>
			</div>

			<!-- Rotation -->
			<div class="space-y-1.5">
				<label class="text-xs text-zinc-500">Rotation</label>
				<div class="flex items-center gap-2">
					<input
						type="range"
						:value="element.transform.rotate"
						min="-360"
						max="360"
						step="1"
						class="flex-1"
						@input="handleRotateSlider"
					/>
					<input
						type="number"
						:value="rotateInput"
						min="-360"
						max="360"
						class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200"
						@input="(e) => handleRotateInput((e.target as HTMLInputElement).value)"
					/>
				</div>
			</div>
		</div>

		<!-- Animation (video only) -->
		<div v-if="!isImageMode" class="space-y-1.5">
			<label class="text-xs font-medium text-zinc-300">Animation</label>
			<div class="rounded-md border border-white/5 bg-white/[0.01]">
				<AnimationProperties
					:element-id="element.id"
					:track-id="trackId"
					:animation-in="element.animationIn"
					:animation-out="element.animationOut"
					:animation-loop="element.animationLoop"
					:element-duration="element.duration"
				/>
			</div>
		</div>

		<!-- Delete -->
		<div class="border-t border-white/10 pt-4 mt-2">
			<button
				class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
				@click="handleDelete"
			>
				<Trash2 class="size-3.5" />
				Delete Sticker
			</button>
		</div>
			</div>

			<div v-else-if="!isImageMode && activeTab === 'keyframes'">
				<KeyframeEditorPanel :track-id="trackId" :element="element" />
			</div>
		</div>

		<div class="scrollbar-hidden flex w-10 shrink-0 flex-col items-center gap-2 overflow-y-auto border-l border-white/10 bg-[#0e0e10] py-3">
			<button
				v-for="tab in topTabs"
				:key="tab.id"
				type="button"
				:title="tab.label"
				:class="[
					'flex flex-col items-center justify-center rounded-md p-1.5 transition-colors',
					activeTab === tab.id ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300',
				]"
				@click="activeTab = tab.id"
			>
				<component :is="tab.icon" class="size-[15px]" />
			</button>
		</div>
	</div>
</template>
