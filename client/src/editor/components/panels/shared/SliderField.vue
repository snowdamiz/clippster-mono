<script setup lang="ts">
/**
 * The inspector's slider row: label (+ actions such as a keyframe toggle),
 * a native range slider and a compact value box (or a read-only readout).
 *
 * Simple use — one handler for slider and box:
 *   <SliderField label="Radius" :model-value="r" :min="1" :max="50" @update:model-value="setRadius" />
 *
 * Fine-grained use — keep separate slider / typing / commit handlers:
 *   <SliderField label="Scale" :model-value="scale" :input-value="scaleInput" unit="%"
 *     @slide="onSlider" @input="onTyped" @commit="onBlur" />
 *
 * `update:modelValue` fires for both the slider and parsed box input; `slide`
 * only for the slider; `input`/`commit` only for the box (raw strings).
 * Listen to either `update:modelValue` or the fine-grained events, not both.
 * The slider is a native <input type="range"> so pointer-capture handlers
 * that look for range inputs keep working.
 */
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";
import NumberBox from "./NumberBox.vue";

const props = withDefaults(
	defineProps<{
		label?: string;
		modelValue: number;
		min?: number;
		max?: number;
		step?: number;
		unit?: string;
		/** Text shown in the value box; defaults to modelValue. */
		inputValue?: string | number;
		/** Read-only readout shown instead of the value box. */
		readout?: string;
		/** Neither box nor readout. */
		hideInput?: boolean;
		/** Label to the left of the slider instead of above it. */
		inline?: boolean;
		keyframed?: boolean;
		disabled?: boolean;
		inputType?: "number" | "text";
		inputClass?: HTMLAttributes["class"];
		class?: HTMLAttributes["class"];
	}>(),
	{ min: 0, max: 100, step: 1, inputType: "number" },
);

const emit = defineEmits<{
	"update:modelValue": [value: number];
	slide: [value: number];
	change: [value: number];
	input: [value: string];
	commit: [value: string];
}>();

function onSlider(e: Event) {
	const v = Number((e.target as HTMLInputElement).value);
	emit("slide", v);
	emit("update:modelValue", v);
}

function onBox(raw: string) {
	emit("input", raw);
	const v = parseFloat(raw);
	if (Number.isFinite(v)) emit("update:modelValue", v);
}
</script>

<template>
	<div :class="cn(inline ? 'flex min-h-7 items-center gap-2' : 'space-y-1', props.class)">
		<div
			v-if="!inline && (label || $slots.label || $slots.actions)"
			class="flex min-h-4 items-center justify-between gap-2"
		>
			<span class="truncate text-xs text-fg-muted"><slot name="label">{{ label }}</slot></span>
			<div v-if="$slots.actions" class="flex shrink-0 items-center gap-1"><slot name="actions" /></div>
		</div>
		<span v-else-if="inline && (label || $slots.label)" class="w-20 shrink-0 truncate text-xs text-fg-muted">
			<slot name="label">{{ label }}</slot>
		</span>
		<div class="flex min-w-0 flex-1 items-center gap-2">
			<input
				type="range"
				:value="modelValue"
				:min="min"
				:max="max"
				:step="step"
				:disabled="disabled"
				:aria-label="label"
				class="min-w-0 flex-1"
				@input="onSlider"
				@change="emit('change', Number(($event.target as HTMLInputElement).value))"
			/>
			<span
				v-if="readout !== undefined"
				class="tabular w-12 shrink-0 text-right text-xs text-fg-muted"
			>{{ readout }}</span>
			<NumberBox
				v-else-if="!hideInput"
				:value="inputValue ?? modelValue"
				:type="inputType"
				:min="min"
				:max="max"
				:step="step"
				:suffix="unit"
				:keyframed="keyframed"
				:disabled="disabled"
				:aria-label="label"
				align="right"
				:class="cn('w-[60px] shrink-0 px-1.5', inputClass)"
				@input="onBox"
				@commit="(v) => emit('commit', v)"
			/>
			<div v-if="inline && $slots.actions" class="flex shrink-0 items-center gap-1"><slot name="actions" /></div>
		</div>
	</div>
</template>
