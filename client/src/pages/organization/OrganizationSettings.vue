<template>
  <PageLayout
    title="Organization Settings"
    description="Manage your organization profile and preferences"
    :show-header="true"
    :icon="Settings"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Settings' }]"
  >
    <div class="org-settings">
      <!-- Organization Profile Section -->
      <section class="org-settings__section">
        <h3 class="org-settings__section-title">
          <Building2 class="org-settings__section-icon" />
          Organization Profile
        </h3>

        <form @submit.prevent="handleUpdateOrganization" class="org-settings__form">
          <div class="org-settings__form-group">
            <label class="org-settings__form-label">Organization Name</label>
            <input
              v-model="editData.name"
              type="text"
              class="org-settings__form-input"
              placeholder="Enter organization name"
            />
          </div>

          <div class="org-settings__form-group">
            <label class="org-settings__form-label">Description</label>
            <textarea
              v-model="editData.description"
              rows="3"
              class="org-settings__form-textarea"
              placeholder="A brief description of your organization..."
            ></textarea>
          </div>

          <div class="org-settings__form-group">
            <label class="org-settings__form-label">
              <span>AI Features</span>
              <span class="org-settings__form-hint">(applies to all members)</span>
            </label>
            <div class="org-settings__toggle-row" @click="editData.settings.allow_ai = !editData.settings.allow_ai">
              <div class="org-settings__toggle-info">
                <Sparkles class="org-settings__toggle-icon" />
                <div>
                  <p class="org-settings__toggle-label">Enable AI features</p>
                  <p class="org-settings__toggle-desc">
                    Allow members to use AI-powered features like auto-captions, clip finder, and more
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="org-settings__toggle"
                :class="{ 'org-settings__toggle--active': editData.settings.allow_ai }"
              >
                <span class="org-settings__toggle-handle"></span>
              </button>
            </div>
          </div>

          <div class="org-settings__form-actions">
            <div v-if="saveSuccess" class="org-settings__save-success">
              <CheckCircle class="org-settings__save-success-icon" />
              Settings saved successfully
            </div>
            <button type="submit" :disabled="saving || !hasChanges" class="org-settings__save-btn">
              <Loader2 v-if="saving" class="org-settings__save-spinner" />
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Danger Zone (Owner Only) -->
      <section v-if="isOwner" class="org-settings__section org-settings__section--danger">
        <h3 class="org-settings__section-title org-settings__section-title--danger">
          <AlertTriangle class="org-settings__section-icon" />
          Danger Zone
        </h3>

        <div class="org-settings__danger-card">
          <div class="org-settings__danger-info">
            <h4 class="org-settings__danger-title">Delete Organization</h4>
            <p class="org-settings__danger-desc">
              Once you delete an organization, there is no going back. All data, members, and settings will be
              permanently removed.
            </p>
          </div>
          <button @click="confirmDeleteOrganization" class="org-settings__danger-btn" :disabled="deleting">
            <Loader2 v-if="deleting" class="org-settings__danger-spinner" />
            {{ deleting ? 'Deleting...' : 'Delete Organization' }}
          </button>
        </div>
      </section>
    </div>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteConfirm" class="org-settings__modal-backdrop" @click.self="showDeleteConfirm = false">
          <div class="org-settings__modal">
            <div class="org-settings__modal-accent"></div>
            <div class="org-settings__modal-content">
              <div class="org-settings__modal-header">
                <div class="org-settings__modal-icon">
                  <AlertTriangle class="org-settings__modal-icon-svg" />
                </div>
                <h2 class="org-settings__modal-title">Delete Organization</h2>
                <p class="org-settings__modal-subtitle">This action cannot be undone</p>
              </div>

              <div class="org-settings__modal-body">
                <div class="org-settings__delete-preview">
                  <Building2 class="org-settings__delete-preview-icon" />
                  <span class="org-settings__delete-preview-name">{{ organization?.name }}</span>
                </div>

                <p class="org-settings__delete-warning">
                  Type
                  <strong>{{ organization?.name }}</strong>
                  to confirm deletion:
                </p>
                <input
                  v-model="deleteConfirmInput"
                  type="text"
                  class="org-settings__delete-input"
                  :placeholder="organization?.name"
                />
              </div>

              <div class="org-settings__modal-actions">
                <button
                  class="org-settings__modal-btn org-settings__modal-btn--secondary"
                  @click="showDeleteConfirm = false"
                  :disabled="deleting"
                >
                  Cancel
                </button>
                <button
                  class="org-settings__modal-btn org-settings__modal-btn--danger"
                  @click="executeDeleteOrganization"
                  :disabled="deleting || deleteConfirmInput !== organization?.name"
                >
                  <Loader2 v-if="deleting" class="org-settings__btn-spinner" />
                  {{ deleting ? 'Deleting...' : 'Delete Forever' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { Building2, Sparkles, AlertTriangle, CheckCircle, Loader2, Settings } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { useOrganization } from '@/composables/useOrganization';

  const { organization, isOwner, updateOrganization, deleteOrganization } = useOrganization();

  // Local state for edit form
  const editData = ref({
    name: '',
    description: '',
    settings: {
      allow_ai: true,
    },
  });
  const saving = ref(false);
  const saveSuccess = ref(false);
  const showDeleteConfirm = ref(false);
  const deleteConfirmInput = ref('');
  const deleting = ref(false);

  // Populate edit form when organization data loads
  watch(
    () => organization.value,
    (org) => {
      if (org) {
        const orgSettings = org.settings || {};
        editData.value = {
          name: org.name,
          description: org.description || '',
          settings: {
            allow_ai: orgSettings.allow_ai !== false,
          },
        };
      }
    },
    { immediate: true }
  );

  const hasChanges = computed(() => {
    if (!organization.value) return false;
    const orgSettings = organization.value.settings || {};
    const currentAllowAi = orgSettings.allow_ai !== false;
    return (
      editData.value.name !== organization.value.name ||
      editData.value.description !== (organization.value.description || '') ||
      editData.value.settings.allow_ai !== currentAllowAi
    );
  });

  async function handleUpdateOrganization() {
    if (!hasChanges.value) return;

    saving.value = true;
    saveSuccess.value = false;

    const result = await updateOrganization(editData.value);
    saving.value = false;

    if (result.success) {
      saveSuccess.value = true;
      setTimeout(() => {
        saveSuccess.value = false;
      }, 3000);
    }
  }

  function confirmDeleteOrganization() {
    deleteConfirmInput.value = '';
    showDeleteConfirm.value = true;
  }

  async function executeDeleteOrganization() {
    if (deleteConfirmInput.value !== organization.value?.name) return;

    deleting.value = true;
    await deleteOrganization();
    deleting.value = false;
    showDeleteConfirm.value = false;
  }
</script>

<style scoped>
  .org-settings {
    width: 100%;
    max-width: 640px;
    padding: 1.5rem;
  }

  .org-settings__section {
    margin-bottom: 2rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
  }

  .org-settings__section--danger {
    background-color: rgba(239, 68, 68, 0.03);
    border-color: rgba(239, 68, 68, 0.2);
  }

  .org-settings__section-title {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .org-settings__section-title--danger {
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.2);
  }

  .org-settings__section-icon {
    width: 18px;
    height: 18px;
    color: var(--sidebar-text-muted);
  }

  .org-settings__section-title--danger .org-settings__section-icon {
    color: #f87171;
  }

  .org-settings__form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .org-settings__form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .org-settings__form-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .org-settings__form-hint {
    color: var(--sidebar-text-muted);
    font-weight: 400;
  }

  .org-settings__form-input,
  .org-settings__form-textarea {
    width: 100%;
    padding: 0.625rem 0.875rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .org-settings__form-input::placeholder,
  .org-settings__form-textarea::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }

  .org-settings__form-input:focus,
  .org-settings__form-textarea:focus {
    outline: none;
    border-color: rgba(6, 182, 212, 0.5);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
  }

  .org-settings__form-textarea {
    resize: vertical;
    min-height: 80px;
  }

  .org-settings__toggle-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-settings__toggle-row:hover {
    background-color: rgba(0, 0, 0, 0.25);
  }

  .org-settings__toggle-info {
    flex: 1;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .org-settings__toggle-icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-accent);
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .org-settings__toggle-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0;
  }

  .org-settings__toggle-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
    line-height: 1.4;
  }

  .org-settings__toggle {
    position: relative;
    width: 44px;
    height: 24px;
    background-color: #3f3f46;
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    transition: background-color 200ms ease;
    flex-shrink: 0;
  }

  .org-settings__toggle--active {
    background-color: var(--sidebar-accent);
  }

  .org-settings__toggle-handle {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background-color: white;
    border-radius: 50%;
    transition: transform 200ms ease;
  }

  .org-settings__toggle--active .org-settings__toggle-handle {
    transform: translateX(20px);
  }

  .org-settings__form-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
    padding-top: 0.5rem;
  }

  .org-settings__save-success {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: #34d399;
  }

  .org-settings__save-success-icon {
    width: 16px;
    height: 16px;
  }

  .org-settings__save-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-settings__save-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-settings__save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-settings__save-spinner {
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
  }

  /* Danger Zone */
  .org-settings__danger-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .org-settings__danger-info {
    flex: 1;
    min-width: 200px;
  }

  .org-settings__danger-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f87171;
    margin: 0 0 0.25rem;
  }

  .org-settings__danger-desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .org-settings__danger-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    background: transparent;
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .org-settings__danger-btn:hover:not(:disabled) {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.6);
  }

  .org-settings__danger-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-settings__danger-spinner {
    width: 14px;
    height: 14px;
    animation: spin 0.8s linear infinite;
  }

  /* Modal */
  .org-settings__modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .org-settings__modal {
    background: linear-gradient(to bottom, #18181b, #09090b);
    border-radius: 16px;
    max-width: 400px;
    width: calc(100% - 2rem);
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .org-settings__modal-accent {
    height: 4px;
    width: 100%;
    background: linear-gradient(90deg, #ef4444 0%, #ec4899 100%);
  }

  .org-settings__modal-content {
    padding: 1.5rem;
  }

  .org-settings__modal-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .org-settings__modal-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%);
    border: 1px solid rgba(239, 68, 68, 0.3);
    margin-bottom: 1rem;
  }

  .org-settings__modal-icon-svg {
    width: 24px;
    height: 24px;
    color: #f87171;
  }

  .org-settings__modal-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .org-settings__modal-subtitle {
    font-size: 0.875rem;
    color: #a1a1aa;
    margin: 0.25rem 0 0;
  }

  .org-settings__modal-body {
    margin-bottom: 1.5rem;
  }

  .org-settings__delete-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    padding: 0.75rem;
    background-color: rgba(24, 24, 27, 0.8);
    border-radius: 10px;
    border: 1px solid #3f3f46;
    margin-bottom: 1rem;
  }

  .org-settings__delete-preview-icon {
    width: 20px;
    height: 20px;
    color: #71717a;
  }

  .org-settings__delete-preview-name {
    font-weight: 500;
    color: white;
  }

  .org-settings__delete-warning {
    font-size: 0.875rem;
    color: #a1a1aa;
    margin: 0 0 0.75rem;
    line-height: 1.5;
  }

  .org-settings__delete-warning strong {
    color: #e4e4e7;
  }

  .org-settings__delete-input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    background-color: rgba(24, 24, 27, 0.8);
    border: 1px solid #3f3f46;
    border-radius: 8px;
    color: white;
    transition: all 150ms ease;
  }

  .org-settings__delete-input::placeholder {
    color: #52525b;
  }

  .org-settings__delete-input:focus {
    outline: none;
    border-color: #ef4444;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
  }

  .org-settings__modal-actions {
    display: flex;
    gap: 0.75rem;
  }

  .org-settings__modal-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
  }

  .org-settings__modal-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-settings__modal-btn--secondary {
    background-color: #27272a;
    color: #d4d4d8;
    border: 1px solid #3f3f46;
  }

  .org-settings__modal-btn--secondary:hover:not(:disabled) {
    background-color: #3f3f46;
    color: white;
  }

  .org-settings__modal-btn--danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
  }

  .org-settings__modal-btn--danger:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-settings__btn-spinner {
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
  }

  /* Transitions */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
