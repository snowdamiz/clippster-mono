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
              <p class="account-settings__subtitle">Manage your account, preferences, and notifications</p>
            </div>

            <!-- Tab Navigation -->
            <div class="account-settings__tabs">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                class="account-settings__tab"
                :class="{ 'account-settings__tab--active': activeTab === tab.id }"
                @click="activeTab = tab.id"
              >
                <component :is="tab.icon" :size="16" />
                {{ tab.label }}
              </button>
            </div>

            <!-- Content -->
            <div class="account-settings__content">

              <!-- ==================== ACCOUNT TAB ==================== -->
              <template v-if="activeTab === 'account'">
                <!-- Google Account -->
                <template v-if="authProvider === 'google'">
                  <div class="account-settings__info-box">
                    <Info :size="20" />
                    <div>
                      <p class="account-settings__info-title">Google Account</p>
                      <p class="account-settings__info-text">
                        Switch Gmail accounts, or convert to email/password login. Your projects,
                        credits, and settings stay on this account.
                      </p>
                    </div>
                  </div>

                  <div class="account-settings__section">
                    <h3 class="account-settings__section-title">Connected Gmail</h3>
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

                      <button
                        class="account-settings__button"
                        @click="handleSwitchGoogle"
                        :disabled="saving || emailChangeStep === 'otp'"
                      >
                        <RefreshCw :size="16" />
                        {{ saving && savingType === 'google' ? 'Switching...' : 'Switch Google Account' }}
                      </button>

                      <p v-if="googleSuccess" class="account-settings__success">
                        <CheckCircle :size="16" />
                        {{ googleSuccess }}
                      </p>
                      <p v-if="googleError" class="account-settings__error">
                        <AlertCircle :size="16" />
                        {{ googleError }}
                      </p>
                    </div>
                  </div>

                  <div class="account-settings__section">
                    <h3 class="account-settings__section-title">Switch to Email / Password</h3>
                    <div class="account-settings__section-items">
                      <template v-if="emailChangeStep === 'otp'">
                        <p class="account-settings__info-text">
                          Enter the 6-digit code sent to <strong>{{ pendingEmail }}</strong>
                        </p>
                        <div class="account-settings__field">
                          <label class="account-settings__label">Verification Code</label>
                          <input
                            v-model="emailChangeOtp"
                            type="text"
                            inputmode="numeric"
                            maxlength="6"
                            class="account-settings__input"
                            placeholder="000000"
                            :disabled="saving"
                            @input="onOtpInput"
                          />
                        </div>
                        <button
                          class="account-settings__button"
                          @click="handleVerifyEmailOtp"
                          :disabled="emailChangeOtp.length !== 6 || saving"
                        >
                          <Mail :size="16" />
                          {{ saving && savingType === 'email-otp' ? 'Verifying...' : 'Verify & Convert' }}
                        </button>
                        <button
                          class="account-settings__button account-settings__button--secondary"
                          @click="handleResendEmailOtp"
                          :disabled="saving"
                        >
                          Resend Code
                        </button>
                        <button
                          class="account-settings__button account-settings__button--secondary"
                          @click="cancelEmailChange"
                          :disabled="saving"
                        >
                          Cancel
                        </button>
                      </template>
                      <template v-else>
                        <div class="account-settings__field">
                          <label class="account-settings__label">New Email</label>
                          <input
                            v-model="newEmail"
                            type="email"
                            class="account-settings__input"
                            placeholder="you@example.com"
                            :disabled="saving"
                          />
                        </div>
                        <div class="account-settings__field">
                          <label class="account-settings__label">Create Password</label>
                          <input
                            v-model="oauthNewPassword"
                            type="password"
                            class="account-settings__input"
                            placeholder="Min 8 characters"
                            :disabled="saving"
                          />
                        </div>
                        <div class="account-settings__field">
                          <label class="account-settings__label">Confirm Password</label>
                          <input
                            v-model="oauthConfirmPassword"
                            type="password"
                            class="account-settings__input"
                            placeholder="Confirm password"
                            :disabled="saving"
                          />
                        </div>
                        <button
                          class="account-settings__button"
                          @click="handleConvertToEmail"
                          :disabled="!canConvertToEmail || saving"
                        >
                          <Mail :size="16" />
                          {{ saving && savingType === 'email' ? 'Sending Code...' : 'Send Verification Code' }}
                        </button>
                      </template>

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
                </template>

                <!-- Wallet Account Message -->
                <div v-else-if="!isEmailUser" class="account-settings__info-box">
                  <Info :size="20" />
                  <div>
                    <p class="account-settings__info-title">Wallet Account</p>
                    <p class="account-settings__info-text">
                      You signed in with a wallet. Email and password management is not available for wallet accounts.
                    </p>
                  </div>
                </div>

                <!-- Email User Settings -->
                <template v-else>
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

                      <template v-if="emailChangeStep === 'otp'">
                        <p class="account-settings__info-text">
                          Enter the 6-digit code sent to <strong>{{ pendingEmail }}</strong>
                        </p>
                        <div class="account-settings__field">
                          <label class="account-settings__label">Verification Code</label>
                          <input
                            v-model="emailChangeOtp"
                            type="text"
                            inputmode="numeric"
                            maxlength="6"
                            class="account-settings__input"
                            placeholder="000000"
                            :disabled="saving"
                            @input="onOtpInput"
                          />
                        </div>
                        <button
                          class="account-settings__button"
                          @click="handleVerifyEmailOtp"
                          :disabled="emailChangeOtp.length !== 6 || saving"
                        >
                          <Mail :size="16" />
                          {{ saving && savingType === 'email-otp' ? 'Verifying...' : 'Verify Email' }}
                        </button>
                        <button
                          class="account-settings__button account-settings__button--secondary"
                          @click="handleResendEmailOtp"
                          :disabled="saving"
                        >
                          Resend Code
                        </button>
                        <button
                          class="account-settings__button account-settings__button--secondary"
                          @click="cancelEmailChange"
                          :disabled="saving"
                        >
                          Cancel
                        </button>
                      </template>
                      <template v-else>
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
                          {{ saving && savingType === 'email' ? 'Sending Code...' : 'Change Email' }}
                        </button>
                      </template>

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
              </template>

              <!-- ==================== PREFERENCES TAB ==================== -->
              <template v-if="activeTab === 'preferences'">
                <!-- Time Format -->
                <div class="account-settings__section">
                  <h3 class="account-settings__section-title">Time Format</h3>
                  <div class="account-settings__section-items">
                    <div class="account-settings__toggle-row">
                      <div class="account-settings__toggle-info">
                        <span class="account-settings__toggle-label">24-Hour Time</span>
                        <span class="account-settings__toggle-desc">Display times as 15:30 instead of 3:30 PM</span>
                      </div>
                      <button
                        class="account-settings__toggle"
                        :class="{ 'account-settings__toggle--on': prefsStore.is24Hour }"
                        @click="togglePref('time_format_preference', prefsStore.is24Hour ? '12hr' : '24hr')"
                        :disabled="prefsStore.saving"
                      >
                        <span class="account-settings__toggle-knob" />
                      </button>
                    </div>
                    <div class="account-settings__preview-box">
                      <Clock :size="14" />
                      <span>Preview: {{ prefsStore.is24Hour ? '15:30' : '3:30 PM' }} · {{ prefsStore.is24Hour ? '09:00' : '9:00 AM' }}</span>
                    </div>
                  </div>
                </div>

                <!-- App Tours -->
                <div class="account-settings__section">
                  <h3 class="account-settings__section-title">App Tours</h3>
                  <p class="account-settings__section-desc">Restart a guided tour anytime. Skip or Finish marks it complete.</p>
                  <div class="account-settings__section-items">
                    <div
                      v-for="tour in tourRestartOptions"
                      :key="tour.id"
                      class="account-settings__toggle-row"
                    >
                      <div class="account-settings__toggle-info">
                        <span class="account-settings__toggle-label">{{ tour.label }}</span>
                        <span class="account-settings__toggle-desc">{{ tour.desc }}</span>
                      </div>
                      <button
                        type="button"
                        class="account-settings__restart-btn"
                        :disabled="restartingTour === tour.id"
                        @click="onRestartTour(tour.id)"
                      >
                        <RefreshCw :size="14" />
                        Restart
                      </button>
                    </div>
                  </div>
                </div>
              </template>

              <!-- ==================== NOTIFICATIONS TAB ==================== -->
              <template v-if="activeTab === 'notifications'">
                <!-- Global Toast Controls -->
                <div class="account-settings__section">
                  <h3 class="account-settings__section-title">Toast Notifications</h3>
                  <div class="account-settings__section-items">
                    <!-- Master Toggle -->
                    <div class="account-settings__toggle-row">
                      <div class="account-settings__toggle-info">
                        <span class="account-settings__toggle-label">Enable Notifications</span>
                        <span class="account-settings__toggle-desc">Show in-app toast notifications</span>
                      </div>
                      <button
                        class="account-settings__toggle"
                        :class="{ 'account-settings__toggle--on': prefsStore.toastEnabled }"
                        @click="togglePref('toast_enabled', !prefsStore.toastEnabled)"
                        :disabled="prefsStore.saving"
                      >
                        <span class="account-settings__toggle-knob" />
                      </button>
                    </div>

                    <!-- Duration -->
                    <div class="account-settings__field" :class="{ 'account-settings__field--disabled': !prefsStore.toastEnabled }">
                      <label class="account-settings__label">Duration</label>
                      <div class="account-settings__button-group">
                        <button
                          v-for="opt in durationOptions"
                          :key="opt.value"
                          class="account-settings__button-option"
                          :class="{ 'account-settings__button-option--active': prefsStore.toastDuration === opt.value }"
                          @click="togglePref('toast_duration', opt.value)"
                          :disabled="!prefsStore.toastEnabled || prefsStore.saving"
                        >
                          {{ opt.label }}
                        </button>
                      </div>
                    </div>

                    <!-- Position -->
                    <div class="account-settings__field" :class="{ 'account-settings__field--disabled': !prefsStore.toastEnabled }">
                      <label class="account-settings__label">Position</label>
                      <div class="account-settings__position-grid">
                        <button
                          v-for="pos in positionOptions"
                          :key="pos.value"
                          class="account-settings__position-btn"
                          :class="{ 'account-settings__position-btn--active': prefsStore.toastPosition === pos.value }"
                          @click="togglePref('toast_position', pos.value)"
                          :disabled="!prefsStore.toastEnabled || prefsStore.saving"
                        >
                          <span class="account-settings__position-dot" :class="`account-settings__position-dot--${pos.value}`" />
                          {{ pos.label }}
                        </button>
                      </div>
                    </div>

                    <!-- Sound -->
                    <div class="account-settings__toggle-row" :class="{ 'account-settings__field--disabled': !prefsStore.toastEnabled }">
                      <div class="account-settings__toggle-info">
                        <span class="account-settings__toggle-label">Notification Sound</span>
                        <span class="account-settings__toggle-desc">Play a chime when notifications appear</span>
                      </div>
                      <button
                        class="account-settings__toggle"
                        :class="{ 'account-settings__toggle--on': prefsStore.toastSoundEnabled }"
                        @click="togglePref('toast_sound_enabled', !prefsStore.toastSoundEnabled)"
                        :disabled="!prefsStore.toastEnabled || prefsStore.saving"
                      >
                        <span class="account-settings__toggle-knob" />
                      </button>
                    </div>

                    <!-- Background Notifications -->
                    <div class="account-settings__toggle-row" :class="{ 'account-settings__field--disabled': !prefsStore.toastEnabled }">
                      <div class="account-settings__toggle-info">
                        <span class="account-settings__toggle-label">Background Notifications</span>
                        <span class="account-settings__toggle-desc">Show notifications when app is minimized</span>
                      </div>
                      <button
                        class="account-settings__toggle"
                        :class="{ 'account-settings__toggle--on': prefsStore.toastBackgroundEnabled }"
                        @click="togglePref('toast_background_enabled', !prefsStore.toastBackgroundEnabled)"
                        :disabled="!prefsStore.toastEnabled || prefsStore.saving"
                      >
                        <span class="account-settings__toggle-knob" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Per-Category Toggles -->
                <div class="account-settings__section" :class="{ 'account-settings__field--disabled': !prefsStore.toastEnabled }">
                  <h3 class="account-settings__section-title">Notification Categories</h3>
                  <div class="account-settings__section-items">
                    <div
                      v-for="cat in categoryOptions"
                      :key="cat.key"
                      class="account-settings__toggle-row"
                    >
                      <div class="account-settings__toggle-info">
                        <span class="account-settings__toggle-label">{{ cat.label }}</span>
                        <span class="account-settings__toggle-desc">{{ cat.desc }}</span>
                      </div>
                      <button
                        class="account-settings__toggle"
                        :class="{ 'account-settings__toggle--on': prefsStore.preferences[cat.key] }"
                        @click="togglePref(cat.key, !prefsStore.preferences[cat.key])"
                        :disabled="!prefsStore.toastEnabled || prefsStore.saving"
                      >
                        <span class="account-settings__toggle-knob" />
                      </button>
                    </div>
                  </div>
                </div>
              </template>

              <!-- ==================== DELETE DATA TAB ==================== -->
              <template v-if="activeTab === 'delete'">
                <DeleteDataTab />
              </template>

            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, markRaw } from 'vue';
