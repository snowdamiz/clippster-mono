<script setup lang="ts">
  /**
   * Floating app-level player, collapsed outside audio pages.
   * The parent owns playback state; this component only renders and emits.
   */
  import { computed, ref, watch, onBeforeUnmount, nextTick } from 'vue';
  import { useRoute } from 'vue-router';
  import {
    Music,
    Pause,
    Play,
    Repeat,
    RotateCcw,
    ChevronUp,
    Shuffle,
    SkipBack,
    SkipForward,
    Volume,
    Volume1,
    Volume2,
    VolumeX,
    X,
  } from 'lucide-vue-next';
  import { useSidebarState } from '@/composables/useSidebarState';

  const props = withDefaults(
    defineProps<{
      title: string;
      isPlaying: boolean;
      /** 0–100 */
      progress: number;
      currentTimeLabel: string;
      durationLabel: string;
      /** 0–1 */
      volume: number;
      muted: boolean;
      shuffle?: boolean;
      repeatMode?: 'off' | 'all' | 'one';
      hasPrevious?: boolean;
      hasNext?: boolean;
      /** Show previous/next/shuffle/repeat. */
      queueControls?: boolean;
      closeLabel?: string;
    }>(),
    {
      shuffle: false,
      repeatMode: 'off',
      hasPrevious: false,
      hasNext: false,
      queueControls: true,
      closeLabel: 'Close player',
    }
  );

  const emit = defineEmits<{
    'toggle-play': [];
    previous: [];
    next: [];
    'toggle-shuffle': [];
    'toggle-repeat': [];
    'toggle-mute': [];
    volume: [value: number];
    /** Seek to a fraction (0–1) of the track. */
    seek: [fraction: number];
    restart: [];
    close: [];
  }>();

  // Center the bar over the content panel (right of the sidebar) on dashboard routes.
  const route = useRoute();
  const { isCollapsed } = useSidebarState();
  const leftOffset = computed(() => {
    const inDashboard = route.matched.length > 1 && !route.meta?.noLayout;
    if (!inDashboard) return '0px';
    return isCollapsed.value ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)';
  });

  const repeatTitle = computed(() =>
    props.repeatMode === 'off' ? 'Repeat: off' : props.repeatMode === 'all' ? 'Repeat: all' : 'Repeat: one'
  );
  const repeatLabel = computed(() => (props.repeatMode === 'one' ? '1' : props.repeatMode === 'all' ? 'All' : 'Off'));
  const onAudioPage = computed(() =>
    route.matched.some((record) => record.path === '/audio-library' || record.path === '/download-audio')
  );
  const revealed = ref(false);
  const expanded = computed(() => onAudioPage.value || revealed.value);
  const player = ref<HTMLElement | null>(null);
  const playButton = ref<HTMLButtonElement | null>(null);
  const hovering = ref(false);
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  function cancelHide() {
    clearTimeout(hideTimer);
  }
  function reveal() {
    cancelHide();
    revealed.value = true;
    scheduleHide();
  }
  function scheduleHide() {
    cancelHide();
    hideTimer = setTimeout(() => {
      if (!hovering.value && !dragging.value && !player.value?.contains(document.activeElement)) revealed.value = false;
    }, 600);
  }
  async function openFromHandle() {
    reveal();
    await nextTick();
    playButton.value?.focus();
  }
  watch(
    () => route.fullPath,
    () => {
      cancelHide();
      revealed.value = false;
      hovering.value = false;
    }
  );

  const track = ref<HTMLElement | null>(null);
  const dragging = ref(false);
  let stopSeeking: (() => void) | undefined;
  onBeforeUnmount(() => {
    stopSeeking?.();
    cancelHide();
  });

  function fractionAt(clientX: number) {
    const rect = track.value?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function startSeek(event: MouseEvent) {
    stopSeeking?.();
    event.preventDefault();
    dragging.value = true;
    emit('seek', fractionAt(event.clientX));
    const move = (e: MouseEvent) => emit('seek', fractionAt(e.clientX));
    const up = () => {
      dragging.value = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      stopSeeking = undefined;
      scheduleHide();
    };
    stopSeeking = up;
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  function onVolume(event: Event) {
    emit('volume', parseInt((event.target as HTMLInputElement).value) / 100);
  }

  const iconBtn =
    'grid size-7 shrink-0 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] [&_svg]:size-3.5';
</script>

<template>
  <div
    class="audio-player-bar pointer-events-none fixed bottom-[calc(var(--panel-inset)+0.25rem)] right-[var(--panel-inset)] z-[1000] flex justify-center px-4"
    :style="{ left: leftOffset }"
  >
    <button
      v-if="!expanded"
      type="button"
      class="pointer-events-auto flex h-[26px] items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2.5 text-[11px] text-fg shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
      aria-label="Show audio player"
      :aria-expanded="expanded"
      @mouseenter="reveal"
      @click="openFromHandle"
    >
      <Music class="size-3 text-brand" />
      {{ isPlaying ? 'Playing' : 'Paused' }}
      <ChevronUp class="size-3 text-fg-muted" />
    </button>
    <div
      v-else
      ref="player"
      class="audio-player-expanded @container pointer-events-auto mb-2 flex h-12 w-full max-w-[740px] flex-nowrap items-center gap-1.5 rounded-xl border border-line bg-surface-raised/95 pl-2 pr-1.5 shadow-[var(--shadow-lg)] backdrop-blur-md"
      @mouseenter="
        hovering = true;
        cancelHide();
      "
      @mouseleave="
        hovering = false;
        scheduleHide();
      "
      @focusin="cancelHide"
      @focusout="scheduleHide"
      @keydown.esc="revealed = false"
    >
      <!-- Track -->
      <div class="flex min-w-0 basis-[168px] items-center gap-2">
        <span class="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface-hover text-brand">
          <Music class="size-3.5" />
        </span>
        <div class="min-w-0 leading-tight">
          <p class="truncate text-xs font-medium text-fg" :title="title">{{ title }}</p>
        </div>
      </div>

      <!-- Transport -->
      <div class="flex shrink-0 items-center gap-0.5">
        <button
          v-if="queueControls"
          type="button"
          :class="iconBtn"
          :disabled="!hasPrevious"
          title="Previous"
          :aria-label="shuffle ? 'Previous song played' : 'Previous song in list'"
          @click="emit('previous')"
        >
          <SkipBack />
        </button>
        <button
          ref="playButton"
          type="button"
          class="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--primary-bg)] text-[var(--fg-on-light)] transition-colors hover:bg-[var(--primary-bg-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          :title="isPlaying ? 'Pause' : 'Play'"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          @click="emit('toggle-play')"
        >
          <Pause v-if="isPlaying" class="size-3.5" fill="currentColor" />
          <Play v-else class="ml-px size-3.5" fill="currentColor" />
        </button>
        <button
          v-if="queueControls"
          type="button"
          :class="iconBtn"
          :disabled="!hasNext"
          title="Next"
          aria-label="Next song"
          @click="emit('next')"
        >
          <SkipForward />
        </button>
      </div>

      <!-- Progress -->
      <div class="flex min-w-0 flex-1 items-center gap-2 max-[580px]:hidden">
        <span class="tabular w-8 shrink-0 text-right text-2xs text-fg-subtle">{{ currentTimeLabel }}</span>
        <div
          ref="track"
          class="group/seek relative flex h-4 min-w-0 flex-1 cursor-pointer items-center"
          @mousedown="startSeek"
        >
          <div class="relative h-1 w-full overflow-hidden rounded-full bg-surface-active">
            <div class="absolute inset-y-0 left-0 rounded-full bg-brand" :style="{ width: `${progress}%` }" />
          </div>
          <div
            class="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow-[var(--shadow-sm)] transition-opacity"
            :class="dragging ? 'opacity-100' : 'opacity-0 group-hover/seek:opacity-100'"
            :style="{ left: `${progress}%` }"
          />
        </div>
        <span class="tabular w-8 shrink-0 text-2xs text-fg-subtle">{{ durationLabel }}</span>
      </div>

      <!-- Options -->
      <div class="flex shrink-0 items-center gap-0.5">
        <button
          v-if="repeatMode === 'off'"
          type="button"
          :class="iconBtn"
          title="Restart song"
          aria-label="Restart song"
          @click="emit('restart')"
        >
          <RotateCcw />
        </button>
        <template v-if="queueControls">
          <button
            type="button"
            :class="[iconBtn, shuffle && 'bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand']"
            title="Shuffle"
            :aria-pressed="shuffle"
            @click="emit('toggle-shuffle')"
          >
            <Shuffle />
          </button>
          <button
            type="button"
            :class="[
              iconBtn,
              '!flex !w-auto min-w-[58px] items-center justify-center gap-1 px-1.5',
              repeatMode !== 'off' && 'bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand',
            ]"
            :title="repeatTitle"
            :aria-label="repeatTitle"
            :aria-pressed="repeatMode !== 'off'"
            @click="emit('toggle-repeat')"
          >
            <Repeat />
            <span class="text-xs font-medium">{{ repeatLabel }}</span>
          </button>
        </template>
        <button type="button" :class="iconBtn" :title="muted ? 'Unmute' : 'Mute'" @click="emit('toggle-mute')">
          <VolumeX v-if="muted" />
          <Volume2 v-else-if="volume > 0.5" />
          <Volume1 v-else-if="volume > 0" />
          <Volume v-else />
        </button>
        <input
          type="range"
          min="0"
          max="100"
          :value="volume * 100"
          class="audio-player-bar__volume mr-1 w-14 max-[760px]:hidden"
          :style="{ '--volume-percent': `${volume * 100}%` }"
          aria-label="Volume"
          @input="onVolume"
        />
        <button type="button" :class="iconBtn" :title="closeLabel" :aria-label="closeLabel" @click="emit('close')">
          <X />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
  @media (prefers-reduced-motion: no-preference) {
    .audio-player-expanded {
      animation: audio-player-reveal 150ms ease-out;
    }
  }
  @keyframes audio-player-reveal {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  /* Native range input restyled for the volume control (no primitive exists). */
  .audio-player-bar__volume {
    height: 16px;
    margin: 0;
    background: transparent;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
  }

  .audio-player-bar__volume::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(
      to right,
      var(--brand) 0,
      var(--brand) var(--volume-percent, 70%),
      var(--surface-active) var(--volume-percent, 70%)
    );
  }

  .audio-player-bar__volume::-moz-range-track {
    height: 4px;
    border-radius: 999px;
    background: var(--surface-active);
  }

  .audio-player-bar__volume::-moz-range-progress {
    height: 4px;
    border-radius: 999px;
    background: var(--brand);
  }

  .audio-player-bar__volume::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 10px;
    height: 10px;
    margin-top: -3px;
    border-radius: 999px;
    background: var(--fg);
    box-shadow: var(--shadow-sm);
  }

  .audio-player-bar__volume::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border: none;
    border-radius: 999px;
    background: var(--fg);
  }
</style>
