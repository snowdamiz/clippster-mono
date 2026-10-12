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
import { usePointerDrag } from "../../composables/usePointerDrag";
import type { MediaAsset } from "../../types/assets";
import type { CreateTimelineElement } from "../../types/timeline";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { Upload, Image, Film, Music, Grid, List, FolderOpen, Clapperboard, Loader2, Plus, X } from "lucide-vue-next";
import PanelHeader from "../chrome/PanelHeader.vue";
import ToolbarButton from "../chrome/ToolbarButton.vue";
import AssetGrid from "./shared/AssetGrid.vue";
import AssetTile from "./shared/AssetTile.vue";
import AssetListRow from "./shared/AssetListRow.vue";
import { useImageMode } from "../../composables/useImageMode";
import TextView from "./assets/TextView.vue";
import CaptionsView from "./assets/CaptionsView.vue";
import SettingsView from "./assets/SettingsView.vue";
import StickersView from "./assets/StickersView.vue";
import SoundsView from "./assets/SoundsView.vue";
import BuiltClipsView from "./assets/BuiltClipsView.vue";
import ProjectClipsView from "./assets/ProjectClipsView.vue";
import EffectsView from "./assets/EffectsView.vue";
import FiltersView from "./assets/FiltersView.vue";
import TransitionsView from "./assets/TransitionsView.vue";
import BrandingView from "./assets/BrandingView.vue";
import UploadMediaView from "./assets/UploadMediaView.vue";
import TranscriptView from "./assets/TranscriptView.vue";
import ImageSourcesView from "./assets/ImageSourcesView.vue";
import TemplatesView from "./assets/TemplatesView.vue";
import BrandKitView from "./assets/BrandKitView.vue";
import AIToolsView from "./assets/AIToolsView.vue";
import AIBrollView from "./assets/AIBrollView.vue";
import AudioLibraryView from "./assets/AudioLibraryView.vue";
import ImageLibraryView from "./assets/ImageLibraryView.vue";

const props = defineProps<{
	activeTab: string | null;
}>();

