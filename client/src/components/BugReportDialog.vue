<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="bug-dialog__overlay" @click.self="$emit('close')">
        <Transition name="dialog" appear>
          <div v-if="show" class="bug-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="bug-dialog__accent"></div>

            <!-- Header -->
            <div class="bug-dialog__header">
              <button class="bug-dialog__close" @click="$emit('close')" :disabled="submitting" title="Close">
                <X :size="18" />
              </button>
              <div class="bug-dialog__icon">
                <Bug :size="24" />
              </div>
              <h2 class="bug-dialog__title">Report a Bug</h2>
              <p class="bug-dialog__subtitle">Help us improve by reporting issues</p>
            </div>

            <!-- Content -->
            <div class="bug-dialog__content">
              <form @submit.prevent="handleSubmit" class="bug-dialog__form">
                <!-- Title/Summary -->
                <div class="bug-dialog__field">
                  <label for="title" class="bug-dialog__label">Bug Title *</label>
                  <input
                    id="title"
                    v-model="form.title"
                    type="text"
                    required
                    placeholder="Brief description of the bug"
                    class="bug-dialog__input"
                  />
                </div>

                <!-- Description -->
                <div class="bug-dialog__field">
                  <label for="description" class="bug-dialog__label">Description *</label>
                  <textarea
                    id="description"
                    v-model="form.description"
                    required
                    rows="3"
                    placeholder="Please describe the bug in detail, including steps to reproduce it"
                    class="bug-dialog__input bug-dialog__textarea"
                  ></textarea>
                </div>

                <!-- Severity -->
                <div class="bug-dialog__field">
                  <label for="severity" class="bug-dialog__label">Severity</label>
                  <CustomDropdown
                    v-model="form.severity"
                    :options="severityOptions"
                    placeholder="Select severity"
                    class="bug-dialog__dropdown"
                    trigger-class="bug-dialog__dropdown-trigger"
                  />
                </div>

                <!-- Expected vs Actual -->
                <div class="bug-dialog__field">
                  <label for="expected" class="bug-dialog__label">
                    Expected Behavior
                    <span class="bug-dialog__label-hint">(optional)</span>
                  </label>
                  <textarea
                    id="expected"
                    v-model="form.expected_behavior"
                    rows="2"
                    placeholder="What should have happened"
                    class="bug-dialog__input bug-dialog__textarea bug-dialog__textarea--sm"
                  ></textarea>
                </div>

                <div class="bug-dialog__field">
                  <label for="actual" class="bug-dialog__label">
                    Actual Behavior
                    <span class="bug-dialog__label-hint">(optional)</span>
                  </label>
                  <textarea
                    id="actual"
                    v-model="form.actual_behavior"
                    rows="2"
                    placeholder="What actually happened"
                    class="bug-dialog__input bug-dialog__textarea bug-dialog__textarea--sm"
                  ></textarea>
                </div>

                <!-- Error Display -->
                <div v-if="error" class="bug-dialog__alert bug-dialog__alert--error">
                  <AlertCircle :size="16" />
                  <p class="bug-dialog__alert-text">{{ error }}</p>
                </div>

                <!-- Success Display -->
                <div v-if="success" class="bug-dialog__alert bug-dialog__alert--success">
                  <CheckCircle :size="16" />
                  <p class="bug-dialog__alert-text">{{ success }}</p>
                </div>
              </form>
            </div>

            <!-- Footer -->
            <div class="bug-dialog__footer">
              <button @click="$emit('close')" :disabled="submitting" class="bug-dialog__btn bug-dialog__btn--secondary">
                Cancel
              </button>
              <button
                @click="handleSubmit"
                :disabled="submitting || !formIsValid"
                class="bug-dialog__btn bug-dialog__btn--primary"
              >
                <Loader2 v-if="submitting" :size="16" class="bug-dialog__spinner" />
                {{ submitting ? 'Submitting...' : 'Submit Report' }}
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
  import { X, Loader2, Bug, AlertCircle, CheckCircle } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import api from '@/services/api';

  interface Props {
    show: boolean;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'submitted'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const authStore = useAuthStore();
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const success = ref<string | null>(null);

  const form = ref({
    title: '',
    description: '',
    severity: 'medium',
    expected_behavior: '',
    actual_behavior: '',
  });

  const severityOptions = [
    { label: 'Low - Minor inconvenience', value: 'low' },
    { label: 'Medium - Feature not working correctly', value: 'medium' },
    { label: 'High - Major functionality broken', value: 'high' },
    { label: 'Critical - App unusable or data loss', value: 'critical' },
  ];

  const formIsValid = computed(() => {
    return form.value.title.trim() !== '' && form.value.description.trim() !== '';
  });

  const resetForm = () => {
    form.value = {
      title: '',
      description: '',
      severity: 'medium',
      expected_behavior: '',
      actual_behavior: '',
    };
    error.value = null;
    success.value = null;
    submitting.value = false;
  };

  const handleSubmit = async () => {
    if (!formIsValid.value || submitting.value) return;

    submitting.value = true;
    error.value = null;
    success.value = null;

    try {
      const requestBody = {
        title: form.value.title.trim(),
        description: form.value.description.trim(),
        severity: form.value.severity,
        expected_behavior: form.value.expected_behavior.trim() || null,
        actual_behavior: form.value.actual_behavior.trim() || null,
        user_wallet_address: authStore.walletAddress,
      };

      const response = await api.post('/bug-reports', requestBody);

      const data = response.data;

      if (data.success) {
        success.value = 'Bug report submitted successfully! Thank you for helping us improve.';
        // Close dialog after a short delay to show success message
        setTimeout(() => {
          resetForm();
          emit('close');
          emit('submitted');
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to submit bug report');
      }
    } catch (err) {
      console.error('Bug report submission error:', err);
      error.value = err instanceof Error ? err.message : 'An unexpected error occurred while submitting the bug report';
    } finally {
      submitting.value = false;
    }
  };

  // Reset form when dialog opens/closes
  watch(
    () => props.show,
    (newShow) => {
      if (!newShow) {
        resetForm();
      }
    }
  );
</script>

<style scoped>
  /* ===== Overlay ===== */
  .bug-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  /* ===== Dialog Container ===== */
  .bug-dialog {
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
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .bug-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .bug-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .bug-dialog__close {
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

  .bug-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .bug-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .bug-dialog__icon {
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

  .bug-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .bug-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .bug-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .bug-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .bug-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .bug-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Form ===== */
  .bug-dialog__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ===== Form Field ===== */
  .bug-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .bug-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .bug-dialog__label-hint {
    color: var(--sidebar-text-muted);
    font-weight: 400;
    font-size: 0.8125rem;
  }

  .bug-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .bug-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .bug-dialog__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .bug-dialog__dropdown {
    width: 100%;
  }

  /* Dropdown trigger button styling */
  :deep(.bug-dialog__dropdown-trigger) {
    width: 100% !important;
    padding: 0.75rem 1rem !important;
    background-color: var(--sidebar-hover) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    font-size: 0.875rem !important;
    color: var(--sidebar-text) !important;
    transition: all 150ms ease !important;
    justify-content: space-between !important;
  }

  :deep(.bug-dialog__dropdown-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  :deep(.bug-dialog__dropdown-trigger:focus-within) {
    border-color: var(--sidebar-accent) !important;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15) !important;
  }

  :deep(.bug-dialog__dropdown-trigger span) {
    color: var(--sidebar-text) !important;
  }

  :deep(.bug-dialog__dropdown-trigger svg) {
    width: 14px !important;
    height: 14px !important;
    color: var(--sidebar-text-muted) !important;
  }

  .bug-dialog__textarea {
    resize: none;
    min-height: 80px;
  }

  .bug-dialog__textarea--sm {
    min-height: 60px;
  }

  /* ===== Alert Box ===== */
  .bug-dialog__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
  }

  .bug-dialog__alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .bug-dialog__alert--success {
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .bug-dialog__alert-text {
    font-size: 0.8125rem;
    line-height: 1.5;
    margin: 0;
  }

  /* ===== Footer ===== */
  .bug-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .bug-dialog__btn {
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

  .bug-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .bug-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .bug-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .bug-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .bug-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .bug-dialog__spinner {
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

<!-- Global styles for dropdown menu (rendered via Teleport outside component scope) -->
<style>
  /* Bug Dialog dropdown menu styling */
  .bug-dialog__dropdown + div[class*='fixed'],
  div.fixed.bg-popover {
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    animation: bugDialogDropdownFade 100ms ease-out !important;
  }

  @keyframes bugDialogDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Dropdown menu items */
  .bug-dialog__dropdown + div[class*='fixed'] button,
  div.fixed.bg-popover button {
    display: flex !important;
    align-items: center !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.75rem !important;
    color: var(--sidebar-text) !important;
    transition: background-color 150ms ease !important;
  }

  .bug-dialog__dropdown + div[class*='fixed'] button:hover,
  div.fixed.bg-popover button:hover {
    background-color: var(--sidebar-hover) !important;
  }

  .bug-dialog__dropdown + div[class*='fixed'] button.bg-primary\/10,
  div.fixed.bg-popover button.bg-primary\/10 {
    background-color: rgba(6, 182, 212, 0.15) !important;
    color: var(--sidebar-accent) !important;
  }
</style>
