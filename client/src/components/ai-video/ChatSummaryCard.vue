<template>
  <ChatPlanCard title="Generation plan">
    <ChatPlanRow v-if="summary.description" label="Description" :value="summary.description" />
    <ChatPlanRow v-if="summary.style" label="Style" :tags="[summary.style]" />
    <ChatPlanRow v-if="summary.duration" label="Duration" :value="`${summary.duration}s`" />
    <ChatPlanRow v-if="summary.aspectRatio" label="Aspect ratio" :value="summary.aspectRatio" />
    <ChatPlanRow v-if="summary.colorPalette?.length" label="Colors" :colors="summary.colorPalette" />
    <ChatPlanRow v-if="summary.keyFeatures?.length" label="Features" :tags="summary.keyFeatures" />
    <ChatPlanRow v-if="summary.audience" label="Audience" :value="summary.audience" />
    <ChatPlanRow v-if="summary.platform" label="Platform" :tags="[summary.platform]" />
    <ChatPlanRow v-if="summary.narrative" label="Narrative" :value="summary.narrative" />

    <template v-if="summary.scenes?.length" #footer>
      <div class="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
        <Film class="size-3.5" />
        <span>Scene plan · {{ summary.scenes.length }} scenes</span>
      </div>
      <ol class="flex flex-col gap-1.5">
        <li v-for="scene in summary.scenes" :key="scene.index" class="flex gap-2">
          <span
            class="tabular grid size-5 shrink-0 place-items-center rounded-md bg-surface-active text-2xs font-semibold text-fg-muted"
          >
            {{ scene.index + 1 }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-xs text-fg">{{ scene.description }}</p>
            <p class="mt-0.5 flex min-w-0 items-center gap-1.5 text-2xs text-fg-subtle">
              <span class="tabular">{{ scene.duration }}s</span>
              <template v-if="scene.mood">
                <span aria-hidden="true">·</span>
                <span>{{ scene.mood }}</span>
              </template>
              <template v-if="scene.textOverlay">
                <span aria-hidden="true">·</span>
                <span class="truncate italic" :title="scene.textOverlay">"{{ scene.textOverlay }}"</span>
              </template>
            </p>
          </div>
        </li>
      </ol>
    </template>
  </ChatPlanCard>
</template>

<script setup lang="ts">
  import { Film } from 'lucide-vue-next';
  import ChatPlanCard from '@/components/create/chat/ChatPlanCard.vue';
  import ChatPlanRow from '@/components/create/chat/ChatPlanRow.vue';
  import type { GenerationSummary } from '@/types/ai-video';

  defineProps<{
    summary: GenerationSummary;
  }>();
</script>
