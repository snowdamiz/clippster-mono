<script setup lang="ts">
  /** The plan from the planning chat: length, shape, tone, must-haves, then every beat in order. */
  import { computed } from 'vue';
  import { Clapperboard, Film, Sparkles } from 'lucide-vue-next';
  import ChatPlanCard from '@/components/create/chat/ChatPlanCard.vue';
  import ChatPlanRow from '@/components/create/chat/ChatPlanRow.vue';
  import { formatClock, plural } from '../format';
  import type { MediaItem, VideoPlan } from '../types';

  const props = defineProps<{ plan: VideoPlan; media: MediaItem[]; shape: string }>();

  const beats = computed(() => {
    const names = new Map(props.media.map((item) => [item.id, item.name]));
    let start = 0;
    return props.plan.beats.map((beat) => {
      const row = { ...beat, start, names: (beat.media ?? []).flatMap((id) => names.get(id) ?? []) };
      start += beat.seconds;
      return row;
    });
  });
</script>

<template>
  <ChatPlanCard :title="plan.title" :icon="Clapperboard">
    <ChatPlanRow label="Video" :value="`${plural(Math.round(plan.seconds), 'second')}, ${shape}`" />
    <ChatPlanRow v-if="plan.tone" label="Feel" :value="plan.tone" />
    <ChatPlanRow v-if="plan.notes" label="Include" :value="plan.notes" />
    <template #footer>
      <ol class="flex flex-col gap-2">
        <li v-for="(beat, index) in beats" :key="index" class="grid grid-cols-[44px_minmax(0,1fr)] gap-2 text-xs">
          <span class="tabular pt-px text-fg-subtle">{{ formatClock(beat.start) }}</span>
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="flex items-center gap-1 text-fg-muted">
              <component :is="beat.kind === 'scene' ? Sparkles : Film" class="size-3 shrink-0" />
              {{ beat.kind === 'scene' ? 'Designed scene' : 'Your footage' }}
              <template v-if="beat.names.length">· {{ beat.names.join(', ') }}</template>
            </span>
            <span class="text-fg">{{ beat.what }}</span>
            <span v-if="beat.words" class="font-medium text-fg">"{{ beat.words }}"</span>
          </div>
        </li>
      </ol>
    </template>
  </ChatPlanCard>
</template>
