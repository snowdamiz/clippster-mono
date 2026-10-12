<script setup lang="ts">
import { computed, ref } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { useEditorUIState } from "../../composables/useEditorUIState";
import { formatTimeCode } from "../../lib/time";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import { sliderToZoom, zoomToSlider } from "../../lib/timeline/zoom-utils";
import { invokeAction } from "../../lib/actions";
import {
	Play,
	Pause,
	SkipBack,
	Scissors,
	Copy,
	Trash2,
	Bookmark,
	Magnet,
	Link,
	ZoomIn,
	ZoomOut,
	AlignLeft,
	AlignRight,
	Snowflake,
	SplitSquareHorizontal,
	Undo2,
	Redo2,
	MousePointerClick,
	Navigation2,
	Crop,
	Crosshair,
	Maximize2,
} from "lucide-vue-next";
import ToolbarButton from "../chrome/ToolbarButton.vue";
import ToolbarSeparator from "../chrome/ToolbarSeparator.vue";

const props = defineProps<{
	zoomLevel: number;
	minZoom: number;
	razorMode?: boolean;
	autoFollow?: boolean;
	mainTrackMagnet?: boolean;
	autoSnapping?: boolean;
	linkage?: boolean;
}>();

const emit = defineEmits<{
	(e: "setZoomLevel", zoom: number): void;
	(e: "toggleRazorMode"): void;
	(e: "toggleAutoFollow"): void;
	(e: "toggleMainTrackMagnet"): void;
	(e: "toggleAutoSnapping"): void;
	(e: "toggleLinkage"): void;
	(e: "scrollToPlayhead"): void;
	(e: "zoomToFit"): void;
}>();

const { editor, version } = useEditor({
	subscribe: {
		playback: true,
		timeline: true,
		project: true,
		selection: true,
		scenes: false,
		media: false,
	},
});
const { selectedElements } = useElementSelection();
const { isCropMode, toggleCropMode } = useEditorUIState();

const selectedVideoOrImage = computed(() => {
	void version.value;
	if (selectedElements.value.length === 0) return null;
	const tracks = editor.timeline.getTracks();
	for (const sel of selectedElements.value) {
		const track = tracks.find((t) => t.id === sel.trackId);
		const el = track?.elements.find((e) => e.id === sel.elementId);
		if (el && (el.type === "video" || el.type === "image")) return el as any;
	}
	return null;
});

const hasVideoOrImageSelected = computed(() => !!selectedVideoOrImage.value);

const currentTime = computed(() => {
	void version.value;
	return editor.playback.getCurrentTime();
});
const isPlaying = computed(() => {
	void version.value;
	return editor.playback.getIsPlaying();
});
const totalDuration = computed(() => {
	void version.value;
	return editor.timeline.getTotalDuration();
});
const fps = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull()?.settings?.fps ?? 30;
});

const canUndo = computed(() => {
	void version.value;
	return editor.command.canUndo();
});
const canRedo = computed(() => {
	void version.value;
	return editor.command.canRedo();
});

const hasTimelineContent = computed(() => {
	void version.value;
	const tracks = editor.timeline.getTracks();
	return tracks.some((track) => track.elements.length > 0);
});

const sliderValue = computed(() => zoomToSlider({ zoomLevel: props.zoomLevel, minZoom: props.minZoom }));

function handleZoom(direction: "in" | "out") {
	const newZoom =
		direction === "in"
			? Math.min(TIMELINE_CONSTANTS.ZOOM_MAX, props.zoomLevel * TIMELINE_CONSTANTS.ZOOM_BUTTON_FACTOR)
			: Math.max(props.minZoom, props.zoomLevel / TIMELINE_CONSTANTS.ZOOM_BUTTON_FACTOR);
	emit("setZoomLevel", newZoom);
}

function handleSliderInput(event: Event) {
	const target = event.target as HTMLInputElement;
	const val = parseFloat(target.value);
	emit("setZoomLevel", sliderToZoom({ sliderPosition: val, minZoom: props.minZoom }));
}

function handleAction(action: string, event?: MouseEvent) {
	event?.stopPropagation();
	invokeAction(action as any);
}
</script>

