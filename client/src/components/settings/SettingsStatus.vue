<script setup lang="ts">
  /** Inline success / error line under a settings form. Renders nothing when both are empty. */
  import { AlertCircle, CheckCircle2 } from 'lucide-vue-next';

  defineProps<{
    success?: string | null;
    error?: string | null;
  }>();
</script>

<template>
  <p v-if="success" class="flex items-start gap-1.5 text-xs text-success" role="status">
    <CheckCircle2 class="mt-px size-3.5 shrink-0" />
    <span>{{ success }}</span>
  </p>
  <p v-if="error" class="flex items-start gap-1.5 text-xs text-danger" role="alert">
    <AlertCircle class="mt-px size-3.5 shrink-0" />
    <span>{{ error }}</span>
  </p>
</template>
