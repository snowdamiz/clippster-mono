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

const { editor } = useEditor({ subscribe: false });
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
				'relative flex h-auto w-full cursor-default flex-col gap-1 rounded-md p-1',
				isHighlighted && 'bg-brand-soft ring-2 ring-brand',
			]"
		>
			<div
				:class="[
					'relative overflow-hidden border border-line-subtle bg-surface-sunken',
					isRounded && 'rounded-md',
				]"
				:style="{ aspectRatio: String(aspectRatio) }"
				:draggable="isDraggable"
				@dragstart="isDraggable ? handleDragStart($event) : undefined"
				@dragend="isDraggable ? handleDragEnd() : undefined"
			>
				<slot name="preview" />
				<Button
					v-if="!isDragging"
					variant="secondary"
					size="icon-xs"
					class="absolute bottom-1.5 right-1.5 size-5 opacity-0 transition-opacity group-hover:opacity-100 [&_svg]:size-3"
					title="Add to timeline"
					:aria-label="`Add ${name} to timeline`"
					@click.prevent.stop="handleAddToTimeline"
				>
					<Plus />
				</Button>
			</div>
			<span
				v-if="shouldShowLabel"
				class="w-full truncate text-left text-2xs text-fg-muted"
				:title="name"
			>
				{{ name.length > 8 ? `${name.slice(0, 16)}...${name.slice(-3)}` : name }}
			</span>
		</div>
	</div>

	<!-- Compact variant -->
	<div
		v-else
		:class="['group relative w-full rounded-md', isHighlighted && 'bg-brand-soft ring-2 ring-brand']"
	>
		<button
			type="button"
			class="flex h-8 w-full cursor-default items-center gap-2.5 rounded-md px-1 transition-colors hover:bg-surface-hover"
			:draggable="isDraggable"
			@dragstart="isDraggable ? handleDragStart($event) : undefined"
			@dragend="isDraggable ? handleDragEnd() : undefined"
		>
			<div class="size-6 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
				<slot name="preview" />
			</div>
			<span class="w-full flex-1 truncate text-left text-xs text-fg">{{ name }}</span>
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
				<div class="relative overflow-hidden rounded-md bg-surface-sunken shadow-[var(--shadow-lg)] ring-2 ring-brand" style="aspect-ratio: 1">
					<div class="size-full [&_img]:size-full [&_img]:rounded-none [&_img]:object-cover">
						<slot name="preview" />
					</div>
					<Button
						v-if="shouldShowPlusOnDrag"
						variant="secondary"
						size="icon-xs"
						class="absolute bottom-1.5 right-1.5 size-5 [&_svg]:size-3"
						title="Add to timeline"
						:aria-label="`Add ${name} to timeline`"
						@click.prevent.stop="handleAddToTimeline"
					>
						<Plus />
					</Button>
				</div>
			</div>
		</div>
	</Teleport>
</template>
