<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="invite-dialog__overlay" @click.self="close" @keydown.esc="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="invite-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="invite-dialog__accent"></div>

            <!-- Header -->
            <div class="invite-dialog__header">
              <button class="invite-dialog__close" @click="close" title="Close">
                <X :size="18" />
              </button>
              <div class="invite-dialog__icon">
                <UserPlus :size="24" />
              </div>
              <h2 class="invite-dialog__title">Add Team Member</h2>
              <p class="invite-dialog__subtitle">Invite someone to join your organization</p>
            </div>

            <!-- Mode Tabs -->
            <div class="invite-dialog__tabs">
              <button
                @click="mode = 'invite'"
                class="invite-dialog__tab"
                :class="{ 'invite-dialog__tab--active': mode === 'invite' }"
              >
                <Mail :size="14" />
                <span>Send Invite</span>
              </button>
              <button
                @click="mode = 'create'"
                class="invite-dialog__tab"
                :class="{ 'invite-dialog__tab--active': mode === 'create' }"
              >
                <UserCog :size="14" />
                <span>Create Account</span>
              </button>
            </div>

            <!-- Content -->
            <div class="invite-dialog__content">
              <!-- Invite Mode -->
              <div v-if="mode === 'invite'" class="invite-dialog__form">
                <p class="invite-dialog__description">
                  Send an email invitation to an existing Clippster user. The email must be associated with an active account.
                </p>

                <div class="invite-dialog__field">
                  <label for="invite-email" class="invite-dialog__label">Email Address</label>
                  <input
                    id="invite-email"
                    v-model="inviteData.email"
                    type="email"
                    placeholder="colleague@example.com"
                    class="invite-dialog__input"
                  />
                </div>

                <div class="invite-dialog__field">
                  <label for="invite-role" class="invite-dialog__label">Role</label>
                  <CustomDropdown
                    v-model="inviteData.role"
                    :options="roleOptions"
                    placeholder="Select role"
                    class="invite-dialog__dropdown"
                    trigger-class="invite-dialog__dropdown-trigger"
                  />
                </div>
              </div>

              <!-- Create Account Mode -->
              <div v-if="mode === 'create'" class="invite-dialog__form">
                <p class="invite-dialog__description">
                  Create an account directly for a team member. You'll share the login credentials with them.
                </p>

                <div class="invite-dialog__field">
                  <label for="create-name" class="invite-dialog__label">Full Name</label>
                  <input
                    id="create-name"
                    v-model="createData.name"
                    type="text"
                    placeholder="John Doe"
                    class="invite-dialog__input"
                  />
                </div>

                <div class="invite-dialog__field">
                  <label for="create-email" class="invite-dialog__label">Email Address</label>
                  <input
                    id="create-email"
                    v-model="createData.email"
                    type="email"
                    placeholder="newmember@example.com"
                    class="invite-dialog__input"
                  />
                </div>

                <div class="invite-dialog__field">
                  <label for="create-password" class="invite-dialog__label">Password</label>
                  <div class="invite-dialog__input-group">
                    <input
                      id="create-password"
                      v-model="createData.password"
                      :type="showPassword ? 'text' : 'password'"
                      placeholder="Temporary password"
                      class="invite-dialog__input"
                    />
                    <button type="button" @click="showPassword = !showPassword" class="invite-dialog__input-toggle">
                      <EyeOff v-if="showPassword" :size="16" />
                      <Eye v-else :size="16" />
                    </button>
                  </div>
                  <button type="button" @click="generatePassword" class="invite-dialog__generate-btn">
                    <Sparkles :size="12" />
                    Generate secure password
                  </button>
                </div>

                <div class="invite-dialog__field">
                  <label for="create-role" class="invite-dialog__label">Role</label>
                  <CustomDropdown
                    v-model="createData.role"
                    :options="roleOptions"
                    placeholder="Select role"
                    class="invite-dialog__dropdown"
                    trigger-class="invite-dialog__dropdown-trigger"
                  />
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="invite-dialog__footer">
              <button @click="close" class="invite-dialog__btn invite-dialog__btn--secondary">Cancel</button>
              <button @click="submit" :disabled="!canSubmit" class="invite-dialog__btn invite-dialog__btn--primary">
                {{ mode === 'invite' ? 'Send Invitation' : 'Create Account' }}
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
  import { X, Mail, UserPlus, UserCog, Eye, EyeOff, Sparkles } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import CustomDropdown from '@/components/CustomDropdown.vue';

  const props = defineProps<{
    modelValue: boolean;
    organizationId: number | string;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    memberAdded: [];
  }>();

  const authStore = useAuthStore();
  const { success: showSuccess, error: showError } = useToast();

  const mode = ref<'invite' | 'create'>('invite');
  const showPassword = ref(false);

  const inviteData = ref({
    email: '',
    role: 'member',
  });

  const createData = ref({
    name: '',
    email: '',
    password: '',
    role: 'member',
  });

  const roleOptions = [
    { label: 'Member', value: 'member' },
    { label: 'Admin', value: 'admin' },
  ];

  const canSubmit = computed(() => {
    if (mode.value === 'invite') {
      return inviteData.value.email.includes('@') && inviteData.value.email.includes('.');
    } else {
      return (
        createData.value.email.includes('@') &&
        createData.value.email.includes('.') &&
        createData.value.password.length >= 8
      );
    }
  });

  // Reset form when dialog opens/closes
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (!isOpen) {
        setTimeout(() => {
          mode.value = 'invite';
          inviteData.value = { email: '', role: 'member' };
          createData.value = { name: '', email: '', password: '', role: 'member' };
        }, 300);
      }
    }
  );

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    createData.value.password = password;
    showPassword.value = true;
  }

  function submit() {
    if (mode.value === 'invite') {
      // Invite mode: close dialog immediately and process in background
      const email = inviteData.value.email;
      const role = inviteData.value.role;

      // Close dialog immediately
      emit('update:modelValue', false);

      // Process in background
      authStore
        .inviteOrganizationMember(String(props.organizationId), email, role)
        .then((result) => {
          if (result.success) {
            showSuccess('Invitation sent', `Invitation sent to ${email}`);
            emit('memberAdded');
          } else {
            showError('Failed to send invitation', result.error || 'An error occurred');
          }
        })
        .catch((err: any) => {
          showError('Failed to send invitation', err.message || 'An error occurred');
        });
    } else {
      // Create account mode: close dialog immediately and process in background
      const name = createData.value.name;
      const email = createData.value.email;
      const password = createData.value.password;
      const role = createData.value.role;

      // Close dialog immediately
      emit('update:modelValue', false);

      // Process in background
      authStore
        .createOrganizationMember(String(props.organizationId), email, password, role, name)
        .then((result) => {
          if (result.success) {
            showSuccess('Account created', `Account created for ${email}`);
            emit('memberAdded');
          } else {
            showError('Failed to create account', result.error || 'An error occurred');
          }
        })
        .catch((err: any) => {
          showError('Failed to create account', err.message || 'An error occurred');
        });
    }
  }

  function close() {
    emit('update:modelValue', false);
  }
