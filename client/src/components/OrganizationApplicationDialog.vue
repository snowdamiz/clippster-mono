<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="org-app-dialog__overlay" @click.self="$emit('close')">
        <Transition name="dialog" appear>
          <div v-if="show" class="org-app-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="org-app-dialog__accent"></div>

            <!-- Header -->
            <div class="org-app-dialog__header">
              <button class="org-app-dialog__close" @click="$emit('close')" :disabled="submitting" title="Close">
                <X :size="18" />
              </button>
              <div class="org-app-dialog__icon">
                <Building2 :size="24" />
              </div>
              <h2 class="org-app-dialog__title">{{ props.application ? 'Edit' : 'Apply for' }} Organization Account</h2>
              <p class="org-app-dialog__subtitle">
                {{ props.application ? 'Update your application' : 'Tell us about your organization' }}
              </p>
            </div>

            <!-- Content -->
            <div class="org-app-dialog__content">
              <form @submit.prevent="handleSubmit" class="org-app-dialog__form">
                <!-- Organization Name -->
                <div class="org-app-dialog__field">
                  <label for="org-name" class="org-app-dialog__label">Organization Name *</label>
                  <input
                    id="org-name"
                    v-model="form.name"
                    type="text"
                    required
                    placeholder="e.g., Acme Studios"
                    class="org-app-dialog__input"
                  />
                </div>

                <!-- Description -->
                <div class="org-app-dialog__field">
                  <label for="description" class="org-app-dialog__label">Description * (min 10 characters)</label>
                  <textarea
                    id="description"
                    v-model="form.description"
                    required
                    minlength="10"
                    rows="3"
                    placeholder="Brief description of your organization (minimum 10 characters)"
                    class="org-app-dialog__input org-app-dialog__textarea"
                  ></textarea>
                </div>

                <!-- Website -->
                <div class="org-app-dialog__field">
                  <label for="website" class="org-app-dialog__label">
                    Website or Social Media Link
                    <span class="org-app-dialog__label-hint">(optional)</span>
                  </label>
                  <input
                    id="website"
                    v-model="form.website"
                    type="url"
                    placeholder="https://example.com or https://twitter.com/username"
                    class="org-app-dialog__input"
                  />
                </div>

                <!-- Team Size -->
                <div class="org-app-dialog__field">
                  <label for="team-size" class="org-app-dialog__label">Expected Team Size *</label>
                  <CustomDropdown
                    v-model="form.team_size"
                    :options="teamSizeOptions"
                    placeholder="Select team size"
                    class="org-app-dialog__dropdown"
                    trigger-class="org-app-dialog__dropdown-trigger"
                  />
                </div>

                <!-- Use Case -->
                <div class="org-app-dialog__field">
                  <label for="use-case" class="org-app-dialog__label">Use Case * (min 10 characters)</label>
                  <textarea
                    id="use-case"
                    v-model="form.use_case"
                    required
                    minlength="10"
                    rows="3"
                    placeholder="How will your organization use Clippster? What are your primary goals? (minimum 10 characters)"
                    class="org-app-dialog__input org-app-dialog__textarea"
                  ></textarea>
                </div>

                <!-- Contact Email -->
                <div class="org-app-dialog__field">
                  <label for="contact-email" class="org-app-dialog__label">Contact Email *</label>
                  <input
                    id="contact-email"
                    v-model="form.contact_email"
                    type="email"
                    required
                    placeholder="your@email.com"
                    class="org-app-dialog__input"
                  />
                </div>

                <!-- Logo Upload -->
                <div class="org-app-dialog__field">
                  <label class="org-app-dialog__label">
                    Organization Logo
                    <span class="org-app-dialog__label-hint">(optional)</span>
                  </label>
                  <div class="org-app-dialog__logo-section">
                    <div class="org-app-dialog__logo-preview">
                      <img v-if="logoPreview" :src="logoPreview" alt="Logo preview" class="org-app-dialog__logo-img" />
                      <Building2 v-else class="org-app-dialog__logo-placeholder" :size="32" />
                    </div>

                    <input
                      ref="logoInputRef"
                      type="file"
                      accept="image/*"
                      class="org-app-dialog__file-input"
                      @change="handleLogoUpload"
                    />
                    <button
                      type="button"
                      @click="logoInputRef?.click()"
                      :disabled="uploadingLogo"
                      class="org-app-dialog__upload-btn"
                    >
                      <Loader2 v-if="uploadingLogo" :size="18" class="org-app-dialog__upload-spinner" />
                      <Upload v-else :size="18" />
                      {{ uploadingLogo ? 'Uploading...' : logoPreview ? 'Change Logo' : 'Upload Logo' }}
                    </button>

                    <p class="org-app-dialog__hint">PNG, JPG or SVG (max 5MB)</p>
                  </div>
                </div>

                <!-- Error Display -->
                <div v-if="error" class="org-app-dialog__alert org-app-dialog__alert--error">
                  <AlertCircle :size="16" />
                  <p class="org-app-dialog__alert-text">{{ error }}</p>
                </div>

                <!-- Success Display -->
                <div v-if="success" class="org-app-dialog__alert org-app-dialog__alert--success">
                  <CheckCircle :size="16" />
                  <p class="org-app-dialog__alert-text">{{ success }}</p>
                </div>
              </form>
            </div>

            <!-- Footer -->
            <div class="org-app-dialog__footer">
              <button
                @click="$emit('close')"
                :disabled="submitting"
                class="org-app-dialog__btn org-app-dialog__btn--secondary"
              >
                Cancel
              </button>
              <button
                @click="handleSubmit"
                :disabled="submitting || !formIsValid"
                class="org-app-dialog__btn org-app-dialog__btn--primary"
              >
                <Loader2 v-if="submitting" :size="16" class="org-app-dialog__spinner" />
                {{
                  submitting
                    ? props.application
                      ? 'Updating...'
                      : 'Submitting...'
                    : props.application
                      ? 'Update Application'
                      : 'Submit Application'
                }}
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
  import { X, Loader2, Building2, AlertCircle, CheckCircle, Upload } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import api from '@/services/api';

  interface Props {
    show: boolean;
    application?: any | null;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'submitted'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const authStore = useAuthStore();
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const success = ref<string | null>(null);
  const logoInputRef = ref<HTMLInputElement | null>(null);
  const logoPreview = ref<string | null>(null);
  const uploadingLogo = ref(false);
  const uploadedLogoUrl = ref<string | null>(null);
  const pendingLogoFile = ref<File | null>(null);

  const form = ref({
    name: '',
    description: '',
    website: '',
    team_size: '',
    use_case: '',
    contact_email: authStore.user?.email || '',
  });

  const teamSizeOptions = [
    { label: '1-5 members', value: '1-5' },
    { label: '6-10 members', value: '6-10' },
    { label: '11-25 members', value: '11-25' },
    { label: '26-50 members', value: '26-50' },
    { label: '51+ members', value: '51+' },
  ];

  const formIsValid = computed(() => {
    return (
      form.value.name.trim().length >= 2 &&
      form.value.description.trim().length >= 10 &&
      form.value.team_size !== '' &&
      form.value.use_case.trim().length >= 10 &&
      form.value.contact_email.trim() !== '' &&
      form.value.contact_email.includes('@')
    );
  });

  const resetForm = () => {
    form.value = {
      name: '',
      description: '',
      website: '',
      team_size: '',
      use_case: '',
      contact_email: authStore.user?.email || '',
    };
    logoPreview.value = null;
    uploadedLogoUrl.value = null;
    pendingLogoFile.value = null;
    error.value = null;
    success.value = null;
    submitting.value = false;
  };

  async function handleLogoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showErrorToast('File Too Large', 'Logo must be less than 5MB');
      input.value = '';
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showErrorToast('Invalid File', 'Please select an image file');
      input.value = '';
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      logoPreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    // If editing existing application, upload immediately
    if (props.application?.id) {
      uploadingLogo.value = true;
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post(`/organization-applications/${props.application.id}/logo`, formData, {
          headers: {
            'Content-Type': undefined,
          },
        });

        if (response.data.success && response.data.url) {
          uploadedLogoUrl.value = response.data.logo_url; // Store the raw URL
          showSuccessToast('Logo Uploaded', 'Logo has been uploaded successfully');
        } else {
          showErrorToast('Upload Failed', response.data.error || 'Failed to upload logo');
          logoPreview.value = null;
        }
      } catch (err: any) {
        console.error('Logo upload error:', err);
        showErrorToast('Upload Failed', err.response?.data?.error || 'Failed to upload logo');
        logoPreview.value = null;
      } finally {
        uploadingLogo.value = false;
        input.value = '';
      }
    } else {
      // For new applications, store the file to upload after creation
      pendingLogoFile.value = file;
      input.value = '';
    }
  }

  const handleSubmit = async () => {
    if (!formIsValid.value || submitting.value) return;

    submitting.value = true;
    error.value = null;
    success.value = null;

    try {
      const requestBody = {
        name: form.value.name.trim(),
        description: form.value.description.trim(),
        website: form.value.website.trim() || null,
        team_size: form.value.team_size,
        use_case: form.value.use_case.trim(),
        contact_email: form.value.contact_email.trim(),
      };

      let response;
      if (props.application) {
        // Update existing application
        response = await api.put(`/organization-applications/${props.application.id}`, requestBody);
      } else {
        // Create new application
        response = await api.post('/organization-applications', requestBody);
      }

      const data = response.data;

      if (data.success) {
        // If new application and we have a pending logo file, upload it now
        if (!props.application && pendingLogoFile.value && data.application?.id) {
          uploadingLogo.value = true;
          try {
            const logoFormData = new FormData();
            logoFormData.append('file', pendingLogoFile.value);

            await api.post(`/organization-applications/${data.application.id}/logo`, logoFormData, {
              headers: {
                'Content-Type': undefined,
              },
            });
          } catch (logoErr) {
            console.error('Failed to upload logo after application creation:', logoErr);
            // Don't fail the whole process if logo upload fails
          } finally {
            uploadingLogo.value = false;
            pendingLogoFile.value = null;
          }
        }

        const message = props.application
          ? 'Your application has been updated successfully'
          : 'We will review your application and get back to you soon';
        success.value = `Application ${props.application ? 'updated' : 'submitted'} successfully! ${message}`;
        showSuccessToast(props.application ? 'Application Updated' : 'Application Submitted', message);
        // Close dialog after a short delay to show success message
        setTimeout(() => {
          resetForm();
          emit('close');
          emit('submitted');
        }, 1500);
      } else {
        throw new Error(data.error || `Failed to ${props.application ? 'update' : 'submit'} application`);
      }
    } catch (err: any) {
      console.error('Organization application submission error:', err);

      // Extract detailed error messages from backend
      if (err.response?.data?.details) {
        const details = err.response.data.details;
        const errorMessages = [];

        for (const [field, messages] of Object.entries(details)) {
          if (Array.isArray(messages)) {
            errorMessages.push(`${field}: ${messages.join(', ')}`);
          }
        }

        error.value =
          errorMessages.length > 0
            ? errorMessages.join('; ')
            : err.response.data.error || `Failed to ${props.application ? 'update' : 'submit'} application`;
      } else if (err.response?.data?.error) {
        error.value = err.response.data.error;
      } else {
        error.value =
          err instanceof Error
            ? err.message
            : `An unexpected error occurred while ${props.application ? 'updating' : 'submitting'} your application`;
      }
    } finally {
      submitting.value = false;
    }
  };

  // Reset form when dialog opens/closes
  watch(
    () => props.show,
    (newShow) => {
      if (newShow) {
        if (props.application) {
          // Pre-fill form with existing application data
          form.value = {
            name: props.application.name,
            description: props.application.description,
            website: props.application.website || '',
            team_size: props.application.team_size,
            use_case: props.application.use_case,
            contact_email: props.application.contact_email,
          };
          // Set logo preview if exists (presigned URL from backend)
          logoPreview.value = props.application.logo_url || null;
          uploadedLogoUrl.value = props.application.logo_url || null;
        } else {
          // Pre-fill email for new application
          form.value.contact_email = authStore.user?.email || '';
        }
      } else {
        resetForm();
      }
    }
  );
