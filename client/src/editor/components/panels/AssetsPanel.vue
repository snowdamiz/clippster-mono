<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useFileUpload } from "../../composables/useFileUpload";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import {
	buildVideoElement,
	buildImageElement,
	buildUploadAudioElement,
} from "../../lib/timeline/element-utils";
import { processMediaAssets } from "../../lib/media/processing";
import { setDragData } from "../../lib/drag-data";
import type { MediaAsset } from "../../types/assets";
import type { CreateTimelineElement } from "../../types/timeline";
import { Button } from "@/components/ui/button";
import { Upload, Image, Film, Music, Grid, List, Wand2, ArrowRightLeft, Palette, SlidersHorizontal, FolderOpen, Clapperboard } from "lucide-vue-next";
import TextView from "./assets/TextView.vue";
import CaptionsView from "./assets/CaptionsView.vue";
import SettingsView from "./assets/SettingsView.vue";
import StickersView from "./assets/StickersView.vue";
import SoundsView from "./assets/SoundsView.vue";
import BuiltClipsView from "./assets/BuiltClipsView.vue";
import ProjectClipsView from "./assets/ProjectClipsView.vue";
import EffectsView from "./assets/EffectsView.vue";
import FiltersView from "./assets/FiltersView.vue";
import AdjustmentsView from "./assets/AdjustmentsView.vue";
import TransitionsView from "./assets/TransitionsView.vue";
import BrandingView from "./assets/BrandingView.vue";

const props = defineProps<{
	activeTab: string;
}>();

const { editor, version } = useEditor();
const mediaSubTab = ref<"upload" | "built" | "projects">("upload");
const viewMode = ref<"grid" | "list">("grid");
const isProcessing = ref(false);
const progress = ref(0);
const sortBy = ref<"name" | "type" | "duration">("name");
const sortOrder = ref<"asc" | "desc">("asc");

const mediaFiles = computed(() => {
	void version.value;
	return editor.media.getAssets();
});

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActive();
});

const filteredMedia = computed(() => {
	const items = mediaFiles.value.filter((item) => !item.ephemeral);
	items.sort((a, b) => {
		let va: string | number;
		let vb: string | number;
		switch (sortBy.value) {
			case "name": va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
			case "type": va = a.type; vb = b.type; break;
			case "duration": va = a.duration || 0; vb = b.duration || 0; break;
			default: return 0;
		}
		if (va < vb) return sortOrder.value === "asc" ? -1 : 1;
		if (va > vb) return sortOrder.value === "asc" ? 1 : -1;
		return 0;
	});
	return items;
});

async function processFiles(files: FileList) {
	if (!files || files.length === 0) return;
	if (!activeProject.value) return;

	isProcessing.value = true;
	progress.value = 0;
	try {
		const processedAssets = await processMediaAssets({
			files,
			onProgress: (p: { progress: number }) => { progress.value = p.progress; },
		});
		for (const asset of processedAssets) {
			await editor.media.addMediaAsset({
				projectId: activeProject.value.metadata.id,
				asset,
			});
		}
	} catch (error) {
		console.error("Error processing files:", error);
	} finally {
		isProcessing.value = false;
		progress.value = 0;
	}
}

const {
	isDragOver,
	inputRef,
	openFilePicker,
	handleFileChange,
	handleDragEnter,
	handleDragOver,
	handleDragLeave,
	handleDrop,
} = useFileUpload({
	accept: "image/*,video/*,audio/*",
	multiple: true,
	onFilesSelected: (files) => processFiles(files),
});

function addToTimeline(asset: MediaAsset) {
	const duration = asset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
	const startTime = editor.playback.getCurrentTime();
	let element: CreateTimelineElement;

	switch (asset.type) {
		case "video":
			element = buildVideoElement({ mediaId: asset.id, name: asset.name, duration, startTime });
			break;
		case "image":
			element = buildImageElement({ mediaId: asset.id, name: asset.name, duration, startTime });
			break;
		case "audio":
			element = buildUploadAudioElement({ mediaId: asset.id, name: asset.name, duration, startTime });
			break;
		default:
			return;
	}

	editor.timeline.insertElement({ element, placement: { mode: "auto" } });
}

