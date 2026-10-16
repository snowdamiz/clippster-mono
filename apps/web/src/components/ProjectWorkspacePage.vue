<template>
  <section
    aria-label="Project workspace"
    class="h-full w-full overflow-hidden bg-[var(--sidebar-surface)] text-[var(--sidebar-text)]"
  >
    <div class="flex h-full flex-col">
      <ProjectWorkspaceHeader :title="project.name" :badge="previewState.preset.value ? `${previewState.preset.value.targetAspectRatio} Pre-Edit` : undefined" @close="close" />
      <div
        v-if="error"
        role="alert"
        class="shrink-0 border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-300"
      >
        {{ error }}
        <a v-if="billingUrl && /plan|credit|limit/i.test(error)" :href="billingUrl" target="_top" class="ml-3 underline">Manage plan</a>
      </div>
      <div v-if="activeJob" role="status" class="shrink-0 border-b border-white/10 px-5 py-3">
        <div class="mb-2 flex justify-between text-xs">
          <span>{{ activeJob.message }}</span>
          <button
            @click="$emit('cancel', activeJob.id)"
          >
            Cancel
          </button>
        </div>
        <progress class="h-1.5 w-full accent-sky-400" :value="activeJob.progress" max="100" />
      </div>
      <div v-if="project.status !== 'ready'" class="min-h-0 flex-1 overflow-y-auto">
        <ImportSource
          :busy="busy"
          :upload-progress="uploadProgress"
          @import="(url) => $emit('import', url)"
          @upload="(file) => $emit('upload', file)"
        />
      </div>
      <div
        v-else
        class="workspace-dialog__content"
      >
        <section ref="previewContainer" class="workspace-dialog__player-column" :class="{ 'workspace-dialog__player-column--fullscreen': isFullscreen }">
          <WorkspacePreviewControls v-if="previewState.preset.value" v-model:ratio="previewState.ratio.value" v-model:social="previewState.social.value" :options="previewState.options.value" />
          <div
            class="workspace-dialog__video-wrapper"
          >
            <VideoPlayer
              :video-src="videoState.source.value"
              :video-loading="loading"
              :video-error="videoError"
              :is-playing="playback.playing.value"
              :aspect-ratio="previewState.aspect.value"
              :framing-regions="videoState.builtClip.value ? undefined : previewState.config.value?.regions"
              :manual-framing-config="videoState.builtClip.value ? null : previewState.config.value"
              :watermark-settings="previewState.watermarkSettings.value"
              :watermark-data="videoState.builtClip.value ? null : previewState.watermarkData.value"
              :current-time="playback.time.value"
              :subtitle-settings="subtitleSettings"
              :subtitle-initial-position="draft?.subtitleSettings?.perRatioConfigs?.[previewState.ratio.value]?.position"
              :resolve-media-src="(id: string) => framingAssetPath(project.id, id)"
              :clip-text-box-state="videoState.builtClip.value ? undefined : draft?.textBox || undefined"
              :clip-absolute-start="playback.time.value - clipTime"
              :transcript-words="playerWords"
              :transcript-segments="subtitleSegments"
              :clip-text-box-interactive="panel === 'text'"
              :clip-text-box-ignore-timing="panel === 'text'"
              @clip-text-box-selected="panel = 'text'"
              @subtitle-selected="panel = 'subtitles'"
              @subtitle-font-size-change="updateSubtitleSettings({ fontSize: $event })"
              @subtitle-position-change="(position, width) => draft && saveSubtitlePosition(previewState.ratio.value, position, width)"
              @clip-text-box-position-change="position => updateTextBox({ positionX: position.x, positionY: position.y, widthPct: position.widthPct })"
              @video-element-ready="playback.ready"
              @time-update="playback.update"
              @toggle-play-pause="playback.toggle"
              @video-ended="playback.pause"
              @loaded-metadata="loading = false; videoState.loaded()"
              @load-start="loading = true"
              @can-play="loading = false"
              @video-error="onVideoError"
              @retry-load="retry"
              @watermark-id-change="previewState.loadWatermark"
            />
            <div v-if="previewState.social.value && previewState.ratio.value === '9:16'" style="position:absolute;inset:0;z-index:100;pointer-events:none;user-select:none"><SocialOverlay :preset="previewState.social.value" :canvas-width="previewState.aspect.value.width" :canvas-height="previewState.aspect.value.height" /></div>
          </div>
          <VideoControls
            :video-src="videoState.source.value"
            :video-loading="loading"
            :is-playing="playback.playing.value"
            :current-time="playback.time.value"
            :duration="videoState.duration.value"
            :volume="playback.volume.value"
            :is-muted="playback.muted.value"
            :is-fullscreen="isFullscreen"
            @seek-to="playback.seek"
            @toggle-play-pause="playback.toggle"
            @go-to-beginning="playback.seek(0)"
            @toggle-mute="playback.toggleMute"
            @update-volume="playback.setVolume"
            @toggle-fullscreen="fullscreen"
          />
        </section>
        <aside class="workspace-dialog__media-column">
          <div class="workspace-dialog__tab-bar" role="tablist" aria-label="Project panels">
            <button v-for="tab in ['clips', 'transcript']" :key="tab" role="tab" :aria-selected="panel === tab" class="workspace-dialog__tab" :class="{ 'workspace-dialog__tab--active': panel === tab }" @click="panel = tab">{{ tab === 'clips' ? 'Clips' : 'Transcript' }}<span v-if="tab === 'transcript' && project.words.length" class="workspace-dialog__tab-badge">✓</span></button>
          </div>
          <div v-show="panel === 'clips'" class="px-4 flex flex-col flex-1 h-full min-h-0" data-media-panel><WorkspaceMediaHeader :model="mediaHeader" /><ClipsTabView class="flex-1 min-h-0" :model="clipsPanel" /></div>
          <TranscriptPanel v-if="panel === 'transcript'" :project-id="project.id" :current-time="videoState.sourceTime.value" :duration="project.duration" @seek-video="seekSource" @create-clip-from-transcript="createFromTranscript" @delete-time-range="deleteTimeRange" @split-at-time="splitAtTime" />
          <SubtitlePropertiesPanel v-if="panel === 'subtitles' && draft" :settings="subtitleSettings" :segments="subtitleSegments" :current-time="videoState.sourceTime.value" @close="panel = 'clips'" @update-settings="updateSubtitleSettings" @draft-segment-text="draftSubtitleText" @commit-segment-text="commitSubtitleText" />
          <ClipTextBoxPropertiesPanel v-if="panel === 'text' && draft" :state="draft.textBox || null" :clip-duration="draft.segments.reduce((sum, part) => sum + part.end_time - part.start_time, 0)" @close="panel = 'clips'" @update-state="updateTextBox" @delete="deleteTextBox" />
        </aside>
      </div>
      <div v-if="project.status === 'ready'" class="workspace-dialog__timeline" style="--workspace-video-track-height: 80px; --workspace-waveform-height: 56px; --workspace-clip-track-height: 60px"><Timeline ref="timeline" :min-height="270" :allow-editor="false" :video-src="sourcePath(project.id)" :project-id="project.id" :duration="project.duration" :current-time="videoState.sourceTime.value" :timeline-hover-time="timelineHoverTime" :timeline-hover-position="timelineHoverPosition" :clips="timelineClips" :hovered-clip-id="selectedId" :hovered-timeline-clip-id="hoveredTimelineClipId" :currently-playing-clip-id="playback.playing.value ? selectedId : null" @seek-timeline="seekTimeline" @timeline-track-hover="hoverTimeline" @timeline-mouse-leave="timelineHoverTime = null" @timeline-clip-hover="hoveredTimelineClipId = $event" @timeline-segment-click="selectById" @scroll-to-media-panel="selectById" @play-from-time="playFromTime" @refresh-clips-data="refreshWorkspace" @edit-clip="selectById" @toggle-subtitles="toggleSubtitles" @toggle-text="toggleText" /></div>
    </div>
    <ClipDetectionConfirmDialog v-model="dialogs.showDetect.value" :video-duration="project.duration" :is-transcribed="!!project.words.length" :initial-subtitle-detection-defaults="previewState.detectionDefaults.value" @confirm="dialogs.confirmDetect" />
    <TranscriptionConfirmDialog v-model="dialogs.showTranscribe.value" :video-duration="project.duration" :segment-count="dialogs.transcriptionClip.value ? 1 : undefined" :total-duration="dialogs.transcriptionClip.value?.segments.reduce((sum, part) => sum + part.end_time - part.start_time, 0)" :item-label="dialogs.transcriptionClip.value ? 'clip' : 'video'" :is-transcribed="dialogs.transcriptionClip.value ? !!dialogs.transcriptionClip.value.subtitleWords?.length : !!project.words.length" @confirm="dialogs.confirmTranscribe" />
    <SubtitleEditorDialog v-model="dialogs.showSubtitles.value" :clips="timelineClips" :project-id="project.id" :default-subtitle-settings="previewState.subtitleDefaults.value" @save="dialogs.applySubtitles" />
    <ConfirmationModal :show="dialogs.showDelete.value" title="Delete Clip" message="Are you sure you want to delete this clip?" suffix="This action cannot be undone." confirm-text="Delete" variant="destructive" @close="dialogs.showDelete.value = false" @confirm="dialogs.confirmDelete" />
    <ClipGenerationProgress :visible="showDetailedProgress" :progress="activeJob?.progress || 0" :stage="error ? 'error' : 'analyzing'" :message="activeJob?.message || ''" :error="error" :is-connected="true" :can-close="!activeJob" @close="showDetailedProgress = false" />
    <ClipBuildSettingsView :model="exportDialog.model"><template #ManualPOIEditor><ManualPOIEditor v-if="draft && exportDialog.model.modelValue" v-model="exportDialog.showManualPOIEditor.value" :project-id="project.id" :clip-id="draft.id" :video-path="exportDialog.videoPath.value" :target-aspect-ratio="exportDialog.editingAspectRatio.value" :initial-config="exportDialog.config.value" :layout-overlays="previewState.layoutOverlays.value" :overlay-preview-urls="previewState.overlayUrlsForRatio(exportDialog.editingAspectRatio.value)" :watermark-settings="previewState.watermarkSettings.value" :watermark-preview-url="previewState.watermarkData.value?.dataUrl" :subtitle-transcription-stage="dialogs.transcribingClip.value ? 'transcribing' : undefined" :subtitle-transcription-progress="activeJob?.kind === 'transcribe' ? activeJob.progress : 0" :clip-start-time="0" :clip-end-time="clipDuration" :subtitle-settings="settingsForRatio(exportDialog.editingAspectRatio.value)" :transcript-words="poiWords" :clip-text-overlay-json="draft.textBox ? JSON.stringify(draft.textBox) : null" @subtitle-position-change="position => draft && saveSubtitlePosition(exportDialog.editingAspectRatio.value, position)" @confirm="exportDialog.confirmFraming" @subtitle-settings-change="patch => saveSubtitleStyle(exportDialog.editingAspectRatio.value, patch)" @request-subtitle-transcription="draft && dialogs.requestClipTranscription(draft.id)" /></template></ClipBuildSettingsView>
    <QuickPublishView :model="quickPublish.model"><template #ManualPOIEditor><ManualPOIEditor v-if="draft && quickPublish.model.show" v-model="exportDialog.showManualPOIEditor.value" :project-id="project.id" :clip-id="draft.id" :video-path="exportDialog.videoPath.value" :target-aspect-ratio="exportDialog.editingAspectRatio.value" :initial-config="exportDialog.config.value" :layout-overlays="previewState.layoutOverlays.value" :overlay-preview-urls="previewState.overlayUrlsForRatio(exportDialog.editingAspectRatio.value)" :watermark-settings="previewState.watermarkSettings.value" :watermark-preview-url="previewState.watermarkData.value?.dataUrl" :subtitle-transcription-stage="dialogs.transcribingClip.value ? 'transcribing' : undefined" :subtitle-transcription-progress="activeJob?.kind === 'transcribe' ? activeJob.progress : 0" :clip-start-time="0" :clip-end-time="clipDuration" :subtitle-settings="settingsForRatio(exportDialog.editingAspectRatio.value)" :transcript-words="poiWords" :clip-text-overlay-json="draft.textBox ? JSON.stringify(draft.textBox) : null" @subtitle-position-change="position => draft && saveSubtitlePosition(exportDialog.editingAspectRatio.value, position)" @confirm="exportDialog.confirmFraming" @subtitle-settings-change="patch => saveSubtitleStyle(exportDialog.editingAspectRatio.value, patch)" @request-subtitle-transcription="draft && dialogs.requestClipTranscription(draft.id)" /></template></QuickPublishView>
  </section>
