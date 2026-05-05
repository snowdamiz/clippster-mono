<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="transcribe-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="transcribe-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="transcribe-dialog__accent"></div>

            <!-- Header -->
            <div class="transcribe-dialog__header">
              <button class="transcribe-dialog__close" @click="close" :disabled="isProcessing" title="Close">
                <X :size="18" />
              </button>
              <div class="transcribe-dialog__icon">
                <FileText :size="24" />
              </div>
              <h2 class="transcribe-dialog__title">Generate Transcript</h2>
              <p class="transcribe-dialog__subtitle">AI-powered speech-to-text</p>
            </div>

            <!-- Content -->
            <div class="transcribe-dialog__content">
              <!-- Multi-Segment Info -->
              <div
                v-if="segmentCount && segmentCount > 0"
                class="transcribe-dialog__field transcribe-dialog__info-box"
              >
                <div class="flex items-center justify-between text-xs sm:text-sm">
                  <span>{{ itemLabelPlural }} to Transcribe:</span>
                  <span class="font-medium">{{ segmentCount }} {{ itemLabel }}{{ segmentCount !== 1 ? 's' : '' }}</span>
                </div>
                <div class="flex items-center justify-between text-xs sm:text-sm">
                  <span>Total Duration:</span>
                  <span class="font-medium">{{ formatDuration(effectiveDuration) }}</span>
                </div>
              </div>

              <!-- Single Video Duration Info -->
              <div v-else-if="videoDuration > 0" class="transcribe-dialog__field transcribe-dialog__info-box">
                <div class="flex items-center justify-between text-xs sm:text-sm">
                  <span>Video Duration:</span>
                  <span class="font-medium">{{ formatDuration(videoDuration) }}</span>
                </div>
              </div>

              <!-- Already Transcribed Badge -->
              <div v-if="isTranscribed" class="transcribe-dialog__alert transcribe-dialog__alert--success">
                <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <div class="flex-1">
                  <p class="font-medium text-xs sm:text-sm">Already Transcribed</p>
                  <p class="text-[10px] sm:text-xs opacity-80">
                    This video already has a transcript. No additional credits needed.
                  </p>
                </div>
              </div>

              <!-- Credit Source Selector (shown when user has org credits and not already transcribed) -->
              <div v-if="showCreditSourceSelector && !isTranscribed" class="transcribe-dialog__field">
                <label class="transcribe-dialog__label">Pay with</label>
                <div class="space-y-2">
                  <button
                    v-for="option in creditSourceOptions"
                    :key="option.type + (option.organizationId || '')"
                    @click="option.type === 'personal' ? selectPersonal() : selectOrganization(option.organizationId!)"
                    class="transcribe-dialog__credit-option"
                    :class="{
                      'transcribe-dialog__credit-option--selected':
                        selectedSource === option.type &&
                        (option.type === 'personal' || selectedOrganizationId === option.organizationId),
                    }"
                  >
                    <div
                      class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      :style="{
                        backgroundColor:
                          option.type === 'personal' ? 'var(--sidebar-hover)' : 'rgba(34, 197, 94, 0.15)',
                      }"
                    >
                      <User v-if="option.type === 'personal'" class="h-4 w-4" />
                      <Building2 v-else class="h-4 w-4" style="color: #22c55e" />
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
                      class="transcribe-dialog__checkmark"
                    >
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Credit Information (only when not already transcribed) -->
              <div v-if="!isTranscribed" class="transcribe-dialog__alert transcribe-dialog__alert--info">
                <Info :size="16" />
                <div class="flex-1">
                  <p class="font-medium text-xs sm:text-sm mb-0.5 sm:mb-1">Credit Cost</p>
                  <p class="text-[10px] sm:text-xs opacity-80">
                    {{ creditInfo }}
                  </p>
                </div>
              </div>

              <!-- Error Message -->
              <div v-if="error" class="transcribe-dialog__alert transcribe-dialog__alert--error">
                <p class="text-xs sm:text-sm">{{ error }}</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="transcribe-dialog__footer">
              <button
                @click="close"
                :disabled="isProcessing"
                class="transcribe-dialog__btn transcribe-dialog__btn--secondary"
              >
                Cancel
              </button>
              <button
                @click="confirm"
                :disabled="isProcessing || isTranscribed"
                class="transcribe-dialog__btn transcribe-dialog__btn--primary"
              >
                <Loader2 v-if="isProcessing" :size="16" class="transcribe-dialog__spinner" />
                {{ isProcessing ? 'Transcribing...' : isTranscribed ? 'Already Done' : 'Transcribe' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { Info, Loader2, FileText, Building2, User, X } from 'lucide-vue-next';
  import { useCreditSource } from '@/composables/useCreditSource';
  import { useAuthStore } from '@/stores/auth';

  interface Props {
    modelValue: boolean;
    videoDuration?: number;
    segmentCount?: number;
    totalDuration?: number;
    isTranscribed?: boolean;
    itemLabel?: string;
  }

  const props = withDefaults(defineProps<Props>(), {
    videoDuration: 0,
    segmentCount: 0,
    totalDuration: 0,
    isTranscribed: false,
    itemLabel: 'segment',
  });

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [organizationId: number | null];
  }>();

  const error = ref('');
  const isProcessing = ref(false);

  const authStore = useAuthStore();

  // Use credit source composable
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

  // Check if user is admin
  const isAdmin = computed(() => selectedSourceHoursRemaining.value === Infinity);

  // Effective duration (use totalDuration for multi-segment, otherwise videoDuration)
  const effectiveDuration = computed(() => {
    if (props.totalDuration > 0) return props.totalDuration;
    return props.videoDuration;
  });

  const itemLabel = computed(() => props.itemLabel || 'segment');
  const itemLabelPlural = computed(() => `${itemLabel.value.charAt(0).toUpperCase()}${itemLabel.value.slice(1)}s`);

  // Calculate credits: 0.3 credits per minute for transcription
  const calculatedCredits = computed(() => {
    const minutesToCharge = effectiveDuration.value / 60;
    return minutesToCharge * 0.3;
  });

  // Credit information text
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
      return `No credits remaining in ${sourceName}. Transcription requires ${roundedCredits} credits (0.3/min).`;
    }

    if (remaining < creditsToCharge) {
      return `Insufficient credits in ${sourceName}. You have ${roundedRemaining} credits, but transcription requires ${roundedCredits} credits (0.3/min).`;
    }

    return `Transcription will charge ${roundedCredits} credits (0.3/min) from ${sourceName}. You have ${roundedRemaining} credits remaining.`;
  });

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
    if (isProcessing.value) return;
    emit('update:modelValue', false);
    error.value = '';
  }

  function confirm() {
    if (isProcessing.value || props.isTranscribed) return;

    error.value = '';

    // Check credits for non-admin users
    if (!isAdmin.value) {
      const creditsToCharge = calculatedCredits.value;

      if (!hasEnoughCredits(creditsToCharge)) {
        error.value = 'Insufficient credits for this operation';
        return;
      }
    }

    emit('confirm', organizationIdForApi.value);
    close();
  }

  // Load credits when dialog opens
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        resetCreditSource();
        fetchBalance();
        error.value = '';
        isProcessing.value = false;
      }
    }
  );
