<script setup lang="ts">
/**
 * Search row at the top of an asset browser view. Matches the app SearchField
 * (28px, leading icon, clear button) inside a 36px panel bar (same height as chrome/PanelHeader); extra toolbar
 * buttons go in the default slot. Non-prop attrs/listeners (e.g. @input,
 * @keydown.enter) are bound to the native input.
 */
import { ref } from "vue";
import { Search, X } from "lucide-vue-next";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
	defineProps<{
		modelValue: string;
		placeholder?: string;
		/** Show the built-in clear button (off when the view has its own). */
		clearable?: boolean;
	}>(),
	{ clearable: true },
);

const emit = defineEmits<{
	"update:modelValue": [value: string];
}>();

const inputEl = ref<HTMLInputElement | null>(null);

function onInput(e: Event) {
	emit("update:modelValue", (e.target as HTMLInputElement).value);
}

/** Clear through a real input event so views listening to @input react too. */
function clear() {
	const el = inputEl.value;
	if (!el) return;
	el.value = "";
	el.dispatchEvent(new Event("input", { bubbles: true }));
	el.focus();
}
</script>

<template>
	<div class="flex h-9 shrink-0 items-center gap-1 border-b border-line-subtle px-1.5">
		<label
			class="group relative flex h-7 min-w-0 flex-1 items-center rounded-md border border-line bg-surface-raised transition-[border-color,box-shadow] hover:border-line-strong focus-within:border-brand-line focus-within:shadow-[0_0_0_3px_var(--brand-soft)]"
		>
			<Search class="pointer-events-none ml-2 size-3.5 shrink-0 text-fg-subtle group-focus-within:text-fg-muted" />
			<input
				ref="inputEl"
				:value="modelValue"
				type="text"
				:placeholder="placeholder"
				spellcheck="false"
				autocomplete="off"
				class="h-full w-full min-w-0 bg-transparent pl-1.5 pr-6 text-xs text-fg placeholder:text-fg-subtle focus:outline-none"
				v-bind="$attrs"
				@input="onInput"
			/>
			<button
				v-if="clearable && modelValue"
				type="button"
				class="absolute right-1 grid size-5 place-items-center rounded text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
				aria-label="Clear search"
				@click.prevent="clear"
			>
				<X class="size-3" />
			</button>
		</label>
		<slot />
	</div>
</template>
