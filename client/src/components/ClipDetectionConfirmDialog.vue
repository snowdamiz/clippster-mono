<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50">
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-sm sm:max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

            <div class="p-5 sm:p-6 lg:p-8">
              <!-- Header -->
              <div class="mb-4 sm:mb-6 text-center">
                <div
                  class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-3 sm:mb-4"
                >
                  <Sparkles class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-violet-400" />
                </div>
                <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">Detect Clips</h2>
                <p class="text-zinc-400 text-xs sm:text-sm mt-1">AI-powered clip detection</p>
              </div>

              <!-- Multi-Segment Info (project-level detection) -->
              <div
                v-if="segmentCount && segmentCount > 0"
                class="mb-4 sm:mb-5 p-3 sm:p-4 bg-zinc-900/80 rounded-lg sm:rounded-xl border border-zinc-800 space-y-1.5 sm:space-y-2"
              >
                <div class="flex items-center justify-between text-xs sm:text-sm">
                  <span class="text-zinc-400">Segments to Process:</span>
                  <span class="font-medium text-white">
                    {{ segmentCount }} segment{{ segmentCount !== 1 ? 's' : '' }}
                  </span>
                </div>
                <div class="flex items-center justify-between text-xs sm:text-sm">
                  <span class="text-zinc-400">Total Duration:</span>
                  <span class="font-medium text-white">{{ formatDuration(effectiveDuration) }}</span>
                </div>
              </div>

              <!-- Single Video Duration Info -->
              <div
                v-else-if="videoDuration > 0"
                class="mb-4 sm:mb-5 p-3 sm:p-4 bg-zinc-900/80 rounded-lg sm:rounded-xl border border-zinc-800"
              >
                <div class="flex items-center justify-between text-xs sm:text-sm">
                  <span class="text-zinc-400">Video Duration:</span>
                  <span class="font-medium text-white">{{ formatDuration(videoDuration) }}</span>
                </div>
              </div>

              <!-- Prompt Selection -->
              <div class="mb-4 sm:mb-5">
                <label class="block text-xs sm:text-sm font-medium text-zinc-300 mb-1.5 sm:mb-2">
                  Detection Prompt
                </label>
                <div class="relative">
                  <button
                    @click="showPromptDropdown = !showPromptDropdown"
                    class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-left flex items-center justify-between hover:border-zinc-700 transition-colors text-sm"
                  >
                    <span class="truncate text-white">
                      {{ selectedPromptName || 'Select a prompt...' }}
                    </span>
                    <ChevronDown
                      class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-400 transition-transform"
                      :class="{ 'rotate-180': showPromptDropdown }"
                    />
                  </button>

                  <!-- Dropdown -->
                  <div
                    v-if="showPromptDropdown"
                    class="absolute top-full left-0 right-0 mt-1.5 sm:mt-2 bg-zinc-900 border border-zinc-800 rounded-lg sm:rounded-xl overflow-hidden z-10 max-h-40 sm:max-h-48 overflow-y-auto custom-scrollbar"
                  >
                    <button
                      v-for="prompt in prompts"
                      :key="prompt.id"
                      @click="selectPrompt(prompt)"
                      class="block w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-zinc-800/80 transition-colors text-xs sm:text-sm whitespace-nowrap"
                      :class="{ 'bg-violet-500/10 text-violet-400': selectedPromptId === prompt.id }"
                    >
                      {{ prompt.name }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Enhanced Multimodal Detection Toggle -->
              <div class="mb-4 sm:mb-5 p-3 sm:p-4 bg-zinc-900/80 rounded-lg sm:rounded-xl border border-zinc-800">
                <div class="flex items-center justify-between">
                  <div class="flex-1 min-w-0 pr-3">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-white">Enhanced Detection</span>
                      <span class="px-1.5 py-0.5 text-[10px] font-semibold bg-violet-500/20 text-violet-400 rounded">2x Credits</span>
                    </div>
                    <p class="text-xs text-zinc-400 mt-1">
                      Uses 3 AI models in parallel for higher quality clip detection
                    </p>
                  </div>
                  <button
                    @click="multimodalEnabled = !multimodalEnabled"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                    :class="multimodalEnabled ? 'bg-violet-600' : 'bg-zinc-700'"
                    role="switch"
                    :aria-checked="multimodalEnabled"
                  >
                    <span
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      :class="multimodalEnabled ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>
              </div>

              <!-- Credit Source Selector (shown when user has org credits) -->
              <div v-if="showCreditSourceSelector" class="mb-4 sm:mb-5">
                <label class="block text-xs sm:text-sm font-medium text-zinc-300 mb-1.5 sm:mb-2">Pay with</label>
                <div class="space-y-2">
                  <button
                    v-for="option in creditSourceOptions"
                    :key="option.type + (option.organizationId || '')"
                    @click="option.type === 'personal' ? selectPersonal() : selectOrganization(option.organizationId!)"
                    class="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-left flex items-center gap-3 transition-all text-sm border"
                    :class="[
                      selectedSource === option.type &&
                      (option.type === 'personal' || selectedOrganizationId === option.organizationId)
                        ? 'bg-violet-500/20 border-violet-500/50 text-white'
                        : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white',
                    ]"
                  >
                    <div
                      class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      :class="option.type === 'personal' ? 'bg-zinc-800' : 'bg-violet-500/20'"
                    >
                      <User v-if="option.type === 'personal'" class="h-4 w-4 text-zinc-400" />
                      <Building2 v-else class="h-4 w-4 text-violet-400" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium truncate">{{ option.label }}</div>
                      <div class="text-xs text-zinc-500">
                        {{
                          option.hoursRemaining === -1
                            ? 'Unlimited'
                            : `${Math.round(option.hoursRemaining)} min remaining`
                        }}
                      </div>
                    </div>
                    <div
                      v-if="
                        selectedSource === option.type &&
                        (option.type === 'personal' || selectedOrganizationId === option.organizationId)
                      "
                      class="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0"
                    >
                      <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Credit Information -->
              <div class="mb-4 sm:mb-5 p-3 sm:p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg sm:rounded-xl">
                <div class="flex items-start gap-2 sm:gap-3">
                  <div
                    class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0"
                  >
                    <Info class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-400" />
                  </div>
                  <div class="flex-1">
                    <p class="font-medium text-blue-300 text-xs sm:text-sm mb-0.5 sm:mb-1">Credit Cost</p>
                    <p class="text-blue-400/80 text-[10px] sm:text-xs">
                      {{ creditInfo }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Error Message -->
              <div
                v-if="error"
                class="mb-4 sm:mb-5 p-3 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-lg sm:rounded-xl"
              >
                <p class="text-red-400 text-xs sm:text-sm">{{ error }}</p>
              </div>

              <!-- Actions -->
              <div class="flex gap-2 sm:gap-3">
                <button
                  @click="close"
                  :disabled="isProcessing"
                  class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  @click="confirm"
                  :disabled="!selectedPromptId || isProcessing"
                  class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <div
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <span class="relative flex items-center justify-center gap-1.5 sm:gap-2">
                    <Loader2 v-if="isProcessing" class="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                    {{ isProcessing ? 'Detecting...' : 'Detect Clips' }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { ChevronDown, Info, Loader2, Sparkles, Building2, User } from 'lucide-vue-next';
  import { useCreditSource } from '@/composables/useCreditSource';
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
    isTranscribed?: boolean;
    // Multi-segment mode props (for project-level detection)
    segmentCount?: number;
    totalDuration?: number;
  }>();

  // Use totalDuration if provided (multi-segment mode), otherwise use videoDuration
  const effectiveDuration = computed(() => props.totalDuration ?? props.videoDuration);

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [promptId: string, promptContent: string, organizationId: number | null, multimodal: boolean];
  }>();

  const showPromptDropdown = ref(false);
  const selectedPromptId = ref<string>('');
  const selectedPromptName = ref<string>('');
  const selectedPromptContent = ref<string>('');
  const isProcessing = ref(false);
  const error = ref<string>('');
  const prompts = ref<Prompt[]>([]);
  
  // Multimodal detection toggle
  const multimodalEnabled = ref(false);

  const authStore = useAuthStore();

  // Use credit source composable (includes balance + org allocations)
  const {
    loading: loadingCredits,
    selectedSource,
    selectedOrganizationId,
    creditSourceOptions,
    showCreditSourceSelector,
    selectedOption,
    selectedSourceHoursRemaining,
    organizationIdForApi,
    fetchBalance,
    hasEnoughCredits,
    selectPersonal,
    selectOrganization,
    reset: resetCreditSource,
  } = useCreditSource();

  // Check if user is admin (has unlimited credits)
  const isAdmin = computed(() => selectedSourceHoursRemaining.value === Infinity);

  // Calculate credits based on duration, transcription status, and multimodal mode
  const calculatedCredits = computed(() => {
    const minutesToCharge = effectiveDuration.value / 60; // Convert seconds to minutes
    // If already transcribed, charge 0.75 credits per minute, otherwise 1.0
    const baseRate = props.isTranscribed ? 0.75 : 1.0;
    // Apply 2x multiplier for multimodal mode
    const rate = multimodalEnabled.value ? baseRate * 2.0 : baseRate;
    return minutesToCharge * rate;
  });

  // Computed credit information based on selected source
  const creditInfo = computed(() => {
    if (isAdmin.value) {
      return 'Free (Admin Account)';
    }

    if (loadingCredits.value) {
      return 'Loading credit information...';
    }

    const creditsToCharge = calculatedCredits.value;
    const remaining = selectedSourceHoursRemaining.value;
    const sourceName =
      selectedOption.value?.type === 'organization' ? selectedOption.value.organizationName : 'Personal';

    const roundedCredits = Math.ceil(creditsToCharge);
    const roundedRemaining = Math.round(remaining);
    
    const multimodalNote = multimodalEnabled.value ? ' (2x for Enhanced Detection)' : '';

    if (remaining === 0) {
      return `No credits remaining in ${sourceName}. This operation requires ${roundedCredits} credits${multimodalNote}.`;
    }

    if (remaining < creditsToCharge) {
      return `Insufficient credits in ${sourceName}. You have ${roundedRemaining} credits, but this operation requires ${roundedCredits} credits${multimodalNote}.`;
    }

    return `This operation will charge ${roundedCredits} credits${multimodalNote} from ${sourceName}. You have ${roundedRemaining} credits remaining.`;
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
    if (!isAdmin.value) {
      const creditsToCharge = calculatedCredits.value;

      if (!hasEnoughCredits(creditsToCharge)) {
        error.value = 'Insufficient credits for this operation';
        return;
      }
    }

    isProcessing.value = true;
    error.value = '';

    try {
      // Include organizationId and multimodal flag
      console.log('[ClipDetectionConfirmDialog] Emitting confirm with multimodal:', multimodalEnabled.value);
      emit('confirm', selectedPromptId.value, selectedPromptContent.value, organizationIdForApi.value, multimodalEnabled.value);
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
        // Reset prompt selection state so user can choose fresh each time
        selectedPromptId.value = '';
        selectedPromptName.value = '';
        selectedPromptContent.value = '';
        showPromptDropdown.value = false;
        
        // Reset multimodal toggle (default off)
        multimodalEnabled.value = false;

        // Reset credit source selection
        resetCreditSource();

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
  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* Custom scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgb(63 63 70);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgb(82 82 91);
  }
</style>
