<template>
  <div class="studio-panel">
    <h3 class="studio-panel__title">Templates</h3>

    <div class="studio-panel__templates">
      <div
        v-for="template in templates"
        :key="template.id"
        class="studio-panel__template-item"
        :class="{ 'studio-panel__template-item--active': activeTemplateId === template.id }"
      >
        <button
          type="button"
          class="studio-panel__template-btn"
          :class="{ 'studio-panel__template-btn--active': activeTemplateId === template.id }"
          @click="emit('apply', template)"
        >
          {{ template.name }}
        </button>
        <button
          v-if="!isDefaultStudioTemplate(template.id)"
          type="button"
          class="studio-panel__template-delete"
          title="Delete template"
          @click.stop="emit('delete', template.id)"
        >
          <X :size="12" />
        </button>
      </div>
    </div>

    <Button type="button" size="sm" class="studio-panel__upload-template" @click="emit('upload-template')">
      <Upload :size="14" />
      Upload template overlay
    </Button>
    <p class="studio-panel__hint">
      Choose a PNG or image overlay. It will fill the full canvas and be saved as a reusable template.
    </p>
  </div>
</template>

<script setup lang="ts">
  import { Upload, X } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
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

<style scoped>
  .studio-panel {
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .studio-panel__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .studio-panel__templates {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .studio-panel__template-item {
    display: inline-flex;
    align-items: stretch;
    border-radius: 6px;
    border: 1px solid var(--sidebar-border);
    background: rgba(255, 255, 255, 0.03);
    overflow: hidden;
    transition: all 150ms ease;
  }

  .studio-panel__template-item:hover {
    border-color: var(--sidebar-accent);
  }

  .studio-panel__template-item--active {
    border-color: var(--sidebar-accent);
    background: rgba(6, 182, 212, 0.1);
  }

  .studio-panel__template-btn {
    padding: 0.4rem 0.65rem;
    font-size: 0.75rem;
    border: none;
    background: transparent;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: color 150ms ease;
  }

  .studio-panel__template-btn:hover,
  .studio-panel__template-item:hover .studio-panel__template-btn {
    color: var(--sidebar-text);
  }

  .studio-panel__template-btn--active {
    color: var(--sidebar-accent);
  }

  .studio-panel__template-delete {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    flex-shrink: 0;
    border: none;
    border-left: 1px solid var(--sidebar-border);
    background: transparent;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .studio-panel__template-delete:hover {
    color: #f87171;
    background: rgba(239, 68, 68, 0.12);
    border-left-color: rgba(239, 68, 68, 0.35);
  }

  .studio-panel__upload-template {
    width: 100%;
  }

  .studio-panel__hint {
    margin: 0;
    color: var(--sidebar-text-muted);
    font-size: 0.6875rem;
    line-height: 1.35;
  }
</style>
