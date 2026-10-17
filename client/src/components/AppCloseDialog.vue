<template>
  <Modal :open="showCloseDialog" :title="dialogTitle" :icon="AlertTriangle" tone="warning" size="md" @close="cancelClose">
    <div class="flex flex-col gap-3">
      <ul v-if="items.length" class="flex flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle">
        <li v-for="item in items" :key="item.key" class="flex items-start gap-2.5 px-3 py-2.5">
          <component :is="item.icon" class="mt-0.5 size-4 shrink-0 text-fg-muted" />
          <div>
            <p class="text-sm text-fg">{{ item.text }}</p>
            <p v-if="item.hint" class="mt-0.5 text-xs text-fg-muted">{{ item.hint }}</p>
          </div>
        </li>
      </ul>

      <p class="text-sm text-fg-muted">
        Closing the application now {{ consequence }}. This can’t be undone.
      </p>
    </div>

    <template #footer>
      <Button variant="ghost" @click="cancelClose">Cancel</Button>
      <Button variant="destructive" @click="confirmCloseWithCleanup">{{ confirmButtonText }}</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  /**
   * Asks before quitting while something would be lost: downloads or recordings
   * in progress, clip detection, or unsaved edits (`useUnsavedChanges`). The
   * native close handler decides when to show it (see `useWindowClose`).
   */
  import { computed, type Component } from 'vue';
  import { AlertTriangle, Download, PenLine, Scissors } from 'lucide-vue-next';
  import { useWindowClose } from '@/composables/useWindowClose';
  import { hasUnsavedChanges } from '@/composables/useUnsavedChanges';
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';

  const { showCloseDialog, activeDownloadsCount, clipGenerationInProgress, confirmCloseWithCleanup, cancelClose } =
    useWindowClose();

  const items = computed(() => {
    const list: { key: string; icon: Component; text: string; hint?: string }[] = [];
    const downloads = activeDownloadsCount.value;
    if (downloads > 0) {
      list.push({
        key: 'downloads',
        icon: Download,
        text: `${downloads} download${downloads === 1 ? '' : 's'} or recording${downloads === 1 ? '' : 's'} in progress`,
      });
    }
    if (clipGenerationInProgress.value) {
      list.push({
        key: 'clips',
        icon: Scissors,
        text: 'Clip detection is running',
        hint: 'It takes significant time and resources to restart.',
      });
    }
    if (hasUnsavedChanges.value) {
      list.push({ key: 'unsaved', icon: PenLine, text: 'You have unsaved changes' });
    }
    return list;
  });

  const only = computed(() => (items.value.length === 1 ? items.value[0].key : null));

  const dialogTitle = computed(() => {
    if (only.value === 'downloads') return activeDownloadsCount.value === 1 ? 'Download in progress' : 'Downloads in progress';
    if (only.value === 'clips') return 'Clip detection in progress';
    if (only.value === 'unsaved') return 'Quit without saving?';
    return items.value.length > 1 ? 'Work in progress' : 'Close application?';
  });

  const consequence = computed(() => {
    if (only.value === 'unsaved') return 'discards your unsaved changes';
    if (items.value.some((item) => item.key === 'unsaved')) return 'cancels everything above and discards unsaved changes';
    return 'cancels everything above and may lose partially completed work';
  });

  const confirmButtonText = computed(() => {
    if (only.value === 'downloads') {
      return activeDownloadsCount.value === 1 ? 'Close and cancel download' : 'Close and cancel downloads';
    }
    if (only.value === 'clips') return 'Close and cancel clip detection';
    if (only.value === 'unsaved') return 'Discard and close';
    return 'Close application';
  });
</script>