</script>

<style scoped>
  /* ===== Overlay ===== */
  .org-app-dialog__overlay {
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
  .org-app-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .org-app-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .org-app-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .org-app-dialog__close {
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

  .org-app-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .org-app-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-app-dialog__icon {
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

  .org-app-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .org-app-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .org-app-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .org-app-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .org-app-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .org-app-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Form ===== */
  .org-app-dialog__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ===== Form Field ===== */
  .org-app-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .org-app-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .org-app-dialog__label-hint {
    color: var(--sidebar-text-muted);
    font-weight: 400;
    font-size: 0.8125rem;
  }

  .org-app-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .org-app-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .org-app-dialog__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .org-app-dialog__dropdown {
    width: 100%;
  }

  /* Dropdown trigger button styling */
  :deep(.org-app-dialog__dropdown-trigger) {
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

  :deep(.org-app-dialog__dropdown-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  :deep(.org-app-dialog__dropdown-trigger:focus-within) {
    border-color: var(--sidebar-accent) !important;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15) !important;
  }

  :deep(.org-app-dialog__dropdown-trigger span) {
    color: var(--sidebar-text) !important;
  }

  :deep(.org-app-dialog__dropdown-trigger svg) {
    width: 14px !important;
    height: 14px !important;
    color: var(--sidebar-text-muted) !important;
  }

  .org-app-dialog__textarea {
    resize: none;
    min-height: 80px;
  }

  /* ===== Logo Upload Section ===== */
  .org-app-dialog__logo-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .org-app-dialog__logo-preview {
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

  .org-app-dialog__logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-app-dialog__logo-placeholder {
    color: var(--sidebar-text-muted);
  }

  .org-app-dialog__file-input {
    display: none;
  }

  .org-app-dialog__upload-btn {
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

  .org-app-dialog__upload-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .org-app-dialog__upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-app-dialog__upload-spinner {
    animation: spin 0.8s linear infinite;
  }

  .org-app-dialog__hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    opacity: 0.7;
    text-align: center;
  }

  /* ===== Alert Box ===== */
  .org-app-dialog__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
  }

  .org-app-dialog__alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .org-app-dialog__alert--success {
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .org-app-dialog__alert-text {
    font-size: 0.8125rem;
    line-height: 1.5;
    margin: 0;
  }

  /* ===== Footer ===== */
  .org-app-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .org-app-dialog__btn {
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

  .org-app-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-app-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .org-app-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .org-app-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: #000;
  }

  .org-app-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-app-dialog__spinner {
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
  /* Organization Application Dialog dropdown menu styling */
  .org-app-dialog__dropdown + div[class*='fixed'],
  div.fixed.bg-popover {
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    animation: orgAppDialogDropdownFade 100ms ease-out !important;
  }

  @keyframes orgAppDialogDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Dropdown menu items */
  .org-app-dialog__dropdown + div[class*='fixed'] button,
  div.fixed.bg-popover button {
    display: flex !important;
    align-items: center !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.75rem !important;
    color: var(--sidebar-text) !important;
    transition: background-color 150ms ease !important;
  }

  .org-app-dialog__dropdown + div[class*='fixed'] button:hover,
  div.fixed.bg-popover button:hover {
    background-color: var(--sidebar-hover) !important;
  }

  .org-app-dialog__dropdown + div[class*='fixed'] button.bg-primary\/10,
  div.fixed.bg-popover button.bg-primary\/10 {
    background-color: rgba(6, 182, 212, 0.15) !important;
    color: var(--sidebar-accent) !important;
  }
</style>
