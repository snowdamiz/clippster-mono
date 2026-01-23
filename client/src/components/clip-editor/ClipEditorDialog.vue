<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed top-8 left-0 right-0 bottom-0 bg-black/[0.98] backdrop-blur-2xl z-[10000] flex items-stretch justify-stretch" @click.self="handleClose">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="w-full h-full bg-[var(--editor-bg)] flex flex-col overflow-hidden pt-0 box-border" role="dialog" aria-modal="true">
            <!-- Header -->
            <ClipEditorHeader
              :title="editorTitle"
              @export="handleExport"
              @close="handleClose"
              @titleUpdate="handleTitleUpdate"
            />

            <!-- Main Content Area -->
            <div class="flex flex-1 overflow-hidden min-h-0">
            <!-- Left Sidebar: Tool Panels -->
            <ClipEditorSidebar
              v-model:active-panel="activePanel"
              :edit-id="editId"
              :project-id="projectId"
              :current-time="currentTime"
              :creator-watermark-id="props.creatorWatermarkId"
              :creator-watermark-settings="watermarkSettings"
              :creator-default-intro="introRef"
              :creator-default-outro="outroRef"
              :has-inspector="!!selectedItem"
              @panelChange="onPanelChange"
              @mediaAdded="handleMediaAdded"
              @mediaUpdated="handleMediaUpdated"
              @detachAudio="handleDetachAudio"
              @tracksUpdated="handleTracksUpdated"
              @textAdded="handleTextAdded"
              @textSelected="handleTextSelected"
              @textsUpdated="handleTracksUpdated"
              @stickerAdded="handleStickerAdded"
              @stickerSelected="handleStickerSelected"
              @stickersUpdated="handleTracksUpdated"
              @watermarkUpdated="handleWatermarkUpdated"
              @introToggled="handleIntroToggled"
              @outroToggled="handleOutroToggled"
            />

            <!-- Center: Video Preview -->
            <div class="flex-1 flex flex-col min-w-0 bg-[linear-gradient(135deg,#0a0a0b_0%,#0d0d0e_100%)]">
              <ClipEditorPreview
                :video-src="activeVideoUrl"
                :current-time="currentTime"
                :is-playing="isPlaying"
                :aspect-ratio="selectedAspectRatio"
                :editor-edit="editorEdit"
                :watermark-settings="watermarkSettings"
                :duration="duration"
                :video-content-duration="videoContentDuration"
                :video-sources="videoSources"
                @play="handlePlay"
                @pause="handlePause"
                @seek="handleSeek"
                @timeUpdate="handleTimeUpdate"
              />
              </div>

            <!-- Right Inspector: Context-Sensitive Properties -->
              <ClipEditorInspector
                :selected-item="selectedItem"
                :selected-item-type="selectedItemType"
                :edit-id="editId"
                @update="handleInspectorUpdate"
                @itemDeleted="handleItemDeleted"
                @close="handleInspectorClose"
              />
            </div>

            <!-- Bottom: Timeline -->
            <div class="shrink-0 h-[280px] border-t border-[var(--editor-border)] bg-[var(--editor-surface)] flex flex-col">
              <ClipEditorToolbar
                :zoom-level="zoomLevel"
                :current-time="currentTime"
                :duration="duration"
                :can-undo="canUndo"
                :can-redo="canRedo"
                :undo-description="undoDescription"
                :redo-description="redoDescription"
                @split="handleSplit"
                @delete="handleDelete"
                @detachAudio="handleDetachAudio"
                @zoomIn="handleZoomIn"
                @zoomOut="handleZoomOut"
                @undo="handleUndo"
                @redo="handleRedo"
              />
              
              <ClipEditorTimeline
                :editor-edit="editorEdit"
                :current-time="currentTime"
                :duration="duration"
                :zoom-level="zoomLevel"
                :selected-item="selectedItem"
                :intro-ref="introRef"
                :outro-ref="outroRef"
                :video-source-path="videoSourcePath"
                :video-sources="videoSources"
                @seek="handleSeek"
                @selectItem="handleSelectItem"
                @updateItem="handleUpdateItem"
                @itemDeselected="handleInspectorClose"
              />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { commandHistory } from '@/services/commands/CommandHistory';
