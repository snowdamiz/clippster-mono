<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { invokeAction } from "../../lib/actions";
import {
	Scissors,
	Copy,
	Trash2,
	ClipboardPaste,
	VolumeX,
	EyeOff,
	AudioLines,
	ScissorsLineDashed,
	Undo2,
	Redo2,
	CopyPlus,
	MousePointerClick,
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
const { selectElement, isElementSelected, selectAllInTrack } = useElementSelection();

const hasElement = computed(() => !!props.elementRef);

const canUndo = computed(() => editor.command.canUndo());
const canRedo = computed(() => editor.command.canRedo());
const hasClipboard = computed(() => editor.selection.hasClipboard());

const elementType = computed(() => {
	if (!props.elementRef) return null;
	const track = editor.timeline.getTrackById({ trackId: props.elementRef.trackId });
	if (!track) return null;
	const element = track.elements.find((el: { id: string }) => el.id === props.elementRef!.elementId);
	return element?.type ?? null;
});

const isVideoElement = computed(() => elementType.value === "video");
const isAudioElement = computed(() => elementType.value === "audio");
const canHaveAudio = computed(() => isVideoElement.value || isAudioElement.value);

const currentSpeed = computed(() => {
	if (!props.elementRef) return 1;
	const track = editor.timeline.getTrackById({ trackId: props.elementRef.trackId });
	if (!track) return 1;
	const element = track.elements.find((el: { id: string }) => el.id === props.elementRef!.elementId);
	return (element as any)?.speed ?? 1;
});

const showSpeedMenu = ref(false);
const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

const menuRef = ref<HTMLDivElement | null>(null);
const adjustedPosition = ref<{ x: number; y: number } | null>(null);

const menuStyle = computed(() => {
	const pos = adjustedPosition.value;
	if (!pos) return {};
	return { left: `${pos.x}px`, top: `${pos.y}px` };
});

function adjustMenuPosition(rawPos: { x: number; y: number }) {
	const padding = 8;
	let x = rawPos.x;
	let y = rawPos.y;

	const menu = menuRef.value;
	if (menu) {
		const menuRect = menu.getBoundingClientRect();
		const menuW = menuRect.width;
		const menuH = menuRect.height;

		if (x + menuW > window.innerWidth - padding) {
			x = window.innerWidth - menuW - padding;
		}
		if (y + menuH > window.innerHeight - padding) {
			y = window.innerHeight - menuH - padding;
		}
	} else {
		const estW = 220;
		const estH = 480;
		if (x + estW > window.innerWidth - padding) {
			x = window.innerWidth - estW - padding;
		}
		if (y + estH > window.innerHeight - padding) {
			y = window.innerHeight - estH - padding;
		}
	}

	x = Math.max(padding, x);
	y = Math.max(padding, y);

	adjustedPosition.value = { x, y };
}

function handleClickOutside(event: MouseEvent) {
	if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
		emit("close");
	}
}

function handleEscape(event: KeyboardEvent) {
	if (event.key === "Escape") emit("close");
}

function handleScroll() {
	emit("close");
}

// Attach/detach global dismiss listeners only while the menu is visible
let cleanupListeners: (() => void) | null = null;

watch(
	() => props.position,
	(pos) => {
		showSpeedMenu.value = false;
		cleanupListeners?.();
		cleanupListeners = null;

		if (pos && props.elementRef) {
			if (!isElementSelected({ trackId: props.elementRef.trackId, elementId: props.elementRef.elementId })) {
				selectElement({ trackId: props.elementRef.trackId, elementId: props.elementRef.elementId });
			}
		}

		if (pos) {
			adjustedPosition.value = { x: pos.x, y: pos.y };
			nextTick(() => {
				adjustMenuPosition(pos);
			});

			// Delay listener attachment so the opening right-click doesn't immediately dismiss
			requestAnimationFrame(() => {
				document.addEventListener("mousedown", handleClickOutside, true);
				document.addEventListener("contextmenu", handleClickOutside, true);
				document.addEventListener("keydown", handleEscape);
				window.addEventListener("scroll", handleScroll, true);
				cleanupListeners = () => {
					document.removeEventListener("mousedown", handleClickOutside, true);
					document.removeEventListener("contextmenu", handleClickOutside, true);
					document.removeEventListener("keydown", handleEscape);
					window.removeEventListener("scroll", handleScroll, true);
				};
			});
		} else {
			adjustedPosition.value = null;
		}
	},
);

onUnmounted(() => {
	cleanupListeners?.();
});

function doAction(action: string) {
	invokeAction(action as any);
	emit("close");
}

function handleSelectAllInTrack() {
	if (!props.elementRef) return;
	selectAllInTrack({ trackId: props.elementRef.trackId });
	emit("close");
}

function handleSetSpeed(speed: number) {
	if (!props.elementRef) return;
	editor.timeline.changeElementSpeed({
		trackId: props.elementRef.trackId,
		elementId: props.elementRef.elementId,
		speed,
	});
	emit("close");
}
</script>

