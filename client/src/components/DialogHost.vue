<template>
  <!-- Renders confirmDialog() / promptDialog() requests (see composables/useDialogs.ts). -->
  <ConfirmationModal
    :show="!!pendingConfirm"
    :title="pendingConfirm?.title"
    :message="pendingConfirm?.message ?? ''"
    suffix=""
    :confirm-text="pendingConfirm?.confirmText ?? 'Confirm'"
    :close-text="pendingConfirm?.cancelText ?? 'Cancel'"
    :variant="pendingConfirm?.variant ?? 'default'"
    :show-cannot-undone-text="false"
    @close="settleConfirm(false)"
    @confirm="settleConfirm(true)"
  />

  <Modal
    :open="!!pendingPrompt"
    :title="pendingPrompt?.title"
    :description="pendingPrompt?.message"
    size="sm"
    @close="settlePrompt(null)"
  >
    <form id="dialog-host-prompt" @submit.prevent="submitPrompt">
      <Field :label="pendingPrompt?.label" for="dialog-host-prompt-input">
        <Input
          id="dialog-host-prompt-input"
          v-model="promptValue"
          :placeholder="pendingPrompt?.placeholder"
          autofocus
        />
      </Field>
    </form>
    <template #footer>
      <Button variant="ghost" @click="settlePrompt(null)">{{ pendingPrompt?.cancelText ?? 'Cancel' }}</Button>
      <Button variant="primary" type="submit" form="dialog-host-prompt">{{ pendingPrompt?.confirmText ?? 'OK' }}</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import { Modal } from '@/components/ui/modal';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { useDialogHost } from '@/composables/useDialogs';

  const { pendingConfirm, pendingPrompt, settleConfirm, settlePrompt } = useDialogHost();

  const promptValue = ref('');
  watch(pendingPrompt, (pending) => {
    promptValue.value = pending?.defaultValue ?? '';
  });

  function submitPrompt() {
    settlePrompt(promptValue.value);
  }
</script>
