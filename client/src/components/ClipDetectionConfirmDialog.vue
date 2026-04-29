<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="detect-clips-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="detect-clips-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="detect-clips-dialog__accent"></div>

            <!-- Header -->
            <div class="detect-clips-dialog__header">
              <button class="detect-clips-dialog__close" @click="close" :disabled="isProcessing" title="Close">
                <X :size="18" />
              </button>
              <div class="detect-clips-dialog__icon">
                <Sparkles :size="24" />
              </div>
              <h2 class="detect-clips-dialog__title">Detect Clips</h2>
              <p class="detect-clips-dialog__subtitle">AI-powered clip detection</p>
            </div>

            <!-- Content -->
            <div class="detect-clips-dialog__content">
              <!-- Multi-Segment Info (project-level detection) -->
              <div
                v-if="segmentCount && segmentCount > 0"
                class="detect-clips-dialog__field detect-clips-dialog__info-box"
              >
                <div class="flex items-center justify-between text-xs sm:text-sm">
                  <span>Segments to Process:</span>
                  <span class="font-medium">{{ segmentCount }} segment{{ segmentCount !== 1 ? 's' : '' }}</span>
                </div>
                <div class="flex items-center justify-between text-xs sm:text-sm">
                  <span>Total Duration:</span>
                  <span class="font-medium">{{ formatDuration(effectiveDuration) }}</span>
                </div>
              </div>

              <!-- Single Video Duration Info -->
              <div v-else-if="videoDuration > 0" class="detect-clips-dialog__field detect-clips-dialog__info-box">
                <div class="flex items-center justify-between text-xs sm:text-sm">
                  <span>Video Duration:</span>
                  <span class="font-medium">{{ formatDuration(videoDuration) }}</span>
                </div>
              </div>

              <!-- Time Range Selection (only for single video, not multi-segment) -->
              <div v-if="!segmentCount && videoDuration > 0" class="detect-clips-dialog__field">
                <label class="detect-clips-dialog__label">Detection Time Range</label>
                <TimeRangePicker
                  v-model="timeRange"
                  :total-duration="videoDuration"
                />
              </div>

              <!-- Prompt Selection -->
              <div class="detect-clips-dialog__field">
                <label class="detect-clips-dialog__label">Detection Prompt</label>
                <div class="relative">
                  <button
                    @click="showPromptDropdown = !showPromptDropdown"
                    class="detect-clips-dialog__input detect-clips-dialog__select"
                  >
                    <span class="truncate">
                      {{ selectedPromptName || 'Select a prompt...' }}
                    </span>
                    <ChevronDown
                      class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform"
                      :class="{ 'rotate-180': showPromptDropdown }"
                    />
                  </button>

                  <!-- Dropdown -->
                  <div v-if="showPromptDropdown" class="detect-clips-dialog__dropdown">
                    <button
                      v-for="prompt in prompts"
                      :key="prompt.id"
                      @click="selectPrompt(prompt)"
                      class="detect-clips-dialog__dropdown-item"
                      :class="{ 'detect-clips-dialog__dropdown-item--selected': selectedPromptId === prompt.id }"
                    >
                      {{ prompt.name }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Subtitle Selection -->
              <div class="detect-clips-dialog__field">
                <div class="detect-clips-dialog__toggle-box">
                  <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0 pr-3">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium">Include Subtitles</span>
                      </div>
                      <p class="text-xs mt-1 opacity-70">
                        Automatically add subtitles to all detected clips
                      </p>
                    </div>
                    <button
                      @click="subtitlesEnabled = !subtitlesEnabled"
                      class="detect-clips-dialog__toggle"
                      :class="{ 'detect-clips-dialog__toggle--active': subtitlesEnabled }"
                      role="switch"
                      :aria-checked="subtitlesEnabled"
                    >
                      <span
                        class="detect-clips-dialog__toggle-thumb"
                        :class="{ 'detect-clips-dialog__toggle-thumb--active': subtitlesEnabled }"
                      />
                    </button>
                  </div>
                </div>

                <!-- Subtitle Preset Selection (shown when subtitles enabled) -->
                <div v-if="subtitlesEnabled" class="mt-3">
                  <label class="detect-clips-dialog__label mb-2">Select Subtitle Style</label>
                  <div class="grid grid-cols-3 gap-2">
                    <!-- Mr Beast Preset -->
                    <button
                      @click="selectedSubtitlePreset = 'mr-beast'"
                      class="detect-clips-dialog__preset-card"
                      :class="{ 'detect-clips-dialog__preset-card--selected': selectedSubtitlePreset === 'mr-beast' }"
                    >
                      <div class="detect-clips-dialog__preset-header">
                        <span class="font-semibold text-xs">MrBeast</span>
                        <div
                          v-if="selectedSubtitlePreset === 'mr-beast'"
                          class="detect-clips-dialog__preset-check"
                        >
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div class="detect-clips-dialog__preset-sample" style="background: linear-gradient(135deg, #1a1a1c 0%, #2a2a2c 100%);">
                        <span style="color: #FACC15; font-family: 'Bebas Neue', sans-serif; font-size: 18px; font-weight: normal; letter-spacing: 1.5px; text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 8px rgba(239, 68, 68, 0.5);">SAMPLE TEXT</span>
                      </div>
                      <p class="text-[10px] text-muted-foreground mt-1">Bold yellow, YouTube style</p>
                    </button>

                    <!-- TikTok Bold Preset -->
                    <button
                      @click="selectedSubtitlePreset = 'tiktok-bold'"
                      class="detect-clips-dialog__preset-card"
                      :class="{ 'detect-clips-dialog__preset-card--selected': selectedSubtitlePreset === 'tiktok-bold' }"
                    >
                      <div class="detect-clips-dialog__preset-header">
                        <span class="font-semibold text-xs">TikTok Bold</span>
                        <div
                          v-if="selectedSubtitlePreset === 'tiktok-bold'"
                          class="detect-clips-dialog__preset-check"
                        >
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div class="detect-clips-dialog__preset-sample" style="background: linear-gradient(135deg, #1a1a1c 0%, #2a2a2c 100%);">
                        <span style="color: #FFFFFF; font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 900; background: rgba(0,0,0,0.8); padding: 4px 8px; border-radius: 4px;">SAMPLE TEXT</span>
                      </div>
                      <p class="text-[10px] text-muted-foreground mt-1">White text, thick outline</p>
                    </button>

                    <!-- Clean Subtitle Preset -->
                    <button
                      @click="selectedSubtitlePreset = 'subtitle-tutorial'"
                      class="detect-clips-dialog__preset-card"
                      :class="{ 'detect-clips-dialog__preset-card--selected': selectedSubtitlePreset === 'subtitle-tutorial' }"
                    >
                      <div class="detect-clips-dialog__preset-header">
                        <span class="font-semibold text-xs">Clean Subtitle</span>
                        <div
                          v-if="selectedSubtitlePreset === 'subtitle-tutorial'"
                          class="detect-clips-dialog__preset-check"
                        >
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div class="detect-clips-dialog__preset-sample" style="background: linear-gradient(135deg, #1a1a1c 0%, #2a2a2c 100%);">
                        <span style="color: #FFFFFF; font-family: 'Roboto', sans-serif; font-size: 14px; font-weight: normal; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 4px;">Sample Text</span>
                      </div>
                      <p class="text-[10px] text-muted-foreground mt-1">Professional, readable</p>
                    </button>

                    <!-- Neon Glow Preset -->
                    <button
                      @click="selectedSubtitlePreset = 'neon-glow'"
                      class="detect-clips-dialog__preset-card"
                      :class="{ 'detect-clips-dialog__preset-card--selected': selectedSubtitlePreset === 'neon-glow' }"
                    >
                      <div class="detect-clips-dialog__preset-header">
                        <span class="font-semibold text-xs">Neon Glow</span>
                        <div
                          v-if="selectedSubtitlePreset === 'neon-glow'"
                          class="detect-clips-dialog__preset-check"
                        >
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div class="detect-clips-dialog__preset-sample" style="background: linear-gradient(135deg, #1a1a1c 0%, #2a2a2c 100%);">
                        <span style="color: #FFFFFF; font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: bold; text-shadow: 0 0 10px #22D3EE, 0 0 20px #22D3EE, 0 0 30px #22D3EE;">SAMPLE TEXT</span>
                      </div>
                      <p class="text-[10px] text-muted-foreground mt-1">Cyan glow, modern</p>
                    </button>

                    <!-- Karaoke Preset -->
                    <button
                      @click="selectedSubtitlePreset = 'karaoke'"
                      class="detect-clips-dialog__preset-card"
                      :class="{ 'detect-clips-dialog__preset-card--selected': selectedSubtitlePreset === 'karaoke' }"
                    >
                      <div class="detect-clips-dialog__preset-header">
                        <span class="font-semibold text-xs">Karaoke</span>
                        <div
                          v-if="selectedSubtitlePreset === 'karaoke'"
                          class="detect-clips-dialog__preset-check"
                        >
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div class="detect-clips-dialog__preset-sample" style="background: linear-gradient(135deg, #1a1a1c 0%, #2a2a2c 100%);">
                        <span style="color: #FFFFFF; font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: bold;">
                          <span style="color: #0ea5e9;">WORD</span> BY <span style="color: #0ea5e9;">WORD</span>
                        </span>
                      </div>
                      <p class="text-[10px] text-muted-foreground mt-1">Word-by-word highlight</p>
                    </button>
                  </div>

                  <!-- Validation message -->
                  <div v-if="subtitlesEnabled && !selectedSubtitlePreset" class="detect-clips-dialog__alert detect-clips-dialog__alert--error mt-2">
                    <p class="text-xs">Please select a subtitle style to continue</p>
                  </div>
                </div>
              </div>

              <!-- Credit Source Selector (shown when user has org credits) -->
              <div v-if="showCreditSourceSelector" class="detect-clips-dialog__field">
                <label class="detect-clips-dialog__label">Pay with</label>
                <div class="space-y-2">
                  <button
                    v-for="option in creditSourceOptions"
                    :key="option.type + (option.organizationId || '')"
                    @click="option.type === 'personal' ? selectPersonal() : selectOrganization(option.organizationId!)"
                    class="detect-clips-dialog__credit-option"
                    :class="{
                      'detect-clips-dialog__credit-option--selected':
                        selectedSource === option.type &&
                        (option.type === 'personal' || selectedOrganizationId === option.organizationId),
                    }"
                  >
                    <div
                      class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      :style="{
                        backgroundColor:
                          option.type === 'personal' ? 'var(--sidebar-hover)' : 'rgba(6, 182, 212, 0.15)',
                      }"
                    >
                      <User v-if="option.type === 'personal'" class="h-4 w-4" />
                      <Building2 v-else class="h-4 w-4" style="color: var(--sidebar-accent)" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium truncate">{{ option.label }}</div>
                      <div class="text-xs opacity-60">
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
                      class="detect-clips-dialog__checkmark"
                    >
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Credit Information -->
              <div class="detect-clips-dialog__alert detect-clips-dialog__alert--info">
                <Info :size="16" />
                <div class="flex-1">
                  <p class="font-medium text-xs sm:text-sm mb-0.5 sm:mb-1">Credit Cost</p>
                  <p class="text-[10px] sm:text-xs opacity-80">
                    {{ creditInfo }}
                  </p>
                </div>
              </div>

              <!-- Error Message -->
              <div v-if="error" class="detect-clips-dialog__alert detect-clips-dialog__alert--error">
                <p class="text-xs sm:text-sm">{{ error }}</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="detect-clips-dialog__footer">
              <button
                @click="close"
                :disabled="isProcessing"
                class="detect-clips-dialog__btn detect-clips-dialog__btn--secondary"
              >
                Cancel
              </button>
              <button
                @click="confirm"
                :disabled="!selectedPromptId || isProcessing || (!isAdmin && !hasEnoughCredits(calculatedCredits))"
                class="detect-clips-dialog__btn detect-clips-dialog__btn--primary"
              >
                <Loader2 v-if="isProcessing" :size="16" class="detect-clips-dialog__spinner" />
                {{ isProcessing ? 'Detecting...' : 'Detect Clips' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { ChevronDown, Info, Loader2, Sparkles, Building2, User, X } from 'lucide-vue-next';
  import { useCreditSource } from '@/composables/useCreditSource';
  import { useAuthStore } from '@/stores/auth';
  import { getAllPrompts } from '@/services/database';
  import TimeRangePicker from '@/components/TimeRangePicker.vue';

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
    /** From VOD preset / creator clip defaults — pre-select subtitle options when opening */
    initialSubtitleDetectionDefaults?: { enabled: boolean; presetId: string } | null;
  }>();

  // Use totalDuration if provided (multi-segment mode), otherwise use videoDuration
  const effectiveDuration = computed(() => props.totalDuration ?? props.videoDuration);

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [
      promptId: string,
      promptContent: string,
      organizationId: number | null,
      startTime: number,
      endTime: number,
      subtitleSettings?: { enabled: boolean; presetId: string } | null
    ];
  }>();

  const showPromptDropdown = ref(false);
  const selectedPromptId = ref<string>('');
  const selectedPromptName = ref<string>('');
  const selectedPromptContent = ref<string>('');
  const isProcessing = ref(false);
  const error = ref<string>('');
  const prompts = ref<Prompt[]>([]);

  // Subtitle selection
  const subtitlesEnabled = ref(false);
  const selectedSubtitlePreset = ref<string>('');

  watch(
    () => props.modelValue,
    (open) => {
      if (open && props.initialSubtitleDetectionDefaults) {
        subtitlesEnabled.value = props.initialSubtitleDetectionDefaults.enabled;
        selectedSubtitlePreset.value = props.initialSubtitleDetectionDefaults.presetId;
      }
    }
  );

  // Time range selection (for single video detection)
  const timeRange = ref({ startTime: 0, endTime: 0 });

  // Calculate selected duration
  const selectedDuration = computed(() => {
    return Math.max(0, timeRange.value.endTime - timeRange.value.startTime);
  });

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

  // Calculate credits based on duration and transcription status
  // Must match server's per-step ceil math:
  //   - Not transcribed: ceil(minutes * 0.3) [transcribe] + ceil(minutes * 0.7) [detect]
  //   - Already transcribed: ceil(minutes * 0.7) [detect only]
  const calculatedCredits = computed(() => {
    // For multi-segment mode, use total duration; for single video, use selected range
    const durationToCharge = props.segmentCount ? effectiveDuration.value : selectedDuration.value;
    const minutesToCharge = durationToCharge / 60; // Convert seconds to minutes

    if (props.isTranscribed) {
      // Detection only: ceil(minutes * 0.7)
      return Math.ceil(minutesToCharge * 0.7);
    } else {
      // Transcription + detection, each ceiled separately (matches server)
      const transcriptionCredits = Math.ceil(minutesToCharge * 0.3);
      const detectionCredits = Math.ceil(minutesToCharge * 0.7);
      return transcriptionCredits + detectionCredits;
    }
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

    if (remaining === 0) {
      return `No credits remaining in ${sourceName}. This operation requires ${roundedCredits} credits.`;
    }

    if (remaining < creditsToCharge) {
      const adjustRangeHint = !props.segmentCount && props.videoDuration > 0 
        ? ' Adjust the time range above to reduce the cost.' 
        : '';
      return `Insufficient credits in ${sourceName}. You have ${roundedRemaining} credits, but this operation requires ${roundedCredits} credits.${adjustRangeHint}`;
    }

    return `This operation will charge ${roundedCredits} credits from ${sourceName}. You have ${roundedRemaining} credits remaining.`;
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

    // Validate subtitle selection if enabled
    if (subtitlesEnabled.value && !selectedSubtitlePreset.value) {
      error.value = 'Please select a subtitle style';
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
        error.value = `Insufficient credits. This operation requires ${creditsToCharge} credits but you don't have enough.`;
        return;
      }
    }

    isProcessing.value = true;
    error.value = '';

    try {
      // Include organizationId and time range
      // Prepare subtitle settings
      const subtitleSettings = subtitlesEnabled.value && selectedSubtitlePreset.value
        ? { enabled: true, presetId: selectedSubtitlePreset.value }
        : null;

      console.log(
        '[ClipDetectionConfirmDialog] Emitting confirm subtitles:',
        subtitleSettings,
        'time range:',
        timeRange.value.startTime,
        '-',
        timeRange.value.endTime
      );
      emit(
        'confirm',
        selectedPromptId.value,
        selectedPromptContent.value,
        organizationIdForApi.value,
        timeRange.value.startTime,
        timeRange.value.endTime,
        subtitleSettings
      );
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

        // Reset subtitle selection (default off)
        subtitlesEnabled.value = false;
        selectedSubtitlePreset.value = '';

        // Reset time range to full video duration
        timeRange.value = { startTime: 0, endTime: props.videoDuration };

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
  /* ===== Overlay ===== */
  .detect-clips-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  /* ===== Dialog Container ===== */
  .detect-clips-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ===== Accent Bar ===== */
  .detect-clips-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .detect-clips-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .detect-clips-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .detect-clips-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .detect-clips-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .detect-clips-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .detect-clips-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .detect-clips-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .detect-clips-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .detect-clips-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .detect-clips-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .detect-clips-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Form Field ===== */
  .detect-clips-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .detect-clips-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .detect-clips-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .detect-clips-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .detect-clips-dialog__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .detect-clips-dialog__select {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .detect-clips-dialog__select:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  /* ===== Dropdown ===== */
  .detect-clips-dialog__dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    overflow: hidden;
    z-index: 10;
    max-height: 12rem;
    overflow-y: auto;
  }

  .detect-clips-dialog__dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .detect-clips-dialog__dropdown::-webkit-scrollbar-track {
    background: transparent;
  }

  .detect-clips-dialog__dropdown::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .detect-clips-dialog__dropdown-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.625rem 0.75rem;
    border-radius: 5px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    transition: background-color 150ms ease;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .detect-clips-dialog__dropdown-item:hover {
    background-color: var(--sidebar-hover);
  }

  .detect-clips-dialog__dropdown-item--selected {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  /* ===== Info Box ===== */
  .detect-clips-dialog__info-box {
    padding: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    gap: 0.5rem;
  }

  /* ===== Toggle Box ===== */
  .detect-clips-dialog__toggle-box {
    padding: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
  }

  .detect-clips-dialog__badge {
    padding: 0.125rem 0.375rem;
    font-size: 0.625rem;
    font-weight: 600;
    background-color: rgba(6, 182, 212, 0.2);
    color: var(--sidebar-accent);
    border-radius: 4px;
  }

  .detect-clips-dialog__toggle {
    position: relative;
    display: inline-flex;
    height: 24px;
    width: 44px;
    flex-shrink: 0;
    cursor: pointer;
    border-radius: 9999px;
    border: 2px solid transparent;
    background-color: var(--sidebar-hover);
    transition: background-color 200ms ease-in-out;
  }

  .detect-clips-dialog__toggle:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--sidebar-accent);
  }

  .detect-clips-dialog__toggle--active {
    background-color: var(--sidebar-accent);
  }

  .detect-clips-dialog__toggle-thumb {
    pointer-events: none;
    display: inline-block;
    height: 20px;
    width: 20px;
    transform: translateX(0);
    border-radius: 9999px;
    background-color: white;
    transition: transform 200ms ease-in-out;
  }

  .detect-clips-dialog__toggle-thumb--active {
    transform: translateX(20px);
  }

  /* ===== Credit Option ===== */
  .detect-clips-dialog__credit-option {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: all 150ms ease;
    font-size: 0.875rem;
    border: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    cursor: pointer;
  }

  .detect-clips-dialog__credit-option:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .detect-clips-dialog__credit-option--selected {
    background-color: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .detect-clips-dialog__checkmark {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: var(--sidebar-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: white;
  }

  /* ===== Alert Box ===== */
  .detect-clips-dialog__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .detect-clips-dialog__alert--info {
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .detect-clips-dialog__alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  /* ===== Footer ===== */
  .detect-clips-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .detect-clips-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .detect-clips-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .detect-clips-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .detect-clips-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .detect-clips-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: #000;
  }

  .detect-clips-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .detect-clips-dialog__spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ===== Subtitle Preset Cards ===== */
  .detect-clips-dialog__preset-card {
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-hover);
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .detect-clips-dialog__preset-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background-color: var(--sidebar-active);
  }

  .detect-clips-dialog__preset-card--selected {
    border-color: rgba(6, 182, 212, 0.4);
    background-color: rgba(6, 182, 212, 0.1);
  }

  .detect-clips-dialog__preset-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    color: var(--sidebar-text);
  }

  .detect-clips-dialog__preset-check {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: var(--sidebar-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: white;
  }

  .detect-clips-dialog__preset-sample {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem 0.5rem;
    border-radius: 6px;
    min-height: 60px;
    overflow: hidden;
  }
</style>
