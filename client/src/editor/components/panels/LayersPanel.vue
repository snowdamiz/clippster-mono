<script setup lang="ts">
import { computed } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import {
	Eye,
	EyeOff,
	Lock,
	Unlock,
	Trash2,
	Type,
	ImageIcon,
	Film,
	Smile,
	Wand2,
	ChevronUp,
	ChevronDown,
	Layers,
} from "lucide-vue-next";

const { editor, version } = useEditor();
const { selectedElements, selectElement } = useElementSelection();

const allElements = computed(() => {
	void version.value;
	const tracks = editor.timeline.getTracks();
	const elements: Array<{
		elementId: string;
		name: string;
		type: string;
		trackId: string;
		selected: boolean;
	}> = [];

	// Collect elements from all tracks, reversed so top layer is first
	for (const track of tracks) {
		for (const el of [...track.elements].reverse()) {
			elements.push({
				elementId: el.id,
				name: el.name || el.type,
				type: el.type,
				trackId: track.id,
				selected: selectedElements.value.some((s) => s.elementId === el.id),
			});
		}
	}

	return elements;
});

function getTypeIcon(type: string) {
	switch (type) {
		case "text":
			return Type;
		case "image":
			return ImageIcon;
		case "video":
			return Film;
		case "sticker":
			return Smile;
		case "effect":
			return Wand2;
		default:
			return Layers;
	}
}

function getTypeColor(type: string) {
	switch (type) {
		case "text":
			return "text-blue-400";
		case "image":
			return "text-emerald-400";
		case "video":
			return "text-purple-400";
		case "sticker":
			return "text-amber-400";
		case "effect":
			return "text-pink-400";
		default:
			return "text-zinc-400";
	}
}

function handleSelect(trackId: string, elementId: string) {
	selectElement({ trackId, elementId });
}

function handleDelete(trackId: string, elementId: string) {
	editor.timeline.deleteElements({ elements: [{ trackId, elementId }] });
}
</script>

<template>
	<div class="flex h-full flex-col">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
			<div class="flex items-center gap-1.5">
				<Layers class="size-3.5 text-zinc-500" />
				<span class="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Layers</span>
			</div>
			<span class="text-[10px] text-zinc-600">{{ allElements.length }}</span>
		</div>

		<!-- Layer list -->
		<div class="flex-1 overflow-y-auto">
			<div v-if="allElements.length === 0" class="flex flex-col items-center justify-center py-10 px-4">
				<Layers class="size-8 text-zinc-700 mb-2" :stroke-width="1" />
				<p class="text-[11px] text-zinc-600 text-center">No layers yet</p>
				<p class="text-[10px] text-zinc-700 text-center mt-0.5">Add text, images, or stickers from the left panel</p>
			</div>

			<div v-else class="py-1">
				<button
					v-for="el in allElements"
					:key="el.elementId"
					type="button"
					:class="[
						'group flex w-full items-center gap-2 px-3 py-[7px] text-left transition-colors',
						el.selected
							? 'bg-blue-500/10 border-l-2 border-blue-500'
							: 'border-l-2 border-transparent hover:bg-white/[0.03]',
					]"
					@click="handleSelect(el.trackId, el.elementId)"
				>
					<component
						:is="getTypeIcon(el.type)"
						:class="['size-3.5 shrink-0', el.selected ? 'text-blue-400' : getTypeColor(el.type)]"
					/>
					<span
						:class="[
							'flex-1 truncate text-[11px]',
							el.selected ? 'text-zinc-200' : 'text-zinc-400',
						]"
					>
						{{ el.name }}
					</span>
					<button
						type="button"
						class="hidden shrink-0 rounded p-0.5 text-zinc-600 hover:text-red-400 group-hover:block"
						@click.stop="handleDelete(el.trackId, el.elementId)"
					>
						<Trash2 class="size-3" />
					</button>
				</button>
			</div>
		</div>
	</div>
</template>
