<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="clip-editor-overlay" @click.self="handleClose">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="clip-editor" role="dialog" aria-modal="true">
            <!-- Header -->
            <ClipEditorHeader
              :title="editorTitle"
              @export="handleExport"
              @close="handleClose"
              @titleUpdate="handleTitleUpdate"
            />

            <!-- Main Content Area -->
            <div class="clip-editor__content">
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
            <div class="clip-editor__preview-wrapper">
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
            <div class="clip-editor__timeline-wrapper">
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
import { invoke } from '@tauri-apps/api/core';
import { commandHistory } from '@/services/commands/CommandHistory';
import {
  getFullVideoEditorEdit,
  getOrCreateVideoEditorEdit,
  updateVideoEditorEdit,
  type FullVideoEditorEdit,
} from '@/services/database/video-editor-edits';
import {
  getVideoEditorProjectWithSources,
} from '@/services/database/video-editor-projects';
import type { IntroOutroRef } from '@/types';
import { usePlaybackEngine } from '@/composables/usePlaybackEngine';
import { getProject, updateProject } from '@/services/database/projects';

import { Film } from 'lucide-vue-next';
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
const selectedItem = ref<any>(null);
const selectedItemType = ref<string | null>(null);

// ===== Video Server Port =====
const videoServerPort = ref<number | null>(null);

// Get video server port
async function initVideoServer() {
  try {
    videoServerPort.value = await invoke<number>('get_video_server_port');
    console.log('[ClipEditorDialog] Video server port:', videoServerPort.value);
  } catch (error) {
    console.error('[ClipEditorDialog] Failed to get video server port:', error);
  }
}