import { X, Settings, Mail, Lock, CheckCircle, AlertCircle, Info, Clock, Bell, User, Trash2, RefreshCw } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useUserPreferencesStore } from '@/stores/userPreferences';
import DeleteDataTab from '@/components/settings/DeleteDataTab.vue';
import { useAppTour } from '@/composables/useAppTour';

const props = defineProps({
  show: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['close']);

const authStore = useAuthStore();
const prefsStore = useUserPreferencesStore();
const { restartTour } = useAppTour();
const restartingTour = ref(null);

const tourRestartOptions = [
  { id: 'desktop_sidebar', label: 'Sidebar overview', desc: 'Browse, Library, Design Studio, Studio, Manage' },
  { id: 'page_creators', label: 'My Creators', desc: 'Add creator and profile tabs' },
  { id: 'page_live_clip', label: 'Live Streams', desc: 'Track, Watch, Rec, Auto' },
  { id: 'page_vods', label: 'Download Video', desc: 'Platforms and VOD search' },
  { id: 'page_projects', label: 'Video library', desc: 'Detect, Transcribe, Pre-Edit' },
  { id: 'page_video_editor', label: 'Video Editor', desc: 'Timeline editor overview' },
  { id: 'page_image_editor', label: 'Image Editor', desc: 'Canvas editor overview' },
];

async function onRestartTour(tourId) {
  restartingTour.value = tourId;
  try {
    emit('close');
    await restartTour(tourId);
  } finally {
    restartingTour.value = null;
  }
}

// Tab navigation
const tabs = [
  { id: 'account', label: 'Account', icon: markRaw(User) },
  { id: 'preferences', label: 'Preferences', icon: markRaw(Clock) },
  { id: 'notifications', label: 'Notifications', icon: markRaw(Bell) },
  { id: 'delete', label: 'Delete Data', icon: markRaw(Trash2) },
];
const activeTab = ref('account');

// Duration options
const durationOptions = [
  { label: '3s', value: 3000 },
  { label: '5s', value: 5000 },
  { label: '7s', value: 7000 },
  { label: '10s', value: 10000 },
  { label: 'Manual', value: 0 },
];

// Position options
const positionOptions = [
  { label: 'Top Left', value: 'top-left' },
  { label: 'Top Right', value: 'top-right' },
  { label: 'Bottom Left', value: 'bottom-left' },
  { label: 'Bottom Right', value: 'bottom-right' },
];

// Category options
const categoryOptions = [
  { key: 'notify_livestream', label: 'Livestream', desc: 'Streamer went live, recording started/stopped' },
  { key: 'notify_clips', label: 'Clips & Video', desc: 'Clips detected, export complete, transcription done' },
  { key: 'notify_downloads', label: 'Downloads & Uploads', desc: 'Download complete, upload complete' },
  { key: 'notify_projects', label: 'Projects & Editor', desc: 'Project saved, auto-save, editor warnings' },
  { key: 'notify_social', label: 'Social & Publishing', desc: 'Post published, scheduled post sent' },
  { key: 'notify_organization', label: 'Organization', desc: 'Invitations, member activity, shared content' },
  { key: 'notify_system', label: 'System', desc: 'Success confirmations, errors, warnings' },
];

// Form state
const newEmail = ref('');
const emailPassword = ref('');
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const oauthNewPassword = ref('');
const oauthConfirmPassword = ref('');
const emailChangeOtp = ref('');
const pendingEmail = ref('');
const emailChangeStep = ref('form'); // 'form' | 'otp'

// UI state
const saving = ref(false);
const savingType = ref(''); // 'email' | 'email-otp' | 'password' | 'google'
const emailSuccess = ref('');
const emailError = ref('');
const passwordSuccess = ref('');
const passwordError = ref('');
const googleSuccess = ref('');
const googleError = ref('');

// Computed
const currentEmail = computed(() => authStore.email || authStore.user?.email || '');
const authProvider = computed(() => authStore.authProvider);
const isEmailUser = computed(() => authProvider.value === 'email');

const canChangeEmail = computed(() => {
  return newEmail.value.trim() && emailPassword.value.trim() && newEmail.value !== currentEmail.value;
});

const canConvertToEmail = computed(() => {
  return (
    newEmail.value.trim() &&
    oauthNewPassword.value.length >= 8 &&
    oauthNewPassword.value === oauthConfirmPassword.value
  );
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

// Preference toggle helper
const togglePref = async (key, value) => {
  const userId = String(authStore.user?.id || '');
  const token = authStore.getAuthToken?.() || authStore.token || localStorage.getItem('auth_token') || '';
  if (!userId || !token) return;
  await prefsStore.updatePreference(key, value, userId, token);
};

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
  oauthNewPassword.value = '';
  oauthConfirmPassword.value = '';
  emailChangeOtp.value = '';
  pendingEmail.value = '';
  emailChangeStep.value = 'form';
  emailSuccess.value = '';
  emailError.value = '';
  passwordSuccess.value = '';
  passwordError.value = '';
  googleSuccess.value = '';
  googleError.value = '';
};

const onOtpInput = (event) => {
  emailChangeOtp.value = String(event.target.value || '').replace(/\D/g, '').slice(0, 6);
};

const cancelEmailChange = () => {
  emailChangeStep.value = 'form';
  emailChangeOtp.value = '';
  pendingEmail.value = '';
  emailSuccess.value = '';
  emailError.value = '';
};

const handleSwitchGoogle = async () => {
  googleError.value = '';
  googleSuccess.value = '';
  saving.value = true;
  savingType.value = 'google';

  try {
    const result = await authStore.switchGoogleAccount();

    if (result.success) {
      googleSuccess.value = `Switched to ${result.user?.email || 'new Google account'}. Your existing data was kept.`;
    } else {
      googleError.value = result.error || 'Failed to switch Google account';
    }
  } catch (error) {
    googleError.value = error.message || 'An error occurred';
  } finally {
    saving.value = false;
    savingType.value = '';
  }
};

const handleChangeEmail = async () => {
  emailError.value = '';
  emailSuccess.value = '';
  saving.value = true;
  savingType.value = 'email';

  try {
    const result = await authStore.changeEmail(newEmail.value, { password: emailPassword.value });

    if (result.success) {
      pendingEmail.value = result.pendingEmail || newEmail.value;
      emailChangeStep.value = 'otp';
      emailSuccess.value = result.message || `Verification code sent to ${pendingEmail.value}`;
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

const handleConvertToEmail = async () => {
  emailError.value = '';
  emailSuccess.value = '';

  if (oauthNewPassword.value !== oauthConfirmPassword.value) {
    emailError.value = 'Passwords do not match';
    return;
  }

  if (oauthNewPassword.value.length < 8) {
    emailError.value = 'Password must be at least 8 characters';
    return;
  }

  saving.value = true;
  savingType.value = 'email';

  try {
    const result = await authStore.changeEmail(newEmail.value, {
      newPassword: oauthNewPassword.value,
    });

    if (result.success) {
      pendingEmail.value = result.pendingEmail || newEmail.value;
      emailChangeStep.value = 'otp';
      emailSuccess.value = result.message || `Verification code sent to ${pendingEmail.value}`;
      oauthNewPassword.value = '';
      oauthConfirmPassword.value = '';
    } else {
      emailError.value = result.error || 'Failed to start email conversion';
    }
  } catch (error) {
    emailError.value = error.message || 'An error occurred';
  } finally {
    saving.value = false;
    savingType.value = '';
  }
};

const handleVerifyEmailOtp = async () => {
  emailError.value = '';
  emailSuccess.value = '';
  saving.value = true;
  savingType.value = 'email-otp';

  try {
    const result = await authStore.verifyEmailChangeOtp(emailChangeOtp.value);

    if (result.success) {
      emailSuccess.value =
        result.message || `Email updated to ${result.user?.email || pendingEmail.value}`;
      emailChangeStep.value = 'form';
      emailChangeOtp.value = '';
      pendingEmail.value = '';
      newEmail.value = '';
    } else {
      emailError.value = result.error || 'Invalid verification code';
    }
  } catch (error) {
    emailError.value = error.message || 'An error occurred';
  } finally {
    saving.value = false;
    savingType.value = '';
  }
};

const handleResendEmailOtp = async () => {
  emailError.value = '';
  emailSuccess.value = '';
  saving.value = true;
  savingType.value = 'email';

  try {
    const result = await authStore.resendEmailChangeVerification();

    if (result.success) {
      emailSuccess.value = result.message || 'Verification code resent';
      emailChangeOtp.value = '';
    } else {
      emailError.value = result.error || 'Failed to resend code';
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
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.account-settings {
  background-color: var(--sidebar-surface);
  border-radius: 12px;
  border: 1px solid var(--sidebar-border);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  position: relative;
  overflow: hidden;
}

.account-settings__accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
}

.account-settings__header {
  padding: 32px 32px 24px;
  border-bottom: 1px solid var(--sidebar-border);
  position: relative;
}

.account-settings__close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: transparent;
  border: none;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
}

.account-settings__close:hover {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.account-settings__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.account-settings__icon {
  width: 48px;
  height: 48px;
  background-color: rgba(6, 182, 212, 0.15);
  border: none;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sidebar-accent);
  margin-bottom: 16px;
}

.account-settings__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 8px 0;
}

.account-settings__subtitle {
  font-size: 14px;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.account-settings__tabs {
  display: flex;
  gap: 0;
  padding: 0 32px;
  border-bottom: 1px solid var(--sidebar-border);
}

.account-settings__tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--sidebar-text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
  white-space: nowrap;
}

.account-settings__tab:hover {
  color: var(--sidebar-text);
}

.account-settings__tab--active {
  color: var(--sidebar-accent);
  border-bottom-color: var(--sidebar-accent);
}

.account-settings__content {
  padding: 24px 32px 32px;
  overflow-y: auto;
  flex: 1;
}

.account-settings__content::-webkit-scrollbar {
  width: 6px;
}

.account-settings__content::-webkit-scrollbar-track {
  background: transparent;
}

.account-settings__content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

/* Toggle Row */
.account-settings__toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
}

.account-settings__toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.account-settings__toggle-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--sidebar-text);
}

.account-settings__toggle-desc {
  font-size: 12px;
  color: var(--sidebar-text-muted);
}

/* Toggle Switch */
.account-settings__toggle {
  flex-shrink: 0;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  cursor: pointer;
  position: relative;
  transition: all 150ms ease;
  padding: 0;
}

.account-settings__toggle--on {
  background: rgba(6, 182, 212, 0.35);
  border-color: rgba(6, 182, 212, 0.5);
}

.account-settings__toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.account-settings__toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--sidebar-text-muted);
  transition: all 150ms ease;
}

