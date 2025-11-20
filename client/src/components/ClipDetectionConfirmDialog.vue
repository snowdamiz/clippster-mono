<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="close"
    >
      <div class="bg-card border border-border rounded-lg shadow-xl max-w-md w-full m-4 p-6">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-foreground">Detect Clips</h3>
          <button @click="close" class="p-1 hover:bg-[#ffffff]/10 rounded-md transition-colors">
            <X class="h-4 w-4 text-foreground/70 hover:text-foreground" />
          </button>
        </div>

        <!-- Video Duration Info -->
        <div v-if="videoDuration > 0" class="mb-4 p-3 bg-muted/30 rounded-md">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Video Duration:</span>
            <span class="font-medium">{{ formatDuration(videoDuration) }}</span>
          </div>
        </div>

        <!-- Prompt Selection -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-foreground mb-2">Detection Prompt</label>
          <div class="relative">
            <button
              @click="showPromptDropdown = !showPromptDropdown"
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-left flex items-center justify-between hover:border-primary/50 transition-colors"
            >
              <span class="truncate">
                {{ selectedPromptName || 'Select a prompt...' }}
              </span>
              <ChevronDown
                class="h-4 w-4 text-muted-foreground transition-transform"
                :class="{ 'rotate-180': showPromptDropdown }"
              />
            </button>

            <!-- Dropdown -->
            <div
              v-if="showPromptDropdown"
              class="absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-md shadow-lg z-10 max-h-48 overflow-y-auto"
            >
              <button
                v-for="prompt in prompts"
                :key="prompt.id"
                @click="selectPrompt(prompt)"
                class="block w-full text-left px-3 py-2 hover:bg-muted/80 transition-colors text-sm whitespace-nowrap"
                :class="{ 'bg-primary/10 text-primary': selectedPromptId === prompt.id }"
              >
                {{ prompt.name }}
              </button>
            </div>
          </div>
        </div>

        <!-- Credit Information -->
        <div class="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <div class="flex items-start gap-2">
            <Info class="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div class="text-sm">
              <p class="font-medium text-blue-900 dark:text-blue-100 mb-1">Credit Cost</p>
              <p class="text-blue-700 dark:text-blue-300">
                {{ creditInfo }}
              </p>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div
          v-if="error"
          class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
        >
          <p class="text-red-600 dark:text-red-400 text-sm">{{ error }}</p>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <button
            @click="close"
            :disabled="isProcessing"
            class="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            @click="confirm"
            :disabled="!selectedPromptId || isProcessing"
            class="px-4 py-2 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 disabled:from-gray-500/50 disabled:to-gray-600/50 disabled:cursor-not-allowed text-white rounded-md font-medium transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Loader2 v-if="isProcessing" class="h-4 w-4 animate-spin" />
            {{ isProcessing ? 'Detecting...' : 'Detect Clips' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { X, ChevronDown, Info, Loader2 } from 'lucide-vue-next';
  import { useCreditBalance } from '@/composables/useCreditBalance';
  import { useAuthStore } from '@/stores/auth';
  import { getAllPrompts } from '@/services/database';

  interface Prompt {
    id: string;
    name: string;
    content: string;
  }

  const props = defineProps<{
    modelValue: boolean;
    videoDuration: number;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [promptId: string, promptContent: string];
  }>();

  const showPromptDropdown = ref(false);
  const selectedPromptId = ref<string>('');
  const selectedPromptName = ref<string>('');
  const selectedPromptContent = ref<string>('');
  const isProcessing = ref(false);
  const error = ref<string>('');
  const prompts = ref<Prompt[]>([]);

  const authStore = useAuthStore();

  // Use credit balance composable
  const { loading: loadingCredits, error: creditError, hoursRemaining, isAdmin, fetchBalance } = useCreditBalance();

  // Computed credit information
  const creditInfo = computed(() => {
    if (isAdmin.value) {
      return 'Free (Admin Account)';
    }

    if (loadingCredits.value) {
      return 'Loading credit information...';
    }

    if (creditError.value) {
      return 'Failed to load credit information';
    }

    if (hoursRemaining.value === null) {
      return 'Loading credit information...';
    }

    const hoursToCharge = props.videoDuration / 3600; // Convert seconds to hours
    const creditsToCharge = hoursToCharge; // 1 credit = 1 hour

    if (hoursRemaining.value === 0) {
      return `No credits remaining. This operation requires ${creditsToCharge.toFixed(2)} credits.`;
    }

    if (hoursRemaining.value === 'unlimited') {
      return `This operation will charge ${creditsToCharge.toFixed(2)} credits. You have unlimited credits remaining.`;
    }

    if (hoursRemaining.value < creditsToCharge) {
      return `Insufficient credits. You have ${hoursRemaining.value.toFixed(2)} credits, but this operation requires ${creditsToCharge.toFixed(2)} credits.`;
    }

    return `This operation will charge ${creditsToCharge.toFixed(2)} credits. You have ${hoursRemaining.value.toFixed(2)} credits remaining.`;
  });

  // Close dropdown when clicking outside
  function handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      showPromptDropdown.value = false;
    }
  }

  function selectPrompt(prompt: Prompt) {
    selectedPromptId.value = prompt.id;
    selectedPromptName.value = prompt.name;
    selectedPromptContent.value = prompt.content;
    showPromptDropdown.value = false;
    error.value = '';
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  function close() {
    if (!isProcessing.value) {
      emit('update:modelValue', false);
    }
  }

  async function confirm() {
    if (!selectedPromptId.value) {
      error.value = 'Please select a detection prompt';
      return;
    }

    // Check authentication
    if (!authStore.isAuthenticated) {
      close();
      window.dispatchEvent(new CustomEvent('show-auth-modal'));
      return;
    }

    // Check credits for non-admin users
    if (!isAdmin.value && hoursRemaining.value !== null && !creditError.value) {
      const hoursToCharge = props.videoDuration / 3600;
      const creditsToCharge = hoursToCharge;

      if (hoursRemaining.value !== 'unlimited' && hoursRemaining.value < creditsToCharge) {
        error.value = 'Insufficient credits for this operation';
        return;
      }
    }

    isProcessing.value = true;
    error.value = '';

    try {
      emit('confirm', selectedPromptId.value, selectedPromptContent.value);
      emit('update:modelValue', false);
    } catch (err) {
      console.error('Detection failed:', err);
      error.value = err instanceof Error ? err.message : 'Detection failed';
    } finally {
      isProcessing.value = false;
    }
  }

  // Load user credits on mount
  async function loadUserCredits() {
    await fetchBalance();
  }

  // Load prompts function
  async function loadPrompts() {
    try {
      prompts.value = await getAllPrompts();
      console.log(`[ClipDetectionConfirmDialog] Loaded ${prompts.value.length} prompts`);

      // Select default prompt if none selected
      if (prompts.value.length > 0 && !selectedPromptId.value) {
        const defaultPrompt = prompts.value.find((p) => p.name === 'Default Clip Detector');
        if (defaultPrompt) {
          selectPrompt(defaultPrompt);
        } else {
          selectPrompt(prompts.value[0]);
        }
      }
    } catch (error) {
      console.error('[ClipDetectionConfirmDialog] Failed to load prompts:', error);
      prompts.value = [];
    }
  }

  // Load credits and prompts when dialog opens
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        loadUserCredits();
        loadPrompts();
        error.value = '';
        isProcessing.value = false;
      }
    }
  );

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>

<style scoped>
  .backdrop-blur-sm {
    backdrop-filter: blur(4px);
  }

  .transition-colors {
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }

  .z-50 {
    z-index: 50;
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
