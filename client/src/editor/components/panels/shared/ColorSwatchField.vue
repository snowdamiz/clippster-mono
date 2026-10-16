<script setup lang="ts">
/**
 * 28px color control: a swatch that opens a color picker, the hex value,
 * and an optional clear button. The swatch shows user content, so it renders
 * the raw color; everything else uses tokens. By default the swatch opens the
 * native picker; `appPicker` uses the app ColorPicker popover (presets + RGB)
 * instead — keep whichever picker the control used before.
 *
 *   <ColorSwatchField :model-value="tint" clearable placeholder="None"
 *     @update:model-value="(v) => updateColor({ tint: v })" @clear="updateColor({ tint: '' })" />
 */
import type { HTMLAttributes } from "vue";
import { X } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import ColorPicker from "@/components/ColorPicker.vue";

const props = withDefaults(
	defineProps<{
		modelValue?: string | null;
		/** Value handed to the native picker when modelValue is empty. */
		fallback?: string;
		placeholder?: string;
		clearable?: boolean;
		/** Only the swatch, no hex text box. */
		compact?: boolean;
		/** Open the app ColorPicker popover instead of the native picker. */
		appPicker?: boolean;
		disabled?: boolean;
		ariaLabel?: string;
		class?: HTMLAttributes["class"];
	}>(),
	{ fallback: "#000000", placeholder: "None" },
);

const emit = defineEmits<{
	"update:modelValue": [value: string];
	clear: [];
}>();
</script>

<template>
	<label
		v-if="compact"
		:class="
			cn(
				'relative block size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line-strong transition-colors hover:border-fg-subtle',
				disabled && 'pointer-events-none opacity-50',
				props.class,
			)
		"
		:style="{ backgroundColor: modelValue || 'transparent' }"
	>
		<input
			type="color"
			:value="modelValue || fallback"
			:disabled="disabled"
			:aria-label="ariaLabel ?? 'Pick color'"
			class="absolute inset-0 size-full cursor-pointer opacity-0"
			@input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
		/>
	</label>
	<div
		v-else
		:class="
			cn(
				'flex h-7 min-w-0 items-center gap-2 rounded-md border border-line bg-surface-raised pl-1 pr-1.5 transition-colors hover:border-line-strong',
				disabled && 'pointer-events-none opacity-50',
				props.class,
			)
		"
	>
		<ColorPicker
			v-if="appPicker"
			:model-value="modelValue || fallback"
			class="shrink-0 [&>button]:block [&>button]:size-5 [&>button]:rounded [&>button]:border [&>button]:border-line-strong [&>button>div]:rounded"
			@update:model-value="(v: string) => emit('update:modelValue', v)"
		/>
		<label
			v-else
			class="relative size-5 shrink-0 cursor-pointer overflow-hidden rounded border border-line-strong"
			:style="{ backgroundColor: modelValue || 'transparent' }"
		>
			<input
				type="color"
				:value="modelValue || fallback"
				:disabled="disabled"
				:aria-label="ariaLabel ?? 'Pick color'"
				class="absolute inset-0 size-full cursor-pointer opacity-0"
				@input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
			/>
		</label>
		<span class="min-w-0 flex-1 truncate font-mono text-2xs uppercase" :class="modelValue ? 'text-fg-muted' : 'text-fg-subtle'">
			{{ modelValue || placeholder }}
		</span>
		<slot />
		<button
			v-if="clearable && modelValue"
			type="button"
			class="grid size-5 shrink-0 place-items-center rounded text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
			aria-label="Clear color"
			title="Clear"
			@click="emit('clear')"
		>
			<X class="size-3" />
		</button>
	</div>
</template>
