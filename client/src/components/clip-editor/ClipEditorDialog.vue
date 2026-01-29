<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed top-8 left-0 right-0 bottom-0 bg-black/90 backdrop-blur-sm z-[10000] flex items-stretch justify-stretch" @click.self="handleClose">
        <Transition name="editor-modal" appear>
          <div v-if="modelValue" class="w-full h-full bg-[var(--editor-bg)] flex flex-col overflow-hidden pt-0 box-border" role="dialog" aria-modal="true">
            <!-- Header -->
            <ClipEditorHeader
              :title="editorTitle"
              @export="handleExport"
              @close="handleClose"
              @titleUpdate="handleTitleUpdate"
              @showShortcuts="showShortcutsModal = true"
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
                ref="previewRef"
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
                :temp-fade-values="tempFadeValues"
                @update="handleInspectorUpdate"
                @realtimeUpdate="handleRealtimeUpdate"
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
                :key="`timeline-${editId}-${editorEdit?.audioTracks?.length ?? 0}`"
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
                @updateFade="handleFadeUpdate"
                @tempFadeValuesUpdate="handleTempFadeValuesUpdate"
                @reload="handleTimelineReload"
              />
            </div>
          </div>
        </Transition>

        <!-- Keyboard Shortcuts Modal -->
        <KeyboardShortcutsModal v-model="showShortcutsModal" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, provide } from 'vue';
import { commandHistory } from '@/services/commands/CommandHistory';
import type { IntroOutroRef } from '@/types';
import { useRouter } from 'vue-router';
import {
  useEditorSelection,
  useEditorSplit,
  useEditorDelete,
  useEditorExport,
  useEditorKeyboardShortcuts,
  useVideoUrlBuilder,
  useAudioDetach,
  useTimelineReload,
  useTimelineZoomControl,
  useWatermarkSettingsTransform,
  useEditorDataLoader,
  useEditorAutoSave,
  useTitleManagement,
  useDurationCalculator,
} from '@/composables/clip-editor';
import { usePlaybackEngine } from '@/composables/usePlaybackEngine';

import ClipEditorHeader from './ClipEditorHeader.vue';
import ClipEditorSidebar from './ClipEditorSidebar.vue';
import ClipEditorPreview from './ClipEditorPreview.vue';
import ClipEditorInspector from './ClipEditorInspector.vue';
import ClipEditorTimeline from './ClipEditorTimeline.vue';
import ClipEditorToolbar from './ClipEditorToolbar.vue';
import KeyboardShortcutsModal from './KeyboardShortcutsModal.vue';

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

// ===== Core State (from composable) =====
const {
  editId,
  editorEdit,
  projectId,
  editorTitle,
  loadEditorData,
} = useEditorDataLoader({
  fallbackTitle: props.clipTitle,
  secondaryFallbackTitle: props.editorProjectName,
});

const activePanel = ref<string>('media');
const showShortcutsModal = ref(false);

// ===== Preview Component Ref =====
const previewRef = ref<InstanceType<typeof ClipEditorPreview> | null>(null);

// Provide audio mixer to inspector (from preview component)
provide('audioMixer', computed(() => previewRef.value?.audioMixer));

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

// ===== Timeline Zoom Control (from composable) =====
const { zoomLevel, zoomIn: handleZoomIn, zoomOut: handleZoomOut } = useTimelineZoomControl();

// ===== Creator Profile Props =====
// Watermark settings transformation (from composable)
const { watermarkSettings } = useWatermarkSettingsTransform({
  watermarkId: computed(() => props.creatorWatermarkId),
  watermarkSettingsJson: computed(() => props.creatorWatermarkSettings),
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
    await loadEditorData(projectId.value);
    await reloadTimeline();
  },
});

// ===== Delete Operations (from composable) =====
const { deleteSelectedItem, canDelete } = useEditorDelete({
  selectedItem,
  selectedItemType,
  clearSelection: () => deselectItem(),
  onComplete: async () => {
    await loadEditorData(projectId.value);
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
    await loadEditorData(projectId.value);
  },
});

// ===== Timeline Reload Operations (from composable) =====
const { reloadTimeline } = useTimelineReload({
  projectId,
  editorEdit,
  playbackEngine,
  calculateMaxDuration,
});

