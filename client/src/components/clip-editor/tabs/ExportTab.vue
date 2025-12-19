<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h3 class="text-sm font-medium text-white mb-1">Export Video</h3>
      <p class="text-xs text-white/50 mb-4">Configure export settings and build your clip.</p>
    </div>

    <!-- Export Formats Card -->
    <div class="p-4 bg-white/5 rounded-lg border border-white/10">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <Layers :size="16" class="text-violet-400" />
          <span class="text-sm font-medium text-white">Export Formats</span>
        </div>
        <button
          @click="$emit('goToAspectTab')"
          class="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
        >
          Configure
          <ChevronRight :size="12" />
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        <!-- 16:9 Original always shown -->
        <div
          class="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-md border border-emerald-500/20 flex items-center gap-2"
        >
          <div class="w-4 h-2.5 border border-current rounded-[2px]"></div>
          <span class="font-medium">16:9</span>
          <span class="text-[10px] text-emerald-400/60">Original</span>
        </div>
        <!-- Other selected ratios -->
        <div
          v-for="ratio in otherSelectedRatios"
          :key="ratio"
          class="px-2.5 py-1.5 bg-violet-500/10 text-violet-400 text-xs rounded-md border border-violet-500/20 flex items-center gap-2"
        >
          <div class="border border-current rounded-[2px]" :style="getRatioStyle(ratio)"></div>
          <span class="font-medium">{{ ratio }}</span>
        </div>
        <div v-if="otherSelectedRatios.length === 0" class="text-[10px] text-white/40 flex items-center">
          Only exporting original format
        </div>
      </div>
    </div>

    <!-- Export Settings Card -->
    <div class="p-4 bg-white/5 rounded-lg border border-white/10 space-y-4">
      <div class="flex items-center gap-2 mb-1">
        <Settings :size="16" class="text-violet-400" />
        <span class="text-sm font-medium text-white">Export Settings</span>
      </div>

      <!-- Quality Setting -->
      <div class="space-y-2">
        <label class="text-xs text-white/50">Quality</label>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="q in qualityOptions"
            :key="q.value"
            @click="quality = q.value"
            :class="[
              'px-3 py-2 rounded-lg text-xs font-medium transition-all',
              quality === q.value
                ? 'bg-violet-500 text-white'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10',
            ]"
          >
            {{ q.label }}
          </button>
        </div>
        <p class="text-[10px] text-white/30">
          {{
            quality === 'low'
              ? 'Fast export, smaller file size'
              : quality === 'medium'
                ? 'Balanced quality and file size'
                : 'Best quality, larger file size'
          }}
        </p>
      </div>

      <!-- Frame Rate Setting -->
      <div class="space-y-2">
        <label class="text-xs text-white/50">Frame Rate</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="fr in frameRateOptions"
            :key="fr"
            @click="frameRate = fr"
            :class="[
              'px-3 py-2 rounded-lg text-xs font-medium transition-all',
              frameRate === fr
                ? 'bg-violet-500 text-white'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10',
            ]"
          >
            {{ fr }} FPS
          </button>
        </div>
      </div>

      <!-- Output Format Setting -->
      <div class="space-y-2">
        <label class="text-xs text-white/50">Format</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="fmt in formatOptions"
            :key="fmt"
            @click="outputFormat = fmt"
            :class="[
              'px-3 py-2 rounded-lg text-xs font-medium transition-all',
              outputFormat === fmt
                ? 'bg-violet-500 text-white'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10',
            ]"
          >
            {{ fmt.toUpperCase() }}
          </button>
        </div>
      </div>
    </div>

    <!-- Export Button -->
    <button
      @click="handleExport"
      :disabled="isBuilding"
      :class="[
        'w-full py-3.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm',
        isBuilding
          ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
          : 'bg-violet-500 hover:bg-violet-600 text-white shadow-lg shadow-violet-500/20',
      ]"
    >
      <Loader2 v-if="isBuilding" :size="16" class="animate-spin" />
      <Download v-else :size="16" />
      {{ isBuilding ? `Building... ${buildProgress}%` : 'Export Video' }}
    </button>

    <!-- Progress Bar (shown during build) -->
    <div v-if="isBuilding" class="space-y-1.5">
      <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-300 ease-out"
          :style="{ width: `${buildProgress}%` }"
        />
      </div>
      <p class="text-[10px] text-white/40 text-center">Processing video...</p>
    </div>

    <!-- Previous Builds Section -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-white">Previous Builds</h4>
        <button @click="loadBuilds" class="p-1.5 rounded hover:bg-white/10 transition-colors" title="Refresh">
          <RefreshCw :size="14" class="text-white/40" :class="{ 'animate-spin': loadingBuilds }" />
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loadingBuilds" class="flex items-center justify-center py-8">
        <Loader2 :size="20" class="animate-spin text-white/40" />
      </div>

      <!-- Empty State -->
      <div v-else-if="builds.length === 0" class="py-8 text-center bg-white/5 rounded-lg border border-white/10">
        <Package :size="28" class="mx-auto text-white/20 mb-2" />
        <p class="text-sm text-white/40">No builds yet</p>
        <p class="text-xs text-white/30 mt-1">Export your clip to create a build</p>
      </div>

      <!-- Builds List -->
      <div v-else class="space-y-2">
        <div
          v-for="build in builds"
          :key="build.id"
          class="group p-3 bg-white/5 hover:bg-white/[0.08] border border-white/10 rounded-lg transition-all"
        >
          <div class="flex items-start gap-3">
            <!-- Thumbnail -->
            <div class="w-16 h-10 rounded-md overflow-hidden bg-black/40 flex-shrink-0">
              <img
                v-if="build.thumbnail_path && buildThumbnails.get(build.id)"
                :src="buildThumbnails.get(build.id)!"
                class="w-full h-full object-cover"
                @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <Film :size="14" class="text-white/20" />
              </div>
            </div>

            <!-- Build Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-white">Build #{{ build.build_number }}</span>
                <span
                  :class="[
                    'px-1.5 py-0.5 text-[9px] font-medium rounded-full',
                    build.status === 'completed'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : build.status === 'building'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-red-500/15 text-red-400',
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
              <div class="flex flex-wrap gap-1 mt-1.5">
                <span
                  v-for="ratio in parseAspectRatios(build.aspect_ratios)"
                  :key="ratio"
                  class="px-1.5 py-0.5 bg-white/5 text-white/40 text-[9px] rounded"
                >
                  {{ ratio }}
                </span>
              </div>

              <!-- Meta info -->
              <p class="text-[10px] text-white/30 mt-1.5">
                {{ build.quality || 'high' }} • {{ build.frame_rate || 30 }}fps • {{ formatDate(build.created_at) }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                v-if="build.status === 'completed' && build.file_path"
                @click="
                  saveVideoToLocation(build.file_path, `${props.clipName || 'video'}.${build.output_format || 'mp4'}`)
                "
                class="p-1.5 rounded hover:bg-emerald-500/10 text-white/40 hover:text-emerald-400 transition-colors"
                title="Save As..."
              >
                <Download :size="14" />
              </button>
              <button
                v-if="build.status === 'completed' && build.file_path"
                @click="openBuildFolder(build)"
                class="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                title="Open folder"
              >
                <FolderOpen :size="14" />
              </button>
              <button
                @click="deleteBuild(build)"
                class="p-1.5 rounded hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                title="Delete build"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>

          <!-- Progress bar for building status -->
          <div v-if="build.status === 'building'" class="mt-3">
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
  import {
    Download,
    Loader2,
    RefreshCw,
    Package,
    Film,
    FolderOpen,
    Trash2,
    Layers,
    Settings,
    ChevronRight,
  } from 'lucide-vue-next';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { save } from '@tauri-apps/plugin-dialog';
  import { getClipBuilds, deleteClipBuild, resolveWatermarkById, type ClipBuild, type VideoEditorSource } from '@/services/database';
  import { ensureAssetDownloaded, type ServerOrganizationAsset } from '@/services/orgAssetSync';

  /**
   * Resolves creator profile watermark settings to include file paths for the Rust backend.
   * Handles both local watermarks and org-asset-{serverId} format.
   */
  async function resolveCreatorWatermarkSettings(settings: any): Promise<any | null> {
    if (!settings?.enabled || !settings?.watermarkId) {
      return null;
    }

    // Resolve the main/default watermark
    const mainWatermark = await resolveWatermarkById(settings.watermarkId);
    if (!mainWatermark) {
      console.warn('[ExportTab] Failed to resolve main watermark:', settings.watermarkId);
      return null;
    }

    // Build per-ratio settings with resolved file paths
    const allRatios = ['16:9', '9:16', '1:1', '4:5'];
    const resolvedPerRatioSettings: Record<string, any> = {};

    for (const ratio of allRatios) {
      const perRatioConfig = settings.perRatioSettings?.[ratio];

      if (perRatioConfig === null) {
        // Watermark explicitly disabled for this ratio
        resolvedPerRatioSettings[ratio] = null;
      } else if (perRatioConfig) {
        // Ratio has specific settings
        let ratioFilePath = mainWatermark.filePath;
        let ratioWidth = mainWatermark.width;
        let ratioHeight = mainWatermark.height;

        // If this ratio has a different watermark, resolve its file info
        const ratioWatermarkId = perRatioConfig.watermarkId;
        if (ratioWatermarkId && ratioWatermarkId !== settings.watermarkId) {
          const ratioWatermark = await resolveWatermarkById(ratioWatermarkId);
          if (ratioWatermark) {
            ratioFilePath = ratioWatermark.filePath;
            ratioWidth = ratioWatermark.width;
            ratioHeight = ratioWatermark.height;
            console.log(`[ExportTab] Using different watermark for ${ratio}:`, ratioWatermarkId);
          } else {
            console.warn(`[ExportTab] Failed to resolve per-ratio watermark for ${ratio}:`, ratioWatermarkId);
          }
        }

        // Use per-ratio position if available, otherwise fall back to default
        const position = perRatioConfig.position || {
          x: settings.positionX ?? 12,
          y: settings.positionY ?? 92,
          opacity: settings.opacity ?? 80,
          scale: settings.scale ?? 20,
        };

        resolvedPerRatioSettings[ratio] = {
          watermarkId: ratioWatermarkId || settings.watermarkId,
          filePath: ratioFilePath,
          width: ratioWidth,
          height: ratioHeight,
          position,
        };
      } else {
        // No per-ratio config, use default watermark with default position
        resolvedPerRatioSettings[ratio] = {
          watermarkId: settings.watermarkId,
          filePath: mainWatermark.filePath,
          width: mainWatermark.width,
          height: mainWatermark.height,
          position: {
            x: settings.positionX ?? 12,
            y: settings.positionY ?? 92,
            opacity: settings.opacity ?? 80,
            scale: settings.scale ?? 20,
          },
        };
      }
    }

    return {
      enabled: true,
      watermarkId: settings.watermarkId,
      filePath: mainWatermark.filePath,
      width: mainWatermark.width,
      height: mainWatermark.height,
      positionX: settings.positionX ?? 12,
      positionY: settings.positionY ?? 92,
      opacity: settings.opacity ?? 80,
      scale: settings.scale ?? 20,
      perRatioSettings: resolvedPerRatioSettings,
    };
  }

  interface AppliedIntroOutro {
    id: string;
    sourceId: string;
    name: string;
    duration: number | null;
    filePath: string;
    thumbnailUrl?: string;
    // Org asset properties (for on-demand downloading)
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string;
    organization_id?: string;
    organization_name?: string;
    created_at?: string;
    updated_at?: string;
  }

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
    // Editor mode props
    editorMode?: boolean;
    videoSources?: VideoEditorSource[];
    editorProjectId?: string | null;
    editorProjectName?: string;
    currentIntro?: AppliedIntroOutro | null;
    currentOutro?: AppliedIntroOutro | null;
    // Creator profile watermark settings
    creatorProfileWatermarkSettings?: any | null;
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
        return { width: '6px', height: '10px' };
      case '4:5':
        return { width: '8px', height: '10px' };
      case '1:1':
        return { width: '9px', height: '9px' };
      default:
        return { width: '10px', height: '6px' };
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

  // Methods
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
    // In editor mode, we need editorProjectId; in clip mode, we need clipId and projectId
    if (props.editorMode) {
      if (!props.editorProjectId || isBuilding.value) return;
    } else {
      if (!props.clipId || !props.projectId || isBuilding.value) return;
    }

    try {
      isBuilding.value = true;
      buildProgress.value = 0;
      emit('buildStarted');

      const { updateClipBuildStatus, createClipBuild } = await import('@/services/database');

      // For clip mode, update database status
      if (!props.editorMode) {
        await updateClipBuildStatus(props.clipId, 'building', { progress: 0 });
      }

      // Create build record (use clipId for clip mode, editorProjectId for editor mode)
      const buildRecordId = props.editorMode ? props.editorProjectId! : props.clipId;
      const buildId = await createClipBuild(buildRecordId, {
        aspectRatios: effectiveAspectRatios.value,
        quality: quality.value,
        frameRate: frameRate.value,
        outputFormat: outputFormat.value,
        includeSubtitles: props.subtitleSettings?.enabled ?? false,
      });

      // Prepare common export data
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
      // Map frontend 'filePath' to backend 'watermarkPath' (which becomes watermark_path in Rust)
      const clipWatermarksForExport =
        props.watermarks?.map((wm) => ({
          id: wm.id,
          watermarkId: wm.watermarkId,
          watermarkPath: wm.filePath, // Backend expects 'watermarkPath', we store as 'filePath' in frontend
          startTime: wm.startTime,
          endTime: wm.endTime,
          positionX: wm.position?.x ?? 8,
          positionY: wm.position?.y ?? 92,
          scale: wm.scale ?? 15,
          opacity: wm.opacity ?? 80,
          perRatioConfigs: wm.perRatioConfigs ?? null,
        })) ?? null;

      // Determine framing strategy
      // FramingStrategy is a complex struct - pass null to let backend handle detection
      // Manual configs are passed separately via manualFramingConfigs parameter
      const framingStrategy = null;

      // Resolve creator profile watermark settings with file paths
      // This ensures org watermarks are downloaded and file paths are resolved for the Rust backend
      const resolvedWatermarkSettings = props.creatorProfileWatermarkSettings
        ? await resolveCreatorWatermarkSettings(props.creatorProfileWatermarkSettings)
        : null;

      if (props.editorMode && props.videoSources && props.videoSources.length > 0) {
        // Editor mode: build from video sources
        await handleEditorModeExport(
          buildId,
          audioSettings,
          videoFilterSegments,
          textOverlaysForExport,
          stickersForExport,
          clipWatermarksForExport,
          framingStrategy,
          resolvedWatermarkSettings
        );
      } else {
        // Clip mode: use the original segment-based approach
        await handleClipModeExport(
          buildId,
          audioSettings,
          videoFilterSegments,
          textOverlaysForExport,
          stickersForExport,
          clipWatermarksForExport,
          framingStrategy,
          resolvedWatermarkSettings
        );
      }

      console.log('[ExportTab] Build started successfully');
    } catch (error) {
      console.error('[ExportTab] Failed to start build:', error);
      isBuilding.value = false;
      emit('buildFailed', String(error));
    }
  }

  // Handle clip mode export (single video source with segments)
  async function handleClipModeExport(
    buildId: string,
    audioSettings: any,
    videoFilterSegments: any,
    textOverlaysForExport: any,
    stickersForExport: any,
    clipWatermarksForExport: any,
    framingStrategy: string,
    resolvedWatermarkSettings: any | null
  ) {
    const { getRawVideosByProjectId } = await import('@/services/database');

    // Get the project video file path
    const rawVideos = await getRawVideosByProjectId(props.projectId!);
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

    // Handle org assets: download on-demand if current intro/outro is an org asset
    let introPath = props.currentIntro?.filePath ?? null;
    let outroPath = props.currentOutro?.filePath ?? null;
    const introDuration = props.currentIntro?.duration ?? null;
    const outroDuration = props.currentOutro?.duration ?? null;

    // Download org intro if needed
    if (props.currentIntro?.isOrgAsset && props.currentIntro.serverId) {
      console.log('[ExportTab] Downloading org intro asset on-demand:', props.currentIntro.name);
      const introResult = await ensureAssetDownloaded({
        id: props.currentIntro.serverId,
        name: props.currentIntro.name,
        asset_type: 'intro',
        url: props.currentIntro.serverUrl || props.currentIntro.filePath,
        organization_id: Number(props.currentIntro.organization_id),
        organization_name: props.currentIntro.organization_name || undefined,
        duration: props.currentIntro.duration || undefined,
        thumbnail_url: props.currentIntro.thumbnailUrl || undefined,
        inserted_at: props.currentIntro.created_at,
        updated_at: props.currentIntro.updated_at,
      } as ServerOrganizationAsset);

      if (introResult.success && introResult.filePath) {
        introPath = introResult.filePath;
        console.log('[ExportTab] Org intro downloaded to:', introPath);
      } else {
        throw new Error(`Failed to download intro asset: ${introResult.error || 'Unknown error'}`);
      }
    }

    // Download org outro if needed
    if (props.currentOutro?.isOrgAsset && props.currentOutro.serverId) {
      console.log('[ExportTab] Downloading org outro asset on-demand:', props.currentOutro.name);
      const outroResult = await ensureAssetDownloaded({
        id: props.currentOutro.serverId,
        name: props.currentOutro.name,
        asset_type: 'outro',
        url: props.currentOutro.serverUrl || props.currentOutro.filePath,
        organization_id: Number(props.currentOutro.organization_id),
        organization_name: props.currentOutro.organization_name || undefined,
        duration: props.currentOutro.duration || undefined,
        thumbnail_url: props.currentOutro.thumbnailUrl || undefined,
        inserted_at: props.currentOutro.created_at,
        updated_at: props.currentOutro.updated_at,
      } as ServerOrganizationAsset);

      if (outroResult.success && outroResult.filePath) {
        outroPath = outroResult.filePath;
        console.log('[ExportTab] Org outro downloaded to:', outroPath);
      } else {
        throw new Error(`Failed to download outro asset: ${outroResult.error || 'Unknown error'}`);
      }
    }

    // Build the clip
    await invoke('build_clip_from_segments', {
      projectId: props.projectId,
      clipId: props.clipId,
      clipName: props.clipName || 'Untitled',
      videoPath: projectVideo.file_path,
      segments: segments,
      subtitleSettings: subtitleSettingsWithDefaults,
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
      introPath: introPath,
      introDuration: introDuration,
      outroPath: outroPath,
      outroDuration: outroDuration,
      watermarkSettings: resolvedWatermarkSettings,
      audioSettings: audioSettings,
      framingStrategy: framingStrategy,
      manualFramingConfigs: props.framingConfigs || null,
      videoFilterSegments: videoFilterSegments,
      textOverlays: textOverlaysForExport,
      stickers: stickersForExport,
      clipWatermarks: clipWatermarksForExport,
    });
  }

  // Handle editor mode export (multiple video sources)
  async function handleEditorModeExport(
    buildId: string,
    audioSettings: any,
    videoFilterSegments: any,
    textOverlaysForExport: any,
    stickersForExport: any,
    clipWatermarksForExport: any,
    framingStrategy: string,
    resolvedWatermarkSettings: any | null
  ) {
    // In editor mode, video sources may come from different files
    // We need to:
    // 1. Identify intro/outro sources (they have special source names starting with [Intro] or [Outro])
    // 2. Group remaining sources and handle them

    const sources = props.videoSources || [];

    // Separate intro, outro, and main content sources
    let introSource: VideoEditorSource | null = null;
    let outroSource: VideoEditorSource | null = null;
    const mainSources: VideoEditorSource[] = [];

    for (const source of sources) {
      if (source.source_name?.startsWith('[Intro]')) {
        introSource = source;
      } else if (source.source_name?.startsWith('[Outro]')) {
        outroSource = source;
      } else {
        mainSources.push(source);
      }
    }

    // Sort main sources by start_time
    mainSources.sort((a, b) => a.start_time - b.start_time);

    // Check if all main sources are from the same video file
    const uniqueSourcePaths = [...new Set(mainSources.map((s) => s.source_path))];
    const isSingleSource = uniqueSourcePaths.length === 1;

    if (isSingleSource && mainSources.length > 0) {
      // All main content is from the same video file - use segment-based approach
      const videoPath = mainSources[0].source_path;

      // Convert video sources to segments
      const segments = mainSources.map((source) => ({
        id: source.id,
        start_time: source.trim_start,
        end_time: source.trim_end ?? source.trim_start + (source.end_time - source.start_time),
        duration: (source.trim_end ?? source.trim_start + (source.end_time - source.start_time)) - source.trim_start,
        transcript: null,
      }));

      // Get intro/outro paths
      const introPath = introSource?.source_path ?? null;
      const introDuration = introSource ? introSource.end_time - introSource.start_time : null;
      const outroPath = outroSource?.source_path ?? null;
      const outroDuration = outroSource ? outroSource.end_time - outroSource.start_time : null;

      // Ensure subtitle settings have all required fields with defaults
      const subtitleSettingsWithDefaults = props.subtitleSettings
        ? {
            positionPercentage: 15,
            textOffsetX: 0,
            textOffsetY: 0,
            letterSpacing: 0,
            wordSpacing: 0,
            padding: 10,
            borderRadius: 0,
            lineHeight: 1.2,
            maxWidth: 80,
            textAlign: 'center' as const,
            ...props.subtitleSettings,
          }
        : null;

      // Build using the existing segment-based command
      await invoke('build_clip_from_segments', {
        projectId: props.editorProjectId,
        clipId: props.editorProjectId, // Use project ID as clip ID for editor mode builds
        clipName: props.editorProjectName || 'Video Project',
        videoPath: videoPath,
        segments: segments,
        subtitleSettings: subtitleSettingsWithDefaults,
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
        introPath: introPath,
        introDuration: introDuration,
        outroPath: outroPath,
        outroDuration: outroDuration,
        watermarkSettings: resolvedWatermarkSettings,
        audioSettings: audioSettings,
        framingStrategy: framingStrategy,
        manualFramingConfigs: props.framingConfigs || null,
        videoFilterSegments: videoFilterSegments,
        textOverlays: textOverlaysForExport,
        stickers: stickersForExport,
        clipWatermarks: clipWatermarksForExport,
      });
    } else if (mainSources.length > 0) {
      // Multiple source files - need to handle concatenation
      // For now, we'll use a simplified approach: build from the first source
      // TODO: Implement proper multi-source concatenation in the backend
      console.warn('[ExportTab] Multiple source files detected - using first source only');

      const primarySource = mainSources[0];
      const videoPath = primarySource.source_path;

      const segments = [
        {
          id: primarySource.id,
          start_time: primarySource.trim_start,
          end_time:
            primarySource.trim_end ?? primarySource.trim_start + (primarySource.end_time - primarySource.start_time),
          duration:
            (primarySource.trim_end ?? primarySource.trim_start + (primarySource.end_time - primarySource.start_time)) -
            primarySource.trim_start,
          transcript: null,
        },
      ];

      const introPath = introSource?.source_path ?? null;
      const introDuration = introSource ? introSource.end_time - introSource.start_time : null;
      const outroPath = outroSource?.source_path ?? null;
      const outroDuration = outroSource ? outroSource.end_time - outroSource.start_time : null;

      // Ensure subtitle settings have all required fields with defaults
      const subtitleSettingsWithDefaults = props.subtitleSettings
        ? {
            positionPercentage: 15,
            textOffsetX: 0,
            textOffsetY: 0,
            letterSpacing: 0,
            wordSpacing: 0,
            padding: 10,
            borderRadius: 0,
            lineHeight: 1.2,
            maxWidth: 80,
            textAlign: 'center' as const,
            ...props.subtitleSettings,
          }
        : null;

      await invoke('build_clip_from_segments', {
        projectId: props.editorProjectId,
        clipId: props.editorProjectId,
        clipName: props.editorProjectName || 'Video Project',
        videoPath: videoPath,
        segments: segments,
        subtitleSettings: subtitleSettingsWithDefaults,
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
        introPath: introPath,
        introDuration: introDuration,
        outroPath: outroPath,
        outroDuration: outroDuration,
        watermarkSettings: resolvedWatermarkSettings,
        audioSettings: audioSettings,
        framingStrategy: framingStrategy,
        manualFramingConfigs: props.framingConfigs || null,
        videoFilterSegments: videoFilterSegments,
        textOverlays: textOverlaysForExport,
        stickers: stickersForExport,
        clipWatermarks: clipWatermarksForExport,
      });
    } else {
      throw new Error('No video sources to export');
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

  // Save exported video to user-selected location
  async function saveVideoToLocation(sourcePath: string, defaultFilename: string) {
    try {
      console.log('[ExportTab] Opening save dialog for:', sourcePath);

      // Show save file dialog
      const savePath = await save({
        title: 'Save Exported Video',
        defaultPath: defaultFilename,
        filters: [
          {
            name: 'Video Files',
            extensions: ['mp4', 'mov'],
          },
        ],
      });

      if (savePath) {
        console.log('[ExportTab] Copying video to:', savePath);

        // Use invoke to call a Rust command to copy the file
        try {
          await invoke('copy_file', {
            source: sourcePath,
            destination: savePath,
          });
          alert(`Video saved successfully to:\n${savePath}`);
        } catch (copyError) {
          console.error('[ExportTab] Copy failed:', copyError);
          alert(`Failed to copy video: ${copyError}`);
        }
      }
    } catch (error) {
      console.error('[ExportTab] Failed to save video:', error);
      alert(`Failed to show save dialog: ${error}`);
    }
  }

  // Setup event listeners
  async function setupEventListeners() {
    // Listen for build progress
    unlistenProgress = await listen<{ clipId: string; clip_id?: string; progress: number }>(
      'clip-build-progress',
      (event) => {
        console.log('[ExportTab] Received clip-build-progress event:', event.payload);

        // Support both camelCase and snake_case
        const eventClipId = event.payload.clipId || event.payload.clip_id;

        if (eventClipId === props.clipId) {
          console.log('[ExportTab] Progress update:', event.payload.progress, '%');
          buildProgress.value = event.payload.progress;
        }
      }
    );

    // Listen for build completion
    unlistenComplete = await listen<{ clipId: string; clip_id?: string; buildId?: string; build_id?: string }>(
      'clip-build-complete',
      (event) => {
        console.log('[ExportTab] Received clip-build-complete event:', event.payload);
        console.log('[ExportTab] Current clipId prop:', props.clipId);

        // Support both camelCase and snake_case
        const eventClipId = event.payload.clipId || event.payload.clip_id;
        const eventBuildId = event.payload.buildId || event.payload.build_id;

        if (eventClipId === props.clipId) {
          console.log('[ExportTab] ClipId matches! Setting build complete.');
          isBuilding.value = false;
          buildProgress.value = 100;
          loadBuilds();
          emit('buildCompleted', eventBuildId || '');
        } else {
          console.log('[ExportTab] ClipId mismatch:', eventClipId, '!==', props.clipId);
        }
      }
    );

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
    await setupEventListeners();
  });

  onUnmounted(() => {
    unlistenProgress?.();
    unlistenComplete?.();
    unlistenError?.();
  });
</script>