import {
  getFullVideoEditorEdit,
  getOrCreateVideoEditorEdit,
  updateVideoEditorEdit,
  type FullVideoEditorEdit,
} from '@/services/database/video-editor-edits';
import type { IntroOutroRef } from '@/types';
import { usePlaybackEngine } from '@/composables/usePlaybackEngine';
import { getProject, updateProject } from '@/services/database/projects';
import {
  useEditorSelection,
  useDurationCalculator,
  useEditorSplit,
  useEditorDelete,
  useEditorExport,
  useEditorKeyboardShortcuts,
  useVideoUrlBuilder,
  useAudioDetach,
  useTimelineReload,
} from '@/composables/clip-editor';

import ClipEditorHeader from './ClipEditorHeader.vue';
import ClipEditorSidebar from './ClipEditorSidebar.vue';
import ClipEditorPreview from './ClipEditorPreview.vue';
import ClipEditorInspector from './ClipEditorInspector.vue';
import ClipEditorTimeline from './ClipEditorTimeline.vue';
import ClipEditorToolbar from './ClipEditorToolbar.vue';

// ===== Props =====
const props = defineProps<{
  modelValue: boolean;
  // Legacy clip props (for compatibility, but we'll always use editorProjectId)
  clipId?: string;
  videoSrc?: string | null;
  clipStartTime?: number;
  clipEndTime?: number;
  clipTitle?: string;
  clipSegments?: any[];
  // Video editor project props (PRIMARY)
  editorMode?: boolean;
  editorProjectId?: string | null;
  editorProjectName?: string;
  // Creator profile props
  creatorWatermarkId?: string | null;
  creatorWatermarkSettings?: string | null;
  creatorDefaultIntro?: IntroOutroRef | null;
  creatorDefaultOutro?: IntroOutroRef | null;
}>();

// ===== Emits =====
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', clipId: string): void;
  (e: 'editorSave', projectId: string): void;
}>();

// ===== Core State =====
// Always use video editor edit ID (unified)
const editId = ref<string | null>(null);
const editorEdit = ref<FullVideoEditorEdit | null>(null);
const projectId = ref<string | null>(null);
const editorTitle = ref<string>('Untitled Clip');
const activePanel = ref<string>('media');

// ===== Selection (from composable) =====
const {
  selectedItem,
  selectedItemType,
  select: selectItem,
  deselect: deselectItem,
} = useEditorSelection();

// ===== Duration Calculator (from composable) =====
const { calculateMaxDuration } = useDurationCalculator();

// ===== Playback Engine (Master Clock) =====
const playbackEngine = usePlaybackEngine({
  onTimeUpdate: () => {
    // Time updates are handled via the reactive ref
  },
  onEnded: () => {
    console.log('[ClipEditorDialog] Playback ended');
  },
});

// Use playback engine state directly
const currentTime = playbackEngine.currentTime;
const isPlaying = playbackEngine.isPlaying;
const duration = playbackEngine.duration;

// ===== Video URL Builder (from composable) =====
const {
  initServer: initVideoServer,
  activeVideoUrl,
  videoSourcePath,
  videoSources,
  videoContentDuration,
} = useVideoUrlBuilder({
  getTimeline: () => playbackEngine.getTimeline(),
});

// ===== View State =====
const selectedAspectRatio = ref<string>('16:9');
const zoomLevel = ref(0); // 0 = fit entire timeline to view

// ===== Creator Profile Props =====
const watermarkSettings = computed(() => {
  if (!props.creatorWatermarkId) return null;
  
  return {
    enabled: true,
    watermarkId: props.creatorWatermarkId,
    perRatioSettings: props.creatorWatermarkSettings 
      ? JSON.parse(props.creatorWatermarkSettings) 
      : null,
  };
});

const introRef = computed(() => props.creatorDefaultIntro || null);
const outroRef = computed(() => props.creatorDefaultOutro || null);

// ===== Undo/Redo State =====
const canUndo = computed(() => commandHistory.canUndo());
const canRedo = computed(() => commandHistory.canRedo());
const undoDescription = computed(() => commandHistory.getNextUndoDescription());
const redoDescription = computed(() => commandHistory.getNextRedoDescription());

// ===== Split Operations (from composable) =====
const { splitAtTime } = useEditorSplit({
  editId,
  projectId,
  selectedItem,
  selectedItemType,
  onComplete: async () => {
    await loadEditorData();
    await reloadTimeline();
  },
});

// ===== Delete Operations (from composable) =====
const { deleteSelectedItem, canDelete } = useEditorDelete({
  selectedItem,
  selectedItemType,
  clearSelection: () => deselectItem(),
  onComplete: async () => {
    await loadEditorData();
    await reloadTimeline();
  },
});

// ===== Export Operations (from composable) =====
const { isExporting, exportProgress, exportWithDialog } = useEditorExport({
  projectId,
  editorEdit,
  duration,
  title: editorTitle,
});

