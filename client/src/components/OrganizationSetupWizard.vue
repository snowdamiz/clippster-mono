<template>
  <div class="org-wizard-wrapper">
    <div class="org-wizard-container">
      <!-- Progress Indicator -->
      <div class="org-wizard__progress">
        <div
          v-for="step in totalSteps"
          :key="step"
          class="org-wizard__progress-dot"
          :class="{ 'org-wizard__progress-dot--active': step <= currentStep }"
        />
      </div>

      <!-- Card -->
      <div class="org-wizard">
        <!-- Accent Bar -->
        <div class="org-wizard__accent" />

        <div class="org-wizard__content">
          <!-- Step 1: Organization Name -->
          <div v-if="currentStep === 1" class="org-wizard__step">
            <div class="org-wizard__header">
              <div class="org-wizard__icon">
                <Building2 :size="32" />
              </div>
              <h2 class="org-wizard__title">Create your organization</h2>
              <p class="org-wizard__subtitle">Give your team a name to get started</p>
            </div>

            <div class="org-wizard__fields">
              <div class="org-wizard__field">
                <label for="org-name" class="org-wizard__label">Organization Name</label>
                <input
                  id="org-name"
                  v-model="orgData.name"
                  type="text"
                  placeholder="e.g., Acme Studios"
                  class="org-wizard__input"
                  @keydown.enter="nextStep"
                />
              </div>
            </div>
          </div>

          <!-- Step 2: Description (Optional) -->
          <div v-if="currentStep === 2" class="org-wizard__step">
            <div class="org-wizard__header">
              <div class="org-wizard__icon">
                <FileText :size="32" />
              </div>
              <h2 class="org-wizard__title">Add a description</h2>
              <p class="org-wizard__subtitle">Help team members understand what your organization does</p>
            </div>

            <div class="org-wizard__fields">
              <div class="org-wizard__field">
                <label for="org-description" class="org-wizard__label">
                  Description
                  <span class="org-wizard__optional">(optional)</span>
                </label>
                <textarea
                  id="org-description"
                  v-model="orgData.description"
                  rows="4"
                  placeholder="What does your organization do?"
                  class="org-wizard__textarea"
                />
              </div>
            </div>
          </div>

          <!-- Step 3: Logo (Optional) -->
          <div v-if="currentStep === 3" class="org-wizard__step">
            <div class="org-wizard__header">
              <div class="org-wizard__icon">
                <ImageIcon :size="32" />
              </div>
              <h2 class="org-wizard__title">Add a logo</h2>
              <p class="org-wizard__subtitle">Give your organization a visual identity</p>
            </div>

            <div class="org-wizard__fields">
              <!-- Logo Preview -->
              <div class="org-wizard__logo-section">
                <div class="org-wizard__logo-preview">
                  <img v-if="logoPreview" :src="logoPreview" alt="Logo preview" class="org-wizard__logo-img" />
                  <Building2 v-else class="org-wizard__logo-placeholder" :size="32" />
                </div>

                <!-- Upload Button -->
                <input
                  ref="logoInputRef"
                  type="file"
                  accept="image/*"
                  class="org-wizard__file-input"
                  @change="handleLogoUpload"
                />
                <button @click="logoInputRef?.click()" class="org-wizard__upload-btn">
                  <Upload :size="18" />
                  {{ logoPreview ? 'Change Logo' : 'Upload Logo' }}
                </button>

                <p class="org-wizard__hint">PNG, JPG or SVG (max 2MB)</p>
              </div>
            </div>
          </div>

          <!-- Step 4: Confirmation -->
          <div v-if="currentStep === 4" class="org-wizard__step">
            <div class="org-wizard__header">
              <div class="org-wizard__icon org-wizard__icon--success">
                <Check :size="32" />
              </div>
              <h2 class="org-wizard__title">You're all set!</h2>
              <p class="org-wizard__subtitle">Review your organization details</p>
            </div>

            <div class="org-wizard__fields">
              <div class="org-wizard__summary">
                <div class="org-wizard__summary-header">
                  <div class="org-wizard__summary-logo">
                    <img v-if="logoPreview" :src="logoPreview" alt="Logo" class="org-wizard__summary-logo-img" />
                    <Building2 v-else class="org-wizard__summary-logo-placeholder" :size="24" />
                  </div>
                  <div class="org-wizard__summary-info">
                    <h3 class="org-wizard__summary-name">{{ orgData.name }}</h3>
                    <p v-if="orgData.description" class="org-wizard__summary-desc">
                      {{ orgData.description }}
                    </p>
                  </div>
                </div>

                <div class="org-wizard__summary-features">
                  <div class="org-wizard__summary-feature">
                    <UserCheck :size="16" />
                    <span>You'll be the owner and admin</span>
                  </div>
                  <div class="org-wizard__summary-feature">
                    <Users :size="16" />
                    <span>Invite team members anytime</span>
                  </div>
                  <div class="org-wizard__summary-feature">
                    <CreditCard :size="16" />
                    <span>Manage shared credits for your team</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="org-wizard__alert">
            <AlertTriangle :size="16" />
            <p class="org-wizard__alert-text">{{ error }}</p>
          </div>

          <!-- Navigation Buttons -->
          <div class="org-wizard__footer">
            <div class="org-wizard__footer-buttons">
              <button v-if="currentStep > 1" @click="prevStep" class="org-wizard__btn org-wizard__btn--secondary">
                Back
              </button>

              <button
                v-if="currentStep < totalSteps"
                @click="nextStep"
                :disabled="!canProceed"
                class="org-wizard__btn org-wizard__btn--primary"
                :class="{ 'org-wizard__btn--full': currentStep === 1 }"
              >
                Continue
              </button>

              <button
                v-if="currentStep === totalSteps"
                @click="createOrganization"
                :disabled="loading"
                class="org-wizard__btn org-wizard__btn--primary"
              >
                <Loader2 v-if="loading" class="org-wizard__btn-spinner" />
                {{ loading ? 'Creating...' : 'Create Organization' }}
              </button>
            </div>

            <!-- Skip Link -->
            <button v-if="currentStep === 2 || currentStep === 3" @click="nextStep" class="org-wizard__skip">
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import {
    Building2,
    FileText,
    ImageIcon,
    Check,
    Upload,
    UserCheck,
    Users,
    CreditCard,
    Loader2,
    AlertTriangle,
  } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';

  const router = useRouter();
  const authStore = useAuthStore();

  const currentStep = ref(1);
  const totalSteps = 4;
  const loading = ref(false);
  const error = ref('');
  const logoInputRef = ref<HTMLInputElement | null>(null);

  const orgData = ref({
    name: '',
    description: '',
    logo_url: '',
  });

  const logoPreview = ref<string | null>(null);
  const logoFile = ref<File | null>(null);

  const canProceed = computed(() => {
    if (currentStep.value === 1) {
      return orgData.value.name.trim().length >= 2;
    }
    return true;
  });

  function nextStep() {
    if (canProceed.value && currentStep.value < totalSteps) {
      currentStep.value++;
      error.value = '';
    }
  }

  function prevStep() {
    if (currentStep.value > 1) {
      currentStep.value--;
      error.value = '';
    }
  }

  function handleLogoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        error.value = 'Logo must be less than 2MB';
        return;
      }

      logoFile.value = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        logoPreview.value = e.target?.result as string;
      };
      reader.readAsDataURL(file);
      error.value = '';
    }
  }

  async function createOrganization() {
    loading.value = true;
    error.value = '';

    try {
      // TODO: Upload logo if present and get URL
      // For now, we'll skip the logo upload

      const result = await authStore.createOrganization({
        name: orgData.value.name,
        description: orgData.value.description || undefined,
        logo_url: orgData.value.logo_url || undefined,
      });

      if (result.success) {
        router.push(`/organization/${result.organization.id}`);
      } else {
        error.value = result.error || 'Failed to create organization';
      }
    } catch (err: any) {
      error.value = err.message || 'An error occurred';
    } finally {
      loading.value = false;
    }
  }
