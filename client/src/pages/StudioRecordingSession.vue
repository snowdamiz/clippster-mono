<template>
  <div ref="sessionRef" class="studio-session">
    <header class="studio-session__topbar">
      <button type="button" class="studio-session__back" @click.stop="handleBack">
        <ArrowLeft :size="18" />
        <span>Recordings</span>
      </button>

      <div class="studio-session__title">
        <Disc :size="16" />
        <span>Recording Studio</span>
      </div>

      <div class="studio-session__header-actions">
        <button
          type="button"
          class="studio-session__fullscreen-btn"
          :title="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
          @click="toggleFullscreen"
        >
          <Minimize2 v-if="isFullscreen" :size="15" />
          <Maximize2 v-else :size="15" />
        </button>
      </div>
    </header>

    <main class="studio-session__body">
      <section class="studio-session__preview-shell">
        <aside class="studio-session__preview-sources">
          <div class="studio-session__side-panel">
            <StudioSourcesPanel
              v-model:mode="recorder.mode.value"
              v-model:aspect-ratio="recorder.aspectRatio.value"
              v-model:camera-device-id="recorder.cameraDeviceId.value"
              v-model:microphone-device-id="recorder.microphoneDeviceId.value"
              v-model:display-id="recorder.displayId.value"
              :camera-options="cameraOptions"
              :mic-options="micOptions"
              :display-options="displayOptions"
              :loading-devices="recorder.loadingDevices.value"
              :is-screen-sharing="!!screenShareStream"
              :screen-share-label="screenShareLabel"
              @refresh-devices="recorder.loadDevices"
              @choose-screen="chooseScreenShare"
              @stop-screen="() => stopScreenShare()"
            />
          </div>

          <div class="studio-session__side-panel studio-session__side-panel--mixer">
            <StudioAudioMixerPanel
              v-model:mic-volume="recorder.micVolume.value"
              v-model:share-audio-volume="recorder.shareAudioVolume.value"
              :has-share-audio="hasShareAudio"
            />
          </div>
        </aside>

        <div class="studio-session__preview-canvas">
          <StudioPreview
            ref="previewRef"
            :mode="recorder.mode.value"
            :aspect-ratio="recorder.aspectRatio.value"
            :layout="studioLayout.layout.value"
            :selected-layer-id="studioLayout.selectedLayerId.value"
            :camera-preview-device-id="selectedCameraPreviewDeviceId"
            :screen-preview-stream="screenShareStream"
            :background-source-type="recorder.backgroundSourceType.value"
            :media-source="recorder.mediaSource.value"
            @update:layout="onLayoutUpdate"
            @update:selected-layer-id="(v) => (studioLayout.selectedLayerId.value = v)"
            @media-ended="onMediaEnded"
          />
        </div>

        <aside class="studio-session__preview-right">
          <div class="studio-session__side-panel">
            <StudioBrandingPanel
              v-model:selected-profile-id="selectedProfileId"
              :profiles="personalProfiles"
              @profile-selected="onProfileSelected"
            />
          </div>

          <div class="studio-session__side-panel">
            <StudioTemplatesPanel
              :templates="templates.templates.value"
              :active-template-id="activeTemplateId"
              @apply="applyTemplate"
              @delete="deleteTemplate"
              @upload-template="uploadTemplateOverlay"
            />
          </div>

          <footer class="studio-session__controls">
            <div class="studio-session__control-status">
              <div class="studio-session__control-timer">
                <span v-if="isRecordingActive" class="studio-session__recording-dot" />
                {{ formatDuration(elapsedSeconds) }}
              </div>
              <p v-if="recorder.error.value" class="studio-session__error">{{ recorder.error.value }}</p>
              <p v-else-if="recorder.finalizing.value" class="studio-session__status">Finalizing recording...</p>
              <p v-else class="studio-session__status">Ready to record</p>
              <span class="studio-session__shortcut-value">
                {{ shortcuts.shortcuts.value.start }} / {{ shortcuts.shortcuts.value.stop }}
              </span>
            </div>

            <label
              v-if="recorder.mode.value !== 'camera'"
              class="studio-session__hide-cursor"
            >
              <input
                v-model="recorder.hideCursor.value"
                type="checkbox"
                class="studio-session__hide-cursor-input"
                :disabled="isRecordingActive"
              />
              <span>Hide cursor in recording</span>
            </label>
            <p
              v-if="recorder.hideCursor.value && recorder.mode.value !== 'camera' && screenShareSurface === 'window'"
              class="studio-session__cursor-hint"
            >
              Window shares may still show the cursor. Choose Entire Screen to hide it.
            </p>

            <button
              v-if="!isRecordingActive"
              type="button"
              class="studio-session__record-btn"
              :disabled="recorder.finalizing.value"
              @click="handleStart"
            >
              <Circle :size="18" />
              Start Recording
            </button>
            <button v-else type="button" class="studio-session__stop-btn" @click="handleStop">
              <Square :size="18" />
              Stop Recording
            </button>
          </footer>
        </aside>
      </section>
    </main>

    <RecordingSaveDialog
      :show="showSaveDialog"
      :duration="pendingResult?.duration ?? 0"
      :width="pendingResult?.width ?? 0"
      :height="pendingResult?.height ?? 0"
      :aspect-ratio="recorder.aspectRatio.value"
      :saving="savingRecording"
      :error="saveError"
      :default-title="saveTitle"
      @close="closeSaveDialog"
      @save="handleSave"
      @update:title="(v) => (saveTitle = v)"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
  import { ArrowLeft, Circle, Disc, Maximize2, Minimize2, Square } from 'lucide-vue-next';
  import { convertFileSrc, invoke } from '@tauri-apps/api/core';
  import StudioPreview from '@/components/studio/StudioPreview.vue';
  import StudioSourcesPanel from '@/components/studio/StudioSourcesPanel.vue';
  import StudioAudioMixerPanel from '@/components/studio/StudioAudioMixerPanel.vue';
  import StudioBrandingPanel from '@/components/studio/StudioBrandingPanel.vue';
  import StudioTemplatesPanel from '@/components/studio/StudioTemplatesPanel.vue';
  import RecordingSaveDialog from '@/components/studio/RecordingSaveDialog.vue';
  import { useStudioRecorder } from '@/composables/studio/useStudioRecorder';
  import { useStudioCanvasRecorder } from '@/composables/studio/useStudioCanvasRecorder';
  import {
    applyDisplayCursorPreference,
    buildDisplayMediaConstraints,
    getDisplaySurface,
  } from '@/composables/studio/useStudioDisplayCapture';
  import { useStudioTemplates } from '@/composables/studio/useStudioTemplates';
  import { useStudioShortcuts } from '@/composables/studio/useStudioShortcuts';
  import {
    addLayer,
    createDefaultLayout,
    createImageLayer,
    createWatermarkLayer,
    ensureLayoutForMode,
    getCameraRect,
    getScreenRect,
    getWatermarkLayer,
    useStudioLayout,
  } from '@/composables/studio/useStudioLayout';
  import {
    createProject,
    createRawVideo,
    getAllPersonalStudioProfiles,
    getCreatorProfile,
    getWatermarkImage,
  } from '@/services/database';
  import { ensureShortVideoAutoClip } from '@/services/database/auto-clips';
  import { resolveIntroOutroById } from '@/services/database/intro-outros';
  import { createVideoEditorProjectFromRawVideo } from '@/services/video-editor-project-creator';
  import { useToast } from '@/composables/useToast';
  import type { CreatorProfileWithLinks } from '@/services/database/types';
  import { STUDIO_RECORDING_DESCRIPTION } from '@/types/studio';
  import type { StudioAspectRatio, StudioLayout, StudioRecordingResult, StudioRect, StudioTemplate } from '@/types/studio';
  import { DEFAULT_WATERMARK_RECT, STUDIO_LAYER_IDS } from '@/types/studio';
  import type { CreatorWatermarkSettings } from '@/components/WatermarkPositionPicker.vue';

  const router = useRouter();
  const { success, error: showError } = useToast();
  const recorder = useStudioRecorder();
  const canvasRecorder = useStudioCanvasRecorder();
  const templates = useStudioTemplates();
  const studioLayout = useStudioLayout(
    createDefaultLayout(recorder.aspectRatio.value, recorder.mode.value)
  );
  const previewRef = ref<InstanceType<typeof StudioPreview> | null>(null);
  const sessionRef = ref<HTMLElement | null>(null);
  const isFullscreen = ref(false);
  const screenShareStream = ref<MediaStream | null>(null);
  const screenShareLabel = ref('');

  const personalProfiles = ref<CreatorProfileWithLinks[]>([]);
  const selectedProfileId = ref<string | null>(null);
  const watermarkPreviewUrl = ref<string | null>(null);
  const activeTemplateId = ref<string | null>(null);

  const showSaveDialog = ref(false);
  const pendingResult = ref<StudioRecordingResult | null>(null);
  const pendingFilePath = ref<string | null>(null);
  const saveTitle = ref('');
  const savingRecording = ref(false);
  const saveError = ref<string | null>(null);
  const pendingIntroPath = ref<string | null>(null);
  const pendingOutroPath = ref<string | null>(null);

  const shortcuts = useStudioShortcuts(
    () => handleStart(),
    () => handleStop()
  );

  const cameraOptions = computed(() => recorder.cameras.value.map((d) => ({ label: d.label, value: d.id })));
  const micOptions = computed(() => recorder.microphones.value.map((d) => ({ label: d.label, value: d.id })));
  const displayOptions = computed(() => recorder.displays.value.map((d) => ({ label: d.label, value: d.id })));
  const selectedCameraPreviewDeviceId = computed(() => {
    return recorder.cameras.value.find((device) => device.id === recorder.cameraDeviceId.value)?.browserDeviceId ?? null;
  });
  const selectedMicPreviewDeviceId = computed(() => {
    return recorder.microphones.value.find((device) => device.id === recorder.microphoneDeviceId.value)?.browserDeviceId ?? null;
  });
  const isRecordingActive = computed(() => canvasRecorder.isRecording.value);
  const elapsedSeconds = computed(() => canvasRecorder.elapsedSeconds.value);
  const screenShareSurface = computed(() => getDisplaySurface(screenShareStream.value));
  const hasShareAudio = computed(() => {
    if ((screenShareStream.value?.getAudioTracks().length ?? 0) > 0) return true;
    const mediaVideo = previewRef.value?.getMediaVideo();
    if (!mediaVideo || typeof (mediaVideo as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream !== 'function') {
      return false;
    }
    try {
      const stream = (mediaVideo as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream();
      return stream.getAudioTracks().length > 0;
    } catch {
      return false;
    }
  });

  watch(
    () => recorder.micVolume.value,
    (volume) => canvasRecorder.setMicVolume(volume)
  );
  watch(
    () => recorder.shareAudioVolume.value,
    (volume) => canvasRecorder.setShareAudioVolume(volume)
  );
  watch(
    () => recorder.hideCursor.value,
    async (hide) => {
      if (!screenShareStream.value) return;
      const applied = await applyDisplayCursorPreference(screenShareStream.value, hide);
      if (hide && !applied) {
        showError(
          'Hide cursor',
          'Re-select your screen share and choose Entire Screen to hide the cursor.'
        );
      }
    }
  );

  watch(
    () => recorder.mode.value,
    (mode) => {
      studioLayout.setLayout(ensureLayoutForMode(studioLayout.layout.value, mode));
      syncRecorderFromLayout();
    }
  );

  watch(
    () => recorder.aspectRatio.value,
    (aspectRatio) => {
      studioLayout.setLayout({
        ...studioLayout.layout.value,
        aspectRatio,
      });
    }
  );

  function syncRecorderFromLayout() {
    recorder.sourceRect.value = { ...getScreenRect(studioLayout.layout.value) };
    recorder.cameraPip.value = { ...getCameraRect(studioLayout.layout.value) };
    const wm = getWatermarkLayer(studioLayout.layout.value);
    if (wm) {
      recorder.watermarkRect.value = { ...wm.rect };
      recorder.watermarkPath.value = wm.imagePath ?? null;
      recorder.watermarkOpacity.value = wm.opacity;
    }
  }

  function onLayoutUpdate(next: StudioLayout) {
    studioLayout.setLayout(next);
    syncRecorderFromLayout();
  }

  function syncWatermarkToLayout(filePath: string | null, rect: StudioRect | null, opacity: number) {
    if (!filePath || !rect) {
      studioLayout.setLayout({
        ...studioLayout.layout.value,
        layers: studioLayout.layout.value.layers.filter((l) => l.id !== STUDIO_LAYER_IDS.watermark),
      });
      return;
    }

    const existing = getWatermarkLayer(studioLayout.layout.value);
    if (existing) {
      studioLayout.patchLayer(STUDIO_LAYER_IDS.watermark, {
        rect: { ...rect },
        imagePath: filePath,
        opacity,
        visible: true,
      });
    } else {
      studioLayout.addOverlayLayer(createWatermarkLayer({ ...rect }, filePath));
      studioLayout.patchLayer(STUDIO_LAYER_IDS.watermark, { opacity });
    }
  }

  async function uploadTemplateOverlay() {
    try {
      const selected = await openFileDialog({
        multiple: false,
        filters: [
          {
            name: 'Image',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
          },
        ],
      });
      if (!selected || typeof selected !== 'string') return;

      const defaultName = selected.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'Overlay Template';
      const templateName = prompt('Template name', defaultName);
      if (!templateName?.trim()) return;

      const overlayLayer = {
        ...createImageLayer(selected, 'Template Overlay', { x: 0, y: 0, width: 1, height: 1 }),
        zIndex: 90,
      };
      const baseLayout = ensureLayoutForMode(
        createDefaultLayout(recorder.aspectRatio.value, recorder.mode.value),
        recorder.mode.value
      );
      const templateLayout = addLayer(baseLayout, overlayLayer);
      const templateId = `tpl-overlay-${Date.now()}`;

      templates.saveTemplate({
        id: templateId,
        name: templateName.trim(),
        mode: recorder.mode.value,
        aspectRatio: recorder.aspectRatio.value,
        layout: templateLayout,
        brandingProfileId: selectedProfileId.value,
      });

      activeTemplateId.value = templateId;
      studioLayout.applyLayoutTemplate(templateLayout, recorder.mode.value);
      syncRecorderFromLayout();
      success('Template saved', `"${templateName.trim()}" is ready to reuse in Studio`);
    } catch (err) {
      showError('Upload failed', String(err));
    }
  }

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  async function loadPersonalProfiles() {
    personalProfiles.value = await getAllPersonalStudioProfiles();
  }

  async function onProfileSelected(profileId: string | null) {
    watermarkPreviewUrl.value = null;
    recorder.watermarkPath.value = null;
    recorder.watermarkRect.value = null;
    pendingIntroPath.value = null;
    pendingOutroPath.value = null;
    syncWatermarkToLayout(null, null, 1);

    if (!profileId) return;

    const profile = await getCreatorProfile(profileId);
    if (profile) await applyProfileBranding(profile);
  }

  async function applyProfileBranding(profile: CreatorProfileWithLinks) {
    const ratio = recorder.aspectRatio.value as StudioAspectRatio;

    if (profile.watermark_id) {
      const watermark = await getWatermarkImage(profile.watermark_id);
      if (watermark?.file_path) {
        recorder.watermarkPath.value = watermark.file_path;
        try {
          watermarkPreviewUrl.value = convertFileSrc(watermark.file_path);
        } catch {
          watermarkPreviewUrl.value = null;
        }

        let position = { x: 12, y: 8, opacity: 80, scale: 20 };
        if (profile.watermark_settings) {
          try {
            const parsed = JSON.parse(profile.watermark_settings) as CreatorWatermarkSettings;
            const ratioConfig = parsed[ratio];
            if (ratioConfig?.position) position = ratioConfig.position;
          } catch {
            // Ignore malformed legacy settings.
          }
        }

        recorder.watermarkOpacity.value = (position.opacity ?? 80) / 100;
        recorder.watermarkRect.value = {
          x: position.x / 100,
          y: position.y / 100,
          width: (position.scale ?? 20) / 100,
          height: ((position.scale ?? 20) / 100) * 0.5,
        };
        syncWatermarkToLayout(
          watermark.file_path,
          recorder.watermarkRect.value,
          recorder.watermarkOpacity.value
        );
      }
    } else {
      recorder.watermarkRect.value = { ...DEFAULT_WATERMARK_RECT };
    }

    let introId: string | null = profile.intro_id;
    let outroId: string | null = profile.outro_id;

    if (profile.intro_ratio_settings) {
      try {
        const entry = JSON.parse(profile.intro_ratio_settings)[ratio];
        if (entry?.assetId) introId = entry.assetId;
      } catch {
        // Ignore malformed legacy settings.
      }
    }

    if (profile.outro_ratio_settings) {
      try {
        const entry = JSON.parse(profile.outro_ratio_settings)[ratio];
        if (entry?.assetId) outroId = entry.assetId;
      } catch {
        // Ignore malformed legacy settings.
      }
    }

    const intro = await resolveIntroOutroById(introId);
    const outro = await resolveIntroOutroById(outroId);
    pendingIntroPath.value = intro?.filePath ?? null;
    pendingOutroPath.value = outro?.filePath ?? null;
  }

  function applyTemplate(template: StudioTemplate) {
    activeTemplateId.value = template.id;
    recorder.mode.value = template.mode;
    recorder.aspectRatio.value = template.aspectRatio;
    studioLayout.applyLayoutTemplate(template.layout, template.mode);
    syncRecorderFromLayout();
    if (template.brandingProfileId) {
      selectedProfileId.value = template.brandingProfileId;
      onProfileSelected(template.brandingProfileId);
    }
  }

  function deleteTemplate(templateId: string) {
    templates.deleteTemplate(templateId);
    if (activeTemplateId.value === templateId) {
      activeTemplateId.value = null;
    }
  }

  async function handleStart() {
    if (isRecordingActive.value) return;

    if (recorder.mode.value === 'camera') {
      if (!recorder.cameraDeviceId.value) {
        showError('Camera required', 'Select a camera before recording.');
        return;
      }
    } else {
      const hasDisplay =
        recorder.backgroundSourceType.value === 'display' && screenShareStream.value;
      const hasMedia = recorder.backgroundSourceType.value === 'media' && recorder.mediaSource.value;
      if (!hasDisplay && !hasMedia) {
        showError('Source required', 'Choose screen share or a media file before recording.');
        return;
      }
    }

    const canvas = previewRef.value?.getCanvas();
    if (!canvas) {
      showError('Preview unavailable', 'Could not access the recording canvas.');
      return;
    }

    recorder.error.value = null;
    try {
      await recorder.requestMediaPermissions();
      if (screenShareStream.value && recorder.hideCursor.value) {
        const applied = await applyDisplayCursorPreference(screenShareStream.value, true);
        if (!applied) {
          showError(
            'Hide cursor',
            'Could not hide the cursor on this share. Choose Entire Screen instead of a window.'
          );
        }
      }
      await canvasRecorder.start({
        canvas,
        fps: 30,
        width: recorder.outputDimensions.value.width,
        height: recorder.outputDimensions.value.height,
        micDeviceId: selectedMicPreviewDeviceId.value,
        micVolume: recorder.micVolume.value,
        shareAudioVolume: recorder.shareAudioVolume.value,
        displayStream: screenShareStream.value,
        mediaVideo: previewRef.value?.getMediaVideo() ?? null,
        onDraw: () => previewRef.value?.drawFrame(),
      });
      recorder.isRecording.value = true;
    } catch (err) {
      recorder.error.value = String(err);
      recorder.isRecording.value = false;
      showError('Recording failed', String(err));
    }
  }

  async function handleStop() {
    if (!isRecordingActive.value) return;

    recorder.error.value = null;
    try {
      const result = await canvasRecorder.stop();
      recorder.isRecording.value = false;
      if (!result) return;

      pendingResult.value = result;
      try {
        pendingFilePath.value = await recorder.finalizeWithIntroOutro(
          result.filePath,
          pendingIntroPath.value,
          pendingOutroPath.value
        );
      } catch (err) {
        console.warn('[StudioRecordingSession] Finalize failed, using raw recording:', err);
        pendingFilePath.value = result.filePath;
      }

      saveTitle.value = `Recording ${new Date().toLocaleString()}`;
      showSaveDialog.value = true;
    } catch (err) {
      recorder.error.value = String(err);
      recorder.isRecording.value = false;
      showError('Stop failed', String(err));
    }
  }

  function onMediaEnded() {
    if (!isRecordingActive.value || recorder.mode.value === 'camera') return;
    if (recorder.cameraDeviceId.value) {
      recorder.mode.value = 'camera';
    }
  }

  async function chooseMediaFile() {
    try {
      const selected = await openFileDialog({
        multiple: false,
        filters: [{ name: 'Video', extensions: ['mp4', 'webm', 'mov', 'mkv', 'm4v'] }],
      });
      if (!selected || typeof selected !== 'string') return;

      const label = selected.split(/[/\\]/).pop() || 'Media file';
      recorder.setMediaSource(selected, label);

      if (recorder.mode.value === 'camera') {
        recorder.mode.value = recorder.cameraDeviceId.value ? 'screen_camera' : 'screen';
      }
    } catch (err) {
      showError('Media selection failed', String(err));
    }
  }

  function stopMediaSource() {
    recorder.clearMediaSource();
    if (
      isRecordingActive.value &&
      recorder.mode.value !== 'camera' &&
      !screenShareStream.value &&
      recorder.cameraDeviceId.value
    ) {
      recorder.mode.value = 'camera';
    }
  }

  function closeSaveDialog() {
    showSaveDialog.value = false;
    pendingResult.value = null;
    pendingFilePath.value = null;
    saveError.value = null;
  }

  async function handleSave(action: 'projects' | 'editor' | 'publish') {
    if (!pendingResult.value || !pendingFilePath.value) return;

    savingRecording.value = true;
    saveError.value = null;

    try {
      let defaultWatermarkSettings: string | undefined;
      if (selectedProfileId.value) {
        const profile = await getCreatorProfile(selectedProfileId.value);
        defaultWatermarkSettings = profile?.watermark_settings || undefined;
      }

      const projectId = await createProject(
        saveTitle.value.trim() || 'Recording',
        STUDIO_RECORDING_DESCRIPTION,
        undefined,
        'Manual',
        defaultWatermarkSettings,
        selectedProfileId.value ?? undefined
      );

      let thumbnailPath: string | undefined;
      try {
        thumbnailPath = await invoke<string>('generate_thumbnail', { videoPath: pendingFilePath.value });
      } catch {
        thumbnailPath = undefined;
      }

      const rawVideoId = await createRawVideo(pendingFilePath.value, {
        projectId,
        originalFilename: saveTitle.value.trim(),
        thumbnailPath,
        duration: pendingResult.value.duration,
        width: pendingResult.value.width,
        height: pendingResult.value.height,
        frameRate: pendingResult.value.frameRate,
        codec: pendingResult.value.codec ?? undefined,
        fileSize: pendingResult.value.fileSize,
      });

      await ensureShortVideoAutoClip(projectId, pendingResult.value.duration, {
        clipName: saveTitle.value.trim() || 'Recording',
      });

      window.dispatchEvent(new CustomEvent('video-added', { detail: { projectId, rawVideoId } }));
      success('Recording saved', `"${saveTitle.value}" was saved to your recording library`);
      closeSaveDialog();

      if (action === 'editor') {
        const editor = await createVideoEditorProjectFromRawVideo({
          rawVideo: {
            id: rawVideoId,
            file_path: pendingFilePath.value,
            duration: pendingResult.value.duration,
            thumbnail_path: thumbnailPath ?? null,
            original_filename: saveTitle.value.trim(),
          } as any,
          projectName: saveTitle.value.trim(),
        });
        router.push({ path: '/editor', query: { projectId: editor.projectId } });
      } else {
        router.push({ name: 'studio-record-home' });
      }
    } catch (err) {
      saveError.value = String(err);
      showError('Save failed', String(err));
    } finally {
      savingRecording.value = false;
    }
  }

  async function exitSession() {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }

    canvasRecorder.dispose();
    stopScreenShare(false);
    recorder.clearMediaSource();
  }

  async function handleBack() {
    await exitSession();

    try {
      await router.push({ name: 'studio-record-home' });
    } catch (err) {
      if (!String(err).includes('NavigationDuplicated')) {
        await router.replace({ name: 'studio-record-home' });
      }
    }
  }

  async function chooseScreenShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      showError('Screen sharing unavailable', 'This environment does not expose screen sharing.');
      return;
    }

    try {
      stopScreenShare(false);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: buildDisplayMediaConstraints(recorder.hideCursor.value),
        audio: true,
      });
      const track = stream.getVideoTracks()[0];
      await applyDisplayCursorPreference(stream, recorder.hideCursor.value);
      screenShareStream.value = stream;
      screenShareLabel.value = track?.label || 'Selected screen';
      recorder.setDisplayBackground();
      recorder.displayId.value = 'browser-screen';
      recorder.includeSystemAudio.value = stream.getAudioTracks().length > 0;

      if (recorder.mode.value === 'camera') {
        recorder.mode.value = recorder.cameraDeviceId.value ? 'screen_camera' : 'screen';
      }

      track?.addEventListener('ended', () => {
        stopScreenShare(true);
      });
    } catch (err) {
      if (!String(err).includes('NotAllowedError')) {
        showError('Screen share failed', String(err));
      }
    }
  }

  function stopScreenShare(switchToCamera = true) {
    screenShareStream.value?.getTracks().forEach((track) => track.stop());
    screenShareStream.value = null;
    screenShareLabel.value = '';
    recorder.displayId.value = null;
    recorder.includeSystemAudio.value = false;
    if (recorder.backgroundSourceType.value === 'display') {
      recorder.backgroundSourceType.value = 'none';
    }

    if (
      switchToCamera &&
      isRecordingActive.value &&
      recorder.mode.value !== 'camera' &&
      !recorder.mediaSource.value &&
      recorder.cameraDeviceId.value
    ) {
      recorder.mode.value = 'camera';
    } else if (switchToCamera && !isRecordingActive.value && recorder.mode.value !== 'camera' && recorder.cameraDeviceId.value) {
      recorder.mode.value = 'camera';
    }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        previewRef.value?.deselectAll();
        await previewRef.value?.getFullscreenElement()?.requestFullscreen();
      }
    } catch (err) {
      showError('Fullscreen failed', String(err));
    }
  }

  function handleFullscreenChange() {
    isFullscreen.value = document.fullscreenElement === previewRef.value?.getFullscreenElement();
  }

  onMounted(async () => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    studioLayout.setLayout(
      ensureLayoutForMode(
        createDefaultLayout(recorder.aspectRatio.value, recorder.mode.value),
        recorder.mode.value
      )
    );
    syncRecorderFromLayout();
    await recorder.loadDevices();
    await loadPersonalProfiles();
  });

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    canvasRecorder.dispose();
    stopScreenShare(false);
    recorder.clearMediaSource();
  });
