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
              class="w-3/5 min-w-0 border-r border-border/40 flex flex-col bg-gradient-to-br from-black/20 to-transparent"
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

              <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
                <ClipEditorPreview
                  ref="previewRef"
                  :video-src="videoSrc"
                  :current-time="previewTime"
                  :effective-time="effectivePreviewTime"
                  :is-playing="isPlaying"
                  :clip-start="clipStartTime"
                  :clip-end="clipEndTime"
                  :text-overlays="textOverlays"
                  :stickers="stickers"
                  :filter-settings="activeFilterSettings"
                  :segments="playbackSegments"
                  :preview-aspect-ratio="previewAspectRatio"
                  :selected-aspect-ratios="selectedAspectRatios"
                  :framing-configs="framingConfigs"
                  @time-update="onPreviewTimeUpdate"
                  @toggle-play="togglePlay"
                  @video-element-ready="onVideoElementReady"
                  @update-overlay-position="onUpdateOverlayPosition"
                  @update-overlay-width="onUpdateOverlayWidth"
                />
              </div>
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
                  :original-db="originalDb"
                  :track-db-values="trackDbValues"
                  @add-track="(filePath, name, duration) => addAudioTrack(filePath, name, duration)"
                  @update-track="updateAudioTrackLocal"
                  @delete-track="deleteAudioTrackLocal"
                  @update-original-db="updateOriginalDb"
                  @update-track-db="updateTrackDb"
                />

                <FiltersTab
                  v-if="activeTab === 'filters'"
                  :filter-segments="filterSegments"
                  :current-time="effectivePreviewTime"
                  :duration="totalSegmentDuration"
                  @add-filter="addFilterSegment"
                  @update-filter="updateFilterSegment"
                  @delete-filter="deleteFilterSegment"
                />

                <TextOverlayTab
                  v-if="activeTab === 'text'"
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
                  v-if="activeTab === 'stickers'"
                  :stickers="stickers"
                  :current-time="effectivePreviewTime"
                  :duration="totalSegmentDuration"
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

                <AspectTab
                  v-if="activeTab === 'aspect'"
                  :framing-configs="framingConfigs"
                  :selected-aspect-ratios="selectedAspectRatios"
                  :framing-mode-value="framingMode"
                  :thumbnail-url="thumbnailUrl"
                  :video-path="videoPath"
                  :clip-start-time="props.clipStartTime"
                  :clip-end-time="props.clipEndTime"
                  :preview-aspect-ratio="previewAspectRatio"
                  @update:framing-configs="updateFramingConfigs"
                  @update:selected-aspect-ratios="updateSelectedAspectRatios"
                  @update:framing-mode="updateFramingMode"
                  @update:preview-aspect-ratio="(ratio: string) => (previewAspectRatio = ratio)"
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
            :filter-segments="filterSegments"
            :video-src="videoSrc"
            :audio-gain-db="effectiveAudioGainDb"
            :track-db-values="trackDbValues"
            @seek="seekTo"
            @update-trim-segment="updateTrimSegment"
            @update-audio-track="updateAudioTrackLocal"
            @update-text-overlay="updateTextOverlayLocal"
            @update-sticker="updateStickerLocal"
            @update-effect="updateEffectLocal"
            @update-filter-segment="updateFilterSegment"
          />
        </div>
      </div>

      <!-- Manual POI Editor Dialog -->
      <ManualPOIEditor
        v-model="showManualPOIEditor"
        :initial-config="getConfigForRatio(editingAspectRatio)"
        :target-aspect-ratio="editingAspectRatio"
        :source-aspect-ratio="'16:9'"
        :thumbnail-url="thumbnailUrl"
        :video-path="videoPath"
        :clip-start-time="props.clipStartTime"
        :clip-end-time="props.clipEndTime"
        @confirm="onManualPOIConfigConfirm"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { Film, X, Loader2, Check } from 'lucide-vue-next';
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
    getRawVideosByProjectId,
  } from '@/services/database';

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
  import AspectTab from './tabs/AspectTab.vue';
  import ManualPOIEditor from '@/components/poi/ManualPOIEditor.vue';

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
    projectAudioGainDb?: number; // dB gain from project audio settings
  }>();

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'save', clipId: string): void;
  }>();

  // Refs
  const dialogRef = ref<HTMLElement | null>(null);
  const previewRef = ref<InstanceType<typeof ClipEditorPreview> | null>(null);
  const videoElement = ref<HTMLVideoElement | null>(null);
  const clipEditId = ref<string | null>(null);

  // Auto-save state
  const isSaving = ref(false);
  const lastSaved = ref(false);
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let isInitialLoad = ref(true); // Prevent auto-save during initial data load

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
  const filterSegments = ref<FilterSegment[]>([]);
  const originalDb = ref(0);
  const trackDbValues = ref<Record<string, number>>({});

  // Aspect ratio framing data
  const selectedAspectRatios = ref<string[]>([]);
  const previewAspectRatio = ref<string>('16:9'); // Currently previewed aspect ratio
  const framingMode = ref<'auto' | 'manual'>('auto');
  const framingConfigs = ref<ManualFramingConfigs>({});
  const videoPath = ref<string | null>(null);
  const thumbnailUrl = ref<string | null>(null);

  // Manual POI editor state
  const showManualPOIEditor = ref(false);
  const editingAspectRatio = ref<string>('9:16');

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

  // Convert absolute video time to effective timeline time (accounting for segment cuts)
  // This is the time position in the "edited" timeline where cuts are removed
  const effectivePreviewTime = computed(() => {
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
    selectedAspectRatios.value = ratios;
  }

  function updateFramingMode(mode: 'auto' | 'manual') {
    framingMode.value = mode;
  }

  // Toggle aspect ratio selection (add/remove from selectedAspectRatios)
  function toggleAspectRatio(ratio: string) {
    const current = [...selectedAspectRatios.value];
    const index = current.indexOf(ratio);
    if (index > -1) {
      current.splice(index, 1);
      // If removing the currently previewed ratio, switch to 16:9 or first remaining
      if (previewAspectRatio.value === ratio) {
        previewAspectRatio.value = current.length > 0 ? current[0] : '16:9';
      }
    } else {
      current.push(ratio);
      // Switch preview to the newly selected ratio
      previewAspectRatio.value = ratio;
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
    if (!clipEditId.value) return;

    // Use effective time (accounting for segment cuts) for the overlay timing
    const effectiveStartTime = effectivePreviewTime.value;
    const effectiveEndTime = Math.min(effectiveStartTime + 3, totalSegmentDuration.value);

    // Get the current preview container height for proper font scaling on export
    const currentPreviewHeight = previewRef.value?.getOverlayContainerHeight() ?? 400;

    const overlay = await createTextOverlay(clipEditId.value, {
      text,
      start_time: effectiveStartTime,
      end_time: effectiveEndTime,
      position_x: 50,
      position_y: 50, // Default to center
      style_data: JSON.stringify(style),
      animation: 'fade',
      preview_height: currentPreviewHeight,
    });

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

    await updateTextOverlay(overlayId, {
      text: updates.text,
      start_time: updates.startTime,
      end_time: updates.endTime,
      position_x: updates.position?.x,
      position_y: updates.position?.y,
      style_data: updates.style ? JSON.stringify(updates.style) : undefined,
      per_ratio_configs_data: updates.perRatioConfigs ? JSON.stringify(updates.perRatioConfigs) : undefined,
      preview_height: currentPreviewHeight,
      animation: updates.animation,
    });

    const overlay = textOverlays.value.find((o) => o.id === overlayId);
    if (overlay) {
      Object.assign(overlay, updates);
      if (currentPreviewHeight !== undefined) {
        overlay.previewHeight = currentPreviewHeight;
      }
    }
  }

  async function deleteTextOverlayLocal(overlayId: string) {
    await deleteTextOverlay(overlayId);
    textOverlays.value = textOverlays.value.filter((o) => o.id !== overlayId);
  }

  // Sticker operations
  async function addStickerLocal(stickerPath: string, type: 'emoji' | 'image' | 'gif') {
    if (!clipEditId.value) return;

    // Use effective time (accounting for segment cuts) for sticker timing
    const effectiveStartTime = effectivePreviewTime.value;
    const effectiveEndTime = Math.min(effectiveStartTime + 3, totalSegmentDuration.value);

    const sticker = await createSticker(clipEditId.value, {
      sticker_path: stickerPath,
      sticker_type: type,
      start_time: effectiveStartTime,
      end_time: effectiveEndTime,
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

  // Handle overlay position updates from preview drag
  function onUpdateOverlayPosition(type: 'text' | 'sticker', id: string, position: { x: number; y: number }) {
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
      updateStickerLocal(id, { position });
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
    if (!clipEditId.value) return;

    isSaving.value = true;
    lastSaved.value = false;

    try {
      await updateClipEdit(clipEditId.value, {
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
      });

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
      } else if (props.projectAudioGainDb !== undefined) {
        // Initialize from project audio settings if no clip-specific setting exists
        originalDb.value = props.projectAudioGainDb;
      }
      if (editData.trackDbValues) {
        trackDbValues.value = editData.trackDbValues;
      }

      // Load aspect framing data
      if (editData.aspectFraming) {
        selectedAspectRatios.value = editData.aspectFraming.selectedRatios || [];
        framingMode.value = editData.aspectFraming.framingMode || 'auto';
        framingConfigs.value = editData.aspectFraming.configs || {};
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
      // Initialize audio settings from project if available
      if (props.projectAudioGainDb !== undefined) {
        originalDb.value = props.projectAudioGainDb;
      }
    } else {
      // No edit data and no segments, still initialize audio settings from project
      if (props.projectAudioGainDb !== undefined) {
        originalDb.value = props.projectAudioGainDb;
      }
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

    if (e.key === 'Escape') {
      close();
    } else if (e.key === ' ' && !e.target?.toString().includes('Input')) {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveNow(); // Save immediately on Ctrl+S
    }
  }

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

  // Lifecycle
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen && props.clipId) {
        isInitialLoad.value = true; // Prevent auto-save during load
        await loadEditData();
        // Initialize to clip start time (absolute time)
        previewTime.value = props.clipStartTime;

        // Set up audio elements for existing tracks
        audioTracks.value.forEach((track) => {
          if (!audioElements.value.has(track.id)) {
            setupAudioElement(track);
          }
        });

        // Apply initial volume to video (convert dB to linear gain)
        if (videoElement.value) {
          const linearGain = Math.pow(10, originalDb.value / 20);
          videoElement.value.volume = Math.min(1, linearGain);
        }

        // Load video info for aspect tab
        await loadVideoInfo();

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
        await performSave();

        // Clean up when dialog closes
        cleanupAudioElements();
        isPlaying.value = false;
        // Reset aspect tab state
        videoPath.value = null;
        thumbnailUrl.value = null;
        // Reset auto-save state
        isSaving.value = false;
        lastSaved.value = false;
        isInitialLoad.value = true;
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