</template>
<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
  import { useWorkspacePreview } from '../useWorkspacePreview'
  import WorkspacePreviewControls from '@/components/WorkspacePreviewControls.vue'
  import SocialOverlay from '@/editor/components/preview/SocialOverlay.vue'
  import { Play, Plus, Sparkles } from 'lucide-vue-next'
  import { createDefaultSubtitleSettings, clipWords } from '@clippster/shared-types'
  import { resolveCaptionSettings } from '@/utils/captionPresetSettings'
  import type { WebProject, WebClip, WebJob } from '@clippster/shared-types'
  import ProjectWorkspaceHeader from '@/components/ProjectWorkspaceHeader.vue'
  import VideoPlayer from '@/components/VideoPlayer.vue'
  import VideoControls from '@/components/VideoControls.vue'
  import ImportSource from './ImportSource.vue'
  import ClipsTabView from '@/components/ClipsTabView.vue'
  import WorkspaceMediaHeader from '@/components/WorkspaceMediaHeader.vue'
  import { reactive } from 'vue'
  import { useToast } from '../toasts'
  import TranscriptPanel from '@/components/TranscriptPanel.vue'
  import SubtitlePropertiesPanel from '@/components/SubtitlePropertiesPanel.vue'
  import ClipTextBoxPropertiesPanel from '@/components/ClipTextBoxPropertiesPanel.vue'
  import ClipDetectionConfirmDialog from '@/components/ClipDetectionConfirmDialog.vue'
  import TranscriptionConfirmDialog from '@/components/TranscriptionConfirmDialog.vue'
  import SubtitleEditorDialog from '@/components/SubtitleEditorDialog.vue'
  import ConfirmationModal from '@/components/ConfirmationModal.vue'
  import { useWorkspaceClipsPanel } from '../useWorkspaceClipsPanel'
  import { useWorkspaceDialogs, type DetectionOptions } from '../useWorkspaceDialogs'
  import { useWorkspaceExport } from '../useWorkspaceExport'
  import { useWorkspaceQuickPublish } from '../useWorkspaceQuickPublish'
  import { useAIPermission } from '@/composables/useAIPermission'
  import QuickPublishView from '@/components/QuickPublishView.vue'
  import ClipBuildSettingsView from '@/components/ClipBuildSettingsView.vue'
  import { createDefaultClipTextBoxState } from '@/utils/clipTextBox'
  import type { SubtitleSettings, ClipTextBoxState } from '@clippster/shared-types'
  import { splitClipSegment, deleteClip } from '../workspaceRuntime'
  import { createManualClip } from '../workspaceRuntime'
  import ManualPOIEditor from '@/components/poi/ManualPOIEditor.vue'
  import { framingAssetPath } from '../api'
  import { usePlayback } from '../usePlayback'
  import { useWorkspaceVideo } from '../useWorkspaceVideo'
  import { isShortVideoAutoClipEligible } from '@clippster/shared-types'
  import ClipGenerationProgress from '@/components/ClipGenerationProgress.vue'
  import { sourcePath, clipPreviewPath, projects } from '../api'
  import Timeline from '@/components/Timeline.vue'
  import { registerWorkspace } from '../workspaceRuntime'
  import type { WebWorkspace } from '@clippster/shared-types'
  const props = defineProps<{
    initialClipId?: string | null
    project: WebProject
    busy: boolean
    error: string
    activeJob?: WebJob
    uploadProgress: number | null
    billingUrl?: string
  }>()
  const emit = defineEmits<{
    workspaceUpdated: [workspace: WebWorkspace]
    close: []
    import: [url: string]
    upload: [file: File]
    detect: [options: DetectionOptions]
    transcribe: [organizationId?: number | null]
    cancel: [id: string]
  }>()

  const previewContainer = ref<HTMLElement>()
  const timeline = ref<InstanceType<typeof Timeline>>()
  const { isAIAllowed } = useAIPermission()
  const isFullscreen = ref(false)
  const fullscreenChanged = () => { isFullscreen.value = document.fullscreenElement === previewContainer.value }
  onMounted(() => document.addEventListener('fullscreenchange', fullscreenChanged))
  onUnmounted(() => document.removeEventListener('fullscreenchange', fullscreenChanged))
  const playback = usePlayback()
  const previewState = useWorkspacePreview(() => props.project)
  const videoState = useWorkspaceVideo(() => props.project, playback, ratio => { previewState.ratio.value = ratio })
  const timelineHoverTime = ref<number | null>(null), timelineHoverPosition = ref(0), hoveredTimelineClipId = ref<string | null>(null)
  const timelineClips = computed(() => props.project.clips.map(clip => ({ id: clip.id, title: clip.name, filename: clip.name, type: (clip.segments.length > 1 ? 'spliced' : 'continuous') as 'spliced' | 'continuous', segments: clip.segments.map(segment => ({ ...segment, duration: segment.end_time - segment.start_time, transcript: props.project.words.filter(word => word.start >= segment.start_time && word.end <= segment.end_time).map(word => word.word).join(' ') })), total_duration: clip.segments.reduce((sum, segment) => sum + segment.end_time - segment.start_time, 0), combined_transcript: '', virality_score: clip.detection?.viralityScore || 0, reason: clip.detection?.reason || '', socialMediaPost: '' })))
  const unregister = registerWorkspace({ project: () => props.project, update: workspace => emit('workspaceUpdated', workspace) })
  onUnmounted(unregister)
  async function refreshWorkspace() { emit('workspaceUpdated', await projects.get(props.project.id)) }
  function selectById(id: string) { const clip = props.project.clips.find(clip => clip.id === id); if (clip) { select(clip); timeline.value?.revealClip(id); timeline.value?.scrollTimelineClipIntoView(id) } }
  function seekTimeline(event: MouseEvent) { const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect(); seekSource(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * props.project.duration) }
  function hoverTimeline(event: MouseEvent) { const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect(); timelineHoverPosition.value = event.clientX - bounds.left; timelineHoverTime.value = Math.max(0, Math.min(1, timelineHoverPosition.value / bounds.width)) * props.project.duration }
  function playFromTime(time: number) { videoState.restore(time, true); playback.playSource(time) }
  function seekSource(time: number) { videoState.restore(time); playback.seek(time) }
  const loading = ref(false)
  const videoError = ref<string | null>(null)
  const selectedId = ref<string | null>(null)
  const panel = ref('clips')
  const showDetailedProgress = ref(false), lastOperation = ref('')
  watch(() => props.activeJob?.kind, kind => { if (kind) lastOperation.value = kind }, { immediate: true })
  watch(() => props.error, error => { if (error && lastOperation.value === 'detect') showDetailedProgress.value = true })
  const subtitleDrafts = ref<Record<number, string>>({})
  watch(selectedId, () => { subtitleDrafts.value = {} })
  const draft = ref<WebClip | null>(null)
  const clipDetectionDisabled = computed(() => isShortVideoAutoClipEligible(props.project.duration))
  const exportDialog = useWorkspaceExport(() => props.project, () => draft.value, workspace => emit('workspaceUpdated', workspace), cause => { useToast().error('Export configuration failed', cause instanceof Error ? cause.message : 'Try again.') })
  const dialogs = useWorkspaceDialogs(() => props.project, workspace => emit('workspaceUpdated', workspace), options => { lastOperation.value = 'detect'; emit('detect', options) }, organizationId => emit('transcribe', organizationId))
  const quickPublish = useWorkspaceQuickPublish(() => props.project, () => draft.value, exportDialog, workspace => emit('workspaceUpdated', workspace), dialogs.saveClipPatch, cause => useToast().error('Quick Publish failed', cause instanceof Error ? cause.message : 'Please try again.'))
  const clipsPanel = useWorkspaceClipsPanel(() => props.project, () => props.activeJob, {
    select: selectById, play: id => { selectById(id); preview() }, detect: () => { dialogs.showDetect.value = true }, add: addClip,
    remove: dialogs.remove, build: id => { selectById(id); build() }, publish: id => { selectById(id); void quickPublish.open() }, cancel: id => emit('cancel', id)
  }, () => isAIAllowed.value, () => clipDetectionDisabled.value)
  clipsPanel.hideHeader = true
  const initializedShortSources = new Set<string>()
  watch(() => [props.project.id, props.project.status, props.project.clips.length, props.activeJob?.id], async () => {
    if (props.project.status !== 'ready' || props.activeJob || props.project.clips.length || !clipDetectionDisabled.value || initializedShortSources.has(props.project.id)) return
    initializedShortSources.add(props.project.id)
    try { await createManualClip(props.project.id, { name: 'Clip', startTime: 0, endTime: props.project.duration, description: 'Auto-created from short video (full length)' }) }
    catch (cause) { useToast().error('Could not prepare short video clip', cause instanceof Error ? cause.message : 'Please try again.') }
  }, { immediate: true })
  watch(() => playback.playing.value ? selectedId.value : null, id => { clipsPanel.props.playingClipId = id }, { immediate: true })
  watch(hoveredTimelineClipId, id => { clipsPanel.hoveredTimelineClipId = id })
  function addClip() { timeline.value?.toggleAddClipMode() }
  async function createFromTranscript(start: number, end: number, text: string) {
    const name = text.length > 50 ? text.slice(0, 50).trim() + '...' : text.trim()
    try { await createManualClip(props.project.id, { name: name || 'Transcript Clip', startTime: start, endTime: end, description: `Created from transcript selection: "${text.slice(0, 200)}"` }); panel.value = 'clips'; useToast().success('Clip Created', `Clip "${name}" created from transcript selection.`) } catch (cause) { useToast().error('Could not create clip', cause instanceof Error ? cause.message : 'Please try again.') }
  }
  const mediaHeader = reactive({ clips: computed(() => clipsPanel.clips), isAIAllowed, transcriptData: computed(() => props.project.words.length > 0), props: { isGenerating: computed(() => props.activeJob?.kind === 'detect'), generationProgress: computed(() => props.activeJob?.progress || 0), generationStage: 'analyzing', isTranscribing: computed(() => props.activeJob?.kind === 'transcribe'), transcribeProgress: computed(() => props.activeJob?.progress || 0), transcribeStage: 'transcribing', clipDetectionDisabled }, handleCancelDetection: () => props.activeJob && emit('cancel', props.activeJob.id), handleCancelTranscription: () => props.activeJob && emit('cancel', props.activeJob.id), handleDetectClips: () => { dialogs.showDetect.value = true }, handleViewTranscript: () => { panel.value = 'transcript' }, handleTranscribe: () => { dialogs.showTranscribe.value = true }, handleAddClip: addClip })
  watch(() => JSON.stringify(props.project.words), () => document.dispatchEvent(new CustomEvent('transcript-updated', { detail: { projectId: props.project.id } })))
  const subtitleSegments = computed(() => (draft.value?.subtitleWords || props.project.words).filter(word => !draft.value || draft.value.segments.some(segment => word.end > segment.start_time && word.start < segment.end_time)).map((word, index) => ({ id: index, index, start: word.start, end: word.end, text: subtitleDrafts.value[index] ?? word.word, wordIndex: index, wordEndIndex: index })))
  const playerWords = computed(() => subtitleSegments.value.map(segment => ({ word: segment.text, start: segment.start, end: segment.end })))
  function draftSubtitleText(index: number, text: string) { subtitleDrafts.value[index] = text }
  async function updateSubtitleSettings(patch: Partial<SubtitleSettings>) { await saveSubtitleStyle(previewState.ratio.value, patch) }
  async function saveSubtitleStyle(ratio: string, patch: Partial<SubtitleSettings>) {
    if (!draft.value) return
    await dialogs.saveClipPatch(draft.value.id, clip => { const settings = clip.subtitleSettings || createDefaultSubtitleSettings(), existing = settings.perRatioConfigs?.[ratio]; return { captions: patch.enabled ?? clip.captions, subtitleSettings: { ...settings, ...patch, perRatioConfigs: { ...settings.perRatioConfigs, [ratio]: { fontSize: settings.fontSize, positionPercentage: settings.positionPercentage, ...existing, ...patch, position: existing?.position, presetId: patch.selectedPresetId || existing?.presetId } } } } })
  }
  async function saveSubtitlePosition(ratio: string, position: { x: number; y: number; width?: number }, width?: number) {
    if (!draft.value) return
    await dialogs.saveClipPatch(draft.value.id, clip => { const settings = clip.subtitleSettings || createDefaultSubtitleSettings(); return { subtitleSettings: { ...settings, perRatioConfigs: { ...settings.perRatioConfigs, [ratio]: { ...settings.perRatioConfigs?.[ratio], fontSize: settings.perRatioConfigs?.[ratio]?.fontSize || settings.fontSize, positionPercentage: position.y, position: { x: position.x, y: position.y }, maxWidth: width || position.width || settings.maxWidth } } } } })
  }
  async function commitSubtitleText(index: number, text: string) { if (!draft.value) return; const words = subtitleSegments.value.map(segment => ({ word: segment.text, start: segment.start, end: segment.end })); if (!words[index]) return; words[index].word = text; await dialogs.saveClipPatch(draft.value.id, { subtitleWords: words }); delete subtitleDrafts.value[index] }
  async function updateTextBox(patch: Partial<ClipTextBoxState>) { if (!draft.value) return; const existing = draft.value.textBox || createDefaultClipTextBoxState(draft.value.segments.reduce((sum, part) => sum + part.end_time - part.start_time, 0)); await dialogs.saveClipPatch(draft.value.id, { textBox: { ...existing, ...patch, style: { ...existing.style, ...patch.style } } }) }
  async function deleteTextBox() { if (draft.value) await dialogs.saveClipPatch(draft.value.id, { textBox: null }) }
  function toggleSubtitles() { if (!props.project.words.length) dialogs.showTranscribe.value = true; else dialogs.showSubtitles.value = true }
  async function toggleText() { if (!draft.value) return; if (!draft.value.textBox) await updateTextBox({}); panel.value = 'text' }
  async function splitAtTime(time: number) { if (!draft.value) return; const index = draft.value.segments.findIndex(segment => time > segment.start_time && time < segment.end_time); if (index >= 0) await splitClipSegment(draft.value.id, index, time) }
  async function deleteTimeRange(start: number, end: number) { if (!draft.value) return; const segments = draft.value.segments.flatMap(segment => segment.end_time <= start || segment.start_time >= end ? [segment] : [{ ...segment, end_time: Math.min(start, segment.end_time) }, { ...segment, start_time: Math.max(end, segment.start_time) }].filter(part => part.end_time > part.start_time)); if (!segments.length) await deleteClip(draft.value.id); else await dialogs.saveClipPatch(draft.value.id, { segments }) }

  const clipDuration = computed(() => draft.value?.segments.reduce((sum, part) => sum + part.end_time - part.start_time, 0) || 0)
  const poiWords = computed(() => draft.value ? clipWords(draft.value.subtitleWords || props.project.words, draft.value.segments) : [])
  const clipTime = computed(() => {
    let offset = 0
    for (const segment of draft.value?.segments || []) {
      if (playback.time.value >= segment.start_time && playback.time.value <= segment.end_time) {
        return offset + playback.time.value - segment.start_time
      }
      offset += segment.end_time - segment.start_time
    }
    return offset
  })
  const settingsForRatio = (ratio: string) => resolveCaptionSettings(draft.value?.subtitleSettings || previewState.subtitleDefaults.value, ratio, draft.value ? !!draft.value.captions : !!previewState.subtitleDefaults.value?.enabled)
  const subtitleSettings = computed(() => videoState.builtClip.value ? { ...settingsForRatio(previewState.ratio.value), enabled: false } : settingsForRatio(previewState.ratio.value))
  function select(clip: WebClip) {
    videoState.restore(clip.segments[0]?.start_time || 0)
    selectedId.value = clip.id
    draft.value = JSON.parse(JSON.stringify(clip))
    playback.select(clip.segments)
  }
  watch(
    () => props.project.clips,
    (clips, previous) => {
      if (previous && clips.length > previous.length) {
        select(clips.at(-1)!)
        return
      }
      const clip = clips.find((item) => item.id === selectedId.value)
      if (!clip) {
        if (clips.length) select(clips.at(-1)!)
        else {
          draft.value = null
          selectedId.value = null
        }
      } else {
        draft.value = JSON.parse(JSON.stringify(clip))
      }
    },
    { immediate: true }
  )
  function build() { if (draft.value) void exportDialog.open() }
  function preview() {
    if (draft.value) videoState.preview(draft.value)
  }
  function close() {
    if (props.uploadProgress !== null) return
    playback.pause()
    emit('close')
  }
  function fullscreen() {
    if (isFullscreen.value) void document.exitFullscreen()
    else void previewContainer.value?.requestFullscreen().catch(() => {})
  }
  function onVideoError() {
    loading.value = false
    videoError.value = 'Unable to play the source. Try reloading it.'
  }
  function retry() {
    videoError.value = null
    playback.element.value?.load()
  }
  function keydown(event: KeyboardEvent) {
    if ((event.target as HTMLElement)?.matches('input, textarea, select, button')) return
    if (event.code === 'Space') {
      event.preventDefault()
      playback.toggle()
    }
    if (event.code === 'KeyF') { event.preventDefault(); fullscreen() }
  }
  function unload(event: BeforeUnloadEvent) {
    if (props.uploadProgress !== null) {
      event.preventDefault()
    }
  }
  onMounted(() => {
    if (props.initialClipId) selectById(props.initialClipId)
    window.addEventListener('keydown', keydown)
    window.addEventListener('beforeunload', unload)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('beforeunload', unload)
  })
</script>
<style scoped src="@/styles/projectWorkspace.css"></style>