</script>

<style scoped>
  .studio-session {
    position: fixed;
    top: 32px;
    right: 0;
    bottom: 0;
    left: 0;
    overflow: hidden;
    background: #08080a;
    color: var(--sidebar-text);
    display: flex;
    flex-direction: column;
    z-index: 1;
  }

  .studio-session__topbar {
    height: 34px;
    flex-shrink: 0;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0 1rem;
    border-bottom: 1px solid var(--sidebar-border);
    background: rgba(12, 12, 14, 0.96);
  }

  .studio-session__back,
  .studio-session__title,
  .studio-session__timer,
  .studio-session__header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .studio-session__back {
    position: relative;
    z-index: 2;
    justify-self: start;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 0.25rem 0.45rem;
    cursor: pointer;
    -webkit-app-region: no-drag;
  }

  .studio-session__back:hover {
    color: var(--sidebar-text);
    background: var(--sidebar-hover);
  }

  .studio-session__title {
    color: var(--sidebar-text);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .studio-session__timer {
    font-size: 0.95rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .studio-session__header-actions {
    justify-self: end;
  }

  .studio-session__fullscreen-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--sidebar-text-muted);
    cursor: pointer;
  }

  .studio-session__fullscreen-btn:hover {
    color: var(--sidebar-text);
    background: var(--sidebar-hover);
    border-color: var(--sidebar-border);
  }

  .studio-session__recording-dot {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: #ef4444;
    animation: pulse 1.2s ease infinite;
  }

  .studio-session__body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    overflow: hidden;
    gap: 0.375rem;
    padding: 0.375rem;
  }

  .studio-session__preview-shell {
    min-height: 0;
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr) 280px;
    gap: 0.5rem;
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0;
    overflow: hidden;
  }

  .studio-session__preview-sources {
    min-height: 0;
    min-width: 0;
    display: grid;
    grid-template-rows: minmax(0, 1.25fr) minmax(120px, 0.75fr);
    gap: 0.5rem;
    overflow: hidden;
  }

  .studio-session__preview-right {
    min-height: 0;
    min-width: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: 0.5rem;
    overflow: hidden;
  }

  .studio-session__side-panel {
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }

  .studio-session__side-panel :deep(.studio-panel) {
    height: 100%;
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0.65rem 0.75rem;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .studio-session__preview-canvas {
    min-width: 0;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .studio-session__dock {
    display: block;
    height: 118px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .studio-session__dock-panel,
  .studio-session__controls {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .studio-session__dock-panel :deep(.studio-panel) {
    height: 100%;
    border-radius: 6px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .studio-session__dock-panel :deep(.studio-panel__header) {
    gap: 0.5rem;
  }

  .studio-session__dock-panel :deep(.studio-panel__title) {
    font-size: 0.8125rem;
  }

  .studio-session__dock-panel :deep(.studio-panel__refresh) {
    padding: 0.25rem 0.45rem;
    font-size: 0.6875rem;
  }

  .studio-session__dock-panel :deep(.studio-panel__field) {
    gap: 0.3rem;
  }

  .studio-session__dock-panel :deep(.studio-panel__label) {
    font-size: 0.6875rem;
  }

  .studio-session__dock-panel :deep(.studio-panel__hint) {
    font-size: 0.625rem;
  }

  .studio-session__dock-panel :deep(.studio-panel__dropdown-trigger) {
    min-height: 30px;
    font-size: 0.75rem;
  }

  .studio-session__dock-panel :deep(.studio-mixer__header) {
    font-size: 0.6875rem;
  }

  .studio-session__dock-panel :deep(.studio-mixer__row) {
    gap: 0.3rem;
  }

  .studio-session__controls {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: space-between;
    gap: 0.65rem;
    padding: 0.65rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 0;
    overflow: hidden;
  }

  .studio-session__control-status {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .studio-session__control-timer {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--sidebar-text);
    font-size: 1rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .studio-session__hide-cursor {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--sidebar-text-muted);
    font-size: 0.6875rem;
    line-height: 1.2;
    user-select: none;
    cursor: pointer;
  }

  .studio-session__hide-cursor-input {
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: var(--sidebar-accent);
    cursor: pointer;
  }

  .studio-session__hide-cursor-input:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .studio-session__cursor-hint {
    margin: 0;
    color: var(--sidebar-text-muted);
    font-size: 0.625rem;
    line-height: 1.35;
  }

  .studio-session__record-btn,
  .studio-session__stop-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.65rem 0.85rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
  }

  .studio-session__record-btn {
    color: white;
    border: none;
    background: var(--sidebar-accent);
  }

  .studio-session__stop-btn {
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.35);
    background: rgba(239, 68, 68, 0.14);
  }

  .studio-session__record-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .studio-session__status,
  .studio-session__error {
    font-size: 0.75rem;
    line-height: 1.3;
    margin: 0;
  }

  .studio-session__status {
    color: var(--sidebar-text-muted);
  }

  .studio-session__error {
    color: #f87171;
  }

  .studio-session__shortcut-value {
    color: var(--sidebar-text-muted);
    font-size: 0.6875rem;
    font-family: monospace;
  }

  @media (max-width: 760px) {
    .studio-session__dock {
      grid-template-columns: repeat(2, 1fr);
      height: 260px;
    }

    .studio-session__dock-panel--sources {
      grid-column: 1 / -1;
    }
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
</style>
