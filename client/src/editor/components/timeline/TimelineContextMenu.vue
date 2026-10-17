<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useExportDialog } from "../../composables/useExportDialog";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { invokeAction } from "../../lib/actions";
import type { TimelineElement } from "../../types/timeline";
import {
	Scissors,
	Copy,
	Download,
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
	Snowflake,
	ArrowLeftRight,
	RefreshCw,
} from "lucide-vue-next";
import MenuRow from "../chrome/MenuRow.vue";

const props = defineProps<{
	position: { x: number; y: number } | null;
	elementRef: { trackId: string; elementId: string } | null;
}>();

const emit = defineEmits<{
	(e: "close"): void;
}>();

const { editor } = useEditor({ subscribe: false });
const { openExportDialog } = useExportDialog();
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

const targetElement = computed<TimelineElement | null>(() => {
	if (!props.elementRef) return null;
	const track = editor.timeline.getTrackById({ trackId: props.elementRef.trackId });
	if (!track) return null;
	return (track.elements.find((el: { id: string }) => el.id === props.elementRef!.elementId) as TimelineElement | undefined) ?? null;
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

const isReversed = computed(() => {
	if (!props.elementRef) return false;
	const track = editor.timeline.getTrackById({ trackId: props.elementRef.trackId });
	if (!track) return false;
	const element = track.elements.find((el: { id: string }) => el.id === props.elementRef!.elementId);
	return (element as any)?.reversed ?? false;
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

function handleToggleReverse() {
	if (!props.elementRef) return;
	editor.timeline.updateElement({
		trackId: props.elementRef.trackId,
		elementId: props.elementRef.elementId,
		updates: { reversed: !isReversed.value } as any,
	});
	emit("close");
}

const canReplaceMedia = computed(() => isVideoElement.value || elementType.value === "image");

async function handleReplaceMedia() {
	if (!props.elementRef) return;
	emit("close");

	const input = document.createElement("input");
	input.type = "file";
	input.accept = isVideoElement.value ? "video/*" : "image/*";
	input.onchange = async () => {
		const file = input.files?.[0];
		if (!file) return;

		const projectId = editor.project.getActive()?.metadata?.id;
		if (!projectId) return;

		const isVideo = file.type.startsWith("video/");
		await editor.media.addMediaAsset({
			projectId,
			asset: {
				name: file.name,
				type: isVideo ? "video" : "image",
				file,
				url: URL.createObjectURL(file),
				ephemeral: true,
			},
		});

		const assets = editor.media.getAssets();
		const newAsset = assets[assets.length - 1];
		if (!newAsset || !props.elementRef) return;

		editor.timeline.updateElement({
			trackId: props.elementRef.trackId,
			elementId: props.elementRef.elementId,
			updates: { mediaId: newAsset.id } as any,
		});
	};
	input.click();
}

function handleExportSegment() {
	const element = targetElement.value;
	if (!element) return;

	emit("close");
	openExportDialog({
		timeRange: {
			startTime: element.startTime,
			endTime: element.startTime + element.duration,
		},
		segmentName: element.name || "Segment",
	});
}
</script>

<template>
	<Teleport to="body">
		<div
			v-if="position"
			ref="menuRef"
			class="fixed z-[10060] min-w-[220px] rounded-lg bg-surface-raised p-1 shadow-[var(--shadow-md)]"
			role="menu"
			:style="menuStyle"
		>
			<!-- Undo / Redo -->
			<MenuRow :icon="Undo2" shortcut="Ctrl+Z" :disabled="!canUndo" @click="doAction('undo')">Undo</MenuRow>
			<MenuRow :icon="Redo2" shortcut="Ctrl+Y" :disabled="!canRedo" @click="doAction('redo')">Redo</MenuRow>

			<div class="-mx-1 my-1 h-px bg-line-subtle" />

			<!-- Cut / Copy / Paste / Duplicate -->
			<template v-if="hasElement">
				<MenuRow :icon="ScissorsLineDashed" shortcut="Ctrl+X" @click="doAction('cut-selected')">Cut</MenuRow>
				<MenuRow :icon="Copy" shortcut="Ctrl+C" @click="doAction('copy-selected')">Copy</MenuRow>
			</template>
			<MenuRow :icon="ClipboardPaste" shortcut="Ctrl+V" :disabled="!hasClipboard" @click="doAction('paste-copied')">
				Paste
			</MenuRow>
			<MenuRow v-if="hasElement" :icon="CopyPlus" shortcut="Ctrl+D" @click="doAction('duplicate-selected')">
				Duplicate
			</MenuRow>

			<!-- Split -->
			<template v-if="hasElement">
				<div class="-mx-1 my-1 h-px bg-line-subtle" />
				<MenuRow :icon="Scissors" shortcut="S" @click="doAction('split')">Split at playhead</MenuRow>
				<MenuRow :icon="Scissors" shortcut="Q" @click="doAction('split-left')">Split &amp; keep left</MenuRow>
				<MenuRow :icon="Scissors" shortcut="W" @click="doAction('split-right')">Split &amp; keep right</MenuRow>
			</template>

			<!-- Element properties -->
			<template v-if="hasElement">
				<div class="-mx-1 my-1 h-px bg-line-subtle" />
				<MenuRow :icon="MousePointerClick" shortcut="Ctrl+A" @click="handleSelectAllInTrack">Select all in track</MenuRow>

				<div class="-mx-1 my-1 h-px bg-line-subtle" />
				<MenuRow v-if="canHaveAudio" :icon="VolumeX" @click="doAction('toggle-elements-muted-selected')">Toggle mute</MenuRow>
				<MenuRow :icon="EyeOff" @click="doAction('toggle-elements-visibility-selected')">Toggle visibility</MenuRow>

				<!-- Speed (video/audio only) -->
				<div v-if="isVideoElement || isAudioElement" class="relative">
					<MenuRow :icon="Gauge" :shortcut="`${currentSpeed}× ›`" @click="showSpeedMenu = !showSpeedMenu">Speed</MenuRow>
					<div
						v-if="showSpeedMenu"
						class="absolute left-full top-0 ml-1 min-w-[110px] rounded-lg bg-surface-raised p-1 shadow-[var(--shadow-md)]"
					>
						<MenuRow
							v-for="speed in speedOptions"
							:key="speed"
							checkable
							:active="speed === currentSpeed"
							@click="handleSetSpeed(speed)"
						>
							<span class="tabular">{{ speed }}×</span>
						</MenuRow>
					</div>
				</div>

				<MenuRow
					v-if="isVideoElement || elementType === 'image'"
					:icon="Snowflake"
					shortcut="Shift+F"
					@click="doAction('freeze-frame')"
				>
					Freeze frame
				</MenuRow>
				<MenuRow
					v-if="isVideoElement || isAudioElement"
					:icon="ArrowLeftRight"
					:active="isReversed"
					@click="handleToggleReverse"
				>
					{{ isReversed ? "Unreverse" : "Reverse" }}
				</MenuRow>
				<MenuRow v-if="isVideoElement" :icon="AudioLines" @click="doAction('extract-audio')">Extract audio</MenuRow>
				<MenuRow v-if="canReplaceMedia" :icon="RefreshCw" @click="handleReplaceMedia">Replace media</MenuRow>
				<MenuRow :icon="Download" @click="handleExportSegment">Export segment</MenuRow>

				<!-- Delete -->
				<div class="-mx-1 my-1 h-px bg-line-subtle" />
				<MenuRow :icon="Trash2" shortcut="Del" destructive @click="doAction('delete-selected')">Delete</MenuRow>
			</template>
		</div>
	</Teleport>
</template>
