<script setup lang="ts">
  /**
   * Cancel and retry confirmations for scheduled posts. Pair with
   * `useScheduledPostActions()`:
   *
   *   <ScheduledPostConfirmDialogs v-model:canceling-post="cancelingPost" v-model:retrying-post="retryingPost"
   *     :saving="saving" @cancel="doCancel" @retry="doRetry" />
   */
  import { AlertTriangle, RefreshCw } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Modal } from '@/components/ui/modal';
  import type { ScheduledPost } from '@/services/schedulingApi';

  defineProps<{ saving: boolean }>();

  const cancelingPost = defineModel<ScheduledPost | null>('cancelingPost', { required: true });
  const retryingPost = defineModel<ScheduledPost | null>('retryingPost', { required: true });

  const emit = defineEmits<{ cancel: []; retry: [] }>();
</script>

<template>
  <Modal
    :open="!!cancelingPost"
    title="Cancel scheduled post?"
    :icon="AlertTriangle"
    tone="danger"
    size="sm"
    :dismissible="!saving"
    @close="cancelingPost = null"
  >
    <p class="text-sm text-fg-muted">This action cannot be undone. The post will not be published.</p>
    <template #footer>
      <Button variant="ghost" :disabled="saving" @click="cancelingPost = null">Keep post</Button>
      <Button variant="destructive" :loading="saving" @click="emit('cancel')">Cancel post</Button>
    </template>
  </Modal>

  <Modal
    :open="!!retryingPost"
    title="Retry failed post?"
    :icon="RefreshCw"
    size="sm"
    :dismissible="!saving"
    @close="retryingPost = null"
  >
    <p class="text-sm text-fg-muted">The post will be queued for publishing again in about 1 minute.</p>
    <template #footer>
      <Button variant="ghost" :disabled="saving" @click="retryingPost = null">Cancel</Button>
      <Button variant="primary" :loading="saving" @click="emit('retry')">Retry post</Button>
    </template>
  </Modal>
</template>
