<script setup lang="ts">
/**
 * A titled group of inspector controls. Sections stack with hairline
 * dividers. Optionally collapsible (controlled via v-model:open, or
 * uncontrolled with `defaultOpen`).
 *
 *   <InspectorSection title="Transform">
 *     <template #actions><Button variant="ghost" size="xs">Reset</Button></template>
 *     ...controls
 *   </InspectorSection>
 */
import type { Component, HTMLAttributes } from "vue";
import { computed, ref } from "vue";
import { ChevronRight } from "lucide-vue-next";
import { cn } from "@/lib/utils";

const props = withDefaults(
	defineProps<{
		title?: string;
		icon?: Component;
		collapsible?: boolean;
		/** Controlled open state (v-model:open). */
		open?: boolean;
		defaultOpen?: boolean;
		/** Drop the bottom divider (e.g. last section in a scroll area). */
		flush?: boolean;
		class?: HTMLAttributes["class"];
		bodyClass?: HTMLAttributes["class"];
	}>(),
	{ open: undefined, defaultOpen: true },
);

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const internalOpen = ref(props.defaultOpen);
const isOpen = computed(() => (!props.collapsible ? true : (props.open ?? internalOpen.value)));

function toggle() {
	const next = !isOpen.value;
	internalOpen.value = next;
	emit("update:open", next);
}
</script>

<template>
	<section :class="cn(!flush && 'border-b border-line-subtle', props.class)">
		<div v-if="title || $slots.title" class="flex h-9 items-center gap-2 pl-3 pr-2">
			<button
				v-if="collapsible"
				type="button"
				class="group/section -ml-1 flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-left"
				:aria-expanded="isOpen"
				@click="toggle"
			>
				<ChevronRight
					class="size-3.5 shrink-0 text-fg-subtle transition-transform duration-150 group-hover/section:text-fg-muted"
					:class="isOpen && 'rotate-90'"
				/>
				<component :is="icon" v-if="icon" class="size-3.5 shrink-0 text-fg-subtle" />
				<span
					class="truncate text-xs font-semibold transition-colors"
					:class="isOpen ? 'text-fg' : 'text-fg-muted group-hover/section:text-fg'"
				>
					<slot name="title">{{ title }}</slot>
				</span>
				<slot name="meta" />
			</button>
			<div v-else class="flex min-w-0 flex-1 items-center gap-1.5">
				<component :is="icon" v-if="icon" class="size-3.5 shrink-0 text-fg-subtle" />
				<span class="truncate text-xs font-semibold text-fg"><slot name="title">{{ title }}</slot></span>
				<slot name="meta" />
			</div>
			<div v-if="$slots.actions" class="flex shrink-0 items-center gap-0.5">
				<slot name="actions" />
			</div>
		</div>
		<div
			v-if="isOpen"
			:class="cn('space-y-3 px-3 pb-3', !(title || $slots.title) && 'pt-3', bodyClass)"
		>
			<slot />
		</div>
	</section>
</template>
