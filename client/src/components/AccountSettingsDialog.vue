<template>
  <Modal
    :open="show"
    title="Account settings"
    description="Manage your account, preferences and notifications"
    :icon="Settings"
    size="xl"
    flush
    :dismissible="!saving"
    class="h-[min(600px,calc(100vh-6rem))]"
    @close="handleClose"
  >
    <div class="mt-3 flex h-[calc(100%-0.75rem)] min-h-0 border-t border-line-subtle">
      <!-- Section rail -->
      <nav class="flex w-44 shrink-0 flex-col gap-0.5 border-r border-line-subtle p-2" aria-label="Settings sections">
        <template v-for="tab in tabs" :key="tab.id">
          <div v-if="tab.id === 'delete'" class="mx-2 my-1.5 h-px bg-line-subtle" />
          <button
            type="button"
            class="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            :class="
              activeTab === tab.id
                ? 'bg-surface-active font-medium text-fg'
                : 'text-fg-muted hover:bg-surface-hover hover:text-fg'
            "
            :aria-current="activeTab === tab.id ? 'page' : undefined"
            @click="activeTab = tab.id"
          >
            <component
              :is="tab.icon"
              class="size-4 shrink-0"
              :class="activeTab === tab.id ? 'text-fg' : 'text-fg-subtle'"
            />
            <span class="truncate">{{ tab.label }}</span>
          </button>
        </template>
      </nav>

      <!-- Content: keyed by tab so each switch starts at the top and eases in -->
      <div :key="activeTab" class="min-w-0 flex-1 animate-enter overflow-y-auto px-5 py-4">
        <!-- ==================== ACCOUNT TAB ==================== -->
        <div v-if="activeTab === 'account'" class="flex flex-col gap-5">
          <!-- Google account -->
          <template v-if="authProvider === 'google'">
            <Alert>
              <Info />
              <AlertTitle>Google account</AlertTitle>
              <AlertDescription>
                Switch Gmail accounts, or convert to email/password login. Your projects, credits, and settings stay on
                this account.
              </AlertDescription>
            </Alert>

            <SettingsSection title="Connected Gmail">
              <SettingRow
                inset
                :label="currentEmail || 'Google account'"
                description="Signed in with Google"
                :icon="Mail"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  :disabled="saving || emailChangeStep === 'otp'"
                  :loading="saving && savingType === 'google'"
                  @click="handleSwitchGoogle"
                >
                  <RefreshCw v-if="!(saving && savingType === 'google')" />
                  {{ saving && savingType === 'google' ? 'Switching...' : 'Switch Google account' }}
                </Button>
              </SettingRow>
              <div v-if="googleSuccess || googleError" class="px-4 py-2.5">
                <SettingsStatus :success="googleSuccess" :error="googleError" />
              </div>
            </SettingsSection>

            <SettingsSection
              title="Switch to email and password"
              description="Sign in with an email address and password instead of Google."
            >
              <div class="flex flex-col gap-3 p-4">
                <template v-if="emailChangeStep === 'otp'">
                  <p class="text-sm text-fg-muted">
                    Enter the 6-digit code sent to
                    <span class="font-medium text-fg">{{ pendingEmail }}</span>
                  </p>
                  <Field label="Verification code">
                    <Input
                      v-model="emailChangeOtp"
                      type="text"
                      inputmode="numeric"
                      maxlength="6"
                      placeholder="000000"
                      class="tabular max-w-40 tracking-[0.25em]"
                      :disabled="saving"
                      @input="onOtpInput"
                    />
                  </Field>
                </template>
                <template v-else>
                  <Field label="New email">
                    <Input v-model="newEmail" type="email" placeholder="you@example.com" :disabled="saving" />
                  </Field>
                  <div class="grid grid-cols-2 gap-3">
                    <Field label="Create password">
                      <Input
                        v-model="oauthNewPassword"
                        type="password"
                        placeholder="Min 8 characters"
                        :disabled="saving"
                      />
                    </Field>
                    <Field label="Confirm password">
                      <Input
                        v-model="oauthConfirmPassword"
                        type="password"
                        placeholder="Confirm password"
                        :disabled="saving"
                      />
                    </Field>
                  </div>
                </template>
                <SettingsStatus :success="emailSuccess" :error="emailError" />
              </div>
              <template #footer>
                <template v-if="emailChangeStep === 'otp'">
                  <Button variant="ghost" size="sm" :disabled="saving" @click="cancelEmailChange">Cancel</Button>
                  <Button variant="secondary" size="sm" :disabled="saving" @click="handleResendEmailOtp">
                    Resend code
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    :disabled="emailChangeOtp.length !== 6 || saving"
                    :loading="saving && savingType === 'email-otp'"
                    @click="handleVerifyEmailOtp"
                  >
                    {{ saving && savingType === 'email-otp' ? 'Verifying...' : 'Verify & convert' }}
                  </Button>
                </template>
                <Button
                  v-else
                  variant="secondary"
                  size="sm"
                  :disabled="!canConvertToEmail || saving"
                  :loading="saving && savingType === 'email'"
                  @click="handleConvertToEmail"
                >
                  <Mail v-if="!(saving && savingType === 'email')" />
                  {{ saving && savingType === 'email' ? 'Sending code...' : 'Send verification code' }}
                </Button>
              </template>
            </SettingsSection>
          </template>

          <!-- Wallet account -->
          <Alert v-else-if="!isEmailUser">
            <Info />
            <AlertTitle>Wallet account</AlertTitle>
            <AlertDescription>
              You signed in with a wallet. Email and password management is not available for wallet accounts.
            </AlertDescription>
          </Alert>

          <!-- Email account -->
          <template v-else>
            <SettingsSection title="Email address">
              <div class="flex flex-col gap-3 p-4">
                <Field label="Current email">
                  <Input :model-value="currentEmail" type="text" disabled readonly />
                </Field>

                <template v-if="emailChangeStep === 'otp'">
                  <p class="text-sm text-fg-muted">
                    Enter the 6-digit code sent to
                    <span class="font-medium text-fg">{{ pendingEmail }}</span>
                  </p>
                  <Field label="Verification code">
                    <Input
                      v-model="emailChangeOtp"
                      type="text"
                      inputmode="numeric"
                      maxlength="6"
                      placeholder="000000"
                      class="tabular max-w-40 tracking-[0.25em]"
                      :disabled="saving"
                      @input="onOtpInput"
                    />
                  </Field>
                </template>
                <div v-else class="grid grid-cols-2 gap-3">
                  <Field label="New email">
                    <Input v-model="newEmail" type="email" placeholder="Enter new email address" :disabled="saving" />
                  </Field>
                  <Field label="Password">
                    <Input
                      v-model="emailPassword"
                      type="password"
                      placeholder="Your current password"
                      :disabled="saving"
                    />
                  </Field>
                </div>

                <SettingsStatus :success="emailSuccess" :error="emailError" />
              </div>
              <template #footer>
                <template v-if="emailChangeStep === 'otp'">
                  <Button variant="ghost" size="sm" :disabled="saving" @click="cancelEmailChange">Cancel</Button>
                  <Button variant="secondary" size="sm" :disabled="saving" @click="handleResendEmailOtp">
                    Resend code
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    :disabled="emailChangeOtp.length !== 6 || saving"
                    :loading="saving && savingType === 'email-otp'"
                    @click="handleVerifyEmailOtp"
                  >
                    {{ saving && savingType === 'email-otp' ? 'Verifying...' : 'Verify email' }}
                  </Button>
                </template>
                <Button
                  v-else
                  variant="secondary"
                  size="sm"
                  :disabled="!canChangeEmail || saving"
                  :loading="saving && savingType === 'email'"
                  @click="handleChangeEmail"
                >
                  <Mail v-if="!(saving && savingType === 'email')" />
                  {{ saving && savingType === 'email' ? 'Sending code...' : 'Change email' }}
                </Button>
              </template>
            </SettingsSection>

            <SettingsSection title="Password">
              <div class="flex flex-col gap-3 p-4">
                <Field label="Current password">
                  <Input
                    v-model="currentPassword"
                    type="password"
                    placeholder="Enter current password"
                    :disabled="saving"
                  />
                </Field>
                <div class="grid grid-cols-2 gap-3">
                  <Field label="New password">
                    <Input v-model="newPassword" type="password" placeholder="Min 8 characters" :disabled="saving" />
                  </Field>
                  <Field label="Confirm new password">
                    <Input
                      v-model="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                      :disabled="saving"
                    />
                  </Field>
                </div>
                <SettingsStatus :success="passwordSuccess" :error="passwordError" />
              </div>
              <template #footer>
                <Button
                  variant="secondary"
                  size="sm"
                  :disabled="!canChangePassword || saving"
                  :loading="saving && savingType === 'password'"
                  @click="handleChangePassword"
                >
                  <Lock v-if="!(saving && savingType === 'password')" />
                  {{ saving && savingType === 'password' ? 'Changing password...' : 'Change password' }}
                </Button>
              </template>
            </SettingsSection>
          </template>
        </div>

        <!-- ==================== PREFERENCES TAB ==================== -->
        <div v-else-if="activeTab === 'preferences'" class="flex flex-col gap-5">
          <SettingsSection title="Time format">
            <SettingRow inset label="24-hour time" description="Display times as 15:30 instead of 3:30 PM">
              <Switch
                :model-value="prefsStore.is24Hour"
                :disabled="prefsStore.saving"
                aria-label="24-hour time"
                @update:model-value="(on) => togglePref('time_format_preference', on ? '24hr' : '12hr')"
              />
            </SettingRow>
            <div class="flex items-center gap-2 px-4 py-2 text-xs text-fg-muted">
              <Clock class="size-3.5 shrink-0 text-fg-subtle" />
              Preview
              <span class="tabular text-fg">
                {{ prefsStore.is24Hour ? '15:30' : '3:30 PM' }} · {{ prefsStore.is24Hour ? '09:00' : '9:00 AM' }}
              </span>
            </div>
          </SettingsSection>

          <SettingsSection
            v-if="desktopToolsAvailable"
            title="App tours"
            description="Restart a guided tour anytime. Skip or finish marks it complete."
          >
            <SettingRow
              v-for="tour in tourRestartOptions"
              :key="tour.id"
              inset
              :label="tour.label"
              :description="tour.desc"
            >
              <Button
                variant="secondary"
                size="sm"
                :disabled="restartingTour === tour.id"
                @click="onRestartTour(tour.id)"
              >
                <RefreshCw />
                Restart
              </Button>
            </SettingRow>
          </SettingsSection>
        </div>

        <!-- ==================== NOTIFICATIONS TAB ==================== -->
        <div v-else-if="activeTab === 'notifications'" class="flex flex-col gap-5">
          <SettingsSection title="Toast notifications">
            <SettingRow inset label="Enable notifications" description="Show in-app toast notifications">
              <Switch
                :model-value="prefsStore.toastEnabled"
                :disabled="prefsStore.saving"
                aria-label="Enable notifications"
                @update:model-value="(on) => togglePref('toast_enabled', on)"
              />
            </SettingRow>
            <SettingRow inset label="Duration" :disabled="!prefsStore.toastEnabled">
              <SegmentedControl
                :model-value="prefsStore.toastDuration"
                :options="durationSegments"
                size="sm"
                @update:model-value="(value) => togglePref('toast_duration', value)"
              />
            </SettingRow>
            <SettingRow inset label="Position" :disabled="!prefsStore.toastEnabled">
              <SegmentedControl
                :model-value="prefsStore.toastPosition"
                :options="positionSegments"
                size="sm"
                @update:model-value="(value) => togglePref('toast_position', value)"
              />
            </SettingRow>
            <SettingRow
              inset
              label="Notification sound"
              description="Play a chime when notifications appear"
              :disabled="!prefsStore.toastEnabled"
            >
              <Switch
                :model-value="prefsStore.toastSoundEnabled"
                :disabled="!prefsStore.toastEnabled || prefsStore.saving"
                aria-label="Notification sound"
                @update:model-value="(on) => togglePref('toast_sound_enabled', on)"
              />
            </SettingRow>
            <SettingRow
              inset
              label="Background notifications"
              description="Show notifications when the app is minimized"
              :disabled="!prefsStore.toastEnabled"
            >
              <Switch
                :model-value="prefsStore.toastBackgroundEnabled"
                :disabled="!prefsStore.toastEnabled || prefsStore.saving"
                aria-label="Background notifications"
                @update:model-value="(on) => togglePref('toast_background_enabled', on)"
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="Notification categories">
            <SettingRow
              v-for="cat in categoryOptions"
              :key="cat.key"
              inset
              :label="cat.label"
              :description="cat.desc"
              :disabled="!prefsStore.toastEnabled"
            >
              <Switch
                :model-value="prefsStore.preferences[cat.key]"
                :disabled="!prefsStore.toastEnabled || prefsStore.saving"
                :aria-label="cat.label"
                @update:model-value="(on) => togglePref(cat.key, on)"
              />
            </SettingRow>
          </SettingsSection>
        </div>

        <!-- ==================== DELETE DATA TAB ==================== -->
        <DeleteDataTab
          v-else-if="desktopToolsAvailable && activeTab === 'delete'"
          :deletion-enabled="desktopToolsAvailable"
        />
      </div>
    </div>
  </Modal>