const { editor, version } = useEditor({
	subscribe: {
		project: true,
		media: true,
		playback: false,
		timeline: false,
		scenes: false,
		selection: false,
	},
});
const { isImageMode } = useImageMode();
const { startDrag } = usePointerDrag();
const showMediaDialog = ref(false);
type ImportTab = "upload" | "built" | "projects" | "audio" | "images";
const dialogTab = ref<ImportTab>("upload");
const importTabs: SegmentedOption<ImportTab>[] = [
	{ value: "upload", label: "Upload", icon: Upload },
	{ value: "built", label: "Built clips", icon: Clapperboard },
	{ value: "projects", label: "Projects", icon: FolderOpen },
	{ value: "audio", label: "Audio", icon: Music },
	{ value: "images", label: "Images", icon: Image },
];
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
    return editor.project.getActiveOrNull();
  });

  const filteredMedia = computed(() => {
    const items = mediaFiles.value.filter((item) => !item.ephemeral);
    items.sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      switch (sortBy.value) {
        case 'name':
          va = a.name.toLowerCase();
          vb = b.name.toLowerCase();
          break;
        case 'type':
          va = a.type;
          vb = b.type;
          break;
        case 'duration':
          va = a.duration || 0;
          vb = b.duration || 0;
          break;
        default:
          return 0;
      }
      if (va < vb) return sortOrder.value === 'asc' ? -1 : 1;
      if (va > vb) return sortOrder.value === 'asc' ? 1 : -1;
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
        onProgress: (p: { progress: number }) => {
          progress.value = p.progress;
        },
      });
      for (const asset of processedAssets) {
        const mediaId = await editor.media.addMediaAsset({
          projectId: activeProject.value.metadata.id,
          asset,
        });
        if (isImageMode.value && asset.type === 'image') {
          const element = buildImageElement({
            mediaId,
            name: asset.name,
            duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
            startTime: editor.playback.getCurrentTime(),
          });
          editor.timeline.insertElement({ element, placement: { mode: 'auto' } });
        }
      }
    } catch (error) {
      console.error('Error processing files:', error);
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
    accept: 'image/*,video/*,audio/*',
    multiple: true,
    onFilesSelected: (files) => processFiles(files),
  });

  function isItemProcessing(id: string): boolean {
    void version.value;
    return editor.media.isAssetProcessing(id);
  }

  async function addToTimeline(asset: MediaAsset) {
    if (isItemProcessing(asset.id)) return;
    const hydrated = await editor.media.ensureAssetHydrated(asset.id);
    if (!hydrated) return;
    asset = hydrated;
    const duration = asset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
    const startTime = editor.playback.getCurrentTime();
    let element: CreateTimelineElement;

    switch (asset.type) {
      case 'video':
        element = buildVideoElement({ mediaId: asset.id, name: asset.name, duration, startTime });
        break;
      case 'image':
        element = buildImageElement({ mediaId: asset.id, name: asset.name, duration, startTime });
        break;
      case 'audio':
        element = buildUploadAudioElement({ mediaId: asset.id, name: asset.name, duration, startTime });
        break;
      default:
        return;
    }

    editor.timeline.insertElement({ element, placement: { mode: 'auto' } });
  }

  async function removeAsset(id: string) {
    if (!activeProject.value) return;
    await editor.media.removeMediaAsset({ projectId: activeProject.value.metadata.id, id });
  }

  function formatDuration(d: number) {
    const min = Math.floor(d / 60);
    const sec = Math.floor(d % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  function getMediaIcon(type: string) {
    switch (type) {
      case 'video':
        return Film;
      case 'audio':
        return Music;
      case 'image':
        return Image;
      default:
        return Image;
    }
  }
</script>

<template>
	<!-- Keyed by tab so each panel switch eases in instead of popping -->
	<div :key="activeTab ?? 'none'" class="flex h-full animate-enter flex-col bg-transparent text-fg">
		<!-- Image mode: show ImageSourcesView for media tab -->
		<ImageSourcesView v-if="activeTab === 'media' && isImageMode" />

		<!-- Video mode: standard media view -->
		<div v-else-if="activeTab === 'media'" class="flex flex-1 flex-col overflow-hidden">
			<input
				:ref="
					(el) => {
						inputRef = el as HTMLInputElement | null;
					}
				"
				type="file"
				class="hidden"
				accept="image/*,video/*,audio/*"
				multiple
				@change="handleFileChange"
			/>

			<PanelHeader title="Media">
				<ToolbarButton label="Import media" @click="showMediaDialog = true">
					<Plus />
				</ToolbarButton>
				<ToolbarButton
					:label="viewMode === 'grid' ? 'Show media as a list' : 'Show media as a grid'"
					:aria-pressed="viewMode === 'list'"
					@click="viewMode = viewMode === 'grid' ? 'list' : 'grid'"
				>
					<component :is="viewMode === 'grid' ? List : Grid" />
				</ToolbarButton>
			</PanelHeader>

			<!-- Content -->
			<div
				class="flex flex-1 flex-col overflow-y-auto p-3"
				@dragenter="handleDragEnter"
				@dragover="handleDragOver"
				@dragleave="handleDragLeave"
				@drop="handleDrop"
			>
				<!-- Empty / drag overlay -->
				<div
					v-if="isDragOver || filteredMedia.length === 0"
					:class="[
						'flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed transition-colors',
						isDragOver ? 'border-brand-line bg-brand-soft' : 'border-line hover:border-line-strong hover:bg-surface-hover',
					]"
					role="button"
					tabindex="0"
					aria-label="Upload media files"
					@click="openFilePicker"
					@keydown.enter="openFilePicker"
					@keydown.space.prevent="openFilePicker"
				>
					<EmptyState
						size="sm"
						:icon="isProcessing ? Loader2 : Upload"
						:tone="isDragOver ? 'brand' : 'neutral'"
						:title="isProcessing ? `Processing… ${Math.round(progress * 100)}%` : isDragOver ? 'Drop to import' : 'Drop files here'"
						:description="isProcessing ? undefined : 'or click to upload video, image and audio files'"
						:class="isProcessing && '[&_svg]:animate-spin'"
					/>
				</div>

				<template v-else>
					<p class="mb-2 text-2xs text-fg-subtle">Drag to the timeline · Double-click to add at the playhead</p>

					<!-- Grid view -->
					<AssetGrid v-if="viewMode === 'grid'" :min="88">
						<AssetTile
							v-for="item in filteredMedia"
							:key="item.id"
							as="div"
							aspect="16/9"
							:label="item.name"
							:loading="isItemProcessing(item.id)"
							:class="isItemProcessing(item.id) ? 'cursor-wait opacity-60' : 'cursor-pointer'"
							:title="
								isItemProcessing(item.id)
									? `${item.name} is processing`
									: `Drag ${item.name} to the timeline or double-click to add`
							"
							role="button"
							:tabindex="isItemProcessing(item.id) ? -1 : 0"
							:aria-label="`${item.name}. Drag to the timeline or press Enter to add at the playhead.`"
							@pointerdown="
								(e: PointerEvent) => {
									if (isItemProcessing(item.id)) return;
									startDrag(e, { id: item.id, type: 'media', mediaType: item.type, name: item.name });
								}
							"
							@dblclick="addToTimeline(item)"
							@keydown.enter="addToTimeline(item)"
							@dragstart.prevent
						>
							<img
								v-if="item.type === 'image' && item.url"
								:src="item.url"
								:alt="item.name"
								class="size-full object-cover"
								draggable="false"
							/>
							<img
								v-else-if="item.type === 'video' && item.thumbnailUrl"
								:src="item.thumbnailUrl"
								:alt="item.name"
								class="size-full object-cover"
								draggable="false"
							/>
							<div v-else class="flex size-full items-center justify-center">
								<component :is="getMediaIcon(item.type)" class="size-6 text-fg-subtle" />
							</div>
							<template #overlay>
								<span class="absolute left-1 top-1 grid size-4 place-items-center rounded bg-black/60 text-white/85">
									<component :is="getMediaIcon(item.type)" class="size-2.5" />
								</span>
								<span
									v-if="item.duration"
									class="tabular absolute bottom-1 right-1 rounded bg-black/70 px-1 text-2xs leading-4 text-white"
								>
									{{ formatDuration(item.duration) }}
								</span>
							</template>
							<template #actions>
								<button
									type="button"
									class="grid size-5 place-items-center rounded bg-black/60 text-white/85 transition-colors hover:bg-danger-solid hover:text-white"
									:title="`Remove ${item.name}`"
									:aria-label="`Remove ${item.name} from media`"
									@pointerdown.stop
									@click.stop="removeAsset(item.id)"
								>
									<X class="size-3" />
								</button>
							</template>
						</AssetTile>
					</AssetGrid>

					<!-- List view -->
					<div v-else class="-mx-1 space-y-px">
						<AssetListRow
							v-for="item in filteredMedia"
							:key="item.id"
							:title="item.name"
							:class="isItemProcessing(item.id) ? 'cursor-wait opacity-60' : 'cursor-pointer'"
							role="button"
							:tabindex="isItemProcessing(item.id) ? -1 : 0"
							:aria-label="`${item.name}. Drag to the timeline or press Enter to add at the playhead.`"
							@pointerdown="
								(e: PointerEvent) => {
									if (isItemProcessing(item.id)) return;
									startDrag(e, { id: item.id, type: 'media', mediaType: item.type, name: item.name });
								}
							"
							@dblclick="addToTimeline(item)"
							@keydown.enter="addToTimeline(item)"
							@dragstart.prevent
						>
							<template #leading>
								<div class="relative size-8 overflow-hidden rounded-md bg-surface-sunken">
									<img
										v-if="(item.type === 'image' && item.url) || (item.type === 'video' && item.thumbnailUrl)"
										:src="item.type === 'image' ? item.url : item.thumbnailUrl"
										:alt="item.name"
										class="size-full object-cover"
										draggable="false"
									/>
									<div v-else class="flex size-full items-center justify-center">
										<component :is="getMediaIcon(item.type)" class="size-4 text-fg-subtle" />
									</div>
									<div v-if="isItemProcessing(item.id)" class="absolute inset-0 grid place-items-center bg-[var(--overlay)]">
										<Loader2 class="size-3.5 animate-spin text-fg" />
									</div>
								</div>
							</template>
							<template #meta>
								<span class="capitalize">{{ item.type }}</span>
								<span v-if="item.duration" class="tabular">· {{ formatDuration(item.duration) }}</span>
							</template>
							<template #trailing>
								<Button
									variant="ghost"
									size="icon-xs"
									class="hover:bg-danger-soft hover:text-danger"
									:title="`Remove ${item.name}`"
									:aria-label="`Remove ${item.name} from media`"
									@pointerdown.stop
									@click.stop="removeAsset(item.id)"
								>
									<X />
								</Button>
							</template>
						</AssetListRow>
					</div>
				</template>
			</div>

			<!-- Import media dialog -->
			<Modal
				v-model:open="showMediaDialog"
				title="Import media"
				description="Add clips, project videos, audio and images to this edit."
				:icon="Upload"
				size="xl"
				flush
				class="h-[min(640px,calc(100vh-var(--titlebar-height)-2rem))]"
				body-class="flex flex-col overflow-hidden"
			>
				<div class="shrink-0 px-5 pb-3 pt-2">
					<SegmentedControl v-model="dialogTab" :options="importTabs" size="sm" />
				</div>
				<div class="min-h-0 flex-1 overflow-hidden border-t border-line-subtle">
					<UploadMediaView v-if="dialogTab === 'upload'" />
					<BuiltClipsView v-else-if="dialogTab === 'built'" />
					<ProjectClipsView v-else-if="dialogTab === 'projects'" />
					<AudioLibraryView v-else-if="dialogTab === 'audio'" />
					<ImageLibraryView v-else-if="dialogTab === 'images'" />
				</div>
			</Modal>
		</div>

		<!-- Image-mode-only views -->
		<TemplatesView v-else-if="activeTab === 'templates'" />
		<BrandKitView v-else-if="activeTab === 'brandkit'" />
		<AIToolsView v-else-if="activeTab === 'aitools'" />

		<TextView v-else-if="activeTab === 'text'" />
		<StickersView v-else-if="activeTab === 'stickers'" />
		<EffectsView v-else-if="activeTab === 'effects'" />
		<TransitionsView v-else-if="activeTab === 'transitions'" />
		<SoundsView v-else-if="activeTab === 'sounds'" />
		<CaptionsView v-else-if="activeTab === 'captions'" />
		<FiltersView v-else-if="activeTab === 'filters'" />
		<TranscriptView v-else-if="activeTab === 'transcript'" />
		<AIBrollView v-else-if="activeTab === 'broll'" />
		<BrandingView v-else-if="activeTab === 'branding'" />
		<SettingsView v-else-if="activeTab === 'settings'" />
	</div>
</template>
