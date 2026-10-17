<template>
  <Modal :open="show" size="md" title="Welcome to Clippster" hide-close @close="onSkip">
    <template #header>
      <div class="flex flex-col gap-3 px-5 pt-5">
        <div class="flex items-center gap-2">
          <img :src="logoIconSrc" alt="" class="size-7 rounded-lg" />
          <img :src="logoWordSrc" alt="Clippster" class="mt-0.5 h-4 w-auto brightness-0 invert" />
        </div>
        <div>
          <h2 class="text-lg font-semibold tracking-[-0.01em] text-fg">Welcome to Clippster</h2>
          <p class="mt-1 text-sm text-fg-muted">
            Take a quick walk through the sidebar so you know where to download, clip, edit and publish.
          </p>
        </div>
      </div>
    </template>

    <div class="grid grid-cols-2 gap-2.5">
      <button
        type="button"
        class="flex flex-col gap-1 rounded-xl border border-brand-line bg-brand-soft p-3.5 text-left transition-colors hover:bg-brand-soft-hover"
        @click="onTake"
      >
        <span class="flex items-center gap-1.5 text-sm font-semibold text-fg">
          <Compass class="size-4 text-brand" />
          Take the tour
        </span>
        <span class="text-xs text-fg-muted">A two-minute guide to Browse, Library, Create and Manage.</span>
      </button>
      <button
        type="button"
        class="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-line-strong hover:bg-surface-hover"
        @click="onSkip"
      >
        <span class="flex items-center gap-1.5 text-sm font-semibold text-fg">
          <MousePointerClick class="size-4 text-fg-muted" />
          Explore on my own
        </span>
        <span class="text-xs text-fg-muted">Jump straight in. You can start the tour later.</span>
      </button>
    </div>
    <p class="mt-3 text-center text-xs text-fg-subtle">Restart the tour anytime from Account settings.</p>
  </Modal>
</template>

<script setup lang="ts">
  import { Compass, MousePointerClick } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';

  defineProps<{ show: boolean }>();
  const emit = defineEmits<{ take: []; skip: [] }>();

  // Public assets — bound as strings so Vite doesn't try to resolve them as modules
  const logoIconSrc = '/logo-icon.svg';
  const logoWordSrc = '/logo.svg';

  function onTake() {
    emit('take');
  }
  function onSkip() {
    emit('skip');
  }
</script>