</script>

<style scoped>
  /* ===== Overlay ===== */
  .invite-dialog__overlay {
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
  .invite-dialog {
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
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .invite-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .invite-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .invite-dialog__close {
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

  .invite-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .invite-dialog__icon {
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

  .invite-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .invite-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Tabs ===== */
  .invite-dialog__tabs {
    display: flex;
    gap: 0.375rem;
    padding: 0 1.5rem;
    overflow-x: auto;
    flex-shrink: 0;
  }

  .invite-dialog__tabs::-webkit-scrollbar {
    height: 0;
  }

  .invite-dialog__tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .invite-dialog__tab:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .invite-dialog__tab--active {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .invite-dialog__tab--active:hover {
    background-color: rgba(6, 182, 212, 0.2);
    color: var(--sidebar-accent);
  }

  /* ===== Content Area ===== */
  .invite-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
  }

  .invite-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .invite-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .invite-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Form ===== */
  .invite-dialog__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .invite-dialog__description {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  /* ===== Form Field ===== */
  .invite-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .invite-dialog__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .invite-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .invite-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .invite-dialog__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .invite-dialog__dropdown {
    width: 100%;
  }

  /* Dropdown trigger button styling */
  :deep(.invite-dialog__dropdown-trigger) {
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

  :deep(.invite-dialog__dropdown-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  :deep(.invite-dialog__dropdown-trigger:focus-within) {
    border-color: var(--sidebar-accent) !important;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15) !important;
  }

  :deep(.invite-dialog__dropdown-trigger span) {
    color: var(--sidebar-text) !important;
  }

  :deep(.invite-dialog__dropdown-trigger svg) {
    width: 14px !important;
    height: 14px !important;
    color: var(--sidebar-text-muted) !important;
  }

  /* ===== Input Group ===== */
  .invite-dialog__input-group {
    position: relative;
  }

  .invite-dialog__input-group .invite-dialog__input {
    padding-right: 3rem;
  }

  .invite-dialog__input-toggle {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    padding: 0.25rem;
    transition: color 150ms ease;
  }

  .invite-dialog__input-toggle:hover {
    color: var(--sidebar-text);
  }

  /* ===== Generate Password Button ===== */
  .invite-dialog__generate-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0;
    margin-top: 0.25rem;
    background: transparent;
    border: none;
    font-size: 0.75rem;
    color: var(--sidebar-accent);
    cursor: pointer;
    transition: color 150ms ease;
  }

  .invite-dialog__generate-btn:hover {
    color: #67e8f9;
  }

  /* ===== Note Box ===== */
  .invite-dialog__note {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    border-radius: 8px;
  }

  .invite-dialog__note-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background-color: rgba(6, 182, 212, 0.15);
    border-radius: 6px;
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .invite-dialog__note-text {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0;
  }

  /* ===== Footer ===== */
  .invite-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .invite-dialog__btn {
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

  .invite-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .invite-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .invite-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .invite-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: #000;
  }

  .invite-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
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
</style>

<!-- Global styles for dropdown menu (rendered via Teleport outside component scope) -->
<style>
  /* Invite Dialog dropdown menu styling */
  .invite-dialog__dropdown + div[class*='fixed'],
  div.fixed.bg-popover {
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    animation: inviteDialogDropdownFade 100ms ease-out !important;
  }

  @keyframes inviteDialogDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Dropdown menu items */
  .invite-dialog__dropdown + div[class*='fixed'] button,
  div.fixed.bg-popover button {
    display: flex !important;
    align-items: center !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.75rem !important;
    color: var(--sidebar-text) !important;
    transition: background-color 150ms ease !important;
  }

  .invite-dialog__dropdown + div[class*='fixed'] button:hover,
  div.fixed.bg-popover button:hover {
    background-color: var(--sidebar-hover) !important;
  }

  .invite-dialog__dropdown + div[class*='fixed'] button.bg-primary\/10,
  div.fixed.bg-popover button.bg-primary\/10 {
    background-color: rgba(6, 182, 212, 0.15) !important;
    color: var(--sidebar-accent) !important;
  }
</style>
