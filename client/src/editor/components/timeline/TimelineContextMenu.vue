<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { invokeAction } from "../../lib/actions";
import {
	Scissors,
	Copy,
	Trash2,
	ClipboardPaste,
	Volume2,
	VolumeX,
	Eye,
	EyeOff,
	Gauge,
} from "lucide-vue-next";

const props = defineProps<{
	position: { x: number; y: number } | null;
	elementRef: { trackId: string; elementId: string } | null;
}>();

const emit = defineEmits<{
	(e: "close"): void;
}>();

const { editor } = useEditor();
const { selectElement, isElementSelected } = useElementSelection();

const menuRef = ref<HTMLDivElement | null>(null);

watch(
	() => props.position,
	(pos) => {
		if (pos && props.elementRef) {
			if (!isElementSelected({ trackId: props.elementRef.trackId, elementId: props.elementRef.elementId })) {
				selectElement({ trackId: props.elementRef.trackId, elementId: props.elementRef.elementId });
			}
		}
	},
);

function handleClickOutside(event: MouseEvent) {
	if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
		emit("close");
	}
}

onMounted(() => {
	document.addEventListener("mousedown", handleClickOutside);
});

onUnmounted(() => {
	document.removeEventListener("mousedown", handleClickOutside);
});

function doAction(action: string) {
	invokeAction(action as any);
	emit("close");
}

function handleSplit() {
	doAction("split");
}

function handleSplitLeft() {
	doAction("split-left");
}

function handleSplitRight() {
	doAction("split-right");
}

function handleDuplicate() {
	doAction("duplicate-selected");
}

function handleDelete() {
	doAction("delete-selected");
}

function handleCopy() {
	doAction("copy-selected");
}

function handlePaste() {
	doAction("paste-copied");
}

function handleToggleMute() {
	doAction("toggle-elements-muted-selected");
}

function handleToggleVisibility() {
	doAction("toggle-elements-visibility-selected");
}
</script>

<template>
	<Teleport to="body">
		<div
			v-if="position"
			ref="menuRef"
			class="fixed z-[9999] min-w-[180px] rounded-lg border border-white/10 bg-[#1e1e21] py-1 shadow-xl"
			:style="{ left: `${position.x}px`, top: `${position.y}px` }"
		>
			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
				@click="handleSplit"
			>
				<Scissors class="size-3.5" />
				Split at playhead
				<span class="ml-auto text-zinc-500">S</span>
			</button>
			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
				@click="handleSplitLeft"
			>
				<Scissors class="size-3.5" />
				Split &amp; keep left
				<span class="ml-auto text-zinc-500">Q</span>
			</button>
			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
				@click="handleSplitRight"
			>
				<Scissors class="size-3.5" />
				Split &amp; keep right
				<span class="ml-auto text-zinc-500">W</span>
			</button>

			<div class="mx-2 my-1 h-px bg-white/10" />

			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
				@click="handleCopy"
			>
				<Copy class="size-3.5" />
				Copy
				<span class="ml-auto text-zinc-500">Ctrl+C</span>
			</button>
			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
				@click="handlePaste"
			>
				<ClipboardPaste class="size-3.5" />
				Paste
				<span class="ml-auto text-zinc-500">Ctrl+V</span>
			</button>
			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
				@click="handleDuplicate"
			>
				<Copy class="size-3.5" />
				Duplicate
				<span class="ml-auto text-zinc-500">Ctrl+D</span>
			</button>

			<div class="mx-2 my-1 h-px bg-white/10" />

			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
				@click="handleToggleMute"
			>
				<VolumeX class="size-3.5" />
				Toggle mute
			</button>
			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
				@click="handleToggleVisibility"
			>
				<EyeOff class="size-3.5" />
				Toggle visibility
			</button>

			<div class="mx-2 my-1 h-px bg-white/10" />

			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 hover:bg-white/10"
				@click="handleDelete"
			>
				<Trash2 class="size-3.5" />
				Delete
				<span class="ml-auto text-zinc-500">Del</span>
			</button>
		</div>
	</Teleport>
</template>
