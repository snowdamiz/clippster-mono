<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div
        ref="dialogRef"
        class="bg-[var(--sidebar-surface,#0c0c0c)] border border-white/[0.08] rounded-2xl w-[calc(100%-60px)] h-[calc(100%-80px)] mt-[60px] mx-[30px] mb-[33px] max-w-[1800px] max-h-[950px] flex flex-col overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.6),0_0_1px_rgba(255,255,255,0.1)] max-[1200px]:m-5 max-[1200px]:w-[calc(100%-40px)] max-[1200px]:h-[calc(100%-40px)] max-[1200px]:rounded-xl"
        role="dialog"
        aria-modal="true"
      >
        <!-- Header -->
        <div class="flex items-center justify-between py-2 px-3 bg-black/40 border-b border-white/[0.08] shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="flex items-center justify-center w-[26px] h-[26px] rounded-md bg-gradient-to-br from-sky-500/20 to-sky-400/15 border border-sky-500/30 text-sky-400 shrink-0"
            >
              <Film :size="14" />
            </div>
            <h2
              class="text-sm font-semibold text-[var(--sidebar-text,#f4f4f5)] m-0 tracking-tight whitespace-nowrap"
              :title="editorMode ? editorProjectName : clipTitle"
            >
              {{ editorMode ? 'Video Editor' : 'Edit Clip' }}
            </h2>
            <div class="w-px h-4 bg-white/10"></div>
            <p class="text-xs text-white/50 m-0 overflow-hidden text-ellipsis whitespace-nowrap max-w-[300px]">
              {{ editorMode ? editorProjectName : clipTitle }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <!-- Auto-save indicator -->
            <div v-if="isSaving" class="flex items-center gap-1.5 text-xs text-zinc-500">
              <Loader2 :size="12" class="animate-spin" />
              <span>Saving...</span>
            </div>
            <div v-else-if="lastSaved" class="flex items-center gap-1.5 text-xs text-green-500">
              <Check :size="12" />
              <span>Saved</span>
            </div>
            <button
              @click="close"
              class="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-md text-zinc-500 cursor-pointer transition-all duration-150 shrink-0 hover:bg-white/[0.08] hover:text-zinc-100"
              title="Close (Esc)"
            >
              <X :size="16" />
            </button>
          </div>
        </div>

        <!-- Main Content Area -->
        <div class="flex flex-col flex-1 min-h-0">
          <!-- Top Row: Preview and Controls -->
          <div class="flex min-h-[340px] border-b border-white/[0.08] flex-[0.55] overflow-hidden">
            <!-- Left: Video Preview Section -->
            <div
              class="w-1/2 min-w-0 border-r border-white/[0.08] flex flex-col items-center p-4 bg-gradient-to-b from-black/20 to-transparent max-[1200px]:w-1/2"
            >
              <div class="flex-1 min-h-0 min-w-0 max-w-full w-full flex flex-row items-stretch gap-3">
                <!-- Aspect Ratio Selector (left side of video) -->
                <AspectRatioSelector
                  :preview-aspect-ratio="previewAspectRatio"
                  :selected-aspect-ratios="selectedAspectRatios"
                  :framing-configs="framingConfigs"
                  :framing-mode="framingMode"
                  @update:preview-aspect-ratio="(ratio: string) => (previewAspectRatio = ratio)"
                  @open-manual-editor="openManualPOIEditor"
                  @toggle-ratio-selection="toggleAspectRatio"
                />

                <div class="flex-1 min-w-0 min-h-0 flex flex-col items-center justify-start overflow-hidden relative">
                  <ClipEditorPreview
                    ref="previewRef"
                    :video-src="effectiveVideoSrc"
                    :preload-video-src="preloadVideoSrc"
                    :segment-preview-src="segmentPreviewStreamingUrl"
                    :segment-time-map="segmentTimeMap"
                    :is-generating-preview="isGeneratingPreview"
                    :current-time="previewTime"
                    :effective-time="effectivePreviewTime"
                    :is-playing="isPlaying"
                    :clip-start="clipStartTime"
                    :clip-end="clipEndTime"
                    :text-overlays="textOverlays"
                    :stickers="stickers"
                    :watermarks="watermarks"
                    :creator-profile-watermark-settings="computedCreatorProfileWatermarkSettings"
                    :filter-settings="activeFilterSettings"
                    :segments="playbackSegments"
                    :preview-aspect-ratio="previewAspectRatio"
                    :selected-aspect-ratios="selectedAspectRatios"
                    :framing-configs="effectiveFramingConfigs"
                    :subtitle-settings="subtitleSettings"
                    :transcript-words="transcriptWords"
                    :transcript-segments="transcriptSegments"
                    :subtitle-source-time="subtitleSourceTime"
                    :editor-mode="editorMode"
                    :editor-total-duration="editorContentDuration"
                    :active-transition="activeTransition"
                    :video-sources="videoSources"
                    :tracks="timelineTracks"
                    :is-video-muted="isVideoMuted"
                    :audio-tracks="audioTracks"
                    :audio-effects="audioEffects"
                    :selected-item-ids="selectedItemIds"
                    @time-update="onPreviewTimeUpdate"
                    @toggle-play="togglePlay"
                    @video-element-ready="onVideoElementReady"
                    @video-swapped="onVideoSwapped"
                    @crossfade-completed="onCrossfadeCompleted"
                    @update-overlay-position="onUpdateOverlayPosition"
                    @update-overlay-width="onUpdateOverlayWidth"
                    @update-overlay-rotation="onUpdateOverlayRotation"
                    @update-overlay-scale="onUpdateOverlayScale"
                    @update-sticker-scale="onUpdateStickerScale"
                    @update-sticker-rotation="onUpdateStickerRotation"
                    @update-watermark-scale="onUpdateWatermarkScale"
                    @update-subtitle-position="onUpdateSubtitlePosition"
                    @update-subtitle-max-width="onUpdateSubtitleMaxWidth"
                    @overlay-drag-end="onOverlayPositionChangeComplete"
                    @overlay-resize-end="onOverlayWidthChangeComplete"
                    @overlay-rotate-end="onOverlayRotationChangeComplete"
                    @overlay-scale-end="onOverlayScaleChangeComplete"
                    @sticker-resize-end="onStickerScaleChangeComplete"
                    @sticker-rotate-end="onStickerRotationChangeComplete"
                    @watermark-resize-end="onWatermarkScaleChangeComplete"
                    @video-ended="onVideoEnded"
                    @track-item-select="onTrackItemSelect"
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
            </div>

            <!-- Right: Controls Section -->
            <div
              class="w-1/2 min-w-0 flex flex-row flex-1 bg-gradient-to-b from-transparent to-black/15 max-[1200px]:w-1/2"
            >
              <!-- Vertical Toolbar (Left side) -->
              <ClipEditorToolbar
                :active-tab="editorMode ? activeEditorTab : activeTab"
                :editor-mode="editorMode"
                @tab-change="(tab) => (editorMode ? setEditorTab(tab) : setActiveTab(tab))"
              />

              <!-- Main Controls Area (Right side) -->
              <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
                <!-- Keyframe Inspector (Top of panel when selected) -->
                <div v-if="selectedKeyframe" class="p-4 border-b border-white/10 bg-black/30">
                  <div class="flex justify-between items-center mb-2">
                    <h3 class="text-xs font-semibold text-white/70 uppercase tracking-wider m-0">Keyframe Editor</h3>
                    <button
                      @click="selectedKeyframe = null"
                      class="flex items-center justify-center p-1 bg-transparent border-none rounded cursor-pointer transition-all duration-150 text-white/50 hover:bg-white/10 hover:text-white"
                      title="Close Inspector"
                    >
                      <X :size="14" />
                    </button>
                  </div>
                  <KeyframeInspector
                    :keyframe="selectedKeyframe.keyframe"
                    @update="updateKeyframe"
                    @delete="deleteKeyframe"
                  />
                </div>

                <!-- Tab Content -->
                <div class="flex-1 overflow-y-auto p-4 tab-content-scrollbar">
                  <!-- Media Tab (Sources + Intro/Outro + Project Media) -->
                  <MediaTab
                    v-if="editorMode ? activeEditorTab === 'media' : activeTab === 'media'"
                    :project-id="editorProjectId"
                    :current-intro="currentIntro"
                    :current-outro="currentOutro"
                    :watermarks="watermarks"
                    :preview-aspect-ratio="previewAspectRatio"
                    :selected-aspect-ratios="selectedAspectRatios"
                    :framing-configs="framingConfigs"
                    :duration="totalSegmentDuration"
                    :current-time="effectivePreviewTime"
                    @add-source="onAddSource"
                    @import-file="onImportFile"
                    @add-project-media="onAddProjectMedia"
                    @add-intro="onAddIntro"
                    @add-outro="onAddOutro"
                    @remove-intro="onRemoveIntro"
                    @remove-outro="onRemoveOutro"
                    @add-watermark="addWatermarkLocal"
                    @update-watermark="updateWatermarkLocal"
                    @delete-watermark="deleteWatermarkLocal"
                    @update:preview-aspect-ratio="previewAspectRatio = $event"
                  />

                  <!-- Audio Tab -->
                  <AudioMixerTab
                    v-if="editorMode ? activeEditorTab === 'audio' : activeTab === 'audio'"
                    :audio-tracks="audioTracks"
                    :original-db="originalDb"
                    :track-db-values="trackDbValues"
                    :current-time="effectivePreviewTime"
                    @add-track="(filePath, name, duration) => addAudioTrack(filePath, name, duration)"
                    @update-track="updateAudioTrackLocal"
                    @delete-track="deleteAudioTrackLocal"
                    @update-original-db="updateOriginalDb"
                    @update-track-db="updateTrackDb"
                    @update-track-pan="updateTrackPan"
                    @add-keyframe="addKeyframe"
                    @update-audio-effects="(effects) => (audioEffects = effects)"
                  />

                  <!-- Overlays Tab (Text + Stickers) -->
                  <OverlaysTab
                    v-if="editorMode ? activeEditorTab === 'overlays' : activeTab === 'overlays'"
                    :text-overlays="textOverlays"
                    :stickers="stickers"
                    :current-time="effectivePreviewTime"
                    :duration="totalSegmentDuration"
                    :preview-aspect-ratio="previewAspectRatio"
                    :selected-aspect-ratios="selectedAspectRatios"
                    :framing-configs="framingConfigs"
                    :video-dimensions="videoDimensions"
                    @add-text="addTextOverlay"
                    @update-text="updateTextOverlayLocal"
                    @delete-text="deleteTextOverlayLocal"
                    @add-sticker="addStickerLocal"
                    @update-sticker="updateStickerLocal"
                    @delete-sticker="deleteStickerLocal"
                    @update:preview-aspect-ratio="(ratio: string) => (previewAspectRatio = ratio)"
                  />

                  <!-- Watermark Tab (kept separate) -->
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

                  <!-- Captions Tab (Subtitles + Transcript) -->
                  <CaptionsTab
                    v-if="editorMode ? activeEditorTab === 'captions' : activeTab === 'captions'"
                    :settings="subtitleSettings"
                    :project-id="projectId"
                    :current-time="editorMode ? subtitleSourceTime : effectivePreviewTime"
                    :clip-start-time="editorMode ? sourceVideoMinTime : props.clipStartTime"
                    :clip-end-time="editorMode ? sourceVideoMaxTime : props.clipEndTime"
                    :duration="totalSegmentDuration"
                    :preview-aspect-ratio="previewAspectRatio"
                    :selected-aspect-ratios="selectedAspectRatios"
                    :framing-configs="framingConfigs"
                    :source-time-ranges="editorMode ? sourceVideoTimeRanges : []"
                    @settings-changed="updateSubtitleSettings"
                    @update:preview-aspect-ratio="previewAspectRatio = $event"
                    @seek-video="seekToAbsoluteTime"
                  />

                  <!-- Aspect Ratios Tab -->
                  <StyleTab
                    v-if="editorMode ? activeEditorTab === 'aspect' : activeTab === 'aspect'"
                    :framing-configs="framingConfigs"
                    :selected-aspect-ratios="selectedAspectRatios"
                    :framing-mode="framingMode"
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

                  <!-- Effects Tab (Transitions + Effects) -->
                  <EffectsTab
                    v-if="editorMode ? activeEditorTab === 'effects' : activeTab === 'effects'"
                    :applied-transitions="clipTransitions"
                    :applied-effects="clipEffects"
                    :current-time="effectivePreviewTime"
                    :duration="totalSegmentDuration"
                    :selected-segment-index="selectedSegmentIndex"
                    @add-transition="onAddTransition"
                    @update-transition="onUpdateTransition"
                    @delete-transition="onDeleteTransition"
                    @add-effect="onAddEffect"
                    @update-effect="onUpdateEffect"
                    @delete-effect="onDeleteEffect"
                  />

                  <ExportTab
                    v-if="editorMode ? activeEditorTab === 'export' : activeTab === 'export'"
                    :clip-id="props.clipId"
                    :project-id="projectId"
                    :selected-aspect-ratios="selectedAspectRatios"
                    :subtitle-settings="subtitleSettings"
                    :framing-mode="framingMode"
                    :framing-configs="framingConfigs"
                    :segment-framing-configs="segmentFramingConfigs"
                    :filter-segments="filterSegments"
                    :text-overlays="textOverlays"
                    :stickers="stickers"
                    :watermarks="watermarks"
                    :audio-tracks="audioTracks"
                    :clip-effects="clipEffects"
                    :audio-effects="audioEffects"
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
                    :creator-profile-watermark-settings="computedCreatorProfileWatermarkSettings"
                    :creator-default-intro="props.creatorDefaultIntro"
                    :creator-default-outro="props.creatorDefaultOutro"
                    @go-to-aspect-tab="editorMode ? setEditorTab('aspect') : setActiveTab('aspect')"
                    @build-started="onBuildStarted"
                    @build-completed="onBuildCompleted"
                    @build-failed="onBuildFailed"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Row: Timeline (balanced real estate, keeps room for multiple tracks) -->
          <div
            class="flex-[0.45] min-h-[320px] sm:min-h-[340px] max-h-[60vh] border-t border-white/[0.08] bg-gradient-to-b from-transparent to-black/25 py-2 px-2 pb-3 overflow-hidden"
          >
            <ClipEditorTimeline
              class="h-full"
              :duration="editorMode ? editorDuration : clipDuration"
              :tracks="timelineTracks"
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
              :video-path="effectiveVideoPath"
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
              :clip-transitions="clipTransitions"
              :clip-effects="clipEffects"
              :is-video-muted="isVideoMuted"
              :is-video-locked="isVideoLocked"
              @seek="seekTo"
              @undo="performUndo"
              @redo="performRedo"
              @segment-select="handleSegmentSelect"
              @marker-click="jumpToMarker"
              @split-trim-segment="splitTrimSegment"
              @delete-trim-segment="deleteTrimSegment"
              @update-audio-track="updateAudioTrackLocal"
              @delete-audio-track="deleteAudioTrackLocal"
              @split-audio-track="splitAudioTrackLocal"
              @update-text-overlay="updateTextOverlayLocal"
              @delete-text-overlay="deleteTextOverlayLocal"
              @split-text-overlay="splitTextOverlayLocal"
              @update-sticker="updateStickerLocal"
              @delete-sticker="deleteStickerLocal"
              @split-sticker="splitStickerLocal"
              @update-watermark="updateWatermarkLocal"
              @delete-watermark="deleteWatermarkLocal"
              @split-watermark="splitWatermarkLocal"
              @update-effect="updateEffectLocal"
              @split-effect="splitEffectLocal"
              @update-filter-segment="updateFilterSegment"
              @split-filter="splitFilterLocal"
              @move-track="moveTrackWithUndo"
              @update-source="updateVideoSource"
              @delete-source="deleteVideoSource"
              @drop-source="onDropSource"
              @transitions-detected="onTransitionsDetected"
              @split-source="splitVideoSource"
              @extracted-audio="onExtractedAudio"
              @ripple-edit="handleRippleEdit"
              @roll-edit="handleRollEdit"
              @slip-edit="handleSlipEdit"
              @slide-edit="handleSlideEdit"
              @update-keyframe-time="updateKeyframeTime"
              @paste-items-in-place="performPasteInPlace"
              @freeze-frame="handleFreezeFrame"
              @add-speed-keyframe="handleAddSpeedKeyframe"
              @update-speed-keyframe="handleUpdateSpeedKeyframe"
              @delete-speed-keyframe="handleDeleteSpeedKeyframe"
              @open-speed-curve-editor="handleOpenSpeedCurveEditor"
              @copy-items="handleCopyItems"
              @paste-items="handlePasteItems"
              @paste-items-to-track="handlePasteItemsToTrack"
              @duplicate-items="handleDuplicateItems"
              @group-items="handleGroupItems"
              @ungroup-items="handleUngroupItems"
              @reorder-track="handleReorderTrack"
              @toggle-track-collapse="handleToggleTrackCollapse"
              @toggle-video-mute="handleToggleVideoMute"
              @toggle-video-lock="handleToggleVideoLock"
              @toggle-audio-lock="handleToggleAudioLock"
              @toggle-audio-mute="handleToggleAudioMute"
              @toggle-audio-solo="handleToggleAudioSolo"
              @toggle-audio-hidden="handleToggleAudioHidden"
              @set-in-point="handleSetInPoint"
              @set-out-point="handleSetOutPoint"
              @clear-in-out-points="handleClearInOutPoints"
              @go-to-in-point="handleGoToInPoint"
              @go-to-out-point="handleGoToOutPoint"
              @add-region="handleAddRegion"
              @update-region="handleUpdateRegion"
              @delete-region="handleDeleteRegion"
              @detect-beat-markers="handleDetectBeatMarkers"
              @clear-beat-markers="handleClearBeatMarkers"
              @configure-segment-framing="handleConfigureSegmentFraming"
              :regions="regions"
              :beat-markers="beatMarkers"
              :in-point="inPoint"
              :out-point="outPoint"
            />
          </div>
        </div>
      </div>

      <!-- Speed Curve Editor Dialog -->
      <div
        v-if="showSpeedCurveEditor"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="closeSpeedCurveEditor"
      >
        <div
          class="bg-[var(--sidebar-surface,#0c0c0c)] border border-white/[0.08] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] w-[600px] max-w-[90vw]"
        >
          <SpeedCurveEditor
            v-if="speedCurveEditorSourceId"
            :source-id="speedCurveEditorSourceId"
            :duration="getSpeedCurveDuration()"
            :speed-keyframes="speedCurveKeyframes"
            @close="closeSpeedCurveEditor"
            @add-keyframe="
              (time: number, speed: number) => handleAddSpeedKeyframe(speedCurveEditorSourceId!, time, speed)
            "
            @update-keyframe="
              (kfId: string, updates: any) => handleUpdateSpeedKeyframe(speedCurveEditorSourceId!, kfId, updates)
            "
            @delete-keyframe="(kfId: string) => handleDeleteSpeedKeyframe(speedCurveEditorSourceId!, kfId)"
            @apply-preset="handleApplySpeedPreset"
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
        :clip-end-time="effectivePOIClipEndTime"
        @confirm="onManualPOIConfigConfirm"
      />

      <!-- Clear In Editor Confirmation Dialog -->
      <ConfirmationModal
        :show="showClearInEditorDialog"
        title="Clear 'In Editor' Status?"
        message="Your clip has been built successfully. Would you like to remove it from the 'In Editor' tracking? The built clip will still be available in My Clips."
        confirm-text="Yes, Clear"
        cancel-text="No, Keep"
        @close="onClearInEditorCancel"
        @confirm="onClearInEditorConfirm"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
  import { Film, X, Loader2, Check } from 'lucide-vue-next';
  import { Separator } from '@/components/ui/separator';
  import {
    CommandHistory,
    SplitCommand,
    DeleteCommand,
    PasteCommand,
    MoveCommand,
    ExtractAudioCommand,
    AddItemCommand,
    ResizeCommand,
    LayerChangeCommand,
    UpdateOverlayPropertyCommand,
    RippleEditCommand,
    RollEditCommand,
    SlipEditCommand,
    SlideEditCommand,
  } from '@/services/commands';
  import { TimelineAdapter } from '@/services/timeline-adapter';
  import type { UpdateOverlayPropertyCommandData } from '@/services/commands';
  import type { ClipSegment as DbClipSegment } from '@/services/database';
  import type { ClipSegment } from '@/types';
  import type {
    VideoEditorAudioTrackRecord,
    VideoEditorTextOverlayRecord,
    VideoEditorStickerRecord,
    VideoEditorWatermarkRecord,
    VideoEditorEffectRecord,
  } from '@/services/database';
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
    SegmentFramingConfigs,
    SegmentFramingConfig,
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
    getRawVideo,
    getClipWithBuildStatus,
    getClip,
    splitClipSegment,
    deleteClipSegment,
    getClipSegmentsByClipId,
    // Video Editor imports
    getVideoEditorSourcesByProjectId,
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
    getWatermarkByServerId,
    getProject,
  } from '@/services/database';
  import { getWatermarkImage } from '@/services/database/watermarks';
  import { getUserOrganizationAssets } from '@/services/organizationAssetsApi';
  import { ensureAssetDownloaded } from '@/services/orgAssetSync';
  import type {
    VideoEditorSource,
    VideoEditorTab,
    SourceItem,
    VideoEditorTransition,
    IntroOutro,
    ClipTransition,
    ClipEffect,
    AudioTrackEffect,
  } from '@/types';
  import { calculateCrossfadeOpacity } from '@/types';

  // Disable attribute inheritance since this component renders a Teleport root
  defineOptions({
    inheritAttrs: false,
  });
  import ClipEditorPreview from './ClipEditorPreview.vue';
  import AspectRatioSelector from './AspectRatioSelector.vue';
  import ClipEditorToolbar from './ClipEditorToolbar.vue';
  import MediaTab from './tabs/MediaTab.vue';
  import AudioMixerTab from './tabs/AudioMixerTab.vue';
  import OverlaysTab from './tabs/OverlaysTab.vue';
  import WatermarkTab from './tabs/WatermarkTab.vue';
  import CaptionsTab from './tabs/CaptionsTab.vue';
  import StyleTab from './tabs/StyleTab.vue';
  import EffectsTab from './tabs/EffectsTab.vue';
  import ExportTab from './tabs/ExportTab.vue';
  import ClipEditorTimeline from './ClipEditorTimeline.vue';
  import ManualPOIEditor from '@/components/poi/ManualPOIEditor.vue';
  import SpeedCurveEditor from './SpeedCurveEditor.vue';
  import KeyframeInspector from './KeyframeInspector.vue';
  // Note: ItemType, Keyframe, EasingType types moved to useKeyframeOperations composable
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import { useTranscriptData } from '@/composables/useTranscriptData';
  import { useUnifiedTracks } from '@/composables/useUnifiedTracks';
  import { useAudioWorker } from '@/composables/useAudioWorker';
  import { useAutoSave } from '@/composables/useAutoSave';
  import { useAudioTrackPlayback } from '@/composables/useAudioTrackPlayback';
  import { useOverlayOperations } from '@/composables/useOverlayOperations';
  import { useTimelineMarkers } from '@/composables/useTimelineMarkers';
  import { useKeyframeOperations } from '@/composables/useKeyframeOperations';
  import {
    useIntroOutroOperations,
    type AppliedIntroOutro,
    type IntroOutroWithOrgProps,
  } from '@/composables/useIntroOutroOperations';
  import { useVideoSourceOperations } from '@/composables/useVideoSourceOperations';
  import { useInEditorClips } from '@/stores/useInEditorClips';
  import { invoke } from '@tauri-apps/api/core';

  // Helper function to load watermark preview URL
  // Handles: local files, URLs, org assets, and data URLs
  async function loadWatermarkPreviewUrl(
    watermarkId: string,
    watermarkPath: string | null,
    existingPreviewUrl: string | null
  ): Promise<string> {
    const PLACEHOLDER_SVG =
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjNzg1MDAwIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjUwIiByPSIyMCIgZmlsbD0iI0Y1OUUwQiIvPgo8dGV4dCB4PSIxMDAiIHk9Ijk1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiNGRkZGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPldhdGVybWFyazwvdGV4dD4KPC9zdmc+';

    // 1. If we already have a valid preview URL (data URL or http URL), use it
    if (existingPreviewUrl) {
      if (existingPreviewUrl.startsWith('data:') || existingPreviewUrl.startsWith('http')) {
        return existingPreviewUrl;
      }
    }

    // 2. If watermark path is a URL, use it directly
    if (watermarkPath && (watermarkPath.startsWith('http://') || watermarkPath.startsWith('https://'))) {
      return watermarkPath;
    }

    // 3. If watermark path is already a data URL, use it
    if (watermarkPath && watermarkPath.startsWith('data:')) {
      return watermarkPath;
    }

    // 4. For org watermarks (org-asset-{serverId}), load from local cache or download
    if (watermarkId.startsWith('org-asset-')) {
      const serverId = parseInt(watermarkId.replace('org-asset-', ''), 10);
      if (!isNaN(serverId)) {
        try {
          // Try local cache first
          const localWatermark = await getWatermarkByServerId(serverId);
          if (localWatermark) {
            return await invoke<string>('read_file_as_data_url', { filePath: localWatermark.file_path });
          }

          // Not cached locally - download through Tauri (bypasses CORS)
          const serverResponse = await getUserOrganizationAssets();
          if (serverResponse.success && serverResponse.assets) {
            const serverAsset = serverResponse.assets.find((a) => a.id === serverId && a.asset_type === 'watermark');
            if (serverAsset && serverAsset.url) {
              // Download and cache the asset locally (bypasses CORS)
              const downloadResult = await ensureAssetDownloaded(serverAsset);
              if (downloadResult.success && downloadResult.filePath) {
                return await invoke<string>('read_file_as_data_url', { filePath: downloadResult.filePath });
              } else {
              }
            }
          }
        } catch (err) {
          console.warn('[ClipEditorDialog] Failed to load org watermark:', watermarkId, err);
        }
      }
    }

    // 5. For regular watermarks, try to load by ID from local database
    if (watermarkId && !watermarkId.startsWith('org-asset-')) {
      try {
        const localWatermark = await getWatermarkImage(watermarkId);
        if (localWatermark) {
          return await invoke<string>('read_file_as_data_url', { filePath: localWatermark.file_path });
        }
      } catch (err) {
        console.warn('[ClipEditorDialog] Failed to load local watermark by ID:', watermarkId, err);
      }
    }

    // 6. Try to read watermark path as a local file
    if (watermarkPath) {
      try {
        return await invoke<string>('read_file_as_data_url', { filePath: watermarkPath });
      } catch (err) {
        console.warn('[ClipEditorDialog] Failed to load watermark from path:', watermarkPath, err);
      }
    }

    // 7. Fallback to placeholder
    return PLACEHOLDER_SVG;
  }

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
      // Creator profile default intro/outro (auto-applied when building)
      creatorDefaultIntro?: IntroOutro | null;
      creatorDefaultOutro?: IntroOutro | null;
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
      creatorDefaultIntro: null,
      creatorDefaultOutro: null,
    }
  );

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'save', clipId: string): void;
    (e: 'editorSave', projectId: string): void;
  }>();

  // In-editor clips store
  const inEditorStore = useInEditorClips();

  // Command history for undo/redo
  const commandHistory = new CommandHistory();

  // Clipboard for copy/paste
  const copiedSegment = ref<DbClipSegment | null>(null);

  // Multi-select state
  const selectedSegmentIds = ref<Set<string>>(new Set());
  const lastSelectedSegmentId = ref<string | null>(null); // For shift+click range selection

  // Track original values for overlay operations (for undo/redo)
  const overlayOperationStartValues = ref<Map<string, { property: string; value: any }>>(new Map());

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

  // Clear In Editor confirmation dialog state
  const showClearInEditorDialog = ref(false);
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

  // Segment preview state - for seamless playback across segment cuts
  const segmentPreviewPath = ref<string | null>(null);
  const isGeneratingPreview = ref(false);
  const previewGenerationError = ref<string | null>(null);
  let previewGenerationTimeout: ReturnType<typeof setTimeout> | null = null;

  // Computed: Segment preview streaming URL (converts file path to HTTP streaming URL)
  const segmentPreviewStreamingUrl = computed(() => {
    if (!segmentPreviewPath.value || !videoServerPort.value) {
      return null;
    }
    const encodedPath = btoa(unescape(encodeURIComponent(segmentPreviewPath.value)));
    return `http://localhost:${videoServerPort.value}/video/${encodedPath}`;
  });

  // Editor state
  const activeTab = ref<ClipEditorTab>('media');
  const activeEditorTab = ref<VideoEditorTab>('media'); // For editor mode
  const isPlaying = ref(false);
  const isVideoMuted = ref(false);
  const isVideoLocked = ref(false);
  const previewTime = ref(0);

  // Video editor mode state
  const videoSources = ref<VideoEditorSource[]>([]);
  const videoServerPort = ref<number | null>(null);
  const isSeeking = ref(false); // Flag to prevent time update feedback loops
  const pendingSeekTime = ref<number | null>(null); // Time to seek to after video source changes
  const shouldResumePlayback = ref(false); // Whether to resume playback after seek completes
  const currentVideoSourceId = ref<string | null>(null); // Track which source is loaded
  const transitionCanvasRef = ref<HTMLCanvasElement | null>(null); // Canvas for transition frame (fallback)
  const showTransitionFrame = ref(false); // Whether to show the transition frame overlay (fallback)

  // Crossfade transition state
  const sourceTransitions = ref<VideoEditorTransition[]>([]); // All detected transitions
  const crossfadeStarted = ref(false); // Whether we've started crossfade for current transition
  const lastCrossfadeTransitionId = ref<string | null>(null); // Track which transition we've started

  /**
   * Centralized computed property that returns the currently active video element.
   * This handles all the different modes and states:
   * - Editor mode: considers crossfade state and active video index
   * - Clip mode: considers framed mode, segment playback, etc.
   * Falls back to the stored videoElement ref if preview component isn't available.
   */
  const activeVideoElement = computed<HTMLVideoElement | null>(() => {
    // First, try to get the active element from the preview component
    // which knows about all the internal video state
    if (previewRef.value?.getActiveVideoElement) {
      const activeEl = previewRef.value.getActiveVideoElement();
      if (activeEl) {
        return activeEl;
      }
    }

    // In editor mode, check if preload video is active (after crossfade)
    if (editorMode.value && previewRef.value) {
      const activePreloadIndex = previewRef.value.activeVideoIndex;
      if (activePreloadIndex === 1) {
        const preloadEl = previewRef.value.getPreloadVideoElement?.();
        if (preloadEl) {
          return preloadEl;
        }
      }
    }

    // Fall back to the stored video element
    return videoElement.value;
  });

  // Intro/Outro state - track currently applied intro and outro
  // AppliedIntroOutro type is imported from useIntroOutroOperations
  const currentIntro = ref<AppliedIntroOutro | null>(null);
  const currentOutro = ref<AppliedIntroOutro | null>(null);

  // Editor mode is now always true when opened with a project ID
  // (clip editor mode has been removed - always use video editor mode)
  const editorMode = computed(() => props.editorMode);

  // Editor project ID and name come directly from props
  const editorProjectId = computed(() => props.editorProjectId);
  const editorProjectName = computed(() => props.editorProjectName);

  // Edit data
  const trimSegments = ref<TrimSegment[]>([]);
  const audioTracks = ref<AudioTrack[]>([]);
  const textOverlays = ref<TextOverlay[]>([]);
  const stickers = ref<Sticker[]>([]);
  const effects = ref<Effect[]>([]);
  const watermarks = ref<ClipWatermark[]>([]);
  const filterSegments = ref<FilterSegment[]>([]);

  // Selection state for overlay items
  const selectedItemIds = ref<Set<string>>(new Set());

  // Effects & Transitions
  const clipTransitions = ref<ClipTransition[]>([]);
  const clipEffects = ref<ClipEffect[]>([]);
  const audioEffects = ref<AudioTrackEffect[]>([]);
  const selectedSegmentIndex = ref<number | undefined>(undefined);
  const originalDb = ref(0);
  const trackDbValues = ref<Record<string, number>>({});

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
  const framingConfigs = ref<ManualFramingConfigs>({}); // Legacy: global per aspect ratio
  const segmentFramingConfigs = ref<SegmentFramingConfigs>({}); // New: per-segment framing
  const videoPath = ref<string | null>(null);
  const thumbnailUrl = ref<string | null>(null);
  const editorThumbnailUrl = ref<string | null>(null);

  // Manual POI editor state
  const showManualPOIEditor = ref(false);
  const editingAspectRatio = ref<string>('9:16');

  // Speed Curve Editor state
  const showSpeedCurveEditor = ref(false);
  const speedCurveEditorSourceId = ref<string | null>(null);
  const speedCurveKeyframes = ref<any[]>([]); // Will hold the keyframes for the active source

  // Project ID for transcript loading (fetched from clip)
  const projectId = ref<string | null>(null);

  // Use transcript data composable for subtitle display
  const { transcriptData, loadTranscriptData } = useTranscriptData(computed(() => projectId.value));

  // Auto-save composable - handles debounced saving of edit data
  const {
    isSaving,
    lastSaved,
    isInitialLoad,
    triggerAutoSave,
    saveNow,
    watchForChanges,
    setInitialLoadComplete,
    resetForNewSession,
  } = useAutoSave(async () => {
    const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
    if (!editId) return;

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
          segmentConfigs: segmentFramingConfigs.value,
        },
        // Subtitle settings
        subtitleSettings: subtitleSettings.value,
      });
    }
  });

  // Get the source video time ranges covered by all video sources (for editor mode)
  const sourceVideoTimeRanges = computed(() => {
    if (!editorMode.value || videoSources.value.length === 0) {
      return [];
    }
    return videoSources.value.map((source) => ({
      start: source.trim_start,
      end: source.trim_end ?? source.trim_start + (source.end_time - source.start_time),
      sourcePath: source.source_path,
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

  // Audio playback composable - manages Web Audio API for audio track playback
  const {
    audioElements,
    audioContext,
    gainNodes,
    setupAudioElement,
    updateAudioGain,
    syncAudioWithVideo,
    applyMuteSoloState,
    removeAudioElement,
    cleanup: cleanupAudioElements,
  } = useAudioTrackPlayback({
    videoServerPort,
    audioTracks,
    trackDbValues,
    isPlaying,
    getCurrentTime: () => {
      // Editor mode: use previewTime directly (it's the timeline position, 0-based)
      // Clip mode: use video time relative to clip start
      if (editorMode.value) {
        return previewTime.value;
      }
      if (videoElement.value) {
        return videoElement.value.currentTime - props.clipStartTime;
      }
      return 0;
    },
  });

  // Timeline markers composable - manages in/out points and regions
  const {
    inPoint,
    outPoint,
    regions,
    handleSetInPoint,
    handleSetOutPoint,
    handleClearInOutPoints,
    handleGoToInPoint,
    handleGoToOutPoint,
    handleAddRegion,
    handleUpdateRegion,
    handleDeleteRegion,
  } = useTimelineMarkers({
    seekTo: (time: number) => seekTo(time),
  });

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

  // Computed: Unified timeline tracks for the timeline component
  const timelineTracks = computed(() => {
    if (editorMode.value) {
      // Map frontend types to database record types for the adapter

      const audioRecords: VideoEditorAudioTrackRecord[] = audioTracksWithStreamingUrls.value.map((t) => ({
        id: t.id,
        edit_id: videoEditorEditId.value || '',
        file_path: t.filePath,
        name: t.name,
        start_time: t.startTime,
        end_time: t.endTime,
        volume: t.volume,
        pan: t.pan ?? 0,
        fade_in: t.fadeIn,
        fade_out: t.fadeOut,
        track_order: t.trackOrder,
        is_muted: t.isMuted ? 1 : 0,
        is_solo: t.isSolo ? 1 : 0,
        created_at: 0,
      }));

      const textRecords: VideoEditorTextOverlayRecord[] = textOverlays.value.map((t) => {
        // Use per-ratio position if available for current aspect ratio
        const ratio = previewAspectRatio.value;
        const ratioConfig = t.perRatioConfigs?.[ratio];
        const position = ratioConfig?.position || t.position;

        return {
          id: t.id,
          edit_id: videoEditorEditId.value || '',
          text: t.text,
          start_time: t.startTime,
          end_time: t.endTime,
          position_x: position.x,
          position_y: position.y,
          style_data: JSON.stringify(ratioConfig?.style || t.style),
          animation: t.animation,
          per_ratio_configs_data: t.perRatioConfigs ? JSON.stringify(t.perRatioConfigs) : undefined,
          preview_height: t.previewHeight,
          layer: t.layer,
          created_at: 0,
        };
      });

      const stickerRecords: VideoEditorStickerRecord[] = stickers.value.map((s) => {
        // Use per-ratio config if available for current aspect ratio
        const ratio = previewAspectRatio.value;
        const ratioConfig = s.perRatioConfigs?.[ratio];
        const position = ratioConfig?.position || s.position;

        return {
          id: s.id,
          edit_id: videoEditorEditId.value || '',
          sticker_path: s.stickerPath,
          sticker_type: s.stickerType,
          start_time: s.startTime,
          end_time: s.endTime,
          position_x: position.x,
          position_y: position.y,
          scale: ratioConfig?.scale ?? s.scale,
          rotation: ratioConfig?.rotation ?? s.rotation,
          animation: s.animation,
          per_ratio_configs_data: s.perRatioConfigs ? JSON.stringify(s.perRatioConfigs) : undefined,
          layer: s.layer,
          created_at: 0,
        };
      });

      const watermarkRecords: VideoEditorWatermarkRecord[] = watermarks.value.map((w) => {
        // Use per-ratio config if available for current aspect ratio
        const ratio = previewAspectRatio.value;
        const ratioConfig = w.perRatioConfigs?.[ratio];
        const position = ratioConfig?.position || w.position;

        return {
          id: w.id,
          edit_id: videoEditorEditId.value || '',
          watermark_id: w.watermarkId,
          watermark_path: w.filePath,
          preview_url: w.previewUrl,
          start_time: w.startTime,
          end_time: w.endTime,
          position_x: position.x,
          position_y: position.y,
          scale: ratioConfig?.scale ?? w.scale,
          opacity: ratioConfig?.opacity ?? w.opacity,
          per_ratio_configs_data: w.perRatioConfigs ? JSON.stringify(w.perRatioConfigs) : undefined,
          layer: w.layer,
          created_at: 0,
        };
      });

      const effectRecords: VideoEditorEffectRecord[] = effects.value.map((e) => ({
        id: e.id,
        edit_id: videoEditorEditId.value || '',
        effect_type: e.type,
        start_time: e.startTime,
        end_time: e.endTime,
        settings: JSON.stringify(e.settings),
        created_at: 0,
      }));

      return TimelineAdapter.toTimelineModel({
        sources: videoSources.value,
        audioTracks: audioRecords,
        textOverlays: textRecords,
        stickers: stickerRecords,
        watermarks: watermarkRecords,
        effects: effectRecords,
        filterSegments: filterSegments.value,
        duration: editorDuration.value,
      }).tracks;
    }

    // In clip mode, we rely on ClipEditorTimeline's legacy rendering for now
    return [];
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

  // Overlay operations composable (text overlays, stickers, watermarks)
  const {
    addTextOverlay,
    updateTextOverlayLocal,
    deleteTextOverlayLocal,
    splitTextOverlayLocal,
    addStickerLocal,
    updateStickerLocal,
    deleteStickerLocal,
    splitStickerLocal,
    addWatermarkLocal,
    updateWatermarkLocal,
    deleteWatermarkLocal,
    splitWatermarkLocal,
  } = useOverlayOperations({
    editorMode,
    clipEditId,
    videoEditorEditId,
    textOverlays,
    stickers,
    watermarks,
    effectivePreviewTime,
    totalSegmentDuration,
    getOverlayContainerHeight: () => previewRef.value?.getOverlayContainerHeight(),
  });

  // Video source operations composable (add, update, delete, split video sources)
  // Note: loadEditorProject is passed as a wrapper since it's defined later in this scope
  const {
    addSourceToProject,
    importFileToProject,
    onDropSource,
    updateVideoSource,
    deleteVideoSource,
    repairSourceOrderIndex,
    splitVideoSource,
  } = useVideoSourceOperations({
    editorProjectId,
    videoEditorEditId,
    videoSources,
    commandHistory,
    undoRedoTrigger,
    triggerAutoSave,
    loadEditorProject: async () => {
      await loadEditorProject();
    },
  });

  // Intro/Outro operations composable
  const { onAddIntro, onAddOutro, onRemoveIntro, onRemoveOutro } = useIntroOutroOperations({
    editorMode,
    editorProjectId,
    videoEditorEditId,
    clipEditId,
    videoSources,
    audioTracks,
    textOverlays,
    stickers,
    watermarks,
    filterSegments,
    currentIntro,
    currentOutro,
    triggerAutoSave,
    updateAudioTrackLocal,
    updateTextOverlayLocal,
    updateStickerLocal,
    updateWatermarkLocal,
    repairSourceOrderIndex,
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

    const time = previewTime.value;

    // If we have a tracked source ID (e.g., during/after crossfade), use it
    // BUT only if the current time is within that source's range
    if (currentVideoSourceId.value) {
      const trackedSource = videoSources.value.find((s) => s.id === currentVideoSourceId.value);
      if (trackedSource && time >= trackedSource.start_time && time < trackedSource.end_time) {
        return trackedSource;
      }
    }

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

  // Helper function to construct video URL with proper endpoint for file type
  // MPEG-TS (.ts) files need the /ts-hls/ endpoint to be wrapped in an HLS playlist
  // for proper A/V sync via HLS.js. Regular video files use /video/ endpoint.
  function constructVideoUrl(filePath: string, port: number): string {
    const encodedPath = btoa(unescape(encodeURIComponent(filePath)));

    // Check if this is a .ts file - browsers can't play MPEG-TS natively
    // Use the HLS wrapper endpoint which generates an on-the-fly playlist
    const isTsFile = filePath.toLowerCase().endsWith('.ts');

    if (isTsFile) {
      // Use ts-hls endpoint which wraps the .ts file in an HLS playlist
      // This enables HLS.js to handle A/V sync properly via PTS timestamps
      return `http://localhost:${port}/ts-hls/${encodedPath}/playlist.m3u8`;
    }

    // Regular video file - serve directly
    return `http://localhost:${port}/video/${encodedPath}`;
  }

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

    return constructVideoUrl(path, videoServerPort.value);
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

    return constructVideoUrl(path, videoServerPort.value);
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

  // Effective video URL for ManualPOIEditor - converts path to streaming URL
  const effectiveVideoUrl = computed(() => {
    const path = effectiveVideoPath.value;
    if (!path) return null;

    // If path already looks like an HTTP URL, use it directly
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Otherwise, construct the HTTP URL from the file path using video server
    if (!videoServerPort.value) {
      return null;
    }

    return constructVideoUrl(path, videoServerPort.value);
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
  const playbackSegments = computed<ClipSegment[]>(() => {
    if (trimSegments.value.length === 0) {
      // No segments defined, use the full clip as a single segment
      const duration = props.clipEndTime - props.clipStartTime;
      return [
        {
          start_time: props.clipStartTime,
          end_time: props.clipEndTime,
          duration,
          transcript: '',
        },
      ];
    }

    // Convert relative segment times back to absolute times
    return trimSegments.value
      .filter((seg) => !seg.isDeleted)
      .map((seg) => {
        const start_time = props.clipStartTime + seg.startTime;
        const end_time = props.clipStartTime + seg.endTime;
        return {
          start_time,
          end_time,
          duration: end_time - start_time,
          transcript: '',
        };
      })
      .sort((a, b) => a.start_time - b.start_time);
  });

  // Segment preview time mapping - maps preview video time to source video time
  // This is needed for subtitle display, transcript highlighting, and waveform sync
  interface SegmentTimeMap {
    previewStart: number; // Start time in preview video
    previewEnd: number; // End time in preview video
    sourceStart: number; // Start time in source video
    sourceEnd: number; // End time in source video
  }

  const segmentTimeMap = computed<SegmentTimeMap[]>(() => {
    const segments = playbackSegments.value;
    const timeMap: SegmentTimeMap[] = [];
    let previewTime = 0;

    for (const seg of segments) {
      const segDuration = seg.end_time - seg.start_time;
      timeMap.push({
        previewStart: previewTime,
        previewEnd: previewTime + segDuration,
        sourceStart: seg.start_time,
        sourceEnd: seg.end_time,
      });
      previewTime += segDuration;
    }

    return timeMap;
  });

  // Generate a pre-rendered preview video for seamless segment playback
  // This eliminates runtime seeking by creating a single continuous video file
  async function generateSegmentPreview() {
    const segments = playbackSegments.value;

    // Single segment or no segments - use original source directly
    if (segments.length <= 1) {
      // Clean up any existing preview
      if (segmentPreviewPath.value) {
        try {
          await invoke('delete_segment_preview', { previewPath: segmentPreviewPath.value });
        } catch (e) {
          console.warn('[ClipEditorDialog] Failed to delete old preview:', e);
        }
        segmentPreviewPath.value = null;
      }
      return;
    }

    // Get source video path (works for both editor mode and clip mode)
    const sourcePath = effectiveVideoPath.value;
    if (!sourcePath) {
      console.warn('[ClipEditorDialog] Cannot generate preview: no source video path');
      return;
    }

    // Ensure video server port is available for streaming the preview
    if (!videoServerPort.value) {
      try {
        videoServerPort.value = await invoke<number>('get_video_server_port');
      } catch (e) {
        console.error('[ClipEditorDialog] Failed to get video server port:', e);
        return;
      }
    }

    isGeneratingPreview.value = true;
    previewGenerationError.value = null;

    try {
      // Delete previous preview file before generating new one
      if (segmentPreviewPath.value) {
        try {
          await invoke('delete_segment_preview', { previewPath: segmentPreviewPath.value });
        } catch (e) {
          console.warn('[ClipEditorDialog] Failed to delete old preview:', e);
        }
      }

      // Convert segments to the format expected by the Rust command
      const previewSegments = segments.map((seg) => ({
        start_time: seg.start_time,
        end_time: seg.end_time,
      }));

      const outputFilename = `preview_${props.clipId}_${Date.now()}`;

      const previewPath = await invoke<string>('generate_segment_preview', {
        videoPath: sourcePath,
        segments: previewSegments,
        outputFilename,
      });

      segmentPreviewPath.value = previewPath;
    } catch (error) {
      previewGenerationError.value = String(error);
      // Fallback to original behavior (direct seeking)
      segmentPreviewPath.value = null;
    } finally {
      isGeneratingPreview.value = false;
    }
  }

  // Debounced preview generation to avoid rapid regeneration during quick edits
  function triggerPreviewGeneration() {
    if (previewGenerationTimeout) {
      clearTimeout(previewGenerationTimeout);
    }
    // Wait 500ms after last edit before generating preview
    previewGenerationTimeout = setTimeout(() => {
      generateSegmentPreview();
    }, 500);
  }

  // Clean up preview files when component unmounts or clip closes
  async function cleanupSegmentPreview() {
    if (previewGenerationTimeout) {
      clearTimeout(previewGenerationTimeout);
      previewGenerationTimeout = null;
    }
    if (segmentPreviewPath.value) {
      try {
        await invoke('delete_segment_preview', { previewPath: segmentPreviewPath.value });
      } catch (e) {
        console.warn('[ClipEditorDialog] Failed to cleanup preview:', e);
      }
      segmentPreviewPath.value = null;
    }
  }

  // Get current segment ID based on playback time
  const currentSegmentId = computed(() => {
    if (trimSegments.value.length === 0) return null;

    // Find segment that contains the current playback time
    const segment = trimSegments.value.find(
      (seg) =>
        !seg.isDeleted &&
        previewTime.value >= props.clipStartTime + seg.startTime &&
        previewTime.value <= props.clipStartTime + seg.endTime
    );

    return segment?.id || null;
  });

  // Get effective framing config for preview (considers segment-specific framing)
  const effectiveFramingConfigs = computed(() => {
    const configs: ManualFramingConfigs = { ...framingConfigs.value };

    // If we have a current segment, check for segment-specific framing
    if (currentSegmentId.value) {
      // For each aspect ratio, check if there's a segment-specific config
      const ratios: (keyof SegmentFramingConfigs)[] = ['9:16', '4:5', '1:1', '16:9'];

      for (const ratio of ratios) {
        const segmentConfigs = segmentFramingConfigs.value[ratio];
        if (segmentConfigs && segmentConfigs.length > 0) {
          // Find config that applies to current segment
          const applicableConfig = segmentConfigs.find((c) => c.segmentIds.includes(currentSegmentId.value!));

          if (applicableConfig) {
            configs[ratio] = applicableConfig.config;
          }
        }
      }
    }

    return configs;
  });

  // Effective audio gain for waveform visualization (uses originalDb which can be initialized from project settings)
  const effectiveAudioGainDb = computed(() => originalDb.value);

  // Computed: transform creatorWatermarkId and creatorWatermarkSettings props into the format expected by ClipEditorPreview
  // This allows the preview to load different watermark images for different aspect ratios
  // NOTE: This is only used when watermarks are NOT being applied via applyCreatorWatermark() to avoid duplicates
  const computedCreatorProfileWatermarkSettings = computed(() => {
    // If explicit creatorProfileWatermarkSettings prop is provided, use it
    if (props.creatorProfileWatermarkSettings) {
      return props.creatorProfileWatermarkSettings;
    }

    // NOTE: We now ALWAYS return creator profile settings (even when timeline watermarks exist)
    // ClipEditorPreview will use these settings as a FALLBACK for positioning timeline watermarks
    // The shouldShowCreatorWatermark computed in ClipEditorPreview prevents duplicate watermarks

    // If no creator watermark ID, return null
    if (!props.creatorWatermarkId) {
      return null;
    }

    // Parse the per-ratio settings if available
    let perRatioSettings: Record<string, any> | null = null;
    if (props.creatorWatermarkSettings) {
      try {
        perRatioSettings = JSON.parse(props.creatorWatermarkSettings);

        // Transform per-ratio watermarkIds if main watermarkId is an org asset
        // This handles cases where per-ratio watermarkIds are raw server IDs (numbers or numeric strings)
        if (props.creatorWatermarkId?.startsWith('org-asset-') && perRatioSettings) {
          for (const [ratio, config] of Object.entries(perRatioSettings)) {
            if (config && typeof config === 'object') {
              const ratioConfig = config as { watermarkId?: number | string; position?: any };
              if (ratioConfig.watermarkId != null) {
                const wmIdStr = String(ratioConfig.watermarkId);
                if (!wmIdStr.startsWith('org-asset-')) {
                  perRatioSettings[ratio] = {
                    ...ratioConfig,
                    watermarkId: `org-asset-${ratioConfig.watermarkId}`,
                  };
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[ClipEditorDialog] Failed to parse creatorWatermarkSettings:', e);
      }
    }

    // Build the format expected by ClipEditorPreview
    // Format: { enabled, watermarkId, perRatioSettings: { '16:9': { watermarkId, position }, ... } }
    return {
      enabled: true,
      watermarkId: props.creatorWatermarkId,
      perRatioSettings: perRatioSettings,
    };
  });

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

  // Keyframe operations composable (select, update, delete, add keyframes on timeline items)
  const { selectedKeyframe, handleKeyframeSelect, updateKeyframe, deleteKeyframe, addKeyframe, updateKeyframeTime } =
    useKeyframeOperations({
      textOverlays,
      stickers,
      watermarks,
      audioTracks,
      updateTextOverlayLocal,
      updateStickerLocal,
      updateWatermarkLocal,
      updateAudioTrackLocal,
      setActiveTab,
      triggerAutoSave,
    });

  // Video source operations for editor mode
  async function onAddSource(source: SourceItem) {
    // Always in editor mode now - add source directly
    await addSourceToProject(source);
  }

  async function onImportFile(filePath: string, name: string, duration: number, thumbnailPath?: string) {
    // Always in editor mode now - import file directly
    await importFileToProject(filePath, name, duration, thumbnailPath);
  }

  // Handle adding project media (from MediaTab)
  async function onAddProjectMedia(media: {
    id: string;
    media_type: string;
    file_path: string;
    file_name: string;
    duration: number | null;
  }) {
    if (media.media_type === 'video') {
      // Add video to timeline as a source
      await onAddSource({
        id: media.id,
        type: 'raw_video',
        name: media.file_name,
        path: media.file_path,
        thumbnailPath: null,
        duration: media.duration,
        projectId: editorProjectId.value,
        projectName: null,
      });
    } else if (media.media_type === 'audio') {
      // Add audio as an audio track
      await addAudioTrack(media.file_path, media.file_name, media.duration || 0);
    } else if (media.media_type === 'image') {
      // Add image as a sticker
      await addStickerLocal(media.file_path, 'image');
    }
  }

  // Handle extracted audio from video source (with undo/redo support)
  async function onExtractedAudio(data: {
    sourceId: string;
    filePath: string;
    filename: string;
    duration: number;
    startTime: number;
    endTime: number;
    sourceName: string | null;
  }) {
    const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
    if (!editId) {
      console.error('[ClipEditorDialog] No edit ID available for audio track creation');
      return;
    }

    try {
      // Calculate the next track order (put it after existing audio tracks)
      const maxTrackOrder =
        audioTracks.value.length > 0 ? Math.max(...audioTracks.value.map((t) => t.trackOrder)) + 1 : 0;

      // Create reload callback for undo/redo
      const reloadCallback = async () => {
        // Reload audio tracks from database
        if (editorMode.value && videoEditorEditId.value) {
          // Editor Mode: Reload from video_editor_edits
          const { getVideoEditorAudioTracksByEditId } = await import('@/services/database/video-editor-edits');
          const tracks = await getVideoEditorAudioTracksByEditId(videoEditorEditId.value);
          audioTracks.value = tracks.map((t) => ({
            id: t.id,
            filePath: t.file_path,
            name: t.name,
            startTime: t.start_time,
            endTime: t.end_time,
            volume: t.volume,
            fadeIn: t.fade_in,
            fadeOut: t.fade_out,
            trackOrder: t.track_order,
            isMuted: t.is_muted === 1,
            isSolo: t.is_solo === 1,
            linkedSourceId: t.source_id, // Link to video source for linked selection
          }));

          // Reload video sources to update audioExtracted flag
          if (editorProjectId.value) {
            const sources = await getVideoEditorSourcesByProjectId(editorProjectId.value);
            videoSources.value = sources;
          }
        } else if (!editorMode.value && clipEditId.value) {
          // Clip Mode: Reload from clip_edits
          const { getAudioTracksByEditId } = await import('@/services/database/clip-edits');
          const tracks = await getAudioTracksByEditId(clipEditId.value);
          audioTracks.value = tracks.map((t) => ({
            id: t.id,
            filePath: t.file_path,
            name: t.name,
            startTime: t.start_time,
            endTime: t.end_time,
            volume: t.volume,
            fadeIn: t.fade_in,
            fadeOut: t.fade_out,
            trackOrder: t.track_order,
            isMuted: t.is_muted === 1,
            isSolo: t.is_solo === 1,
            linkedSourceId: t.source_id, // 'main' if extracted from main video
          }));
        }

        // Set up audio elements for any new tracks that don't have one yet
        for (const track of audioTracks.value) {
          if (!audioElements.value.has(track.id)) {
            await setupAudioElement(track);
          }
        }
      };

      // Create and execute the command
      const extractAudioCommand = new ExtractAudioCommand(editorMode.value, {
        editId,
        sourceId: data.sourceId,
        filePath: data.filePath,
        name: data.sourceName ? `${data.sourceName} (Audio)` : 'Extracted Audio',
        startTime: data.startTime,
        endTime: data.endTime,
        trackOrder: maxTrackOrder,
        onReload: reloadCallback,
      });

      await commandHistory.executeCommand(extractAudioCommand);
      undoRedoTrigger.value++; // Trigger reactivity update

      // Reload to update local state
      await reloadCallback();

      triggerAutoSave();
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to create audio track:', error);
    }
  }

  // Handle Ripple Edit
  async function handleRippleEdit(data: {
    type: 'trim' | 'source' | 'audio' | 'text' | 'sticker' | 'watermark' | 'effect' | 'filter';
    id: string;
    newStartTime: number;
    newEndTime: number;
    delta: number;
  }) {
    try {
      let originalStartTime = 0;
      let originalEndTime = 0;

      // Get original times based on type
      if (editorMode.value) {
        if (data.type === 'source') {
          const source = videoSources.value.find((s) => s.id === data.id);
          if (source) {
            originalStartTime = source.start_time;
            originalEndTime = source.end_time;
          }
        }
        // Add other types if needed
      } else {
        if (data.type === 'trim') {
          const segment = trimSegments.value.find((s) => s.id === data.id);
          if (segment) {
            originalStartTime = segment.startTime;
            originalEndTime = segment.endTime;
          }
        }
      }

      const reloadCallback = async () => {
        if (editorMode.value) {
          if (editorProjectId.value) {
            const sources = await getVideoEditorSourcesByProjectId(editorProjectId.value);
            videoSources.value = sources;
            await recalculateProjectDuration(editorProjectId.value);
          }
        } else {
          // Reload clip segments
          if (props.clipId) {
            const segments = await getClipSegmentsByClipId(props.clipId);
            // We need to map these back to TrimSegments... normally done via getClipWithBuildStatus
            // For now, we can just trigger a reload of the clip
            await loadEditData();
          }
        }
      };

      const rippleCommand = new RippleEditCommand(editorMode.value, {
        type: data.type,
        itemId: data.id,
        editId: editorMode.value ? videoEditorEditId.value || undefined : undefined,
        clipId: !editorMode.value ? props.clipId || undefined : undefined,
        projectId: editorProjectId.value || undefined,
        newStartTime: data.newStartTime,
        newEndTime: data.newEndTime,
        delta: data.delta,
        originalStartTime,
        originalEndTime,
        onReload: reloadCallback,
      });

      await commandHistory.executeCommand(rippleCommand);
      undoRedoTrigger.value++;

      // Optimistic update for UI responsiveness
      if (editorMode.value && data.type === 'source') {
        const source = videoSources.value.find((s) => s.id === data.id);
        if (source) {
          source.start_time = data.newStartTime;
          source.end_time = data.newEndTime;

          // Shift other sources optimistically
          // This should match the logic in the command
          const threshold = Math.min(originalStartTime, originalEndTime);
          videoSources.value.forEach((s) => {
            if (s.id !== data.id && s.start_time >= threshold) {
              s.start_time += data.delta;
              s.end_time += data.delta;
            }
          });
        }
      }

      await reloadCallback(); // Ensure consistent state
      triggerAutoSave();
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to execute ripple edit:', error);
    }
  }

  // Handle Roll Edit
  async function handleRollEdit(data: {
    type: 'source' | 'trim'; // We expect source or trim for roll edits
    leftItemId: string;
    rightItemId: string;
    newRollTime: number;
    originalRollTime: number;
  }) {
    try {
      let leftSourceSnapshot;
      let rightSourceSnapshot;

      // Capture snapshots for undo if in editor mode
      if (editorMode.value && data.type === 'source') {
        const leftSource = videoSources.value.find((s) => s.id === data.leftItemId);
        const rightSource = videoSources.value.find((s) => s.id === data.rightItemId);

        if (leftSource) {
          leftSourceSnapshot = { end: leftSource.end_time, trimEnd: leftSource.trim_end };
        }
        if (rightSource) {
          rightSourceSnapshot = { start: rightSource.start_time, trimStart: rightSource.trim_start };
        }
      }

      const reloadCallback = async () => {
        if (editorMode.value) {
          if (editorProjectId.value) {
            const sources = await getVideoEditorSourcesByProjectId(editorProjectId.value);
            videoSources.value = sources;
            await recalculateProjectDuration(editorProjectId.value);
          }
        } else {
          // Reload clip segments
          if (props.clipId) {
            await loadEditData();
          }
        }
      };

      const rollCommand = new RollEditCommand(editorMode.value, {
        type: data.type,
        leftItemId: data.leftItemId,
        rightItemId: data.rightItemId,
        editId: editorMode.value ? videoEditorEditId.value || undefined : undefined,
        clipId: !editorMode.value ? props.clipId || undefined : undefined,
        projectId: editorProjectId.value || undefined,
        newRollTime: data.newRollTime,
        originalRollTime: data.originalRollTime,
        leftSourceSnapshot,
        rightSourceSnapshot,
        onReload: reloadCallback,
      });

      await commandHistory.executeCommand(rollCommand);
      undoRedoTrigger.value++;

      // Optimistic update
      if (editorMode.value && data.type === 'source') {
        const leftSource = videoSources.value.find((s) => s.id === data.leftItemId);
        const rightSource = videoSources.value.find((s) => s.id === data.rightItemId);
        const delta = data.newRollTime - data.originalRollTime;

        if (leftSource && rightSource) {
          // Update Left Source
          leftSource.end_time = data.newRollTime;
          // Calculate new trim_end
          let leftTrimEnd = leftSource.trim_end;
          if (leftTrimEnd === null || leftTrimEnd === undefined) {
            // Implicit trim end was start + duration
            leftTrimEnd = leftSource.trim_start + (data.originalRollTime - leftSource.start_time);
          }
          leftSource.trim_end = leftTrimEnd + delta;

          // Update Right Source
          rightSource.start_time = data.newRollTime;
          rightSource.trim_start += delta;
        }
      }

      await reloadCallback(); // Ensure consistent state
      triggerAutoSave();
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to execute roll edit:', error);
    }
  }

  // Handle Slip Edit
  async function handleSlipEdit(data: {
    type: 'source' | 'trim';
    itemId: string;
    delta: number;
    originalTrimStart: number;
    originalTrimEnd: number | null;
  }) {
    try {
      const reloadCallback = async () => {
        if (editorMode.value) {
          if (editorProjectId.value) {
            const sources = await getVideoEditorSourcesByProjectId(editorProjectId.value);
            videoSources.value = sources;
            await recalculateProjectDuration(editorProjectId.value);
          }
        } else {
          if (props.clipId) {
            await loadEditData();
          }
        }
      };

      const slipCommand = new SlipEditCommand(editorMode.value, {
        type: data.type,
        itemId: data.itemId,
        editId: editorMode.value ? videoEditorEditId.value || undefined : undefined,
        clipId: !editorMode.value ? props.clipId || undefined : undefined,
        delta: data.delta,
        originalTrimStart: data.originalTrimStart,
        originalTrimEnd: data.originalTrimEnd,
        onReload: reloadCallback,
      });

      await commandHistory.executeCommand(slipCommand);
      undoRedoTrigger.value++;

      // Optimistic update
      if (editorMode.value && data.type === 'source') {
        const source = videoSources.value.find((s) => s.id === data.itemId);
        if (source) {
          source.trim_start = Math.max(0, data.originalTrimStart + data.delta);
          if (source.trim_end !== null && source.trim_end !== undefined) {
            source.trim_end = data.originalTrimEnd! + data.delta;
          }
        }
      }

      await reloadCallback();
      triggerAutoSave();
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to execute slip edit:', error);
    }
  }

  // Handle Slide Edit
  async function handleSlideEdit(data: {
    type: 'source' | 'audio' | 'text' | 'sticker' | 'watermark' | 'effect' | 'filter';
    itemId: string;
    leftNeighborId: string;
    rightNeighborId: string;
    delta: number;
    originalStartTime: number;
    originalEndTime: number;
  }) {
    // Only implemented for video sources for now
    if (data.type === 'source') {
      try {
        const reloadCallback = async () => {
          if (editorMode.value) {
            if (editorProjectId.value) {
              const sources = await getVideoEditorSourcesByProjectId(editorProjectId.value);
              videoSources.value = sources;
              await recalculateProjectDuration(editorProjectId.value);
            }
          } else {
            // Slide not fully supported in clip mode yet (requires multiple segments logic)
            if (props.clipId) {
              await loadEditData();
            }
          }
        };

        const slideCommand = new SlideEditCommand(editorMode.value, {
          type: 'source',
          itemId: data.itemId,
          leftNeighborId: data.leftNeighborId,
          rightNeighborId: data.rightNeighborId,
          editId: editorMode.value ? videoEditorEditId.value || undefined : undefined,
          clipId: !editorMode.value ? props.clipId || undefined : undefined,
          projectId: editorProjectId.value || undefined,
          delta: data.delta,
          originalStartTime: data.originalStartTime,
          originalEndTime: data.originalEndTime,
          onReload: reloadCallback,
        });

        await commandHistory.executeCommand(slideCommand);
        undoRedoTrigger.value++;

        // Optimistic update
        const source = videoSources.value.find((s) => s.id === data.itemId);
        const leftNeighbor = videoSources.value.find((s) => s.id === data.leftNeighborId);
        const rightNeighbor = videoSources.value.find((s) => s.id === data.rightNeighborId);

        if (source && leftNeighbor && rightNeighbor) {
          // Slide moves the source in time, adjusting neighbors
          // Specifically, it changes the OUT point of the left clip and the IN point of the right clip
          // while keeping the middle clip's duration constant but moving its position.
          // Wait, Standard Slide tool:
          // "The Slide tool moves a clip in the timeline, but keeps the duration of the clip the same.
          // The adjacent clips grow or shrink to accommodate the move."

          // Update middle clip position
          source.start_time += data.delta;
          source.end_time += data.delta;

          // Update left neighbor end time (and trim_end)
          leftNeighbor.end_time += data.delta;
          // Assuming left neighbor trim_end needs adjustment if it's not the last clip
          // If left neighbor is just extending/shrinking, we adjust its trim_end
          if (leftNeighbor.trim_end !== null) {
            leftNeighbor.trim_end += data.delta;
          } else {
            // If implicit, we might need to set it explicit or just leave it if it's raw video?
            // Usually we set it.
            leftNeighbor.trim_end =
              (leftNeighbor.source_duration || leftNeighbor.end_time - leftNeighbor.start_time) + data.delta;
          }

          // Update right neighbor start time (and trim_start)
          rightNeighbor.start_time += data.delta;
          rightNeighbor.trim_start += data.delta;
        }

        await reloadCallback();
        triggerAutoSave();
      } catch (error) {
        console.error('[ClipEditorDialog] Failed to execute slide edit:', error);
      }
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
          pan: t.pan,
          fadeIn: t.fade_in,
          fadeOut: t.fade_out,
          trackOrder: t.track_order,
          isMuted: !!t.is_muted,
          isSolo: !!t.is_solo,
          linkedSourceId: t.source_id,
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
          keyframes: (o as any).keyframes_data ? JSON.parse((o as any).keyframes_data) : undefined,
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
          keyframes: (s as any).keyframes_data ? JSON.parse((s as any).keyframes_data) : undefined,
        }));

        // Load watermarks - convert file paths to data URLs for preview
        watermarks.value = await Promise.all(
          fullEdit.watermarks.map(async (w) => {
            // Convert file path to data URL for preview display
            let previewUrl = w.preview_url;

            // If preview_url is already a valid URL or data URL, use it directly
            if (
              previewUrl &&
              (previewUrl.startsWith('http://') || previewUrl.startsWith('https://') || previewUrl.startsWith('data:'))
            ) {
              // Already a valid URL, use as-is
            } else if (!previewUrl && w.watermark_path) {
              // Check if watermark_path is a URL (for org assets)
              if (w.watermark_path.startsWith('http://') || w.watermark_path.startsWith('https://')) {
                previewUrl = w.watermark_path;
              } else {
                // It's a local file path, convert to data URL
                try {
                  previewUrl = await invoke<string>('read_file_as_data_url', {
                    filePath: w.watermark_path,
                  });
                } catch (err) {
                  console.warn('[ClipEditorDialog] Failed to load watermark preview:', w.id, err);
                  // Try to reload from watermark database using watermark_id
                  previewUrl = await loadWatermarkPreviewUrl(w.watermark_id, w.watermark_path, null);
                }
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
              layer: w.layer ?? 0, // Visual track layer
              perRatioConfigs: w.per_ratio_configs_data ? JSON.parse(w.per_ratio_configs_data) : undefined,
              keyframes: (w as any).keyframes_data ? JSON.parse((w as any).keyframes_data) : undefined,
            };
          })
        );

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

          if (actualProjectId) {
            const { getCreatorProfileByProjectId } = await import('@/services/database');
            const creatorProfile = await getCreatorProfileByProjectId(actualProjectId);

            if (creatorProfile && creatorProfile.watermark_settings) {
              const watermarkSettings = JSON.parse(creatorProfile.watermark_settings);

              // Check if this creator watermark is already in the list
              const hasCreatorWatermark = watermarks.value.some((w) => w.watermarkId === creatorProfile.watermark_id);

              if (!hasCreatorWatermark && watermarkSettings.watermarkPath) {
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
                  watermarkId: creatorProfile.watermark_id ?? '',
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
    videoElement.value = element;

    const updateDimensions = () => {
      if (element.videoWidth && element.videoHeight) {
        videoDimensions.value = { width: element.videoWidth, height: element.videoHeight };
      }
    };

    if (element.videoWidth && element.videoHeight) {
      updateDimensions();
    } else {
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
    // CRITICAL: Update videoElement to point to the now-active preload video
    // This ensures play/pause controls work after crossfade
    const preloadEl = previewRef.value?.getPreloadVideoElement?.();
    if (preloadEl) {
      videoElement.value = preloadEl;
    }

    // The preload video is now the main video
    // Reset the preview component's active video index for the next swap cycle
    // This will happen when the user finishes with this source and moves to the next
    hideTransitionFrame();

    // Update source tracking to the incoming source (source B)
    const incomingSource = transitionIncomingSource.value;
    if (incomingSource) {
      currentVideoSourceId.value = incomingSource.id;
    } else {
      // Fallback: find next source by order
      const sortedSources = [...videoSources.value].sort((a, b) => a.order_index - b.order_index);
      const currentIdx = sortedSources.findIndex((s) => s.id === currentVideoSourceId.value);

      if (currentIdx >= 0 && currentIdx < sortedSources.length - 1) {
        const nextSource = sortedSources[currentIdx + 1];
        currentVideoSourceId.value = nextSource.id;
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
    // CRITICAL: Update videoElement to point to the now-active preload video
    // This ensures play/pause controls work after crossfade
    const preloadEl = previewRef.value?.getPreloadVideoElement?.();
    if (preloadEl) {
      videoElement.value = preloadEl;
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
        if (incomingSource) {
          // Calculate the seek time in the incoming source
          const timeIntoTransition = previewTime.value - transition.startTime;
          const seekTime = incomingSource.trim_start + timeIntoTransition;

          // Try to start crossfade (will work even if preload isn't fully ready)
          if (previewRef.value.startCrossfade?.(seekTime)) {
            crossfadeStarted.value = true;
            lastCrossfadeTransitionId.value = transition.id;
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
      if (previewRef.value.completeCrossfade) {
        previewRef.value.completeCrossfade();
      }

      // Update state to reflect we're now on the incoming source
      // Find the source that contains the current time (should be source B now)
      const newActiveSource = videoSources.value.find(
        (s) => previewTime.value >= s.start_time && previewTime.value < s.end_time
      );
      if (newActiveSource) {
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

        if (time >= effectiveTrimEnd && isPlaying.value && !activeTransition.value && !crossfadeStarted.value) {
          // We've reached the end of this source's trimmed region
          // Trigger transition to next source
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
    // In clip mode (non-editor), just stop playback when video ends
    if (!editorMode.value) {
      isPlaying.value = false;
      return;
    }

    // If we're currently in a crossfade transition (or just started one), complete it
    // The outgoing video has reached its end during the crossfade
    // Check crossfadeStarted OR if we're in/near a transition zone
    if (crossfadeStarted.value || activeTransition.value) {
      // Complete the crossfade transition
      if (previewRef.value?.completeCrossfade) {
        previewRef.value.completeCrossfade();
      }

      // Update state to reflect we're now on the incoming source
      // Find the incoming source - either from the transition or the next source by order
      let incomingSource = transitionIncomingSource.value;
      if (!incomingSource) {
        // Fallback: find the next source in order
        const sortedSources = [...videoSources.value].sort((a, b) => a.order_index - b.order_index);
        const currentIdx = sortedSources.findIndex((s) => s.id === currentVideoSourceId.value);
        if (currentIdx >= 0 && currentIdx < sortedSources.length - 1) {
          incomingSource = sortedSources[currentIdx + 1];
        }
      }

      if (incomingSource) {
        currentVideoSourceId.value = incomingSource.id;
        // Update videoElement to the new active element (preload video)
        const preloadEl = previewRef.value?.getPreloadVideoElement?.();
        if (preloadEl) {
          videoElement.value = preloadEl;
          // Ensure the preload video is playing
          if (preloadEl.paused && isPlaying.value) {
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
        // IMPORTANT: Reset activeVideoIndex FIRST before changing currentVideoSourceId
        // This ensures the editorVideoSrc watch doesn't skip loading the new source
        previewRef.value?.resetActiveVideo?.();

        // Now update state - this will trigger editorVideoSrc to change and load the new source
        previewTime.value = nextSource.start_time;
        currentVideoSourceId.value = nextSource.id;
        pendingSeekTime.value = nextSource.trim_start;
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

      // Set seeking flag to prevent time update interference during reset
      isSeeking.value = true;

      // Reset to main video if preload was active
      if (!previewRef.value?.isMainVideoActive?.()) {
        previewRef.value?.resetActiveVideo?.();
      }

      if (sortedSources.length > 0) {
        const firstSource = sortedSources[0];
        // Reset to the beginning of the first source
        // Set currentVideoSourceId FIRST to ensure activeVideoSource computed
        // returns the correct source when previewTime changes
        currentVideoSourceId.value = firstSource.id;
        previewTime.value = firstSource.start_time;

        // Actually seek the video element to the beginning position
        // This is necessary because the video file hasn't changed, so onVideoLoaded won't fire
        if (videoElement.value) {
          videoElement.value.currentTime = firstSource.trim_start;
        }
        // Clear pending seek time since we've already seeked
        pendingSeekTime.value = null;
      }

      // Clear seeking flag after state has settled
      setTimeout(() => {
        isSeeking.value = false;
      }, 100);
    }
  }

  async function togglePlay() {
    // Use the preview component's unified play/pause methods
    // This ensures all video elements (framed, region, audio, preload) are properly controlled
    if (!previewRef.value) {
      return;
    }

    if (isPlaying.value) {
      previewRef.value.pause();
      // Pause all audio tracks
      audioElements.value.forEach((audio) => audio.pause());
      isPlaying.value = false;
    } else {
      // Check if active video is ready before playing
      const activeVideo = activeVideoElement.value;
      if (activeVideo) {
        const hasValidSource = activeVideo.src && activeVideo.src !== '' && !activeVideo.src.endsWith('/video-editor');
        const isReady = activeVideo.readyState >= 1; // HAVE_METADATA or better

        if (!hasValidSource || !isReady) {
          return;
        }
      }

      const playStarted = await previewRef.value.play();
      if (playStarted) {
        isPlaying.value = true;
        // Resume audio context if suspended
        if (audioContext.value?.state === 'suspended') {
          audioContext.value.resume();
        }
        // Start audio tracks playback
        syncAudioWithVideo();
      } else {
        console.error('[togglePlay] Play failed to start');
      }
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

      // IMPORTANT: Reset shouldResumePlayback at start of seek
      // Only set to true if video was actually playing (prevents auto-play bugs)
      const actuallyPlaying = videoElement.value ? !videoElement.value.paused : false;
      shouldResumePlayback.value = isPlaying.value && actuallyPlaying;

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

          // Use the shouldResumePlayback ref that was set above
          const wasPlaying = shouldResumePlayback.value;

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
            return constructVideoUrl(path, videoServerPort.value);
          })();

          // Check if the video element already has the correct src loaded
          // After resetActiveVideo, videoElement.value points to main video
          // which might have a stale src from before a crossfade
          const videoHasCorrectSrc = videoElement.value && targetVideoUrl && videoElement.value.src === targetVideoUrl;

          if (videoHasCorrectSrc && videoElement.value) {
            // Video already has the correct src - just seek directly
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
            // Note: We intentionally do NOT auto-play in the safety timeout -
            // if we reach this point, something went wrong and auto-play would be unexpected
            setTimeout(() => {
              if (isSeeking.value && pendingSeekTime.value !== null && videoElement.value) {
                console.warn('[seekTo] Safety timeout - applying pending seek directly');
                videoElement.value.currentTime = pendingSeekTime.value;
                pendingSeekTime.value = null;
                isSeeking.value = false;
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

        // Reset clip video state and re-initialize preload for seamless segment transitions
        if (previewRef.value?.resetClipVideoState) {
          previewRef.value.resetClipVideoState();
        }
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

      // Reset clip video state and re-initialize preload for seamless segment transitions
      if (previewRef.value?.resetClipVideoState) {
        previewRef.value.resetClipVideoState();
      }
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

    // Use command pattern for undo/redo support in both modes
    try {
      // Create reload callback
      const reloadCallback = async () => {
        if (!editorMode.value && props.clipId) {
          // Clip mode: reload from clip segments
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
        } else if (editorMode.value && editorProjectId.value) {
          // Editor mode: reload from video sources
          await loadEditorProject();
        }
      };

      // Create and execute split command
      const splitCommand = new SplitCommand(editorMode.value, {
        clipId: props.clipId || undefined,
        editorProjectId: editorProjectId.value || undefined,
        segmentIndex,
        clipStartTime: props.clipStartTime,
        cutTime,
        onReload: reloadCallback,
      });

      await commandHistory.executeCommand(splitCommand);
      undoRedoTrigger.value++; // Trigger reactivity update

      // Trigger preview regeneration for seamless playback
      triggerPreviewGeneration();
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to split segment:', error);
      alert(`Failed to split segment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Legacy code path removed - all splits now use command pattern
  async function splitTrimSegmentLegacy(segmentId: string, cutTime: number) {
    const segmentIndex = trimSegments.value.findIndex((s) => s.id === segmentId);
    if (segmentIndex === -1) return;

    const segment = trimSegments.value[segmentIndex];

    // This is the old editor mode path - kept for reference but should not be used
    if (editorMode.value) {
      // Editor mode - just update local state (for video editor projects)
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

        // Trigger preview regeneration for seamless playback
        triggerPreviewGeneration();
      } catch (error) {
        console.error('[ClipEditorDialog] Failed to delete segment:', error);
        alert(`Failed to delete segment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Editor mode or no clip ID - just update local state
      // TODO: Convert to command pattern when we implement editor mode delete command
      trimSegments.value.splice(segmentIndex, 1);
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

  async function updateAudioTrackLocal(trackId: string, updates: Partial<AudioTrack>) {
    const track = audioTracks.value.find((t) => t.id === trackId);
    if (!track) return;

    // Check if this is a time change that should be tracked for undo
    const isTimeChange = updates.startTime !== undefined || updates.endTime !== undefined;

    if (isTimeChange && editorMode.value && videoEditorEditId.value) {
      // Use ResizeCommand for undo/redo support
      const reloadCallback = async () => {
        if (videoEditorEditId.value) {
          const { getVideoEditorAudioTracksByEditId } = await import('@/services/database/video-editor-edits');
          const tracks = await getVideoEditorAudioTracksByEditId(videoEditorEditId.value);
          audioTracks.value = tracks.map((t) => ({
            id: t.id,
            filePath: t.file_path,
            name: t.name,
            startTime: t.start_time,
            endTime: t.end_time,
            volume: t.volume,
            fadeIn: t.fade_in,
            fadeOut: t.fade_out,
            trackOrder: t.track_order,
            isMuted: t.is_muted === 1,
            isSolo: t.is_solo === 1,
            linkedSourceId: t.source_id,
          }));
        }
      };

      const resizeCommand = new ResizeCommand({
        type: 'audio',
        itemId: trackId,
        editId: videoEditorEditId.value || '',
        originalStartTime: track.startTime,
        originalEndTime: track.endTime,
        newStartTime: updates.startTime ?? track.startTime,
        newEndTime: updates.endTime ?? track.endTime,
        onReload: reloadCallback,
      });

      await commandHistory.executeCommand(resizeCommand);
      undoRedoTrigger.value++;

      // Update local state
      Object.assign(track, updates);
    } else {
      // For non-time changes or clip mode, update directly
      // Only include fields that are actually being updated
      const updateData: Record<string, any> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
      if (updates.endTime !== undefined) updateData.end_time = updates.endTime;
      if (updates.volume !== undefined) updateData.volume = updates.volume;
      if (updates.pan !== undefined) updateData.pan = updates.pan;
      if (updates.fadeIn !== undefined) updateData.fade_in = updates.fadeIn;
      if (updates.fadeOut !== undefined) updateData.fade_out = updates.fadeOut;
      if (updates.trackOrder !== undefined) updateData.track_order = updates.trackOrder;
      if (updates.isMuted !== undefined) updateData.is_muted = updates.isMuted ? 1 : 0;
      if (updates.isSolo !== undefined) updateData.is_solo = updates.isSolo ? 1 : 0;
      if (updates.isLocked !== undefined) updateData.is_locked = updates.isLocked ? 1 : 0;
      if (updates.isHidden !== undefined) updateData.is_hidden = updates.isHidden ? 1 : 0;

      // Use appropriate database function based on mode
      if (editorMode.value) {
        await updateVideoEditorAudioTrack(trackId, updateData);
      } else {
        await updateAudioTrack(trackId, updateData);
      }

      Object.assign(track, updates);
    }

    // Update audio gain if volume, mute, or solo changed
    if (updates.volume !== undefined || updates.isMuted !== undefined || updates.isSolo !== undefined) {
      // For solo changes, we need to update gain for ALL tracks since solo affects other tracks
      if (updates.isSolo !== undefined) {
        audioTracks.value.forEach((t) => updateAudioGain(t.id));
      } else {
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

  function updateTrackPan(trackId: string, pan: number) {
    updateAudioTrackLocal(trackId, { pan });
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

  // Transition operations
  function onAddTransition(
    type: string,
    positionIndex: number,
    duration: number,
    parameters?: Record<string, unknown>
  ) {
    const newTransition: ClipTransition = {
      id: `transition-${Date.now()}`,
      clipEditId: props.clipId || '',
      transitionType: type,
      positionIndex,
      duration,
      parameters,
      easing: 'ease-in-out',
      createdAt: Date.now(),
    };
    clipTransitions.value.push(newTransition);
  }

  function onUpdateTransition(id: string, updates: Partial<ClipTransition>) {
    const transition = clipTransitions.value.find((t) => t.id === id);
    if (transition) {
      Object.assign(transition, updates);
    }
  }

  function onDeleteTransition(id: string) {
    clipTransitions.value = clipTransitions.value.filter((t) => t.id !== id);
  }

  // Effect operations
  function onAddEffect(
    type: string,
    startTime: number,
    endTime: number,
    intensity: number,
    parameters?: Record<string, unknown>
  ) {
    const newEffect: ClipEffect = {
      id: `effect-${Date.now()}`,
      clipEditId: props.clipId || '',
      effectType: type,
      startTime,
      endTime,
      intensity,
      parameters,
      blendMode: 'normal',
      layer: clipEffects.value.length,
      isEnabled: true,
      createdAt: Date.now(),
    };
    clipEffects.value.push(newEffect);
  }

  function onUpdateEffect(id: string, updates: Partial<ClipEffect>) {
    const effect = clipEffects.value.find((e) => e.id === id);
    if (effect) {
      Object.assign(effect, updates);
    }
  }

  function onDeleteEffect(id: string) {
    clipEffects.value = clipEffects.value.filter((e) => e.id !== id);
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

  // Handle configure segment framing from timeline context menu
  function handleConfigureSegmentFraming(segmentId: string, aspectRatio: string) {
    // Select the segment so the framing will be applied to it
    selectedSegmentIds.value = new Set([segmentId]);
    // Open the manual POI editor for the specified aspect ratio
    openManualPOIEditor(aspectRatio);
  }

  // Get config for a specific aspect ratio
  function getConfigForRatio(ratio: string): ManualFramingConfig | null {
    return framingConfigs.value[ratio as keyof ManualFramingConfigs] || null;
  }

  // POIConfig type for ManualPOIEditor (simple x, y, width, height)
  interface POIConfig {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  // Convert ManualFramingConfig to POIConfig for ManualPOIEditor
  function getInitialPOIConfig(ratio: string): POIConfig | undefined {
    const config = getConfigForRatio(ratio);
    if (!config || !config.regions || config.regions.length === 0) return undefined;
    // Use the first region's source as the POI config
    const region = config.regions[0];
    return {
      x: region.source.x * 100,
      y: region.source.y * 100,
      width: region.source.width * 100,
      height: region.source.height * 100,
    };
  }

  // Handle POI config confirmation from ManualPOIEditor (converts POIConfig to ManualFramingConfig)
  function onManualPOIConfirm(poiConfig: POIConfig) {
    const config: ManualFramingConfig = {
      mode: 'manual',
      targetAspectRatio: editingAspectRatio.value,
      regions: [
        {
          id: `region-${Date.now()}`,
          color: '#4F9DFF',
          source: {
            x: poiConfig.x / 100,
            y: poiConfig.y / 100,
            width: poiConfig.width / 100,
            height: poiConfig.height / 100,
          },
          output: {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
          },
        },
      ],
    };
    onManualPOIConfigConfirm(config);
  }

  // Get framing config for specific segments and aspect ratio
  function getFramingForSegments(segmentIds: string[], aspectRatio: string): ManualFramingConfig | null {
    const configs = segmentFramingConfigs.value[aspectRatio as keyof SegmentFramingConfigs];
    if (!configs || configs.length === 0) return null;

    // Find config that applies to these segments
    // For now, return the first config that includes any of the requested segments
    for (const config of configs) {
      if (segmentIds.some((id) => config.segmentIds.includes(id))) {
        return config.config;
      }
    }
    return null;
  }

  // Set framing config for selected segments
  function setFramingForSegments(segmentIds: string[], aspectRatio: string, config: ManualFramingConfig) {
    const ratio = aspectRatio as keyof SegmentFramingConfigs;
    const currentConfigs = segmentFramingConfigs.value[ratio] || [];

    // Remove any existing configs that overlap with these segments
    const filteredConfigs = currentConfigs.filter((c) => !c.segmentIds.some((id) => segmentIds.includes(id)));

    // Add new config for these segments
    filteredConfigs.push({
      segmentIds: [...segmentIds],
      config: config,
    });

    segmentFramingConfigs.value = {
      ...segmentFramingConfigs.value,
      [ratio]: filteredConfigs,
    };
  }

  // Handle POI config confirmation from ManualPOIEditor
  function onManualPOIConfigConfirm(config: ManualFramingConfig) {
    const ratio = config.targetAspectRatio as keyof ManualFramingConfigs;

    // Ensure the ratio is in selectedAspectRatios
    if (!selectedAspectRatios.value.includes(config.targetAspectRatio)) {
      selectedAspectRatios.value = [...selectedAspectRatios.value, config.targetAspectRatio];
    }

    // If there are selected segments, apply framing to them specifically
    if (selectedSegmentIds.value.size > 0) {
      const segmentIds = Array.from(selectedSegmentIds.value);
      setFramingForSegments(segmentIds, config.targetAspectRatio, config);
    } else {
      // No segments selected - apply globally (legacy behavior)
      framingConfigs.value = {
        ...framingConfigs.value,
        [ratio]: config,
      };
    }

    // Set framing mode to manual since we now have manual config
    framingMode.value = 'manual';
    // Switch preview to show the configured ratio
    previewAspectRatio.value = config.targetAspectRatio;
  }

  async function splitEffectLocal(effectId: string, cutTime: number) {
    if (!videoEditorEditId.value) return;

    const { splitVideoEditorEffect } = await import('@/services/database/video-editor-edits');
    const { left, right } = await splitVideoEditorEffect(videoEditorEditId.value, effectId, cutTime);

    const index = effects.value.findIndex((e) => e.id === effectId);
    if (index !== -1) {
      effects.value[index] = {
        id: left.id,
        type: left.effect_type as any,
        startTime: left.start_time,
        endTime: left.end_time,
        settings: JSON.parse(left.settings || '{}'),
      };
      effects.value.push({
        id: right.id,
        type: right.effect_type as any,
        startTime: right.start_time,
        endTime: right.end_time,
        settings: JSON.parse(right.settings || '{}'),
      });
    }
  }

  async function splitAudioTrackLocal(trackId: string, cutTime: number) {
    if (!videoEditorEditId.value) return;

    const { splitVideoEditorAudioTrack } = await import('@/services/database/video-editor-edits');
    const { left, right } = await splitVideoEditorAudioTrack(videoEditorEditId.value, trackId, cutTime);

    const index = audioTracks.value.findIndex((t) => t.id === trackId);
    if (index !== -1) {
      audioTracks.value[index] = {
        id: left.id,
        filePath: left.file_path,
        name: left.name,
        startTime: left.start_time,
        endTime: left.end_time,
        volume: left.volume,
        fadeIn: left.fade_in,
        fadeOut: left.fade_out,
        trackOrder: left.track_order,
        isMuted: left.is_muted === 1,
        isSolo: left.is_solo === 1,
      };
      audioTracks.value.push({
        id: right.id,
        filePath: right.file_path,
        name: right.name,
        startTime: right.start_time,
        endTime: right.end_time,
        volume: right.volume,
        fadeIn: right.fade_in,
        fadeOut: right.fade_out,
        trackOrder: right.track_order,
        isMuted: right.is_muted === 1,
        isSolo: right.is_solo === 1,
      });
    }
  }

  async function splitFilterLocal(filterId: string, cutTime: number) {
    const index = filterSegments.value.findIndex((f) => f.id === filterId);
    if (index === -1) return;

    const filter = filterSegments.value[index];

    // Validate cut time
    if (cutTime <= filter.startTime || cutTime >= filter.endTime) {
      console.warn('[splitFilterLocal] Cut time is outside filter bounds');
      return;
    }

    // Update the original filter to end at cut time (left portion)
    filterSegments.value[index] = {
      ...filter,
      endTime: cutTime,
    };

    // Create new filter for right portion
    const newFilterId = `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    filterSegments.value.push({
      id: newFilterId,
      startTime: cutTime,
      endTime: filter.endTime,
      settings: { ...filter.settings },
    });

    // Persist to database if in editor mode
    if (videoEditorEditId.value) {
      const { updateVideoEditorEdit } = await import('@/services/database/video-editor-edits');
      const editData = {
        filterSegments: filterSegments.value,
      };
      await updateVideoEditorEdit(videoEditorEditId.value, { edit_data: JSON.stringify(editData) });
    }
  }

  async function moveTrackWithUndo(data: {
    type: string;
    id: string;
    originalStartTime: number;
    originalEndTime: number;
    newStartTime: number;
    newEndTime: number;
  }) {
    if (!videoEditorEditId.value) return;

    // Create reload callback
    const reloadCallback = async () => {
      await loadEditorProject();
    };

    // Create and execute move command
    const { createMoveCommand } = await import('@/services/commands');
    const moveCommand = createMoveCommand({
      type: data.type as any,
      itemId: data.id,
      editId: videoEditorEditId.value,
      originalStartTime: data.originalStartTime,
      originalEndTime: data.originalEndTime,
      newStartTime: data.newStartTime,
      newEndTime: data.newEndTime,
      onReload: reloadCallback,
    });

    await commandHistory.executeCommand(moveCommand);
    undoRedoTrigger.value++;
  }

  // Auto-apply creator profile watermark settings when opening the clip editor
  // Also syncs existing watermarks' perRatioConfigs with current creator profile settings
  async function applyCreatorWatermark() {
    let watermarkId = props.creatorWatermarkId;
    let watermarkSettingsJson = props.creatorWatermarkSettings;

    // If no props provided and in editor mode, try to load from video sources' parent project
    if (!watermarkId && editorMode.value && videoSources.value.length > 0) {
      // Try to find watermark settings from the first video source's parent project
      for (const source of videoSources.value) {
        let parentProjectId: string | null = null;

        if (source.source_type === 'raw_video' && source.source_id) {
          const rawVideo = await getRawVideo(source.source_id);
          parentProjectId = rawVideo?.project_id || null;
        } else if (source.source_type === 'clip' && source.source_id) {
          const clip = await getClip(source.source_id);
          parentProjectId = clip?.project_id || null;
        }

        if (parentProjectId) {
          const parentProject = await getProject(parentProjectId);

          // Check for watermark in the stored settings (format: { watermarkId, watermarkSettings })
          if (parentProject?.default_watermark_settings) {
            try {
              const storedSettings = JSON.parse(parentProject.default_watermark_settings);

              if (storedSettings.watermarkId) {
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
      return;
    }

    try {
      // Parse per-ratio settings from creator profile to check for different watermark images per ratio
      let creatorSettings: Record<string, any> | null = null;
      if (watermarkSettingsJson) {
        try {
          creatorSettings =
            typeof watermarkSettingsJson === 'string' ? JSON.parse(watermarkSettingsJson) : watermarkSettingsJson;
        } catch (e) {
          console.warn('[ClipEditorDialog] Failed to parse creator watermark settings:', e);
        }
      }

      // Collect all unique watermark IDs from per-ratio settings
      // Group ratios by their watermarkId so we can create separate watermarks for each
      const watermarkIdToRatios: Map<string, string[]> = new Map();
      const ratioConfigs: Record<
        string,
        {
          position: { x: number; y: number; scale: number; opacity: number; isFullFrameOverlay?: boolean };
          watermarkId?: string;
        }
      > = {};

      if (creatorSettings) {
        for (const [ratio, config] of Object.entries(creatorSettings)) {
          if (config && typeof config === 'object') {
            const ratioConfig = config as {
              position?: { x: number; y: number; scale: number; opacity: number; isFullFrameOverlay?: boolean };
              watermarkId?: string;
            };

            // Store the full config for this ratio
            if (ratioConfig.position) {
              ratioConfigs[ratio] = {
                position: ratioConfig.position,
                watermarkId: ratioConfig.watermarkId,
              };
            }

            // Use the ratio-specific watermarkId if provided, otherwise use the default
            let effectiveWatermarkId = ratioConfig.watermarkId || watermarkId;

            // Transform raw server IDs to org-asset format if main watermarkId is an org asset
            // This matches the transformation done in computedCreatorProfileWatermarkSettings
            if (watermarkId?.startsWith('org-asset-') && effectiveWatermarkId) {
              const wmIdStr = String(effectiveWatermarkId);
              if (!wmIdStr.startsWith('org-asset-')) {
                effectiveWatermarkId = `org-asset-${effectiveWatermarkId}`;
              }
            }

            if (effectiveWatermarkId) {
              const existingRatios = watermarkIdToRatios.get(effectiveWatermarkId) || [];
              existingRatios.push(ratio);
              watermarkIdToRatios.set(effectiveWatermarkId, existingRatios);
            }
          }
        }
      }

      // If no per-ratio settings found, just use the default watermarkId for all ratios
      if (watermarkIdToRatios.size === 0 && watermarkId) {
        watermarkIdToRatios.set(watermarkId, ['16:9', '9:16', '1:1', '4:5']);
      }
      // If watermarks already exist, force-sync their perRatioConfigs with creator profile settings
      // We always overwrite to ensure stored data matches the project's watermark settings (source of truth)
      if (watermarks.value.length > 0 && Object.keys(ratioConfigs).length > 0) {
        for (const watermark of watermarks.value) {
          // Only sync watermarks that are from the creator profile (matching watermarkId)
          // Try direct lookup first
          let ratiosForThisWatermark = watermarkIdToRatios.get(watermark.watermarkId || '');

          // If not found and main watermarkId is in org-asset format,
          // try normalizing the stored watermarkId to match the map key format
          if (!ratiosForThisWatermark && watermarkId?.startsWith('org-asset-') && watermark.watermarkId) {
            const wmIdStr = String(watermark.watermarkId);
            if (!wmIdStr.startsWith('org-asset-')) {
              ratiosForThisWatermark = watermarkIdToRatios.get(`org-asset-${wmIdStr}`);
            }
          }

          // Skip watermarks not in the creator profile (e.g., manually added watermarks)
          if (!ratiosForThisWatermark) {
            continue;
          }

          // Build updated perRatioConfigs from creator profile settings
          const updatedPerRatioConfigs: Record<
            string,
            { position: { x: number; y: number }; scale: number; opacity: number; isFullFrameOverlay?: boolean }
          > = {};

          for (const [ratio, config] of Object.entries(ratioConfigs)) {
            if (ratiosForThisWatermark.includes(ratio)) {
              // This ratio uses this watermark - apply creator profile settings
              updatedPerRatioConfigs[ratio] = {
                position: { x: config.position.x, y: config.position.y },
                scale: config.position.scale,
                opacity: config.position.opacity,
                isFullFrameOverlay: config.position.isFullFrameOverlay,
              };
            } else {
              // This ratio uses a different watermark - hide this one
              updatedPerRatioConfigs[ratio] = {
                position: { x: 0, y: 0 },
                scale: 0,
                opacity: 0,
              };
            }
          }

          const newConfigs = JSON.stringify(updatedPerRatioConfigs);

          // Update in-memory - always overwrite to match source of truth
          watermark.perRatioConfigs = updatedPerRatioConfigs;

          // Also update the default position/scale/opacity from the primary ratio
          const primaryRatio = ratiosForThisWatermark.includes('16:9') ? '16:9' : ratiosForThisWatermark[0];
          if (primaryRatio && ratioConfigs[primaryRatio]) {
            const config = ratioConfigs[primaryRatio];
            watermark.position = { x: config.position.x, y: config.position.y };
            watermark.scale = config.position.scale;
            watermark.opacity = config.position.opacity;
          }

          // Save to database - always update to keep in sync
          const updateData = {
            position_x: watermark.position.x,
            position_y: watermark.position.y,
            scale: watermark.scale,
            opacity: watermark.opacity,
            per_ratio_configs_data: newConfigs,
          };

          if (editorMode.value) {
            await updateVideoEditorWatermark(watermark.id, updateData);
          } else {
            await updateWatermarkRecord(watermark.id, updateData);
          }
        }

        return; // Don't create new watermarks, we've processed the existing ones
      }

      // If no watermarks exist yet, create them
      if (watermarks.value.length > 0) {
        return;
      }

      // Helper function to load watermark data by ID
      async function loadWatermarkData(wmId: string): Promise<{
        record: { id: string; file_path: string; width?: number | null; height?: number | null } | null;
        previewUrl: string | null;
        filePath: string | null;
      }> {
        let record: { id: string; file_path: string; width?: number | null; height?: number | null } | null = null;
        let preview: string | null = null;
        let path: string | null = null;

        // Check if this is an organization asset (ID format: org-asset-{serverId})
        if (wmId.startsWith('org-asset-')) {
          const serverId = parseInt(wmId.replace('org-asset-', ''), 10);

          if (!isNaN(serverId)) {
            // First try to load from local cache
            const localWatermark = await getWatermarkByServerId(serverId);
            if (localWatermark) {
              record = localWatermark;
              path = localWatermark.file_path;
              preview = await invoke<string>('read_file_as_data_url', { filePath: localWatermark.file_path });
            } else {
              // Not cached locally - download through Tauri (bypasses CORS)
              const serverResponse = await getUserOrganizationAssets();
              if (serverResponse.success && serverResponse.assets) {
                const serverAsset = serverResponse.assets.find(
                  (a) => a.id === serverId && a.asset_type === 'watermark'
                );
                if (serverAsset && serverAsset.url) {
                  // Download and cache the asset locally (bypasses CORS)
                  const downloadResult = await ensureAssetDownloaded(serverAsset);
                  if (downloadResult.success && downloadResult.filePath) {
                    preview = await invoke<string>('read_file_as_data_url', { filePath: downloadResult.filePath });
                    path = downloadResult.filePath;
                    record = {
                      id: wmId,
                      file_path: downloadResult.filePath,
                      width: serverAsset.width,
                      height: serverAsset.height,
                    };
                  } else {
                    console.error('[ClipEditorDialog] Failed to download org watermark:', downloadResult.error);
                  }
                }
              }
            }
          }
        } else {
          // Regular watermark lookup by ID
          const watermark = await getWatermarkImage(wmId);
          if (watermark) {
            record = watermark;
            path = watermark.file_path;
            preview = await invoke<string>('read_file_as_data_url', { filePath: watermark.file_path });
          }
        }

        return { record, previewUrl: preview, filePath: path };
      }

      // Create the watermark in the database
      const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
      if (!editId) {
        return;
      }

      // Create a watermark entry for each unique watermarkId
      for (const [wmId, ratiosForThisWatermark] of watermarkIdToRatios.entries()) {
        const { record, previewUrl, filePath } = await loadWatermarkData(wmId);

        if (!record || !filePath || !previewUrl) {
          continue;
        }

        // Build per-ratio configs for this watermark
        // Only include ratios where this watermark should be visible
        // Set opacity to 0 for ratios that use a different watermark
        const perRatioConfigsForThisWatermark: Record<
          string,
          { position: { x: number; y: number }; scale: number; opacity: number; isFullFrameOverlay?: boolean }
        > = {};

        // Process all ratios from the creator settings
        for (const [ratio, config] of Object.entries(ratioConfigs)) {
          if (ratiosForThisWatermark.includes(ratio)) {
            // This ratio uses this watermark - apply full settings
            perRatioConfigsForThisWatermark[ratio] = {
              position: { x: config.position.x, y: config.position.y },
              scale: config.position.scale,
              opacity: config.position.opacity,
              isFullFrameOverlay: config.position.isFullFrameOverlay,
            };
          } else {
            // This ratio uses a different watermark - hide this one (opacity 0)
            perRatioConfigsForThisWatermark[ratio] = {
              position: { x: 0, y: 0 },
              scale: 0,
              opacity: 0,
            };
          }
        }

        // Find default position from 16:9 if available, or first available ratio
        let defaultPosition = { x: 8, y: 92 };
        let defaultScale = 15;
        let defaultOpacity = 80;

        const primaryRatio = ratiosForThisWatermark.includes('16:9') ? '16:9' : ratiosForThisWatermark[0];
        if (primaryRatio && ratioConfigs[primaryRatio]) {
          const config = ratioConfigs[primaryRatio];
          defaultPosition = { x: config.position.x, y: config.position.y };
          defaultScale = config.position.scale;
          defaultOpacity = config.position.opacity;
        }

        const watermarkData = {
          watermark_id: wmId,
          watermark_path: filePath,
          preview_url: previewUrl,
          start_time: 0,
          end_time: totalSegmentDuration.value,
          position_x: defaultPosition.x,
          position_y: defaultPosition.y,
          scale: defaultScale,
          opacity: defaultOpacity,
          per_ratio_configs_data: JSON.stringify(perRatioConfigsForThisWatermark),
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
          perRatioConfigs: perRatioConfigsForThisWatermark,
        });
      }
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
  async function onUpdateOverlayPosition(
    type: 'text' | 'sticker' | 'watermark',
    id: string,
    position: { x: number; y: number }
  ) {
    const key = `${type}-${id}-position`;
    const ratio = previewAspectRatio.value;

    // Get original value if this is the start of an operation
    let originalValue: { x: number; y: number } | undefined;
    if (!overlayOperationStartValues.value.has(key)) {
      // Capture original value
      if (type === 'text') {
        const overlay = textOverlays.value.find((o) => o.id === id);
        if (overlay) {
          const config = overlay.perRatioConfigs?.[ratio];
          originalValue = config?.position || overlay.position;
          overlayOperationStartValues.value.set(key, { property: 'position', value: { ...originalValue } });
        }
      } else if (type === 'sticker') {
        const sticker = stickers.value.find((s) => s.id === id);
        if (sticker) {
          const config = sticker.perRatioConfigs?.[ratio];
          originalValue = config?.position || sticker.position;
          overlayOperationStartValues.value.set(key, { property: 'position', value: { ...originalValue } });
        }
      } else if (type === 'watermark') {
        const watermark = watermarks.value.find((w) => w.id === id);
        if (watermark) {
          const config = watermark.perRatioConfigs?.[ratio];
          originalValue = config?.position || watermark.position;
          overlayOperationStartValues.value.set(key, { property: 'position', value: { ...originalValue } });
        }
      }
    } else {
      originalValue = overlayOperationStartValues.value.get(key)?.value;
    }

    // Apply the update immediately for responsive UI
    if (type === 'text') {
      const overlay = textOverlays.value.find((o) => o.id === id);
      if (overlay) {
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
      const sticker = stickers.value.find((s) => s.id === id);
      if (sticker) {
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
      const watermark = watermarks.value.find((w) => w.id === id);
      if (watermark) {
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

  // Handle track item selection from preview
  function onTrackItemSelect(itemId: string, type: string) {
    // If empty itemId, clear selection; otherwise select the item
    if (itemId) {
      selectedItemIds.value = new Set([itemId]);
    } else {
      selectedItemIds.value = new Set();
    }
  }

  // Called when drag operation ends - creates undo/redo command
  async function onOverlayPositionChangeComplete(type: 'text' | 'sticker' | 'watermark', id: string) {
    const key = `${type}-${id}-position`;
    const startData = overlayOperationStartValues.value.get(key);

    if (!startData) return; // No operation in progress

    const ratio = previewAspectRatio.value;
    let finalValue: { x: number; y: number } | undefined;

    // Get final value
    if (type === 'text') {
      const overlay = textOverlays.value.find((o) => o.id === id);
      const config = overlay?.perRatioConfigs?.[ratio];
      finalValue = config?.position || overlay?.position;
    } else if (type === 'sticker') {
      const sticker = stickers.value.find((s) => s.id === id);
      const config = sticker?.perRatioConfigs?.[ratio];
      finalValue = config?.position || sticker?.position;
    } else if (type === 'watermark') {
      const watermark = watermarks.value.find((w) => w.id === id);
      const config = watermark?.perRatioConfigs?.[ratio];
      finalValue = config?.position || watermark?.position;
    }

    if (!finalValue) return;

    // Check if value actually changed
    const originalValue = startData.value;
    if (originalValue.x === finalValue.x && originalValue.y === finalValue.y) {
      overlayOperationStartValues.value.delete(key);
      return; // No change, don't create command
    }

    // Create command for undo/redo
    const commandData: UpdateOverlayPropertyCommandData = {
      type,
      itemId: id,
      property: 'position',
      aspectRatio: ratio,
      originalValue,
      newValue: finalValue,
      onReload: async () => {
        // Reload callback - for clip mode, state is already updated
        // For editor mode, would reload from database
        if (editorMode.value) {
          await loadEditorProject();
        }
      },
    };

    const command = new UpdateOverlayPropertyCommand(editorMode.value, commandData);
    await commandHistory.executeCommand(command);
    undoRedoTrigger.value++;

    // Clear the start value
    overlayOperationStartValues.value.delete(key);
  }

  async function onUpdateOverlayWidth(id: string, width: number) {
    const key = `text-${id}-width`;
    const ratio = previewAspectRatio.value;

    // Capture original value if this is the start of an operation
    if (!overlayOperationStartValues.value.has(key)) {
      const overlay = textOverlays.value.find((o) => o.id === id);
      if (overlay) {
        const config = overlay.perRatioConfigs?.[ratio];
        const originalWidth = config?.style?.width || overlay.style?.width || 0;
        overlayOperationStartValues.value.set(key, { property: 'width', value: originalWidth });
      }
    }

    // Apply the update immediately for responsive UI
    const overlay = textOverlays.value.find((o) => o.id === id);
    if (overlay) {
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

  async function onOverlayWidthChangeComplete(id: string) {
    const key = `text-${id}-width`;
    const startData = overlayOperationStartValues.value.get(key);

    if (!startData) return;

    const ratio = previewAspectRatio.value;
    const overlay = textOverlays.value.find((o) => o.id === id);
    const config = overlay?.perRatioConfigs?.[ratio];
    const finalWidth = config?.style?.width || overlay?.style?.width || 0;

    if (!finalWidth || startData.value === finalWidth) {
      overlayOperationStartValues.value.delete(key);
      return;
    }

    const commandData: UpdateOverlayPropertyCommandData = {
      type: 'text',
      itemId: id,
      property: 'width',
      aspectRatio: ratio,
      originalValue: startData.value,
      newValue: finalWidth,
      onReload: async () => {
        if (editorMode.value) {
          await loadEditorProject();
        }
      },
    };

    const command = new UpdateOverlayPropertyCommand(editorMode.value, commandData);
    await commandHistory.executeCommand(command);
    undoRedoTrigger.value++;

    overlayOperationStartValues.value.delete(key);
  }

  async function onUpdateOverlayRotation(id: string, rotation: number) {
    const key = `text-${id}-rotation`;
    const ratio = previewAspectRatio.value;

    // Capture original value if this is the start of an operation
    if (!overlayOperationStartValues.value.has(key)) {
      const overlay = textOverlays.value.find((o) => o.id === id);
      if (overlay) {
        const config = overlay.perRatioConfigs?.[ratio];
        const originalRotation = config?.rotation ?? overlay.rotation ?? 0;
        overlayOperationStartValues.value.set(key, { property: 'rotation', value: originalRotation });
      }
    }

    // Apply the update immediately for responsive UI
    const overlay = textOverlays.value.find((o) => o.id === id);
    if (overlay) {
      const perRatioConfigs = overlay.perRatioConfigs || {};
      const currentConfig = perRatioConfigs[ratio] || {
        position: { ...overlay.position },
        style: { ...overlay.style },
      };
      currentConfig.rotation = rotation;
      perRatioConfigs[ratio] = currentConfig;
      updateTextOverlayLocal(id, { perRatioConfigs });
    }
  }

  async function onOverlayRotationChangeComplete(id: string) {
    const key = `text-${id}-rotation`;
    const startData = overlayOperationStartValues.value.get(key);

    if (!startData) return;

    const ratio = previewAspectRatio.value;
    const overlay = textOverlays.value.find((o) => o.id === id);
    const config = overlay?.perRatioConfigs?.[ratio];
    const finalRotation = config?.rotation ?? overlay?.rotation ?? 0;

    if (startData.value === finalRotation) {
      overlayOperationStartValues.value.delete(key);
      return;
    }

    const commandData: UpdateOverlayPropertyCommandData = {
      type: 'text',
      itemId: id,
      property: 'rotation',
      aspectRatio: ratio,
      originalValue: startData.value,
      newValue: finalRotation,
      onReload: async () => {
        if (editorMode.value) {
          await loadEditorProject();
        }
      },
    };

    const command = new UpdateOverlayPropertyCommand(editorMode.value, commandData);
    await commandHistory.executeCommand(command);
    undoRedoTrigger.value++;

    overlayOperationStartValues.value.delete(key);
  }

  async function onUpdateOverlayScale(id: string, scale: number) {
    const key = `text-${id}-scale`;
    const ratio = previewAspectRatio.value;

    // Capture original value if this is the start of an operation
    if (!overlayOperationStartValues.value.has(key)) {
      const overlay = textOverlays.value.find((o) => o.id === id);
      if (overlay) {
        const config = overlay.perRatioConfigs?.[ratio];
        const originalScale = config?.scale ?? overlay.scale ?? 1;
        overlayOperationStartValues.value.set(key, { property: 'scale', value: originalScale });
      }
    }

    // Apply the update immediately for responsive UI
    const overlay = textOverlays.value.find((o) => o.id === id);
    if (overlay) {
      const perRatioConfigs = overlay.perRatioConfigs || {};
      const currentConfig = perRatioConfigs[ratio] || {
        position: { ...overlay.position },
        style: { ...overlay.style },
      };
      currentConfig.scale = scale;
      perRatioConfigs[ratio] = currentConfig;
      updateTextOverlayLocal(id, { perRatioConfigs });
    }
  }

  async function onOverlayScaleChangeComplete(id: string) {
    const key = `text-${id}-scale`;
    const startData = overlayOperationStartValues.value.get(key);

    if (!startData) return;

    const ratio = previewAspectRatio.value;
    const overlay = textOverlays.value.find((o) => o.id === id);
    const config = overlay?.perRatioConfigs?.[ratio];
    const finalScale = config?.scale ?? overlay?.scale ?? 1;

    if (startData.value === finalScale) {
      overlayOperationStartValues.value.delete(key);
      return;
    }

    const commandData: UpdateOverlayPropertyCommandData = {
      type: 'text',
      itemId: id,
      property: 'scale',
      aspectRatio: ratio,
      originalValue: startData.value,
      newValue: finalScale,
      onReload: async () => {
        if (editorMode.value) {
          await loadEditorProject();
        }
      },
    };

    const command = new UpdateOverlayPropertyCommand(editorMode.value, commandData);
    await commandHistory.executeCommand(command);
    undoRedoTrigger.value++;

    overlayOperationStartValues.value.delete(key);
  }

  async function onUpdateStickerScale(id: string, scale: number) {
    const key = `sticker-${id}-scale`;
    const ratio = previewAspectRatio.value;

    // Capture original value if this is the start of an operation
    if (!overlayOperationStartValues.value.has(key)) {
      const sticker = stickers.value.find((s) => s.id === id);
      if (sticker) {
        const config = sticker.perRatioConfigs?.[ratio];
        const originalScale = config?.scale ?? sticker.scale;
        overlayOperationStartValues.value.set(key, { property: 'scale', value: originalScale });
      }
    }

    // Apply the update immediately for responsive UI
    const sticker = stickers.value.find((s) => s.id === id);
    if (sticker) {
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

  async function onStickerScaleChangeComplete(id: string) {
    const key = `sticker-${id}-scale`;
    const startData = overlayOperationStartValues.value.get(key);

    if (!startData) return;

    const ratio = previewAspectRatio.value;
    const sticker = stickers.value.find((s) => s.id === id);
    const config = sticker?.perRatioConfigs?.[ratio];
    const finalScale = config?.scale ?? sticker?.scale ?? 1;

    if (startData.value === finalScale) {
      overlayOperationStartValues.value.delete(key);
      return;
    }

    const commandData: UpdateOverlayPropertyCommandData = {
      type: 'sticker',
      itemId: id,
      property: 'scale',
      aspectRatio: ratio,
      originalValue: startData.value,
      newValue: finalScale,
      onReload: async () => {
        if (editorMode.value) {
          await loadEditorProject();
        }
      },
    };

    const command = new UpdateOverlayPropertyCommand(editorMode.value, commandData);
    await commandHistory.executeCommand(command);
    undoRedoTrigger.value++;

    overlayOperationStartValues.value.delete(key);
  }

  async function onUpdateStickerRotation(id: string, rotation: number) {
    const key = `sticker-${id}-rotation`;
    const ratio = previewAspectRatio.value;

    // Capture original value if this is the start of an operation
    if (!overlayOperationStartValues.value.has(key)) {
      const sticker = stickers.value.find((s) => s.id === id);
      if (sticker) {
        const config = sticker.perRatioConfigs?.[ratio];
        const originalRotation = config?.rotation ?? sticker.rotation ?? 0;
        overlayOperationStartValues.value.set(key, { property: 'rotation', value: originalRotation });
      }
    }

    // Apply the update immediately for responsive UI
    const sticker = stickers.value.find((s) => s.id === id);
    if (sticker) {
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

  async function onStickerRotationChangeComplete(id: string) {
    const key = `sticker-${id}-rotation`;
    const startData = overlayOperationStartValues.value.get(key);

    if (!startData) return;

    const ratio = previewAspectRatio.value;
    const sticker = stickers.value.find((s) => s.id === id);
    const config = sticker?.perRatioConfigs?.[ratio];
    const finalRotation = config?.rotation ?? sticker?.rotation ?? 0;

    if (startData.value === finalRotation) {
      overlayOperationStartValues.value.delete(key);
      return;
    }

    const commandData: UpdateOverlayPropertyCommandData = {
      type: 'sticker',
      itemId: id,
      property: 'rotation',
      aspectRatio: ratio,
      originalValue: startData.value,
      newValue: finalRotation,
      onReload: async () => {
        if (editorMode.value) {
          await loadEditorProject();
        }
      },
    };

    const command = new UpdateOverlayPropertyCommand(editorMode.value, commandData);
    await commandHistory.executeCommand(command);
    undoRedoTrigger.value++;

    overlayOperationStartValues.value.delete(key);
  }

  async function onUpdateWatermarkScale(id: string, scale: number) {
    const key = `watermark-${id}-scale`;
    const ratio = previewAspectRatio.value;

    // Capture original value if this is the start of an operation
    if (!overlayOperationStartValues.value.has(key)) {
      const watermark = watermarks.value.find((w) => w.id === id);
      if (watermark) {
        const config = watermark.perRatioConfigs?.[ratio];
        const originalScale = config?.scale ?? watermark.scale;
        overlayOperationStartValues.value.set(key, { property: 'scale', value: originalScale });
      }
    }

    // Apply the update immediately for responsive UI
    const watermark = watermarks.value.find((w) => w.id === id);
    if (watermark) {
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

  async function onWatermarkScaleChangeComplete(id: string) {
    const key = `watermark-${id}-scale`;
    const startData = overlayOperationStartValues.value.get(key);

    if (!startData) return;

    const ratio = previewAspectRatio.value;
    const watermark = watermarks.value.find((w) => w.id === id);
    const config = watermark?.perRatioConfigs?.[ratio];
    const finalScale = config?.scale ?? watermark?.scale ?? 1;

    if (startData.value === finalScale) {
      overlayOperationStartValues.value.delete(key);
      return;
    }

    const commandData: UpdateOverlayPropertyCommandData = {
      type: 'watermark',
      itemId: id,
      property: 'scale',
      aspectRatio: ratio,
      originalValue: startData.value,
      newValue: finalScale,
      onReload: async () => {
        if (editorMode.value) {
          await loadEditorProject();
        }
      },
    };

    const command = new UpdateOverlayPropertyCommand(editorMode.value, commandData);
    await commandHistory.executeCommand(command);
    undoRedoTrigger.value++;

    overlayOperationStartValues.value.delete(key);
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

  async function onBuildCompleted(buildId: string) {
    console.log('[ClipEditorDialog] Build completed:', buildId);

    // Handle in-editor tracking for built clips
    if (props.clipId && inEditorStore.isInEditor(props.clipId)) {
      // Update asset path to the built file path if available
      try {
        const clip = await getClipWithBuildStatus(props.clipId);
        if (clip?.built_file_path) {
          inEditorStore.updateAssetPath(props.clipId, clip.built_file_path);
        }
      } catch (err) {
        console.warn('[ClipEditorDialog] Failed to update asset path after build:', err);
      }

      // Show confirmation dialog to ask user if they want to clear from in-editor tracking
      showClearInEditorDialog.value = true;
    }
  }

  function onBuildFailed(error: string) {
    console.error('[ClipEditorDialog] Build failed:', error);
  }

  // Clear In Editor dialog handlers
  function onClearInEditorConfirm() {
    if (props.clipId) {
      inEditorStore.clearClip(props.clipId);
      console.log('[ClipEditorDialog] Cleared clip from in-editor tracking after user confirmation');
    }
    showClearInEditorDialog.value = false;
  }

  function onClearInEditorCancel() {
    console.log('[ClipEditorDialog] User chose to keep clip in in-editor tracking');
    showClearInEditorDialog.value = false;
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
        segmentFramingConfigs.value = editData.aspectFraming.segmentConfigs || {};
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
        pan: t.pan,
        fadeIn: t.fade_in,
        fadeOut: t.fade_out,
        trackOrder: t.track_order,
        isMuted: !!t.is_muted,
        isSolo: !!t.is_solo,
        linkedSourceId: (t as any).source_id, // Only present in editor mode
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
        keyframes: (o as any).keyframes_data ? JSON.parse((o as any).keyframes_data) : undefined,
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
        keyframes: (s as any).keyframes_data ? JSON.parse((s as any).keyframes_data) : undefined,
      }));

      // Load watermarks - convert file paths to data URLs for preview
      watermarks.value = await Promise.all(
        fullEdit.watermarks.map(async (w) => {
          // Convert file path to data URL for preview display
          let previewUrl = w.preview_url;

          // If preview_url is already a valid URL or data URL, use it directly
          if (
            previewUrl &&
            (previewUrl.startsWith('http://') || previewUrl.startsWith('https://') || previewUrl.startsWith('data:'))
          ) {
            // Already a valid URL, use as-is
          } else if (!previewUrl && w.watermark_path) {
            // Check if watermark_path is a URL (for org assets)
            if (w.watermark_path.startsWith('http://') || w.watermark_path.startsWith('https://')) {
              previewUrl = w.watermark_path;
            } else {
              // It's a local file path, convert to data URL
              try {
                previewUrl = await invoke<string>('read_file_as_data_url', {
                  filePath: w.watermark_path,
                });
              } catch (err) {
                console.warn('[ClipEditorDialog] Failed to load watermark preview:', w.id, err);
                // Try to reload from watermark database using watermark_id
                previewUrl = await loadWatermarkPreviewUrl(w.watermark_id, w.watermark_path, null);
              }
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
            layer: w.layer ?? 0, // Visual track layer
            perRatioConfigs: w.per_ratio_configs_data ? JSON.parse(w.per_ratio_configs_data) : undefined,
            keyframes: (w as any).keyframes_data ? JSON.parse((w as any).keyframes_data) : undefined,
          };
        })
      );

      try {
        if (props.clipId) {
          // Get the clip to find its project_id
          const clip = await getClipWithBuildStatus(props.clipId);
          const clipProjectId = clip?.project_id;

          if (clipProjectId) {
            const { getCreatorProfileByProjectId } = await import('@/services/database');
            const creatorProfile = await getCreatorProfileByProjectId(clipProjectId);

            if (creatorProfile && creatorProfile.watermark_settings) {
              const watermarkSettings = JSON.parse(creatorProfile.watermark_settings);

              // Check if this creator watermark is already in the list
              const hasCreatorWatermark = watermarks.value.some((w) => w.watermarkId === creatorProfile.watermark_id);

              if (!hasCreatorWatermark && watermarkSettings.watermarkPath) {
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
                  watermarkId: creatorProfile.watermark_id ?? '',
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

    if (e.key === 'Escape') {
      close();
    } else if (e.key === ' ' && !isTyping) {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveNow(); // Save immediately on Ctrl+S
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !isTyping) {
      e.preventDefault();
      performUndo();
    } else if (
      ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) || (e.key === 'y' && (e.ctrlKey || e.metaKey))) &&
      !isTyping
    ) {
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
    } else if (e.key === 'ArrowLeft' && !isTyping) {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Left: Seek back 10 frames (approx 0.33s)
        seekFrame(-10);
      } else {
        // Left: Seek back 1 frame (approx 0.033s)
        seekFrame(-1);
      }
    } else if (e.key === 'ArrowRight' && !isTyping) {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Right: Seek forward 10 frames
        seekFrame(10);
      } else {
        // Right: Seek forward 1 frame
        seekFrame(1);
      }
    }
  }

  // Frame seek helper (assumes 30fps for now)
  function seekFrame(frameCount: number) {
    const FRAME_DURATION = 1 / 30; // 0.0333...
    const currentTime = editorMode.value ? previewTime.value : relativePreviewTime.value;
    const maxDuration = editorMode.value ? editorDuration.value : clipDuration.value;

    // Calculate new time
    let newTime = currentTime + frameCount * FRAME_DURATION;

    // Clamp to bounds
    newTime = Math.max(0, Math.min(maxDuration, newTime));

    // Update preview
    if (editorMode.value) {
      // In editor mode, previewTime is global
      previewTime.value = newTime;
      // Seek logic handles the rest
      seekTo(newTime);
    } else {
      // In clip mode, convert relative back to absolute
      const absoluteTime = props.clipStartTime + newTime;
      seekTo(absoluteTime);
    }
  }

  // Undo/Redo operations
  async function performUndo() {
    try {
      await commandHistory.undo();
      undoRedoTrigger.value++; // Trigger reactivity update for button states
    } catch (error) {
      console.error('[ClipEditorDialog] Undo failed:', error);
      alert('Could not undo the last operation');
    }
  }

  async function performRedo() {
    try {
      await commandHistory.redo();
      undoRedoTrigger.value++; // Trigger reactivity update for button states
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
      } catch (error) {
        console.error('[ClipEditorDialog] Paste failed:', error);
        alert(`Could not paste segment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // TODO: Implement for editor mode
      console.log('[ClipEditorDialog] Paste not yet implemented for editor mode');
    }
  }

  /**
   * Paste in place - paste at the original position of the copied segment
   */
  async function performPasteInPlace() {
    if (!copiedSegment.value) {
      console.warn('[ClipEditorDialog] No segment in clipboard to paste');
      alert('No segment copied. Press Ctrl+C to copy a segment first.');
      return;
    }

    if (!editorMode.value && props.clipId) {
      try {
        // Use the original start time from the copied segment
        const originalStartTime = copiedSegment.value.start_time - props.clipStartTime;

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

        // Create and execute paste command at original position
        const pasteCommand = new PasteCommand(false, {
          clipId: props.clipId,
          clipStartTime: props.clipStartTime,
          pasteAtTime: originalStartTime,
          copiedSegment: copiedSegment.value,
          onReload: reloadCallback,
        });

        await commandHistory.executeCommand(pasteCommand);
        undoRedoTrigger.value++;
      } catch (error) {
        console.error('[ClipEditorDialog] Paste in place failed:', error);
        alert(`Could not paste segment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // TODO: Implement for editor mode
      console.log('[ClipEditorDialog] Paste in place not yet implemented for editor mode');
    }
  }

  // ============================================================================
  // PHASE 2 FEATURE HANDLERS
  // ============================================================================

  // Freeze Frame
  function handleFreezeFrame(data: { sourceId: string; time: number; duration: number }) {
    // In editor mode, create a freeze frame segment
    if (editorMode.value) {
      console.log('[ClipEditorDialog] Adding freeze frame:', data);
      // Implementation logic would go here: create new source with freeze flag or extract frame
      // For now, we'll just log it as the core logic is in the timeline component
    }
  }

  // Speed Ramping
  function handleAddSpeedKeyframe(sourceId: string, time: number, speed: number) {
    if (!editorMode.value) return;
    const source = videoSources.value.find((s) => s.id === sourceId);
    if (!source) return;

    // Add keyframe to source data (would be persisted to DB)
    console.log('[ClipEditorDialog] Adding speed keyframe:', { sourceId, time, speed });
    // updateVideoEditorSource(sourceId, { speed_keyframes: ... });
  }

  function handleUpdateSpeedKeyframe(sourceId: string, keyframeId: string, updates: any) {
    console.log('[ClipEditorDialog] Updating speed keyframe:', { sourceId, keyframeId, updates });
  }

  function handleDeleteSpeedKeyframe(sourceId: string, keyframeId: string) {
    console.log('[ClipEditorDialog] Deleting speed keyframe:', { sourceId, keyframeId });
  }

  function handleOpenSpeedCurveEditor(sourceId: string) {
    const source = videoSources.value.find((s) => s.id === sourceId);
    if (!source) return;

    speedCurveEditorSourceId.value = sourceId;
    // Load keyframes for this source
    // speedCurveKeyframes.value = source.speed_keyframes || [];
    showSpeedCurveEditor.value = true;
  }

  function closeSpeedCurveEditor() {
    showSpeedCurveEditor.value = false;
    speedCurveEditorSourceId.value = null;
  }

  function getSpeedCurveDuration(): number {
    if (!speedCurveEditorSourceId.value) return 0;
    const source = videoSources.value.find((s) => s.id === speedCurveEditorSourceId.value);
    return source ? source.end_time - source.start_time : 0;
  }

  function handleApplySpeedPreset(keyframes: any[]) {
    if (!speedCurveEditorSourceId.value) return;
    // Apply keyframes to source
  }

  // Copy/Paste/Duplicate Handlers
  function handleCopyItems(itemKeys: string[]) {
    // Logic to copy items to clipboard state
    console.log('[ClipEditorDialog] Copying items:', itemKeys);
    // Store in local clipboard or store
  }

  function handlePasteItems(position: number) {
    console.log('[ClipEditorDialog] Pasting items at position:', position);
    // Logic to retrieve from clipboard and create new items
  }

  function handlePasteItemsToTrack(data: { position: number; targetTrackType: string; targetTrackId?: string }) {
    console.log('[ClipEditorDialog] Pasting to track:', data);
  }

  function handleDuplicateItems(itemKeys: string[]) {
    console.log('[ClipEditorDialog] Duplicating items:', itemKeys);
    // Logic to clone items immediately
  }

  // Grouping Handlers
  function handleGroupItems(itemKeys: string[]) {
    console.log('[ClipEditorDialog] Grouping items:', itemKeys);
    // Logic to create a group
  }

  function handleUngroupItems(groupId: string) {
    console.log('[ClipEditorDialog] Ungrouping group:', groupId);
    // Logic to disband a group
  }

  // ============================================================================
  // MULTI-SELECT HANDLERS
  // ============================================================================

  function handleSegmentSelect(segmentId: string, modifiers: { shift: boolean; ctrl: boolean }) {
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

    // TODO: Add MarkerCommand for undo/redo support
  }

  function deleteMarker(markerId: string) {
    const index = markers.value.findIndex((m) => m.id === markerId);
    if (index !== -1) {
      markers.value.splice(index, 1);
      selectedMarkerId.value = null;
    }

    // TODO: Add MarkerCommand for undo/redo support
  }

  function jumpToMarker(markerId: string) {
    const marker = markers.value.find((m) => m.id === markerId);
    if (marker) {
      seekTo(marker.time);
      selectedMarkerId.value = markerId;
    }
  }

  // ============================================================================
  // PHASE 3 FEATURE HANDLERS (Track Mgmt)
  // In/Out Points and Regions are managed by useTimelineMarkers composable
  // ============================================================================

  // Track Management
  function handleReorderTrack(trackType: 'audio' | 'overlay', trackId: string, newOrder: number) {
    if (trackType === 'audio') {
      const track = audioTracks.value.find((t) => t.id === trackId);
      if (!track) return;

      const oldOrder = track.trackOrder;
      if (oldOrder === newOrder) return; // No change

      // Clamp newOrder to valid range
      const maxOrder = audioTracks.value.length - 1;
      const clampedNewOrder = Math.max(0, Math.min(maxOrder, newOrder));

      // Shift other tracks to make room
      // If moving down (oldOrder < newOrder): shift tracks in between up
      // If moving up (oldOrder > newOrder): shift tracks in between down
      const updates: { id: string; trackOrder: number }[] = [];

      for (const t of audioTracks.value) {
        if (t.id === trackId) {
          // The track being moved
          t.trackOrder = clampedNewOrder;
          updates.push({ id: t.id, trackOrder: clampedNewOrder });
        } else if (oldOrder < clampedNewOrder) {
          // Moving down: shift tracks between old and new positions up by 1
          if (t.trackOrder > oldOrder && t.trackOrder <= clampedNewOrder) {
            t.trackOrder -= 1;
            updates.push({ id: t.id, trackOrder: t.trackOrder });
          }
        } else if (oldOrder > clampedNewOrder) {
          // Moving up: shift tracks between new and old positions down by 1
          if (t.trackOrder >= clampedNewOrder && t.trackOrder < oldOrder) {
            t.trackOrder += 1;
            updates.push({ id: t.id, trackOrder: t.trackOrder });
          }
        }
      }

      // Sort audioTracks by trackOrder for consistent rendering
      audioTracks.value.sort((a, b) => a.trackOrder - b.trackOrder);

      // Persist all changes to DB
      for (const update of updates) {
        updateAudioTrack(update.id, { track_order: update.trackOrder });
      }
    }
    // Overlay tracks (text, stickers, watermarks) use layer property instead of trackOrder
    // They are rendered in a single overlay track, so reordering is handled via layer changes
  }

  function handleToggleTrackCollapse(trackType: string, trackId?: string) {
    // This state is mostly local to the timeline, but if we need to persist it:
    // const key = trackId ? `${trackType}_${trackId}` : trackType;
    // Save to user preferences
  }

  function handleToggleVideoMute() {
    isVideoMuted.value = !isVideoMuted.value;
    // The mute state is passed to ClipEditorPreview via isVideoMuted prop
    // The preview component will handle muting both main and preload video elements
  }

  function handleToggleVideoLock() {
    isVideoLocked.value = !isVideoLocked.value;
  }

  function handleToggleAudioLock(trackId: string) {
    const track = audioTracks.value.find((t) => t.id === trackId);
    if (track) {
      const newLockedState = !track.isLocked;
      updateAudioTrackLocal(trackId, { isLocked: newLockedState });
    }
  }

  async function handleToggleAudioMute(trackId: string) {
    const track = audioTracks.value.find((t) => t.id === trackId);
    if (track) {
      const newMutedState = !track.isMuted;
      // Update local state immediately for responsive UI
      track.isMuted = newMutedState;
      // Apply mute state immediately before DB update
      applyMuteSoloState();
      // Then persist to database (don't await to keep UI responsive)
      updateAudioTrackLocal(trackId, { isMuted: newMutedState });
    }
  }

  async function handleToggleAudioSolo(trackId: string) {
    const track = audioTracks.value.find((t) => t.id === trackId);
    if (track) {
      const newSoloState = !track.isSolo;
      // Update local state immediately for responsive UI
      track.isSolo = newSoloState;
      // Apply solo state immediately to all tracks before DB update
      applyMuteSoloState();
      // Then persist to database (don't await to keep UI responsive)
      updateAudioTrackLocal(trackId, { isSolo: newSoloState });
    }
  }

  function handleToggleAudioHidden(trackId: string) {
    const track = audioTracks.value.find((t) => t.id === trackId);
    if (track) {
      const newHiddenState = !track.isHidden;
      updateAudioTrackLocal(trackId, { isHidden: newHiddenState });
    }
  }

  // Beat Detection
  const { detectBeats, isProcessing: isAudioProcessing } = useAudioWorker();
  const beatMarkers = ref<Array<{ id: string; time: number; confidence?: number }>>([]);

  async function handleDetectBeatMarkers(audioTrackId?: string) {
    let url = '';

    if (audioTrackId) {
      const track = audioTracksWithStreamingUrls.value.find((t) => t.id === audioTrackId);
      if (track) {
        url = track.filePath;
      }
    } else {
      // Use main video audio
      url = effectiveVideoSrc.value || '';
    }

    if (!url) {
      console.warn('[ClipEditorDialog] No audio source found for beat detection');
      return;
    }

    try {
      // Create offline context to decode audio
      // We assume standard sample rate, or use the context's default
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0); // Use first channel
      const sampleRate = audioBuffer.sampleRate;
      const beats = await detectBeats(channelData, sampleRate, 0.5); // 0.5 sensitivity

      // Convert to markers
      beatMarkers.value = beats.map((b, index) => ({
        id: `beat-${Date.now()}-${index}`,
        time: b.time,
        confidence: b.confidence,
      }));
    } catch (error) {
      console.error('[ClipEditorDialog] Beat detection failed:', error);
    }
  }

  function handleClearBeatMarkers() {
    beatMarkers.value = [];
  }

  // ============================================================================
  // VIDEO HANDLERS
  // ============================================================================

  // Handle video element loaded - apply any pending seek
  function onVideoLoaded() {
    if (!editorMode.value || !videoElement.value) return;

    // Use shouldResumePlayback ref that was set at the start of seekTo
    // This properly tracks whether video was playing before the seek started
    const wasPlaying = shouldResumePlayback.value;
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

    // Clear seeking flag and reset shouldResumePlayback
    setTimeout(() => {
      isSeeking.value = false;
      shouldResumePlayback.value = false;
    }, 50);
  }

  // Watch for video source changes in editor mode
  watch(
    () => editorVideoSrc.value,
    async (newSrc, oldSrc) => {
      if (editorMode.value && newSrc && newSrc !== oldSrc && videoElement.value) {
        // Skip processing if the preload video is the active one
        // This happens after crossfade completes - the main video's src changes
        // but we're already playing the preload video, so no action needed
        const preloadEl = previewRef.value?.getPreloadVideoElement?.();
        if (preloadEl && videoElement.value === preloadEl) {
          // We're using the preload video as active - don't reload/seek main video
          return;
        }

        isSeeking.value = true;

        // If there's no pending seek, calculate the seek time for the new source
        if (pendingSeekTime.value === null) {
          const source = activeVideoSource.value;
          if (source) {
            pendingSeekTime.value = previewTime.value - source.start_time + source.trim_start;
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
  watchForChanges([
    () => filterSegments.value,
    () => trimSegments.value,
    () => originalDb.value,
    () => trackDbValues.value,
    () => selectedAspectRatios.value,
    () => framingMode.value,
    () => framingConfigs.value,
    () => segmentFramingConfigs.value,
  ]);

  // Watch for clip ID changes - clear command history when switching clips
  watch(
    () => props.clipId,
    (newClipId, oldClipId) => {
      if (newClipId && oldClipId && newClipId !== oldClipId) {
        commandHistory.clear();
      }
    }
  );

  // Watch for editor project ID changes - clear command history when switching projects
  watch(
    () => props.editorProjectId,
    (newProjectId, oldProjectId) => {
      if (newProjectId && oldProjectId && newProjectId !== oldProjectId) {
        commandHistory.clear();
      }
    }
  );

  // Lifecycle
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen) {
        resetForNewSession(); // Prevent auto-save during load

        // Clear command history when opening a clip/project
        // This ensures each clip/project starts with a fresh undo/redo stack
        commandHistory.clear();

        if (editorMode.value && editorProjectId.value) {
          // Editor mode - load video sources
          await loadEditorProject();
          await loadProjectId(); // Load project ID for transcript/subtitles
          previewTime.value = 0;
          activeEditorTab.value = 'media';

          // Auto-apply creator watermark if available (from props or video sources)
          await applyCreatorWatermark();

          // Generate segment preview if there are multiple segments
          // This enables seamless playback across segment cuts
          if (trimSegments.value.length > 1) {
            triggerPreviewGeneration();
          }
        } else if (props.clipId) {
          // Clip mode - existing behavior
          await loadEditData();
          await loadProjectId();

          // Add clip to in-editor tracking (idempotent)
          await inEditorStore.addClip({
            clipId: props.clipId,
            projectId: projectId.value,
            projectNameSnapshot: null, // Will be populated from clip data if available
            origin: 'project',
            assetPath: props.videoSrc || null,
          });

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

          // Generate segment preview if there are multiple segments
          // This enables seamless playback across segment cuts
          if (trimSegments.value.length > 1) {
            triggerPreviewGeneration();
          }
        }

        // Allow auto-save after initial load is complete
        setTimeout(() => {
          setInitialLoadComplete();
        }, 100);
      } else if (!isOpen) {
        // Save any pending changes before closing
        // Use computed editorMode/editorProjectId to handle promoted state
        if (editorMode.value && editorProjectId.value) {
          emit('editorSave', editorProjectId.value);
        } else {
          await saveNow();
        }

        // Clean up when dialog closes
        cleanupAudioElements();
        isPlaying.value = false;
        // Clear command history when closing
        commandHistory.clear();
        // Clean up segment preview file
        await cleanupSegmentPreview();
        // Reset aspect tab state
        videoPath.value = null;
        thumbnailUrl.value = null;
        editorThumbnailUrl.value = null;
        // Reset transcript state
        projectId.value = null;
        // Reset auto-save state
        resetForNewSession();
        // Reset editor mode state
        videoSources.value = [];
        videoEditorEditId.value = null;
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
    resetForNewSession();
    // Clear command history when closing editor
    commandHistory.clear();
    // Clean up segment preview file
    cleanupSegmentPreview();
  });
</script>

<style scoped>
  /* Custom scrollbar for tab content (not achievable with Tailwind) */
  .tab-content-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .tab-content-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .tab-content-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.12);
    border-radius: 3px;
  }

  .tab-content-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
</style>
