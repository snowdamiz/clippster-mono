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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

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

const { editor, version } = useEditor();
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
const undoCount = computed(() => {
	void version.value;
	return editor.command.getUndoStackSize();
});
const redoCount = computed(() => {
	void version.value;
	return editor.command.getRedoStackSize();
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
	<div class="flex h-10 items-center justify-between border-b border-white/10 bg-[#18181b] px-2 py-1">
		<!-- Left section: playback + editing tools -->
		<div class="flex items-center gap-1">
			<TooltipProvider :delay-duration="500">
				<!-- Play/Pause -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button variant="ghost" size="icon" :disabled="!hasTimelineContent" @click="handleAction('toggle-play', $event)">
							<Pause v-if="isPlaying" class="size-4" />
							<Play v-else class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{{ isPlaying ? 'Pause' : 'Play' }}</TooltipContent>
				</Tooltip>

				<!-- Go to start -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button variant="ghost" size="icon" :disabled="!hasTimelineContent" @click="handleAction('goto-start', $event)">
							<SkipBack class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Go to start</TooltipContent>
				</Tooltip>

				<div class="mx-1 h-6 w-px bg-white/10" />

				<!-- Time display -->
				<div class="flex flex-row items-center justify-center px-2">
					<div class="text-zinc-200 text-center font-mono text-xs">
						{{ formatTimeCode({ timeInSeconds: currentTime, format: "HH:MM:SS:FF", fps }) }}
					</div>
					<div class="text-zinc-500 px-2 font-mono text-xs">/</div>
					<div class="text-zinc-500 text-center font-mono text-xs">
						{{ formatTimeCode({ timeInSeconds: totalDuration, format: "HH:MM:SS:FF", fps }) }}
					</div>
				</div>

				<div class="mx-1 h-6 w-px bg-white/10" />

				<!-- Undo -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button variant="ghost" size="icon" class="relative" :disabled="!canUndo" @click="handleAction('undo', $event)">
							<Undo2 class="size-4" />
							<span v-if="undoCount > 0" class="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-zinc-600 text-[8px] text-white">{{ undoCount > 99 ? '99' : undoCount }}</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Undo (Ctrl+Z)</TooltipContent>
				</Tooltip>

				<!-- Redo -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button variant="ghost" size="icon" class="relative" :disabled="!canRedo" @click="handleAction('redo', $event)">
							<Redo2 class="size-4" />
							<span v-if="redoCount > 0" class="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-zinc-600 text-[8px] text-white">{{ redoCount > 99 ? '99' : redoCount }}</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
				</Tooltip>

				<div class="mx-1 h-6 w-px bg-white/10" />

				<!-- Split -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button variant="ghost" size="icon" :disabled="!hasTimelineContent" @click="handleAction('split', $event)">
							<Scissors class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Split element</TooltipContent>
				</Tooltip>

				<!-- Split left -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button variant="ghost" size="icon" :disabled="!hasTimelineContent" @click="handleAction('split-left', $event)">
							<AlignLeft class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Split left</TooltipContent>
				</Tooltip>

				<!-- Split right -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button variant="ghost" size="icon" :disabled="!hasTimelineContent" @click="handleAction('split-right', $event)">
							<AlignRight class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Split right</TooltipContent>
				</Tooltip>

				<!-- Duplicate -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button variant="ghost" size="icon" :disabled="!hasTimelineContent" @click="handleAction('duplicate-selected', $event)">
							<Copy class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Duplicate element</TooltipContent>
				</Tooltip>

				<!-- Delete -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button variant="ghost" size="icon" :disabled="!hasTimelineContent" @click="handleAction('delete-selected', $event)">
							<Trash2 class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Delete element</TooltipContent>
				</Tooltip>

				<!-- Crop -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button
							variant="ghost"
							size="icon"
							:disabled="!hasVideoOrImageSelected"
							class="relative overflow-visible"
							:class="{ 'text-cyan-400': isCropMode }"
							@click="toggleCropMode(selectedVideoOrImage?.crop)"
						>
							<span v-if="isCropMode" class="pointer-events-none absolute top-0 left-1/2 block h-0 w-0 -translate-x-1/2 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-cyan-400" />
							<Crop class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Crop video/image (C)</TooltipContent>
				</Tooltip>

				<!-- Freeze Frame -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button variant="ghost" size="icon" :disabled="!hasTimelineContent" @click="handleAction('freeze-frame', $event)">
							<Snowflake class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Freeze frame (Shift+F)</TooltipContent>
				</Tooltip>

				<div class="mx-1 h-6 w-px bg-white/10" />

				<!-- Bookmark -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button variant="ghost" size="icon" :disabled="!hasTimelineContent" @click="handleAction('toggle-bookmark', $event)">
							<Bookmark class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Toggle bookmark</TooltipContent>
				</Tooltip>

				<div class="mx-1 h-6 w-px bg-white/10" />

				<!-- Razor mode -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button
							variant="ghost"
							size="icon"
							:disabled="!hasTimelineContent"
							class="relative overflow-visible"
							:class="{ 'text-cyan-400': razorMode }"
							@click="emit('toggleRazorMode')"
						>
							<span v-if="razorMode" class="pointer-events-none absolute top-0 left-1/2 block h-0 w-0 -translate-x-1/2 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-cyan-400" />
							<MousePointerClick class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Razor tool (click to cut)</TooltipContent>
				</Tooltip>

				<!-- Auto-follow -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button
							variant="ghost"
							size="icon"
							:disabled="!hasTimelineContent"
							class="relative overflow-visible"
							:class="{ 'text-cyan-400': autoFollow }"
							@click="emit('toggleAutoFollow')"
						>
							<span v-if="autoFollow" class="pointer-events-none absolute top-0 left-1/2 block h-0 w-0 -translate-x-1/2 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-cyan-400" />
							<Navigation2 class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Auto-follow playhead</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>

		<!-- Right section: timeline tools + zoom controls -->
		<div class="flex items-center gap-1">
			<TooltipProvider :delay-duration="500">
				<!-- Main Track Magnet -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button
							variant="ghost"
							size="icon"
							:disabled="!hasTimelineContent"
							class="relative overflow-visible"
							:class="{ 'text-cyan-400': mainTrackMagnet }"
							@click="emit('toggleMainTrackMagnet')"
						>
							<span v-if="mainTrackMagnet" class="pointer-events-none absolute top-0 left-1/2 block h-0 w-0 -translate-x-1/2 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-cyan-400" />
							<Magnet class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Main track magnet</TooltipContent>
				</Tooltip>

				<!-- Auto Snapping -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button
							variant="ghost"
							size="icon"
							:disabled="!hasTimelineContent"
							class="relative overflow-visible"
							:class="{ 'text-cyan-400': autoSnapping }"
							@click="emit('toggleAutoSnapping')"
						>
							<span v-if="autoSnapping" class="pointer-events-none absolute top-0 left-1/2 block h-0 w-0 -translate-x-1/2 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-cyan-400" />
							<SplitSquareHorizontal class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Auto snapping</TooltipContent>
				</Tooltip>

				<!-- Linkage -->
				<Tooltip>
					<TooltipTrigger as-child>
						<Button
							variant="ghost"
							size="icon"
							:disabled="!hasTimelineContent"
							class="relative overflow-visible"
							:class="{ 'text-cyan-400': linkage }"
							@click="emit('toggleLinkage')"
						>
							<span v-if="linkage" class="pointer-events-none absolute top-0 left-1/2 block h-0 w-0 -translate-x-1/2 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-cyan-400" />
							<Link class="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Linkage</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<div class="mx-1 h-6 w-px bg-white/10" />

			<div class="flex items-center gap-1">
				<TooltipProvider :delay-duration="500">
					<!-- Scroll to playhead -->
					<Tooltip>
						<TooltipTrigger as-child>
							<Button variant="ghost" size="icon" :disabled="!hasTimelineContent" @click="emit('scrollToPlayhead')">
								<Crosshair class="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Scroll to playhead</TooltipContent>
					</Tooltip>

					<!-- Zoom to fit -->
					<Tooltip>
						<TooltipTrigger as-child>
							<Button variant="ghost" size="icon" :disabled="!hasTimelineContent" @click="emit('zoomToFit')">
								<Maximize2 class="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Zoom to fit</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<Button variant="ghost" size="icon" :disabled="!hasTimelineContent" @click="handleZoom('out')">
					<ZoomOut class="size-4" />
				</Button>
				<input
					type="range"
					class="w-28 accent-primary"
					:disabled="!hasTimelineContent"
					:value="sliderValue"
					min="0"
					max="1"
					step="0.005"
					@input="handleSliderInput"
				/>
				<Button variant="ghost" size="icon" :disabled="!hasTimelineContent" @click="handleZoom('in')">
					<ZoomIn class="size-4" />
				</Button>
			</div>
		</div>
	</div>
</template>
