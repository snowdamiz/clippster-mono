<template>
  <StudioPanel title="Templates">
    <div class="flex flex-wrap gap-1.5">
      <div
        v-for="template in templates"
        :key="template.id"
        class="group flex h-[var(--control-sm)] max-w-full items-center rounded-[var(--radius-control)] border text-xs font-medium transition-colors"
        :class="
          activeTemplateId === template.id
            ? 'border-brand-line bg-brand-soft text-brand'
            : 'border-line bg-surface-raised text-fg hover:border-line-strong'
        "
      >
        <button
          type="button"
          class="h-full min-w-0 truncate rounded-[var(--radius-control)] px-2.5 focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
          :aria-pressed="activeTemplateId === template.id"
          @click="emit('apply', template)"
        >
          {{ template.name }}
        </button>
        <button
          v-if="!isDefaultStudioTemplate(template.id)"
          type="button"
          class="-ml-1 mr-1 grid size-5 shrink-0 place-items-center rounded text-fg-subtle transition-colors hover:bg-surface-hover hover:text-danger"
          title="Delete template"
          aria-label="Delete template"
          @click.stop="emit('delete', template.id)"
        >
          <X class="size-3" />
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <Button variant="secondary" size="sm" block @click="emit('upload-template')">
        <Upload />
        Upload template overlay
      </Button>
      <p class="text-xs text-fg-subtle">
        Choose a PNG or image overlay. It fills the full canvas and is saved as a reusable template.
      </p>
    </div>
  </StudioPanel>
</template>

<script setup lang="ts">
  import { Upload, X } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import StudioPanel from './StudioPanel.vue';
  import { isDefaultStudioTemplate } from '@/composables/studio/useStudioTemplates';
  import type { StudioTemplate } from '@/types/studio';

  defineProps<{
    templates: StudioTemplate[];
    activeTemplateId: string | null;
  }>();

  const emit = defineEmits<{
    (e: 'apply', template: StudioTemplate): void;
    (e: 'delete', templateId: string): void;
    (e: 'upload-template'): void;
  }>();
</script>
