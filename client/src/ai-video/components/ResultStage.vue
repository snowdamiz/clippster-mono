<script setup lang="ts">
  /** The finished video: chat for changes, the player (optionally beside the example), export, and the timeline editor. */
  import { computed, nextTick, ref, watch } from 'vue';
  import { convertFileSrc, invoke } from '@tauri-apps/api/core';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { Pause, Play } from 'lucide-vue-next';
  import ChatChip from '@/components/create/chat/ChatChip.vue';
  import ChatMessage from '@/components/create/chat/ChatMessage.vue';
  import ChatTypingIndicator from '@/components/create/chat/ChatTypingIndicator.vue';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { SectionCard } from '@/components/ui/section-card';
  import { Switch } from '@/components/ui/switch';
  import type { AIChatMessage } from '@/types/ai-chat';
  import { songBeats } from '../analysis/sources';
  import { placeShots } from '../compiler/compile';
  import { exampleCutTimes, exampleTimeAt } from '../director/edits';
  import { formatClock, plural } from '../format';
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
    policy,
    running,
    pendingMessage,
    previewUrl,
    previewError,
    revision,
    history,
    exportState,
    ...project
  } = useProject();

  const player = ref<InstanceType<typeof HyperframesPlayer> | null>(null);
  const exampleVideo = ref<HTMLVideoElement | null>(null);
  const chatList = ref<HTMLElement | null>(null);
  const time = ref(0);
  const playing = ref(false);
  const selected = ref<string | null>(null);
  const timelineOpen = ref(false);
  const compare = ref(false);
  const showCuts = ref(true);
  const draft = ref('');
  const beats = ref<number[]>([]);
  const peaks = ref<number[]>([]);

  const document = computed(() => edit.value!);
  const total = computed(() => {
    const placed = placeShots(document.value);
    return placed[placed.length - 1]?.end ?? 0;
  });
  const reference = computed(() => session.value?.reference ?? null);
  const exampleSrc = computed(() => (reference.value ? convertFileSrc(reference.value.path) : null));
  const cutTimes = computed(() => exampleCutTimes(document.value, blueprint.value));
  const busy = computed(() => !!running.value);
  const exporting = computed(() => !!exportState.value && !exportState.value.path && !exportState.value.error);

  const formatLabel = computed(() => {
    const { width, height } = document.value.format;
    const divisor = gcd(width, height);
    const ratio = `${width / divisor}:${height / divisor}`;
    return `${plural(Math.round(total.value), 'second')}, ${['16:9', '9:16', '1:1', '4:5'].includes(ratio) ? ratio : `${width}×${height}`}`;
  });

  const messages = computed((): AIChatMessage[] => {
    const list: AIChatMessage[] = [...(session.value?.messages ?? [])];
    if (pendingMessage.value) list.push({ id: -1, role: 'user', content: pendingMessage.value, metadata: null, inserted_at: new Date().toISOString() });
    return list;
  });

  const suggestions = computed(() => {
    const title = document.value.overlays.find((overlay) => overlay.lane === 'text');
    return [
      'Make the intro faster',
      title ? `Change "${title.label}" to something punchier` : 'Add a bold title at the start',
      song.value ? 'Make the cuts hit the beat harder' : 'Use a different shot before the ending',
    ];
  });

  const savedLabel = computed(() => {
    const path = exportState.value?.path;
    return path ? path.split(/[\\/]/).slice(-2).join('/') : '';
  });

  function gcd(a: number, b: number): number {
    return b ? gcd(b, a % b) : a;
  }

  // -- Chat -----------------------------------------------------------------------------

  function send(text: string) {
    const message = text.trim();
    if (!message || busy.value) return;
    draft.value = '';
    void project.revise(message);
  }

  watch(
    () => messages.value.length + (busy.value ? 1 : 0),
    () => nextTick(() => chatList.value?.scrollTo({ top: chatList.value.scrollHeight, behavior: 'smooth' })),
    { immediate: true }
  );

  // -- Playback -------------------------------------------------------------------------

  function togglePlay() {
    if (playing.value) player.value?.pause();
    else player.value?.play();
  }

  function seek(target: number) {
    time.value = Math.min(Math.max(0, target), Math.max(0, total.value - 0.01));
    player.value?.seek(time.value);
  }

  function scrub(event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    seek(((event.clientX - rect.left) / rect.width) * total.value);
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
    () => [timelineOpen.value, document.value.music?.mediaId, document.value.music?.start, total.value] as const,
    async ([open]) => {
      const track = document.value.music;
      const item = track ? media.value.find((entry) => entry.id === track.mediaId) : undefined;
      if (!open || !track || !item) {
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
      if (selected.value && !next.shots.some((shot) => shot.id === selected.value) && !next.overlays.some((overlay) => overlay.id === selected.value)) {
        selected.value = null;
      }
    }
  );
</script>

<template>
  <div class="grid w-full grid-cols-[300px_minmax(0,1fr)] items-start gap-4 p-4">
    <div class="flex min-h-[560px] flex-col rounded-lg border border-line-subtle">
      <div class="border-b border-line-subtle px-3 py-2">
        <span class="text-xs font-semibold text-fg">Chat</span>
      </div>
      <div ref="chatList" class="flex max-h-[520px] flex-1 flex-col gap-2 overflow-y-auto p-3">
        <ChatMessage v-for="message in messages" :key="message.id" :message="message" />
        <div v-if="running === 'revise'" class="flex items-center gap-2">
          <ChatTypingIndicator label="Working on it..." />
          <Button variant="link" size="xs" @click="project.cancel()">Cancel</Button>
        </div>
      </div>
      <div class="flex flex-col gap-2 border-t border-line-subtle p-3">
        <div class="flex flex-wrap gap-1.5">
          <ChatChip v-for="suggestion in suggestions" :key="suggestion" :label="suggestion" interactive :disabled="busy" @click="send(suggestion)" />
        </div>
        <form class="flex gap-1.5" @submit.prevent="send(draft)">
          <Input v-model="draft" placeholder="Tell it what to change" class="flex-1" :disabled="busy" />
          <Button type="submit" variant="primary" :disabled="busy || !draft.trim()">Send</Button>
        </form>
        <span v-if="policy" class="text-2xs text-fg-subtle">Each change uses {{ policy.credits.revise }} credits.</span>
      </div>
    </div>

    <div class="flex min-w-0 flex-col gap-3">
      <div class="flex items-center gap-2.5">
        <span class="truncate text-sm font-semibold text-fg">{{ document.title }}</span>
        <span class="shrink-0 text-xs text-fg-subtle">{{ formatLabel }}</span>
        <div class="ml-auto flex items-center gap-1.5">
          <template v-if="exampleSrc">
            <span class="text-xs text-fg-muted">Compare with example</span>
            <Switch v-model="compare" aria-label="Compare with example" />
          </template>
        </div>
        <Button variant="ghost" :disabled="!history.length || busy" @click="project.undo()">Undo</Button>
        <Button variant="primary" :disabled="busy || exporting" @click="project.exportVideo()">Export</Button>
      </div>

      <Alert v-if="exportState" :variant="exportState.error ? 'destructive' : exportState.path ? 'success' : 'info'">
        <AlertTitle>
          {{ exportState.error ? 'The export failed' : exportState.path ? `Saved to ${savedLabel}` : `Exporting... ${exportState.progress}%` }}
        </AlertTitle>
        <AlertDescription class="flex items-center gap-2">
          <template v-if="exportState.error">{{ exportState.error }}</template>
          <template v-else-if="exportState.path">
            Your video is ready to post.
            <Button variant="link" size="xs" @click="revealItemInDir(exportState.path)">Show in folder</Button>
          </template>
          <template v-else>You can keep editing while it exports.</template>
        </AlertDescription>
      </Alert>

      <div :class="compare && exampleSrc ? 'grid grid-cols-2 gap-2.5' : ''">
        <div v-if="compare && exampleSrc" class="relative aspect-video overflow-hidden rounded-lg border border-line bg-black">
          <video ref="exampleVideo" :src="exampleSrc" muted preload="auto" class="size-full object-contain" />
          <Badge variant="brand" size="md" class="absolute left-2.5 top-2">Example</Badge>
        </div>
        <div
          class="relative overflow-hidden rounded-lg border border-line bg-black"
          :style="{ aspectRatio: `${document.format.width} / ${document.format.height}` }"
          :class="!compare && document.format.height > document.format.width && 'mx-auto max-h-[60vh]'"
        >
          <HyperframesPlayer
            v-if="previewUrl"
            ref="player"
            :src="previewUrl"
            :revision="revision"
            @ready="onReady"
            @timeupdate="(t) => (time = t)"
            @playing="(value) => (playing = value)"
            @error="(message) => (previewError = message)"
          />
          <div v-if="previewError" class="absolute inset-0 grid place-items-center p-6 text-center">
            <div class="flex flex-col items-center gap-2">
              <span class="text-sm text-fg-muted">{{ previewError }}</span>
              <Button variant="secondary" size="sm" @click="project.retryPreview()">Try again</Button>
            </div>
          </div>
          <Badge v-if="compare && exampleSrc" variant="brand" size="md" class="absolute left-2.5 top-2">Yours</Badge>
        </div>
      </div>

      <div class="flex items-center gap-2.5">
        <Button variant="secondary" size="icon" class="rounded-full" :title="playing ? 'Pause' : 'Play'" :aria-label="playing ? 'Pause' : 'Play'" @click="togglePlay">
          <component :is="playing ? Pause : Play" />
        </Button>
        <span class="tabular w-[86px] shrink-0 text-xs text-fg-muted">{{ formatClock(time) }} / {{ formatClock(total) }}</span>
        <div class="relative h-1.5 flex-1 cursor-pointer rounded-full bg-surface-active" @click="scrub">
          <div class="absolute inset-y-0 left-0 rounded-full bg-brand" :style="{ width: `${total ? (time / total) * 100 : 0}%` }" />
        </div>
        <Button :variant="timelineOpen ? 'secondary' : 'ghost'" @click="timelineOpen = !timelineOpen">
          {{ timelineOpen ? 'Hide timeline' : 'Edit timeline' }}
        </Button>
      </div>

      <div v-if="timelineOpen" class="grid grid-cols-[minmax(0,1fr)_250px] items-start gap-3">
        <div class="flex min-w-0 flex-col gap-2">
          <div class="flex items-center gap-2">
            <span class="text-xs text-fg-subtle">
              <template v-if="song && document.music">Ticks on the ruler are your song's beats. </template>Dashed lines are the example's cuts.
            </span>
            <span class="ml-auto shrink-0 text-xs text-fg-muted">Show example cuts</span>
            <Switch v-model="showCuts" aria-label="Show example cuts" />
          </div>
          <EditTimeline
            :document="document"
            :media="media"
            :time="time"
            :selected="selected"
            :show-cuts="showCuts"
            :cut-times="cutTimes"
            :beats="beats"
            :peaks="peaks"
            @select="(id) => (selected = id)"
            @seek="seek"
          />
        </div>
        <SectionCard title="Selected">
          <ShotInspector
            :document="document"
            :media="media"
            :selected="selected"
            @apply="(next) => project.applyEdit(next)"
            @text="(overlayId, next) => project.editText(overlayId, next)"
            @deselect="selected = null"
          />
        </SectionCard>
      </div>
    </div>
  </div>
</template>
