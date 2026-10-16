<script setup lang="ts">
/**
 * Media card for the tabs of the "Import media" dialog (built clips, project
 * clips, Design Studio projects, image library). Wraps the shared AssetTile
 * (16:9 preview, label + sublabel below) with the dialog's states:
 *
 * - thumbnail `src`, or the `icon` when there is none / it fails to load
 * - `duration` chip (bottom right), `tag` chip (bottom left), `badges` slot (top left)
 * - `action` hint shown on hover, e.g. "Add to media" / "Open"
 * - `busy` spinner (+ optional `status` text), `error` overlay
 * - `added` = already in this edit's media (brand ring + check)
 *
 * Listeners/attrs (click, dblclick, pointerdown, keydown, title...) land on
 * the tile root. Top-right hover buttons go in the `actions` slot.
 *
 *   <ImportMediaTile :label="name" :src="thumb" :icon="Film" duration="0:42"
 *     :added="isAdded" :busy="isAdding" action="Add to media" @click="add" />
 */
import { ref, watch, type Component } from "vue";
import { AlertCircle, Loader2, Plus } from "lucide-vue-next";
import AssetTile from "../shared/AssetTile.vue";

const props = defineProps<{
	label: string;
	sublabel?: string;
	src?: string | null;
	/** Placeholder icon when there is no thumbnail. */
	icon: Component;
	duration?: string;
	tag?: string;
	added?: boolean;
	busy?: boolean;
	/** Progress text under the spinner while busy. */
	status?: string;
	error?: string;
	/** Hover hint describing what a click does. */
	action?: string;
	actionIcon?: Component;
}>();

const failed = ref(false);
watch(
	() => props.src,
	() => {
		failed.value = false;
	},
);
</script>

<template>
	<AssetTile
		as="div"
		role="button"
		:tabindex="busy ? -1 : 0"
		aspect="16/9"
		:label="label"
		:sublabel="sublabel"
		:selected="added"
		:aria-busy="busy || undefined"
		:class="busy ? 'cursor-wait' : 'cursor-pointer'"
	>
		<img
			v-if="src && !failed"
			:src="src"
			:alt="label"
			class="size-full object-cover"
			draggable="false"
			@error="failed = true"
		/>
		<div v-else class="flex size-full items-center justify-center">
			<component :is="icon" class="size-6 text-fg-subtle" />
		</div>

		<template #overlay>
			<div
				v-if="$slots.badges"
				class="absolute left-1.5 top-1.5 flex max-w-[calc(100%-2.5rem)] items-center gap-1"
			>
				<slot name="badges" />
			</div>
			<span
				v-if="tag"
				class="tabular absolute bottom-1.5 left-1.5 max-w-[60%] truncate rounded bg-black/60 px-1 text-2xs leading-4 text-white"
			>
				{{ tag }}
			</span>
			<span
				v-if="duration"
				class="tabular absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1 text-2xs leading-4 text-white"
			>
				{{ duration }}
			</span>

			<div
				v-if="busy"
				class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 px-2 text-center"
			>
				<Loader2 class="size-4 animate-spin text-white" />
				<span v-if="status" class="text-2xs leading-4 text-white/80">{{ status }}</span>
			</div>
			<div
				v-else-if="error"
				class="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 px-2 text-center"
				:title="error"
			>
				<AlertCircle class="size-4 text-danger" />
				<span class="line-clamp-2 text-2xs leading-4 text-white/85">{{ error }}</span>
			</div>
			<div
				v-else-if="action"
				class="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100"
			>
				<span class="inline-flex h-6 items-center gap-1 rounded-md bg-black/70 px-2 text-2xs font-medium text-white">
					<component :is="actionIcon ?? Plus" class="size-3" />
					{{ action }}
				</span>
			</div>
		</template>

		<template v-if="$slots.actions" #actions>
			<slot name="actions" />
		</template>
	</AssetTile>
</template>