</template>

<script setup>
  import { ref, computed, markRaw } from 'vue';
  import { Settings, Mail, Lock, Info, Clock, Bell, User, Trash2, RefreshCw } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { useUserPreferencesStore } from '@/stores/userPreferences';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import { Switch } from '@/components/ui/switch';
  import DeleteDataTab from '@/components/settings/DeleteDataTab.vue';
  import SettingsSection from '@/components/settings/SettingsSection.vue';
  import SettingsStatus from '@/components/settings/SettingsStatus.vue';
  import { SettingRow } from '@/components/ui/setting-row';
  import { useAppTour } from '@/services/settingsRuntime';

  const props = defineProps({
    desktopToolsAvailable: { type: Boolean, default: true },
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
    { id: 'desktop_sidebar', label: 'Sidebar overview', desc: 'Browse, Library, Create, Manage' },
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
  const tabs = computed(() => [
    { id: 'account', label: 'Account', icon: markRaw(User) },
    { id: 'preferences', label: 'Preferences', icon: markRaw(Clock) },
    { id: 'notifications', label: 'Notifications', icon: markRaw(Bell) },
    ...(props.desktopToolsAvailable ? [{ id: 'delete', label: 'Delete data', icon: markRaw(Trash2) }] : []),
  ]);
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
    { label: 'Top left', value: 'top-left' },
    { label: 'Top right', value: 'top-right' },
    { label: 'Bottom left', value: 'bottom-left' },
    { label: 'Bottom right', value: 'bottom-right' },
  ];

  // Segmented-control options (disabled while a preference save is in flight)
  const durationSegments = computed(() => durationOptions.map((opt) => ({ ...opt, disabled: prefsStore.saving })));
  const positionSegments = computed(() => positionOptions.map((opt) => ({ ...opt, disabled: prefsStore.saving })));

  // Category options
  const categoryOptions = [
    { key: 'notify_livestream', label: 'Livestream', desc: 'Streamer went live, recording started/stopped' },
    { key: 'notify_clips', label: 'Clips & video', desc: 'Clips detected, export complete, transcription done' },
    { key: 'notify_downloads', label: 'Downloads & uploads', desc: 'Download complete, upload complete' },
    { key: 'notify_projects', label: 'Projects & editor', desc: 'Project saved, auto-save, editor warnings' },
    { key: 'notify_social', label: 'Social & publishing', desc: 'Post published, scheduled post sent' },
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
    emailChangeOtp.value = String(event.target.value || '')
      .replace(/\D/g, '')
      .slice(0, 6);
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
        emailSuccess.value = result.message || `Email updated to ${result.user?.email || pendingEmail.value}`;
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
