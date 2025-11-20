<template>
  <div v-if="visible" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
    <div class="bg-card rounded-lg p-6 max-w-md w-full mx-4 border border-border shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-foreground">Generating Clips</h3>
        <button
          v-if="canClose"
          @click="handleClose"
          class="p-2 hover:bg-[#ffffff]/10 rounded-md transition-colors"
          title="Close"
        >
          <X class="h-4 w-4 text-foreground/70 hover:text-foreground" />
        </button>
      </div>
      <!-- Progress Content -->
      <div class="space-y-4">
        <!-- Stage Icon and Title -->
        <div class="flex items-center gap-3">
          <div class="flex-shrink-0">
            <component :is="stageIcon" :class="stageIconClass" class="h-6 w-6" />
          </div>

          <div class="flex-1 min-w-0">
            <h4 class="font-medium text-foreground">{{ stageTitle }}</h4>

            <p class="text-sm text-foreground/70">{{ stageDescription }}</p>
          </div>
        </div>
        <!-- Progress Bar -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-xs text-foreground/50">Progress</span>
            <span class="text-xs font-medium text-foreground/70">{{ progress }}%</span>
          </div>

          <div class="relative">
            <div class="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500 ease-out"
                :class="progressBarClass"
                :style="{ width: `${progress}%` }"
              />
            </div>
            <!-- Animated shine effect -->
            <div v-if="progress > 0 && progress < 100" class="absolute inset-0 h-full overflow-hidden rounded-full">
              <div
                class="h-full w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shine"
              />
            </div>
          </div>
        </div>
        <!-- Status Message -->
        <div v-if="message" class="text-sm text-foreground/60 bg-muted/30 rounded-md p-3">
          {{ message }}
        </div>
        <!-- Error State -->
        <div v-if="error" class="bg-destructive/10 border border-destructive/20 rounded-md p-3">
          <div class="flex items-start gap-2">
            <AlertTriangle class="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h4 class="font-medium text-destructive">Error</h4>

              <p class="text-sm text-destructive/80 mt-1">{{ error }}</p>
            </div>
          </div>
        </div>
        <!-- Connection Status -->
        <div class="flex items-center gap-2 text-xs text-foreground/50">
          <div class="w-2 h-2 rounded-full" :class="isConnected ? 'bg-green-500' : 'bg-red-500'" />
          <span>{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
        </div>
      </div>
    </div>
  </div>
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
    X,
    AlertTriangle,
  } from 'lucide-vue-next';

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

  const stageIconClass = computed(() => {
    switch (props.stage) {
      case 'starting':
        return 'text-blue-500';
      case 'transcribing':
        return 'text-yellow-500 animate-spin';
      case 'analyzing':
        return 'text-purple-500';
      case 'validating':
        return 'text-orange-500';
      case 'completed':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  });

  const stageTitle = computed(() => {
    switch (props.stage) {
      case 'starting':
        return 'Initializing';
      case 'transcribing':
        return 'Transcribing Audio';
      case 'analyzing':
        return 'Detecting Clips';
      case 'validating':
        return 'Validating Results';
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

  const progressBarClass = computed(() => {
    switch (props.stage) {
      case 'transcribing':
        return 'bg-yellow-500';
      case 'analyzing':
        return 'bg-purple-500';
      case 'validating':
        return 'bg-orange-500';
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
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

<style scoped>
  @keyframes shine {
    0% {
      transform: translateX(-100%) skewX(-12deg);
    }
    100% {
      transform: translateX(200%) skewX(-12deg);
    }
  }

  .animate-shine {
    animation: shine 2s infinite;
  }

  /* Backdrop blur effect */
  .backdrop-blur-sm {
    backdrop-filter: blur(4px);
  }

  /* Smooth transitions */
  .transition-colors {
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }
</style>
