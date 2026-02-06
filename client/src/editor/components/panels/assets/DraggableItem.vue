<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { setDragData, clearDragData } from "../../../lib/drag-data";
import type { TimelineDragData } from "../../../types/drag";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-vue-next";

const props = withDefaults(defineProps<{
	name: string;
	dragData: TimelineDragData;
	aspectRatio?: number;
	shouldShowPlusOnDrag?: boolean;
	shouldShowLabel?: boolean;
	isRounded?: boolean;
	variant?: "card" | "compact";
	isDraggable?: boolean;
	isHighlighted?: boolean;
}>(), {
	aspectRatio: 16 / 9,
	shouldShowPlusOnDrag: true,
	shouldShowLabel: true,
	isRounded: true,
	variant: "card",
	isDraggable: true,
	isHighlighted: false,
});

const emit = defineEmits<{
	(e: "addToTimeline", payload: { currentTime: number }): void;
	(e: "dragStart", payload: { event: DragEvent }): void;
}>();

const { editor } = useEditor();
const isDragging = ref(false);
const dragPosition = ref({ x: 0, y: 0 });

function handleAddToTimeline() {
	emit("addToTimeline", { currentTime: editor.playback.getCurrentTime() });
}

function handleDragStart(e: DragEvent) {
	if (!e.dataTransfer) return;

	// Use transparent 1px image as drag ghost
	const emptyImg = new Image();
	emptyImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";
	e.dataTransfer.setDragImage(emptyImg, 0, 0);

	setDragData({ dataTransfer: e.dataTransfer, dragData: props.dragData });
	e.dataTransfer.effectAllowed = "copy";

	dragPosition.value = { x: e.clientX, y: e.clientY };
	isDragging.value = true;

	emit("dragStart", { event: e });
}

function handleDragEnd() {
	isDragging.value = false;
	clearDragData();
}

function onDocumentDragOver(e: DragEvent) {
	if (isDragging.value) {
		dragPosition.value = { x: e.clientX, y: e.clientY };
	}
}

onMounted(() => {
	document.addEventListener("dragover", onDocumentDragOver);
});

onUnmounted(() => {
	document.removeEventListener("dragover", onDocumentDragOver);
});
</script>

<template>
	<!-- Card variant -->
	<div v-if="variant === 'card'" class="group relative size-28">
		<div
			:class="[
				'relative flex h-auto w-full cursor-default flex-col gap-1 p-1',
				isHighlighted && 'ring-2 ring-primary bg-primary/10 rounded-sm',
			]"
		>
			<div
				:class="[
					'bg-zinc-800 relative overflow-hidden',
					isRounded && 'rounded-sm',
				]"
				:style="{ aspectRatio: String(aspectRatio) }"
				:draggable="isDraggable"
				@dragstart="isDraggable ? handleDragStart($event) : undefined"
				@dragend="isDraggable ? handleDragEnd() : undefined"
			>
				<slot name="preview" />
				<Button
					v-if="!isDragging"
					size="icon"
					class="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 absolute right-2 bottom-2 size-5 opacity-0 group-hover:opacity-100"
					@click.prevent.stop="handleAddToTimeline"
				>
					<Plus class="size-3" />
				</Button>
			</div>
			<span
				v-if="shouldShowLabel"
				class="text-zinc-500 w-full truncate text-left text-[0.7rem]"
				:title="name"
			>
				{{ name.length > 8 ? `${name.slice(0, 16)}...${name.slice(-3)}` : name }}
			</span>
		</div>
	</div>

	<!-- Compact variant -->
	<div
		v-else
		:class="['group relative w-full', isHighlighted && 'ring-2 ring-primary bg-primary/10 rounded-sm']"
	>
		<button
			type="button"
			:class="['flex h-8 w-full cursor-default items-center gap-3 px-1']"
			:draggable="isDraggable"
			@dragstart="isDraggable ? handleDragStart($event) : undefined"
			@dragend="isDraggable ? handleDragEnd() : undefined"
		>
			<div class="size-6 shrink-0 overflow-hidden rounded-[0.35rem]">
				<slot name="preview" />
			</div>
			<span class="w-full flex-1 truncate text-left text-sm">{{ name }}</span>
		</button>
	</div>

	<!-- Drag ghost (portal) -->
	<Teleport to="body">
		<div
			v-if="isDraggable && isDragging"
			class="pointer-events-none fixed z-[9999]"
			:style="{ left: `${dragPosition.x - 40}px`, top: `${dragPosition.y - 40}px` }"
		>
			<div class="w-[80px]">
				<div class="ring-primary relative overflow-hidden rounded-md shadow-2xl ring-[3px]" style="aspect-ratio: 1">
					<div class="size-full [&_img]:size-full [&_img]:rounded-none [&_img]:object-cover">
						<slot name="preview" />
					</div>
					<Button
						v-if="shouldShowPlusOnDrag"
						size="icon"
						class="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 absolute right-2 bottom-2 size-5"
						@click.prevent.stop="handleAddToTimeline"
					>
						<Plus class="size-3" />
					</Button>
				</div>
			</div>
		</div>
	</Teleport>
</template>
