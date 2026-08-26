<script setup lang="ts">
  import { computed } from 'vue';
  import { MicOff } from 'lucide-vue-next';
  import type { CircleLayout, CircleParticipant } from './types';
  import { avatarInitial, roleBadgeLabel } from './circleTimeline';

  const props = withDefaults(
    defineProps<{
      participant: CircleParticipant;
      isSpeaking?: boolean;
      layout?: CircleLayout;
      compact?: boolean;
      dimmed?: boolean;
      spotlight?: boolean;
    }>(),
    {
      isSpeaking: false,
      layout: 'main_room',
      compact: true,
      dimmed: false,
      spotlight: false,
    }
  );

  const roleBadge = computed(() => roleBadgeLabel(props.participant.role));
  const showMuted = computed(() => !props.participant.audioEnabled || props.participant.mutedByMod === true);

  const avatarClass = computed(() => {
    if (props.spotlight) {
      return props.layout === 'floating_panel' ? 'h-20 w-20 text-2xl' : 'h-24 w-24 text-3xl';
    }
    if (props.layout === 'floating_panel') {
      return props.compact ? 'h-12 w-12 text-base' : 'h-14 w-14 text-lg';
    }
    return props.compact ? 'h-14 w-14 text-lg' : 'h-20 w-20 text-2xl';
  });

  const nameWidthClass = computed(() => {
    if (props.spotlight) return 'w-24';
    if (props.layout === 'floating_panel' && props.compact) return 'w-14';
    return 'w-16';
  });

  const ringClass = computed(() => {
    if (props.isSpeaking) {
      return 'ring-[var(--circle-primary,#22d3ee)] shadow-[0_0_0_3px_rgba(34,211,238,0.35)]';
    }
    if (showMuted.value) {
      return 'ring-red-500/70';
    }
    return 'ring-white/10';
  });
</script>

<template>
  <div
    class="circle-stage-tile flex min-w-0 flex-col items-center px-0.5 transition"
    :class="{ 'scale-90 opacity-40 saturate-0': dimmed }"
  >
    <div class="relative">
      <span
        v-if="isSpeaking"
        class="pointer-events-none absolute -inset-1 rounded-full bg-[var(--circle-primary,#22d3ee)]/20"
        aria-hidden="true"
      />

      <!-- Tokend stock avatars: letter on dark circle (reference fixtures use null avatar_url) -->
      <div
        class="relative flex items-center justify-center rounded-full bg-[#1a1a1c] font-bold text-[var(--circle-primary,#22d3ee)] ring-2"
        :class="[avatarClass, ringClass]"
      >
        <img
          v-if="participant.avatarUrl"
          :src="participant.avatarUrl"
          alt=""
          class="absolute inset-0 h-full w-full rounded-full object-cover"
        />
        <template v-else>{{ avatarInitial(participant.displayName) }}</template>
      </div>

      <span
        v-if="showMuted"
        class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-lg ring-2 ring-black"
      >
        <MicOff class="h-2.5 w-2.5" :stroke-width="2.5" />
      </span>

      <span
        v-if="roleBadge"
        class="absolute -bottom-1.5 left-1/2 max-w-[5rem] -translate-x-1/2 truncate rounded-full bg-[var(--circle-primary,#22d3ee)] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-black shadow-lg"
      >
        {{ roleBadge }}
      </span>
    </div>

    <div class="mt-1.5 flex h-3 items-end justify-center gap-[2px]">
      <span
        v-for="index in 5"
        :key="index"
        class="w-[2px] rounded-full"
        :class="isSpeaking ? 'animate-pulse bg-[var(--circle-primary,#22d3ee)]' : 'bg-white/15'"
        :style="{
          height: isSpeaking ? `${6 + ((index * 3) % 10)}px` : '3px',
          animationDelay: isSpeaking ? `${index * 80}ms` : undefined,
        }"
      />
    </div>

    <p
      class="mt-1 truncate text-center text-[10px] font-semibold text-zinc-100"
      :class="nameWidthClass"
      :title="participant.displayName"
    >
      {{ participant.displayName }}
    </p>
  </div>
</template>
