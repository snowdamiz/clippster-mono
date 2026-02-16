<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="account-settings__overlay" @click.self="handleClose">
        <Transition name="dialog" appear>
          <div class="account-settings">
            <!-- Accent Bar -->
            <div class="account-settings__accent" />

            <!-- Header -->
            <div class="account-settings__header">
              <button class="account-settings__close" @click="handleClose" :disabled="saving" title="Close">
                <X :size="18" />
              </button>
              <div class="account-settings__icon">
                <Settings :size="24" />
              </div>
              <h2 class="account-settings__title">Account Settings</h2>
              <p class="account-settings__subtitle">Manage your email and password</p>
            </div>

            <!-- Content -->
            <div class="account-settings__content">
              <!-- Not Email User Message -->
              <div v-if="!isEmailUser" class="account-settings__info-box">
                <Info :size="20" />
                <div>
                  <p class="account-settings__info-title">
                    {{ authProvider === 'google' ? 'Google Account' : 'Wallet Account' }}
                  </p>
                  <p class="account-settings__info-text">
                    {{
                      authProvider === 'google'
                        ? 'You signed in with Google. Email and password management is handled by your Google account.'
                        : 'You signed in with a wallet. Email and password management is not available for wallet accounts.'
                    }}
                  </p>
                </div>
              </div>

              <!-- Email User Settings -->
              <template v-else>
                <!-- Email Section -->
                <div class="account-settings__section">
                  <h3 class="account-settings__section-title">Email Address</h3>
                  <div class="account-settings__section-items">
                    <div class="account-settings__field">
                      <label class="account-settings__label">Current Email</label>
                      <input
                        type="text"
                        :value="currentEmail"
                        class="account-settings__input"
                        disabled
                        readonly
                      />
                    </div>

                    <div class="account-settings__field">
                      <label class="account-settings__label">New Email</label>
                      <input
                        v-model="newEmail"
                        type="email"
                        class="account-settings__input"
                        placeholder="Enter new email address"
                        :disabled="saving"
                      />
                    </div>

                    <div class="account-settings__field">
                      <label class="account-settings__label">Password (for verification)</label>
                      <input
                        v-model="emailPassword"
                        type="password"
                        class="account-settings__input"
                        placeholder="Enter your current password"
                        :disabled="saving"
                      />
                    </div>

                    <button
                      class="account-settings__button"
                      @click="handleChangeEmail"
                      :disabled="!canChangeEmail || saving"
                    >
                      <Mail :size="16" />
                      {{ saving && savingType === 'email' ? 'Changing Email...' : 'Change Email' }}
                    </button>

                    <p v-if="emailSuccess" class="account-settings__success">
                      <CheckCircle :size="16" />
                      {{ emailSuccess }}
                    </p>
                    <p v-if="emailError" class="account-settings__error">
                      <AlertCircle :size="16" />
                      {{ emailError }}
                    </p>
                  </div>
                </div>

                <!-- Password Section -->
                <div class="account-settings__section">
                  <h3 class="account-settings__section-title">Password</h3>
                  <div class="account-settings__section-items">
                    <div class="account-settings__field">
                      <label class="account-settings__label">Current Password</label>
                      <input
                        v-model="currentPassword"
                        type="password"
                        class="account-settings__input"
                        placeholder="Enter current password"
                        :disabled="saving"
                      />
                    </div>

                    <div class="account-settings__field">
                      <label class="account-settings__label">New Password</label>
                      <input
                        v-model="newPassword"
                        type="password"
                        class="account-settings__input"
                        placeholder="Enter new password (min 8 characters)"
                        :disabled="saving"
                      />
                    </div>

                    <div class="account-settings__field">
                      <label class="account-settings__label">Confirm New Password</label>
                      <input
                        v-model="confirmPassword"
                        type="password"
                        class="account-settings__input"
                        placeholder="Confirm new password"
                        :disabled="saving"
                      />
                    </div>

                    <button
                      class="account-settings__button"
                      @click="handleChangePassword"
                      :disabled="!canChangePassword || saving"
                    >
                      <Lock :size="16" />
                      {{ saving && savingType === 'password' ? 'Changing Password...' : 'Change Password' }}
                    </button>

                    <p v-if="passwordSuccess" class="account-settings__success">
                      <CheckCircle :size="16" />
                      {{ passwordSuccess }}
                    </p>
                    <p v-if="passwordError" class="account-settings__error">
                      <AlertCircle :size="16" />
                      {{ passwordError }}
                    </p>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import { X, Settings, Mail, Lock, CheckCircle, AlertCircle, Info } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({
  show: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['close']);

const authStore = useAuthStore();

// Form state
const newEmail = ref('');
const emailPassword = ref('');
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

// UI state
const saving = ref(false);
const savingType = ref(''); // 'email' or 'password'
const emailSuccess = ref('');
const emailError = ref('');
const passwordSuccess = ref('');
const passwordError = ref('');

// Computed
const currentEmail = computed(() => authStore.email || authStore.user?.email || '');
const authProvider = computed(() => authStore.authProvider);
const isEmailUser = computed(() => authProvider.value === 'email');

const canChangeEmail = computed(() => {
  return newEmail.value.trim() && emailPassword.value.trim() && newEmail.value !== currentEmail.value;
});

const canChangePassword = computed(() => {
  return (
    currentPassword.value.trim() &&
    newPassword.value.trim() &&
    confirmPassword.value.trim() &&
    newPassword.value === confirmPassword.value &&
    newPassword.value.length >= 8
  );
});

// Methods
const handleClose = () => {
  if (!saving.value) {
    resetForm();
    emit('close');
  }
};

const resetForm = () => {
  newEmail.value = '';
  emailPassword.value = '';
  currentPassword.value = '';
  newPassword.value = '';
  confirmPassword.value = '';
  emailSuccess.value = '';
  emailError.value = '';
  passwordSuccess.value = '';
  passwordError.value = '';
};

const handleChangeEmail = async () => {
  emailError.value = '';
  emailSuccess.value = '';
  saving.value = true;
  savingType.value = 'email';

  try {
    const result = await authStore.changeEmail(newEmail.value, emailPassword.value);

    if (result.success) {
      emailSuccess.value = result.message || 'Verification email sent! Please check your inbox.';
      newEmail.value = '';
      emailPassword.value = '';
    } else {
      emailError.value = result.error || 'Failed to change email';
    }
  } catch (error) {
    emailError.value = error.message || 'An error occurred';
  } finally {
    saving.value = false;
    savingType.value = '';
  }
};

const handleChangePassword = async () => {
  passwordError.value = '';
  passwordSuccess.value = '';

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match';
    return;
  }

  if (newPassword.value.length < 8) {
    passwordError.value = 'Password must be at least 8 characters';
    return;
  }

  saving.value = true;
  savingType.value = 'password';

  try {
    const result = await authStore.changePassword(currentPassword.value, newPassword.value);

    if (result.success) {
      passwordSuccess.value = result.message || 'Password changed successfully!';
      currentPassword.value = '';
      newPassword.value = '';
      confirmPassword.value = '';
    } else {
      passwordError.value = result.error || 'Failed to change password';
    }
  } catch (error) {
    passwordError.value = error.message || 'An error occurred';
  } finally {
    saving.value = false;
    savingType.value = '';
  }
};
</script>

