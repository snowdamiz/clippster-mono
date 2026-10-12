<script setup lang="ts">
  /**
   * Shared frame for the publish / schedule dialogs: Modal header, a form body
   * (default slot), an inline error alert and the Cancel + submit footer.
   * While `busy` the dialog can't be dismissed and the submit button spins.
   */
  import type { Component } from 'vue';
  import { AlertCircle } from 'lucide-vue-next';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import { Modal } from '@/components/ui/modal';

  type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

  withDefaults(
    defineProps<{
      open: boolean;
      title: string;
      description?: string;
      icon?: Component;
      size?: ModalSize;
      busy?: boolean;
      canSubmit?: boolean;
      submitLabel: string;
      busyLabel?: string;
      submitIcon?: Component;
      cancelLabel?: string;
      error?: string | null;
    }>(),
    { size: 'md', canSubmit: true, busyLabel: 'Publishing…', cancelLabel: 'Cancel' }
  );

  const emit = defineEmits<{ close: []; submit: [] }>();
</script>

<template>
  <Modal
    :open="open"
    :title="title"
    :description="description"
    :icon="icon"
    :size="size"
    :dismissible="!busy"
    :hide-close="busy"
    body-class="flex flex-col gap-4"
    @close="emit('close')"
  >
    <form class="flex flex-col gap-4" @submit.prevent="emit('submit')">
      <slot />
    </form>

    <Alert v-if="error" variant="destructive">
      <AlertCircle />
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <template #footer>
      <div v-if="$slots['footer-start']" class="mr-auto flex min-w-0 items-center gap-2 text-xs text-fg-subtle">
        <slot name="footer-start" />
      </div>
      <Button variant="ghost" :disabled="busy" @click="emit('close')">{{ cancelLabel }}</Button>
      <Button variant="primary" :disabled="!canSubmit || busy" :loading="busy" @click="emit('submit')">
        <component :is="submitIcon" v-if="submitIcon && !busy" />
        {{ busy ? busyLabel : submitLabel }}
      </Button>
    </template>
  </Modal>
</template>
