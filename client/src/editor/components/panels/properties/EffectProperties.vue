<script setup lang="ts">
import { computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import type { EffectElement } from "../../../types/timeline";
import { getEffectPreset } from "../../../constants/effect-constants";
import { COLOR_OVERLAY_BLEND_OPTIONS } from "../../../constants/color-overlay-constants";
import { Wand2, Trash2, Eye, EyeOff } from "lucide-vue-next";

const props = defineProps<{
	element: EffectElement;
	trackId: string;
}>();

const { editor } = useEditor({ subscribe: false });
const { selectedElements } = useElementSelection();

const preset = computed(() => getEffectPreset(props.element.effectType));

const isColorOverlay = computed(() => props.element.effectType === "colorOverlay");
const overlayColor = computed(() => (props.element.params.color as string) ?? "#ff4500");
const overlayBlendMode = computed(() => (props.element.params.blendMode as string) ?? "color-burn");

function update(updates: Record<string, unknown>) {
	editor.timeline.updateElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates,
	});
}

function toggleEnabled() {
	update({ enabled: !props.element.enabled });
}

function updateParam(key: string, value: number | string) {
	update({ params: { ...props.element.params, [key]: value } });
}

function handleDelete() {
	editor.timeline.deleteElements({
		elements: selectedElements.value.length > 0
			? selectedElements.value
			: [{ trackId: props.trackId, elementId: props.element.id }],
	});
}

const paramEntries = computed(() => {
	const entries: { key: string; value: number | string; label: string; min?: number; max?: number; step?: number }[] = [];
	const p = props.element.params;
	const type = props.element.effectType;

	if (type === "blur") {
		entries.push({ key: "radius", value: (p.radius as number) ?? 8, label: "Radius", min: 1, max: 50, step: 1 });
	} else if (type === "pixelate") {
		entries.push({ key: "blockSize", value: (p.blockSize as number) ?? 12, label: "Block Size", min: 2, max: 100, step: 1 });
	} else if (type === "sharpen") {
		entries.push({ key: "amount", value: (p.amount as number) ?? 3, label: "Amount", min: 0.1, max: 10, step: 0.1 });
	} else if (type === "vignette") {
		entries.push({ key: "radius", value: (p.radius as number) ?? 50, label: "Radius", min: 10, max: 100, step: 1 });
		entries.push({ key: "softness", value: (p.softness as number) ?? 50, label: "Softness", min: 0, max: 100, step: 1 });
	} else if (type === "colorShift") {
		entries.push({ key: "redOffsetX", value: (p.redOffsetX as number) ?? 5, label: "Red X", min: -20, max: 20, step: 1 });
		entries.push({ key: "redOffsetY", value: (p.redOffsetY as number) ?? 0, label: "Red Y", min: -20, max: 20, step: 1 });
		entries.push({ key: "blueOffsetX", value: (p.blueOffsetX as number) ?? -5, label: "Blue X", min: -20, max: 20, step: 1 });
		entries.push({ key: "blueOffsetY", value: (p.blueOffsetY as number) ?? 0, label: "Blue Y", min: -20, max: 20, step: 1 });
	} else if (type === "glitch") {
		entries.push({ key: "sliceCount", value: (p.sliceCount as number) ?? 10, label: "Slices", min: 2, max: 50, step: 1 });
		entries.push({ key: "colorBleed", value: (p.colorBleed as number) ?? 40, label: "Color Bleed", min: 0, max: 100, step: 1 });
	} else if (type === "wave") {
		entries.push({ key: "amplitude", value: (p.amplitude as number) ?? 10, label: "Amplitude", min: 1, max: 50, step: 1 });
		entries.push({ key: "frequency", value: (p.frequency as number) ?? 3, label: "Frequency", min: 0.5, max: 20, step: 0.5 });
		entries.push({ key: "speed", value: (p.speed as number) ?? 2, label: "Speed", min: 0.1, max: 10, step: 0.1 });
	} else if (type === "zoomPulse") {
		entries.push({ key: "amount", value: (p.amount as number) ?? 15, label: "Amount %", min: 1, max: 50, step: 1 });
		entries.push({ key: "speed", value: (p.speed as number) ?? 2, label: "Speed", min: 0.1, max: 10, step: 0.1 });
	} else if (type === "flash") {
		entries.push({ key: "speed", value: (p.speed as number) ?? 2, label: "Speed", min: 0.1, max: 10, step: 0.1 });
	}

	return entries;
});
</script>

