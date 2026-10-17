<script setup lang="ts">
  import { computed } from 'vue';
  import { useRouter } from 'vue-router';
  import { Sparkles, ExternalLink, Plus } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { IconTile } from '@/components/ui/icon-tile';
  import { SectionHeader } from '@/components/ui/section-header';
  import { AssetListRow } from '../shared';
  import { buildTextElement } from '@/editor/lib/timeline/element-utils';
  import { TIMELINE_CONSTANTS } from '@/editor/constants/timeline-constants';
  import { useEditor } from '@/editor/composables/useEditor';
  import { useAuthStore } from '@/stores/auth';
  import { canAccessAIVideo } from '@/utils/aiVideoAccess';

  const router = useRouter();
  const authStore = useAuthStore();
  const { editor } = useEditor();

  const hasThumbnailAccess = computed(() => canAccessAIVideo(authStore.user));

  const quickTexts = ['MAKE IT HAPPEN', 'THE FUTURE IS NOW', 'LEVEL UP', 'BREAKING', 'WATCH THIS'];

  function addTextToCanvas(text: string) {
    const element = buildTextElement({
      raw: {
        content: text,
        name: text.slice(0, 30),
        duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
      },
      startTime: editor.playback.getCurrentTime(),
    });
    editor.timeline.insertElement({ element, placement: { mode: 'auto' } });
  }

  function openThumbnailGenerator() {
    if (!hasThumbnailAccess.value) return;
    router.push('/ai-image');
  }
</script>

<template>
  <div class="flex h-full flex-col gap-4 overflow-y-auto p-3">
    <!-- AI Image Creator -->
    <div
      class="space-y-3 rounded-lg border border-line-subtle bg-surface-raised p-3"
      :class="!hasThumbnailAccess && 'opacity-60'"
    >
      <div class="flex items-center gap-2">
        <IconTile :icon="Sparkles" :tone="hasThumbnailAccess ? 'ai' : 'neutral'" size="sm" />
        <h3 class="min-w-0 flex-1 truncate text-xs font-semibold text-fg">AI Image Creator</h3>
        <Badge v-if="!hasThumbnailAccess" variant="neutral">Coming soon</Badge>
      </div>
      <p class="text-xs leading-relaxed text-fg-muted">
        Open the Thumbnail section for chat-based creation with Quick or Editable workflows, references, and refinement
        rounds.
      </p>
      <Button variant="primary" size="sm" block :disabled="!hasThumbnailAccess" @click="openThumbnailGenerator">
        Open thumbnail creator
        <ExternalLink />
      </Button>
    </div>

    <!-- Quick text -->
    <section class="space-y-1.5">
      <SectionHeader title="Quick text" variant="eyebrow" class="min-h-0" />
      <p class="text-2xs text-fg-subtle">Drop a common hook onto the canvas.</p>
      <div class="-mx-1 space-y-px pt-1">
        <AssetListRow
          v-for="text in quickTexts"
          :key="text"
          as="button"
          :title="text"
          :aria-label="`Add “${text}” to the canvas`"
          @click="addTextToCanvas(text)"
        >
          <template #trailing>
            <Plus class="size-3.5 text-fg-subtle" />
          </template>
        </AssetListRow>
      </div>
    </section>
  </div>
</template>