// ===== Audio Detach Operations (from composable) =====
const { detachAudio, isExtracting } = useAudioDetach({
  projectId,
  editId,
  onComplete: async () => {
    await loadEditorData();
  },
});

// ===== Timeline Reload Operations (from composable) =====
const { reloadTimeline } = useTimelineReload({
  projectId,
  editorEdit,
  playbackEngine,
  calculateMaxDuration,
});

// ===== Data Loading =====
async function loadEditorData() {
  if (!props.editorProjectId) {
    console.log('[ClipEditorDialog] No project ID provided - dialog not active or project not selected');
    return;
  }

  try {
    console.log(`[ClipEditorDialog] Loading video editor project: ${props.editorProjectId}`);
    
    projectId.value = props.editorProjectId;
    
    // Load project to get the name/title (always use database as source of truth)
    const project = await getProject(props.editorProjectId);
    if (project && project.name) {
      editorTitle.value = project.name;
    } else if (props.clipTitle) {
      editorTitle.value = props.clipTitle;
    } else if (props.editorProjectName) {
      editorTitle.value = props.editorProjectName;
    } else {
      editorTitle.value = 'Untitled Clip';
    }
    
    // Get or create video editor edit
    const editRecord = await getOrCreateVideoEditorEdit(props.editorProjectId);
    editId.value = editRecord.id;

    // Load full edit with all related data
    const fullEdit = await getFullVideoEditorEdit(props.editorProjectId);
    if (fullEdit) {
      editorEdit.value = fullEdit;
      console.log('[ClipEditorDialog] Editor data loaded:', {
        audioTracks: fullEdit.audioTracks.length,
        textOverlays: fullEdit.textOverlays.length,
        stickers: fullEdit.stickers.length,
        watermarks: fullEdit.watermarks.length,
        effects: fullEdit.effects.length,
      });
    }
  } catch (error) {
    console.error('[ClipEditorDialog] Failed to load editor data:', error);
  }
}

// ===== Auto-save =====
const debouncedSave = useDebounceFn(async () => {
  if (!editId.value || !editorEdit.value) return;

  try {
    const editData = JSON.parse(editorEdit.value.edit.edit_data || '{}');
    await updateVideoEditorEdit(editId.value, editData);
    console.log('[ClipEditorDialog] Auto-saved editor data');
  } catch (error) {
    console.error('[ClipEditorDialog] Failed to auto-save:', error);
  }
}, 500);

// Watch for changes to trigger auto-save
watch(() => editorEdit.value, debouncedSave, { deep: true });

// ===== Playback Controls =====
function handlePlay() {
  playbackEngine.play();
}

function handlePause() {
  playbackEngine.pause();
}

function handleSeek(time: number) {
  playbackEngine.seek(time);
}

function handleTimeUpdate(time: number) {
  // Video element time updates - sync with playback engine if needed
  if (Math.abs(time - currentTime.value) > 0.5) {
    playbackEngine.seek(time);
  }
}

// ===== Timeline Controls =====
async function handleSplit() {
  // Use composable for split operations
  await splitAtTime(currentTime.value);
}

async function handleDelete() {
  // Use composable for delete operations
  await deleteSelectedItem();
}

// Handler for detaching audio (delegates to composable)
async function handleDetachAudio() {
  await detachAudio();
}

// ===== Consolidated Event Handlers =====
// Factory for handlers that just reload editor data
const createReloadHandler = (label: string) => async (id?: string) => {
  console.log(`[ClipEditorDialog] ${label}:`, id || '');
  await loadEditorData();
};

// Factory for selection handlers
const createSelectionHandler = (type: 'text' | 'sticker' | 'audio' | 'video') => (item: any) => {
  selectedItem.value = item;
  selectedItemType.value = type;
};

// Reload handlers
const handleTracksUpdated = createReloadHandler('Tracks updated');
const handleTextAdded = createReloadHandler('Text added');
const handleStickerAdded = createReloadHandler('Sticker added');
const handleWatermarkUpdated = createReloadHandler('Watermark updated');

// Selection handlers
const handleTextSelected = createSelectionHandler('text');
const handleStickerSelected = createSelectionHandler('sticker');

// Toggle handlers (just logging for now)
function handleIntroToggled(enabled: boolean) {
  console.log('[ClipEditorDialog] Intro toggled:', enabled);
}

function handleOutroToggled(enabled: boolean) {
  console.log('[ClipEditorDialog] Outro toggled:', enabled);
}