<template>
	<Teleport to="body">
		<div
			v-if="position"
			ref="menuRef"
			class="fixed z-[9999] min-w-[200px] rounded-lg border border-white/10 bg-[#1e1e21] py-1 shadow-xl"
			:style="menuStyle"
		>
			<!-- ── Undo / Redo ── -->
			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-white/10"
				:class="canUndo ? 'text-zinc-300' : 'text-zinc-600 cursor-not-allowed'"
				:disabled="!canUndo"
				@click="doAction('undo')"
			>
				<Undo2 class="size-3.5" />
				Undo
				<span class="ml-auto text-zinc-500">Ctrl+Z</span>
			</button>
			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-white/10"
				:class="canRedo ? 'text-zinc-300' : 'text-zinc-600 cursor-not-allowed'"
				:disabled="!canRedo"
				@click="doAction('redo')"
			>
				<Redo2 class="size-3.5" />
				Redo
				<span class="ml-auto text-zinc-500">Ctrl+Y</span>
			</button>

			<div class="mx-2 my-1 h-px bg-white/10" />

			<!-- ── Cut / Copy / Paste / Duplicate ── -->
			<template v-if="hasElement">
				<button
					class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
					@click="doAction('cut-selected')"
				>
					<ScissorsLineDashed class="size-3.5" />
					Cut
					<span class="ml-auto text-zinc-500">Ctrl+X</span>
				</button>
				<button
					class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
					@click="doAction('copy-selected')"
				>
					<Copy class="size-3.5" />
					Copy
					<span class="ml-auto text-zinc-500">Ctrl+C</span>
				</button>
			</template>
			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-white/10"
				:class="hasClipboard ? 'text-zinc-300' : 'text-zinc-600 cursor-not-allowed'"
				:disabled="!hasClipboard"
				@click="doAction('paste-copied')"
			>
				<ClipboardPaste class="size-3.5" />
				Paste
				<span class="ml-auto text-zinc-500">Ctrl+V</span>
			</button>
			<template v-if="hasElement">
				<button
					class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
					@click="doAction('duplicate-selected')"
				>
					<CopyPlus class="size-3.5" />
					Duplicate
					<span class="ml-auto text-zinc-500">Ctrl+D</span>
				</button>
			</template>

			<!-- ── Split ── -->
			<template v-if="hasElement">
				<div class="mx-2 my-1 h-px bg-white/10" />

				<button
					class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
					@click="doAction('split')"
				>
					<Scissors class="size-3.5" />
					Split at playhead
					<span class="ml-auto text-zinc-500">S</span>
				</button>
				<button
					class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
					@click="doAction('split-left')"
				>
					<Scissors class="size-3.5" />
					Split &amp; keep left
					<span class="ml-auto text-zinc-500">Q</span>
				</button>
				<button
					class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
					@click="doAction('split-right')"
				>
					<Scissors class="size-3.5" />
					Split &amp; keep right
					<span class="ml-auto text-zinc-500">W</span>
				</button>
			</template>

			<!-- ── Element properties ── -->
			<template v-if="hasElement">
				<div class="mx-2 my-1 h-px bg-white/10" />

				<!-- Select all in track -->
				<button
					class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
					@click="handleSelectAllInTrack"
				>
					<MousePointerClick class="size-3.5" />
					Select all in track
					<span class="ml-auto text-zinc-500">Ctrl+A</span>
				</button>

				<!-- Toggle mute (only for elements that can have audio) -->
				<button
					v-if="canHaveAudio"
					class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
					@click="doAction('toggle-elements-muted-selected')"
				>
					<VolumeX class="size-3.5" />
					Toggle mute
				</button>

				<!-- Toggle visibility -->
				<button
					class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
					@click="doAction('toggle-elements-visibility-selected')"
				>
					<EyeOff class="size-3.5" />
					Toggle visibility
				</button>

				<!-- Speed (video/audio only) -->
				<template v-if="isVideoElement || isAudioElement">
					<div class="relative">
						<button
							class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
							@click="showSpeedMenu = !showSpeedMenu"
						>
							<Gauge class="size-3.5" />
							Speed
							<span class="ml-auto text-zinc-500">{{ currentSpeed }}x ›</span>
						</button>
						<div
							v-if="showSpeedMenu"
							class="absolute left-full top-0 ml-1 min-w-[100px] rounded-lg border border-white/10 bg-[#1e1e21] py-1 shadow-xl"
						>
							<button
								v-for="speed in speedOptions"
								:key="speed"
								class="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-white/10"
								:class="speed === currentSpeed ? 'text-sky-400' : 'text-zinc-300'"
								@click="handleSetSpeed(speed)"
							>
								{{ speed }}x
								<span v-if="speed === currentSpeed" class="text-sky-400">✓</span>
							</button>
						</div>
					</div>
				</template>

				<!-- Extract audio (video only) -->
				<template v-if="isVideoElement">
					<button
						class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/10"
						@click="doAction('extract-audio')"
					>
						<AudioLines class="size-3.5" />
						Extract audio
					</button>
				</template>

				<!-- ── Delete ── -->
				<div class="mx-2 my-1 h-px bg-white/10" />

				<button
					class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10"
					@click="doAction('delete-selected')"
				>
					<Trash2 class="size-3.5" />
					Delete
					<span class="ml-auto text-zinc-500">Del</span>
				</button>
			</template>
		</div>
	</Teleport>
</template>