// ===== Auto-save (from composable) =====
const { save: debouncedSave, stop: stopAutoSave } = useEditorAutoSave({
  editId,
  editorEdit,
  debounceMs: 500,
});

// ===== Title Management (from composable) =====
const { updateTitle } = useTitleManagement({
  projectId,
  editorTitle,
});

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
  await loadEditorData(projectId.value);
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

// Timeline reload handler (for audio segment dragging)
async function handleTimelineReload() {
  await loadEditorData(projectId.value);
  await reloadTimeline();
}
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

// ===== Selection =====
function handleSelectItem(item: any, type: string) {
  selectItem(item, type as any);
}

function handleUpdateItem(item: any) {
  console.log('[ClipEditorDialog] Update item:', item);
  // TODO: Implement update command
}

// ===== Fade Updates =====
const tempFadeValues = ref<Record<string, { fadeIn: number; fadeOut: number }>>({});

function handleTempFadeValuesUpdate(values: Record<string, { fadeIn: number; fadeOut: number }>) {
  tempFadeValues.value = values;
}

async function handleFadeUpdate(payload: { itemId: string; itemType: 'audio' | 'video'; fadeIn: number; fadeOut: number }) {
  console.log('[ClipEditorDialog] Fade update received:', payload);
  
  try {
    if (payload.itemType === 'audio') {
      // Update audio track fade
      console.log('[ClipEditorDialog] Updating audio track in database...');
      const { updateVideoEditorAudioTrack } = await import('@/services/database/video-editor-edits');
      await updateVideoEditorAudioTrack(payload.itemId, {
        fade_in: payload.fadeIn,
        fade_out: payload.fadeOut,
      });
      console.log('[ClipEditorDialog] Database updated successfully');
      
      // Reload editor data to reflect changes
      console.log('[ClipEditorDialog] Reloading editor data...');
      await loadEditorData(projectId.value);
      console.log('[ClipEditorDialog] Editor data reloaded - fade should now be applied to playback');
    }
  } catch (error) {
    console.error('[ClipEditorDialog] Failed to update fade:', error);
  }
}

// ===== Inspector Updates =====
let inspectorUpdateTimer: ReturnType<typeof setTimeout> | null = null;
async function handleInspectorUpdate(updates: any) {
  console.log('[ClipEditorDialog] Inspector update:', updates);
  
  // Debounce editor data reload to avoid excessive database queries
  // The inspector already has local state for immediate UI feedback
  if (inspectorUpdateTimer) clearTimeout(inspectorUpdateTimer);
  inspectorUpdateTimer = setTimeout(async () => {
    await loadEditorData(projectId.value);
  }, 500);
}

// Handle real-time updates (for audio playback during inspector changes)
function handleRealtimeUpdate(data: { trackId: string; property: string; value: any }) {
  console.log('[ClipEditorDialog] Real-time update:', data);
  
  // For now, we'll emit this to the preview component
  // The preview will need to handle this via the audio mixer
  // This is a temporary solution until we implement a better state management
  
  // TODO: Implement proper real-time audio mixer updates
  // For now, just log it - the debounced database update will handle it
}

async function handleItemDeleted() {
  // Clear selection using composable
  deselectItem();

  // Reload editor data
  await loadEditorData(projectId.value);
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
  await updateTitle(newTitle);
}

// ===== Media Management =====
async function handleMediaAdded(mediaId: string) {
  console.log('[ClipEditorDialog] Media added to timeline:', mediaId);
  // Reload the editor data to show the new audio track
  await loadEditorData(projectId.value);

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
watch(() => [props.modelValue, props.editorProjectId], async ([isOpen, editorProjectId]) => {
  if (isOpen && editorProjectId) {
    console.log('[ClipEditorDialog] Dialog opened with project:', editorProjectId);
    await loadEditorData(editorProjectId as string);

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
  // Stop auto-save watcher
  stopAutoSave();

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
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Improved modal animation with scale + fade */
.editor-modal-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.editor-modal-leave-active {
  transition: all 0.2s ease-in;
}

.editor-modal-enter-from {
  opacity: 0;
  transform: scale(0.98) translateY(8px);
}

.editor-modal-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>

