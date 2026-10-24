<script setup lang="ts">
  /** The finished video: the player (optionally beside the example), export status, and the timeline editor. */
  import { computed, ref, watch } from 'vue';
  import { useElementSize } from '@vueuse/core';
  import { convertFileSrc, invoke } from '@tauri-apps/api/core';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Switch } from '@/components/ui/switch';
  import { songBeats } from '../analysis/sources';
  import { placeShots } from '../compiler/compile';
  import { findSceneText } from '../director/sceneText';
  import { layerId, type SceneInventory } from '../director/sceneLayers';
  import { ASPECT_RATIOS } from '../director/aspect';
  import { exampleCutTimes, exampleTimeAt } from '../director/edits';
  import { plural } from '../format';
  import { useProject } from '../projectContext';
  import EditTimeline from './EditTimeline.vue';
  import HyperframesPlayer from './HyperframesPlayer.vue';
  import ShotInspector from './ShotInspector.vue';

  const BAR_SPACING = 4;
  const PX_PER_SECOND = 22;

  const {
    session,
    document: edit,
    blueprint,
    media,
    song,
    running,
    previewUrl,
    previewError,
    revision,
    history,
    policy,
    exportState,
    ...project
  } = useProject();

  const player = ref<InstanceType<typeof HyperframesPlayer> | null>(null);
  const exampleVideo = ref<HTMLVideoElement | null>(null);
  const time = ref(0);
  const playing = ref(false);
  const selected = ref<string | null>(null);
  const inventories = ref<SceneInventory[]>([]);
  const selectedLayer = computed(() => {
    for (const inventory of inventories.value) {
      const layer = inventory.layers.find((layer) => layerId(inventory.owner, layer.key) === selected.value);
      if (layer) return { owner: inventory.owner, key: layer.key };
    }
    return null;
  });
  function onLayers(inventory: SceneInventory) {
    inventories.value = [...inventories.value.filter((item) => item.owner !== inventory.owner), inventory];
  }
  const previewArea = ref<HTMLDivElement | null>(null);
  const { width: previewWidth, height: previewHeight } = useElementSize(previewArea);
  const compare = ref(false);
  const showCuts = ref(true);
  const beats = ref<number[]>([]);
  const peaks = ref<number[]>([]);

  const document = computed(() => edit.value!);
  const compositionFiles = computed(() => session.value?.composition_files ?? {});
  const total = computed(() => {
    const placed = placeShots(document.value);
    return placed[placed.length - 1]?.end ?? 0;
  });
  const reference = computed(() => session.value?.reference ?? null);
  const exampleSrc = computed(() => (reference.value ? convertFileSrc(reference.value.path) : null));
  const cutTimes = computed(() => exampleCutTimes(document.value, blueprint.value));
  const busy = computed(() => !!running.value);
  const previewStyle = computed(() => {
    const ratio = document.value.format.width / document.value.format.height;
    const availableWidth = compare.value && exampleSrc.value ? (previewWidth.value - 12) / 2 : previewWidth.value;
    const width = Math.max(0, Math.min(availableWidth, previewHeight.value * ratio));
    return { width: `${width}px`, height: `${width / ratio}px` };
  });

  const formatLabel = computed(() => {
    const { width, height } = document.value.format;
    const divisor = gcd(width, height);
    const ratio = `${width / divisor}:${height / divisor}`;
    return `${plural(Math.round(total.value), 'second')}, ${(ASPECT_RATIOS as readonly string[]).includes(ratio) ? ratio : `${width}×${height}`}`;
  });

  const savedLabel = computed(() => {
    const path = exportState.value?.path;
    return path ? path.split(/[\\/]/).slice(-2).join('/') : '';
  });

  function gcd(a: number, b: number): number {
    return b ? gcd(b, a % b) : a;
  }

  // -- Playback -------------------------------------------------------------------------

  function togglePlay() {
    if (playing.value) player.value?.pause();
    else player.value?.play();
  }

  function seek(target: number) {
    time.value = Math.min(Math.max(0, target), Math.max(0, total.value - 0.01));
    player.value?.seek(time.value);
  }

  function onReady() {
    if (time.value > 0) player.value?.seek(time.value);
  }

  watch([time, playing, compare], () => {
    const video = exampleVideo.value;
    if (!compare.value || !video) return;
    const target = exampleTimeAt(document.value, blueprint.value, time.value);
    if (target === null) {
      video.pause();
      return;
    }
    if (Math.abs(video.currentTime - target) > 0.3) video.currentTime = target;
    if (playing.value && video.paused) void video.play().catch(() => {});
    if (!playing.value && !video.paused) video.pause();
  });

  // -- Timeline -------------------------------------------------------------------------

  watch(
    () => [document.value.music?.mediaId, document.value.music?.start, total.value] as const,
    async () => {
      const track = document.value.music;
      const item = track ? media.value.find((entry) => entry.id === track.mediaId) : undefined;
      if (!track || !item) {
        beats.value = [];
        peaks.value = [];
        return;
      }
      const seconds = Math.min(total.value, Math.max(0, item.duration - track.start));
      const bars = Math.max(1, Math.floor((seconds * PX_PER_SECOND) / BAR_SPACING));
      const [grid, waveform] = await Promise.all([
        songBeats(item),
        invoke<Array<{ min: number; max: number }>>('extract_audio_peaks_for_range', {
          videoPath: item.path,
          startTime: track.start,
          duration: seconds,
          numPeaks: bars,
        }).catch(() => []),
      ]);
      beats.value = (grid?.beats ?? []).map((beat) => beat.time - track.start);
      const amplitudes = waveform.map((peak) => Math.max(Math.abs(peak.min), Math.abs(peak.max)));
      const loudest = Math.max(...amplitudes, 0);
      peaks.value = loudest > 0 ? amplitudes.map((amplitude) => amplitude / loudest) : [];
    },
    { immediate: true }
  );

  watch(
    () => document.value,
    (next) => {
      if (
        selected.value &&
        !next.shots.some((shot) => shot.id === selected.value) &&
        !next.overlays.some((overlay) => overlay.id === selected.value) &&
        !findSceneText(next, selected.value, compositionFiles.value) &&
        !inventories.value.some((item) =>
          item.layers.some((layer) => layerId(item.owner, layer.key) === selected.value)
        ) &&
        !next.shots.some((shot) => `transition:${shot.id}` === selected.value) &&
        selected.value !== `music:${next.music?.mediaId}`
      ) {
        selected.value = null;
      }
    }
  );
