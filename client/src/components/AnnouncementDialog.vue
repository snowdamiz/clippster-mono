<template>
  <Modal
    :open="!!currentAnnouncement"
    :title="currentAnnouncement?.title"
    :description="description"
    :icon="typeIcon"
    :tone="tone"
    size="md"
    @close="dismiss"
  >
    <!-- Rich HTML body authored by admins -->
    <div v-if="currentAnnouncement" class="announcement-body text-sm text-fg-muted" v-html="currentAnnouncement.body" />

    <template #footer>
      <Button v-if="queueLength > 1" variant="ghost" @click="dismiss">
        Next
        <ArrowRight />
      </Button>
      <Button variant="primary" @click="dismiss">
        <Check />
        Got it
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Info, AlertTriangle, Sparkles, Megaphone, Check, ArrowRight } from 'lucide-vue-next';
  import { useAnnouncements } from '@/composables/useAnnouncements';
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';

  const { currentAnnouncement, queueLength, dismissCurrent } = useAnnouncements();

  const currentIndex = computed(() => 0);

  const typeIcon = computed(() => {
    switch (currentAnnouncement.value?.type) {
      case 'warning':
        return AlertTriangle;
      case 'feature':
        return Sparkles;
      case 'campaign':
        return Megaphone;
      default:
        return Info;
    }
  });

  const typeLabel = computed(() => {
    switch (currentAnnouncement.value?.type) {
      case 'warning':
        return 'Warning';
      case 'feature':
        return 'New feature';
      case 'campaign':
        return 'Campaign';
      default:
        return 'Announcement';
    }
  });

  // Warnings carry status; every other announcement uses the brand accent.
  const tone = computed<'warning' | 'brand'>(() => (currentAnnouncement.value?.type === 'warning' ? 'warning' : 'brand'));

  const description = computed(() =>
    queueLength.value > 1 ? `${typeLabel.value} · ${currentIndex.value + 1} of ${queueLength.value}` : typeLabel.value
  );

  function dismiss() {
    dismissCurrent();
  }
</script>

<style scoped>
  /* Styles the admin-authored HTML body (v-html content). */
  .announcement-body {
    line-height: 1.6;
  }

  .announcement-body :deep(p),
  .announcement-body :deep(ul),
  .announcement-body :deep(ol) {
    margin: 0 0 0.75rem;
  }

  .announcement-body :deep(:last-child) {
    margin-bottom: 0;
  }

  .announcement-body :deep(ul),
  .announcement-body :deep(ol) {
    padding-left: 1.25rem;
  }

  .announcement-body :deep(ul) {
    list-style: disc;
  }

  .announcement-body :deep(ol) {
    list-style: decimal;
  }

  .announcement-body :deep(li) {
    margin-bottom: 0.25rem;
  }

  .announcement-body :deep(li::marker) {
    color: var(--fg-subtle);
  }

  .announcement-body :deep(strong),
  .announcement-body :deep(h1),
  .announcement-body :deep(h2),
  .announcement-body :deep(h3) {
    color: var(--fg);
    font-weight: 600;
  }

  .announcement-body :deep(h1),
  .announcement-body :deep(h2),
  .announcement-body :deep(h3) {
    font-size: var(--text-sm);
    margin: 0 0 0.5rem;
  }

  .announcement-body :deep(em) {
    font-style: italic;
  }

  .announcement-body :deep(a) {
    color: var(--brand);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .announcement-body :deep(a:hover) {
    color: var(--brand-hover);
  }
</style>