<style scoped>
.account-settings__overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.account-settings {
  background: linear-gradient(180deg, #18181b 0%, #09090b 100%);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  position: relative;
  overflow: hidden;
}

.account-settings__accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%);
}

.account-settings__header {
  padding: 32px 32px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

.account-settings__close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: transparent;
  border: none;
  color: #71717a;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.account-settings__close:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #a1a1aa;
}

.account-settings__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.account-settings__icon {
  width: 48px;
  height: 48px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8b5cf6;
  margin-bottom: 16px;
}

.account-settings__title {
  font-size: 24px;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 8px 0;
}

.account-settings__subtitle {
  font-size: 14px;
  color: #a1a1aa;
  margin: 0;
}

.account-settings__content {
  padding: 24px 32px 32px;
  overflow-y: auto;
  flex: 1;
}

.account-settings__info-box {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 12px;
  color: #60a5fa;
}

.account-settings__info-title {
  font-weight: 600;
  margin: 0 0 4px 0;
  color: #ffffff;
}

.account-settings__info-text {
  font-size: 14px;
  margin: 0;
  color: #a1a1aa;
}

.account-settings__section {
  margin-bottom: 32px;
}

.account-settings__section:last-child {
  margin-bottom: 0;
}

.account-settings__section-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 16px 0;
}

.account-settings__section-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.account-settings__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.account-settings__label {
  font-size: 13px;
  font-weight: 500;
  color: #a1a1aa;
}

.account-settings__input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  color: #ffffff;
  transition: all 0.2s;
}

.account-settings__input:focus {
  outline: none;
  border-color: #8b5cf6;
  background: rgba(255, 255, 255, 0.08);
}

.account-settings__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.account-settings__button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.account-settings__button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
}

.account-settings__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.account-settings__success {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 8px;
  color: #4ade80;
  font-size: 14px;
  margin: 0;
}

.account-settings__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #f87171;
  font-size: 14px;
  margin: 0;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.dialog-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-leave-active {
  transition: all 0.2s ease;
}

.dialog-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(20px);
}

.dialog-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
