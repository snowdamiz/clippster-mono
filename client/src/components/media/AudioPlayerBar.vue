<script setup lang="ts">
  /**
   * Presentational mini player shared by the two app-level audio players
   * (AudioPlayer.vue and GlobalAudioPlayer.vue). It floats as a compact bar
   * centered over the bottom of the content panel and stays out of the way.
   * The parent owns playback state; this component only renders and emits.
   */
  import { computed, ref } from 'vue';
  import { useRoute } from 'vue-router';
  import {
    Music,
    Pause,
    Play,
    Repeat,
    Repeat1,
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
      subtitle?: string;
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

  const track = ref<HTMLElement | null>(null);
  const dragging = ref(false);

  function fractionAt(clientX: number) {
    const rect = track.value?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function startSeek(event: MouseEvent) {
    event.preventDefault();
    dragging.value = true;
    emit('seek', fractionAt(event.clientX));
    const move = (e: MouseEvent) => emit('seek', fractionAt(e.clientX));
    const up = () => {
      dragging.value = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
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
    class="audio-player-bar pointer-events-none fixed bottom-[calc(var(--panel-inset)+0.75rem)] right-[var(--panel-inset)] z-[1000] flex justify-center px-4"
    :style="{ left: leftOffset }"
  >
    <div
      class="@container pointer-events-auto flex h-12 w-full max-w-[640px] items-center gap-2 rounded-xl border border-line bg-surface-raised/95 pl-2 pr-1.5 shadow-[var(--shadow-lg)] backdrop-blur-md"
    >
      <!-- Track -->
      <div class="flex w-[168px] min-w-0 shrink-0 items-center gap-2 @max-lg:w-[128px]">
        <span class="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface-hover text-brand">
          <Music class="size-3.5" />
        </span>
        <div class="min-w-0 leading-tight">
          <p class="truncate text-xs font-medium text-fg" :title="title">{{ title }}</p>
          <p v-if="subtitle" class="truncate text-2xs text-fg-subtle">{{ subtitle }}</p>
        </div>
      </div>

      <!-- Transport -->
      <div class="flex shrink-0 items-center gap-0.5">
        <button v-if="queueControls" type="button" :class="iconBtn" :disabled="!hasPrevious" title="Previous" @click="emit('previous')">
          <SkipBack />
        </button>
        <button
          type="button"
          class="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--primary-bg)] text-[var(--fg-on-light)] transition-colors hover:bg-[var(--primary-bg-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          :title="isPlaying ? 'Pause' : 'Play'"
          @click="emit('toggle-play')"
        >
          <Pause v-if="isPlaying" class="size-3.5" fill="currentColor" />
          <Play v-else class="ml-px size-3.5" fill="currentColor" />
        </button>
        <button v-if="queueControls" type="button" :class="iconBtn" :disabled="!hasNext" title="Next" @click="emit('next')">
          <SkipForward />
        </button>
      </div>

      <!-- Progress -->
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <span class="tabular w-8 shrink-0 text-right text-2xs text-fg-subtle">{{ currentTimeLabel }}</span>
        <div ref="track" class="group/seek relative flex h-4 min-w-0 flex-1 cursor-pointer items-center" @mousedown="startSeek">
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
        <template v-if="queueControls">
          <button
            type="button"
            :class="[iconBtn, shuffle && 'bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand', '@max-md:hidden']"
            title="Shuffle"
            :aria-pressed="shuffle"
            @click="emit('toggle-shuffle')"
          >
            <Shuffle />
          </button>
          <button
            type="button"
            :class="[iconBtn, repeatMode !== 'off' && 'bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand', '@max-md:hidden']"
            :title="repeatTitle"
            :aria-pressed="repeatMode !== 'off'"
            @click="emit('toggle-repeat')"
          >
            <Repeat1 v-if="repeatMode === 'one'" />
            <Repeat v-else />
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
          class="audio-player-bar__volume mr-1 w-16 @max-xl:hidden"
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