</script>

<template>
  <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
    <div class="flex h-10 shrink-0 items-center gap-2 border-b border-line-subtle px-3">
      <span class="truncate text-xs font-semibold text-fg">{{ document.title }}</span>
      <span class="shrink-0 text-xs text-fg-subtle">{{ formatLabel }}</span>
      <div v-if="exampleSrc" class="ml-auto flex items-center gap-2">
        <span class="text-xs text-fg-muted">Compare</span>
        <Switch v-model="compare" aria-label="Compare with example" />
      </div>
    </div>
    <Alert
      v-if="exportState"
      class="shrink-0 rounded-none border-x-0 border-t-0"
      :variant="exportState.error ? 'destructive' : exportState.path ? 'success' : 'info'"
    >
      <AlertTitle>
        {{
          exportState.error
            ? 'The export failed'
            : exportState.path
              ? `Saved to ${savedLabel}`
              : `Exporting... ${exportState.progress}%`
        }}
      </AlertTitle>
      <AlertDescription>
        <template v-if="exportState.error">{{ exportState.error }}</template>
        <Button v-else-if="exportState.path" variant="link" size="xs" @click="revealItemInDir(exportState.path)">
          Show in folder
        </Button>
        <template v-else>You can keep editing while it exports.</template>
      </AlertDescription>
    </Alert>
    <div class="flex min-h-0 flex-1 overflow-hidden">
      <div
        ref="previewArea"
        class="flex min-h-0 min-w-0 flex-1 items-center justify-center gap-3 overflow-hidden bg-canvas"
      >
        <div v-if="compare && exampleSrc" class="relative shrink-0 overflow-hidden bg-black" :style="previewStyle">
          <video ref="exampleVideo" :src="exampleSrc" muted preload="auto" class="size-full object-contain" />
          <Badge variant="brand" class="absolute left-2 top-2">Example</Badge>
        </div>
        <div class="relative shrink-0 overflow-hidden bg-black" :style="previewStyle">
          <HyperframesPlayer
            v-if="previewUrl"
            ref="player"
            :src="previewUrl"
            :revision="revision"
            :selected-layer="selectedLayer"
            @select-layer="({ owner, key }) => (selected = layerId(owner, key))"
            @ready="onReady"
            @layers="onLayers"
            @timeupdate="(t) => (time = t)"
            @playing="(value) => (playing = value)"
            @error="(message) => (previewError = message)"
          />
          <div v-if="previewError" class="absolute inset-0 grid place-items-center p-4 text-center">
            <div>
              <p class="text-sm text-fg-muted">{{ previewError }}</p>
              <Button variant="secondary" size="sm" @click="project.retryPreview()">Try again</Button>
            </div>
          </div>
          <Badge v-if="compare && exampleSrc" variant="brand" class="absolute left-2 top-2">Yours</Badge>
        </div>
      </div>
      <aside class="w-[240px] shrink-0 overflow-y-auto border-l border-line-subtle bg-panel">
        <div class="flex h-10 items-center border-b border-line-subtle px-3 text-xs font-semibold text-fg">
          Properties
        </div>
        <fieldset class="min-w-0 p-3" :disabled="busy">
          <ShotInspector
            :document="document"
            :media="media"
            :files="compositionFiles"
            :selected="selected"
            :inventories="inventories"
            :max-seconds="policy?.max_output_seconds ?? 60"
            @apply="(next) => project.applyEdit(next)"
            @text="(blockId, next) => project.editText(blockId, next)"
            @deselect="selected = null"
            @composition="(path, source) => project.applyComposition(path, source)"
          />
        </fieldset>
      </aside>
    </div>
    <Teleport to="#ai-video-timeline" defer>
      <EditTimeline
        :document="document"
        :media="media"
        :files="compositionFiles"
        :inventories="inventories"
        :time="time"
        :playing="playing"
        :can-undo="!!history.length"
        :busy="busy"
        :max-seconds="policy?.max_output_seconds ?? 60"
        :selected="selected"
        :show-cuts="showCuts"
        :cut-times="cutTimes"
        :beats="beats"
        :peaks="peaks"
        @select="(id) => (selected = id)"
        @seek="seek"
        @play="togglePlay"
        @undo="project.undo()"
        @apply="(next) => project.applyEdit(next)"
      >
        <template v-if="cutTimes.length" #controls>
          <span class="text-xs text-fg-subtle">Example cuts</span>
          <Switch v-model="showCuts" aria-label="Show example cuts" />
        </template>
      </EditTimeline>
    </Teleport>
  </div>
</template>