<template>
	<div class="space-y-3 p-3">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Wand2 class="size-4 text-[#E040FB]" />
				<span class="text-xs font-medium">{{ preset?.label ?? element.effectType }}</span>
			</div>
			<div class="flex items-center gap-1">
				<button
					class="rounded p-1 hover:bg-white/10"
					:title="element.enabled ? 'Disable' : 'Enable'"
					@click="toggleEnabled"
				>
					<Eye v-if="element.enabled" class="size-3.5 text-zinc-400" />
					<EyeOff v-else class="size-3.5 text-zinc-600" />
				</button>
				<button
					class="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
					title="Delete effect"
					@click="handleDelete"
				>
					<Trash2 class="size-3.5" />
				</button>
			</div>
		</div>

		<div v-if="element.enabled" class="space-y-2.5">
			<!-- Intensity -->
			<div class="space-y-1">
				<div class="flex items-center justify-between">
					<label class="text-[11px] text-zinc-500">Intensity</label>
					<span class="text-[11px] text-zinc-400">{{ Math.round(element.intensity) }}%</span>
				</div>
				<input
					type="range"
					:value="element.intensity"
					min="0"
					max="100"
					step="1"
					class="w-full accent-[#E040FB]"
					@input="(e: Event) => update({ intensity: Number((e.target as HTMLInputElement).value) })"
				/>
			</div>

			<!-- Solid Color / colorOverlay -->
			<template v-if="isColorOverlay">
				<div class="flex items-center justify-between gap-2">
					<label class="text-[11px] text-zinc-500">Color</label>
					<input
						type="color"
						:value="overlayColor"
						class="h-7 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
						@input="(e: Event) => updateParam('color', (e.target as HTMLInputElement).value)"
					/>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] text-zinc-500">Blend Mode</label>
					<select
						:value="overlayBlendMode"
						class="w-full rounded-sm border border-white/10 bg-[#1a1a1e] px-2 py-1.5 text-xs text-zinc-200 outline-none"
						@change="(e: Event) => updateParam('blendMode', (e.target as HTMLSelectElement).value)"
					>
						<option v-for="opt in COLOR_OVERLAY_BLEND_OPTIONS" :key="opt.value" :value="opt.value">
							{{ opt.label }}
						</option>
					</select>
				</div>
			</template>

			<!-- Effect-specific params -->
			<div v-for="param in paramEntries" :key="param.key" class="space-y-1">
				<div class="flex items-center justify-between">
					<label class="text-[11px] text-zinc-500">{{ param.label }}</label>
					<span class="text-[11px] text-zinc-400">{{ typeof param.value === 'number' ? (Number.isInteger(param.step ?? 1) ? param.value : Number(param.value).toFixed(1)) : param.value }}</span>
				</div>
				<input
					v-if="typeof param.value === 'number'"
					type="range"
					:value="param.value"
					:min="param.min ?? 0"
					:max="param.max ?? 100"
					:step="param.step ?? 1"
					class="w-full accent-[#E040FB]"
					@input="(e: Event) => updateParam(param.key, Number((e.target as HTMLInputElement).value))"
				/>
			</div>
		</div>

		<div v-else class="rounded-md bg-white/5 px-2.5 py-2 text-center text-[11px] text-zinc-600">
			Effect disabled
		</div>
	</div>
</template>
