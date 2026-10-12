<template>
  <Modal
    :open="visible"
    :title="stageTitle"
    :description="stageDescription"
    :icon="stageIcon"
    :tone="stage === 'error' ? 'danger' : stage === 'completed' ? 'success' : 'ai'"
    size="sm"
    :dismissible="canClose"
    :hide-close="!canClose"
    @close="handleClose"
  >
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between text-xs">
          <span class="text-fg-subtle">Progress</span>
          <span class="tabular font-medium text-fg-muted">{{ Math.round(progress) }}%</span>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
          <div
            class="h-full rounded-full transition-[width] duration-500 ease-out"
            :class="stage === 'error' ? 'bg-danger' : 'bg-brand'"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>

      <Alert v-if="error" variant="destructive">
        <AlertTriangle />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <div class="flex items-center gap-2 text-xs text-fg-subtle">
        <span class="size-1.5 rounded-full" :class="isConnected ? 'bg-success' : 'bg-danger'" />
        <span>{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
  import { computed, watch } from 'vue';
  import {
    PlayIcon,
    Loader2Icon,
    BrainIcon,
    CheckCircleIcon,
    XCircleIcon,
    ActivityIcon,
    AlertTriangle,
  } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

  interface Props {
    visible: boolean;
    progress: number;
    stage: string;
    message: string;
    error: string;
    isConnected: boolean;
    canClose?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    canClose: false,
  });

  const emit = defineEmits<{
    close: [];
  }>();

  const stageIcon = computed(() => {
    switch (props.stage) {
      case 'starting':
        return PlayIcon;
      case 'transcribing':
        return Loader2Icon;
      case 'analyzing':
        return BrainIcon;
      case 'validating':
        return ActivityIcon;
      case 'completed':
        return CheckCircleIcon;
      case 'error':
        return XCircleIcon;
      default:
        return Loader2Icon;
    }
  });

  const stageTitle = computed(() => {
    switch (props.stage) {
      case 'starting':
        return 'Initializing';
      case 'transcribing':
        return 'Transcribing audio';
      case 'analyzing':
        return 'Detecting clips';
      case 'validating':
        return 'Validating results';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Processing';
    }
  });

  const stageDescription = computed(() => {
    switch (props.stage) {
      case 'starting':
        return 'Preparing to process your video...';
      case 'transcribing':
        return 'Converting audio to text using AI...';
      case 'analyzing':
        return 'Analyzing transcript for clip-worthy moments...';
      case 'validating':
        return 'Validating timestamps and refining clips...';
      case 'completed':
        return 'Clips have been successfully generated!';
      case 'error':
        return 'An error occurred during processing.';
      default:
        return 'Processing your request...';
    }
  });

  function handleClose() {
    if (props.canClose) {
      emit('close');
    }
  }

  // Auto-close when completed after a delay
  watch([() => props.stage, () => props.visible], ([stage, visible]) => {
    if (visible && stage === 'completed') {
      setTimeout(() => {
        emit('close');
      }, 3000); // Close after 3 seconds
    }
  });
</script>
