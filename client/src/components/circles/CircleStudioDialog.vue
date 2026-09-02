<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
  import { ChevronDown, Pause, Play, X } from 'lucide-vue-next';
  import CircleClipPreview from './CircleClipPreview.vue';
  import CircleLayoutSelector from './CircleLayoutSelector.vue';
  import { reduceCircleTimeline, stageParticipants } from './circleTimeline';
  import type { CircleLayout, CirclePackage, CircleParticipant } from './types';

  const props = defineProps<{
    open: boolean;
    circlePackage: CirclePackage | null;
  }>();

  const emit = defineEmits<{
    close: [];
  }>();

  const layout = ref<CircleLayout>('main_room');
  const playheadMs = ref(0);
  const isPlaying = ref(false);
  const focusedSpeakerId = ref<number | null>(null);
  const showFocusDropdown = ref(false);

  let rafId: number | null = null;
  let lastFrameTs = 0;

  const durationMs = computed(() => props.circlePackage?.durationMs ?? 0);

  const stageState = computed(() => {
    if (!props.circlePackage) {
      return { participants: [], activeSpeakerIds: new Set<number>() };
    }
    return reduceCircleTimeline(props.circlePackage.seedParticipants, props.circlePackage.events, playheadMs.value);
  });

  const focusOptions = computed(() => stageParticipants(stageState.value.participants));

  const focusedSpeakerLabel = computed(() => {
    if (focusedSpeakerId.value == null) return 'None';
    const speaker = focusOptions.value.find((s) => s.userId === focusedSpeakerId.value);
    return speaker ? speakerOptionLabel(speaker) : 'None';
  });

  function speakerOptionLabel(speaker: CircleParticipant): string {
    if (speaker.role === 'host') return `${speaker.displayName} (Host)`;
    if (speaker.role === 'cohost') return `${speaker.displayName} (Cohost)`;
    return speaker.displayName;
  }

  function formatTime(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function stopPlayback() {
    isPlaying.value = false;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function tick(ts: number) {
    if (!isPlaying.value) return;
    if (lastFrameTs === 0) lastFrameTs = ts;
    const delta = ts - lastFrameTs;
    lastFrameTs = ts;
    playheadMs.value = Math.min(durationMs.value, playheadMs.value + delta);
    if (playheadMs.value >= durationMs.value) {
      playheadMs.value = durationMs.value;
      stopPlayback();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function togglePlay() {
    if (!props.circlePackage) return;
    if (isPlaying.value) {
      stopPlayback();
      return;
    }
    if (playheadMs.value >= durationMs.value) {
      playheadMs.value = 0;
    }
    isPlaying.value = true;
    lastFrameTs = 0;
    rafId = requestAnimationFrame(tick);
  }

  function onScrub(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    playheadMs.value = Number.isFinite(value) ? value : 0;
  }

  function selectFocusSpeaker(userId: number | null) {
    focusedSpeakerId.value = userId;
    showFocusDropdown.value = false;
  }

  function handleFocusDropdownOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.circle-studio__focus-dropdown')) {
      showFocusDropdown.value = false;
    }
  }

  watch(
    () => [props.open, props.circlePackage?.id] as const,
    () => {
      stopPlayback();
      playheadMs.value = 0;
      layout.value = 'main_room';
      focusedSpeakerId.value = null;
      showFocusDropdown.value = false;
    }
  );

  onMounted(() => {
    document.addEventListener('click', handleFocusDropdownOutside);
  });

  onUnmounted(() => {
    stopPlayback();
    document.removeEventListener('click', handleFocusDropdownOutside);
  });
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open && circlePackage" class="circle-studio__overlay" @click.self="emit('close')">
        <div class="circle-studio" role="dialog" aria-modal="true" :aria-label="circlePackage.room.title">
          <header class="circle-studio__header">
            <button type="button" class="circle-studio__close" title="Close" @click="emit('close')">
              <X :size="18" />
            </button>
            <div class="circle-studio__header-text">
              <h2 class="circle-studio__title">{{ circlePackage.room.title }}</h2>
              <p class="circle-studio__subtitle">Circles mock · {{ formatTime(durationMs) }} · scrub timeline</p>
            </div>
            <CircleLayoutSelector v-model="layout" />
          </header>

          <div class="circle-studio__body">
            <div
              class="circle-studio__preview-wrap"
              :class="{ 'circle-studio__preview-wrap--phone': layout === 'floating_panel' }"
            >
              <CircleClipPreview
                :layout="layout"
                :room="circlePackage.room"
                :participants="stageState.participants"
                :active-speaker-ids="stageState.activeSpeakerIds"
                :focused-speaker-id="focusedSpeakerId"
              />
            </div>

            <aside class="circle-studio__controls">
              <div class="circle-studio__field">
                <label class="circle-studio__label">Focus speaker</label>
                <div class="relative circle-studio__focus-dropdown">
                  <button
                    type="button"
                    class="circle-studio__input circle-studio__select"
                    @click.stop="showFocusDropdown = !showFocusDropdown"
                  >
                    <span class="truncate">{{ focusedSpeakerLabel }}</span>
                    <ChevronDown
                      class="h-3.5 w-3.5 shrink-0 transition-transform"
                      :class="{ 'rotate-180': showFocusDropdown }"
                    />
                  </button>

                  <div v-if="showFocusDropdown" class="circle-studio__dropdown">
                    <button
                      type="button"
                      class="circle-studio__dropdown-item"
                      :class="{ 'circle-studio__dropdown-item--selected': focusedSpeakerId == null }"
                      @click="selectFocusSpeaker(null)"
                    >
                      None
                    </button>
                    <button
                      v-for="speaker in focusOptions"
                      :key="speaker.userId"
                      type="button"
                      class="circle-studio__dropdown-item"
                      :class="{
                        'circle-studio__dropdown-item--selected': focusedSpeakerId === speaker.userId,
                      }"
                      @click="selectFocusSpeaker(speaker.userId)"
                    >
                      {{ speakerOptionLabel(speaker) }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="circle-studio__transport">
                <button
                  type="button"
                  class="circle-studio__play"
                  :title="isPlaying ? 'Pause' : 'Play'"
                  @click="togglePlay"
                >
                  <Pause v-if="isPlaying" :size="18" />
                  <Play v-else :size="18" />
                </button>
                <span class="circle-studio__time">{{ formatTime(playheadMs) }} / {{ formatTime(durationMs) }}</span>
              </div>

              <input
                class="circle-studio__scrubber"
                type="range"
                min="0"
                :max="durationMs"
                step="100"
                :value="playheadMs"
                @input="onScrub"
              />

              <p class="circle-studio__hint">
                Mock event timeline drives join/leave, roles, and speaking highlights. Swap this package for a live
                Tokend Circle package later — same UI.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .circle-studio__overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(4px);
  }

  .circle-studio {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(1100px, 100%);
    max-height: min(920px, 92vh);
    overflow: hidden;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: var(--background);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
  }

  .circle-studio__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .circle-studio__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: #a1a1aa;
    cursor: pointer;
  }

  .circle-studio__close:hover {
    color: #fafafa;
    background: rgba(255, 255, 255, 0.06);
  }

  .circle-studio__header-text {
    flex: 1;
    min-width: 10rem;
  }

  .circle-studio__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #fafafa;
  }

  .circle-studio__subtitle {
    margin: 0.15rem 0 0;
    font-size: 0.75rem;
    color: #a1a1aa;
  }

  .circle-studio__body {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(240px, 0.7fr);
    gap: 1rem;
    padding: 1rem 1.25rem 1.25rem;
    overflow: auto;
  }

  @media (max-width: 840px) {
    .circle-studio__body {
      grid-template-columns: 1fr;
    }
  }

  .circle-studio__preview-wrap {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    min-height: 520px;
    padding: 1.25rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    overflow: auto;
    background: #050505;
  }

  .circle-studio__preview-wrap--phone {
    padding: 1.75rem 1.25rem 2rem;
    background: radial-gradient(ellipse at top, rgba(34, 211, 238, 0.08), transparent 55%), #050505;
  }

  /* Soft phone chrome around the 420px Tokend floating card */
  .circle-studio__preview-wrap--phone :deep(.circle-clip-preview--floating) {
    position: relative;
    max-width: 390px;
  }

  .circle-studio__preview-wrap--phone :deep(.circle-clip-preview__surface) {
    border-radius: 1.75rem;
    border: 2px solid rgba(255, 255, 255, 0.12);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.04),
      0 0 0 8px #111113,
      0 0 0 9px rgba(255, 255, 255, 0.08),
      0 28px 60px rgba(0, 0, 0, 0.65);
    min-height: 640px;
  }

  .circle-studio__preview-wrap--phone::before {
    content: '';
    position: absolute;
    top: 2.15rem;
    left: 50%;
    z-index: 2;
    width: 72px;
    height: 8px;
    transform: translateX(-50%);
    border-radius: 999px;
    background: #1f1f23;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    pointer-events: none;
  }

  .circle-studio__controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .circle-studio__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .circle-studio__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .circle-studio__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .circle-studio__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .circle-studio__select {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    cursor: pointer;
  }

  .circle-studio__select:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .circle-studio__dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    z-index: 20;
    max-height: 12rem;
    overflow-x: hidden;
    overflow-y: auto;
    border-radius: 8px;
    border: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-surface);
  }

  .circle-studio__dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .circle-studio__dropdown::-webkit-scrollbar-track {
    background: transparent;
  }

  .circle-studio__dropdown::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .circle-studio__dropdown-item {
    display: block;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--sidebar-text);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .circle-studio__dropdown-item:hover {
    background-color: var(--sidebar-hover);
  }

  .circle-studio__dropdown-item--selected {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .circle-studio__transport {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .circle-studio__play {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 999px;
    border: none;
    background: var(--sidebar-accent);
    color: white;
    cursor: pointer;
  }

  .circle-studio__play:hover {
    filter: brightness(1.08);
  }

  .circle-studio__time {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.8rem;
    color: #d4d4d8;
  }

  .circle-studio__scrubber {
    width: 100%;
    accent-color: var(--sidebar-accent);
  }

  .circle-studio__hint {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.45;
    color: #71717a;
  }

  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 160ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }
</style>
