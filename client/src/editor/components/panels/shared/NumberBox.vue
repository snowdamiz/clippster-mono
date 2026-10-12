<script setup lang="ts">
/**
 * Compact 28px value box for inspectors: optional inline prefix label
 * ("X", "Scale"), the input, and an optional unit suffix ("%", "°", "s").
 * Spinners are hidden; arrow keys still step number inputs natively.
 *
 * Emits the raw string on every keystroke (`input`) and on blur / Enter
 * (`commit`), so callers keep their own parse/clamp logic.
 *
 *   <NumberBox prefix="X" :value="posX" @input="handlePosX" />
 *   <NumberBox :value="speedInput" type="text" suffix="x" @input="..." @commit="..." />
 */
import type { HTMLAttributes } from "vue";
import { ref } from "vue";
import { cn } from "@/lib/utils";

const props = withDefaults(
	defineProps<{
		value?: string | number | null;
		type?: "number" | "text";
		min?: number | string;
		max?: number | string;
		step?: number | string;
		prefix?: string;
		suffix?: string;
		align?: "left" | "center" | "right";
		/** Amber outline when the value is driven by keyframes. */
		keyframed?: boolean;
		placeholder?: string;
		disabled?: boolean;
		ariaLabel?: string;
		mono?: boolean;
		class?: HTMLAttributes["class"];
		inputClass?: HTMLAttributes["class"];
	}>(),
	{ type: "number", align: undefined },
);

const emit = defineEmits<{
	input: [value: string];
	commit: [value: string];
}>();

const inputEl = ref<HTMLInputElement | null>(null);

/** Clicking the box chrome (prefix, suffix, padding) focuses the input. */
function onShellMouseDown(e: MouseEvent) {
	const target = e.target as HTMLElement;
	if (target === inputEl.value || target.closest("button, a, input, select")) return;
	e.preventDefault();
	inputEl.value?.focus();
}

defineExpose({ focus: () => inputEl.value?.focus(), el: inputEl });
</script>

<template>
	<div
		:class="
			cn(
				'flex h-7 min-w-0 cursor-text items-center gap-1 rounded-md border bg-surface-raised px-2 text-xs text-fg transition-[border-color,box-shadow]',
				'focus-within:border-brand-line focus-within:shadow-[0_0_0_3px_var(--brand-soft)]',
				keyframed ? 'border-[var(--warning-line)]' : 'border-line hover:border-line-strong',
				disabled && 'pointer-events-none opacity-50',
				props.class,
			)
		"
		@mousedown="onShellMouseDown"
	>
		<slot name="leading" />
		<span v-if="prefix" class="shrink-0 select-none text-2xs text-fg-subtle">{{ prefix }}</span>
		<input
			ref="inputEl"
			:type="type"
			:value="value ?? ''"
			:min="min"
			:max="max"
			:step="step"
			:placeholder="placeholder"
			:disabled="disabled"
			:aria-label="ariaLabel ?? prefix"
			spellcheck="false"
			autocomplete="off"
			:class="
				cn(
					'tabular h-full w-full min-w-0 bg-transparent text-xs text-fg outline-none placeholder:text-fg-subtle',
					'[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
					(align ?? (prefix ? 'right' : 'left')) === 'right' && 'text-right',
					(align ?? (prefix ? 'right' : 'left')) === 'center' && 'text-center',
					mono && 'font-mono',
					inputClass,
				)
			"
			@input="emit('input', ($event.target as HTMLInputElement).value)"
			@blur="emit('commit', ($event.target as HTMLInputElement).value)"
			@keydown.enter="($event.target as HTMLInputElement).blur()"
		/>
		<span v-if="suffix" class="shrink-0 select-none text-2xs text-fg-subtle">{{ suffix }}</span>
		<slot name="trailing" />
	</div>
</template>