// ===== Playback Engine (Master Clock) =====
const playbackEngine = usePlaybackEngine({
  onTimeUpdate: (time) => {
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

// Active video URL from timeline
const activeVideoUrl = computed(() => {
  const timeline = playbackEngine.getTimeline();
  
  if (!videoServerPort.value) {
    console.log('[ClipEditorDialog] No video server port yet');
    return null;
  }
  
  if (!timeline || timeline.videoSources.length === 0) {
    console.log('[ClipEditorDialog] No video sources in timeline');
    return null;
  }
  
  // Always use the first source for now (single-source clips)
  const firstSource = timeline.videoSources[0];
  if (!firstSource || !firstSource.file_path) {
    console.log('[ClipEditorDialog] First source has no file path');
    return null;
  }
  
  const encodedPath = btoa(unescape(encodeURIComponent(firstSource.file_path)));
  
  // Check if this is a .ts file (MPEG-TS stream) - needs HLS wrapper
  const isTsFile = firstSource.file_path.toLowerCase().endsWith('.ts');
  
  const url = isTsFile
    ? `http://localhost:${videoServerPort.value}/ts-hls/${encodedPath}/playlist.m3u8`
    : `http://localhost:${videoServerPort.value}/video/${encodedPath}`;
  
  console.log('[ClipEditorDialog] Active video URL:', url, isTsFile ? '(HLS)' : '(Direct)');
  return url;
});

// Video source path for waveform (local file path, not HTTP URL)
const videoSourcePath = computed(() => {
  const timeline = playbackEngine.getTimeline();
  
  if (!timeline || timeline.videoSources.length === 0) {
    return null;
  }
  
  const firstSource = timeline.videoSources[0];
  return firstSource?.file_path || null;
});

// Video sources for timeline rendering
const videoSources = computed(() => {
  const timeline = playbackEngine.getTimeline();
  return timeline?.videoSources || [];
});

// Calculate the actual video content duration (max end time of video sources)
const videoContentDuration = computed(() => {
  const timeline = playbackEngine.getTimeline();
  if (!timeline || timeline.videoSources.length === 0) {
    return 0;
  }
  
  // Get the maximum end time of all video sources
  const maxEndTime = Math.max(...timeline.videoSources.map(s => s.end_time));
  return maxEndTime;
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
  if (!projectId.value) {
    console.warn('[ClipEditorDialog] Cannot split: no project ID');
    return;
  }

  const splitTime = currentTime.value;
  console.log('[ClipEditorDialog] Split at:', splitTime, 'Selected:', selectedItemType.value);

  try {
    // If an item is selected, split that specific item
    if (selectedItem.value && selectedItemType.value) {
      await splitSelectedItem(splitTime);
    } else {
      // Otherwise, split video source at playhead (legacy behavior)
      await splitVideoSource(splitTime);
    }
    
    // Reload editor data and timeline
    await loadEditorData();
    await reloadTimeline();
  } catch (error) {
    console.error('[ClipEditorDialog] Failed to split:', error);
  }
}

async function splitSelectedItem(splitTime: number) {
  const item = selectedItem.value;
  const type = selectedItemType.value;
  
  // Check if split time is within the item's range
  if (splitTime <= item.start_time || splitTime >= item.end_time) {
    console.warn('[ClipEditorDialog] Split time is not within item range');
    return;
  }
  
  console.log(`[ClipEditorDialog] Splitting ${type} at ${splitTime}`);
  
  if (type === 'audio') {
    const { updateVideoEditorAudioTrack, createVideoEditorAudioTrack } = await import('@/services/database/video-editor-edits');
    
    // Update original track to end at split time
    await updateVideoEditorAudioTrack(item.id, { end_time: splitTime });
    
    // Create new track from split time to original end
    await createVideoEditorAudioTrack(editId.value!, {
      file_path: item.file_path,
      name: item.name,
      start_time: splitTime,
      end_time: item.end_time,
      volume: item.volume,
      pan: item.pan || 0,
      fade_in: item.fade_in || 0,
      fade_out: item.fade_out || 0,
      track_order: item.track_order,
      is_muted: item.is_muted,
      is_solo: item.is_solo || 0,
      source_id: item.source_id,
    });
  } else if (type === 'text') {
    const { updateVideoEditorTextOverlay, createVideoEditorTextOverlay } = await import('@/services/database/video-editor-edits');
    
    await updateVideoEditorTextOverlay(item.id, { end_time: splitTime });
    
    await createVideoEditorTextOverlay(editId.value!, {
      text: item.text,
      start_time: splitTime,
      end_time: item.end_time,
      position_x: item.position_x,
      position_y: item.position_y,
      style_data: item.style_data,
      animation: item.animation,
      layer: item.layer,
      per_ratio_configs_data: item.per_ratio_configs_data,
      preview_height: item.preview_height,
    });
  } else if (type === 'sticker') {
    const { updateVideoEditorSticker, createVideoEditorSticker } = await import('@/services/database/video-editor-edits');
    
    await updateVideoEditorSticker(item.id, { end_time: splitTime });
    
    await createVideoEditorSticker(editId.value!, {
      sticker_path: item.sticker_path,
      sticker_type: item.sticker_type,
      start_time: splitTime,
      end_time: item.end_time,
      position_x: item.position_x,
      position_y: item.position_y,
      scale: item.scale,
      rotation: item.rotation || 0,
      animation: item.animation,
      layer: item.layer,
      per_ratio_configs_data: item.per_ratio_configs_data,
    });
  } else if (type === 'watermark') {
    const { updateVideoEditorWatermark, createVideoEditorWatermark } = await import('@/services/database/video-editor-edits');
    
    await updateVideoEditorWatermark(item.id, { end_time: splitTime });
    
    await createVideoEditorWatermark(editId.value!, {
      watermark_id: item.watermark_id,
      watermark_path: item.watermark_path,
      preview_url: item.preview_url,
      start_time: splitTime,
      end_time: item.end_time,
      position_x: item.position_x,
      position_y: item.position_y,
      scale: item.scale,
      opacity: item.opacity || 1,
      layer: item.layer,
    });
  }
  
  console.log(`[ClipEditorDialog] ${type} split successfully`);
}

async function splitVideoSource(splitTime: number) {
  // Get project sources to find which source contains the current time
  const projectData = await getVideoEditorProjectWithSources(projectId.value!);
  if (!projectData || projectData.sources.length === 0) {
    console.warn('[ClipEditorDialog] No sources to split');
    return;
  }

  // Find the source that contains the current time
  let sourceIndexToSplit = -1;
  for (let i = 0; i < projectData.sources.length; i++) {
    const source = projectData.sources[i];
    if (splitTime >= source.start_time && splitTime < source.end_time) {
      sourceIndexToSplit = i;
      break;
    }
  }

  if (sourceIndexToSplit === -1) {
    console.warn('[ClipEditorDialog] Current time is not within any source');
    return;
  }

  // Create and execute split command
  const { SplitSourceCommand } = await import('@/services/commands/SplitSourceCommand');
  const command = new SplitSourceCommand(projectId.value!, sourceIndexToSplit, splitTime);
  
  await commandHistory.executeCommand(command);
  
  console.log('[ClipEditorDialog] Video source split successfully');
}

async function reloadTimeline() {
  const updatedProjectData = await getVideoEditorProjectWithSources(projectId.value!);
  if (updatedProjectData) {
    const audioTracksData = editorEdit.value?.audioTracks || [];
    
    // Calculate actual duration based on all tracks
    const maxDuration = calculateMaxDuration(updatedProjectData, audioTracksData);
    
    playbackEngine.setTimeline({
      duration: maxDuration,
      videoSources: updatedProjectData.sources.map(s => ({
        id: s.id,
        file_path: s.source_path,
        start_time: s.start_time,
        end_time: s.end_time,
        trim_start: s.trim_start,
        trim_end: s.trim_end,
        original_duration: s.source_duration || (s.end_time - s.start_time),
      })),
      audioTracks: audioTracksData.map(track => ({
        id: track.id,
        filePath: track.file_path,
        startTime: track.start_time,
        endTime: track.end_time,
        volume: track.volume,
        isMuted: track.is_muted === 1,
        fadeInDuration: track.fade_in,
        fadeOutDuration: track.fade_out,
      })),
    });
  }
}

function calculateMaxDuration(projectData: any, audioTracks: any[]): number {
  let maxDuration = 0;
  
  // Check video sources
  if (projectData.sources && projectData.sources.length > 0) {
    const videoEnd = Math.max(...projectData.sources.map((s: any) => s.end_time));
    maxDuration = Math.max(maxDuration, videoEnd);
  }
  
  // Check audio tracks
  if (audioTracks && audioTracks.length > 0) {
    const audioEnd = Math.max(...audioTracks.map((t: any) => t.end_time));
    maxDuration = Math.max(maxDuration, audioEnd);
  }
  
  // Check text overlays
  if (editorEdit.value?.textOverlays && editorEdit.value.textOverlays.length > 0) {
    const textEnd = Math.max(...editorEdit.value.textOverlays.map((t: any) => t.end_time));
    maxDuration = Math.max(maxDuration, textEnd);
  }
  
  // Check stickers
  if (editorEdit.value?.stickers && editorEdit.value.stickers.length > 0) {
    const stickerEnd = Math.max(...editorEdit.value.stickers.map((s: any) => s.end_time));
    maxDuration = Math.max(maxDuration, stickerEnd);
  }
  
  // Check watermarks
  if (editorEdit.value?.watermarks && editorEdit.value.watermarks.length > 0) {
    const watermarkEnd = Math.max(...editorEdit.value.watermarks.map((w: any) => w.end_time));
    maxDuration = Math.max(maxDuration, watermarkEnd);
  }
  
  return maxDuration;
}

async function handleDelete() {
  if (!selectedItem.value || !selectedItemType.value) return;
  
  console.log('[ClipEditorDialog] Delete:', selectedItemType.value, selectedItem.value);
  
  try {
    const itemId = selectedItem.value.id;
    
    // Import the appropriate delete function based on item type
    if (selectedItemType.value === 'audio') {
      const { deleteVideoEditorAudioTrack } = await import('@/services/database/video-editor-edits');
      await deleteVideoEditorAudioTrack(itemId);
      console.log('[ClipEditorDialog] Audio track deleted');
    } else if (selectedItemType.value === 'text') {
      const { deleteVideoEditorTextOverlay } = await import('@/services/database/video-editor-edits');
      await deleteVideoEditorTextOverlay(itemId);
      console.log('[ClipEditorDialog] Text overlay deleted');
    } else if (selectedItemType.value === 'sticker') {
      const { deleteVideoEditorSticker } = await import('@/services/database/video-editor-edits');
      await deleteVideoEditorSticker(itemId);
      console.log('[ClipEditorDialog] Sticker deleted');
    } else if (selectedItemType.value === 'watermark') {
      const { deleteVideoEditorWatermark } = await import('@/services/database/video-editor-edits');
      await deleteVideoEditorWatermark(itemId);
      console.log('[ClipEditorDialog] Watermark deleted');
    } else {
      console.warn('[ClipEditorDialog] Unknown item type:', selectedItemType.value);
      return;
    }
    
    // Clear selection
    selectedItem.value = null;
    selectedItemType.value = null;
    
    // Reload editor data and recalculate timeline duration
    await loadEditorData();
    await reloadTimeline();
    
    console.log('[ClipEditorDialog] Item deleted and timeline updated');
  } catch (error) {
    console.error('[ClipEditorDialog] Failed to delete item:', error);
  }
}

async function handleDetachAudio() {
  if (!projectId.value || !editId.value) return;
  
  console.log('[ClipEditorDialog] Detaching audio from video sources');
  
  try {
    // Get project sources to find the video to extract from
    const projectData = await getVideoEditorProjectWithSources(projectId.value);
    if (!projectData || projectData.sources.length === 0) {
      console.warn('[ClipEditorDialog] No video sources found');
      return;
    }

    // Extract audio from first source
    const firstSource = projectData.sources[0];
    const result = await invoke<{ file_path: string; filename: string; duration: number }>(
      'extract_audio_to_file',
      {
        videoPath: firstSource.source_path,
        sourceId: firstSource.id,
        trimStart: firstSource.trim_start,
        trimDuration: firstSource.trim_end 
          ? firstSource.trim_end - firstSource.trim_start 
          : firstSource.source_duration || (firstSource.end_time - firstSource.start_time),
      }
    );

    console.log('[ClipEditorDialog] Audio extracted:', result);

    // Create audio track in database
    const { createVideoEditorAudioTrack } = await import('@/services/database/video-editor-edits');
    await createVideoEditorAudioTrack(editId.value, {
      file_path: result.file_path,
      name: 'Extracted Audio',
      start_time: 0,
      end_time: result.duration,
      volume: 1.0,
      pan: 0,
      fade_in: 0,
      fade_out: 0,
      track_order: 0,
      is_muted: 0,
      is_solo: 0,
      source_id: firstSource.id,
    });

    // Reload editor data to show new audio track
    await loadEditorData();
    
    console.log('[ClipEditorDialog] Audio detached successfully');
  } catch (error) {
    console.error('[ClipEditorDialog] Failed to detach audio:', error);
  }
}

async function handleTracksUpdated() {
  // Reload editor data to refresh tracks
  await loadEditorData();
}

// Handle text added
function handleTextAdded(textId: string) {
  console.log('[ClipEditorDialog] Text added:', textId);
  loadEditorData();
}

// Handle text selected
function handleTextSelected(text: any) {
  selectedItem.value = text;
  selectedItemType.value = 'text';
}

// Handle sticker added
function handleStickerAdded(stickerId: string) {
  console.log('[ClipEditorDialog] Sticker added:', stickerId);
  loadEditorData();
}

// Handle sticker selected
function handleStickerSelected(sticker: any) {
  selectedItem.value = sticker;
  selectedItemType.value = 'sticker';
}

// Handle watermark updated
function handleWatermarkUpdated() {
  console.log('[ClipEditorDialog] Watermark updated');
  loadEditorData();
}

// Handle intro toggled
function handleIntroToggled(enabled: boolean) {
  console.log('[ClipEditorDialog] Intro toggled:', enabled);
  // Will be reflected in intro/outro track rendering
}

// Handle outro toggled
function handleOutroToggled(enabled: boolean) {
  console.log('[ClipEditorDialog] Outro toggled:', enabled);
  // Will be reflected in intro/outro track rendering
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
  selectedItem.value = item;
  selectedItemType.value = type;
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
  // Clear selection
  selectedItem.value = null;
  selectedItemType.value = null;
  
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
  selectedItem.value = null;
  selectedItemType.value = null;
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
      await updateProject(props.editorProjectId, { name: newTitle });
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
const isExporting = ref(false);
const exportProgress = ref(0);

async function handleExport() {
  if (!projectId.value || !editorEdit.value) {
    console.warn('[ClipEditorDialog] Cannot export: missing project or edit data');
    return;
  }

  console.log('[ClipEditorDialog] Starting export for project:', projectId.value);
  
  try {
    isExporting.value = true;
    exportProgress.value = 0;

    // Get project data with sources
    const projectData = await getVideoEditorProjectWithSources(projectId.value);
    if (!projectData || projectData.sources.length === 0) {
      throw new Error('No video sources to export');
    }

    // Prompt user for save location
    const { save } = await import('@tauri-apps/plugin-dialog');
    const savePath = await save({
      defaultPath: `${editorTitle.value}.mp4`,
      filters: [{
        name: 'Video',
        extensions: ['mp4']
      }]
    });

    if (!savePath) {
      isExporting.value = false;
      return; // User cancelled
    }

    console.log('[ClipEditorDialog] Exporting to:', savePath);
    exportProgress.value = 10;

    // Get video metadata for dimensions
    const { invoke } = await import('@tauri-apps/api/core');
    const firstSource = projectData.sources[0];
    const metadata = await invoke<{ width: number; height: number; duration: number }>('get_video_metadata', {
      videoPath: firstSource.source_path
    });

    exportProgress.value = 20;

    // Build export configuration
    const exportConfig = {
      video_sources: projectData.sources.map(source => ({
        source_path: source.source_path,
        start_time: source.start_time,
        end_time: source.end_time,
        trim_start: source.trim_start,
        trim_end: source.trim_end,
      })),
      audio_tracks: (editorEdit.value.audioTracks || []).map(track => ({
        file_path: track.file_path,
        start_time: track.start_time,
        end_time: track.end_time,
        volume: track.volume,
        is_muted: track.is_muted === 1,
      })),
      text_overlays: (editorEdit.value.textOverlays || []).map(text => ({
        text: text.text,
        start_time: text.start_time,
        end_time: text.end_time,
        position_x: text.position_x,
        position_y: text.position_y,
        style_data: text.style_data,
      })),
      output_path: savePath,
      total_duration: duration.value,
      width: metadata.width,
      height: metadata.height,
    };

    console.log('[ClipEditorDialog] Export config:', exportConfig);
    exportProgress.value = 30;

    // Execute export
    await invoke('export_video_editor_project', { config: exportConfig });

    exportProgress.value = 100;
    
    console.log('[ClipEditorDialog] Export completed successfully');
    
    // Show success message
    alert(`Video exported successfully to:\n${savePath}`);

  } catch (error) {
    console.error('[ClipEditorDialog] Export failed:', error);
    alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isExporting.value = false;
    exportProgress.value = 0;
  }
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

// ===== Keyboard Shortcuts =====
function handleKeyDown(event: KeyboardEvent) {
  // Ctrl+Z - Undo
  if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
    event.preventDefault();
    handleUndo();
    return;
  }

  // Ctrl+Y or Ctrl+Shift+Z - Redo
  if ((event.ctrlKey && event.key === 'y') || (event.ctrlKey && event.shiftKey && event.key === 'z')) {
    event.preventDefault();
    handleRedo();
    return;
  }

  // Space - Play/Pause
  if (event.key === ' ' && event.target === document.body) {
    event.preventDefault();
    if (isPlaying.value) {
      handlePause();
    } else {
      handlePlay();
    }
    return;
  }

  // Ctrl+S - Save (manual save, already auto-saving)
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault();
    debouncedSave();
    return;
  }

  // Ctrl+E - Export
  if (event.ctrlKey && event.key === 'e') {
    event.preventDefault();
    handleExport();
    return;
  }

  // S - Split at playhead
  if (event.key === 's' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
    event.preventDefault();
    handleSplit();
    return;
  }

  // Delete/Backspace - Delete selected item
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    handleDelete();
    return;
  }

  // Esc - Close
  if (event.key === 'Escape') {
    event.preventDefault();
    handleClose();
    return;
  }
}

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

  // Register keyboard shortcuts
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  // Unregister keyboard shortcuts
  window.removeEventListener('keydown', handleKeyDown);
  
  // Dispose playback engine
  playbackEngine.dispose();
  
  // Clear command history
  commandHistory.clear();
});
</script>

<style scoped>
.clip-editor-overlay {
  position: fixed;
  top: 32px; /* Account for custom titlebar */
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.98);
  backdrop-filter: blur(16px);
  z-index: 10000;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
}

.clip-editor {
  width: 100%;
  height: 100%;
  background-color: var(--editor-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-top: 0;
  box-sizing: border-box;
}

.clip-editor__content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.clip-editor__preview-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: linear-gradient(135deg, #0a0a0b 0%, #0d0d0e 100%);
}

.clip-editor__timeline-wrapper {
  flex-shrink: 0;
  height: 280px;
  border-top: 1px solid var(--editor-border);
  background-color: var(--editor-surface);
  display: flex;
  flex-direction: column;
}

.clip-editor__editor-mode-notice {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #000;
}

.clip-editor__notice-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 500px;
  text-align: center;
  padding: 3rem;
  color: rgba(255, 255, 255, 0.7);
}

.clip-editor__notice-content h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #f4f4f5;
  margin: 0;
}

.clip-editor__notice-content p {
  font-size: 0.9375rem;
  line-height: 1.6;
  margin: 0;
}

.clip-editor__notice-hint {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
}

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

