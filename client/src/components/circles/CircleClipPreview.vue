<script setup lang="ts">
  import { computed } from 'vue';
  import { Headphones, Mic } from 'lucide-vue-next';
  import CircleStageTile from './CircleStageTile.vue';
  import {
    FLOATING_LISTENER_AVATARS,
    FLOATING_STAGE_VISIBLE,
    MAIN_ROOM_LISTENER_VISIBLE,
    type CircleLayout,
    type CircleParticipant,
    type CircleRoomMeta,
  } from './types';
  import { avatarInitial, listenerParticipants, stageParticipants } from './circleTimeline';

  const props = withDefaults(
    defineProps<{
      layout: CircleLayout;
      room: CircleRoomMeta;
      participants: CircleParticipant[];
      activeSpeakerIds: ReadonlySet<number> | Set<number>;
      focusedSpeakerId?: number | null;
    }>(),
    {
      focusedSpeakerId: null,
    }
  );

  const stage = computed(() => stageParticipants(props.participants));
  const listeners = computed(() => listenerParticipants(props.participants));

  const visibleStage = computed(() =>
    props.layout === 'floating_panel' ? stage.value.slice(0, FLOATING_STAGE_VISIBLE) : stage.value
  );

  const visibleListeners = computed(() =>
    props.layout === 'floating_panel'
      ? listeners.value.slice(0, FLOATING_LISTENER_AVATARS)
      : listeners.value.slice(0, MAIN_ROOM_LISTENER_VISIBLE)
  );

  const focused = computed(() => {
    if (props.focusedSpeakerId == null) return null;
    return stage.value.find((p) => p.userId === props.focusedSpeakerId) ?? null;
  });

  const isFocused = computed(() => focused.value != null);

  const hostLabel = computed(() => {
    const slug = props.room.creatorSlug?.trim();
    if (slug) return `@${slug}`;
    return props.room.creatorDisplayName || 'Public Circle';
  });

  function isSpeaking(userId: number): boolean {
    return props.activeSpeakerIds.has(userId);
  }
</script>