async function removeAsset(id: string) {
	if (!activeProject.value) return;
	await editor.media.removeMediaAsset({ projectId: activeProject.value.metadata.id, id });
}

function formatDuration(d: number) {
	const min = Math.floor(d / 60);
	const sec = Math.floor(d % 60);
	return `${min}:${sec.toString().padStart(2, "0")}`;
}

function getMediaIcon(type: string) {
	switch (type) {
		case "video": return Film;
		case "audio": return Music;
		case "image": return Image;
		default: return Image;
	}
}

</script>

<template>
	<div class="flex h-full flex-col bg-transparent text-zinc-200">
		<!-- Media view -->
		<div v-if="activeTab === 'media'" class="flex flex-1 flex-col overflow-hidden">
			<input
			:ref="(el) => { inputRef = el as HTMLInputElement | null }"
			type="file"
			class="hidden"
			accept="image/*,video/*,audio/*"
			multiple
			@change="handleFileChange"
		/>

			<!-- Sub-tab navigation -->
			<div class="flex items-center border-b border-white/10">
				<button
					v-for="tab in ([
						{ key: 'upload', label: 'Upload', icon: Upload },
						{ key: 'built', label: 'Built Clips', icon: Clapperboard },
						{ key: 'projects', label: 'Projects', icon: FolderOpen },
					] as const)"
					:key="tab.key"
					type="button"
					:class="[
						'flex items-center gap-1 px-2 py-2 text-[11px] font-medium whitespace-nowrap transition-colors border-b-2',
						mediaSubTab === tab.key
							? 'border-blue-500 text-blue-400'
							: 'border-transparent text-zinc-500 hover:text-zinc-300',
					]"
					@click="mediaSubTab = tab.key"
				>
					<component :is="tab.icon" class="size-3.5" />
					{{ tab.label }}
				</button>
			</div>

			<!-- Upload sub-tab -->
			<template v-if="mediaSubTab === 'upload'">
				<!-- Header -->
				<div class="flex items-center justify-between border-b border-white/10 px-4 py-2">
					<span class="text-zinc-400 text-sm">Assets</span>
					<div class="flex items-center gap-1">
						<Button variant="ghost" size="icon" @click="viewMode = viewMode === 'grid' ? 'list' : 'grid'">
							<component :is="viewMode === 'grid' ? List : Grid" class="size-4" />
						</Button>
						<Button variant="outline" size="sm" class="gap-1.5" :disabled="isProcessing" @click="openFilePicker">
							<Upload class="size-4" />
							Upload
						</Button>
					</div>
				</div>

				<!-- Content -->
				<div
					:class="['flex-1 overflow-y-auto p-3', isDragOver && 'bg-white/5']"
					@dragenter="handleDragEnter"
					@dragover="handleDragOver"
					@dragleave="handleDragLeave"
					@drop="handleDrop"
				>
					<!-- Empty / drag overlay -->
					<div
						v-if="isDragOver || filteredMedia.length === 0"
						class="flex h-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 p-8 text-center cursor-pointer"
						@click="openFilePicker"
					>
						<Upload class="text-zinc-500 size-8" />
						<p class="text-zinc-500 text-sm">
							{{ isProcessing ? `Processing... ${Math.round(progress * 100)}%` : 'Drop files here or click to upload' }}
						</p>
					</div>

					<!-- Grid view -->
					<div
						v-else-if="viewMode === 'grid'"
						class="grid gap-2"
						style="grid-template-columns: repeat(auto-fill, minmax(100px, 1fr))"
					>
						<div
							v-for="item in filteredMedia"
							:key="item.id"
							class="group relative cursor-pointer overflow-hidden rounded-lg border border-white/10"
							draggable="true"
							@dragstart="(e: DragEvent) => {
								if (e.dataTransfer) {
									setDragData({ dataTransfer: e.dataTransfer, dragData: { id: item.id, type: 'media', mediaType: item.type, name: item.name } });
								}
							}"
							@dblclick="addToTimeline(item)"
						>
							<!-- Thumbnail -->
							<div class="relative aspect-video bg-zinc-800">
								<img
									v-if="item.type === 'image' && item.url"
									:src="item.url"
									:alt="item.name"
									class="size-full object-cover"
								/>
								<img
									v-else-if="item.type === 'video' && item.thumbnailUrl"
									:src="item.thumbnailUrl"
									:alt="item.name"
									class="size-full object-cover"
								/>
								<div v-else class="flex size-full items-center justify-center">
									<component :is="getMediaIcon(item.type)" class="text-zinc-500 size-6" />
								</div>
								<div v-if="item.duration" class="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-xs text-white">
									{{ formatDuration(item.duration) }}
								</div>
							</div>
							<!-- Name -->
							<div class="truncate px-2 py-1 text-xs">{{ item.name }}</div>
							<!-- Remove button -->
							<button
								type="button"
								class="absolute top-1 right-1 hidden rounded bg-black/50 px-1 text-xs text-white group-hover:block"
								@click.stop="removeAsset(item.id)"
							>
								✕
							</button>
						</div>
					</div>

					<!-- List view -->
					<div v-else class="space-y-1">
						<div
							v-for="item in filteredMedia"
							:key="item.id"
							class="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-white/5"
							draggable="true"
							@dragstart="(e: DragEvent) => {
								if (e.dataTransfer) {
									setDragData({ dataTransfer: e.dataTransfer, dragData: { id: item.id, type: 'media', mediaType: item.type, name: item.name } });
								}
							}"
							@dblclick="addToTimeline(item)"
						>
							<div class="size-8 shrink-0 overflow-hidden rounded bg-zinc-800">
								<img
									v-if="(item.type === 'image' && item.url) || (item.type === 'video' && item.thumbnailUrl)"
									:src="item.type === 'image' ? item.url : item.thumbnailUrl"
									:alt="item.name"
									class="size-full object-cover"
								/>
								<div v-else class="flex size-full items-center justify-center">
									<component :is="getMediaIcon(item.type)" class="text-zinc-500 size-4" />
								</div>
							</div>
							<div class="min-w-0 flex-1">
								<div class="truncate text-xs text-zinc-200">{{ item.name }}</div>
								<div class="text-zinc-500 text-[10px]">
									{{ item.type }}{{ item.duration ? ` · ${formatDuration(item.duration)}` : '' }}
								</div>
							</div>
							<button
								type="button"
								class="hidden text-xs text-destructive group-hover:block"
								@click.stop="removeAsset(item.id)"
							>
								✕
							</button>
						</div>
					</div>
				</div>
			</template>

			<!-- Built Clips sub-tab -->
			<BuiltClipsView v-else-if="mediaSubTab === 'built'" />

			<!-- Projects sub-tab -->
			<ProjectClipsView v-else-if="mediaSubTab === 'projects'" />
		</div>

		<!-- Text view -->
		<TextView v-else-if="activeTab === 'text'" />

		<!-- Stickers view -->
		<StickersView v-else-if="activeTab === 'stickers'" />

		<!-- Effects view -->
		<EffectsView v-else-if="activeTab === 'effects'" />

		<!-- Transitions view -->
		<TransitionsView v-else-if="activeTab === 'transitions'" />

		<!-- Sounds view -->
		<SoundsView v-else-if="activeTab === 'sounds'" />

		<!-- Captions view -->
		<CaptionsView v-else-if="activeTab === 'captions'" />

		<!-- Filters view -->
		<FiltersView v-else-if="activeTab === 'filters'" />

		<!-- Adjustment view -->
		<AdjustmentsView v-else-if="activeTab === 'adjustment'" />

		<!-- Branding view -->
		<BrandingView v-else-if="activeTab === 'branding'" />

		<!-- Settings view -->
		<SettingsView v-else-if="activeTab === 'settings'" />
	</div>
</template>