function handleZoomIn() {
  // From 0 (fit-to-width), jump to 0.5, then scale up
  if (zoomLevel.value === 0) {
    zoomLevel.value = 0.5;
  } else {
    zoomLevel.value = Math.min(zoomLevel.value * 1.5, 10);
  }
}

function handleZoomOut() {
  // Scale down, but stop at 0 (fit-to-width) instead of 0.1
  const newZoom = zoomLevel.value / 1.5;
  zoomLevel.value = newZoom < 0.3 ? 0 : newZoom;
}

// ===== Selection =====
function handleSelectItem(item: any, type: string) {
  selectItem(item, type as any);
}

function handleUpdateItem(item: any) {
  console.log('[ClipEditorDialog] Update item:', item);
  // TODO: Implement update command
}

// ===== Inspector Updates =====
async function handleInspectorUpdate(updates: any) {
  console.log('[ClipEditorDialog] Inspector update:', updates);
  // Reload editor data to reflect changes
  await loadEditorData();
}

async function handleItemDeleted() {
  // Clear selection using composable
  deselectItem();

  // Reload editor data
  await loadEditorData();
}

// ===== Panel Changes =====
function onPanelChange(panel: string) {
  console.log('[ClipEditorDialog] Panel changed to:', panel);
}

// Ensure sidebar panel is always active when no inspector
watch(selectedItem, (newItem) => {
  if (!newItem && !activePanel.value) {
    // No inspector and no panel selected - default to media
    activePanel.value = 'media';
  }
});

// Handle inspector close
function handleInspectorClose() {
  deselectItem();
}

// ===== Undo/Redo =====
async function handleUndo() {
  try {
    await commandHistory.undo();
  } catch (error) {
    console.error('[ClipEditorDialog] Undo failed:', error);
  }
}

async function handleRedo() {
  try {
    await commandHistory.redo();
  } catch (error) {
    console.error('[ClipEditorDialog] Redo failed:', error);
  }
}

// ===== Title Management =====
async function handleTitleUpdate(newTitle: string) {
  editorTitle.value = newTitle;
  
  // Update the project name in the database
  if (props.editorProjectId) {
    try {
      await updateProject(props.editorProjectId, newTitle);
      console.log('[ClipEditorDialog] Project title updated:', newTitle);
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to update project title:', error);
    }
  }
}

// ===== Media Management =====
async function handleMediaAdded(mediaId: string) {
  console.log('[ClipEditorDialog] Media added to timeline:', mediaId);
  // Reload the editor data to show the new audio track
  await loadEditorData();
  
  // Reload timeline with recalculated duration
  await reloadTimeline();
}

function handleMediaUpdated() {
  console.log('[ClipEditorDialog] Media library updated');
  // Refresh any media-related state if needed
}

// ===== Export =====
// isExporting and exportProgress come from useEditorExport composable
async function handleExport() {
  // Use composable for export operations
  await exportWithDialog();
}

// ===== Close =====
function handleClose() {
  // Clear command history
  commandHistory.clear();
  
  emit('update:modelValue', false);
  
  if (props.editorProjectId) {
    emit('editorSave', props.editorProjectId);
  }
}

// ===== Keyboard Shortcuts (from composable) =====
useEditorKeyboardShortcuts({
  handlers: {
    onUndo: handleUndo,
    onRedo: handleRedo,
    onPlayPause: () => isPlaying.value ? handlePause() : handlePlay(),
    onSave: () => debouncedSave(),
    onExport: handleExport,
    onSplit: handleSplit,
    onDelete: handleDelete,
    onClose: handleClose,
  },
});

// Watch for dialog open and project ID changes
watch(() => [props.modelValue, props.editorProjectId], async ([isOpen, projectId]) => {
  if (isOpen && projectId) {
    console.log('[ClipEditorDialog] Dialog opened with project:', projectId);
    await loadEditorData();
    
    // Load project sources and initialize timeline with calculated duration
    await reloadTimeline();
    console.log('[ClipEditorDialog] Timeline initialized');
  }
}, { immediate: true });

// ===== Lifecycle =====
onMounted(async () => {
  console.log('[ClipEditorDialog] Mounted with props:', props);

  // Initialize video server
  await initVideoServer();

  // Keyboard shortcuts are auto-registered by the composable
});

onUnmounted(() => {
  // Dispose playback engine
  playbackEngine.dispose();

  // Clear command history
  commandHistory.clear();

  // Keyboard shortcuts are auto-unregistered by the composable
});
</script>

<style scoped>
/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.dialog-enter-active,
.dialog-leave-active {
  transition: all 0.25s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>