.account-settings__toggle--on .account-settings__toggle-knob {
  left: 22px;
  background: var(--sidebar-accent);
}

/* Button Group */
.account-settings__button-group {
  display: flex;
  gap: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--sidebar-border);
}

.account-settings__button-option {
  flex: 1;
  padding: 8px 12px;
  background: var(--sidebar-hover);
  border: none;
  border-right: 1px solid var(--sidebar-border);
  color: var(--sidebar-text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.account-settings__button-option:last-child {
  border-right: none;
}

.account-settings__button-option:hover:not(:disabled) {
  background-color: var(--sidebar-active);
  color: var(--sidebar-text);
}

.account-settings__button-option--active {
  background: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
}

.account-settings__button-option:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Position Grid */
.account-settings__position-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.account-settings__position-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all 150ms ease;
}

.account-settings__position-btn:hover:not(:disabled) {
  background-color: var(--sidebar-active);
  color: var(--sidebar-text);
}

.account-settings__position-btn--active {
  background: rgba(6, 182, 212, 0.15);
  border-color: rgba(6, 182, 212, 0.4);
  color: var(--sidebar-accent);
}

.account-settings__position-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.account-settings__position-dot {
  width: 16px;
  height: 12px;
  border: 1px solid currentColor;
  border-radius: 2px;
  position: relative;
}

.account-settings__position-dot::after {
  content: '';
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 1px;
  background: currentColor;
}

.account-settings__position-dot--top-left::after { top: 1px; left: 1px; }
.account-settings__position-dot--top-right::after { top: 1px; right: 1px; }
.account-settings__position-dot--bottom-left::after { bottom: 1px; left: 1px; }
.account-settings__position-dot--bottom-right::after { bottom: 1px; right: 1px; }

/* Preview Box */
.account-settings__preview-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.15);
  border-radius: 8px;
  color: var(--sidebar-accent);
  font-size: 13px;
}

