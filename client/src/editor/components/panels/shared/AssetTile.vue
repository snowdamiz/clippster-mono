<script setup lang="ts">
/**
 * Tile for asset browser grids (effects, transitions, filters, captions,
 * media, clips...). Preview area on top (default slot), label row below.
 * Selected = brand ring + check; hover = stronger hairline.
 * Listeners/attrs (click, pointerdown, dragstart, title...) land on the root.
 *
 *   <AssetTile :label="preset.label" :selected="active === preset.id" aspect="4/3"
 *     @click="apply(preset)" @pointerdown="startDrag($event, preset)" @dragstart.prevent>
 *     <img :src="thumb" class="size-full object-cover" draggable="false" />
 *   </AssetTile>
 *
 * Slots: default (preview), `overlay` (absolutely positioned inside the
 * preview, e.g. duration chip), `actions` (top-right, shown on hover),
 * `meta` (after the label), `footer` (replaces the label row).
 */
import type { HTMLAttributes } from "vue";
import { Check, Loader2 } from "lucide-vue-next";
import { cn } from "@/lib/utils";

const props = withDefaults(
	defineProps<{
		label?: string;
		sublabel?: string;
		selected?: boolean;
		/** CSS aspect-ratio of the preview area, e.g. "16/9", "1", "4/3". */
		aspect?: string | number;
		loading?: boolean;
		disabled?: boolean;
		as?: "button" | "div";
		/** Hide the check badge while still drawing the selected ring. */
		hideCheck?: boolean;
		class?: HTMLAttributes["class"];
		previewClass?: HTMLAttributes["class"];
	}>(),
	{ aspect: "4/3", as: "button" },
);
</script>

<template>
	<component
		:is="as"
		:type="as === 'button' ? 'button' : undefined"
		:disabled="as === 'button' ? disabled : undefined"
		:aria-pressed="as === 'button' && selected ? true : undefined"
		:class="
			cn(
				'group/tile relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-surface-raised text-left transition-[border-color,box-shadow,transform] duration-150',
				'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
				selected
					? 'border-brand shadow-[0_0_0_1px_var(--brand)]'
					: 'border-line-subtle hover:border-line-strong',
				disabled && 'pointer-events-none opacity-50',
				props.class,
			)
		"
	>
		<div
			:class="cn('relative w-full shrink-0 overflow-hidden bg-surface-sunken', previewClass)"
			:style="{ aspectRatio: String(aspect) }"
		>
			<slot />
			<slot name="overlay" />
			<div v-if="loading" class="absolute inset-0 grid place-items-center bg-[var(--overlay)]">
				<Loader2 class="size-4 animate-spin text-fg" />
			</div>
			<span
				v-if="selected && !hideCheck"
				class="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-brand text-brand-fg"
			>
				<Check class="size-2.5" :stroke-width="3" />
			</span>
			<div
				v-if="$slots.actions"
				class="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-within/tile:opacity-100"
			>
				<slot name="actions" />
			</div>
		</div>
		<slot name="footer">
			<div v-if="label || sublabel || $slots.meta" class="flex min-w-0 items-center gap-1 px-2 py-1.5">
				<div class="min-w-0 flex-1">
					<p
						class="truncate text-xs leading-4 transition-colors"
						:class="selected ? 'text-fg' : 'text-fg-muted group-hover/tile:text-fg'"
					>
						{{ label }}
					</p>
					<p v-if="sublabel" class="truncate text-2xs leading-4 text-fg-subtle">{{ sublabel }}</p>
				</div>
				<slot name="meta" />
			</div>
		</slot>
	</component>
</template>
