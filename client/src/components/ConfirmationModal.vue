<template>
  <Modal
    :open="show"
    :title="title"
    :description="subtitle"
    :icon="variant === 'destructive' ? AlertTriangle : icon"
    :tone="variant === 'destructive' ? 'danger' : 'neutral'"
    size="sm"
    @close="$emit('close')"
  >
    <p class="text-sm text-fg-muted">
      {{ message }}
      <span v-if="itemName" class="font-medium text-fg">"{{ itemName }}"</span
      >{{ suffixText }}
    </p>
    <p v-if="showCannotUndoneText" class="mt-2 text-xs text-fg-subtle">This action cannot be undone.</p>

    <template #footer>
      <Button v-if="showOnlyCloseButton" variant="primary" @click="$emit('close')">{{ closeText }}</Button>
      <template v-else>
        <Button variant="ghost" @click="$emit('close')">{{ closeText }}</Button>
        <Button :variant="variant === 'destructive' ? 'destructive' : 'primary'" @click="$emit('confirm')">
          {{ confirmText }}
        </Button>
      </template>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { computed, type Component } from 'vue';
  import { AlertTriangle, HelpCircle } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Modal } from '@/components/ui/modal';

  interface Props {
    show: boolean;
    title?: string;
    subtitle?: string;
    message?: string;
    itemName?: string;
    suffix?: string;
    confirmText?: string;
    closeText?: string;
    showOnlyCloseButton?: boolean;
    showCannotUndoneText?: boolean;
    variant?: 'default' | 'destructive';
    icon?: Component;
  }

  const props = withDefaults(defineProps<Props>(), {
    title: 'Confirm action',
    message: 'Are you sure you want to',
    suffix: '?',
    confirmText: 'Confirm',
    closeText: 'Cancel',
    showOnlyCloseButton: false,
    showCannotUndoneText: true,
    variant: 'default',
    icon: () => HelpCircle,
  });

  /** Punctuation attaches to the item name; words get a leading space. */
  const suffixText = computed(() => {
    if (!props.suffix) return '';
    return /^[?.!,:;]/.test(props.suffix) ? props.suffix : ` ${props.suffix}`;
  });

  defineEmits<{
    (e: 'close'): void;
    (e: 'confirm'): void;
  }>();
</script>