/* Disabled state for sections */
.account-settings__field--disabled {
  opacity: 0.4;
  pointer-events: none;
}

.account-settings__info-box {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.15);
  border-radius: 12px;
  color: var(--sidebar-accent);
}

.account-settings__info-title {
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--sidebar-text);
}

.account-settings__info-text {
  font-size: 14px;
  margin: 0;
  color: var(--sidebar-text-muted);
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
  color: var(--sidebar-text);
  margin: 0 0 16px 0;
}

.account-settings__section-desc {
  font-size: 13px;
  color: var(--sidebar-text-muted);
  margin: -8px 0 12px;
  line-height: 1.4;
}

.account-settings__restart-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--sidebar-border, #27272a);
  background: transparent;
  color: var(--sidebar-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.account-settings__restart-btn:hover:not(:disabled) {
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
}

.account-settings__restart-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  color: var(--sidebar-text-muted);
}

.account-settings__input {
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  color: var(--sidebar-text);
  transition: all 150ms ease;
}

.account-settings__input::placeholder {
  color: var(--sidebar-text-muted);
}

.account-settings__input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
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
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  cursor: pointer;
  transition: all 150ms ease;
  margin-top: 8px;
}

.account-settings__button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
}

.account-settings__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.account-settings__button--secondary {
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  color: var(--sidebar-text);
  box-shadow: none;
}

.account-settings__button--secondary:hover:not(:disabled) {
  background-color: var(--sidebar-active);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: none;
  transform: none;
  color: var(--sidebar-text);
}

.account-settings__success {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.15);
  border-radius: 8px;
  color: var(--sidebar-accent);
  font-size: 14px;
  margin: 0;
}

.account-settings__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
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
