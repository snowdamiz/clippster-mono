<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h3 class="text-sm font-medium text-white mb-1">Export Video</h3>
      <p class="text-xs text-white/50">Configure export settings and build your clip.</p>
    </div>

    <!-- Selected Aspect Ratios Summary -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="text-xs font-medium text-white/70">Export Formats</label>
        <button @click="$emit('goToAspectTab')" class="text-xs text-violet-400 hover:text-violet-300 transition-colors">
          Configure →
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        <!-- 16:9 Original always shown -->
        <span
          class="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded-md border border-emerald-500/30 flex items-center gap-1"
        >
          <div class="w-3 h-2 border border-current rounded-[1px]"></div>
          16:9
          <span class="text-[9px] text-emerald-400/70">Original</span>
        </span>
        <!-- Other selected ratios -->
        <span
          v-for="ratio in otherSelectedRatios"
          :key="ratio"
          class="px-2 py-1 bg-violet-500/20 text-violet-300 text-xs rounded-md border border-violet-500/30 flex items-center gap-1"
        >
          <div class="border border-current rounded-[1px]" :style="getRatioStyle(ratio)"></div>
          {{ ratio }}
        </span>
      </div>
    </div>

    <!-- Divider -->
    <div class="h-px bg-white/10" />

    <!-- Quality Setting -->
    <div class="space-y-2">
      <label class="text-xs font-medium text-white/70">Quality</label>
      <div class="flex gap-2">
        <button
          v-for="q in qualityOptions"
          :key="q.value"
          @click="quality = q.value"
          :class="[
            'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all',
            quality === q.value
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
              : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10',
          ]"
        >
          {{ q.label }}
        </button>
      </div>
      <p class="text-[10px] text-white/40">
        {{
          quality === 'low'
            ? 'Fast export, smaller file'
            : quality === 'medium'
              ? 'Balanced quality'
              : 'Best quality, larger file'
        }}
      </p>
    </div>

    <!-- Frame Rate Setting -->
    <div class="space-y-2">
      <label class="text-xs font-medium text-white/70">Frame Rate</label>
      <div class="flex gap-2">
        <button
          v-for="fr in frameRateOptions"
          :key="fr"
          @click="frameRate = fr"
          :class="[
            'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all',
            frameRate === fr
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
              : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10',
          ]"
        >
          {{ fr }} FPS
        </button>
      </div>
    </div>

    <!-- Output Format Setting -->
    <div class="space-y-2">
      <label class="text-xs font-medium text-white/70">Format</label>
      <div class="flex gap-2">
        <button
          v-for="fmt in formatOptions"
          :key="fmt"
          @click="outputFormat = fmt"
          :class="[
            'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all',
            outputFormat === fmt
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
              : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10',
          ]"
        >
          {{ fmt.toUpperCase() }}
        </button>
      </div>
    </div>

    <!-- Divider -->
    <div class="h-px bg-white/10" />

    <!-- Intro/Outro Selectors -->
    <div class="space-y-3">
      <label class="text-xs font-medium text-white/70">Intro & Outro</label>

      <!-- Intro Selector -->
      <div class="space-y-1">
        <span class="text-[10px] text-white/40">Intro</span>
        <div class="relative">
          <button
            ref="introButtonRef"
            @click="toggleIntroDropdown"
            class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-left flex items-center justify-between hover:border-white/20 transition-all text-xs"
          >
            <span :class="selectedIntro ? 'text-white' : 'text-white/40'">
              {{ selectedIntro ? `${selectedIntro.name} (${formatDuration(selectedIntro.duration || 0)})` : 'None' }}
            </span>
            <ChevronDown
              class="h-3.5 w-3.5 text-white/40 transition-transform"
              :class="{ 'rotate-180': showIntroDropdown }"
            />
          </button>
          <Teleport to="body">
            <div
              v-if="showIntroDropdown"
              ref="introDropdownRef"
              class="fixed bg-zinc-900 border border-white/10 rounded-lg shadow-xl z-[9999] overflow-y-auto max-h-48"
              :style="introDropdownStyle"
              @click.stop
            >
              <button
                @click="selectIntro(null)"
                class="block w-full text-left px-3 py-2 hover:bg-white/10 transition-colors text-xs"
                :class="{ 'bg-violet-500/20 text-violet-300': !selectedIntro }"
              >
                None
              </button>
              <button
                v-for="intro in intros"
                :key="intro.id"
                @click="selectIntro(intro)"
                class="block w-full text-left px-3 py-2 hover:bg-white/10 transition-colors text-xs"
                :class="{ 'bg-violet-500/20 text-violet-300': selectedIntro?.id === intro.id }"
              >
                <div class="flex items-center justify-between">
                  <span class="truncate text-white">{{ intro.name }}</span>
                  <span class="text-white/40 ml-2">{{ formatDuration(intro.duration || 0) }}</span>
                </div>
              </button>
              <div v-if="loadingAssets" class="px-3 py-2 text-xs text-center text-white/40">Loading...</div>
            </div>
          </Teleport>
        </div>
      </div>

      <!-- Outro Selector -->
      <div class="space-y-1">
        <span class="text-[10px] text-white/40">Outro</span>
        <div class="relative">
          <button
            ref="outroButtonRef"
            @click="toggleOutroDropdown"
            class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-left flex items-center justify-between hover:border-white/20 transition-all text-xs"
          >
            <span :class="selectedOutro ? 'text-white' : 'text-white/40'">
              {{ selectedOutro ? `${selectedOutro.name} (${formatDuration(selectedOutro.duration || 0)})` : 'None' }}
            </span>
            <ChevronDown
              class="h-3.5 w-3.5 text-white/40 transition-transform"
              :class="{ 'rotate-180': showOutroDropdown }"
            />
          </button>
          <Teleport to="body">
            <div
              v-if="showOutroDropdown"
              ref="outroDropdownRef"
              class="fixed bg-zinc-900 border border-white/10 rounded-lg shadow-xl z-[9999] overflow-y-auto max-h-48"
              :style="outroDropdownStyle"
              @click.stop
            >
              <button
                @click="selectOutro(null)"
                class="block w-full text-left px-3 py-2 hover:bg-white/10 transition-colors text-xs"
                :class="{ 'bg-violet-500/20 text-violet-300': !selectedOutro }"
              >
                None
              </button>
              <button
                v-for="outro in outros"
                :key="outro.id"
                @click="selectOutro(outro)"
                class="block w-full text-left px-3 py-2 hover:bg-white/10 transition-colors text-xs"
                :class="{ 'bg-violet-500/20 text-violet-300': selectedOutro?.id === outro.id }"
              >
                <div class="flex items-center justify-between">
                  <span class="truncate text-white">{{ outro.name }}</span>
                  <span class="text-white/40 ml-2">{{ formatDuration(outro.duration || 0) }}</span>
                </div>
              </button>
              <div v-if="loadingAssets" class="px-3 py-2 text-xs text-center text-white/40">Loading...</div>
            </div>
          </Teleport>
        </div>
      </div>
    </div>

    <!-- Export Button -->
    <button
      @click="handleExport"
      :disabled="isBuilding"
      class="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:from-zinc-700 disabled:to-zinc-700 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
    >
      <Loader2 v-if="isBuilding" :size="16" class="animate-spin" />
      <Download v-else :size="16" />
      {{ isBuilding ? `Building... ${buildProgress}%` : 'Export Video' }}
    </button>

    <!-- Divider -->
    <div class="h-px bg-white/10" />

    <!-- Previous Builds Section -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-medium text-white/70">Previous Builds</h4>
        <button @click="loadBuilds" class="p-1 hover:bg-white/10 rounded transition-colors" title="Refresh">
          <RefreshCw :size="12" class="text-white/40" :class="{ 'animate-spin': loadingBuilds }" />
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loadingBuilds" class="flex items-center justify-center py-6">
        <Loader2 :size="20" class="animate-spin text-white/40" />
      </div>

      <!-- Empty State -->
      <div v-else-if="builds.length === 0" class="py-6 text-center">
        <Package :size="24" class="mx-auto text-white/20 mb-2" />
        <p class="text-xs text-white/40">No builds yet</p>
        <p class="text-[10px] text-white/30 mt-1">Export your clip to create a build</p>
      </div>

      <!-- Builds List -->
      <div v-else class="space-y-2">
        <div
          v-for="build in builds"
          :key="build.id"
          class="group p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
        >
          <div class="flex items-start gap-3">
            <!-- Thumbnail -->
            <div class="w-14 h-10 rounded overflow-hidden bg-black/50 flex-shrink-0">
              <img
                v-if="build.thumbnail_path && buildThumbnails.get(build.id)"
                :src="buildThumbnails.get(build.id)!"
                class="w-full h-full object-cover"
                @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <Film :size="12" class="text-white/30" />
              </div>
            </div>

            <!-- Build Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-white">Build #{{ build.build_number }}</span>
                <span
                  :class="[
                    'px-1.5 py-0.5 text-[9px] rounded-full',
                    build.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : build.status === 'building'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-red-500/20 text-red-400',
                  ]"
                >
                  {{
                    build.status === 'completed'
                      ? 'Complete'
                      : build.status === 'building'
                        ? `${build.progress}%`
                        : 'Failed'
                  }}
                </span>
              </div>

              <!-- Aspect Ratios -->
              <div class="flex flex-wrap gap-1 mt-1">
                <span
                  v-for="ratio in parseAspectRatios(build.aspect_ratios)"
                  :key="ratio"
                  class="px-1 py-0.5 bg-white/5 text-white/50 text-[9px] rounded"
                >
                  {{ ratio }}
                </span>
              </div>

              <!-- Meta info -->
              <p class="text-[10px] text-white/40 mt-1">
                {{ build.quality || 'high' }} • {{ build.frame_rate || 30 }}fps • {{ formatDate(build.created_at) }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                v-if="build.status === 'completed' && build.file_path"
                @click="openBuildFolder(build)"
                class="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title="Open folder"
              >
                <FolderOpen :size="12" />
              </button>
              <button
                @click="deleteBuild(build)"
                class="p-1.5 rounded bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
                title="Delete build"
              >
                <Trash2 :size="12" />
              </button>
            </div>
          </div>

          <!-- Progress bar for building status -->
          <div v-if="build.status === 'building'" class="mt-2">
            <div class="h-1 bg-white/10 rounded-full overflow-hidden">
              <div class="h-full bg-amber-500 transition-all duration-300" :style="{ width: `${build.progress}%` }" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { Download, ChevronDown, Loader2, RefreshCw, Package, Film, FolderOpen, Trash2 } from 'lucide-vue-next';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import {
    getAllIntroOutros,
    getClipBuilds,
    deleteClipBuild,
    type IntroOutro,
    type ClipBuild,
  } from '@/services/database';

  const props = defineProps<{
    clipId: string;
    projectId: string | null;
    selectedAspectRatios: string[];
    subtitleSettings?: any | null;
    framingMode?: 'auto' | 'manual';
    framingConfigs?: any;
    filterSegments?: any[];
    textOverlays?: any[];
    stickers?: any[];
    watermarks?: any[];
    audioTracks?: any[];
    originalDb?: number;
    trackDbValues?: Record<string, number>;
    clipStartTime: number;
    clipEndTime: number;
    clipName: string;
    clipSegments?: any[];
  }>();

  const emit = defineEmits<{
    (e: 'goToAspectTab'): void;
    (e: 'buildStarted'): void;
    (e: 'buildCompleted', buildId: string): void;
    (e: 'buildFailed', error: string): void;
  }>();

  // Export settings
  const quality = ref<'low' | 'medium' | 'high'>('high');
  const frameRate = ref<30 | 60>(30);
  const outputFormat = ref<'mp4' | 'mov'>('mp4');

  const qualityOptions = [
    { value: 'low' as const, label: 'Low' },
    { value: 'medium' as const, label: 'Medium' },
    { value: 'high' as const, label: 'High' },
  ];
  const frameRateOptions = [30, 60] as const;
  const formatOptions = ['mp4', 'mov'] as const;

  // Computed: Other selected ratios (excluding 16:9 which is always shown separately)
  const otherSelectedRatios = computed(() => {
    return props.selectedAspectRatios.filter((r) => r !== '16:9');
  });

  // Get aspect ratio preview style
  function getRatioStyle(ratio: string): { width: string; height: string } {
    switch (ratio) {
      case '9:16':
        return { width: '7px', height: '12px' };
      case '4:5':
        return { width: '9px', height: '11px' };
      case '1:1':
        return { width: '10px', height: '10px' };
      default:
        return { width: '12px', height: '8px' };
    }
  }

  // Effective aspect ratios for export (always includes 16:9)
  const effectiveAspectRatios = computed(() => {
    const ratios = [...props.selectedAspectRatios];
    if (!ratios.includes('16:9')) {
      ratios.unshift('16:9');
    }
    return ratios;
  });

  // Intro/Outro state
  const intros = ref<IntroOutro[]>([]);
  const outros = ref<IntroOutro[]>([]);
  const selectedIntro = ref<IntroOutro | null>(null);
  const selectedOutro = ref<IntroOutro | null>(null);
  const loadingAssets = ref(false);
  const showIntroDropdown = ref(false);
  const showOutroDropdown = ref(false);
  const introButtonRef = ref<HTMLElement | null>(null);
  const outroButtonRef = ref<HTMLElement | null>(null);
  const introDropdownRef = ref<HTMLElement | null>(null);
  const outroDropdownRef = ref<HTMLElement | null>(null);

  // Builds state
  const builds = ref<ClipBuild[]>([]);
  const loadingBuilds = ref(false);
  const buildThumbnails = ref<Map<string, string>>(new Map());

  // Build progress state
  const isBuilding = ref(false);
  const buildProgress = ref(0);

  // Event listeners
  let unlistenProgress: UnlistenFn | null = null;
  let unlistenComplete: UnlistenFn | null = null;
  let unlistenError: UnlistenFn | null = null;

  // Dropdown positioning
  const introDropdownStyle = computed(() => {
    if (!introButtonRef.value) return {};
    const rect = introButtonRef.value.getBoundingClientRect();
    return {
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
    };
  });

  const outroDropdownStyle = computed(() => {
    if (!outroButtonRef.value) return {};
    const rect = outroButtonRef.value.getBoundingClientRect();
    return {
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
    };
  });

  // Methods
  function formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function parseAspectRatios(ratiosJson: string | null): string[] {
    if (!ratiosJson) return ['16:9'];
    try {
      return JSON.parse(ratiosJson);
    } catch {
      return ['16:9'];
    }
  }

  function toggleIntroDropdown() {
    showIntroDropdown.value = !showIntroDropdown.value;
    showOutroDropdown.value = false;
  }

  function toggleOutroDropdown() {
    showOutroDropdown.value = !showOutroDropdown.value;
    showIntroDropdown.value = false;
  }

  function selectIntro(intro: IntroOutro | null) {
    selectedIntro.value = intro;
    showIntroDropdown.value = false;
  }

  function selectOutro(outro: IntroOutro | null) {
    selectedOutro.value = outro;
    showOutroDropdown.value = false;
  }

  async function loadIntroOutros() {
    loadingAssets.value = true;
    try {
      const allAssets = await getAllIntroOutros();
      intros.value = allAssets.filter((a) => a.type === 'intro');
      outros.value = allAssets.filter((a) => a.type === 'outro');
    } catch (error) {
      console.error('[ExportTab] Failed to load intros/outros:', error);
    } finally {
      loadingAssets.value = false;
    }
  }

  async function loadBuilds() {
    if (!props.clipId) return;

    loadingBuilds.value = true;
    try {
      builds.value = await getClipBuilds(props.clipId);

      // Load thumbnails for builds
      for (const build of builds.value) {
        if (build.thumbnail_path && !buildThumbnails.value.has(build.id)) {
          try {
            const exists = await invoke<boolean>('check_file_exists', { path: build.thumbnail_path });
            if (exists) {
              const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: build.thumbnail_path });
              buildThumbnails.value.set(build.id, dataUrl);
            }
          } catch (err) {
            console.warn('[ExportTab] Failed to load build thumbnail:', err);
          }
        }
      }
    } catch (error) {
      console.error('[ExportTab] Failed to load builds:', error);
      builds.value = [];
    } finally {
      loadingBuilds.value = false;
    }
  }

  async function handleExport() {
    if (!props.clipId || !props.projectId || isBuilding.value) return;

    try {
      isBuilding.value = true;
      buildProgress.value = 0;
      emit('buildStarted');

      const { updateClipBuildStatus, getRawVideosByProjectId, createClipBuild, getFullClipEdit } = await import(
        '@/services/database'
      );

      // Update database status to building
      await updateClipBuildStatus(props.clipId, 'building', { progress: 0 });

      // Create build record
      const buildId = await createClipBuild(props.clipId, {
        aspectRatios: effectiveAspectRatios.value,
        quality: quality.value,
        frameRate: frameRate.value,
        outputFormat: outputFormat.value,
        includeSubtitles: props.subtitleSettings?.enabled ?? false,
      });

      // Get the project video file path
      const rawVideos = await getRawVideosByProjectId(props.projectId);
      if (rawVideos.length === 0) {
        throw new Error('No project video found');
      }

      const projectVideo = rawVideos[0];

      // Prepare segments
      const segments = props.clipSegments?.length
        ? props.clipSegments.map((seg) => ({
            id: seg.id,
            start_time: seg.start_time ?? seg.startTime,
            end_time: seg.end_time ?? seg.endTime,
            duration: (seg.end_time ?? seg.endTime) - (seg.start_time ?? seg.startTime),
            transcript: seg.transcript || null,
          }))
        : [
            {
              id: `segment-${props.clipId}`,
              start_time: props.clipStartTime,
              end_time: props.clipEndTime,
              duration: props.clipEndTime - props.clipStartTime,
              transcript: null,
            },
          ];

      // Prepare audio settings
      const audioSettings = {
        volume: props.originalDb ?? 0,
        normalize: false,
        originalAudioDb: props.originalDb ?? 0,
        musicTracks:
          props.audioTracks
            ?.filter((t) => !t.isMuted)
            .map((t) => ({
              filePath: t.filePath,
              gainDb: props.trackDbValues?.[t.id] ?? 0,
              fadeIn: t.fadeIn ?? 0,
              fadeOut: t.fadeOut ?? 0,
              startTime: t.startTime,
              endTime: t.endTime,
              isMuted: t.isMuted ?? false,
            })) ?? [],
      };

      // Prepare filter segments for export
      const videoFilterSegments =
        props.filterSegments?.map((seg) => ({
          startTime: seg.startTime,
          endTime: seg.endTime,
          settings: seg.settings,
        })) ?? null;

      // Prepare text overlays for export
      const textOverlaysForExport =
        props.textOverlays?.map((overlay) => ({
          id: overlay.id,
          text: overlay.text,
          startTime: overlay.startTime,
          endTime: overlay.endTime,
          positionX: overlay.position?.x ?? overlay.positionX ?? 50,
          positionY: overlay.position?.y ?? overlay.positionY ?? 50,
          style: overlay.style ?? {},
          animation: overlay.animation ?? 'none',
          perRatioConfigs: overlay.perRatioConfigs ?? null,
          previewHeight: overlay.previewHeight ?? null,
        })) ?? null;

      // Prepare stickers for export
      const stickersForExport =
        props.stickers?.map((sticker) => ({
          id: sticker.id,
          stickerPath: sticker.stickerPath,
          stickerType: sticker.stickerType,
          startTime: sticker.startTime,
          endTime: sticker.endTime,
          positionX: sticker.position?.x ?? sticker.positionX ?? 50,
          positionY: sticker.position?.y ?? sticker.positionY ?? 50,
          scale: sticker.scale ?? 1,
          rotation: sticker.rotation ?? 0,
          animation: sticker.animation ?? 'none',
          perRatioConfigs: sticker.perRatioConfigs ?? null,
        })) ?? null;

      // Prepare watermarks for export
      const clipWatermarksForExport =
        props.watermarks?.map((wm) => ({
          id: wm.id,
          watermarkId: wm.watermarkId,
          filePath: wm.filePath ?? wm.watermarkPath,
          startTime: wm.startTime,
          endTime: wm.endTime,
          positionX: wm.position?.x ?? wm.positionX ?? 8,
          positionY: wm.position?.y ?? wm.positionY ?? 92,
          scale: wm.scale ?? 15,
          opacity: wm.opacity ?? 80,
          perRatioConfigs: wm.perRatioConfigs ?? null,
        })) ?? null;

      // Determine framing strategy
      const framingStrategy =
        props.framingMode === 'manual' && props.framingConfigs && Object.keys(props.framingConfigs).length > 0
          ? 'manual'
          : 'auto_poi';

      // Build the clip
      await invoke('build_clip_from_segments', {
        projectId: props.projectId,
        clipId: props.clipId,
        clipName: props.clipName || 'Untitled',
        videoPath: projectVideo.file_path,
        segments: segments,
        subtitleSettings: props.subtitleSettings,
        subtitleOverrides: null,
        transcriptWords: [],
        transcriptSegments: [],
        maxWords: 3,
        aspectRatios: effectiveAspectRatios.value,
        quality: quality.value,
        frameRate: frameRate.value,
        outputFormat: outputFormat.value,
        runNumber: null,
        buildNumber: builds.value.length + 1,
        buildId: buildId,
        introPath: selectedIntro.value?.file_path || null,
        introDuration: selectedIntro.value?.duration || null,
        outroPath: selectedOutro.value?.file_path || null,
        outroDuration: selectedOutro.value?.duration || null,
        watermarkSettings: null,
        audioSettings: audioSettings,
        framingStrategy: framingStrategy,
        manualFramingConfigs: props.framingConfigs || null,
        videoFilterSegments: videoFilterSegments,
        textOverlays: textOverlaysForExport,
        stickers: stickersForExport,
        clipWatermarks: clipWatermarksForExport,
      });

      console.log('[ExportTab] Build started successfully');
    } catch (error) {
      console.error('[ExportTab] Failed to start build:', error);
      isBuilding.value = false;
      emit('buildFailed', String(error));
    }
  }

  async function openBuildFolder(build: ClipBuild) {
    if (!build.file_path) return;
    try {
      // Get directory from file path
      const lastSlash = Math.max(build.file_path.lastIndexOf('/'), build.file_path.lastIndexOf('\\'));
      const dir = build.file_path.substring(0, lastSlash);
      await invoke('open_path', { path: dir });
    } catch (error) {
      console.error('[ExportTab] Failed to open folder:', error);
    }
  }

  async function deleteBuild(build: ClipBuild) {
    try {
      await deleteClipBuild(build.id);
      builds.value = builds.value.filter((b) => b.id !== build.id);
      buildThumbnails.value.delete(build.id);
    } catch (error) {
      console.error('[ExportTab] Failed to delete build:', error);
    }
  }

  // Handle click outside to close dropdowns
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Node;

    if (
      showIntroDropdown.value &&
      introButtonRef.value &&
      !introButtonRef.value.contains(target) &&
      introDropdownRef.value &&
      !introDropdownRef.value.contains(target)
    ) {
      showIntroDropdown.value = false;
    }

    if (
      showOutroDropdown.value &&
      outroButtonRef.value &&
      !outroButtonRef.value.contains(target) &&
      outroDropdownRef.value &&
      !outroDropdownRef.value.contains(target)
    ) {
      showOutroDropdown.value = false;
    }
  }

  // Setup event listeners
  async function setupEventListeners() {
    // Listen for build progress
    unlistenProgress = await listen<{ clipId: string; progress: number }>('clip-build-progress', (event) => {
      if (event.payload.clipId === props.clipId) {
        buildProgress.value = event.payload.progress;
      }
    });

    // Listen for build completion
    unlistenComplete = await listen<{ clipId: string; buildId?: string }>('clip-build-complete', (event) => {
      if (event.payload.clipId === props.clipId) {
        isBuilding.value = false;
        buildProgress.value = 100;
        loadBuilds();
        emit('buildCompleted', event.payload.buildId || '');
      }
    });

    // Listen for build errors
    unlistenError = await listen<{ clipId: string; error: string }>('clip-build-error', (event) => {
      if (event.payload.clipId === props.clipId) {
        isBuilding.value = false;
        buildProgress.value = 0;
        loadBuilds();
        emit('buildFailed', event.payload.error);
      }
    });
  }

  // Watch for clipId changes
  watch(
    () => props.clipId,
    (newId) => {
      if (newId) {
        loadBuilds();
      }
    },
    { immediate: true }
  );

  // Lifecycle
  onMounted(async () => {
    document.addEventListener('click', handleClickOutside);
    await loadIntroOutros();
    await setupEventListeners();
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    unlistenProgress?.();
    unlistenComplete?.();
    unlistenError?.();
  });
</script>
