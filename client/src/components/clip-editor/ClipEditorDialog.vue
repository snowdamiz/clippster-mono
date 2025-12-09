<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="close"
    >
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
            <div class="flex flex-col">
              <h2 class="text-sm font-semibold text-foreground tracking-tight">Edit Clip</h2>
              <p class="text-xs text-foreground/50 truncate max-w-[300px]">{{ clipTitle }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="handleSave"
              class="px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-md transition-colors flex items-center gap-2"
            >
              <Save :size="12" />
              Save
            </button>
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
              class="w-3/5 min-w-0 p-4 border-r border-border/40 flex flex-col bg-gradient-to-br from-black/20 to-transparent"
            >
              <ClipEditorPreview
                :video-src="videoSrc"
                :current-time="previewTime"
                :is-playing="isPlaying"
                :clip-start="clipStartTime"
                :clip-end="clipEndTime"
                :text-overlays="textOverlays"
                :stickers="stickers"
                :filter-settings="filterSettings"
                :segments="playbackSegments"
                @time-update="onPreviewTimeUpdate"
                @toggle-play="togglePlay"
                @video-element-ready="onVideoElementReady"
              />
            </div>

            <!-- Right: Controls Section -->
            <div class="w-2/5 min-w-0 flex flex-col flex-1 bg-gradient-to-b from-transparent to-black/10">
              <!-- Toolbar -->
              <ClipEditorToolbar :active-tab="activeTab" @tab-change="setActiveTab" />

              <!-- Tab Content -->
              <div
                class="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
              >
                <AudioMixerTab
                  v-if="activeTab === 'audio'"
                  :audio-tracks="audioTracks"
                  :original-volume="originalVolume"
                  :original-db="originalDb"
                  :track-db-values="trackDbValues"
                  @add-track="(filePath, name, duration) => addAudioTrack(filePath, name, duration)"
                  @update-track="updateAudioTrackLocal"
                  @delete-track="deleteAudioTrackLocal"
                  @update-original-volume="updateOriginalVolume"
                  @update-original-db="updateOriginalDb"
                  @update-track-db="updateTrackDb"
                />

                <FiltersTab
                  v-if="activeTab === 'filters'"
                  :filter-settings="filterSettings"
                  @update-filter="updateFilter"
                />

                <TextOverlayTab
                  v-if="activeTab === 'text'"
                  :text-overlays="textOverlays"
                  :current-time="previewTime"
                  :duration="clipDuration"
                  @add-text="addTextOverlay"
                  @update-text="updateTextOverlayLocal"
                  @delete-text="deleteTextOverlayLocal"
                />

                <StickersTab
                  v-if="activeTab === 'stickers'"
                  :stickers="stickers"
                  :current-time="previewTime"
                  :duration="clipDuration"
                  @add-sticker="addStickerLocal"
                  @update-sticker="updateStickerLocal"
                  @delete-sticker="deleteStickerLocal"
                />

                <EffectsTab
                  v-if="activeTab === 'effects'"
                  :effects="effects"
                  :current-time="previewTime"
                  :duration="clipDuration"
                  @add-effect="addEffectLocal"
                  @update-effect="updateEffectLocal"
                  @delete-effect="deleteEffectLocal"
                />
              </div>
            </div>
          </div>

          <!-- Bottom Row: Timeline -->
          <ClipEditorTimeline
            :duration="clipDuration"
            :current-time="relativePreviewTime"
            :clip-start="clipStartTime"
            :clip-end="clipEndTime"
            :trim-segments="trimSegments"
            :audio-tracks="audioTracks"
            :text-overlays="textOverlays"
            :stickers="stickers"
            :effects="effects"
            :video-src="videoSrc"
            @seek="seekTo"
            @update-trim-segment="updateTrimSegment"
            @update-audio-track="updateAudioTrackLocal"
            @update-text-overlay="updateTextOverlayLocal"
            @update-sticker="updateStickerLocal"
            @update-effect="updateEffectLocal"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { Film, X, Save } from 'lucide-vue-next';
  import type { ClipEditorTab, AudioTrack, TextOverlay, Sticker, Effect, FilterSettings, TrimSegment } from '@/types';
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
  } from '@/services/database';
  import ClipEditorPreview from './ClipEditorPreview.vue';
  import ClipEditorToolbar from './ClipEditorToolbar.vue';
  import ClipEditorTimeline from './ClipEditorTimeline.vue';
  import AudioMixerTab from './tabs/AudioMixerTab.vue';
  import FiltersTab from './tabs/FiltersTab.vue';
  import TextOverlayTab from './tabs/TextOverlayTab.vue';
  import StickersTab from './tabs/StickersTab.vue';
  import EffectsTab from './tabs/EffectsTab.vue';

  interface ClipSegmentInput {
    start_time: number;
    end_time: number;
  }

  const props = defineProps<{
    modelValue: boolean;
    clipId: string;
    videoSrc: string | null;
    clipStartTime: number;
    clipEndTime: number;
    clipTitle: string;
    clipSegments?: ClipSegmentInput[];
  }>();

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'save', clipId: string): void;
  }>();

  // Refs
  const dialogRef = ref<HTMLElement | null>(null);
  const videoElement = ref<HTMLVideoElement | null>(null);
  const clipEditId = ref<string | null>(null);

  // Editor state
  const activeTab = ref<ClipEditorTab>('audio');
  const isPlaying = ref(false);
  const previewTime = ref(0);

  // Edit data
  const trimSegments = ref<TrimSegment[]>([]);
  const audioTracks = ref<AudioTrack[]>([]);
  const textOverlays = ref<TextOverlay[]>([]);
  const stickers = ref<Sticker[]>([]);
  const effects = ref<Effect[]>([]);
  const filterSettings = ref<FilterSettings | null>(null);
  const originalVolume = ref(1);
  const originalDb = ref(0);
  const trackDbValues = ref<Record<string, number>>({});

  // Audio playback elements
  const audioElements = ref<Map<string, HTMLAudioElement>>(new Map());
  const audioContext = ref<AudioContext | null>(null);
  const gainNodes = ref<Map<string, GainNode>>(new Map());

  // Computed
  const clipDuration = computed(() => props.clipEndTime - props.clipStartTime);

  // Calculate total duration of all segments combined
  const totalSegmentDuration = computed(() => {
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

  function onVideoElementReady(element: HTMLVideoElement) {
    videoElement.value = element;
  }

  function onPreviewTimeUpdate(time: number) {
    previewTime.value = time;
    // Sync audio tracks with video
    if (isPlaying.value) {
      syncAudioWithVideo();
    }
  }

  function togglePlay() {
    if (videoElement.value) {
      if (isPlaying.value) {
        videoElement.value.pause();
        // Pause all audio tracks
        audioElements.value.forEach((audio) => audio.pause());
      } else {
        videoElement.value.play();
        // Resume audio context if suspended
        if (audioContext.value?.state === 'suspended') {
          audioContext.value.resume();
        }
        // Start audio tracks playback
        syncAudioWithVideo();
      }
      isPlaying.value = !isPlaying.value;
    }
  }

  function seekTo(time: number) {
    // time is relative (0 to clipDuration), convert to absolute for video element
    if (videoElement.value) {
      const absoluteTime = props.clipStartTime + time;
      videoElement.value.currentTime = absoluteTime;
      previewTime.value = absoluteTime; // Store absolute time
    }
  }

  function updateTrimSegment(segmentId: string, startTime: number, endTime: number) {
    const segment = trimSegments.value.find((s) => s.id === segmentId);
    if (segment) {
      segment.startTime = startTime;
      segment.endTime = endTime;
    }
  }

  // Audio operations
  async function addAudioTrack(filePath: string, name: string, duration: number) {
    if (!clipEditId.value) return;

    // Use the actual audio file duration for the track end time
    const trackEndTime = duration;

    const track = await createAudioTrack(clipEditId.value, {
      file_path: filePath,
      name,
      start_time: 0,
      end_time: trackEndTime,
      volume: 1,
      fade_in: 0,
      fade_out: 0,
      track_order: audioTracks.value.length,
    });

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
    setupAudioElement(newTrack);
  }

  // Set up audio element for a track
  function setupAudioElement(track: AudioTrack) {
    // Initialize audio context if not already
    if (!audioContext.value) {
      audioContext.value = new AudioContext();
    }

    const audio = new Audio(track.filePath);
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

    const videoTime = videoElement.value.currentTime;
    const relativeTime = videoTime - props.clipStartTime;

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
    audioElements.value.forEach((audio, trackId) => {
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
    await updateAudioTrack(trackId, {
      name: updates.name,
      start_time: updates.startTime,
      end_time: updates.endTime,
      volume: updates.volume,
      fade_in: updates.fadeIn,
      fade_out: updates.fadeOut,
      track_order: updates.trackOrder,
      is_muted: updates.isMuted ? 1 : 0,
      is_solo: updates.isSolo ? 1 : 0,
    });

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
    await deleteAudioTrack(trackId);

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

  function updateOriginalVolume(volume: number) {
    originalVolume.value = volume;
    // Apply to video element
    if (videoElement.value) {
      const dbLinearGain = Math.pow(10, originalDb.value / 20);
      videoElement.value.volume = Math.min(1, volume * dbLinearGain);
    }
  }

  function updateOriginalDb(db: number) {
    originalDb.value = db;
    // Apply to video element
    if (videoElement.value) {
      const dbLinearGain = Math.pow(10, db / 20);
      videoElement.value.volume = Math.min(1, originalVolume.value * dbLinearGain);
    }
  }

  function updateTrackDb(trackId: string, db: number) {
    trackDbValues.value[trackId] = db;
    updateAudioGain(trackId);
  }

  // Filter operations
  function updateFilter(settings: FilterSettings | null) {
    filterSettings.value = settings;
  }

  // Text overlay operations
  async function addTextOverlay(text: string, style: any) {
    if (!clipEditId.value) return;

    const overlay = await createTextOverlay(clipEditId.value, {
      text,
      start_time: previewTime.value,
      end_time: Math.min(previewTime.value + 3, clipDuration.value),
      position_x: 50,
      position_y: 80,
      style_data: JSON.stringify(style),
      animation: 'fade',
    });

    textOverlays.value.push({
      id: overlay.id,
      text: overlay.text,
      startTime: overlay.start_time,
      endTime: overlay.end_time,
      position: { x: overlay.position_x, y: overlay.position_y },
      style,
      animation: overlay.animation as any,
    });
  }

  async function updateTextOverlayLocal(overlayId: string, updates: Partial<TextOverlay>) {
    await updateTextOverlay(overlayId, {
      text: updates.text,
      start_time: updates.startTime,
      end_time: updates.endTime,
      position_x: updates.position?.x,
      position_y: updates.position?.y,
      style_data: updates.style ? JSON.stringify(updates.style) : undefined,
      animation: updates.animation,
    });

    const overlay = textOverlays.value.find((o) => o.id === overlayId);
    if (overlay) {
      Object.assign(overlay, updates);
    }
  }

  async function deleteTextOverlayLocal(overlayId: string) {
    await deleteTextOverlay(overlayId);
    textOverlays.value = textOverlays.value.filter((o) => o.id !== overlayId);
  }

  // Sticker operations
  async function addStickerLocal(stickerPath: string, type: 'emoji' | 'image' | 'gif') {
    if (!clipEditId.value) return;

    const sticker = await createSticker(clipEditId.value, {
      sticker_path: stickerPath,
      sticker_type: type,
      start_time: previewTime.value,
      end_time: Math.min(previewTime.value + 3, clipDuration.value),
      position_x: 50,
      position_y: 50,
      scale: 1,
      rotation: 0,
      animation: 'none',
    });

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
    await updateSticker(stickerId, {
      sticker_path: updates.stickerPath,
      sticker_type: updates.stickerType,
      start_time: updates.startTime,
      end_time: updates.endTime,
      position_x: updates.position?.x,
      position_y: updates.position?.y,
      scale: updates.scale,
      rotation: updates.rotation,
      animation: updates.animation,
    });

    const sticker = stickers.value.find((s) => s.id === stickerId);
    if (sticker) {
      Object.assign(sticker, updates);
    }
  }

  async function deleteStickerLocal(stickerId: string) {
    await deleteSticker(stickerId);
    stickers.value = stickers.value.filter((s) => s.id !== stickerId);
  }

  // Effect operations
  async function addEffectLocal(type: string, settings: any) {
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

  async function deleteEffectLocal(effectId: string) {
    await deleteEffect(effectId);
    effects.value = effects.value.filter((e) => e.id !== effectId);
  }

  // Save all changes
  async function handleSave() {
    if (!clipEditId.value) return;

    await updateClipEdit(clipEditId.value, {
      trim: {
        startTime: props.clipStartTime,
        endTime: props.clipEndTime,
        segments: trimSegments.value,
      },
      filter: filterSettings.value,
      originalVolume: originalVolume.value,
      originalDb: originalDb.value,
      trackDbValues: trackDbValues.value,
    });

    emit('save', props.clipId);
    close();
  }

  // Load existing edit data
  async function loadEditData() {
    const editRecord = await getOrCreateClipEdit(props.clipId);
    clipEditId.value = editRecord.id;

    const fullEdit = await getFullClipEdit(props.clipId);
    if (fullEdit) {
      const editData = JSON.parse(fullEdit.edit.edit_data);

      if (editData.trim?.segments && editData.trim.segments.length > 0) {
        trimSegments.value = editData.trim.segments;
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

      if (editData.filter) {
        filterSettings.value = editData.filter;
      }
      if (editData.originalVolume !== undefined) {
        originalVolume.value = editData.originalVolume;
      }
      if (editData.originalDb !== undefined) {
        originalDb.value = editData.originalDb;
      }
      if (editData.trackDbValues) {
        trackDbValues.value = editData.trackDbValues;
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
      }));

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

  // Keyboard shortcuts
  function handleKeyDown(e: KeyboardEvent) {
    if (!props.modelValue) return;

    if (e.key === 'Escape') {
      close();
    } else if (e.key === ' ' && !e.target?.toString().includes('Input')) {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  // Lifecycle
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen && props.clipId) {
        await loadEditData();
        // Initialize to clip start time (absolute time)
        previewTime.value = props.clipStartTime;

        // Set up audio elements for existing tracks
        audioTracks.value.forEach((track) => {
          if (!audioElements.value.has(track.id)) {
            setupAudioElement(track);
          }
        });

        // Apply initial volume to video
        if (videoElement.value) {
          const dbLinearGain = Math.pow(10, originalDb.value / 20);
          videoElement.value.volume = Math.min(1, originalVolume.value * dbLinearGain);
        }
      } else if (!isOpen) {
        // Clean up when dialog closes
        cleanupAudioElements();
        isPlaying.value = false;
      }
    }
  );

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
    cleanupAudioElements();
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
