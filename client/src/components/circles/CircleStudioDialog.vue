<script setup lang="ts">
  import { computed, onUnmounted, ref, watch } from 'vue';
  import { Pause, Play } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { Field } from '@/components/ui/field';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  // reka Select works with string values; 'none' maps to no focused speaker.
  const focusSelectValue = computed({
    get: () => (focusedSpeakerId.value == null ? 'none' : String(focusedSpeakerId.value)),
    set: (value: string) => {
      focusedSpeakerId.value = value === 'none' ? null : Number(value);
    },
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


  watch(
    () => [props.open, props.circlePackage?.id] as const,
    () => {
      stopPlayback();
      playheadMs.value = 0;
      layout.value = 'main_room';
      focusedSpeakerId.value = null;
    }
  );

  onUnmounted(() => {
    stopPlayback();
  });
</script>

<template>
  <Modal
    :open="open && !!circlePackage"
    :title="circlePackage?.room.title"
    :description="`Circles mock · ${formatTime(durationMs)} · scrub timeline`"
    size="2xl"
    flush
    @close="emit('close')"
  >
    <template #header-actions>
      <CircleLayoutSelector v-model="layout" class="mr-1 self-center" />
    </template>

    <div
      v-if="circlePackage"
      class="grid gap-4 px-5 pb-5 pt-3 grid-cols-[minmax(0,1.4fr)_minmax(240px,0.7fr)] max-[840px]:grid-cols-1"
    >
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

      <aside class="flex flex-col gap-4">
        <Field label="Focus speaker">
          <Select v-model="focusSelectValue">
            <SelectTrigger aria-label="Focus speaker">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem v-for="speaker in focusOptions" :key="speaker.userId" :value="String(speaker.userId)">
                {{ speakerOptionLabel(speaker) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--primary-bg)] text-[var(--fg-on-light)] transition-colors hover:bg-[var(--primary-bg-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              :title="isPlaying ? 'Pause' : 'Play'"
              :aria-label="isPlaying ? 'Pause' : 'Play'"
              @click="togglePlay"
            >
              <Pause v-if="isPlaying" class="size-4" fill="currentColor" />
              <Play v-else class="ml-px size-4" fill="currentColor" />
            </button>
            <span class="tabular font-mono text-xs text-fg-muted">
              {{ formatTime(playheadMs) }} / {{ formatTime(durationMs) }}
            </span>
          </div>

          <input
            class="w-full accent-[var(--brand)]"
            type="range"
            min="0"
            :max="durationMs"
            step="100"
            :value="playheadMs"
            aria-label="Timeline"
            @input="onScrub"
          />
        </div>

        <p class="text-xs text-fg-subtle">
          Mock event timeline drives join/leave, roles, and speaking highlights. Swap this package for a live Tokend
          Circle package later — same UI.
        </p>
      </aside>
    </div>
  </Modal>
</template>

<style scoped>
  /* Media stage that frames the Tokend circle preview (custom: phone chrome). */
  .circle-studio__preview-wrap {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    min-height: 520px;
    padding: 1.25rem;
    border-radius: var(--radius-card);
    border: 1px solid var(--line-subtle);
    overflow: auto;
    background: var(--surface-sunken);
  }

  .circle-studio__preview-wrap--phone {
    padding: 1.75rem 1.25rem 2rem;
  }

  /* Soft phone chrome around the 420px Tokend floating card */
  .circle-studio__preview-wrap--phone :deep(.circle-clip-preview--floating) {
    position: relative;
    max-width: 390px;
  }

  .circle-studio__preview-wrap--phone :deep(.circle-clip-preview__surface) {
    border-radius: 1.75rem;
    border: 2px solid var(--line-strong);
    box-shadow:
      0 0 0 8px var(--canvas),
      0 0 0 9px var(--line),
      var(--shadow-lg);
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
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--line);
    pointer-events: none;
  }
</style>