</script>

<style scoped>
  /* ===== Overlay ===== */
  .transcribe-dialog__overlay {
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
  .transcribe-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ===== Accent Bar ===== */
  .transcribe-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, #22c55e, rgba(34, 197, 94, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .transcribe-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .transcribe-dialog__close {
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

  .transcribe-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .transcribe-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .transcribe-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    margin-bottom: 0.875rem;
  }

  .transcribe-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .transcribe-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .transcribe-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .transcribe-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .transcribe-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .transcribe-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Form Field ===== */
  .transcribe-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .transcribe-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  /* ===== Info Box ===== */
  .transcribe-dialog__info-box {
    padding: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    gap: 0.5rem;
  }

  /* ===== Credit Option ===== */
  .transcribe-dialog__credit-option {
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

  .transcribe-dialog__credit-option:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .transcribe-dialog__credit-option--selected {
    background-color: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.3);
  }

  .transcribe-dialog__checkmark {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: #22c55e;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: white;
  }

  /* ===== Alert Box ===== */
  .transcribe-dialog__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .transcribe-dialog__alert--info {
    background-color: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .transcribe-dialog__alert--success {
    background-color: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.25);
    color: #4ade80;
  }

  .transcribe-dialog__alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  /* ===== Footer ===== */
  .transcribe-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .transcribe-dialog__btn {
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

  .transcribe-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .transcribe-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .transcribe-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .transcribe-dialog__btn--primary {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: #000;
  }

  .transcribe-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .transcribe-dialog__spinner {
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
</style>
