<template>
  <div class="collapsible-section">
    <button @click="isOpen = !isOpen" class="collapsible-section__header">
      <div class="flex items-center gap-2">
        <ChevronRight
          :size="14"
          class="collapsible-section__chevron"
          :class="{ 'collapsible-section__chevron--open': isOpen }"
        />
        <span class="collapsible-section__title">{{ title }}</span>
        <span v-if="count !== undefined" class="collapsible-section__count">({{ count }})</span>
      </div>
      <span class="collapsible-section__toggle">{{ isOpen ? 'Hide' : 'Show' }}</span>
    </button>
    <div v-if="isOpen" class="collapsible-section__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { ChevronRight } from 'lucide-vue-next';

  const props = withDefaults(
    defineProps<{
      title: string;
      count?: number;
      defaultOpen?: boolean;
    }>(),
    {
      defaultOpen: false,
    }
  );

  const isOpen = ref(props.defaultOpen);

  watch(
    () => props.defaultOpen,
    (newVal) => {
      isOpen.value = newVal;
    }
  );
</script>

<style scoped>
  .collapsible-section {
    border: 1px solid var(--sidebar-border);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .collapsible-section__header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background-color: var(--sidebar-hover);
    border: none;
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .collapsible-section__header:hover {
    background-color: var(--sidebar-active);
  }

  .collapsible-section__chevron {
    color: var(--sidebar-text-muted);
    transition: transform 200ms ease;
  }

  .collapsible-section__chevron--open {
    transform: rotate(90deg);
  }

  .collapsible-section__title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-text);
    letter-spacing: 0.025em;
  }

  .collapsible-section__count {
    font-size: 0.625rem;
    color: var(--sidebar-text-muted);
  }

  .collapsible-section__toggle {
    font-size: 0.625rem;
    color: var(--sidebar-text-muted);
  }

  .collapsible-section__content {
    padding: 0.75rem;
    background-color: var(--sidebar-surface);
  }
</style>
