<template>
  <Modal
    :open="show"
    size="md"
    title="Auto-detection already active"
    :icon="AlertCircle"
    tone="warning"
    @close="$emit('close')"
  >
    <div class="flex flex-col gap-3 text-sm text-fg-muted">
      <p>
        You're currently auto-detecting clips on <strong class="font-semibold text-fg">{{ activeStreamerName }}</strong>.
        Only one stream can use AI-powered auto-detection at a time.
      </p>
      <p>
        To auto-detect <strong class="font-semibold text-fg">{{ requestedStreamerName }}</strong>, you'll need to stop
        the current detection first. Alternatively, you can watch
        <strong class="font-semibold text-fg">{{ requestedStreamerName }}</strong> live and manually clip moments as they
        happen.
      </p>
    </div>

    <template #footer>
      <Button variant="primary" @click="$emit('close')">OK</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { AlertCircle } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Modal } from '@/components/ui/modal';

  interface Props {
    show: boolean;
    activeStreamerName: string;
    requestedStreamerName: string;
  }

  interface Emits {
    (e: 'close'): void;
  }

  defineProps<Props>();
  defineEmits<Emits>();
</script>