<template>
  <!--
    Matches Tokend CircleClipPreviewViewport + reference Panel:
    floating = narrow phone card (max 420px); main room = same clip chrome.
  -->
  <div
    class="circle-clip-preview relative text-[var(--circle-fg,#fafafa)]"
    :class="layout === 'floating_panel' ? 'circle-clip-preview--floating' : 'circle-clip-preview--main'"
    :data-circle-clip-variant="layout"
    :data-circle-clip-focused="isFocused ? 'true' : 'false'"
  >
    <div
      class="circle-clip-preview__surface relative overflow-hidden bg-[var(--circle-bg,#000)] px-3 py-2"
      :class="layout === 'floating_panel' ? 'rounded-[1.25rem]' : 'rounded-xl'"
    >
      <div :class="{ 'pointer-events-none opacity-35 saturate-0': isFocused }">
        <!-- Floating panel (Tokend floating-panel variant) -->
        <template v-if="layout === 'floating_panel'">
          <div class="flex flex-col gap-1">
            <span
              class="inline-flex w-fit items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--circle-primary,#22d3ee)]"
            >
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--circle-primary,#22d3ee)]" />
              Live
            </span>
            <h3 class="truncate text-[15px] font-semibold leading-tight text-white">
              {{ room.title }}
            </h3>
          </div>

          <section class="mt-4">
            <p v-if="stage.length > 0" class="mb-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
              On stage · {{ stage.length }}
            </p>
            <p v-if="stage.length === 0" class="py-10 text-center text-xs text-zinc-400">Waiting for speakers…</p>
            <div v-else class="grid grid-cols-4 gap-x-2 gap-y-3">
              <CircleStageTile
                v-for="participant in visibleStage"
                :key="participant.userId"
                :participant="participant"
                :is-speaking="isSpeaking(participant.userId)"
                layout="floating_panel"
              />
            </div>
          </section>

          <section v-if="listeners.length > 0" class="mt-4 border-t border-white/10 pt-3">
            <p class="mb-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
              Listening · {{ listeners.length }}
            </p>
            <div class="grid grid-cols-4 gap-x-2 gap-y-3">
              <div
                v-for="listener in visibleListeners"
                :key="listener.userId"
                class="flex min-w-0 flex-col items-center"
              >
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1a1a1c] text-[11px] font-bold text-[var(--circle-primary,#22d3ee)] ring-1 ring-white/15"
                >
                  {{ avatarInitial(listener.displayName) }}
                </div>
                <p class="mt-1 w-full truncate text-center text-[9px] font-semibold text-zinc-100">
                  {{ listener.displayName }}
                </p>
              </div>
            </div>
          </section>
        </template>

        <!-- Main room -->
        <template v-else>
          <div class="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div class="flex min-w-0 items-center gap-3">
              <div class="relative shrink-0">
                <span
                  class="pointer-events-none absolute -inset-0.5 rounded-xl bg-[var(--circle-primary,#22d3ee)]/20 opacity-70"
                  aria-hidden="true"
                />
                <div
                  class="relative flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a1a1c] text-lg font-bold text-[var(--circle-primary,#22d3ee)] ring-2 ring-[var(--circle-primary,#22d3ee)]/40"
                >
                  {{ avatarInitial(room.creatorDisplayName) }}
                </div>
                <span
                  class="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center rounded-full bg-[var(--circle-primary,#22d3ee)] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-black shadow-lg"
                >
                  Host
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="truncate text-sm font-semibold text-zinc-50">{{ room.title }}</h3>
                <span
                  class="mt-1 inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400"
                >
                  {{ hostLabel }}
                </span>
              </div>
              <div class="flex shrink-0 items-stretch overflow-hidden rounded-lg border border-white/10">
                <div class="flex flex-col items-center justify-center px-2 py-1.5">
                  <p class="font-mono text-sm font-bold leading-none text-zinc-50">
                    {{ stage.length }}
                  </p>
                  <p class="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Stage</p>
                </div>
                <div class="w-px bg-white/10" aria-hidden="true" />
                <div class="flex flex-col items-center justify-center px-2 py-1.5">
                  <p class="font-mono text-sm font-bold leading-none text-zinc-50">
                    {{ listeners.length }}
                  </p>
                  <p class="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Listening</p>
                </div>
              </div>
            </div>
          </div>

          <section class="mt-4">
            <div class="mb-3 flex items-center gap-2">
              <div
                class="flex h-6 w-6 items-center justify-center rounded-lg border border-[var(--circle-primary,#22d3ee)]/30 bg-[var(--circle-primary,#22d3ee)]/10 text-[var(--circle-primary,#22d3ee)]"
              >
                <Mic class="h-3 w-3" :stroke-width="2.25" />
              </div>
              <h2 class="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-100">On Stage</h2>
              <span class="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                {{ stage.length }}
              </span>
            </div>

            <div v-if="stage.length === 0" class="rounded-xl border border-dashed border-white/15 py-6 text-center">
              <p class="text-xs font-semibold text-zinc-400">Stage is empty</p>
              <p class="mt-1 text-[10px] text-zinc-500">Waiting for speakers to join</p>
            </div>
            <div v-else class="grid grid-cols-4 gap-x-2 gap-y-3 lg:grid-cols-5">
              <CircleStageTile
                v-for="participant in visibleStage"
                :key="participant.userId"
                :participant="participant"
                :is-speaking="isSpeaking(participant.userId)"
                layout="main_room"
              />
            </div>
          </section>

          <section class="mt-4">
            <div class="mb-3 flex items-center gap-2">
              <div class="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 text-zinc-400">
                <Headphones class="h-3 w-3" :stroke-width="2" />
              </div>
              <h2 class="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-100">Listening</h2>
              <span class="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                {{ listeners.length }}
              </span>
            </div>

            <div v-if="listeners.length === 0" class="rounded-xl border border-dashed border-white/15 py-6 text-center">
              <p class="text-xs font-semibold text-zinc-400">No listeners yet</p>
              <p class="mt-1 text-[10px] text-zinc-500">Waiting for listeners to join</p>
            </div>
            <div v-else class="grid grid-cols-4 gap-x-2 gap-y-3 lg:grid-cols-5">
              <div
                v-for="listener in visibleListeners"
                :key="listener.userId"
                class="flex min-w-0 flex-col items-start"
              >
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a1a1c] text-sm font-bold text-[var(--circle-primary,#22d3ee)] ring-1 ring-white/15"
                >
                  {{ avatarInitial(listener.displayName) }}
                </div>
                <p class="mt-1 w-10 truncate text-[9px] font-semibold text-zinc-100">
                  {{ listener.displayName }}
                </p>
              </div>
            </div>
          </section>
        </template>
      </div>

      <div
        v-if="focused"
        class="absolute inset-0 flex items-center justify-center bg-black/60"
        data-circle-clip-focus-overlay=""
      >
        <CircleStageTile
          :participant="focused"
          :is-speaking="isSpeaking(focused.userId)"
          :layout="layout"
          :compact="false"
          :spotlight="true"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
  .circle-clip-preview {
    --circle-bg: #000000;
    --circle-fg: #fafafa;
    --circle-primary: #22d3ee;
  }

  /* Tokend reference Panel: max-w-[420px] phone-narrow card */
  .circle-clip-preview--floating {
    width: 100%;
    max-width: 420px;
    margin-inline: auto;
  }

  .circle-clip-preview--floating .circle-clip-preview__surface {
    min-height: 520px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.6),
      0 18px 50px rgba(0, 0, 0, 0.55);
  }

  .circle-clip-preview--main .circle-clip-preview__surface {
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
</style>
