<template>
  <Modal
    :open="show"
    title="Add X live broadcast"
    description="This monitor is for one live session only"
    :icon="XLogo"
    size="md"
    @close="$emit('cancel')"
  >
    <div class="flex flex-col gap-3 text-sm text-fg-muted">
      <p>
        X does not provide a reusable channel URL like Twitch or Kick. Each time a creator goes live, they get a
        <strong class="font-medium text-fg">new broadcast link</strong> (for example
        <code class="rounded bg-surface-sunken px-1 py-px font-mono text-xs text-fg">x.com/i/broadcasts/…</code> or
        <code class="rounded bg-surface-sunken px-1 py-px font-mono text-xs text-fg">x.com/i/spaces/…</code>).
      </p>
      <ul class="flex list-disc flex-col gap-1.5 pl-5 marker:text-fg-subtle">
        <li>This card tracks <strong class="font-medium text-fg">only this broadcast URL</strong>, not the creator’s profile.</li>
        <li>
          When the stream ends and temporary recordings are cleaned up, this card is
          <strong class="font-medium text-fg">removed automatically</strong>.
        </li>
        <li>Next time they go live, paste the <strong class="font-medium text-fg">new</strong> broadcast URL from X.</li>
      </ul>
    </div>

    <template #footer>
      <Button variant="ghost" @click="$emit('cancel')">Cancel</Button>
      <Button variant="primary" @click="$emit('confirm')">I understand, add broadcast</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import XLogo from '@/components/icons/XLogo.vue';
  import { Button } from '@/components/ui/button';
  import { Modal } from '@/components/ui/modal';

  defineProps<{
    show: boolean;
  }>();

  defineEmits<{
    (e: 'confirm'): void;
    (e: 'cancel'): void;
  }>();
</script>
