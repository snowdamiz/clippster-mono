<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        ref="dialogRef"
        class="bg-card rounded-md w-full h-full border border-border shadow-2xl flex flex-col overflow-hidden"
        style="margin: 30px; margin-top: 60px; max-height: calc(100vh - 80px); max-width: calc(100vw - 60px)"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-gradient-to-r from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a] rounded-t-lg"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="w-6 h-6 rounded-sm bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center"
            >
              <Film class="h-3 w-3 text-violet-400" />
            </div>
            <div class="flex gap-3">
              <h2 class="text-sm font-semibold text-foreground tracking-tight">
                {{ editorMode ? 'Video Editor' : 'Edit Clip' }}
              </h2>
              <Separator class="h-4 w-px bg-foreground/10" orientation="vertical" />
              <p class="text-xs text-foreground/50 truncate max-w-[300px] mt-0.5">
                {{ editorMode ? editorProjectName : clipTitle }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- Auto-save indicator -->
            <div v-if="isSaving" class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 :size="12" class="animate-spin" />
              <span>Saving...</span>
            </div>
            <div v-else-if="lastSaved" class="flex items-center gap-1.5 text-xs text-green-500/70">
              <Check :size="12" />
              <span>Saved</span>
            </div>
            <button
              @click="close"
              class="p-2 hover:bg-white/5 rounded-lg transition-all duration-200 group"
              title="Close (Esc)"
            >
              <X class="h-4 w-4 text-foreground/50 group-hover:text-foreground/90 transition-colors" />
            </button>
          </div>
        </div>

        <!-- Main Content Area -->
        <div class="flex flex-col flex-1 min-h-0">
          <!-- Top Row: Preview and Controls -->
          <div class="flex min-h-0 border-b border-border flex-1" style="overflow: hidden">
            <!-- Left: Video Preview Section -->
            <div
              class="w-3/5 min-w-0 border-r border-border flex flex-col bg-gradient-to-br from-black/20 to-transparent"
            >
              <!-- Aspect Ratio Selector (above video) -->
              <AspectRatioSelector
                :preview-aspect-ratio="previewAspectRatio"
                :selected-aspect-ratios="selectedAspectRatios"
                :framing-configs="framingConfigs"
                :framing-mode="framingMode"
                @update:preview-aspect-ratio="(ratio: string) => (previewAspectRatio = ratio)"
                @open-manual-editor="openManualPOIEditor"
                @toggle-ratio-selection="toggleAspectRatio"
              />

              <div class="flex-1 min-h-0 flex flex-col overflow-hidden relative">
                <ClipEditorPreview
                  ref="previewRef"
                  :video-src="effectiveVideoSrc"
                  :preload-video-src="preloadVideoSrc"
                  :current-time="previewTime"
                  :effective-time="effectivePreviewTime"
                  :is-playing="isPlaying"
                  :clip-start="clipStartTime"
                  :clip-end="clipEndTime"
                  :text-overlays="textOverlays"
                  :stickers="stickers"
                  :watermarks="watermarks"
                  :creator-profile-watermark-settings="props.creatorProfileWatermarkSettings"
                  :filter-settings="activeFilterSettings"
                  :segments="playbackSegments"
                  :preview-aspect-ratio="previewAspectRatio"
                  :selected-aspect-ratios="selectedAspectRatios"
                  :framing-configs="framingConfigs"
                  :subtitle-settings="subtitleSettings"
                  :transcript-words="transcriptWords"
                  :transcript-segments="transcriptSegments"
                  :subtitle-source-time="subtitleSourceTime"
                  :editor-mode="editorMode"
                  :editor-total-duration="editorContentDuration"
                  :active-transition="activeTransition"
                  @time-update="onPreviewTimeUpdate"
                  @toggle-play="togglePlay"
                  @video-element-ready="onVideoElementReady"
                  @video-swapped="onVideoSwapped"
                  @crossfade-completed="onCrossfadeCompleted"
                  @update-overlay-position="onUpdateOverlayPosition"
                  @update-overlay-width="onUpdateOverlayWidth"
                  @update-sticker-scale="onUpdateStickerScale"
                  @update-sticker-rotation="onUpdateStickerRotation"
                  @update-watermark-scale="onUpdateWatermarkScale"
                  @update-subtitle-position="onUpdateSubtitlePosition"
                  @update-subtitle-max-width="onUpdateSubtitleMaxWidth"
                  @video-ended="onVideoEnded"
                />

                <!-- Transition frame overlay - shows last frame during source switch to avoid black flash (fallback) -->
                <canvas
                  v-if="editorMode"
                  ref="transitionCanvasRef"
                  class="absolute inset-0 z-50 pointer-events-none transition-opacity duration-75"
                  :class="showTransitionFrame ? 'opacity-100' : 'opacity-0'"
                  :style="transitionCanvasStyle"
                />
              </div>
            </div>

            <!-- Right: Controls Section -->
            <div class="w-2/5 min-w-0 flex flex-col flex-1 bg-gradient-to-b from-transparent to-black/10">
              <!-- Toolbar -->
              <ClipEditorToolbar
                :active-tab="editorMode ? activeEditorTab : activeTab"
                :editor-mode="editorMode"
                @tab-change="(tab) => (editorMode ? setEditorTab(tab) : setActiveTab(tab))"
              />

              <!-- Tab Content -->
              <div
                class="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
              >
                <!-- Sources Tab (Available in both modes) -->
                <SourcesTab
                  v-if="editorMode ? activeEditorTab === 'sources' : activeTab === 'sources'"
                  @add-source="onAddSource"
                  @import-file="onImportFile"
                />

                <!-- Intro/Outro Tab (Available in both modes) -->
                <IntroOutroTab
                  v-if="editorMode ? activeEditorTab === 'intro-outro' : activeTab === 'intro-outro'"
                  :current-intro="currentIntro"
                  :current-outro="currentOutro"
                  @add-intro="onAddIntro"
                  @add-outro="onAddOutro"
                  @remove-intro="onRemoveIntro"
                  @remove-outro="onRemoveOutro"
                />

                <AudioMixerTab
                  v-if="editorMode ? activeEditorTab === 'audio' : activeTab === 'audio'"
                  :audio-tracks="audioTracks"
                  :original-db="originalDb"
                  :track-db-values="trackDbValues"
                  @add-track="(filePath, name, duration) => addAudioTrack(filePath, name, duration)"
                  @update-track="updateAudioTrackLocal"
                  @delete-track="deleteAudioTrackLocal"
                  @update-original-db="updateOriginalDb"
                  @update-track-db="updateTrackDb"
                />

                <FiltersTab
                  v-if="editorMode ? activeEditorTab === 'filters' : activeTab === 'filters'"
                  :filter-segments="filterSegments"
                  :current-time="effectivePreviewTime"
                  :duration="totalSegmentDuration"
                  @add-filter="addFilterSegment"
                  @update-filter="updateFilterSegment"
                  @delete-filter="deleteFilterSegment"
                />

                <TextOverlayTab
                  v-if="editorMode ? activeEditorTab === 'text' : activeTab === 'text'"
                  :text-overlays="textOverlays"
                  :current-time="effectivePreviewTime"
                  :duration="totalSegmentDuration"
                  :preview-aspect-ratio="previewAspectRatio"
                  :selected-aspect-ratios="selectedAspectRatios"
                  :framing-configs="framingConfigs"
                  @add-text="addTextOverlay"
                  @update-text="updateTextOverlayLocal"
                  @delete-text="deleteTextOverlayLocal"
                  @update:preview-aspect-ratio="(ratio: string) => (previewAspectRatio = ratio)"
                />

                <StickersTab
                  v-if="editorMode ? activeEditorTab === 'stickers' : activeTab === 'stickers'"
                  :stickers="stickers"
                  :current-time="effectivePreviewTime"
                  :duration="totalSegmentDuration"
                  :preview-aspect-ratio="previewAspectRatio"
                  :selected-aspect-ratios="selectedAspectRatios"
                  :framing-configs="framingConfigs"
                  :video-dimensions="videoDimensions"
                  @add-sticker="addStickerLocal"
                  @update-sticker="updateStickerLocal"
                  @delete-sticker="deleteStickerLocal"
                  @update:preview-aspect-ratio="previewAspectRatio = $event"
                />

                <WatermarkTab
                  v-if="editorMode ? activeEditorTab === 'watermark' : activeTab === 'watermark'"
                  :watermarks="watermarks"
                  :current-time="effectivePreviewTime"
                  :duration="totalSegmentDuration"
                  :preview-aspect-ratio="previewAspectRatio"
                  :selected-aspect-ratios="selectedAspectRatios"
                  :framing-configs="framingConfigs"
                  @add-watermark="addWatermarkLocal"
                  @update-watermark="updateWatermarkLocal"
                  @delete-watermark="deleteWatermarkLocal"
                  @update:preview-aspect-ratio="previewAspectRatio = $event"
                />

                <SubtitlesTab
                  v-if="editorMode ? activeEditorTab === 'subtitles' : activeTab === 'subtitles'"
                  :settings="subtitleSettings"
                  :preview-aspect-ratio="previewAspectRatio"
                  :selected-aspect-ratios="selectedAspectRatios"
                  :framing-configs="framingConfigs"
                  @settings-changed="updateSubtitleSettings"
                  @update:preview-aspect-ratio="previewAspectRatio = $event"
                />

                <!-- EffectsTab - TODO: Create this component when effects feature is implemented
                <EffectsTab
                  v-if="activeTab === 'effects'"
                  :effects="effects"
                  :current-time="previewTime"
                  :duration="clipDuration"
                  @add-effect="addEffectLocal"
                  @update-effect="updateEffectLocal"
                  @delete-effect="deleteEffectLocal"
                /> -->

                <AspectTab
                  v-if="editorMode ? activeEditorTab === 'aspect' : activeTab === 'aspect'"
                  :framing-configs="framingConfigs"
                  :selected-aspect-ratios="selectedAspectRatios"
                  :framing-mode-value="framingMode"
                  :thumbnail-url="effectiveThumbnailUrl"
                  :video-path="effectiveVideoPath"
                  :clip-start-time="editorMode ? sourceVideoMinTime : props.clipStartTime"
                  :clip-end-time="editorMode ? sourceVideoMaxTime : props.clipEndTime"
                  :preview-aspect-ratio="previewAspectRatio"
                  @update:framing-configs="updateFramingConfigs"
                  @update:selected-aspect-ratios="updateSelectedAspectRatios"
                  @update:framing-mode="updateFramingMode"
                  @update:preview-aspect-ratio="(ratio: string) => (previewAspectRatio = ratio)"
                />

                <TranscriptTab
                  v-if="editorMode ? activeEditorTab === 'transcript' : activeTab === 'transcript'"
                  :project-id="projectId"
                  :current-time="editorMode ? subtitleSourceTime : effectivePreviewTime"
                  :clip-start-time="editorMode ? sourceVideoMinTime : props.clipStartTime"
                  :clip-end-time="editorMode ? sourceVideoMaxTime : props.clipEndTime"
                  :duration="totalSegmentDuration"
                  :source-time-ranges="editorMode ? sourceVideoTimeRanges : []"
                  @seek-video="seekToAbsoluteTime"
                />

                <ExportTab
                  v-if="editorMode ? activeEditorTab === 'export' : activeTab === 'export'"
                  :clip-id="props.clipId"
                  :project-id="projectId"
                  :selected-aspect-ratios="selectedAspectRatios"
                  :subtitle-settings="subtitleSettings"
                  :framing-mode="framingMode"
                  :framing-configs="framingConfigs"
                  :filter-segments="filterSegments"
                  :text-overlays="textOverlays"
                  :stickers="stickers"
                  :watermarks="watermarks"
                  :audio-tracks="audioTracks"
                  :original-db="originalDb"
                  :track-db-values="trackDbValues"
                  :clip-start-time="props.clipStartTime"
                  :clip-end-time="props.clipEndTime"
                  :clip-name="props.clipTitle"
                  :clip-segments="playbackSegments"
                  :editor-mode="editorMode"
                  :video-sources="videoSources"
                  :editor-project-id="editorProjectId"
                  :editor-project-name="editorProjectName"
                  :current-intro="currentIntro"
                  :current-outro="currentOutro"
                  :creator-profile-watermark-settings="props.creatorProfileWatermarkSettings"
                  @go-to-aspect-tab="editorMode ? setEditorTab('aspect') : setActiveTab('aspect')"
                  @build-started="onBuildStarted"
                  @build-completed="onBuildCompleted"
                  @build-failed="onBuildFailed"
                />
              </div>
            </div>
          </div>

          <!-- Bottom Row: Timeline -->
          <ClipEditorTimeline
            :duration="editorMode ? editorDuration : clipDuration"
            :current-time="editorMode ? previewTime : relativePreviewTime"
            :clip-start="clipStartTime"
            :clip-end="clipEndTime"
            :trim-segments="trimSegments"
            :audio-tracks="audioTracksWithStreamingUrls"
            :text-overlays="textOverlays"
            :stickers="stickers"
            :watermarks="watermarks"
            :effects="effects"
            :filter-segments="filterSegments"
            :video-src="videoSrc ?? undefined"
            :audio-gain-db="effectiveAudioGainDb"
            :track-db-values="trackDbValues"
            :is-playing="isPlaying"
            :editor-mode="editorMode"
            :video-sources="videoSources"
            :can-undo="canUndo"
            :can-redo="canRedo"
            :selected-segment-ids="selectedSegmentIds"
            :markers="markers"
            :selected-marker-id="selectedMarkerId"
            @seek="seekTo"
            @undo="performUndo"
            @redo="performRedo"
            @segment-select="handleSegmentSelect"
            @marker-click="jumpToMarker"
            @split-trim-segment="splitTrimSegment"
            @delete-trim-segment="deleteTrimSegment"
            @update-audio-track="updateAudioTrackLocal"
            @delete-audio-track="deleteAudioTrackLocal"
            @update-text-overlay="updateTextOverlayLocal"
            @delete-text-overlay="deleteTextOverlayLocal"
            @update-sticker="updateStickerLocal"
            @delete-sticker="deleteStickerLocal"
            @update-watermark="updateWatermarkLocal"
            @delete-watermark="deleteWatermarkLocal"
            @update-effect="updateEffectLocal"
            @update-filter-segment="updateFilterSegment"
            @update-source="updateVideoSource"
            @delete-source="deleteVideoSource"
            @drop-source="onDropSource"
            @transitions-detected="onTransitionsDetected"
            @split-source="splitVideoSource"
          />
        </div>
      </div>

      <!-- Manual POI Editor Dialog -->
      <ManualPOIEditor
        v-model="showManualPOIEditor"
        :initial-config="getConfigForRatio(editingAspectRatio)"
        :target-aspect-ratio="editingAspectRatio"
        :source-aspect-ratio="'16:9'"
        :thumbnail-url="effectiveThumbnailUrl"
        :video-path="effectiveVideoPath"
        :clip-start-time="effectivePOIClipStartTime"
        :clip-end-time="effectivePOIClipEndTime ?? undefined"
        @confirm="onManualPOIConfigConfirm"
      />

      <!-- Promote to Video Project Confirmation Dialog -->
      <ConfirmationModal
        :show="showPromoteToProjectDialog"
        title="Create Video Project"
        message="Adding sources to a clip will convert it into a Video Project. This allows you to combine multiple clips, raw videos, and imports into a single video."
        suffix="Your current clip will be the first source in the project."
        confirm-text="Create Project"
        close-text="Cancel"
        :show-cannot-undone-text="false"
        @confirm="onPromoteConfirm"
        @close="onPromoteCancel"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
  import { Film, X, Loader2, Check } from 'lucide-vue-next';
  import { Separator } from '@/components/ui/separator';
  import { CommandHistory, SplitCommand, DeleteCommand, PasteCommand } from '@/services/commands';
  import type { ClipSegment } from '@/services/database';
  import type {
    ClipEditorTab,
    AudioTrack,
    TextOverlay,
    Sticker,
    Effect,
    FilterSettings,
    FilterSegment,
    TrimSegment,
    ManualFramingConfigs,
    ManualFramingConfig,
    ClipWatermark,
    ClipSubtitleSettings,
    WordInfo,
  } from '@/types';
  import {
    getOrCreateClipEdit,
    updateClipEdit,
    getFullClipEdit,
    createAudioTrack,
    updateAudioTrack,
    deleteAudioTrack,
    createTextOverlay,
    updateTextOverlay,
    deleteTextOverlay,
    createSticker,
    updateSticker,
    deleteSticker,
    createEffect,
    updateEffect,
    deleteEffect,
    createWatermark,
    updateWatermarkRecord,
    deleteWatermarkRecord,
    getRawVideosByProjectId,
    getRawVideo,
    getClipWithBuildStatus,
    getClip,
    splitClipSegment,
    deleteClipSegment,
    getClipSegmentsByClipId,
    // Video Editor imports
    getVideoEditorSourcesByProjectId,
    createVideoEditorProject,
    createVideoEditorSource,
    updateVideoEditorSource,
    deleteVideoEditorSource,
    getNextSourceStartTime,
    recalculateProjectDuration,
    // Video Editor Edit imports (for editor mode overlays, audio, etc.)
    getOrCreateVideoEditorEdit,
    updateVideoEditorEdit,
    getFullVideoEditorEdit,
    createVideoEditorAudioTrack,
    updateVideoEditorAudioTrack,
    deleteVideoEditorAudioTrack,
    createVideoEditorTextOverlay,
    updateVideoEditorTextOverlay,
    deleteVideoEditorTextOverlay,
    createVideoEditorSticker,
    updateVideoEditorSticker,
    deleteVideoEditorSticker,
    createVideoEditorWatermark,
    updateVideoEditorWatermark,
    deleteVideoEditorWatermark,
    getWatermarkImage,
    getWatermarkByServerId,
    getProject,
  } from '@/services/database';
  import { getUserOrganizationAssets } from '@/services/organizationAssetsApi';
  import type { VideoEditorSource, VideoEditorTab, SourceItem, VideoEditorTransition, IntroOutro } from '@/types';
  import { calculateCrossfadeOpacity } from '@/types';

  // Disable attribute inheritance since this component renders a Teleport root
  defineOptions({
    inheritAttrs: false,
  });
  import ClipEditorPreview from './ClipEditorPreview.vue';
  import ClipEditorToolbar from './ClipEditorToolbar.vue';
  import ClipEditorTimeline from './ClipEditorTimeline.vue';
  import AspectRatioSelector from './AspectRatioSelector.vue';
  import AudioMixerTab from './tabs/AudioMixerTab.vue';
  import FiltersTab from './tabs/FiltersTab.vue';
  import TextOverlayTab from './tabs/TextOverlayTab.vue';
  import StickersTab from './tabs/StickersTab.vue';
  import WatermarkTab from './tabs/WatermarkTab.vue';
  import SubtitlesTab from './tabs/SubtitlesTab.vue';
  import AspectTab from './tabs/AspectTab.vue';
  import TranscriptTab from './tabs/TranscriptTab.vue';
  import ExportTab from './tabs/ExportTab.vue';
  import IntroOutroTab from './tabs/IntroOutroTab.vue';
  import ManualPOIEditor from '@/components/poi/ManualPOIEditor.vue';
  import SourcesTab from '@/components/video-editor/SourcesTab.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import { useTranscriptData } from '@/composables/useTranscriptData';
  import { invoke } from '@tauri-apps/api/core';

  interface ClipSegmentInput {
    start_time: number;
    end_time: number;
  }

  const props = withDefaults(
    defineProps<{
      modelValue: boolean;
      // Clip mode props (required when not in editor mode)
      clipId?: string;
      videoSrc?: string | null;
      clipStartTime?: number;
      clipEndTime?: number;
      clipTitle?: string;
      clipSegments?: ClipSegmentInput[];
      // Creator profile watermark settings (for preview display)
      creatorProfileWatermarkSettings?: any | null;
      // Editor mode props
      editorMode?: boolean;
      editorProjectId?: string | null;
      editorProjectName?: string;
      // Creator profile watermark settings (auto-applied when opening)
      creatorWatermarkId?: string | null;
      creatorWatermarkSettings?: string | null; // JSON string of per-ratio settings
    }>(),
    {
      clipId: '',
      videoSrc: null,
      clipStartTime: 0,
      clipEndTime: 0,
      clipTitle: '',
      creatorProfileWatermarkSettings: null,
      editorMode: false,
      editorProjectId: null,
      editorProjectName: 'Video Project',
      creatorWatermarkId: null,
      creatorWatermarkSettings: null,
    }
  );

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'save', clipId: string): void;
    (e: 'editorSave', projectId: string): void;
  }>();

  // Command history for undo/redo
  const commandHistory = new CommandHistory();

  // Clipboard for copy/paste
  const copiedSegment = ref<ClipSegment | null>(null);

  // Multi-select state
  const selectedSegmentIds = ref<Set<string>>(new Set());
  const lastSelectedSegmentId = ref<string | null>(null); // For shift+click range selection

  // Timeline markers
  interface TimelineMarker {
    id: string;
    time: number; // Absolute time in video
    label?: string;
  }
  const markers = ref<TimelineMarker[]>([]);
  const selectedMarkerId = ref<string | null>(null);

  // Reactive undo/redo availability (updates after each operation)
  const undoRedoTrigger = ref(0); // Increment this to force reactivity
  const canUndo = computed(() => {
    undoRedoTrigger.value; // Access to make it reactive
    return commandHistory.canUndo();
  });
  const canRedo = computed(() => {
    undoRedoTrigger.value; // Access to make it reactive
    return commandHistory.canRedo();
  });

  // Refs
  const dialogRef = ref<HTMLElement | null>(null);
  const previewRef = ref<InstanceType<typeof ClipEditorPreview> | null>(null);
  const videoElement = ref<HTMLVideoElement | null>(null);
  const videoDimensions = ref({ width: 0, height: 0 });
  const clipEditId = ref<string | null>(null);
  const videoEditorEditId = ref<string | null>(null); // For video editor mode

  // Auto-save state
  const isSaving = ref(false);
  const lastSaved = ref(false);
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let isInitialLoad = ref(true); // Prevent auto-save during initial data load

  // Editor state
  const activeTab = ref<ClipEditorTab>('audio');
  const activeEditorTab = ref<VideoEditorTab>('sources'); // For editor mode
  const isPlaying = ref(false);
  const previewTime = ref(0);

  // Video editor mode state
  const videoSources = ref<VideoEditorSource[]>([]);
  const videoServerPort = ref<number | null>(null);
  const isSeeking = ref(false); // Flag to prevent time update feedback loops
  const pendingSeekTime = ref<number | null>(null); // Time to seek to after video source changes
  const currentVideoSourceId = ref<string | null>(null); // Track which source is loaded
  const transitionCanvasRef = ref<HTMLCanvasElement | null>(null); // Canvas for transition frame (fallback)
  const showTransitionFrame = ref(false); // Whether to show the transition frame overlay (fallback)

  // Crossfade transition state
  const sourceTransitions = ref<VideoEditorTransition[]>([]); // All detected transitions
  const crossfadeStarted = ref(false); // Whether we've started crossfade for current transition
  const lastCrossfadeTransitionId = ref<string | null>(null); // Track which transition we've started

  // Promotion to Video Project state (when adding sources in clip mode)
  const isPromotedToEditorMode = ref(false); // Local override for editor mode
  const promotedProjectId = ref<string | null>(null); // Local project ID when promoted
  const promotedProjectName = ref<string>(''); // Local project name when promoted
  const showPromoteToProjectDialog = ref(false); // Show confirmation dialog
  const pendingSourceToAdd = ref<SourceItem | null>(null); // Source waiting to be added after promotion
  const pendingImportToAdd = ref<{ filePath: string; name: string; duration: number; thumbnailPath?: string } | null>(
    null
  ); // Import file waiting to be added after promotion

  // Intro/Outro state - track currently applied intro and outro
  interface AppliedIntroOutro {
    id: string;
    sourceId: string; // The video source ID in the timeline
    name: string;
    duration: number | null;
    filePath: string;
    thumbnailUrl?: string;
    // Org asset properties (for on-demand downloading during export)
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string;
    organization_id?: string;
    organization_name?: string;
    created_at?: string;
    updated_at?: string;
  }
  const currentIntro = ref<AppliedIntroOutro | null>(null);
  const currentOutro = ref<AppliedIntroOutro | null>(null);

  // Computed: effective editor mode (prop or promoted)
  const editorMode = computed(() => props.editorMode || isPromotedToEditorMode.value);

  // Computed: effective editor project ID and name
  const editorProjectId = computed(() => promotedProjectId.value || props.editorProjectId);
  const editorProjectName = computed(() => promotedProjectName.value || props.editorProjectName);

  // Edit data
  const trimSegments = ref<TrimSegment[]>([]);
  const audioTracks = ref<AudioTrack[]>([]);
  const textOverlays = ref<TextOverlay[]>([]);
  const stickers = ref<Sticker[]>([]);
  const effects = ref<Effect[]>([]);
  const watermarks = ref<ClipWatermark[]>([]);
  const filterSegments = ref<FilterSegment[]>([]);
  const originalDb = ref(0);
  const trackDbValues = ref<Record<string, number>>({});

  // Debug watcher for stickers
  watch(
    stickers,
    (newStickers) => {
      console.log(
        '[ClipEditorDialog] Stickers updated:',
        newStickers.map((s) => ({
          id: s.id,
          scale: s.scale,
          path: s.stickerPath.slice(-20),
          configs: s.perRatioConfigs,
        }))
      );
    },
    { deep: true }
  );

  // Computed: audio tracks with streaming URLs for timeline/waveform rendering
  const audioTracksWithStreamingUrls = computed(() => {
    return audioTracks.value.map((track) => {
      // If file path is already an HTTP URL (legacy), use it directly
      if (track.filePath.startsWith('http://') || track.filePath.startsWith('https://')) {
        return track;
      }

      // Construct streaming URL from file path
      if (!videoServerPort.value) {
        return track; // Return unchanged if port not available yet
      }

      const encodedPath = btoa(unescape(encodeURIComponent(track.filePath)));
      const streamingUrl = `http://localhost:${videoServerPort.value}/video/${encodedPath}`;

      return {
        ...track,
        filePath: streamingUrl,
      };
    });
  });

  // Subtitle settings
  const getDefaultSubtitleSettings = (): ClipSubtitleSettings => ({
    enabled: false,
    fontFamily: 'Montserrat',
    fontSize: 32,
    fontWeight: 700,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundEnabled: false,
    border1Width: 2,
    border1Color: '#00FF00',
    border2Width: 4,
    border2Color: '#000000',
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    shadowBlur: 4,
    shadowColor: '#000000',
    position: 'bottom',
    positionX: 50,
    positionY: 85,
    maxWidth: 90,
    animationStyle: 'none',
    highlightColor: '#FFFF00',
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: 'center',
    padding: 16,
    borderRadius: 8,
    wordSpacing: 0.35,
    selectedPresetId: null,
    perRatioConfigs: {},
  });
  const subtitleSettings = ref<ClipSubtitleSettings>(getDefaultSubtitleSettings());

  // Aspect ratio framing data
  const selectedAspectRatios = ref<string[]>(['16:9']); // Always include 16:9 (Original) by default
  const previewAspectRatio = ref<string>('16:9'); // Currently previewed aspect ratio
  const framingMode = ref<'auto' | 'manual'>('auto');
  const framingConfigs = ref<ManualFramingConfigs>({});
  const videoPath = ref<string | null>(null);
  const thumbnailUrl = ref<string | null>(null);
  const editorThumbnailUrl = ref<string | null>(null);

  // Manual POI editor state
  const showManualPOIEditor = ref(false);
  const editingAspectRatio = ref<string>('9:16');

  // Project ID for transcript loading (fetched from clip)
  const projectId = ref<string | null>(null);

  // Use transcript data composable for subtitle display
  const { transcriptData, loadTranscriptData } = useTranscriptData(computed(() => projectId.value));

  // Get the source video time ranges covered by all video sources (for editor mode)
  const sourceVideoTimeRanges = computed(() => {
    if (!editorMode.value || videoSources.value.length === 0) {
      return [];
    }
    return videoSources.value.map((source) => ({
      start: source.trim_start,
      end: source.trim_end ?? source.trim_start + (source.end_time - source.start_time),
    }));
  });

  // Get the min start time across all source video ranges (for TranscriptTab in editor mode)
  const sourceVideoMinTime = computed(() => {
    if (sourceVideoTimeRanges.value.length === 0) return 0;
    return Math.min(...sourceVideoTimeRanges.value.map((r) => r.start));
  });

  // Get the max end time across all source video ranges (for TranscriptTab in editor mode)
  const sourceVideoMaxTime = computed(() => {
    if (sourceVideoTimeRanges.value.length === 0) return 0;
    return Math.max(...sourceVideoTimeRanges.value.map((r) => r.end));
  });

  // Check if a time falls within any of the source video ranges (may be used in future)
  function _isTimeInSourceRanges(time: number): boolean {
    for (const range of sourceVideoTimeRanges.value) {
      if (time >= range.start && time <= range.end) {
        return true;
      }
    }
    return false;
  }

  // Get transcript words for subtitle display (filtered to clip range)
  const transcriptWords = computed<WordInfo[]>(() => {
    if (!transcriptData.value?.words?.length) return [];

    // In editor mode, filter based on the source video time ranges being used
    if (editorMode.value) {
      if (sourceVideoTimeRanges.value.length === 0) return [];
      return transcriptData.value.words.filter((word: WordInfo) => {
        const wordStart = word.start ?? 0;
        const wordEnd = word.end ?? wordStart;
        // Include words that overlap with any of the source video ranges
        return sourceVideoTimeRanges.value.some((range) => wordEnd >= range.start && wordStart <= range.end);
      });
    }

    return transcriptData.value.words.filter((word: WordInfo) => {
      const wordStart = word.start ?? 0;
      const wordEnd = word.end ?? wordStart;
      // Include words that overlap with the clip range
      return wordEnd >= props.clipStartTime && wordStart <= props.clipEndTime;
    });
  });

  // Get transcript segments for subtitle display (filtered to clip range)
  const transcriptSegments = computed(() => {
    if (!transcriptData.value?.whisperSegments?.length) return [];

    // In editor mode, filter based on the source video time ranges being used
    if (editorMode.value) {
      if (sourceVideoTimeRanges.value.length === 0) return [];
      return transcriptData.value.whisperSegments.filter((segment) => {
        // Include segments that overlap with any of the source video ranges
        return sourceVideoTimeRanges.value.some((range) => segment.end >= range.start && segment.start <= range.end);
      });
    }

    return transcriptData.value.whisperSegments.filter((segment) => {
      // Include segments that overlap with the clip range
      return segment.end >= props.clipStartTime && segment.start <= props.clipEndTime;
    });
  });

  // Audio playback elements
  const audioElements = ref<Map<string, HTMLAudioElement>>(new Map());
  const audioContext = ref<AudioContext | null>(null);
  const gainNodes = ref<Map<string, GainNode>>(new Map());

  // Computed
  const clipDuration = computed(() => props.clipEndTime - props.clipStartTime);

  // Editor mode: actual total content duration (sum of all sources)
  const editorContentDuration = computed(() => {
    if (videoSources.value.length === 0) {
      return 0;
    }

    // Find the maximum end time of all sources (this is the total content duration)
    let maxEndTime = 0;
    for (const source of videoSources.value) {
      if (source.end_time > maxEndTime) {
        maxEndTime = source.end_time;
      }
    }

    return maxEndTime;
  });

  // Editor mode: timeline duration - content duration + 2 minutes of empty space at the end
  const editorDuration = computed(() => {
    const PADDING = 60; // 2 minutes padding beyond content
    const DEFAULT_EMPTY_DURATION = 120; // 2 minutes default when no content

    if (videoSources.value.length === 0) {
      return DEFAULT_EMPTY_DURATION;
    }

    // Timeline shows all content + 2 minutes of empty space at the end
    return editorContentDuration.value + PADDING;
  });

  // Calculate total duration of all segments combined
  const totalSegmentDuration = computed(() => {
    // Editor mode uses video sources instead of trim segments
    if (editorMode.value) {
      return editorContentDuration.value;
    }
    const segments = trimSegments.value.filter((s) => !s.isDeleted);
    if (segments.length === 0) {
      return clipDuration.value;
    }
    return segments.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0);
  });

  // Convert absolute time to relative time for the timeline (0 to clipDuration)
  const relativePreviewTime = computed(() => {
    return Math.max(0, Math.min(clipDuration.value, previewTime.value - props.clipStartTime));
  });

  // Convert absolute video time to effective timeline time (accounting for segment cuts)
  // This is the time position in the "edited" timeline where cuts are removed
  const effectivePreviewTime = computed(() => {
    // Editor mode: previewTime is already the global timeline position
    if (editorMode.value) {
      return previewTime.value;
    }

    const absoluteTime = previewTime.value;
    const segments = trimSegments.value.filter((s) => !s.isDeleted);

    if (segments.length === 0) {
      // No segments defined, use simple relative time
      return Math.max(0, absoluteTime - props.clipStartTime);
    }

    // Sort segments by start time
    const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);

    // Convert absolute time to relative time within clip
    const relativeTime = absoluteTime - props.clipStartTime;

    // Find which segment contains this time and calculate effective position
    let effectiveTime = 0;
    for (const segment of sortedSegments) {
      if (relativeTime < segment.startTime) {
        // Before this segment - use accumulated time
        break;
      } else if (relativeTime >= segment.startTime && relativeTime <= segment.endTime) {
        // Within this segment
        effectiveTime += relativeTime - segment.startTime;
        break;
      } else {
        // Past this segment - add its full duration
        effectiveTime += segment.endTime - segment.startTime;
      }
    }

    return effectiveTime;
  });

  // Get the active filter settings at the current preview time (effective time)
  const activeFilterSettings = computed(() => {
    const effectiveTime = effectivePreviewTime.value;
    // Find filter segment that contains the current effective time
    const activeSegment = filterSegments.value.find(
      (seg) => effectiveTime >= seg.startTime && effectiveTime <= seg.endTime
    );
    return activeSegment?.settings || null;
  });

  // Editor mode: Find the active video source based on current playback time
  const activeVideoSource = computed(() => {
    if (!editorMode.value || videoSources.value.length === 0) {
      return null;
    }

    // If we have a tracked source ID (e.g., during/after crossfade), use it
    if (currentVideoSourceId.value) {
      const trackedSource = videoSources.value.find((s) => s.id === currentVideoSourceId.value);
      if (trackedSource) {
        return trackedSource;
      }
    }

    const time = previewTime.value;
    // Sort sources by start_time to get consistent results during overlap
    const sortedSources = [...videoSources.value].sort((a, b) => a.start_time - b.start_time);
    // Find source that contains the current time (prefer earlier source during overlap)
    return sortedSources.find((source) => time >= source.start_time && time < source.end_time) || null;
  });

  // Editor mode: Calculate the actual source video time for subtitle lookup
  // This maps the editor timeline position to the actual timestamp in the source video
  const subtitleSourceTime = computed(() => {
    if (!editorMode.value) {
      // In clip mode, use the preview time directly (relative to clip start is handled elsewhere)
      return previewTime.value;
    }

    const source = activeVideoSource.value;
    if (!source) {
      return previewTime.value;
    }

    // Calculate time in the source video:
    // previewTime is the position on the editor timeline
    // source.start_time is where this source starts on the editor timeline
    // source.trim_start is where we start playing from in the source video
    const timeInSource = previewTime.value - source.start_time + source.trim_start;
    return timeInSource;
  });

  // Editor mode: Find the next video source (for preloading)
  const nextVideoSource = computed(() => {
    if (!editorMode.value || !activeVideoSource.value) {
      return null;
    }

    const sortedSources = [...videoSources.value].sort((a, b) => a.order_index - b.order_index);
    const currentIndex = sortedSources.findIndex((s) => s.id === activeVideoSource.value!.id);

    if (currentIndex === -1 || currentIndex >= sortedSources.length - 1) {
      return null;
    }

    return sortedSources[currentIndex + 1];
  });

  // Editor mode: Find the currently active crossfade transition (if any)
  const activeTransition = computed<VideoEditorTransition | null>(() => {
    if (!editorMode.value || sourceTransitions.value.length === 0) {
      return null;
    }

    const time = previewTime.value;
    // Find transition that contains the current time
    return sourceTransitions.value.find((t) => time >= t.startTime && time <= t.endTime) || null;
  });

  // Get the "outgoing" source during a transition (the one fading out) - may be used in future
  const _transitionOutgoingSource = computed(() => {
    if (!activeTransition.value) return null;
    return videoSources.value.find((s) => s.id === activeTransition.value!.sourceAId) || null;
  });

  // Get the "incoming" source during a transition (the one fading in)
  const transitionIncomingSource = computed(() => {
    // First try to get from active transition
    if (activeTransition.value) {
      return videoSources.value.find((s) => s.id === activeTransition.value!.sourceBId) || null;
    }
    // Fallback: if we have a lastCrossfadeTransitionId, use it to find the incoming source
    // This handles the case where we've just exited the transition zone but still need the source
    if (lastCrossfadeTransitionId.value) {
      const transition = sourceTransitions.value.find((t) => t.id === lastCrossfadeTransitionId.value);
      if (transition) {
        return videoSources.value.find((s) => s.id === transition.sourceBId) || null;
      }
    }
    return null;
  });

  // Editor mode: Compute the video URL for the active source
  const editorVideoSrc = computed(() => {
    if (!editorMode.value || !activeVideoSource.value) {
      return null;
    }

    const source = activeVideoSource.value;
    const path = source.source_path;

    // If path already looks like an HTTP URL (legacy data), use it directly
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Otherwise, construct the HTTP URL from the file path
    if (!videoServerPort.value) {
      return null;
    }

    const encodedPath = btoa(unescape(encodeURIComponent(path)));
    return `http://localhost:${videoServerPort.value}/video/${encodedPath}`;
  });

  // Editor mode: Compute the preload URL for the next source (for seamless transitions)
  const preloadVideoSrc = computed(() => {
    if (!editorMode.value || !nextVideoSource.value) {
      return null;
    }

    const source = nextVideoSource.value;
    const path = source.source_path;

    // If path already looks like an HTTP URL, use it directly
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Otherwise, construct the HTTP URL from the file path
    if (!videoServerPort.value) {
      return null;
    }

    const encodedPath = btoa(unescape(encodeURIComponent(path)));
    return `http://localhost:${videoServerPort.value}/video/${encodedPath}`;
  });

  // The video source to use for the preview (either from props or computed for editor mode)
  const effectiveVideoSrc = computed(() => {
    if (editorMode.value) {
      return editorVideoSrc.value;
    }
    return props.videoSrc || null;
  });

  // Effective video path for ManualPOIEditor - uses active source in editor mode
  const effectiveVideoPath = computed(() => {
    if (editorMode.value) {
      // In editor mode, use the first source or active source
      const source = videoSources.value.length > 0 ? videoSources.value[0] : null;
      return source?.source_path || null;
    }
    return videoPath.value;
  });

  // Effective clip start time for ManualPOIEditor - uses source trim times in editor mode
  const effectivePOIClipStartTime = computed(() => {
    if (editorMode.value) {
      const source = videoSources.value.length > 0 ? videoSources.value[0] : null;
      return source?.trim_start || 0;
    }
    return props.clipStartTime;
  });

  // Effective clip end time for ManualPOIEditor - uses source trim times in editor mode
  const effectivePOIClipEndTime = computed(() => {
    if (editorMode.value) {
      const source = videoSources.value.length > 0 ? videoSources.value[0] : null;
      if (source) {
        // If trim_end is 0 or null, use source duration (full video)
        // Calculate the effective duration from end_time - start_time + trim_start
        const sourceDuration = source.end_time - source.start_time;
        return source.trim_end && source.trim_end > 0 ? source.trim_end : source.trim_start + sourceDuration;
      }
      return 0;
    }
    return props.clipEndTime;
  });

  // Effective thumbnail URL for ManualPOIEditor
  const effectiveThumbnailUrl = computed(() => {
    if (editorMode.value) {
      return editorThumbnailUrl.value || thumbnailUrl.value;
    }
    return thumbnailUrl.value;
  });

  // Get segments in absolute time format for playback
  const playbackSegments = computed(() => {
    if (trimSegments.value.length === 0) {
      // No segments defined, use the full clip as a single segment
      return [{ start_time: props.clipStartTime, end_time: props.clipEndTime }];
    }

    // Convert relative segment times back to absolute times
    return trimSegments.value
      .filter((seg) => !seg.isDeleted)
      .map((seg) => ({
        start_time: props.clipStartTime + seg.startTime,
        end_time: props.clipStartTime + seg.endTime,
      }))
      .sort((a, b) => a.start_time - b.start_time);
  });

  // Effective audio gain for waveform visualization (uses originalDb which can be initialized from project settings)
  const effectiveAudioGainDb = computed(() => originalDb.value);

  // Transition canvas style - matches the video container
  const transitionCanvasStyle = computed(() => ({
    objectFit: 'contain' as const,
    width: '100%',
    height: '100%',
  }));

  // Capture current video frame to the transition canvas
  function captureTransitionFrame() {
    if (!videoElement.value || !transitionCanvasRef.value) return;

    const video = videoElement.value;
    const canvas = transitionCanvasRef.value;

    // Only capture if video has valid dimensions
    if (!video.videoWidth || !video.videoHeight) return;

    // Set canvas size to match video's natural dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current frame
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    showTransitionFrame.value = true;

    // Safety timeout - hide frame after 2 seconds max in case something goes wrong
    setTimeout(() => {
      if (showTransitionFrame.value) {
        hideTransitionFrame();
      }
    }, 2000);
  }

  // Hide the transition frame overlay
  function hideTransitionFrame() {
    showTransitionFrame.value = false;
  }

  // Methods
  function close() {
    // Stop all audio playback
    isPlaying.value = false;
    audioElements.value.forEach((audio) => audio.pause());
    emit('update:modelValue', false);
  }

  function setActiveTab(tab: ClipEditorTab) {
    activeTab.value = tab;
  }

  function setEditorTab(tab: VideoEditorTab) {
    activeEditorTab.value = tab;
  }

  // Video source operations for editor mode
  async function onAddSource(source: SourceItem) {
    // If not in editor mode (clip mode), show promotion dialog
    if (!editorMode.value) {
      pendingSourceToAdd.value = source;
      pendingImportToAdd.value = null;
      showPromoteToProjectDialog.value = true;
      return;
    }

    // In editor mode, add source directly
    await addSourceToProject(source);
  }

  // Internal function to add source to the current video project
  async function addSourceToProject(source: SourceItem) {
    const projectId = editorProjectId.value;
    if (!projectId) return;

    try {
      const startTime = await getNextSourceStartTime(projectId);

      // For detected clips: use clip segment timing (trim from source video)
      // For raw videos/built clips: use full duration
      const isDetectedClip =
        source.type === 'clip' &&
        source.clipStartTime !== undefined &&
        source.clipStartTime !== null &&
        source.clipEndTime !== undefined &&
        source.clipEndTime !== null;

      // Calculate durations
      const clipDuration = isDetectedClip ? source.clipEndTime! - source.clipStartTime! : source.duration || 30;

      // Source duration is the full video length (for detected clips use sourceDuration)
      const fullSourceDuration = isDetectedClip ? source.sourceDuration || clipDuration : source.duration || 30;

      // Trim points in the source video
      const trimStart = isDetectedClip ? source.clipStartTime! : 0;
      const trimEnd = isDetectedClip ? source.clipEndTime! : null;

      // Store the actual file path (not the HTTP URL) for the source
      const newSource = await createVideoEditorSource(projectId, {
        sourceType: source.type,
        sourceId: source.id,
        sourcePath: source.path, // Store actual file path (raw video path for detected clips)
        sourceName: source.name,
        sourceThumbnail: source.thumbnailPath,
        sourceDuration: fullSourceDuration,
        startTime: startTime,
        endTime: startTime + clipDuration, // Timeline duration is the clip segment duration
        trimStart: trimStart,
        trimEnd: trimEnd,
        orderIndex: videoSources.value.length,
      });

      videoSources.value.push(newSource);
      await recalculateProjectDuration(projectId);
      triggerAutoSave();
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to add source:', error);
    }
  }

  async function onImportFile(filePath: string, name: string, duration: number, thumbnailPath?: string) {
    // If not in editor mode (clip mode), show promotion dialog
    if (!editorMode.value) {
      pendingSourceToAdd.value = null;
      pendingImportToAdd.value = { filePath, name, duration, thumbnailPath };
      showPromoteToProjectDialog.value = true;
      return;
    }

    // In editor mode, import file directly
    await importFileToProject(filePath, name, duration, thumbnailPath);
  }

  // Internal function to import file to the current video project
  async function importFileToProject(filePath: string, name: string, duration: number, thumbnailPath?: string) {
    const projectId = editorProjectId.value;
    if (!projectId) return;

    try {
      const startTime = await getNextSourceStartTime(projectId);
      const sourceDuration = duration || 30;

      // Store the actual file path (not the HTTP URL)
      const newSource = await createVideoEditorSource(projectId, {
        sourceType: 'imported',
        sourceId: null,
        sourcePath: filePath, // Store actual file path
        sourceName: name,
        sourceThumbnail: thumbnailPath || null,
        sourceDuration: sourceDuration,
        startTime: startTime,
        endTime: startTime + sourceDuration,
        trimStart: 0,
        trimEnd: null,
        orderIndex: videoSources.value.length,
      });

      videoSources.value.push(newSource);
      await recalculateProjectDuration(projectId);
      triggerAutoSave();
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to import file:', error);
    }
  }

  // Migrate existing clip edits to the video editor project
  // This recreates text overlays, audio tracks, stickers, and watermarks in the video_editor_* tables
  async function migrateClipEditsToVideoProject(newVideoEditorEditId: string) {
    try {
      // Migrate text overlays
      const newTextOverlays: typeof textOverlays.value = [];
      for (const overlay of textOverlays.value) {
        const newOverlay = await createVideoEditorTextOverlay(newVideoEditorEditId, {
          text: overlay.text,
          start_time: overlay.startTime,
          end_time: overlay.endTime,
          style_data: JSON.stringify(overlay.style),
          position_x: overlay.position.x,
          position_y: overlay.position.y,
          per_ratio_configs_data: overlay.perRatioConfigs ? JSON.stringify(overlay.perRatioConfigs) : undefined,
        });
        newTextOverlays.push({
          id: newOverlay.id,
          text: newOverlay.text,
          startTime: newOverlay.start_time,
          endTime: newOverlay.end_time,
          position: { x: newOverlay.position_x, y: newOverlay.position_y },
          style: JSON.parse(newOverlay.style_data || '{}'),
          animation: overlay.animation,
          perRatioConfigs: newOverlay.per_ratio_configs_data
            ? JSON.parse(newOverlay.per_ratio_configs_data)
            : undefined,
        });
      }
      textOverlays.value = newTextOverlays;

      // Migrate audio tracks
      const newAudioTracks: typeof audioTracks.value = [];
      for (const track of audioTracks.value) {
        const newTrack = await createVideoEditorAudioTrack(newVideoEditorEditId, {
          file_path: track.filePath,
          name: track.name,
          start_time: track.startTime,
          end_time: track.endTime,
          volume: track.volume,
          fade_in: track.fadeIn,
          fade_out: track.fadeOut,
          track_order: track.trackOrder,
          is_muted: track.isMuted ? 1 : 0,
          is_solo: track.isSolo ? 1 : 0,
        });
        newAudioTracks.push({
          id: newTrack.id,
          filePath: newTrack.file_path,
          name: newTrack.name,
          startTime: newTrack.start_time,
          endTime: newTrack.end_time,
          volume: newTrack.volume,
          fadeIn: newTrack.fade_in,
          fadeOut: newTrack.fade_out,
          trackOrder: newTrack.track_order,
          isMuted: !!newTrack.is_muted,
          isSolo: !!newTrack.is_solo,
        });
      }
      audioTracks.value = newAudioTracks;

      // Migrate stickers
      const newStickers: typeof stickers.value = [];
      for (const sticker of stickers.value) {
        const newSticker = await createVideoEditorSticker(newVideoEditorEditId, {
          sticker_path: sticker.stickerPath,
          sticker_type: sticker.stickerType,
          start_time: sticker.startTime,
          end_time: sticker.endTime,
          position_x: sticker.position.x,
          position_y: sticker.position.y,
          scale: sticker.scale,
          rotation: sticker.rotation,
          per_ratio_configs_data: sticker.perRatioConfigs ? JSON.stringify(sticker.perRatioConfigs) : undefined,
        });
        newStickers.push({
          id: newSticker.id,
          stickerPath: newSticker.sticker_path,
          stickerType: newSticker.sticker_type as 'emoji' | 'image' | 'gif',
          startTime: newSticker.start_time,
          endTime: newSticker.end_time,
          position: { x: newSticker.position_x, y: newSticker.position_y },
          scale: newSticker.scale,
          rotation: newSticker.rotation,
          animation: sticker.animation,
          perRatioConfigs: newSticker.per_ratio_configs_data
            ? JSON.parse(newSticker.per_ratio_configs_data)
            : undefined,
        });
      }
      stickers.value = newStickers;

      // Migrate watermarks
      const newWatermarks: typeof watermarks.value = [];
      for (const watermark of watermarks.value) {
        const newWatermark = await createVideoEditorWatermark(newVideoEditorEditId, {
          watermark_id: watermark.watermarkId,
          watermark_path: watermark.filePath,
          preview_url: watermark.previewUrl,
          start_time: watermark.startTime,
          end_time: watermark.endTime,
          position_x: watermark.position.x,
          position_y: watermark.position.y,
          scale: watermark.scale,
          opacity: watermark.opacity,
          per_ratio_configs_data: watermark.perRatioConfigs ? JSON.stringify(watermark.perRatioConfigs) : undefined,
        });
        newWatermarks.push({
          id: newWatermark.id,
          watermarkId: newWatermark.watermark_id,
          filePath: newWatermark.watermark_path,
          previewUrl: newWatermark.preview_url || '',
          startTime: newWatermark.start_time,
          endTime: newWatermark.end_time,
          position: { x: newWatermark.position_x, y: newWatermark.position_y },
          scale: newWatermark.scale,
          opacity: newWatermark.opacity,
          perRatioConfigs: newWatermark.per_ratio_configs_data
            ? JSON.parse(newWatermark.per_ratio_configs_data)
            : undefined,
        });
      }
      watermarks.value = newWatermarks;

      console.log(
        `[ClipEditorDialog] Migrated ${textOverlays.value.length} text overlays, ${audioTracks.value.length} audio tracks, ${stickers.value.length} stickers, ${watermarks.value.length} watermarks to video project`
      );
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to migrate clip edits:', error);
    }
  }

  // Promote current clip to a video project
  async function promoteToVideoProject() {
    try {
      // Create a new video editor project with the clip's name
      const projectName = `${props.clipTitle || 'Untitled'} - Video Project`;
      const newProjectId = await createVideoEditorProject(projectName);

      // Get video server port for constructing video URLs
      videoServerPort.value = await invoke<number>('get_video_server_port');

      // Add the current clip as the first source
      // First, get the clip's raw video path
      let clipVideoPath = '';
      let clipDuration = props.clipEndTime - props.clipStartTime;

      // Try to extract path from videoSrc URL
      if (props.videoSrc) {
        const match = props.videoSrc.match(/\/video\/([^?]+)/);
        if (match) {
          try {
            clipVideoPath = atob(match[1]);
          } catch {
            console.warn('[ClipEditorDialog] Failed to decode video path');
          }
        }
      }

      // If we have a clip ID, get the clip's raw video info
      if (props.clipId) {
        try {
          const clip = await getClip(props.clipId);
          if (clip?.project_id) {
            const rawVideos = await getRawVideosByProjectId(clip.project_id);
            if (rawVideos.length > 0) {
              clipVideoPath = rawVideos[0].file_path;
            }
          }
        } catch (error) {
          console.warn('[ClipEditorDialog] Failed to get clip raw video:', error);
        }
      }

      // Create the first source from the current clip
      if (clipVideoPath) {
        const firstSource = await createVideoEditorSource(newProjectId, {
          sourceType: 'clip',
          sourceId: props.clipId || null,
          sourcePath: clipVideoPath,
          sourceName: props.clipTitle || 'Clip',
          sourceThumbnail: null,
          sourceDuration: clipDuration,
          startTime: 0,
          endTime: clipDuration,
          trimStart: props.clipStartTime,
          trimEnd: props.clipEndTime,
          orderIndex: 0,
        });

        videoSources.value = [firstSource];
      }

      // Create/get an edit record for the video editor project
      const editRecord = await getOrCreateVideoEditorEdit(newProjectId);
      videoEditorEditId.value = editRecord.id;

      // Migrate existing clip edits to the video editor project
      // Text overlays, audio tracks, stickers, and watermarks need to be recreated in the video_editor_* tables
      await migrateClipEditsToVideoProject(editRecord.id);

      // Update local state to switch to editor mode
      promotedProjectId.value = newProjectId;
      promotedProjectName.value = projectName;
      isPromotedToEditorMode.value = true;
      activeEditorTab.value = 'sources';

      // Recalculate project duration
      await recalculateProjectDuration(newProjectId);

      // Reset to start of timeline and seek video to correct position
      // In editor mode, previewTime represents position on the timeline, not absolute video time
      // Use nextTick to ensure the editorMode computed has updated
      await nextTick();
      seekTo(0);

      // Reload transcript data now that we're in editor mode
      // The projectId should already be set from clip mode, but trigger a refresh
      if (projectId.value) {
        await loadTranscriptData(projectId.value);
      }

      console.log(`[ClipEditorDialog] Promoted clip to video project: ${newProjectId}`);
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to promote to video project:', error);
    }
  }

  // Handle promotion dialog confirmation
  async function onPromoteConfirm() {
    showPromoteToProjectDialog.value = false;

    // First, promote to video project
    await promoteToVideoProject();

    // Then add the pending source or import
    if (pendingSourceToAdd.value) {
      await addSourceToProject(pendingSourceToAdd.value);
      pendingSourceToAdd.value = null;
    } else if (pendingImportToAdd.value) {
      const { filePath, name, duration, thumbnailPath } = pendingImportToAdd.value;
      await importFileToProject(filePath, name, duration, thumbnailPath);
      pendingImportToAdd.value = null;
    }
  }

  // Handle promotion dialog cancel
  function onPromoteCancel() {
    showPromoteToProjectDialog.value = false;
    pendingSourceToAdd.value = null;
    pendingImportToAdd.value = null;
  }

  async function onDropSource(data: { source: SourceItem; position: number }) {
    const projectId = editorProjectId.value;
    if (!projectId) return;

    const duration = data.source.duration || 30;

    try {
      // Store the actual file path (not the HTTP URL)
      const newSource = await createVideoEditorSource(projectId, {
        sourceType: data.source.type,
        sourceId: data.source.id,
        sourcePath: data.source.path, // Store actual file path
        sourceName: data.source.name,
        sourceThumbnail: data.source.thumbnailPath,
        sourceDuration: duration,
        startTime: data.position,
        endTime: data.position + duration,
        trimStart: 0,
        trimEnd: null,
        orderIndex: videoSources.value.length,
      });

      videoSources.value.push(newSource);
      await recalculateProjectDuration(projectId);
      triggerAutoSave();
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to drop source:', error);
    }
  }

  async function updateVideoSource(sourceId: string, updates: Partial<VideoEditorSource>) {
    const source = videoSources.value.find((s) => s.id === sourceId);
    if (!source) return;

    try {
      await updateVideoEditorSource(sourceId, {
        start_time: updates.start_time,
        end_time: updates.end_time,
        trim_start: updates.trim_start,
        trim_end: updates.trim_end,
        order_index: updates.order_index,
      });

      Object.assign(source, updates);

      if (editorProjectId.value) {
        await recalculateProjectDuration(editorProjectId.value);
      }
      triggerAutoSave();
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to update source:', error);
    }
  }

  async function deleteVideoSource(sourceId: string) {
    try {
      await deleteVideoEditorSource(sourceId);
      videoSources.value = videoSources.value.filter((s) => s.id !== sourceId);

      // Repair order_index after deletion
      await repairSourceOrderIndex();

      if (editorProjectId.value) {
        await recalculateProjectDuration(editorProjectId.value);
      }
      triggerAutoSave();
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to delete source:', error);
    }
  }

  // Helper function to repair order_index values based on start_time
  // This ensures sources are always in the correct order for playback
  async function repairSourceOrderIndex() {
    if (videoSources.value.length === 0) return;

    console.log(
      '[repairSourceOrderIndex] Starting repair. Sources before:',
      videoSources.value.map((s) => ({
        id: s.id,
        name: s.source_name,
        order_index: s.order_index,
        start_time: s.start_time,
      }))
    );

    // Sort by start_time to get the correct playback order
    const sortedSources = [...videoSources.value].sort((a, b) => a.start_time - b.start_time);

    let repairCount = 0;
    for (let i = 0; i < sortedSources.length; i++) {
      if (sortedSources[i].order_index !== i) {
        console.log(
          `[repairSourceOrderIndex] Fixing ${sortedSources[i].source_name}: order_index ${sortedSources[i].order_index} → ${i}`
        );
        await updateVideoEditorSource(sortedSources[i].id, { order_index: i });
        sortedSources[i].order_index = i;
        repairCount++;
      }
    }

    // Always update the reactive array with the correctly ordered sources
    videoSources.value = sortedSources;

    console.log(
      '[repairSourceOrderIndex] Repair complete. Fixed:',
      repairCount,
      'Sources after:',
      videoSources.value.map((s) => ({
        id: s.id,
        name: s.source_name,
        order_index: s.order_index,
        start_time: s.start_time,
      }))
    );
  }

  async function splitVideoSource(sourceId: string, cutTimelinePosition: number, cutSourceTime: number) {
    const source = videoSources.value.find((s) => s.id === sourceId);
    if (!source || !editorProjectId.value) return;

    // Validate cut is within source bounds
    if (cutTimelinePosition <= source.start_time || cutTimelinePosition >= source.end_time) {
      console.warn('[ClipEditorDialog] Cut position is outside source bounds');
      return;
    }

    console.log('[splitVideoSource] Starting split:', {
      sourceId,
      cutTimelinePosition,
      cutSourceTime,
      originalSource: {
        start_time: source.start_time,
        end_time: source.end_time,
        trim_start: source.trim_start,
        trim_end: source.trim_end,
        order_index: source.order_index,
      },
    });

    try {
      // Store original values before modifying
      const originalEndTime = source.end_time;
      const originalOrderIndex = source.order_index;
      const originalTrimEnd = source.trim_end;

      // Calculate the effective trim_end that was being used
      // If trim_end is null, it means "play to end of source", but we need to know
      // what the actual end point was based on the timeline duration
      const originalTimelineDuration = source.end_time - source.start_time;
      const effectiveTrimEnd = originalTrimEnd ?? source.trim_start + originalTimelineDuration;

      console.log('[splitVideoSource] Calculated values:', {
        originalEndTime,
        originalOrderIndex,
        originalTrimEnd,
        effectiveTrimEnd,
      });

      // First, increment order_index for all sources that come after the split source
      // This makes room for the new right portion
      const sourcesAfter = videoSources.value.filter((s) => s.order_index > originalOrderIndex);
      console.log(
        '[splitVideoSource] Sources to shift:',
        sourcesAfter.map((s) => ({ id: s.id, order_index: s.order_index }))
      );

      for (const s of sourcesAfter) {
        await updateVideoEditorSource(s.id, {
          order_index: s.order_index + 1,
        });
      }

      // Update the original source to end at the cut point (left portion)
      await updateVideoEditorSource(sourceId, {
        end_time: cutTimelinePosition,
        trim_end: cutSourceTime,
      });

      console.log('[splitVideoSource] Updated left portion:', {
        id: sourceId,
        end_time: cutTimelinePosition,
        trim_end: cutSourceTime,
      });

      // Create a new source for the right portion
      // Use the effective trim_end (not the original null) to ensure correct duration
      const newSource = await createVideoEditorSource(editorProjectId.value, {
        sourceType: source.source_type,
        sourceId: source.source_id,
        sourcePath: source.source_path,
        sourceName: source.source_name ? `${source.source_name} (split)` : null,
        sourceThumbnail: source.source_thumbnail,
        sourceDuration: source.source_duration,
        startTime: cutTimelinePosition,
        endTime: originalEndTime,
        trimStart: cutSourceTime,
        trimEnd: effectiveTrimEnd,
        orderIndex: originalOrderIndex + 1,
      });

      console.log('[splitVideoSource] Created right portion:', {
        id: newSource.id,
        start_time: newSource.start_time,
        end_time: newSource.end_time,
        trim_start: newSource.trim_start,
        trim_end: newSource.trim_end,
        order_index: newSource.order_index,
      });

      // Reload sources to get the correct state
      const updatedSources = await getVideoEditorSourcesByProjectId(editorProjectId.value);
      videoSources.value = updatedSources;

      // Repair order_index to ensure correct playback order
      await repairSourceOrderIndex();

      // Log the final state of all sources
      console.log(
        '[splitVideoSource] Final sources after reload:',
        videoSources.value.map((s) => ({
          id: s.id,
          name: s.source_name,
          start_time: s.start_time,
          end_time: s.end_time,
          trim_start: s.trim_start,
          trim_end: s.trim_end,
          order_index: s.order_index,
        }))
      );

      if (editorProjectId.value) {
        await recalculateProjectDuration(editorProjectId.value);
      }
      triggerAutoSave();

      console.log(
        `[ClipEditorDialog] Split complete: ${sourceId} at timeline ${cutTimelinePosition.toFixed(2)}s, source time ${cutSourceTime.toFixed(2)}s`
      );
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to split source:', error);
    }
  }

  // Extended intro/outro type that may include org asset properties
  interface IntroOutroWithOrgProps extends IntroOutro {
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string;
  }

  // Intro/Outro handlers
  async function onAddIntro(intro: IntroOutroWithOrgProps) {
    // Ensure we're in editor mode - if not, promote first
    if (!editorMode.value) {
      // For clip mode, we need to promote to video project first
      await promoteToVideoProject();
    }

    const projectId = editorProjectId.value;
    if (!projectId) return;

    try {
      const introDuration = intro.duration || 5; // Default 5 seconds if duration unknown

      // Remove existing intro if there is one
      if (currentIntro.value) {
        await removeIntroSource(currentIntro.value.sourceId);
      }

      // Shift all existing sources forward by the intro duration
      for (const source of videoSources.value) {
        const newStartTime = source.start_time + introDuration;
        const newEndTime = source.end_time + introDuration;
        await updateVideoEditorSource(source.id, {
          start_time: newStartTime,
          end_time: newEndTime,
        });
        source.start_time = newStartTime;
        source.end_time = newEndTime;
      }

      // Also shift all audio tracks, text overlays, stickers, and watermarks
      await shiftAllTracksBy(introDuration);

      // Create the intro source at position 0
      const newSource = await createVideoEditorSource(projectId, {
        sourceType: 'imported',
        sourceId: intro.id, // Reference to intro_outro table
        sourcePath: intro.file_path,
        sourceName: `[Intro] ${intro.name}`,
        sourceThumbnail: intro.thumbnail_path,
        sourceDuration: introDuration,
        startTime: 0,
        endTime: introDuration,
        trimStart: 0,
        trimEnd: null,
        orderIndex: 0,
      });

      // Add the new source to the beginning of the array
      videoSources.value.unshift(newSource);

      // Repair order_index to ensure correct playback order
      await repairSourceOrderIndex();

      // Load thumbnail for the intro
      let thumbnailUrl: string | undefined;
      if (intro.thumbnail_path) {
        try {
          // For org assets, thumbnail_path is a URL, so use it directly
          if (intro.isOrgAsset) {
            thumbnailUrl = intro.thumbnail_path;
          } else {
            const exists = await invoke<boolean>('check_file_exists', { path: intro.thumbnail_path });
            if (exists) {
              thumbnailUrl = await invoke<string>('read_file_as_data_url', { filePath: intro.thumbnail_path });
            }
          }
        } catch (err) {
          console.warn('[ClipEditorDialog] Failed to load intro thumbnail:', err);
        }
      }

      // Track the current intro (including org asset properties for export)
      currentIntro.value = {
        id: intro.id,
        sourceId: newSource.id,
        name: intro.name,
        duration: intro.duration,
        filePath: intro.file_path,
        thumbnailUrl,
        // Include org asset properties for on-demand downloading during export
        isOrgAsset: intro.isOrgAsset,
        serverId: intro.serverId,
        serverUrl: intro.serverUrl,
        organization_id: intro.organization_id,
        organization_name: intro.organization_name,
        created_at: intro.created_at,
        updated_at: intro.updated_at,
      };

      await recalculateProjectDuration(projectId);
      triggerAutoSave();

      console.log('[ClipEditorDialog] Added intro:', intro.name, intro.isOrgAsset ? '(org asset)' : '');
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to add intro:', error);
    }
  }

  async function onAddOutro(outro: IntroOutroWithOrgProps) {
    // Ensure we're in editor mode - if not, promote first
    if (!editorMode.value) {
      await promoteToVideoProject();
    }

    const projectId = editorProjectId.value;
    if (!projectId) return;

    try {
      const outroDuration = outro.duration || 5; // Default 5 seconds if duration unknown

      // Remove existing outro if there is one
      if (currentOutro.value) {
        await removeOutroSource(currentOutro.value.sourceId);
      }

      // Find the end of the timeline (max end_time of all sources, excluding the old outro)
      const maxEndTime = videoSources.value.reduce((max, source) => {
        return Math.max(max, source.end_time);
      }, 0);

      // Create the outro source at the end
      const newSource = await createVideoEditorSource(projectId, {
        sourceType: 'imported',
        sourceId: outro.id, // Reference to intro_outro table
        sourcePath: outro.file_path,
        sourceName: `[Outro] ${outro.name}`,
        sourceThumbnail: outro.thumbnail_path,
        sourceDuration: outroDuration,
        startTime: maxEndTime,
        endTime: maxEndTime + outroDuration,
        trimStart: 0,
        trimEnd: null,
        orderIndex: videoSources.value.length,
      });

      videoSources.value.push(newSource);

      // Repair order_index to ensure correct playback order
      await repairSourceOrderIndex();

      // Load thumbnail for the outro
      let thumbnailUrl: string | undefined;
      if (outro.thumbnail_path) {
        try {
          // For org assets, thumbnail_path is a URL, so use it directly
          if (outro.isOrgAsset) {
            thumbnailUrl = outro.thumbnail_path;
          } else {
            const exists = await invoke<boolean>('check_file_exists', { path: outro.thumbnail_path });
            if (exists) {
              thumbnailUrl = await invoke<string>('read_file_as_data_url', { filePath: outro.thumbnail_path });
            }
          }
        } catch (err) {
          console.warn('[ClipEditorDialog] Failed to load outro thumbnail:', err);
        }
      }

      // Track the current outro (including org asset properties for export)
      currentOutro.value = {
        id: outro.id,
        sourceId: newSource.id,
        name: outro.name,
        duration: outro.duration,
        filePath: outro.file_path,
        thumbnailUrl,
        // Include org asset properties for on-demand downloading during export
        isOrgAsset: outro.isOrgAsset,
        serverId: outro.serverId,
        serverUrl: outro.serverUrl,
        organization_id: outro.organization_id,
        organization_name: outro.organization_name,
        created_at: outro.created_at,
        updated_at: outro.updated_at,
      };

      await recalculateProjectDuration(projectId);
      triggerAutoSave();

      console.log('[ClipEditorDialog] Added outro:', outro.name, outro.isOrgAsset ? '(org asset)' : '');
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to add outro:', error);
    }
  }

  async function onRemoveIntro() {
    if (!currentIntro.value) return;

    try {
      const introDuration = currentIntro.value.duration || 0;

      // Remove the intro source
      await removeIntroSource(currentIntro.value.sourceId);

      // Shift all remaining sources back by the intro duration
      for (const source of videoSources.value) {
        const newStartTime = Math.max(0, source.start_time - introDuration);
        const newEndTime = source.end_time - introDuration;
        await updateVideoEditorSource(source.id, {
          start_time: newStartTime,
          end_time: newEndTime,
        });
        source.start_time = newStartTime;
        source.end_time = newEndTime;
      }

      // Also shift all audio tracks, text overlays, stickers, and watermarks back
      await shiftAllTracksBy(-introDuration);

      // Repair order_index to ensure correct playback order
      await repairSourceOrderIndex();

      currentIntro.value = null;

      if (editorProjectId.value) {
        await recalculateProjectDuration(editorProjectId.value);
      }
      triggerAutoSave();

      console.log('[ClipEditorDialog] Removed intro');
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to remove intro:', error);
    }
  }

  async function onRemoveOutro() {
    if (!currentOutro.value) return;

    try {
      // Remove the outro source
      await removeOutroSource(currentOutro.value.sourceId);

      // Repair order_index to ensure correct playback order
      await repairSourceOrderIndex();

      currentOutro.value = null;

      if (editorProjectId.value) {
        await recalculateProjectDuration(editorProjectId.value);
      }
      triggerAutoSave();

      console.log('[ClipEditorDialog] Removed outro');
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to remove outro:', error);
    }
  }

  // Helper to remove intro source from timeline
  async function removeIntroSource(sourceId: string) {
    await deleteVideoEditorSource(sourceId);
    videoSources.value = videoSources.value.filter((s) => s.id !== sourceId);
  }

  // Helper to remove outro source from timeline
  async function removeOutroSource(sourceId: string) {
    await deleteVideoEditorSource(sourceId);
    videoSources.value = videoSources.value.filter((s) => s.id !== sourceId);
  }

  // Helper to shift all tracks (audio, text, stickers, watermarks) by a time offset
  async function shiftAllTracksBy(offsetSeconds: number) {
    const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
    if (!editId) return;

    // Shift audio tracks
    for (const track of audioTracks.value) {
      const newStartTime = Math.max(0, track.startTime + offsetSeconds);
      const newEndTime = track.endTime + offsetSeconds;
      await updateAudioTrackLocal(track.id, {
        startTime: newStartTime,
        endTime: newEndTime,
      });
    }

    // Shift text overlays
    for (const overlay of textOverlays.value) {
      const newStartTime = Math.max(0, overlay.startTime + offsetSeconds);
      const newEndTime = overlay.endTime + offsetSeconds;
      await updateTextOverlayLocal(overlay.id, {
        startTime: newStartTime,
        endTime: newEndTime,
      });
    }

    // Shift stickers
    for (const sticker of stickers.value) {
      const newStartTime = Math.max(0, sticker.startTime + offsetSeconds);
      const newEndTime = sticker.endTime + offsetSeconds;
      await updateStickerLocal(sticker.id, {
        startTime: newStartTime,
        endTime: newEndTime,
      });
    }

    // Shift watermarks
    for (const watermark of watermarks.value) {
      const newStartTime = Math.max(0, watermark.startTime + offsetSeconds);
      const newEndTime = watermark.endTime + offsetSeconds;
      await updateWatermarkLocal(watermark.id, {
        startTime: newStartTime,
        endTime: newEndTime,
      });
    }

    // Shift filter segments
    for (const segment of filterSegments.value) {
      segment.startTime = Math.max(0, segment.startTime + offsetSeconds);
      segment.endTime = segment.endTime + offsetSeconds;
    }
  }

  async function loadEditorProject() {
    const projectId = editorProjectId.value;
    if (!projectId) return;

    try {
      // Get video server port for constructing video URLs
      videoServerPort.value = await invoke<number>('get_video_server_port');

      const sources = await getVideoEditorSourcesByProjectId(projectId);
      videoSources.value = sources;

      // Repair order_index if there are collisions (from previous buggy splits)
      await repairSourceOrderIndex();

      // Initialize current source tracking with the first source
      if (videoSources.value.length > 0) {
        // Find the source at time 0 (which we'll initialize previewTime to)
        const initialSource = videoSources.value.find((s) => 0 >= s.start_time && 0 < s.end_time);
        currentVideoSourceId.value = initialSource?.id || videoSources.value[0].id;
      }

      // Create/get an edit record for the video editor project
      // Uses the dedicated video_editor_edits table (not clip_edits)
      const editRecord = await getOrCreateVideoEditorEdit(projectId);
      videoEditorEditId.value = editRecord.id;

      // Load existing edit data for the video editor project
      const fullEdit = await getFullVideoEditorEdit(projectId);
      if (fullEdit) {
        const editData = JSON.parse(fullEdit.edit.edit_data);

        // Load filter segments
        if (editData.filterSegments && Array.isArray(editData.filterSegments)) {
          filterSegments.value = editData.filterSegments;
        }

        // Load audio volume settings
        if (editData.originalDb !== undefined) {
          originalDb.value = editData.originalDb;
        }
        if (editData.trackDbValues) {
          trackDbValues.value = editData.trackDbValues;
        }

        // Load audio tracks
        audioTracks.value = fullEdit.audioTracks.map((t) => ({
          id: t.id,
          filePath: t.file_path,
          name: t.name,
          startTime: t.start_time,
          endTime: t.end_time,
          volume: t.volume,
          fadeIn: t.fade_in,
          fadeOut: t.fade_out,
          trackOrder: t.track_order,
          isMuted: !!t.is_muted,
          isSolo: !!t.is_solo,
        }));

        // Load text overlays
        textOverlays.value = fullEdit.textOverlays.map((o) => ({
          id: o.id,
          text: o.text,
          startTime: o.start_time,
          endTime: o.end_time,
          position: { x: o.position_x, y: o.position_y },
          style: JSON.parse(o.style_data || '{}'),
          animation: (o as any).animation || 'none',
          perRatioConfigs: o.per_ratio_configs_data ? JSON.parse(o.per_ratio_configs_data) : undefined,
        }));

        // Load stickers
        stickers.value = fullEdit.stickers.map((s) => ({
          id: s.id,
          stickerPath: s.sticker_path,
          stickerType: s.sticker_type as 'emoji' | 'image' | 'gif',
          startTime: s.start_time,
          endTime: s.end_time,
          position: { x: s.position_x, y: s.position_y },
          scale: s.scale,
          rotation: s.rotation,
          animation: (s as any).animation || 'none',
          perRatioConfigs: s.per_ratio_configs_data ? JSON.parse(s.per_ratio_configs_data) : undefined,
        }));

        // Load watermarks - convert file paths to data URLs for preview
        watermarks.value = await Promise.all(
          fullEdit.watermarks.map(async (w) => {
            // Convert file path to data URL for preview display
            let previewUrl = w.preview_url;
            if (!previewUrl && w.watermark_path) {
              try {
                previewUrl = await invoke<string>('read_file_as_data_url', {
                  filePath: w.watermark_path,
                });
              } catch (err) {
                console.warn('[ClipEditorDialog] Failed to load watermark preview:', w.id, err);
                // Use a fallback placeholder
                previewUrl =
                  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjNzg1MDAwIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjUwIiByPSIyMCIgZmlsbD0iI0Y1OUUwQiIvPgo8dGV4dCB4PSIxMDAiIHk9Ijk1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiNGRkZGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPldhdGVybWFyazwvdGV4dD4KPC9zdmc+';
              }
            }

            return {
              id: w.id,
              watermarkId: w.watermark_id,
              filePath: w.watermark_path, // Actual file path for export
              previewUrl: previewUrl || w.watermark_path, // Data URL for display
              startTime: w.start_time,
              endTime: w.end_time,
              position: { x: w.position_x, y: w.position_y },
              scale: w.scale,
              opacity: w.opacity,
              perRatioConfigs: w.per_ratio_configs_data ? JSON.parse(w.per_ratio_configs_data) : undefined,
            };
          })
        );

        // Load creator profile watermark if one exists for this project
        // Note: projectId here is editorProjectId (video_editor_projects.id), not projects.id
        // We need to find the actual project ID from a video source
        console.log('[ClipEditorDialog] Checking for creator profile watermark (editor mode)');
        try {
          // Find a source with a source_id (clip or raw_video reference)
          const sourceWithId = videoSources.value.find(
            (s) => s.source_id && (s.source_type === 'clip' || s.source_type === 'raw_video')
          );

          let actualProjectId: string | null = null;
          if (sourceWithId?.source_id) {
            try {
              if (sourceWithId.source_type === 'clip') {
                const clip = await getClipWithBuildStatus(sourceWithId.source_id);
                actualProjectId = clip?.project_id || null;
              } else if (sourceWithId.source_type === 'raw_video') {
                const rawVideo = await getRawVideo(sourceWithId.source_id);
                actualProjectId = rawVideo?.project_id || null;
              }
            } catch (err) {
              console.warn('[ClipEditorDialog] Failed to get project ID from source:', err);
            }
          }

          console.log('[ClipEditorDialog] Actual project ID (editor mode):', actualProjectId);

          if (actualProjectId) {
            const { getCreatorProfileByProjectId } = await import('@/services/database');
            const creatorProfile = await getCreatorProfileByProjectId(actualProjectId);
            console.log('[ClipEditorDialog] Creator profile found (editor mode):', creatorProfile ? 'YES' : 'NO');

            if (creatorProfile && creatorProfile.watermark_settings) {
              console.log('[ClipEditorDialog] Watermark settings (editor mode):', creatorProfile.watermark_settings);
              const watermarkSettings = JSON.parse(creatorProfile.watermark_settings);

              // Check if this creator watermark is already in the list
              const hasCreatorWatermark = watermarks.value.some((w) => w.watermarkId === creatorProfile.watermark_id);

              if (!hasCreatorWatermark && watermarkSettings.watermarkPath) {
                console.log('[ClipEditorDialog] Adding creator profile watermark (editor mode)');
                console.log('[ClipEditorDialog] Watermark path (editor mode):', watermarkSettings.watermarkPath);
                console.log('[ClipEditorDialog] Current watermarks count (editor mode):', watermarks.value.length);

                // Load watermark preview
                let previewUrl = watermarkSettings.watermarkPath;
                try {
                  previewUrl = await invoke<string>('read_file_as_data_url', {
                    filePath: watermarkSettings.watermarkPath,
                  });
                } catch (err) {
                  console.warn('[ClipEditorDialog] Failed to load creator watermark preview:', err);
                }

                // Add creator watermark to the list
                watermarks.value.push({
                  id: `creator-watermark-${creatorProfile.id}`,
                  watermarkId: creatorProfile.watermark_id || undefined,
                  filePath: watermarkSettings.watermarkPath,
                  previewUrl: previewUrl,
                  startTime: 0,
                  endTime: 999999, // Show throughout entire video
                  position: {
                    x: watermarkSettings.position?.x ?? 0.9,
                    y: watermarkSettings.position?.y ?? 0.9,
                  },
                  scale: watermarkSettings.scale ?? 0.15,
                  opacity: watermarkSettings.opacity ?? 1.0,
                  perRatioConfigs: watermarkSettings.perRatioConfigs,
                });
              }
            }
          }
        } catch (error) {
          console.warn('[ClipEditorDialog] Failed to load creator profile watermark:', error);
        }

        // Set up audio elements for existing tracks
        for (const track of audioTracks.value) {
          if (!audioElements.value.has(track.id)) {
            await setupAudioElement(track);
          }
        }
      }

      // Generate thumbnail for the first source (for ManualPOIEditor preview)
      if (sources.length > 0) {
        const firstSource = sources[0];
        if (firstSource.source_path) {
          try {
            const thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
              videoPath: firstSource.source_path,
              timestampSeconds: firstSource.trim_start + 1,
              outputFilename: `editor_aspect_preview_${editorProjectId.value}`,
            });

            const dataUrl = await invoke<string>('read_file_as_data_url', {
              filePath: thumbnailPath,
            });

            editorThumbnailUrl.value = dataUrl;
          } catch (err) {
            console.warn('[ClipEditorDialog] Failed to generate editor thumbnail:', err);
          }
        }
      }
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to load editor project:', error);
    }
  }

  function onVideoElementReady(element: HTMLVideoElement) {
    console.log(
      '[onVideoElementReady] Called with element src:',
      element?.src?.slice(-30),
      'element.paused:',
      element?.paused,
      'previous videoElement src:',
      videoElement.value?.src?.slice(-30)
    );
    videoElement.value = element;

    const updateDimensions = () => {
      if (element.videoWidth && element.videoHeight) {
        videoDimensions.value = { width: element.videoWidth, height: element.videoHeight };
        console.log('[onVideoElementReady] Updated videoDimensions:', videoDimensions.value);
      }
    };

    if (element.videoWidth && element.videoHeight) {
      updateDimensions();
    } else {
      console.log('[onVideoElementReady] Video dimensions not ready, waiting for loadedmetadata');
      element.addEventListener('loadedmetadata', updateDimensions, { once: true });
    }

    // In editor mode, track the current source
    // But don't update during crossfade - the crossfade logic handles source tracking
    if (editorMode.value && !crossfadeStarted.value && !activeTransition.value) {
      if (activeVideoSource.value) {
        currentVideoSourceId.value = activeVideoSource.value.id;
      }
    }
  }

  // Called when the preview component successfully swapped to the preloaded video
  function onVideoSwapped() {
    console.log(
      '[onVideoSwapped] Called. crossfadeStarted:',
      crossfadeStarted.value,
      'lastCrossfadeTransitionId:',
      lastCrossfadeTransitionId.value,
      'currentVideoSourceId:',
      currentVideoSourceId.value
    );

    // CRITICAL: Update videoElement to point to the now-active preload video
    // This ensures play/pause controls work after crossfade
    const preloadEl = previewRef.value?.getPreloadVideoElement?.();
    if (preloadEl) {
      videoElement.value = preloadEl;
      console.log('[onVideoSwapped] Updated videoElement to preload video');
    }

    // The preload video is now the main video
    // Reset the preview component's active video index for the next swap cycle
    // This will happen when the user finishes with this source and moves to the next
    hideTransitionFrame();

    // Update source tracking to the incoming source (source B)
    const incomingSource = transitionIncomingSource.value;
    console.log('[onVideoSwapped] incomingSource:', incomingSource?.id);
    if (incomingSource) {
      currentVideoSourceId.value = incomingSource.id;
      console.log('[onVideoSwapped] Updated currentVideoSourceId to:', incomingSource.id);
    } else {
      // Fallback: find next source by order
      const sortedSources = [...videoSources.value].sort((a, b) => a.order_index - b.order_index);
      const currentIdx = sortedSources.findIndex((s) => s.id === currentVideoSourceId.value);

      // Debug: log all sources and their order
      console.log(
        '[onVideoSwapped] Fallback - All sources:',
        sortedSources.map((s) => ({
          id: s.id,
          name: s.source_name,
          order_index: s.order_index,
          start_time: s.start_time,
          end_time: s.end_time,
        }))
      );
      console.log(
        '[onVideoSwapped] Fallback - currentIdx:',
        currentIdx,
        'currentVideoSourceId:',
        currentVideoSourceId.value
      );

      if (currentIdx >= 0 && currentIdx < sortedSources.length - 1) {
        const nextSource = sortedSources[currentIdx + 1];
        console.log(
          '[onVideoSwapped] Fallback - Next source:',
          nextSource.id,
          nextSource.source_name,
          'order_index:',
          nextSource.order_index
        );
        currentVideoSourceId.value = nextSource.id;
        console.log('[onVideoSwapped] Fallback: Updated currentVideoSourceId to:', nextSource.id);
      }
    }

    // IMPORTANT: Keep crossfadeStarted and lastCrossfadeTransitionId set
    // so manageCrossfade doesn't try to re-start the crossfade
    // They will be reset when we exit the transition zone naturally
    // crossfadeStarted.value = false;
    // lastCrossfadeTransitionId.value = null;
  }

  // Called when crossfade completes early (e.g., main video media ended before transition zone end)
  // This syncs the timeline playhead with the visual state
  function onCrossfadeCompleted(transitionEndTime: number) {
    console.log('[onCrossfadeCompleted] Crossfade completed early, jumping to:', transitionEndTime);

    // CRITICAL: Update videoElement to point to the now-active preload video
    // This ensures play/pause controls work after crossfade
    const preloadEl = previewRef.value?.getPreloadVideoElement?.();
    if (preloadEl) {
      videoElement.value = preloadEl;
      console.log('[onCrossfadeCompleted] Updated videoElement to preload video');
    }

    // Update preview time to the end of the transition
    // This ensures the timeline playhead matches the visual state
    previewTime.value = transitionEndTime;

    // Clear crossfade state
    crossfadeStarted.value = false;
    // Don't clear lastCrossfadeTransitionId - keep it so we don't re-enter this transition
  }

  // Handle transitions detected from the timeline
  function onTransitionsDetected(transitions: VideoEditorTransition[]) {
    sourceTransitions.value = transitions;
  }

  // Manage crossfade audio (fade volumes during transition)
  function updateCrossfadeAudio() {
    if (!editorMode.value || !activeTransition.value || !videoElement.value) return;

    const transition = activeTransition.value;
    const { opacityA, opacityB } = calculateCrossfadeOpacity(previewTime.value, transition);

    // Apply opacity as volume to outgoing source video (main video)
    // Note: The main video is still the current activeVideoSource
    videoElement.value.volume = opacityA;

    // Apply opacity as volume to incoming source video (preload video)
    const preloadEl = previewRef.value?.getPreloadVideoElement?.();
    if (preloadEl) {
      preloadEl.volume = opacityB;
    }
  }

  // Start crossfade when entering a transition zone
  function manageCrossfade() {
    if (!editorMode.value || !previewRef.value || !isPlaying.value) return;

    const transition = activeTransition.value;

    if (transition) {
      // We're in a transition zone
      // Only start if crossfade is not already in progress AND we haven't already completed this transition
      // Using AND (&&) instead of OR (||) prevents restarting after completion when time maps back into zone
      if (!crossfadeStarted.value && lastCrossfadeTransitionId.value !== transition.id) {
        // Start the crossfade - both videos need to play
        const incomingSource = transitionIncomingSource.value;
        console.log('[manageCrossfade] Starting crossfade:', {
          incomingSourceId: incomingSource?.id,
          transitionStartTime: transition.startTime,
          transitionEndTime: transition.endTime,
        });
        if (incomingSource) {
          // Calculate the seek time in the incoming source
          const timeIntoTransition = previewTime.value - transition.startTime;
          const seekTime = incomingSource.trim_start + timeIntoTransition;

          console.log(
            '[manageCrossfade] Calling startCrossfade with seekTime:',
            seekTime,
            'timeIntoTransition:',
            timeIntoTransition
          );

          // Try to start crossfade (will work even if preload isn't fully ready)
          if (previewRef.value.startCrossfade?.(seekTime)) {
            crossfadeStarted.value = true;
            lastCrossfadeTransitionId.value = transition.id;
            console.log('[manageCrossfade] Crossfade started successfully');
          } else {
            console.log('[manageCrossfade] startCrossfade returned false');
          }
        }
      } else if (crossfadeStarted.value) {
        console.log('[manageCrossfade] Crossfade already in progress, updating audio');
      } else {
        // lastCrossfadeTransitionId matches - we've already completed this transition
        // Don't restart, just skip
        console.log('[manageCrossfade] Transition already completed, skipping');
      }

      // Update audio levels during crossfade
      updateCrossfadeAudio();
    } else if (crossfadeStarted.value) {
      // We've exited the transition zone - complete the crossfade
      console.log('[manageCrossfade] Exited transition zone, completing crossfade. previewTime:', previewTime.value);
      if (previewRef.value.completeCrossfade) {
        previewRef.value.completeCrossfade();
      }

      // Update state to reflect we're now on the incoming source
      // Find the source that contains the current time (should be source B now)
      const newActiveSource = videoSources.value.find(
        (s) => previewTime.value >= s.start_time && previewTime.value < s.end_time
      );
      if (newActiveSource) {
        console.log('[manageCrossfade] Updating currentVideoSourceId to:', newActiveSource.id);
        currentVideoSourceId.value = newActiveSource.id;
      }

      // Update videoElement to point to the new active video (preload video)
      const preloadEl = previewRef.value?.getPreloadVideoElement?.();
      if (preloadEl) {
        videoElement.value = preloadEl;
      }

      crossfadeStarted.value = false;
      // IMPORTANT: Keep lastCrossfadeTransitionId set so we don't restart the same transition
      // when preload video's time maps back into the transition zone
      // It will be reset when user seeks or when a different transition starts
      // lastCrossfadeTransitionId.value = null;

      // Reset video volume to normal on the new active video
      if (videoElement.value) {
        videoElement.value.volume = 1;
      }
    }
  }

  function onPreviewTimeUpdate(time: number) {
    // Ignore time updates while seeking to prevent feedback loops
    if (isSeeking.value) {
      console.log('[onPreviewTimeUpdate] Ignoring - isSeeking is true');
      return;
    }

    if (editorMode.value) {
      // In editor mode, time is the video element's currentTime (position within source file)
      // We need to track which source this time belongs to

      // Determine which source the time update is coming from
      // During/after crossfade, videoElement might point to the preload video (source B)
      // So we need to use currentVideoSourceId as the source of truth
      let source = currentVideoSourceId.value
        ? videoSources.value.find((s) => s.id === currentVideoSourceId.value)
        : null;

      // If no tracked source or during transition, figure out the source from time
      if (!source) {
        const sortedSources = [...videoSources.value].sort((a, b) => a.start_time - b.start_time);
        source =
          sortedSources.find((s) => {
            const effectiveEnd = s.trim_end ?? s.trim_start + (s.end_time - s.start_time);
            return time >= s.trim_start && time < effectiveEnd;
          }) || null;
      }

      if (source) {
        // Map video time back to global timeline position
        // The video position includes trim_start, so subtract it to get relative position
        const relativeInSource = time - source.trim_start;
        // Add the source's start time to get global timeline position
        const newTime = source.start_time + relativeInSource;

        // Update current source tracking - but NOT during active crossfade
        // During crossfade, source tracking is managed by manageCrossfade and onVideoSwapped
        if (currentVideoSourceId.value !== source.id && !crossfadeStarted.value && !activeTransition.value) {
          currentVideoSourceId.value = source.id;
        }

        // Check if we've reached the trim_end of this source
        // Only trigger end if we're NOT in an active crossfade transition
        // trim_end is the position in the source video where we should stop
        // If trim_end is null, calculate effective end from timeline duration
        const effectiveTrimEnd = source.trim_end ?? source.trim_start + (source.end_time - source.start_time);

        // Log occasionally to debug trim_end issues (every ~2 seconds)
        if (Math.floor(time * 10) % 20 === 0) {
          console.log('[onPreviewTimeUpdate] Trim check:', {
            videoTime: time.toFixed(2),
            sourceId: source.id,
            trim_start: source.trim_start,
            trim_end: source.trim_end,
            effectiveTrimEnd: effectiveTrimEnd.toFixed(2),
            wouldTriggerEnd: time >= effectiveTrimEnd,
          });
        }

        if (time >= effectiveTrimEnd && isPlaying.value && !activeTransition.value && !crossfadeStarted.value) {
          // We've reached the end of this source's trimmed region
          // Trigger transition to next source
          console.log(
            '[onPreviewTimeUpdate] Triggering onVideoEnded at time:',
            time.toFixed(2),
            'effectiveTrimEnd:',
            effectiveTrimEnd.toFixed(2)
          );
          onVideoEnded();
          return;
        }

        // Only update if the difference is significant (prevents tiny fluctuations)
        if (Math.abs(newTime - previewTime.value) > 0.05) {
          previewTime.value = newTime;
        }

        // Manage crossfade transitions during playback (only if still in crossfade mode)
        if (crossfadeStarted.value || activeTransition.value) {
          manageCrossfade();
        }
      } else {
        console.log('[onPreviewTimeUpdate] No source found for time:', time);
      }
    } else {
      previewTime.value = time;
    }
    // Sync audio tracks with video
    if (isPlaying.value) {
      syncAudioWithVideo();
    }
  }

  function onVideoEnded() {
    console.log(
      '[onVideoEnded] Called. crossfadeStarted:',
      crossfadeStarted.value,
      'activeTransition:',
      !!activeTransition.value,
      'currentVideoSourceId:',
      currentVideoSourceId.value,
      'previewTime:',
      previewTime.value
    );

    if (!editorMode.value) return;

    // If we're currently in a crossfade transition (or just started one), complete it
    // The outgoing video has reached its end during the crossfade
    // Check crossfadeStarted OR if we're in/near a transition zone
    if (crossfadeStarted.value || activeTransition.value) {
      console.log('[onVideoEnded] Handling crossfade completion');
      // Complete the crossfade transition
      if (previewRef.value?.completeCrossfade) {
        previewRef.value.completeCrossfade();
      }

      // Update state to reflect we're now on the incoming source
      // Find the incoming source - either from the transition or the next source by order
      let incomingSource = transitionIncomingSource.value;
      console.log('[onVideoEnded] incomingSource from transition:', incomingSource?.id);
      if (!incomingSource) {
        // Fallback: find the next source in order
        const sortedSources = [...videoSources.value].sort((a, b) => a.order_index - b.order_index);
        const currentIdx = sortedSources.findIndex((s) => s.id === currentVideoSourceId.value);
        if (currentIdx >= 0 && currentIdx < sortedSources.length - 1) {
          incomingSource = sortedSources[currentIdx + 1];
          console.log('[onVideoEnded] Fallback incomingSource:', incomingSource?.id);
        }
      }

      if (incomingSource) {
        console.log('[onVideoEnded] Updating currentVideoSourceId to:', incomingSource.id);
        currentVideoSourceId.value = incomingSource.id;
        // Update videoElement to the new active element (preload video)
        const preloadEl = previewRef.value?.getPreloadVideoElement?.();
        if (preloadEl) {
          videoElement.value = preloadEl;
          console.log('[onVideoEnded] Updated videoElement to preload');
          // Ensure the preload video is playing
          if (preloadEl.paused && isPlaying.value) {
            console.log('[onVideoEnded] Starting preload playback');
            preloadEl.play().catch(() => {});
          }
        }
      }

      // IMPORTANT: Keep crossfadeStarted and lastCrossfadeTransitionId set
      // so manageCrossfade doesn't try to re-start the crossfade
      // They will be reset when we exit the transition zone naturally
      // crossfadeStarted.value = false;
      // lastCrossfadeTransitionId.value = null;

      // Reset video volume to normal
      if (videoElement.value) {
        videoElement.value.volume = 1;
      }
      return;
    }

    // Find the current source and the next one
    const currentSource = activeVideoSource.value;
    if (!currentSource) {
      isPlaying.value = false;
      return;
    }

    // Sort sources by order_index to find the next source
    const sortedSources = [...videoSources.value].sort((a, b) => a.order_index - b.order_index);
    const currentIndex = sortedSources.findIndex((s) => s.id === currentSource.id);
    const nextSource = sortedSources[currentIndex + 1];

    if (nextSource) {
      isSeeking.value = true;

      // Check which video is currently active (main or preload)
      const isMainActive = previewRef.value?.isMainVideoActive?.() ?? true;

      if (isMainActive) {
        // Main video is active, try to swap to preloaded video (normal case)
        const swapSucceeded = previewRef.value?.swapToPreloadedVideo?.(nextSource.trim_start);

        if (swapSucceeded) {
          // Seamless swap succeeded - update our state to match
          previewTime.value = nextSource.start_time;
          currentVideoSourceId.value = nextSource.id;

          // Clear seeking flag after a short delay
          setTimeout(() => {
            isSeeking.value = false;
          }, 50);
        } else {
          // Fallback: capture frame and switch src the traditional way
          captureTransitionFrame();

          // Update timeline position to trigger the source switch
          previewTime.value = nextSource.start_time;
          currentVideoSourceId.value = nextSource.id;
          pendingSeekTime.value = nextSource.trim_start;

          // The video src will change via reactivity, and once loaded, it will seek and play
          // The transition frame will be hidden in onVideoLoaded
        }
      } else {
        // Preload video is active (after a previous swap), need to swap back to main
        console.log('[onVideoEnded] Preload is active, swapping back to main for source:', nextSource.id);

        // IMPORTANT: Reset activeVideoIndex FIRST before changing currentVideoSourceId
        // This ensures the editorVideoSrc watch doesn't skip loading the new source
        previewRef.value?.resetActiveVideo?.();

        // Now update state - this will trigger editorVideoSrc to change and load the new source
        previewTime.value = nextSource.start_time;
        currentVideoSourceId.value = nextSource.id;
        pendingSeekTime.value = nextSource.trim_start;

        // The main video will load the new source via reactivity
        // onVideoLoaded will seek to pendingSeekTime and start playback
        console.log(
          '[onVideoEnded] Set pendingSeekTime to:',
          nextSource.trim_start,
          'for source:',
          nextSource.source_name
        );
      }
    } else {
      // No more sources, stop playback and go back to beginning
      isPlaying.value = false;

      // Actually pause the video element to stop playback
      if (videoElement.value) {
        videoElement.value.pause();
      }
      // Also pause any preload video that might be active
      const preloadEl = previewRef.value?.getPreloadVideoElement?.();
      if (preloadEl) {
        preloadEl.pause();
      }
      // Pause audio tracks
      audioElements.value.forEach((audio) => audio.pause());

      // Reset to main video if preload was active
      if (!previewRef.value?.isMainVideoActive?.()) {
        previewRef.value?.resetActiveVideo?.();
      }

      if (sortedSources.length > 0) {
        // Reset to the beginning of the first source
        previewTime.value = sortedSources[0].start_time;
        currentVideoSourceId.value = sortedSources[0].id;
      }
    }
  }

  function togglePlay() {
    // Get the currently active video element - prefer preload if active after crossfade
    const preloadEl = previewRef.value?.getPreloadVideoElement?.();
    const activePreloadIndex = previewRef.value?.activeVideoIndex;

    // Determine which video is actually active
    let activeVideo = videoElement.value;
    if (editorMode.value && activePreloadIndex === 1 && preloadEl) {
      // Preload is the active video after crossfade
      activeVideo = preloadEl;
      // Also update videoElement if it's out of sync
      if (videoElement.value !== preloadEl) {
        console.log('[togglePlay] Updating videoElement to match active preload');
        videoElement.value = preloadEl;
      }
    }

    console.log(
      '[togglePlay] Called.',
      'activeVideo:',
      !!activeVideo,
      'isPlaying:',
      isPlaying.value,
      'activeVideo.paused:',
      activeVideo?.paused,
      'activeVideo.src:',
      activeVideo?.src?.slice(-30),
      'activePreloadIndex:',
      activePreloadIndex
    );

    if (activeVideo) {
      // Sync isPlaying state with actual video state first
      // This handles cases where the video state got out of sync (e.g., after crossfade)
      const actuallyPlaying = !activeVideo.paused;
      if (isPlaying.value !== actuallyPlaying) {
        console.log('[togglePlay] Syncing isPlaying state from', isPlaying.value, 'to', actuallyPlaying);
        isPlaying.value = actuallyPlaying;
      }

      if (isPlaying.value) {
        console.log('[togglePlay] Pausing video');
        activeVideo.pause();
        // Pause all audio tracks
        audioElements.value.forEach((audio) => audio.pause());
      } else {
        console.log('[togglePlay] Playing video');
        activeVideo.play().catch((err) => {
          console.error('[togglePlay] Play failed:', err);
        });
        // Resume audio context if suspended
        if (audioContext.value?.state === 'suspended') {
          audioContext.value.resume();
        }
        // Start audio tracks playback
        syncAudioWithVideo();
      }
      isPlaying.value = !isPlaying.value;
      console.log('[togglePlay] isPlaying is now:', isPlaying.value);
    } else {
      console.log('[togglePlay] No activeVideo!');
    }
  }

  function seekTo(time: number) {
    if (editorMode.value) {
      // Editor mode: time is already the global timeline position
      isSeeking.value = true;
      previewTime.value = time;

      // Reset crossfade state when seeking
      crossfadeStarted.value = false;
      lastCrossfadeTransitionId.value = null;

      // Find the source that contains this time
      // Sort sources to handle overlaps consistently (prefer earlier source)
      const sortedSources = [...videoSources.value].sort((a, b) => a.start_time - b.start_time);
      const targetSource = sortedSources.find((s) => time >= s.start_time && time < s.end_time);

      if (targetSource) {
        // Calculate the position within the source video
        // Account for trim_start: the offset into the source video
        const timeInSource = time - targetSource.start_time + targetSource.trim_start;

        // Check if we need to switch video sources
        if (currentVideoSourceId.value !== targetSource.id) {
          // Different source - update the source ID and reset video state
          const oldSourceId = currentVideoSourceId.value;
          const oldSource = oldSourceId ? videoSources.value.find((s) => s.id === oldSourceId) : null;
          const wasPlaying = isPlaying.value;

          // Pause playback while switching sources to prevent the old video from continuing
          if (videoElement.value && !videoElement.value.paused) {
            videoElement.value.pause();
          }

          currentVideoSourceId.value = targetSource.id;
          pendingSeekTime.value = timeInSource;

          // Reset preview component to use main video (in case we were using preload after crossfade)
          if (previewRef.value?.resetActiveVideo) {
            previewRef.value.resetActiveVideo();
          }

          // Check if both sources use the same video file
          // If so, the editorVideoSrc won't change and the watch won't fire
          const sameVideoFile = oldSource && oldSource.source_path === targetSource.source_path;

          // Calculate the target video URL
          const targetVideoUrl = (() => {
            const path = targetSource.source_path;
            if (path.startsWith('http://') || path.startsWith('https://')) return path;
            if (!videoServerPort.value) return null;
            const encodedPath = btoa(unescape(encodeURIComponent(path)));
            return `http://localhost:${videoServerPort.value}/video/${encodedPath}`;
          })();

          // Check if the video element already has the correct src loaded
          // After resetActiveVideo, videoElement.value points to main video
          // which might have a stale src from before a crossfade
          const videoHasCorrectSrc = videoElement.value && targetVideoUrl && videoElement.value.src === targetVideoUrl;

          if (videoHasCorrectSrc && videoElement.value) {
            // Video already has the correct src - just seek directly
            console.log('[seekTo] Video already has correct src, seeking directly to:', timeInSource);
            videoElement.value.currentTime = timeInSource;
            pendingSeekTime.value = null;

            // Resume playback if it was playing before
            if (wasPlaying) {
              videoElement.value.play().catch(() => {});
            }

            setTimeout(() => {
              isSeeking.value = false;
            }, 50);
          } else if (sameVideoFile && videoElement.value && targetVideoUrl) {
            // Same video file but main video has wrong src (e.g., after crossfade from different source)
            // Need to manually update the src since the watch won't fire (same URL computed)
            console.log('[seekTo] Same video file but wrong src loaded, loading correct src');

            const handleSameFileLoad = () => {
              if (videoElement.value) {
                videoElement.value.removeEventListener('loadeddata', handleSameFileLoad);
                videoElement.value.removeEventListener('canplay', handleSameFileLoad);
                videoElement.value.currentTime = timeInSource;
                pendingSeekTime.value = null;

                if (wasPlaying) {
                  videoElement.value.play().catch(() => {});
                }

                setTimeout(() => {
                  isSeeking.value = false;
                }, 50);
              }
            };

            videoElement.value.addEventListener('loadeddata', handleSameFileLoad);
            videoElement.value.addEventListener('canplay', handleSameFileLoad);
            videoElement.value.src = targetVideoUrl;
            videoElement.value.load();

            // Fallback timeout
            setTimeout(() => {
              if (isSeeking.value && videoElement.value) {
                videoElement.value.removeEventListener('loadeddata', handleSameFileLoad);
                videoElement.value.removeEventListener('canplay', handleSameFileLoad);
                console.warn('[seekTo] Same file load timeout - applying seek directly');
                videoElement.value.currentTime = timeInSource;
                pendingSeekTime.value = null;
                isSeeking.value = false;
                if (wasPlaying) {
                  videoElement.value.play().catch(() => {});
                }
              }
            }, 2000);
          } else {
            // Different video file - the watch on editorVideoSrc will handle the source change
            // Add a safety timeout in case the watch fails to complete
            setTimeout(() => {
              if (isSeeking.value && pendingSeekTime.value !== null && videoElement.value) {
                console.warn('[seekTo] Safety timeout - applying pending seek directly');
                videoElement.value.currentTime = pendingSeekTime.value;
                pendingSeekTime.value = null;
                isSeeking.value = false;

                // Resume playback if it was playing
                if (isPlaying.value) {
                  videoElement.value.play().catch(() => {});
                }
              }
            }, 3000);
          }
        } else if (videoElement.value) {
          // Same source - seek directly
          videoElement.value.currentTime = timeInSource;
          setTimeout(() => {
            isSeeking.value = false;
          }, 50);
        }
      } else {
        // No matching source, just update the time
        setTimeout(() => {
          isSeeking.value = false;
        }, 50);
      }
    } else {
      // Clip mode: time is relative (0 to clipDuration), convert to absolute for video element
      if (videoElement.value) {
        const absoluteTime = props.clipStartTime + time;
        videoElement.value.currentTime = absoluteTime;
        previewTime.value = absoluteTime; // Store absolute time
      }
    }
  }

  // Seek to absolute time (used by transcript tab)
  // In editor mode, 'time' is the source video time and needs to be converted to editor timeline position
  function seekToAbsoluteTime(time: number) {
    if (!videoElement.value) return;

    if (editorMode.value) {
      // Find which source contains this time
      const source = videoSources.value.find((s) => {
        const sourceEnd = s.trim_end ?? s.trim_start + (s.end_time - s.start_time);
        return time >= s.trim_start && time <= sourceEnd;
      });

      if (source) {
        // Convert source video time to editor timeline position
        // time is position in source video, we need position on editor timeline
        const timeInSource = time - source.trim_start;
        const editorTimelinePosition = source.start_time + timeInSource;

        previewTime.value = editorTimelinePosition;
        // The video element's currentTime should be the source video time
        videoElement.value.currentTime = time;
      } else {
        // Fallback: just set the time directly
        videoElement.value.currentTime = time;
        previewTime.value = time;
      }
    } else {
      // Non-editor mode: time is absolute video time
      videoElement.value.currentTime = time;
      previewTime.value = time;
    }
  }

  async function splitTrimSegment(segmentId: string, cutTime: number) {
    const segmentIndex = trimSegments.value.findIndex((s) => s.id === segmentId);
    if (segmentIndex === -1) return;

    const segment = trimSegments.value[segmentIndex];

    // Validate cut time is within segment bounds
    if (cutTime <= segment.startTime || cutTime >= segment.endTime) {
      console.warn('[ClipEditorDialog] Cut time is outside segment bounds');
      return;
    }

    // In clip mode, use command pattern for undo/redo support
    if (!editorMode.value && props.clipId) {
      try {
        // Create reload callback
        const reloadCallback = async () => {
          console.log('[splitTrimSegment] Reloading segments from database...');
          const dbSegments = await getClipSegmentsByClipId(props.clipId!);
          console.log(
            '[splitTrimSegment] Loaded segments from DB:',
            dbSegments.map((s) => ({
              start: s.start_time,
              end: s.end_time,
              duration: s.duration,
            }))
          );
          if (dbSegments && dbSegments.length > 0) {
            // Convert absolute times back to relative times
            trimSegments.value = dbSegments.map((seg, index) => ({
              id: `segment-${index}`,
              startTime: seg.start_time - props.clipStartTime,
              endTime: seg.end_time - props.clipStartTime,
              isDeleted: false,
            }));
            console.log(
              '[splitTrimSegment] Converted to relative times:',
              trimSegments.value.map((s) => ({
                id: s.id,
                start: s.startTime,
                end: s.endTime,
              }))
            );
          }
          // Emit save event to notify parent that clip was modified
          emit('save', props.clipId!);
        };

        // Create and execute split command
        const splitCommand = new SplitCommand(false, {
          clipId: props.clipId,
          segmentIndex,
          clipStartTime: props.clipStartTime,
          cutTime,
          onReload: reloadCallback,
        });

        await commandHistory.executeCommand(splitCommand);
        undoRedoTrigger.value++; // Trigger reactivity update

        console.log(
          `[ClipEditorDialog] Split complete (with undo support), now have ${trimSegments.value.length} segments`
        );
      } catch (error) {
        console.error('[ClipEditorDialog] Failed to split segment:', error);
        alert(`Failed to split segment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Editor mode or no clip ID - just update local state (for video editor projects)
      // TODO: Convert to command pattern when we implement editor mode split command
      const leftSegment: TrimSegment = {
        id: `segment-${Date.now()}-left`,
        startTime: segment.startTime,
        endTime: cutTime,
        isDeleted: false,
      };

      const rightSegment: TrimSegment = {
        id: `segment-${Date.now()}-right`,
        startTime: cutTime,
        endTime: segment.endTime,
        isDeleted: false,
      };

      // Replace the original segment with the two new segments
      trimSegments.value.splice(segmentIndex, 1, leftSegment, rightSegment);

      console.log(
        `[ClipEditorDialog] Split segment at ${cutTime.toFixed(2)}s - created ${leftSegment.id} and ${rightSegment.id} (no undo support yet in editor mode)`
      );
    }
  }

  async function deleteTrimSegment(segmentId: string) {
    // Find segment by ID (the ID is like "segment-0", "segment-1", etc.)
    const segmentIndex = parseInt(segmentId.replace('segment-', ''));

    if (isNaN(segmentIndex) || segmentIndex < 0 || segmentIndex >= trimSegments.value.length) {
      console.warn('[ClipEditorDialog] Invalid segment index for deletion');
      return;
    }

    // Prevent deleting the last segment
    if (trimSegments.value.length <= 1) {
      alert('Cannot delete the last remaining segment.');
      return;
    }

    // In clip mode, use command pattern for undo/redo support
    if (!editorMode.value && props.clipId) {
      try {
        // Create reload callback
        const reloadCallback = async () => {
          const dbSegments = await getClipSegmentsByClipId(props.clipId!);
          if (dbSegments && dbSegments.length > 0) {
            // Convert absolute times back to relative times
            trimSegments.value = dbSegments.map((seg, index) => ({
              id: `segment-${index}`,
              startTime: seg.start_time - props.clipStartTime,
              endTime: seg.end_time - props.clipStartTime,
              isDeleted: false,
            }));
          }
          // Emit save event to notify parent that clip was modified
          emit('save', props.clipId!);
        };

        // Create and execute delete command
        const deleteCommand = new DeleteCommand(false, {
          clipId: props.clipId,
          segmentId,
          clipStartTime: props.clipStartTime,
          onReload: reloadCallback,
        });

        await commandHistory.executeCommand(deleteCommand);
        undoRedoTrigger.value++; // Trigger reactivity update

        console.log(
          `[ClipEditorDialog] Delete complete (with undo support), now have ${trimSegments.value.length} segments`
        );
      } catch (error) {
        console.error('[ClipEditorDialog] Failed to delete segment:', error);
        alert(`Failed to delete segment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Editor mode or no clip ID - just update local state
      // TODO: Convert to command pattern when we implement editor mode delete command
      trimSegments.value.splice(segmentIndex, 1);
      console.log(`[ClipEditorDialog] Deleted segment ${segmentIndex} (no undo support yet in editor mode)`);
    }
  }

  // Audio operations
  async function addAudioTrack(filePath: string, name: string, duration: number) {
    const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
    if (!editId) return;

    // Use the actual audio file duration for the track end time
    const trackEndTime = duration;

    const trackData = {
      file_path: filePath,
      name,
      start_time: 0,
      end_time: trackEndTime,
      volume: 1,
      fade_in: 0,
      fade_out: 0,
      track_order: audioTracks.value.length,
    };

    // Use appropriate database function based on mode
    const track = editorMode.value
      ? await createVideoEditorAudioTrack(editId, trackData)
      : await createAudioTrack(editId, trackData);

    const newTrack: AudioTrack = {
      id: track.id,
      filePath: track.file_path,
      name: track.name,
      startTime: track.start_time,
      endTime: track.end_time,
      volume: track.volume,
      fadeIn: track.fade_in,
      fadeOut: track.fade_out,
      trackOrder: track.track_order,
      isMuted: !!track.is_muted,
      isSolo: !!track.is_solo,
    };

    audioTracks.value.push(newTrack);

    // Initialize dB value for this track
    trackDbValues.value[track.id] = 0;

    // Set up audio element for playback
    await setupAudioElement(newTrack);
  }

  // Helper to construct streaming URL from file path
  function getAudioStreamingUrl(filePath: string): string | null {
    // If path already looks like an HTTP URL (legacy data), use it directly
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }

    // Otherwise, construct the HTTP URL from the file path
    if (!videoServerPort.value) {
      console.warn('[ClipEditorDialog] Video server port not available for audio streaming');
      return null;
    }

    const encodedPath = btoa(unescape(encodeURIComponent(filePath)));
    return `http://localhost:${videoServerPort.value}/video/${encodedPath}`;
  }

  // Set up audio element for a track
  async function setupAudioElement(track: AudioTrack) {
    // Initialize audio context if not already
    if (!audioContext.value) {
      audioContext.value = new AudioContext();
    }

    // Ensure video server port is available
    if (!videoServerPort.value) {
      try {
        videoServerPort.value = await invoke<number>('get_video_server_port');
      } catch (err) {
        console.error('[ClipEditorDialog] Failed to get video server port:', err);
        return;
      }
    }

    // Construct the streaming URL from the file path
    const audioSrc = getAudioStreamingUrl(track.filePath);
    if (!audioSrc) {
      console.error('[ClipEditorDialog] Failed to get audio streaming URL for track:', track.id);
      return;
    }

    // Create audio element with CORS enabled for Web Audio API support
    // IMPORTANT: crossOrigin must be set BEFORE src to avoid CORS errors
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = audioSrc;
    audio.loop = true; // Loop the audio track
    audio.preload = 'auto';

    // Create Web Audio nodes for gain control
    const source = audioContext.value.createMediaElementSource(audio);
    const gainNode = audioContext.value.createGain();

    // Apply initial volume and dB gain
    const dbValue = trackDbValues.value[track.id] ?? 0;
    const linearGain = Math.pow(10, dbValue / 20);
    gainNode.gain.value = track.volume * linearGain;

    source.connect(gainNode);
    gainNode.connect(audioContext.value.destination);

    audioElements.value.set(track.id, audio);
    gainNodes.value.set(track.id, gainNode);
  }

  // Update audio element gain
  function updateAudioGain(trackId: string) {
    const gainNode = gainNodes.value.get(trackId);
    const track = audioTracks.value.find((t) => t.id === trackId);
    if (!gainNode || !track) return;

    const dbValue = trackDbValues.value[trackId] ?? 0;
    const linearGain = Math.pow(10, dbValue / 20);
    gainNode.gain.value = track.isMuted ? 0 : track.volume * linearGain;
  }

  // Sync audio tracks with video playback
  function syncAudioWithVideo() {
    if (!videoElement.value) return;

    // Calculate the current time position for audio sync
    // Editor mode: use previewTime directly (it's the timeline position, 0-based)
    // Clip mode: use video time relative to clip start
    let relativeTime: number;
    if (editorMode.value) {
      relativeTime = previewTime.value;
    } else {
      const videoTime = videoElement.value.currentTime;
      relativeTime = videoTime - props.clipStartTime;
    }

    audioTracks.value.forEach((track) => {
      const audio = audioElements.value.get(track.id);
      if (!audio) return;

      // Check if this track should be playing at current time
      const shouldPlay =
        relativeTime >= track.startTime && relativeTime <= track.endTime && isPlaying.value && !track.isMuted;

      // Calculate the audio position within its range
      const audioTime = relativeTime - track.startTime;

      if (shouldPlay) {
        // Sync audio time if it's drifted too far
        if (Math.abs(audio.currentTime - audioTime) > 0.1) {
          audio.currentTime = audioTime % audio.duration || 0;
        }

        if (audio.paused) {
          audioContext.value?.resume();
          audio.play().catch(() => {});
        }

        // Apply fade in/out
        applyFades(track, relativeTime);
      } else {
        if (!audio.paused) {
          audio.pause();
        }
      }
    });
  }

  // Apply fade in/out effects
  function applyFades(track: AudioTrack, currentTime: number) {
    const gainNode = gainNodes.value.get(track.id);
    if (!gainNode) return;

    const dbValue = trackDbValues.value[track.id] ?? 0;
    const baseLinearGain = Math.pow(10, dbValue / 20);
    let fadeMultiplier = 1;

    const timeInTrack = currentTime - track.startTime;
    const timeFromEnd = track.endTime - currentTime;

    // Fade in
    if (track.fadeIn > 0 && timeInTrack < track.fadeIn) {
      fadeMultiplier = timeInTrack / track.fadeIn;
    }

    // Fade out
    if (track.fadeOut > 0 && timeFromEnd < track.fadeOut) {
      fadeMultiplier = Math.min(fadeMultiplier, timeFromEnd / track.fadeOut);
    }

    gainNode.gain.value = track.volume * baseLinearGain * Math.max(0, fadeMultiplier);
  }

  // Clean up audio elements
  function cleanupAudioElements() {
    audioElements.value.forEach((audio, _trackId) => {
      audio.pause();
      audio.src = '';
    });
    audioElements.value.clear();
    gainNodes.value.clear();

    if (audioContext.value) {
      audioContext.value.close();
      audioContext.value = null;
    }
  }

  async function updateAudioTrackLocal(trackId: string, updates: Partial<AudioTrack>) {
    const updateData = {
      name: updates.name,
      start_time: updates.startTime,
      end_time: updates.endTime,
      volume: updates.volume,
      fade_in: updates.fadeIn,
      fade_out: updates.fadeOut,
      track_order: updates.trackOrder,
      is_muted: updates.isMuted ? 1 : 0,
      is_solo: updates.isSolo ? 1 : 0,
    };

    // Use appropriate database function based on mode
    if (editorMode.value) {
      await updateVideoEditorAudioTrack(trackId, updateData);
    } else {
      await updateAudioTrack(trackId, updateData);
    }

    const track = audioTracks.value.find((t) => t.id === trackId);
    if (track) {
      Object.assign(track, updates);

      // Update audio gain if volume or mute changed
      if (updates.volume !== undefined || updates.isMuted !== undefined) {
        updateAudioGain(trackId);
      }
    }
  }

  async function deleteAudioTrackLocal(trackId: string) {
    // Use appropriate database function based on mode
    if (editorMode.value) {
      await deleteVideoEditorAudioTrack(trackId);
    } else {
      await deleteAudioTrack(trackId);
    }

    // Clean up audio element
    const audio = audioElements.value.get(trackId);
    if (audio) {
      audio.pause();
      audio.src = '';
      audioElements.value.delete(trackId);
    }
    gainNodes.value.delete(trackId);
    delete trackDbValues.value[trackId];

    audioTracks.value = audioTracks.value.filter((t) => t.id !== trackId);
  }

  function updateOriginalDb(db: number) {
    originalDb.value = db;
    // Apply to video element - convert dB to linear gain
    if (videoElement.value) {
      const linearGain = Math.pow(10, db / 20);
      videoElement.value.volume = Math.min(1, linearGain);
    }
  }

  function updateTrackDb(trackId: string, db: number) {
    trackDbValues.value[trackId] = db;
    updateAudioGain(trackId);
  }

  // Filter segment operations
  function addFilterSegment(settings: FilterSettings) {
    const effectiveStartTime = effectivePreviewTime.value;
    const effectiveEndTime = Math.min(effectiveStartTime + 5, totalSegmentDuration.value); // Default 5 second duration
    const newSegment: FilterSegment = {
      id: `filter-${Date.now()}`,
      startTime: effectiveStartTime,
      endTime: effectiveEndTime,
      settings,
    };
    filterSegments.value.push(newSegment);
  }

  function updateFilterSegment(segmentId: string, updates: Partial<FilterSegment>) {
    const segment = filterSegments.value.find((s) => s.id === segmentId);
    if (segment) {
      if (updates.startTime !== undefined) segment.startTime = updates.startTime;
      if (updates.endTime !== undefined) segment.endTime = updates.endTime;
      if (updates.settings) segment.settings = { ...segment.settings, ...updates.settings };
    }
  }

  function deleteFilterSegment(segmentId: string) {
    filterSegments.value = filterSegments.value.filter((s) => s.id !== segmentId);
  }

  // Aspect ratio framing operations
  function updateFramingConfigs(configs: ManualFramingConfigs) {
    framingConfigs.value = configs;
  }

  function updateSelectedAspectRatios(ratios: string[]) {
    // Ensure 16:9 (Original) is always included
    const newRatios = [...ratios];
    if (!newRatios.includes('16:9')) {
      newRatios.unshift('16:9');
    }
    selectedAspectRatios.value = newRatios;
  }

  function updateFramingMode(mode: 'auto' | 'manual') {
    framingMode.value = mode;
  }

  // Toggle aspect ratio selection (add/remove from selectedAspectRatios)
  function toggleAspectRatio(ratio: string) {
    // 16:9 (Original) is always selected and cannot be removed
    if (ratio === '16:9') {
      // Just switch preview to 16:9
      previewAspectRatio.value = '16:9';
      return;
    }

    const current = [...selectedAspectRatios.value];
    const index = current.indexOf(ratio);
    if (index > -1) {
      current.splice(index, 1);
      // If removing the currently previewed ratio, switch to 16:9
      if (previewAspectRatio.value === ratio) {
        previewAspectRatio.value = '16:9';
      }
    } else {
      current.push(ratio);
      // Switch preview to the newly selected ratio
      previewAspectRatio.value = ratio;
    }
    // Ensure 16:9 is always included
    if (!current.includes('16:9')) {
      current.unshift('16:9');
    }
    selectedAspectRatios.value = current;
  }

  // Open the manual POI editor for a specific aspect ratio
  function openManualPOIEditor(ratio: string) {
    editingAspectRatio.value = ratio;
    showManualPOIEditor.value = true;
  }

  // Get config for a specific aspect ratio
  function getConfigForRatio(ratio: string): ManualFramingConfig | null {
    return framingConfigs.value[ratio as keyof ManualFramingConfigs] || null;
  }

  // Handle POI config confirmation from ManualPOIEditor
  function onManualPOIConfigConfirm(config: ManualFramingConfig) {
    const ratio = config.targetAspectRatio as keyof ManualFramingConfigs;

    // Ensure the ratio is in selectedAspectRatios
    if (!selectedAspectRatios.value.includes(config.targetAspectRatio)) {
      selectedAspectRatios.value = [...selectedAspectRatios.value, config.targetAspectRatio];
    }

    framingConfigs.value = {
      ...framingConfigs.value,
      [ratio]: config,
    };
    // Set framing mode to manual since we now have manual config
    framingMode.value = 'manual';
    // Switch preview to show the configured ratio
    previewAspectRatio.value = config.targetAspectRatio;
  }

  // Text overlay operations
  async function addTextOverlay(text: string, style: any) {
    const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
    if (!editId) return;

    // Use effective time (accounting for segment cuts) for the overlay timing
    const effectiveStartTime = effectivePreviewTime.value;
    const effectiveEndTime = Math.min(effectiveStartTime + 3, totalSegmentDuration.value);

    // Get the current preview container height for proper font scaling on export
    const currentPreviewHeight = previewRef.value?.getOverlayContainerHeight() ?? 400;

    const overlayData = {
      text,
      start_time: effectiveStartTime,
      end_time: effectiveEndTime,
      position_x: 50,
      position_y: 50, // Default to center
      style_data: JSON.stringify(style),
      animation: 'fade',
      preview_height: currentPreviewHeight,
    };

    // Use appropriate database function based on mode
    const overlay = editorMode.value
      ? await createVideoEditorTextOverlay(editId, overlayData)
      : await createTextOverlay(editId, overlayData);

    textOverlays.value.push({
      id: overlay.id,
      text: overlay.text,
      startTime: overlay.start_time,
      endTime: overlay.end_time,
      position: { x: overlay.position_x, y: overlay.position_y },
      style,
      animation: overlay.animation as any,
      previewHeight: currentPreviewHeight,
    });
  }

  async function updateTextOverlayLocal(overlayId: string, updates: Partial<TextOverlay>) {
    // If style is being updated (font size, etc.), capture current preview height
    let currentPreviewHeight: number | undefined;
    if (updates.style || updates.perRatioConfigs) {
      currentPreviewHeight = previewRef.value?.getOverlayContainerHeight() ?? undefined;
    }

    const updateData = {
      text: updates.text,
      start_time: updates.startTime,
      end_time: updates.endTime,
      position_x: updates.position?.x,
      position_y: updates.position?.y,
      style_data: updates.style ? JSON.stringify(updates.style) : undefined,
      per_ratio_configs_data: updates.perRatioConfigs ? JSON.stringify(updates.perRatioConfigs) : undefined,
      preview_height: currentPreviewHeight,
      animation: updates.animation,
    };

    // Use appropriate database function based on mode
    if (editorMode.value) {
      await updateVideoEditorTextOverlay(overlayId, updateData);
    } else {
      await updateTextOverlay(overlayId, updateData);
    }

    const overlay = textOverlays.value.find((o) => o.id === overlayId);
    if (overlay) {
      Object.assign(overlay, updates);
      if (currentPreviewHeight !== undefined) {
        overlay.previewHeight = currentPreviewHeight;
      }
    }
  }

  async function deleteTextOverlayLocal(overlayId: string) {
    // Use appropriate database function based on mode
    if (editorMode.value) {
      await deleteVideoEditorTextOverlay(overlayId);
    } else {
      await deleteTextOverlay(overlayId);
    }
    textOverlays.value = textOverlays.value.filter((o) => o.id !== overlayId);
  }

  // Sticker operations
  async function addStickerLocal(
    stickerPath: string,
    type: 'emoji' | 'image' | 'gif',
    options?: { scale?: number; position?: { x: number; y: number } }
  ) {
    const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
    if (!editId) return;

    // Use effective time (accounting for segment cuts) for sticker timing
    const effectiveStartTime = effectivePreviewTime.value;
    const effectiveEndTime = Math.min(effectiveStartTime + 3, totalSegmentDuration.value);

    const stickerData = {
      sticker_path: stickerPath,
      sticker_type: type,
      start_time: effectiveStartTime,
      end_time: effectiveEndTime,
      position_x: options?.position?.x ?? 50,
      position_y: options?.position?.y ?? 50,
      scale: options?.scale ?? 1,
      rotation: 0,
      animation: 'none',
    };

    // Use appropriate database function based on mode
    const sticker = editorMode.value
      ? await createVideoEditorSticker(editId, stickerData)
      : await createSticker(editId, stickerData);

    stickers.value.push({
      id: sticker.id,
      stickerPath: sticker.sticker_path,
      stickerType: sticker.sticker_type as any,
      startTime: sticker.start_time,
      endTime: sticker.end_time,
      position: { x: sticker.position_x, y: sticker.position_y },
      scale: sticker.scale,
      rotation: sticker.rotation,
      animation: sticker.animation as any,
    });
  }

  async function updateStickerLocal(stickerId: string, updates: Partial<Sticker>) {
    const updateData = {
      sticker_path: updates.stickerPath,
      sticker_type: updates.stickerType,
      start_time: updates.startTime,
      end_time: updates.endTime,
      position_x: updates.position?.x,
      position_y: updates.position?.y,
      scale: updates.scale,
      rotation: updates.rotation,
      animation: updates.animation,
      per_ratio_configs_data: updates.perRatioConfigs ? JSON.stringify(updates.perRatioConfigs) : undefined,
    };

    // Use appropriate database function based on mode
    if (editorMode.value) {
      await updateVideoEditorSticker(stickerId, updateData);
    } else {
      await updateSticker(stickerId, updateData);
    }

    const sticker = stickers.value.find((s) => s.id === stickerId);
    if (sticker) {
      Object.assign(sticker, updates);
    }
  }

  async function deleteStickerLocal(stickerId: string) {
    // Use appropriate database function based on mode
    if (editorMode.value) {
      await deleteVideoEditorSticker(stickerId);
    } else {
      await deleteSticker(stickerId);
    }
    stickers.value = stickers.value.filter((s) => s.id !== stickerId);
  }

  // Watermark operations
  async function addWatermarkLocal(watermarkId: string, filePath: string, previewUrl: string) {
    const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
    if (!editId) return;

    // By default, watermark spans the entire clip duration (100% of clip)
    const startTime = 0;
    const endTime = totalSegmentDuration.value;

    const watermarkData = {
      watermark_id: watermarkId,
      watermark_path: filePath, // File path for FFmpeg export
      preview_url: previewUrl, // Data URL for preview display
      start_time: startTime,
      end_time: endTime,
      position_x: 8,
      position_y: 92,
      scale: 15,
      opacity: 80,
    };

    // Use appropriate database function based on mode
    const watermark = editorMode.value
      ? await createVideoEditorWatermark(editId, watermarkData)
      : await createWatermark(editId, watermarkData);

    watermarks.value.push({
      id: watermark.id,
      watermarkId: watermark.watermark_id,
      filePath: filePath, // Actual file path for export
      previewUrl: previewUrl, // Data URL for preview display
      startTime: watermark.start_time,
      endTime: watermark.end_time,
      position: { x: watermark.position_x, y: watermark.position_y },
      scale: watermark.scale,
      opacity: watermark.opacity,
    });
  }

  async function updateWatermarkLocal(watermarkId: string, updates: Partial<ClipWatermark>) {
    const updateData = {
      watermark_id: updates.watermarkId,
      watermark_path: updates.filePath,
      start_time: updates.startTime,
      end_time: updates.endTime,
      position_x: updates.position?.x,
      position_y: updates.position?.y,
      scale: updates.scale,
      opacity: updates.opacity,
      per_ratio_configs_data: updates.perRatioConfigs ? JSON.stringify(updates.perRatioConfigs) : undefined,
    };

    // Use appropriate database function based on mode
    if (editorMode.value) {
      await updateVideoEditorWatermark(watermarkId, updateData);
    } else {
      await updateWatermarkRecord(watermarkId, updateData);
    }

    const watermark = watermarks.value.find((w) => w.id === watermarkId);
    if (watermark) {
      Object.assign(watermark, updates);
    }
  }

  async function deleteWatermarkLocal(watermarkId: string) {
    // Use appropriate database function based on mode
    if (editorMode.value) {
      await deleteVideoEditorWatermark(watermarkId);
    } else {
      await deleteWatermarkRecord(watermarkId);
    }
    watermarks.value = watermarks.value.filter((w) => w.id !== watermarkId);
  }

  // Auto-apply creator profile watermark settings when opening the clip editor
  async function applyCreatorWatermark() {
    // Skip if watermarks already exist
    if (watermarks.value.length > 0) {
      console.log('[ClipEditorDialog] Skipping creator watermark - already has watermarks');
      return;
    }

    let watermarkId = props.creatorWatermarkId;
    let watermarkSettingsJson = props.creatorWatermarkSettings;

    // If no props provided and in editor mode, try to load from video sources' parent project
    if (!watermarkId && editorMode.value && videoSources.value.length > 0) {
      console.log('[ClipEditorDialog] No creator watermark props, trying to load from video sources...', {
        editorMode: editorMode.value,
        sourceCount: videoSources.value.length,
        sources: videoSources.value.map((s) => ({ id: s.id, type: s.source_type, sourceId: s.source_id })),
      });

      // Try to find watermark settings from the first video source's parent project
      for (const source of videoSources.value) {
        let parentProjectId: string | null = null;

        if (source.source_type === 'raw_video' && source.source_id) {
          const rawVideo = await getRawVideo(source.source_id);
          parentProjectId = rawVideo?.project_id || null;
          console.log('[ClipEditorDialog] Raw video lookup:', {
            sourceId: source.source_id,
            rawVideo: rawVideo ? { id: rawVideo.id, project_id: rawVideo.project_id } : null,
          });
        } else if (source.source_type === 'clip' && source.source_id) {
          const clip = await getClip(source.source_id);
          parentProjectId = clip?.project_id || null;
          console.log('[ClipEditorDialog] Clip lookup:', {
            sourceId: source.source_id,
            clip: clip ? { id: clip.id, project_id: clip.project_id } : null,
          });
        }

        if (parentProjectId) {
          const parentProject = await getProject(parentProjectId);
          console.log(
            '[ClipEditorDialog] Parent project:',
            parentProject
              ? {
                  id: parentProject.id,
                  name: parentProject.name,
                  hasWatermarkSettings: !!parentProject.default_watermark_settings,
                }
              : null
          );

          // Check for watermark in the stored settings (format: { watermarkId, watermarkSettings })
          if (parentProject?.default_watermark_settings) {
            try {
              const storedSettings = JSON.parse(parentProject.default_watermark_settings);
              console.log('[ClipEditorDialog] Found stored watermark settings:', {
                watermarkId: storedSettings.watermarkId,
                hasWatermarkSettings: !!storedSettings.watermarkSettings,
              });

              if (storedSettings.watermarkId) {
                console.log(
                  '[ClipEditorDialog] Found watermark from parent project:',
                  parentProject.name,
                  'watermark:',
                  storedSettings.watermarkId
                );
                watermarkId = storedSettings.watermarkId;

                // Extract the per-ratio configs
                if (storedSettings.watermarkSettings) {
                  watermarkSettingsJson =
                    typeof storedSettings.watermarkSettings === 'string'
                      ? storedSettings.watermarkSettings
                      : JSON.stringify(storedSettings.watermarkSettings);
                }
                break; // Found watermark, stop looking
              }
            } catch (e) {
              console.warn('[ClipEditorDialog] Failed to parse parent project watermark settings:', e);
            }
          }
        }
      }
    }

    if (!watermarkId) {
      console.log('[ClipEditorDialog] No creator watermark to apply');
      return;
    }

    console.log('[ClipEditorDialog] Auto-applying creator watermark:', watermarkId);

    try {
      let watermarkRecord: { id: string; file_path: string; width?: number; height?: number } | null = null;
      let previewUrl: string | null = null;
      let filePath: string | null = null;

      // Check if this is an organization asset (ID format: org-asset-{serverId})
      if (watermarkId.startsWith('org-asset-')) {
        const serverId = parseInt(watermarkId.replace('org-asset-', ''), 10);
        console.log('[ClipEditorDialog] Loading org watermark with serverId:', serverId);

        if (!isNaN(serverId)) {
          // First try to load from local cache
          const localWatermark = await getWatermarkByServerId(serverId);
          if (localWatermark) {
            console.log('[ClipEditorDialog] Found cached org watermark:', localWatermark.name);
            watermarkRecord = localWatermark;
            filePath = localWatermark.file_path;
            previewUrl = await invoke<string>('read_file_as_data_url', { filePath: localWatermark.file_path });
          } else {
            // Not cached locally - get URL from server
            console.log('[ClipEditorDialog] Org watermark not cached, fetching URL from server...');
            const serverResponse = await getUserOrganizationAssets();
            if (serverResponse.success && serverResponse.assets) {
              const serverAsset = serverResponse.assets.find((a) => a.id === serverId && a.asset_type === 'watermark');
              if (serverAsset && serverAsset.url) {
                console.log('[ClipEditorDialog] Using server URL directly for watermark:', serverAsset.name);
                previewUrl = serverAsset.url;
                filePath = serverAsset.url;
                watermarkRecord = {
                  id: watermarkId,
                  file_path: serverAsset.url,
                  width: serverAsset.width,
                  height: serverAsset.height,
                };
              }
            }
          }
        }
      } else {
        // Regular watermark lookup by ID
        const watermark = await getWatermarkImage(watermarkId);
        if (watermark) {
          watermarkRecord = watermark;
          filePath = watermark.file_path;
          previewUrl = await invoke<string>('read_file_as_data_url', { filePath: watermark.file_path });
        }
      }

      if (!watermarkRecord || !filePath || !previewUrl) {
        console.log('[ClipEditorDialog] Failed to load creator watermark data');
        return;
      }

      // Parse per-ratio settings from creator profile
      let perRatioConfigs:
        | Record<
            string,
            { position: { x: number; y: number }; scale: number; opacity: number; isFullFrameOverlay?: boolean }
          >
        | undefined;
      let defaultPosition = { x: 8, y: 92 };
      let defaultScale = 15;
      let defaultOpacity = 80;
      let isFullFrameOverlay = false;

      if (watermarkSettingsJson) {
        try {
          const creatorSettings =
            typeof watermarkSettingsJson === 'string' ? JSON.parse(watermarkSettingsJson) : watermarkSettingsJson;

          // Build per-ratio configs for the clip editor
          perRatioConfigs = {};
          for (const [ratio, config] of Object.entries(creatorSettings)) {
            if (config && typeof config === 'object' && 'position' in config) {
              const ratioConfig = config as {
                position?: { x: number; y: number; scale: number; opacity: number; isFullFrameOverlay?: boolean };
                watermarkId?: string;
              };
              if (ratioConfig.position) {
                perRatioConfigs[ratio] = {
                  position: { x: ratioConfig.position.x, y: ratioConfig.position.y },
                  scale: ratioConfig.position.scale,
                  opacity: ratioConfig.position.opacity,
                  isFullFrameOverlay: ratioConfig.position.isFullFrameOverlay,
                };
                // Use 16:9 as default display settings
                if (ratio === '16:9') {
                  defaultPosition = { x: ratioConfig.position.x, y: ratioConfig.position.y };
                  defaultScale = ratioConfig.position.scale;
                  defaultOpacity = ratioConfig.position.opacity;
                  isFullFrameOverlay = ratioConfig.position.isFullFrameOverlay ?? false;
                }
              }
            }
          }
          console.log('[ClipEditorDialog] Parsed creator watermark settings:', {
            defaultPosition,
            defaultScale,
            defaultOpacity,
            isFullFrameOverlay,
            ratioCount: Object.keys(perRatioConfigs).length,
          });
        } catch (e) {
          console.warn('[ClipEditorDialog] Failed to parse creator watermark settings:', e);
        }
      }

      // Create the watermark in the database
      const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
      if (!editId) {
        console.log('[ClipEditorDialog] No edit ID available, cannot add watermark');
        return;
      }

      const watermarkData = {
        watermark_id: watermarkId,
        watermark_path: filePath,
        preview_url: previewUrl,
        start_time: 0,
        end_time: totalSegmentDuration.value,
        position_x: defaultPosition.x,
        position_y: defaultPosition.y,
        scale: defaultScale,
        opacity: defaultOpacity,
        per_ratio_configs_data: perRatioConfigs ? JSON.stringify(perRatioConfigs) : undefined,
      };

      const newWatermark = editorMode.value
        ? await createVideoEditorWatermark(editId, watermarkData)
        : await createWatermark(editId, watermarkData);

      watermarks.value.push({
        id: newWatermark.id,
        watermarkId: newWatermark.watermark_id,
        filePath: filePath,
        previewUrl: previewUrl,
        startTime: newWatermark.start_time,
        endTime: newWatermark.end_time,
        position: { x: newWatermark.position_x, y: newWatermark.position_y },
        scale: newWatermark.scale,
        opacity: newWatermark.opacity,
        perRatioConfigs: perRatioConfigs,
      });

      console.log('[ClipEditorDialog] Creator watermark auto-applied successfully:', {
        watermarkCount: watermarks.value.length,
        watermarkIds: watermarks.value.map((w) => w.id),
        totalDuration: totalSegmentDuration.value,
      });
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to auto-apply creator watermark:', error);
    }
  }

  // Handle subtitle settings changes from SubtitlesTab
  function updateSubtitleSettings(newSettings: ClipSubtitleSettings) {
    subtitleSettings.value = newSettings;
    triggerAutoSave();
  }

  // Handle subtitle position updates from preview drag
  function onUpdateSubtitlePosition(position: { x: number; y: number }) {
    const ratio = previewAspectRatio.value;
    const settings = subtitleSettings.value;

    // Update per-ratio config for the current aspect ratio
    const perRatioConfigs = { ...settings.perRatioConfigs };
    const currentConfig = perRatioConfigs[ratio] || {
      position: { x: settings.positionX, y: settings.positionY },
      fontSize: settings.fontSize,
    };
    currentConfig.position = position;
    perRatioConfigs[ratio] = currentConfig;

    subtitleSettings.value = {
      ...settings,
      perRatioConfigs,
    };
    triggerAutoSave();
  }

  // Handle subtitle max width updates from preview resize
  function onUpdateSubtitleMaxWidth(maxWidth: number) {
    const ratio = previewAspectRatio.value;
    const settings = subtitleSettings.value;

    // Update per-ratio config for the current aspect ratio
    const perRatioConfigs = { ...settings.perRatioConfigs };
    const currentConfig = perRatioConfigs[ratio] || {
      position: { x: settings.positionX, y: settings.positionY },
      fontSize: settings.fontSize,
    };
    currentConfig.maxWidth = maxWidth;
    perRatioConfigs[ratio] = currentConfig;

    subtitleSettings.value = {
      ...settings,
      maxWidth, // Also update base maxWidth for display
      perRatioConfigs,
    };
    triggerAutoSave();
  }

  // Handle overlay position updates from preview drag
  function onUpdateOverlayPosition(
    type: 'text' | 'sticker' | 'watermark',
    id: string,
    position: { x: number; y: number }
  ) {
    if (type === 'text') {
      // Store position in per-ratio config for the current preview aspect ratio
      const overlay = textOverlays.value.find((o) => o.id === id);
      if (overlay) {
        const ratio = previewAspectRatio.value;
        const perRatioConfigs = overlay.perRatioConfigs || {};
        const currentConfig = perRatioConfigs[ratio] || {
          position: { ...overlay.position },
          style: { ...overlay.style },
        };
        currentConfig.position = position;
        perRatioConfigs[ratio] = currentConfig;
        updateTextOverlayLocal(id, { perRatioConfigs });
      }
    } else if (type === 'sticker') {
      // Store position in per-ratio config for the current preview aspect ratio
      const sticker = stickers.value.find((s) => s.id === id);
      if (sticker) {
        const ratio = previewAspectRatio.value;
        const perRatioConfigs = sticker.perRatioConfigs || {};
        const currentConfig = perRatioConfigs[ratio] || {
          position: { ...sticker.position },
          scale: sticker.scale,
          rotation: sticker.rotation,
        };
        currentConfig.position = position;
        perRatioConfigs[ratio] = currentConfig;
        updateStickerLocal(id, { perRatioConfigs });
      }
    } else if (type === 'watermark') {
      // Store position in per-ratio config for the current preview aspect ratio
      const watermark = watermarks.value.find((w) => w.id === id);
      if (watermark) {
        const ratio = previewAspectRatio.value;
        const perRatioConfigs = watermark.perRatioConfigs || {};
        const currentConfig = perRatioConfigs[ratio] || {
          position: { ...watermark.position },
          scale: watermark.scale,
          opacity: watermark.opacity,
        };
        currentConfig.position = position;
        perRatioConfigs[ratio] = currentConfig;
        updateWatermarkLocal(id, { perRatioConfigs });
      }
    }
  }

  function onUpdateOverlayWidth(id: string, width: number) {
    // Store width in per-ratio config for the current preview aspect ratio
    const overlay = textOverlays.value.find((o) => o.id === id);
    if (overlay) {
      const ratio = previewAspectRatio.value;
      const perRatioConfigs = overlay.perRatioConfigs || {};
      const currentConfig = perRatioConfigs[ratio] || {
        position: { ...overlay.position },
        style: { ...overlay.style },
      };
      currentConfig.style = { ...currentConfig.style, width };
      perRatioConfigs[ratio] = currentConfig;
      updateTextOverlayLocal(id, { perRatioConfigs });
    }
  }

  function onUpdateStickerScale(id: string, scale: number) {
    // Store scale in per-ratio config for the current preview aspect ratio
    const sticker = stickers.value.find((s) => s.id === id);
    if (sticker) {
      const ratio = previewAspectRatio.value;
      const perRatioConfigs = sticker.perRatioConfigs || {};
      const currentConfig = perRatioConfigs[ratio] || {
        position: { ...sticker.position },
        scale: sticker.scale,
        rotation: sticker.rotation,
      };
      currentConfig.scale = scale;
      perRatioConfigs[ratio] = currentConfig;
      updateStickerLocal(id, { perRatioConfigs });
    }
  }

  function onUpdateStickerRotation(id: string, rotation: number) {
    // Store rotation in per-ratio config for the current preview aspect ratio
    const sticker = stickers.value.find((s) => s.id === id);
    if (sticker) {
      const ratio = previewAspectRatio.value;
      const perRatioConfigs = sticker.perRatioConfigs || {};
      const currentConfig = perRatioConfigs[ratio] || {
        position: { ...sticker.position },
        scale: sticker.scale,
        rotation: sticker.rotation,
      };
      currentConfig.rotation = rotation;
      perRatioConfigs[ratio] = currentConfig;
      updateStickerLocal(id, { perRatioConfigs });
    }
  }

  function onUpdateWatermarkScale(id: string, scale: number) {
    // Store scale in per-ratio config for the current preview aspect ratio
    const watermark = watermarks.value.find((w) => w.id === id);
    if (watermark) {
      const ratio = previewAspectRatio.value;
      const perRatioConfigs = watermark.perRatioConfigs || {};
      const currentConfig = perRatioConfigs[ratio] || {
        position: { ...watermark.position },
        scale: watermark.scale,
        opacity: watermark.opacity,
      };
      currentConfig.scale = scale;
      perRatioConfigs[ratio] = currentConfig;
      updateWatermarkLocal(id, { perRatioConfigs });
    }
  }

  // Effect operations (prefixed with underscore as they may be used in future)
  async function _addEffectLocal(type: string, settings: any) {
    if (!clipEditId.value) return;

    const effect = await createEffect(clipEditId.value, {
      effect_type: type,
      start_time: previewTime.value,
      end_time: Math.min(previewTime.value + 2, clipDuration.value),
      settings: JSON.stringify(settings),
    });

    effects.value.push({
      id: effect.id,
      type: effect.effect_type as any,
      startTime: effect.start_time,
      endTime: effect.end_time,
      settings,
    });
  }

  async function updateEffectLocal(effectId: string, updates: Partial<Effect>) {
    await updateEffect(effectId, {
      effect_type: updates.type,
      start_time: updates.startTime,
      end_time: updates.endTime,
      settings: updates.settings ? JSON.stringify(updates.settings) : undefined,
    });

    const effect = effects.value.find((e) => e.id === effectId);
    if (effect) {
      Object.assign(effect, updates);
    }
  }

  async function _deleteEffectLocal(effectId: string) {
    await deleteEffect(effectId);
    effects.value = effects.value.filter((e) => e.id !== effectId);
  }

  // Export tab event handlers
  function onBuildStarted() {
    console.log('[ClipEditorDialog] Build started');
  }

  function onBuildCompleted(buildId: string) {
    console.log('[ClipEditorDialog] Build completed:', buildId);
  }

  function onBuildFailed(error: string) {
    console.error('[ClipEditorDialog] Build failed:', error);
  }

  // Auto-save function (debounced)
  function triggerAutoSave() {
    // Don't save during initial load
    if (isInitialLoad.value) return;

    // Clear any pending save
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Debounce: wait 500ms before saving
    saveTimeout = setTimeout(() => {
      performSave();
    }, 500);
  }

  // Perform the actual save
  async function performSave() {
    const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
    if (!editId) return;

    isSaving.value = true;
    lastSaved.value = false;

    try {
      if (editorMode.value) {
        // Video editor mode - save to video_editor_edits table
        await updateVideoEditorEdit(editId, {
          filterSegments: filterSegments.value,
          originalDb: originalDb.value,
          trackDbValues: trackDbValues.value,
        });
      } else {
        // Clip mode - save to clip_edits table
        await updateClipEdit(editId, {
          trim: {
            startTime: props.clipStartTime,
            endTime: props.clipEndTime,
            segments: trimSegments.value,
          },
          filterSegments: filterSegments.value,
          originalDb: originalDb.value,
          trackDbValues: trackDbValues.value,
          // Aspect ratio framing data
          aspectFraming: {
            selectedRatios: selectedAspectRatios.value,
            framingMode: framingMode.value,
            configs: framingConfigs.value,
          },
          // Subtitle settings
          subtitleSettings: subtitleSettings.value,
        });
      }

      lastSaved.value = true;

      // Hide "Saved" indicator after 2 seconds
      setTimeout(() => {
        lastSaved.value = false;
      }, 2000);
    } catch (error) {
      console.error('[ClipEditorDialog] Auto-save failed:', error);
    } finally {
      isSaving.value = false;
    }
  }

  // Save immediately (used when closing)
  async function saveNow() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    await performSave();
  }

  // Load project ID from clip (needed for transcript)
  async function loadProjectId() {
    // In editor mode, find the project ID from video sources
    // Note: editorProjectId is a video_editor_projects.id, not a projects.id
    // We need to look up the original project from the video sources to get transcripts
    if (editorMode.value) {
      // Try to find a source with a source_id (clip or raw_video reference)
      const sourceWithId = videoSources.value.find(
        (s) => s.source_id && (s.source_type === 'clip' || s.source_type === 'raw_video')
      );

      if (sourceWithId?.source_id) {
        try {
          if (sourceWithId.source_type === 'clip') {
            // Look up the clip to get its project_id
            const clip = await getClipWithBuildStatus(sourceWithId.source_id);
            projectId.value = clip?.project_id || null;
          } else if (sourceWithId.source_type === 'raw_video') {
            // Look up the raw_video to get its project_id
            const rawVideo = await getRawVideo(sourceWithId.source_id);
            projectId.value = rawVideo?.project_id || null;
          }
        } catch (error) {
          console.error('[ClipEditorDialog] Failed to load project ID from source:', error);
          projectId.value = null;
        }
      } else {
        projectId.value = null;
      }
      return;
    }

    if (!props.clipId) {
      projectId.value = null;
      return;
    }
    try {
      const clip = await getClipWithBuildStatus(props.clipId);
      projectId.value = clip?.project_id || null;
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to load project ID:', error);
      projectId.value = null;
    }
  }

  // Check if saved trim segments match the current clip segments
  // Returns true if the segments are out of sync (e.g., clip was split after last edit)
  function areSegmentsOutOfSync(
    savedSegments: { id: string; startTime: number; endTime: number; isDeleted?: boolean }[],
    currentClipSegments: ClipSegmentInput[]
  ): boolean {
    if (!currentClipSegments || currentClipSegments.length === 0) {
      return false; // No current segments to compare
    }

    // Filter out deleted segments from saved segments
    const activeSavedSegments = savedSegments.filter((s) => !s.isDeleted);

    // If segment counts differ, they're out of sync
    if (activeSavedSegments.length !== currentClipSegments.length) {
      console.log(
        `[ClipEditorDialog] Segments out of sync: saved count (${activeSavedSegments.length}) != current count (${currentClipSegments.length})`
      );
      return true;
    }

    // Compare each segment's timing (convert clip segments to relative times)
    const timeTolerance = 0.1; // 100ms tolerance for floating point comparison
    for (let i = 0; i < currentClipSegments.length; i++) {
      const currentSeg = currentClipSegments[i];
      const savedSeg = activeSavedSegments[i];

      // Convert absolute source times to relative times
      const currentRelativeStart = currentSeg.start_time - props.clipStartTime;
      const currentRelativeEnd = currentSeg.end_time - props.clipStartTime;

      // Check if start or end times differ significantly
      if (
        Math.abs(savedSeg.startTime - currentRelativeStart) > timeTolerance ||
        Math.abs(savedSeg.endTime - currentRelativeEnd) > timeTolerance
      ) {
        console.log(
          `[ClipEditorDialog] Segment ${i} timing mismatch: saved (${savedSeg.startTime.toFixed(2)}-${savedSeg.endTime.toFixed(2)}) vs current (${currentRelativeStart.toFixed(2)}-${currentRelativeEnd.toFixed(2)})`
        );
        return true;
      }
    }

    return false;
  }

  // Load existing edit data
  async function loadEditData() {
    const editRecord = await getOrCreateClipEdit(props.clipId);
    clipEditId.value = editRecord.id;

    const fullEdit = await getFullClipEdit(props.clipId);
    if (fullEdit) {
      const editData = JSON.parse(fullEdit.edit.edit_data);

      // Check if saved segments are out of sync with current clip segments
      // This happens when the clip is modified (e.g., split, merged) outside the editor
      const savedSegments = editData.trim?.segments || [];
      const segmentsChanged =
        savedSegments.length > 0 &&
        props.clipSegments &&
        props.clipSegments.length > 0 &&
        areSegmentsOutOfSync(savedSegments, props.clipSegments);

      if (segmentsChanged) {
        // Clip segments have changed - re-initialize from current clip segments
        console.log('[ClipEditorDialog] Clip segments changed, re-syncing from database');
        trimSegments.value = props.clipSegments!.map((seg, index) => ({
          id: `segment-${index}`,
          startTime: seg.start_time - props.clipStartTime,
          endTime: seg.end_time - props.clipStartTime,
          isDeleted: false,
        }));
      } else if (savedSegments.length > 0) {
        // Use saved segments (they match the current clip structure)
        trimSegments.value = savedSegments;
      } else if (props.clipSegments && props.clipSegments.length > 0) {
        // Initialize from clip's segments if no edit data segments exist
        // Convert absolute source times to relative times (0 to clipDuration)
        // The segments are stored with absolute source video times
        trimSegments.value = props.clipSegments.map((seg, index) => ({
          id: `segment-${index}`,
          startTime: seg.start_time - props.clipStartTime,
          endTime: seg.end_time - props.clipStartTime,
          isDeleted: false,
        }));
      }

      if (editData.filterSegments && Array.isArray(editData.filterSegments)) {
        filterSegments.value = editData.filterSegments;
      } else if (editData.filter) {
        // Legacy support: convert single filter to a segment covering the entire clip
        filterSegments.value = [
          {
            id: 'filter-legacy',
            startTime: 0,
            endTime: clipDuration.value,
            settings: editData.filter,
          },
        ];
      }
      if (editData.originalDb !== undefined) {
        originalDb.value = editData.originalDb;
      }
      if (editData.trackDbValues) {
        trackDbValues.value = editData.trackDbValues;
      }

      // Load aspect framing data
      if (editData.aspectFraming) {
        const savedRatios = editData.aspectFraming.selectedRatios || [];
        // Ensure 16:9 (Original) is always included
        if (!savedRatios.includes('16:9')) {
          savedRatios.unshift('16:9');
        }
        selectedAspectRatios.value = savedRatios;
        framingMode.value = editData.aspectFraming.framingMode || 'auto';
        framingConfigs.value = editData.aspectFraming.configs || {};
      }

      // Load subtitle settings
      if (editData.subtitleSettings) {
        subtitleSettings.value = {
          ...getDefaultSubtitleSettings(),
          ...editData.subtitleSettings,
        };
      }

      audioTracks.value = fullEdit.audioTracks.map((t) => ({
        id: t.id,
        filePath: t.file_path,
        name: t.name,
        startTime: t.start_time,
        endTime: t.end_time,
        volume: t.volume,
        fadeIn: t.fade_in,
        fadeOut: t.fade_out,
        trackOrder: t.track_order,
        isMuted: !!t.is_muted,
        isSolo: !!t.is_solo,
      }));

      textOverlays.value = fullEdit.textOverlays.map((o) => ({
        id: o.id,
        text: o.text,
        startTime: o.start_time,
        endTime: o.end_time,
        position: { x: o.position_x, y: o.position_y },
        style: JSON.parse(o.style_data || '{}'),
        perRatioConfigs: o.per_ratio_configs_data ? JSON.parse(o.per_ratio_configs_data) : undefined,
        previewHeight: o.preview_height ?? undefined,
        animation: o.animation as any,
      }));

      stickers.value = fullEdit.stickers.map((s) => ({
        id: s.id,
        stickerPath: s.sticker_path,
        stickerType: s.sticker_type as any,
        startTime: s.start_time,
        endTime: s.end_time,
        position: { x: s.position_x, y: s.position_y },
        scale: s.scale,
        rotation: s.rotation,
        animation: s.animation as any,
        perRatioConfigs: s.per_ratio_configs_data ? JSON.parse(s.per_ratio_configs_data) : undefined,
      }));

      // Load watermarks - convert file paths to data URLs for preview
      watermarks.value = await Promise.all(
        fullEdit.watermarks.map(async (w) => {
          // Convert file path to data URL for preview display
          let previewUrl = w.preview_url;
          if (!previewUrl && w.watermark_path) {
            try {
              previewUrl = await invoke<string>('read_file_as_data_url', {
                filePath: w.watermark_path,
              });
            } catch (err) {
              console.warn('[ClipEditorDialog] Failed to load watermark preview:', w.id, err);
              // Use a fallback placeholder
              previewUrl =
                'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjNzg1MDAwIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjUwIiByPSIyMCIgZmlsbD0iI0Y1OUUwQiIvPgo8dGV4dCB4PSIxMDAiIHk9Ijk1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiNGRkZGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPldhdGVybWFyazwvdGV4dD4KPC9zdmc+';
            }
          }

          return {
            id: w.id,
            watermarkId: w.watermark_id,
            filePath: w.watermark_path, // Actual file path for export
            previewUrl: previewUrl || w.watermark_path, // Data URL for display
            startTime: w.start_time,
            endTime: w.end_time,
            position: { x: w.position_x, y: w.position_y },
            scale: w.scale,
            opacity: w.opacity,
            perRatioConfigs: w.per_ratio_configs_data ? JSON.parse(w.per_ratio_configs_data) : undefined,
          };
        })
      );

      // Load creator profile watermark if one exists for this clip's project
      console.log('[ClipEditorDialog] Checking for creator profile watermark (clip mode), clipId:', props.clipId);
      try {
        if (props.clipId) {
          // Get the clip to find its project_id
          const clip = await getClipWithBuildStatus(props.clipId);
          const clipProjectId = clip?.project_id;
          console.log('[ClipEditorDialog] Clip project ID:', clipProjectId);

          if (clipProjectId) {
            const { getCreatorProfileByProjectId } = await import('@/services/database');
            const creatorProfile = await getCreatorProfileByProjectId(clipProjectId);
            console.log('[ClipEditorDialog] Creator profile found (clip mode):', creatorProfile ? 'YES' : 'NO');

            if (creatorProfile && creatorProfile.watermark_settings) {
              console.log('[ClipEditorDialog] Watermark settings (clip mode):', creatorProfile.watermark_settings);
              const watermarkSettings = JSON.parse(creatorProfile.watermark_settings);

              // Check if this creator watermark is already in the list
              const hasCreatorWatermark = watermarks.value.some((w) => w.watermarkId === creatorProfile.watermark_id);

              if (!hasCreatorWatermark && watermarkSettings.watermarkPath) {
                console.log('[ClipEditorDialog] Adding creator profile watermark for clip mode');
                console.log('[ClipEditorDialog] Watermark path (clip mode):', watermarkSettings.watermarkPath);
                console.log('[ClipEditorDialog] Current watermarks count (clip mode):', watermarks.value.length);

                // Load watermark preview
                let previewUrl = watermarkSettings.watermarkPath;
                try {
                  previewUrl = await invoke<string>('read_file_as_data_url', {
                    filePath: watermarkSettings.watermarkPath,
                  });
                } catch (err) {
                  console.warn('[ClipEditorDialog] Failed to load creator watermark preview:', err);
                }

                // Add creator watermark to the list
                watermarks.value.push({
                  id: `creator-watermark-${creatorProfile.id}`,
                  watermarkId: creatorProfile.watermark_id || undefined,
                  filePath: watermarkSettings.watermarkPath,
                  previewUrl: previewUrl,
                  startTime: 0,
                  endTime: 999999, // Show throughout entire clip
                  position: {
                    x: watermarkSettings.position?.x ?? 0.9,
                    y: watermarkSettings.position?.y ?? 0.9,
                  },
                  scale: watermarkSettings.scale ?? 0.15,
                  opacity: watermarkSettings.opacity ?? 1.0,
                  perRatioConfigs: watermarkSettings.perRatioConfigs,
                });
              }
            }
          }
        }
      } catch (error) {
        console.warn('[ClipEditorDialog] Failed to load creator profile watermark:', error);
      }

      effects.value = fullEdit.effects.map((e) => ({
        id: e.id,
        type: e.effect_type as any,
        startTime: e.start_time,
        endTime: e.end_time,
        settings: JSON.parse(e.settings || '{}'),
      }));
    } else if (props.clipSegments && props.clipSegments.length > 0) {
      // No edit data exists yet, initialize from clip's segments
      trimSegments.value = props.clipSegments.map((seg, index) => ({
        id: `segment-${index}`,
        startTime: seg.start_time - props.clipStartTime,
        endTime: seg.end_time - props.clipStartTime,
        isDeleted: false,
      }));
    }
  }

  // Load video path and thumbnail for aspect tab
  async function loadVideoInfo() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // We need the project ID to get the raw video path
      // The clip ID should have a corresponding clip record with project_id
      // For now, we'll extract it from the videoSrc if available
      if (props.videoSrc) {
        // Try to decode the video path from the URL
        // Format is typically: http://localhost:PORT/video/BASE64_ENCODED_PATH
        const match = props.videoSrc.match(/\/video\/([^?]+)/);
        if (match) {
          try {
            // Decode base64 path
            const decoded = atob(match[1]);
            videoPath.value = decoded;
          } catch {
            // If decoding fails, the path might already be plain
            videoPath.value = null;
          }
        }
      }

      // Generate thumbnail for the aspect tab preview
      if (videoPath.value) {
        try {
          const thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
            videoPath: videoPath.value,
            timestampSeconds: props.clipStartTime + 1,
            outputFilename: `aspect_preview_${props.clipId}`,
          });

          const dataUrl = await invoke<string>('read_file_as_data_url', {
            filePath: thumbnailPath,
          });

          thumbnailUrl.value = dataUrl;
        } catch (err) {
          console.warn('[ClipEditorDialog] Failed to generate thumbnail:', err);
        }
      }
    } catch (err) {
      console.error('[ClipEditorDialog] Failed to load video info:', err);
    }
  }

  // Keyboard shortcuts
  function handleKeyDown(e: KeyboardEvent) {
    if (!props.modelValue) return;

    // Don't handle shortcuts if user is typing in input fields
    const isTyping = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

    // Debug log for redo keys
    if (e.key === 'z' || e.key === 'y') {
      console.log('[handleKeyDown] Key pressed:', e.key, {
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        shift: e.shiftKey,
        isTyping,
      });
    }

    if (e.key === 'Escape') {
      close();
    } else if (e.key === ' ' && !isTyping) {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveNow(); // Save immediately on Ctrl+S
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !isTyping) {
      console.log('[handleKeyDown] Undo triggered');
      e.preventDefault();
      performUndo();
    } else if (
      ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) || (e.key === 'y' && (e.ctrlKey || e.metaKey))) &&
      !isTyping
    ) {
      console.log('[handleKeyDown] Redo triggered!');
      e.preventDefault();
      performRedo();
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey) && !isTyping) {
      e.preventDefault();
      performCopy();
    } else if (e.key === 'v' && (e.ctrlKey || e.metaKey) && !isTyping) {
      e.preventDefault();
      performPaste();
    } else if (e.key === 'Delete' && !isTyping) {
      e.preventDefault();
      if (selectedMarkerId.value) {
        // Delete selected marker
        deleteMarker(selectedMarkerId.value);
      } else if (selectedSegmentIds.value.size > 0) {
        // Delete selected segments
        performMultiDelete();
      }
    } else if (e.key === 'm' && !isTyping) {
      e.preventDefault();
      addMarkerAtPlayhead();
    }
  }

  // Undo/Redo operations
  async function performUndo() {
    try {
      await commandHistory.undo();
      undoRedoTrigger.value++; // Trigger reactivity update for button states
      console.log('[ClipEditorDialog] ✅ Undo successful');
    } catch (error) {
      console.error('[ClipEditorDialog] Undo failed:', error);
      alert('Could not undo the last operation');
    }
  }

  async function performRedo() {
    try {
      console.log('[ClipEditorDialog] Attempting redo...');
      console.log('[ClipEditorDialog] Can redo?', commandHistory.canRedo());
      console.log('[ClipEditorDialog] Redo stack size:', commandHistory.getRedoStackSize());
      await commandHistory.redo();
      undoRedoTrigger.value++; // Trigger reactivity update for button states
      console.log('[ClipEditorDialog] ✅ Redo successful');
    } catch (error) {
      console.error('[ClipEditorDialog] Redo failed:', error);
      alert('Could not redo the operation');
    }
  }

  // Copy/Paste operations
  async function performCopy() {
    // Get the currently selected segment
    // For now, we'll copy the segment at the current playhead position
    if (!editorMode.value && props.clipId) {
      try {
        const segments = await getClipSegmentsByClipId(props.clipId);
        const currentRelativeTime = previewTime.value - props.clipStartTime;

        // Find the segment that contains the current playhead position
        const segmentToCopy = segments.find(
          (seg) =>
            currentRelativeTime >= seg.start_time - props.clipStartTime &&
            currentRelativeTime < seg.end_time - props.clipStartTime
        );

        if (segmentToCopy) {
          copiedSegment.value = segmentToCopy;
          console.log('[ClipEditorDialog] ✅ Copied segment:', {
            start: segmentToCopy.start_time,
            end: segmentToCopy.end_time,
            duration: segmentToCopy.duration,
          });
          console.log('[ClipEditorDialog] Segment copied to clipboard. Press Ctrl+V to paste.');
        } else {
          console.warn('[ClipEditorDialog] No segment at playhead to copy');
          alert('No segment at current position');
        }
      } catch (error) {
        console.error('[ClipEditorDialog] Copy failed:', error);
        alert('Could not copy segment');
      }
    } else {
      // TODO: Implement for editor mode
      console.log('[ClipEditorDialog] Copy not yet implemented for editor mode');
    }
  }

  async function performPaste() {
    if (!copiedSegment.value) {
      console.warn('[ClipEditorDialog] No segment in clipboard to paste');
      alert('No segment copied. Press Ctrl+C to copy a segment first.');
      return;
    }

    if (!editorMode.value && props.clipId) {
      try {
        const currentRelativeTime = previewTime.value - props.clipStartTime;

        // Create reload callback
        const reloadCallback = async () => {
          const dbSegments = await getClipSegmentsByClipId(props.clipId!);
          if (dbSegments && dbSegments.length > 0) {
            trimSegments.value = dbSegments.map((seg, index) => ({
              id: `segment-${index}`,
              startTime: seg.start_time - props.clipStartTime,
              endTime: seg.end_time - props.clipStartTime,
              isDeleted: false,
            }));
          }
          emit('save', props.clipId!);
        };

        // Create and execute paste command
        const pasteCommand = new PasteCommand(false, {
          clipId: props.clipId,
          clipStartTime: props.clipStartTime,
          pasteAtTime: currentRelativeTime,
          copiedSegment: copiedSegment.value,
          onReload: reloadCallback,
        });

        await commandHistory.executeCommand(pasteCommand);
        undoRedoTrigger.value++; // Trigger reactivity update for button states

        console.log('[ClipEditorDialog] ✅ Paste successful - segment added at playhead position');
      } catch (error) {
        console.error('[ClipEditorDialog] Paste failed:', error);
        alert(`Could not paste segment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // TODO: Implement for editor mode
      console.log('[ClipEditorDialog] Paste not yet implemented for editor mode');
    }
  }

  // ============================================================================
  // MULTI-SELECT HANDLERS
  // ============================================================================

  function handleSegmentSelect(segmentId: string, modifiers: { shift: boolean; ctrl: boolean }) {
    console.log('[ClipEditorDialog] Segment select:', { segmentId, modifiers });

    if (modifiers.shift && lastSelectedSegmentId.value) {
      // Shift+Click: Select range
      selectSegmentRange(lastSelectedSegmentId.value, segmentId);
    } else if (modifiers.ctrl) {
      // Ctrl+Click: Toggle selection
      if (selectedSegmentIds.value.has(segmentId)) {
        selectedSegmentIds.value.delete(segmentId);
      } else {
        selectedSegmentIds.value.add(segmentId);
      }
      lastSelectedSegmentId.value = segmentId;
    } else {
      // Regular click: Select only this segment
      selectedSegmentIds.value.clear();
      selectedSegmentIds.value.add(segmentId);
      lastSelectedSegmentId.value = segmentId;
    }

    console.log('[ClipEditorDialog] Selected segments:', Array.from(selectedSegmentIds.value));
  }

  function selectSegmentRange(fromId: string, toId: string) {
    // Find indices of both segments
    const fromIndex = trimSegments.value.findIndex((seg) => seg.id === fromId);
    const toIndex = trimSegments.value.findIndex((seg) => seg.id === toId);

    if (fromIndex === -1 || toIndex === -1) return;

    // Select all segments in range
    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);

    for (let i = startIndex; i <= endIndex; i++) {
      selectedSegmentIds.value.add(trimSegments.value[i].id);
    }
  }

  function clearSelection() {
    selectedSegmentIds.value.clear();
    lastSelectedSegmentId.value = null;
  }

  async function performMultiDelete() {
    if (selectedSegmentIds.value.size === 0) return;

    console.log('[ClipEditorDialog] Multi-delete:', Array.from(selectedSegmentIds.value));

    // For now, delete one at a time (simple approach)
    // TODO: Create a MultiDeleteCommand for better undo/redo
    for (const segmentId of selectedSegmentIds.value) {
      // Find the actual segment index
      const segmentIndex = trimSegments.value.findIndex((s) => s.id === segmentId);
      if (segmentIndex !== -1) {
        await deleteTrimSegment(segmentId);
      }
    }

    // Clear selection after delete
    clearSelection();
  }

  // ============================================================================
  // TIMELINE MARKERS
  // ============================================================================

  function addMarkerAtPlayhead() {
    const currentTime = previewTime.value;
    const markerId = `marker-${Date.now()}`;

    const newMarker: TimelineMarker = {
      id: markerId,
      time: currentTime,
      label: `Marker ${markers.value.length + 1}`,
    };

    markers.value.push(newMarker);
    markers.value.sort((a, b) => a.time - b.time); // Keep sorted by time

    console.log('[ClipEditorDialog] Added marker at', currentTime, 'seconds');

    // TODO: Add MarkerCommand for undo/redo support
  }

  function deleteMarker(markerId: string) {
    const index = markers.value.findIndex((m) => m.id === markerId);
    if (index !== -1) {
      markers.value.splice(index, 1);
      selectedMarkerId.value = null;
      console.log('[ClipEditorDialog] Deleted marker', markerId);
    }

    // TODO: Add MarkerCommand for undo/redo support
  }

  function jumpToMarker(markerId: string) {
    const marker = markers.value.find((m) => m.id === markerId);
    if (marker) {
      seekTo(marker.time);
      selectedMarkerId.value = markerId;
      console.log('[ClipEditorDialog] Jumped to marker at', marker.time, 'seconds');
    }
  }

  // ============================================================================
  // VIDEO HANDLERS
  // ============================================================================

  // Handle video element loaded - apply any pending seek
  function onVideoLoaded() {
    if (!editorMode.value || !videoElement.value) return;

    const wasPlaying = isPlaying.value;
    const source = activeVideoSource.value;

    if (source) {
      // Update current source ID tracking
      currentVideoSourceId.value = source.id;

      // Apply pending seek if there is one
      if (pendingSeekTime.value !== null) {
        videoElement.value.currentTime = pendingSeekTime.value;
        pendingSeekTime.value = null;
      }

      // Continue playing if we were playing before the source change
      if (wasPlaying) {
        videoElement.value
          .play()
          .then(() => {
            // Hide the transition frame once video starts playing
            // Small delay to ensure first frame is rendered
            requestAnimationFrame(() => {
              hideTransitionFrame();
            });
          })
          .catch((err) => {
            console.warn('[ClipEditorDialog] Could not resume playback:', err);
            hideTransitionFrame();
          });
      } else {
        // If not playing, hide transition frame immediately
        hideTransitionFrame();
      }
    }

    // Clear seeking flag
    setTimeout(() => {
      isSeeking.value = false;
    }, 50);
  }

  // Watch for video source changes in editor mode
  watch(
    () => editorVideoSrc.value,
    async (newSrc, oldSrc) => {
      console.log(
        '[watch editorVideoSrc] Changed from',
        oldSrc?.slice(-30),
        'to',
        newSrc?.slice(-30),
        'crossfadeStarted:',
        crossfadeStarted.value,
        'activeTransition:',
        !!activeTransition.value
      );

      if (editorMode.value && newSrc && newSrc !== oldSrc && videoElement.value) {
        // Skip processing if the preload video is the active one
        // This happens after crossfade completes - the main video's src changes
        // but we're already playing the preload video, so no action needed
        const preloadEl = previewRef.value?.getPreloadVideoElement?.();
        if (preloadEl && videoElement.value === preloadEl) {
          // We're using the preload video as active - don't reload/seek main video
          console.log('[watch editorVideoSrc] Skipping - preload is active');
          return;
        }

        console.log('[watch editorVideoSrc] Setting isSeeking=true');
        isSeeking.value = true;

        // If there's no pending seek, calculate the seek time for the new source
        if (pendingSeekTime.value === null) {
          const source = activeVideoSource.value;
          if (source) {
            pendingSeekTime.value = previewTime.value - source.start_time + source.trim_start;
            console.log('[watch editorVideoSrc] Set pendingSeekTime:', pendingSeekTime.value);
          }
        }

        // Track if handleLoaded has been called to prevent double calls
        let loadedHandled = false;
        let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;

        const handleLoaded = () => {
          if (loadedHandled) return;
          loadedHandled = true;
          if (fallbackTimeout) {
            clearTimeout(fallbackTimeout);
            fallbackTimeout = null;
          }
          videoElement.value?.removeEventListener('loadeddata', handleLoaded);
          videoElement.value?.removeEventListener('canplay', handleLoaded);
          onVideoLoaded();
        };

        // Wait for next tick to ensure src has been applied to the element
        await nextTick();

        // Listen for the video to be ready
        if (videoElement.value) {
          // Listen for both loadeddata and canplay events for broader browser support
          videoElement.value.addEventListener('loadeddata', handleLoaded);
          videoElement.value.addEventListener('canplay', handleLoaded);

          // Force the video to start loading the new source
          // This is necessary because changing src doesn't always trigger a load in all browsers
          videoElement.value.load();

          // Check if video is already loaded (e.g., from browser cache)
          // readyState >= 2 (HAVE_CURRENT_DATA) means enough data is available
          // We need to wait a microtask for the load() call to update readyState
          await Promise.resolve();
          if (videoElement.value && videoElement.value.readyState >= 2) {
            console.log('[watch editorVideoSrc] Video already ready, calling handleLoaded directly');
            handleLoaded();
          } else {
            // Fallback: if video doesn't load within 2 seconds, try to proceed anyway
            // This handles edge cases where events might not fire
            fallbackTimeout = setTimeout(() => {
              if (!loadedHandled && videoElement.value) {
                console.warn('[watch editorVideoSrc] Fallback timeout - proceeding with seek');
                handleLoaded();
              }
            }, 2000);
          }
        }
      }
    }
  );

  // Auto-save watchers - trigger save when data changes
  watch(
    () => filterSegments.value,
    () => triggerAutoSave(),
    { deep: true }
  );

  watch(
    () => trimSegments.value,
    () => triggerAutoSave(),
    { deep: true }
  );

  watch(
    () => originalDb.value,
    () => triggerAutoSave()
  );

  watch(
    () => trackDbValues.value,
    () => triggerAutoSave(),
    { deep: true }
  );

  watch(
    () => selectedAspectRatios.value,
    () => triggerAutoSave(),
    { deep: true }
  );

  watch(
    () => framingMode.value,
    () => triggerAutoSave()
  );

  watch(
    () => framingConfigs.value,
    () => triggerAutoSave(),
    { deep: true }
  );

  // Watch for clip ID changes - clear command history when switching clips
  watch(
    () => props.clipId,
    (newClipId, oldClipId) => {
      if (newClipId && oldClipId && newClipId !== oldClipId) {
        commandHistory.clear();
        console.log('[ClipEditorDialog] Clip changed, command history cleared:', { oldClipId, newClipId });
      }
    }
  );

  // Watch for editor project ID changes - clear command history when switching projects
  watch(
    () => props.editorProjectId,
    (newProjectId, oldProjectId) => {
      if (newProjectId && oldProjectId && newProjectId !== oldProjectId) {
        commandHistory.clear();
        console.log('[ClipEditorDialog] Editor project changed, command history cleared:', {
          oldProjectId,
          newProjectId,
        });
      }
    }
  );

  // Lifecycle
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen) {
        isInitialLoad.value = true; // Prevent auto-save during load

        // Clear command history when opening a clip/project
        // This ensures each clip/project starts with a fresh undo/redo stack
        commandHistory.clear();
        console.log('[ClipEditorDialog] Command history cleared for new clip/project');

        if (editorMode.value && editorProjectId.value) {
          // Editor mode - load video sources
          await loadEditorProject();
          await loadProjectId(); // Load project ID for transcript/subtitles
          previewTime.value = 0;
          activeEditorTab.value = 'sources';

          // Auto-apply creator watermark if available (from props or video sources)
          await applyCreatorWatermark();
        } else if (props.clipId) {
          // Clip mode - existing behavior
          await loadEditData();
          await loadProjectId();

          // Auto-apply creator watermark if provided and no existing watermarks
          await applyCreatorWatermark();

          // Initialize to clip start time (absolute time)
          previewTime.value = props.clipStartTime;

          // Set up audio elements for existing tracks
          for (const track of audioTracks.value) {
            if (!audioElements.value.has(track.id)) {
              await setupAudioElement(track);
            }
          }

          // Apply initial volume to video (convert dB to linear gain)
          if (videoElement.value) {
            const linearGain = Math.pow(10, originalDb.value / 20);
            videoElement.value.volume = Math.min(1, linearGain);
          }

          // Load video info for aspect tab
          await loadVideoInfo();
        }

        // Allow auto-save after initial load is complete
        setTimeout(() => {
          isInitialLoad.value = false;
        }, 100);
      } else if (!isOpen) {
        // Save any pending changes before closing
        if (saveTimeout) {
          clearTimeout(saveTimeout);
          saveTimeout = null;
        }

        // Use computed editorMode/editorProjectId to handle promoted state
        if (editorMode.value && editorProjectId.value) {
          emit('editorSave', editorProjectId.value);
        } else {
          await performSave();
        }

        // Clean up when dialog closes
        cleanupAudioElements();
        isPlaying.value = false;
        // Clear command history when closing
        commandHistory.clear();
        console.log('[ClipEditorDialog] Command history cleared on close');
        // Reset aspect tab state
        videoPath.value = null;
        thumbnailUrl.value = null;
        editorThumbnailUrl.value = null;
        // Reset transcript state
        projectId.value = null;
        // Reset auto-save state
        isSaving.value = false;
        lastSaved.value = false;
        isInitialLoad.value = true;
        // Reset editor mode state
        videoSources.value = [];
        videoEditorEditId.value = null;
        // Reset promotion state
        isPromotedToEditorMode.value = false;
        promotedProjectId.value = null;
        promotedProjectName.value = '';
        // Reset intro/outro state
        currentIntro.value = null;
        currentOutro.value = null;
      }
    }
  );

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
    cleanupAudioElements();
    // Clear any pending save timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    // Clear command history when closing editor
    commandHistory.clear();
  });
</script>

<style scoped>
  /* Backdrop blur effects */
  .backdrop-blur-sm {
    backdrop-filter: blur(4px);
  }

  /* Smooth transitions */
  .transition-colors {
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }

  /* Ensure proper z-index layering */
  .z-50 {
    z-index: 50;
  }
</style>