<template>
	<div class="flex h-9 items-center justify-between gap-2 overflow-x-auto border-b border-line-subtle bg-panel px-1.5">
		<!-- Left: playback + editing tools -->
		<div class="flex shrink-0 items-center gap-0.5">
			<ToolbarButton
				:label="isPlaying ? 'Pause' : 'Play'"
				shortcut="Space"
				:disabled="!hasTimelineContent"
				@click="handleAction('toggle-play', $event)"
			>
				<Pause v-if="isPlaying" />
				<Play v-else />
			</ToolbarButton>
			<ToolbarButton label="Go to start" shortcut="Home" :disabled="!hasTimelineContent" @click="handleAction('goto-start', $event)">
				<SkipBack />
			</ToolbarButton>

			<!-- Timecode -->
			<div class="flex items-center gap-1.5 px-2 font-mono text-xs tabular">
				<span class="text-fg">{{ formatTimeCode({ timeInSeconds: currentTime, format: "HH:MM:SS:FF", fps }) }}</span>
				<span class="text-fg-disabled">/</span>
				<span class="text-fg-subtle">{{ formatTimeCode({ timeInSeconds: totalDuration, format: "HH:MM:SS:FF", fps }) }}</span>
			</div>

			<ToolbarSeparator />

			<ToolbarButton label="Split element" shortcut="S" :disabled="!hasTimelineContent" @click="handleAction('split', $event)">
				<Scissors />
			</ToolbarButton>
			<ToolbarButton class="hidden lg:inline-flex" label="Split and remove left" shortcut="Q" :disabled="!hasTimelineContent" @click="handleAction('split-left', $event)">
				<AlignLeft />
			</ToolbarButton>
			<ToolbarButton class="hidden lg:inline-flex" label="Split and remove right" shortcut="W" :disabled="!hasTimelineContent" @click="handleAction('split-right', $event)">
				<AlignRight />
			</ToolbarButton>
			<ToolbarButton label="Duplicate element" shortcut="Ctrl+D" :disabled="!hasTimelineContent" @click="handleAction('duplicate-selected', $event)">
				<Copy />
			</ToolbarButton>
			<ToolbarButton label="Delete element" shortcut="Delete" :disabled="!hasTimelineContent" @click="handleAction('delete-selected', $event)">
				<Trash2 />
			</ToolbarButton>
			<ToolbarButton
				label="Crop video/image"
				shortcut="C"
				toggle
				:active="isCropMode"
				:disabled="!hasVideoOrImageSelected"
				@click="toggleCropMode(selectedVideoOrImage?.crop)"
			>
				<Crop />
			</ToolbarButton>
			<ToolbarButton class="hidden lg:inline-flex" label="Freeze frame" shortcut="Shift+F" :disabled="!hasTimelineContent" @click="handleAction('freeze-frame', $event)">
				<Snowflake />
			</ToolbarButton>

			<ToolbarSeparator class="hidden lg:block" />

			<ToolbarButton class="hidden lg:inline-flex" label="Toggle bookmark" shortcut="B" :disabled="!hasTimelineContent" @click="handleAction('toggle-bookmark', $event)">
				<Bookmark />
			</ToolbarButton>

			<ToolbarSeparator />

			<ToolbarButton
				label="Razor tool (click to cut)"
				toggle
				:active="razorMode"
				:disabled="!hasTimelineContent"
				@click="emit('toggleRazorMode')"
			>
				<MousePointerClick />
			</ToolbarButton>
			<ToolbarButton
				label="Auto-follow playhead"
				toggle
				:active="autoFollow"
				:disabled="!hasTimelineContent"
				@click="emit('toggleAutoFollow')"
			>
				<Navigation2 />
			</ToolbarButton>
		</div>

		<!-- Right: timeline behaviour + zoom -->
		<div class="flex shrink-0 items-center gap-0.5">
			<ToolbarButton
				label="Main track magnet"
				toggle
				:active="mainTrackMagnet"
				:disabled="!hasTimelineContent"
				@click="emit('toggleMainTrackMagnet')"
			>
				<Magnet />
			</ToolbarButton>
			<ToolbarButton
				label="Auto snapping"
				shortcut="N"
				toggle
				:active="autoSnapping"
				:disabled="!hasTimelineContent"
				@click="emit('toggleAutoSnapping')"
			>
				<SplitSquareHorizontal />
			</ToolbarButton>
			<ToolbarButton
				label="Linked clip movement"
				toggle
				:active="linkage"
				:disabled="!hasTimelineContent"
				@click="emit('toggleLinkage')"
			>
				<Link />
			</ToolbarButton>

			<ToolbarSeparator />

			<ToolbarButton class="hidden lg:inline-flex" label="Scroll to playhead" :disabled="!hasTimelineContent" @click="emit('scrollToPlayhead')">
				<Crosshair />
			</ToolbarButton>
			<ToolbarButton class="hidden lg:inline-flex" label="Zoom to fit" :disabled="!hasTimelineContent" @click="emit('zoomToFit')">
				<Maximize2 />
			</ToolbarButton>
			<ToolbarButton label="Zoom out" :disabled="!hasTimelineContent" @click="handleZoom('out')">
				<ZoomOut />
			</ToolbarButton>
			<input
				type="range"
				class="mx-1 hidden w-24 disabled:cursor-not-allowed disabled:opacity-40 lg:block"
				aria-label="Timeline zoom"
				:disabled="!hasTimelineContent"
				:value="sliderValue"
				min="0"
				max="1"
				step="0.005"
				@input="handleSliderInput"
			/>
			<ToolbarButton label="Zoom in" :disabled="!hasTimelineContent" @click="handleZoom('in')">
				<ZoomIn />
			</ToolbarButton>
		</div>
	</div>
</template>
