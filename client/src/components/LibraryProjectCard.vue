<template>
  <div
    class="project-card"
    :class="{ 'project-card--selected': selected, 'project-card--list': list }"
    tabindex="0"
    role="button"
    :aria-label="`Open workspace: ${name}`"
    @click="emit('open')"
    @keydown.enter.self="emit('open')"
    @keydown.space.self.prevent="emit('open')"
  >
    <slot name="badges" />
    <div
      v-if="thumbnail || $slots.thumbnail"
      class="project-card__thumbnail"
      :style="thumbnail ? { backgroundImage: `url(${thumbnail})` } : undefined"
    >
      <slot name="thumbnail" />
      <div class="project-card__vignette"></div>
    </div>
    <div v-else class="project-card__thumbnail project-card__thumbnail--empty">
      <div class="project-card__thumbnail-gradient"></div>
      <div v-if="live" class="project-card__empty-live">
        <div class="project-card__empty-live-pulse">
          <div class="project-card__empty-live-ring"></div>
          <Radio class="project-card__empty-live-icon" />
        </div>
        <span class="project-card__empty-live-text">Monitoring</span>
      </div>
      <div v-else class="project-card__empty-icon"><Folder class="project-card__folder-icon" /></div>
    </div>
    <div class="project-card__bottom">
      <h3 class="project-card__title" :title="name">{{ name }}</h3>
      <div class="project-card__meta"><slot name="meta" /></div>
    </div>
    <div v-if="$slots.actions" class="project-card__hover-actions"><slot name="actions" /></div>
  </div>
</template>
<script setup lang="ts">
  import { Folder, Radio } from 'lucide-vue-next';
  defineProps<{ name: string; thumbnail?: string | null; live?: boolean; selected?: boolean; list?: boolean }>();
  const emit = defineEmits<{ open: [] }>();
</script>
<style src="../styles/projectLibrary.css"></style>