</script>

<style scoped>
  /* ===== Wrapper ===== */
  .org-wizard-wrapper {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background-color: var(--sidebar-bg);
  }

  .org-wizard-container {
    width: 100%;
    max-width: 560px;
  }

  /* ===== Progress Indicator ===== */
  .org-wizard__progress {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 2rem;
  }

  .org-wizard__progress-dot {
    height: 8px;
    width: 8px;
    border-radius: 9999px;
    background-color: var(--sidebar-border);
    transition: all 250ms ease;
  }

  .org-wizard__progress-dot--active {
    width: 32px;
    background-color: var(--sidebar-accent);
  }

  /* ===== Card ===== */
  .org-wizard {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  /* ===== Accent Bar ===== */
  .org-wizard__accent {
    height: 3px;
    background: linear-gradient(90deg, #06b6d4, #0ea5e9, #3b82f6);
  }

  /* ===== Content ===== */
  .org-wizard__content {
    padding: 2rem;
  }

  .org-wizard__step {
    display: flex;
    flex-direction: column;
  }

  /* ===== Header ===== */
  .org-wizard__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 2rem;
  }

  .org-wizard__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 14px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 1rem;
  }

  .org-wizard__icon--success {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .org-wizard__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }

  .org-wizard__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== Fields ===== */
  .org-wizard__fields {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .org-wizard__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .org-wizard__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .org-wizard__optional {
    font-weight: 400;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }

  .org-wizard__input,
  .org-wizard__textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.9375rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .org-wizard__input::placeholder,
  .org-wizard__textarea::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .org-wizard__input:focus,
  .org-wizard__textarea:focus {
    outline: none;
    border-color: transparent;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
  }

  .org-wizard__textarea {
    resize: none;
    line-height: 1.5;
  }

  .org-wizard__hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    opacity: 0.7;
    text-align: center;
  }

  /* ===== Logo Section ===== */
  .org-wizard__logo-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .org-wizard__logo-preview {
    width: 96px;
    height: 96px;
    border-radius: 12px;
    background-color: var(--sidebar-hover);
    border: 2px dashed var(--sidebar-border);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .org-wizard__logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-wizard__logo-placeholder {
    color: var(--sidebar-text-muted);
  }

  .org-wizard__file-input {
    display: none;
  }

  .org-wizard__upload-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-wizard__upload-btn:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(6, 182, 212, 0.3);
  }

  /* ===== Summary ===== */
  .org-wizard__summary {
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .org-wizard__summary-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .org-wizard__summary-logo {
    width: 64px;
    height: 64px;
    border-radius: 12px;
    background-color: var(--sidebar-surface);
    border: 2px solid var(--sidebar-border);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .org-wizard__summary-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-wizard__summary-logo-placeholder {
    color: var(--sidebar-text-muted);
  }

  .org-wizard__summary-info {
    flex: 1;
    min-width: 0;
  }

  .org-wizard__summary-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
  }

  .org-wizard__summary-desc {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .org-wizard__summary-features {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 1rem 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .org-wizard__summary-feature {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .org-wizard__summary-feature svg {
    color: #10b981;
    flex-shrink: 0;
  }

  /* ===== Alert ===== */
  .org-wizard__alert {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.875rem 1rem;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    margin-top: 1rem;
  }

  .org-wizard__alert svg {
    flex-shrink: 0;
    color: #ef4444;
  }

  .org-wizard__alert-text {
    font-size: 0.8125rem;
    color: #ef4444;
    margin: 0;
  }

  /* ===== Footer ===== */
  .org-wizard__footer {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    margin-top: 2rem;
  }

  .org-wizard__footer-buttons {
    display: flex;
    gap: 0.75rem;
  }

  /* ===== Buttons ===== */
  .org-wizard__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.25rem;
    font-size: 0.9375rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-wizard__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-wizard__btn--full {
    width: 100%;
  }

  .org-wizard__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .org-wizard__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .org-wizard__btn--primary {
    background: linear-gradient(135deg, #06b6d4, #0ea5e9);
    color: white;
  }

  .org-wizard__btn--primary:hover:not(:disabled) {
    opacity: 0.95;
  }

  .org-wizard__btn-spinner {
    width: 18px;
    height: 18px;
    animation: spin 0.8s linear infinite;
  }

  .org-wizard__skip {
    width: 100%;
    padding: 0.5rem;
    background: transparent;
    border: none;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: color 150ms ease;
  }

  .org-wizard__skip:hover {
    color: var(--sidebar-text);
  }

  /* ===== Animations ===== */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
