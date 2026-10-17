<template>
  <!--
    Shared with the browser app (apps/web), which only ships vue + lucide-vue-next. Keep this file (and any
    child it imports) free of the desktop UI primitives and their helper libraries: the overlay, panel,
    buttons and inputs below mirror Modal / Button / Input using token utilities only.
  -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[10040] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-[2px]"
        tabindex="-1"
        @click.self="!mandatory && close()"
        @keydown.esc="!mandatory && close()"
      >
        <Transition
          appear
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-[0.98]"
          leave-active-class="transition duration-100 ease-in"
          leave-to-class="opacity-0 scale-[0.98]"
        >
          <div
            v-if="modelValue"
            class="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-[var(--radius-modal)] bg-surface-raised text-fg shadow-[var(--shadow-lg)]"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="ids.title"
          >
            <button
              v-if="!mandatory"
              type="button"
              :disabled="auth.loading"
              class="absolute right-3 top-3 z-10 grid size-7 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
              aria-label="Close dialog"
              @click="close"
            >
              <X class="size-4" />
            </button>

            <div class="grid min-h-0 overflow-y-auto md:grid-cols-2">
              <!-- Branding & value props -->
              <div class="flex flex-col gap-6 border-b border-line-subtle bg-surface p-6 md:border-b-0 md:border-r md:p-7">
                <div class="flex items-center gap-2.5">
                  <img :src="logoIcon" alt="" class="size-7 rounded-lg" />
                  <img :src="logo" alt="Clippster" class="h-5 w-auto brightness-0 invert" />
                </div>

                <div class="flex flex-col gap-1.5">
                  <h2 :id="ids.title" class="text-lg font-semibold tracking-[-0.01em] text-fg">
                    Transform Videos into Viral Clips
                  </h2>
                  <p class="text-sm text-fg-muted">Sign in to unlock AI-powered clip creation and editing.</p>
                </div>

                <ul class="hidden flex-col gap-4 md:flex">
                  <li v-for="feature in features" :key="feature.title" class="flex items-start gap-3">
                    <span
                      class="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-hover text-fg-muted"
                    >
                      <component :is="feature.icon" class="size-4" />
                    </span>
                    <span class="min-w-0">
                      <span class="block text-sm font-medium text-fg">{{ feature.title }}</span>
                      <span class="mt-0.5 block text-xs text-fg-muted">{{ feature.description }}</span>
                    </span>
                  </li>
                </ul>

                <p
                  class="mt-auto hidden items-center gap-2 border-t border-line-subtle pt-4 text-xs text-fg-subtle md:flex"
                >
                  <ShieldCheck class="size-3.5" />
                  Secure authentication
                </p>
              </div>

              <!-- Auth actions -->
              <div class="flex flex-col justify-center p-6 md:p-7">
                <!-- View: Sign in -->
                <div v-if="currentView === 'signin'" class="flex animate-enter flex-col gap-5">
                  <div>
                    <h3 class="text-base font-semibold text-fg">Sign In</h3>
                    <p class="mt-0.5 text-xs text-fg-muted">Use your email or continue with Google.</p>
                  </div>

                  <form class="flex flex-col gap-3.5" @submit.prevent="handleEmailLogin">
                    <div class="flex flex-col gap-1.5">
                      <label :for="ids.email" :class="labelClass">Email</label>
                      <input
                        :id="ids.email"
                        v-model="email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        autocomplete="email"
                        :class="inputClass"
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <div class="flex items-center justify-between gap-2">
                        <label :for="ids.password" :class="labelClass">Password</label>
                        <button type="button" :class="linkClass" @click="currentView = 'forgot-password'">
                          Forgot password?
                        </button>
                      </div>
                      <input
                        :id="ids.password"
                        v-model="password"
                        type="password"
                        required
                        placeholder="Your password"
                        autocomplete="current-password"
                        :class="inputClass"
                      />
                    </div>
                    <button type="submit" :disabled="auth.loading" :class="[primaryButtonClass, 'mt-1']">
                      <Loader2 v-if="auth.loading && authMethod === 'email'" class="animate-spin" />
                      <Mail v-else />
                      {{ auth.loading && authMethod === 'email' ? 'Signing in...' : 'Sign In' }}
                    </button>
                  </form>

                  <div class="flex items-center gap-3 text-2xs font-medium uppercase tracking-[0.06em] text-fg-subtle">
                    <span class="h-px flex-1 bg-line" />
                    or
                    <span class="h-px flex-1 bg-line" />
                  </div>

                  <button
                    type="button"
                    :disabled="auth.loading"
                    :class="secondaryButtonClass"
                    @click="authenticateWithGoogle"
                  >
                    <svg v-if="!auth.loading || authMethod !== 'google'" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <Loader2 v-else class="animate-spin" />
                    Google
                  </button>

                  <p class="text-center text-xs text-fg-muted">
                    Don't have an account?
                    <button type="button" :class="linkClass" @click="currentView = 'signup'">Sign up</button>
                  </p>
                </div>

                <!-- View: Sign up -->
                <div v-else-if="currentView === 'signup'" class="flex animate-enter flex-col gap-5">
                  <div>
                    <h3 class="text-base font-semibold text-fg">Create Account</h3>
                    <p class="mt-0.5 text-xs text-fg-muted">We'll email you a code to verify your address.</p>
                  </div>

                  <form class="flex flex-col gap-3.5" @submit.prevent="handleEmailRegister">
                    <div class="flex flex-col gap-1.5">
                      <label :for="ids.email" :class="labelClass">Email</label>
                      <input
                        :id="ids.email"
                        v-model="email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        autocomplete="email"
                        :class="inputClass"
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label :for="ids.password" :class="labelClass">Password</label>
                      <input
                        :id="ids.password"
                        v-model="password"
                        type="password"
                        required
                        minlength="8"
                        placeholder="At least 8 characters"
                        autocomplete="new-password"
                        :class="inputClass"
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label :for="ids.confirm" :class="labelClass">Confirm password</label>
                      <input
                        :id="ids.confirm"
                        v-model="confirmPassword"
                        type="password"
                        required
                        minlength="8"
                        placeholder="Repeat your password"
                        autocomplete="new-password"
                        :class="inputClass"
                        :aria-invalid="passwordMismatch || undefined"
                      />
                      <p v-if="passwordMismatch" class="text-xs text-danger">Passwords do not match</p>
                    </div>
                    <button
                      type="submit"
                      :disabled="auth.loading || password !== confirmPassword"
                      :class="[primaryButtonClass, 'mt-1']"
                    >
                      <Loader2 v-if="auth.loading" class="animate-spin" />
                      <UserPlus v-else />
                      {{ auth.loading ? 'Creating...' : 'Create Account' }}
                    </button>
                  </form>

                  <p class="text-center text-xs text-fg-muted">
                    Already have an account?
                    <button type="button" :class="linkClass" @click="currentView = 'signin'">Sign in</button>
                  </p>
                </div>

                <!-- View: Verify OTP -->
                <div v-else-if="currentView === 'verify-otp'" class="flex animate-enter flex-col gap-5">
                  <div>
                    <h3 class="text-base font-semibold text-fg">Check your email</h3>
                    <p class="mt-0.5 text-xs text-fg-muted">
                      Enter the 6-digit code sent to
                      <span class="font-medium text-fg">{{ auth.pendingVerificationEmail }}</span>
                    </p>
                  </div>

                  <form class="flex flex-col gap-3.5" @submit.prevent="handleVerifyOtp">
                    <div class="flex flex-col gap-1.5">
                      <label :for="ids.otp" :class="labelClass">Verification code</label>
                      <input
                        :id="ids.otp"
                        ref="otpInput"
                        v-model="otpCode"
                        type="text"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        maxlength="6"
                        required
                        placeholder="000000"
                        autocomplete="one-time-code"
                        :class="otpInputClass"
                        @input="handleOtpInput"
                      />
                    </div>
                    <button
                      type="submit"
                      :disabled="auth.loading || otpCode.length !== 6"
                      :class="[primaryButtonClass, 'mt-1']"
                    >
                      <Loader2 v-if="auth.loading" class="animate-spin" />
                      <CheckCircle v-else />
                      {{ auth.loading ? 'Verifying...' : 'Verify' }}
                    </button>
                  </form>

                  <div class="flex items-center justify-between gap-3 text-xs text-fg-muted">
                    <button type="button" :class="quietLinkClass" @click="resetToSignIn">← Back</button>
                    <span>
                      Didn't receive it?
                      <button
                        type="button"
                        :disabled="resendCooldown > 0 || auth.loading"
                        :class="linkClass"
                        @click="handleResendCode"
                      >
                        {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend' }}
                      </button>
                    </span>
                  </div>
                </div>

                <!-- View: Forgot password -->
                <div v-else-if="currentView === 'forgot-password'" class="flex animate-enter flex-col gap-5">
                  <div>
                    <h3 class="text-base font-semibold text-fg">Reset password</h3>
                    <p class="mt-0.5 text-xs text-fg-muted">Enter your email to receive a reset link.</p>
                  </div>

                  <form class="flex flex-col gap-3.5" @submit.prevent="handleForgotPassword">
                    <div class="flex flex-col gap-1.5">
                      <label :for="ids.email" :class="labelClass">Email</label>
                      <input
                        :id="ids.email"
                        v-model="email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        autocomplete="email"
                        :class="inputClass"
                      />
                    </div>
                    <button type="submit" :disabled="auth.loading" :class="[primaryButtonClass, 'mt-1']">
                      <Loader2 v-if="auth.loading" class="animate-spin" />
                      <Send v-else />
                      {{ auth.loading ? 'Sending...' : 'Send Reset Link' }}
                    </button>
                  </form>

                  <p class="text-center text-xs">
                    <button type="button" :class="quietLinkClass" @click="currentView = 'signin'">
                      ← Back to sign in
                    </button>
                  </p>
                </div>

                <!-- View: Choose a new password (reset link) -->
                <div v-else-if="currentView === 'reset-password'" class="flex animate-enter flex-col gap-5">
                  <div>
                    <h3 class="text-base font-semibold text-fg">Choose a new password</h3>
                    <p class="mt-0.5 text-xs text-fg-muted">Use at least 8 characters.</p>
                  </div>

                  <form class="flex flex-col gap-3.5" @submit.prevent="handleResetPassword">
                    <div class="flex flex-col gap-1.5">
                      <label :for="ids.password" :class="labelClass">Password</label>
                      <input
                        :id="ids.password"
                        v-model="password"
                        type="password"
                        required
                        minlength="8"
                        autocomplete="new-password"
                        placeholder="At least 8 characters"
                        :class="inputClass"
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label :for="ids.confirm" :class="labelClass">Confirm password</label>
                      <input
                        :id="ids.confirm"
                        v-model="confirmPassword"
                        type="password"
                        required
                        minlength="8"
                        autocomplete="new-password"
                        placeholder="Repeat your password"
                        :class="inputClass"
                        :aria-invalid="(!!confirmPassword && password !== confirmPassword) || undefined"
                      />
                      <p v-if="confirmPassword && password !== confirmPassword" class="text-xs text-danger">
                        Passwords do not match
                      </p>
                    </div>
                    <button
                      type="submit"
                      :disabled="auth.loading || password !== confirmPassword"
                      :class="[primaryButtonClass, 'mt-1']"
                    >
                      <Loader2 v-if="auth.loading" class="animate-spin" />
                      {{ auth.loading ? 'Saving...' : 'Save password' }}
                    </button>
                  </form>
                </div>

                <!-- View: Reset email sent -->
                <div v-else-if="currentView === 'reset-sent'" class="flex animate-enter flex-col gap-5">
                  <div class="flex items-start gap-3">
                    <span
                      class="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--success-line)] bg-success-soft text-success"
                    >
                      <CheckCircle class="size-4" />
                    </span>
                    <div>
                      <h3 class="text-base font-semibold text-fg">Check your email</h3>
                      <p class="mt-0.5 text-xs text-fg-muted">
                        If an account exists for {{ email }}, you'll receive a password reset link.
                      </p>
                    </div>
                  </div>
                  <button type="button" :class="secondaryButtonClass" @click="currentView = 'signin'">
                    Return to sign in
                  </button>
                </div>

                <!-- Error message -->
                <div
                  v-if="auth.error"
                  role="alert"
                  class="mt-4 flex animate-enter items-start gap-2 rounded-[var(--radius-control)] border border-[var(--danger-line)] bg-danger-soft px-3 py-2.5 text-xs text-danger"
                >
                  <AlertTriangle class="mt-px size-3.5 shrink-0" />
                  <p>{{ auth.error }}</p>
                </div>

                <!-- Success message -->
                <div
                  v-if="successMessage"
                  role="status"
                  class="mt-4 flex animate-enter items-start gap-2 rounded-[var(--radius-control)] border border-[var(--success-line)] bg-success-soft px-3 py-2.5 text-xs text-success"
                >
                  <CheckCircle class="mt-px size-3.5 shrink-0" />
                  <p>{{ successMessage }}</p>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, watch, ref, useId } from 'vue';
  import {
    X,
    Zap,
    Film,
    DollarSign,
    ShieldCheck,
    Loader2,
    AlertTriangle,
    Mail,
    UserPlus,
    CheckCircle,
    Send,
  } from 'lucide-vue-next';
  import logo from '../../public/logo.svg';
  import logoIcon from '../../public/logo-titlebar.svg';
  import type { AuthDialogAdapter } from './authDialog';

  const props = defineProps<{
    modelValue: boolean;
    mandatory?: boolean;
    auth: AuthDialogAdapter;
    referralCode?: string | null;
    resetToken?: string | null;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    authenticated: [isNewUser: boolean];
    passwordReset: [];
  }>();

  // Class recipes mirroring the desktop Button / Input / Field primitives (see note in the template).
  const controlBase =
    'w-full rounded-[var(--radius-control)] border border-line bg-surface-raised text-fg transition-[border-color,box-shadow] placeholder:text-fg-subtle hover:border-line-strong focus-visible:border-brand-line focus-visible:shadow-[0_0_0_3px_var(--brand-soft)] focus-visible:outline-none aria-[invalid=true]:border-[var(--danger-line)]';
  const inputClass = `${controlBase} block h-[var(--control-lg)] px-3 text-sm`;
  const otpInputClass = `${controlBase} block h-12 px-3 text-center font-mono text-xl tracking-[0.4em] placeholder:tracking-[0.4em]`;
  const labelClass = 'text-xs font-medium text-fg-muted';
  const buttonBase =
    'inline-flex h-[var(--control-lg)] w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-control)] px-4 text-sm font-medium transition-[background-color,border-color,color,box-shadow,opacity] duration-150 focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0';
  const primaryButtonClass = `${buttonBase} bg-[var(--primary-bg)] text-[var(--fg-on-light)] shadow-[var(--shadow-sm)] hover:bg-[var(--primary-bg-hover)]`;
  const secondaryButtonClass = `${buttonBase} border border-line bg-surface-raised text-fg hover:border-line-strong hover:bg-surface-hover`;
  const linkBase =
    'rounded-sm font-medium underline-offset-4 transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45';
  const linkClass = `${linkBase} text-xs text-brand hover:text-brand-hover hover:underline`;
  const quietLinkClass = `${linkBase} text-xs text-fg-muted hover:text-fg`;

  const features = [
    { icon: Zap, title: 'AI-powered detection', description: 'Automatically find the best moments in your videos' },
    { icon: Film, title: 'Professional editing', description: 'Timeline editor with multi-platform formatting' },
    { icon: DollarSign, title: 'Credit-based pricing', description: 'Pay only for what you use, no subscriptions' },
  ];

  const uid = useId();
  const ids = {
    title: `${uid}-title`,
    email: `${uid}-email`,
    password: `${uid}-password`,
    confirm: `${uid}-confirm`,
    otp: `${uid}-otp`,
  };

  const auth = props.auth;
  const authMethod = ref<'google' | 'email' | null>(null);
  const currentView = ref<'signin' | 'signup' | 'verify-otp' | 'forgot-password' | 'reset-sent' | 'reset-password'>(
    props.resetToken ? 'reset-password' : 'signin'
  );
  const email = ref('');
  const password = ref('');
  const confirmPassword = ref('');
  const otpCode = ref('');
  const successMessage = ref('');
  const resendCooldown = ref(0);
  const otpInput = ref<HTMLInputElement | null>(null);

  const passwordMismatch = computed(
    () => !!password.value && !!confirmPassword.value && password.value !== confirmPassword.value
  );

  let cooldownInterval: ReturnType<typeof setInterval> | null = null;

  const complete = (isNewUser = false) => {
    emit('update:modelValue', false);
    emit('authenticated', isNewUser);
  };

  const authenticateWithGoogle = async () => {
    authMethod.value = 'google';
    successMessage.value = '';
    const result = await auth.authenticateWithGoogle(props.referralCode ?? null);
    if (result.success) {
      complete(result.is_new_user);
    }
  };

  const handleEmailLogin = async () => {
    authMethod.value = 'email';
    successMessage.value = '';
    const result = await auth.loginWithEmail(email.value, password.value);

    if (result.success) {
      complete(result.is_new_user);
    } else if (result.needsVerification) {
      currentView.value = 'verify-otp';
      startResendCooldown();
    }
  };

  const handleEmailRegister = async () => {
    if (password.value !== confirmPassword.value) {
      return;
    }

    successMessage.value = '';
    const result = await auth.registerWithEmail(email.value, password.value, props.referralCode ?? null);

    if (result.success) {
      currentView.value = 'verify-otp';
      startResendCooldown();
    }
  };

  const handleVerifyOtp = async () => {
    successMessage.value = '';
    const result = await auth.verifyEmailOtp(auth.pendingVerificationEmail!, otpCode.value);

    if (result.success) {
      complete(result.is_new_user);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown.value > 0) return;

    successMessage.value = '';
    const result = await auth.resendVerificationEmail(auth.pendingVerificationEmail!);

    if (result.success) {
      successMessage.value = 'Code sent!';
      startResendCooldown();
      setTimeout(() => {
        successMessage.value = '';
      }, 3000);
    }
  };

  const handleForgotPassword = async () => {
    successMessage.value = '';
    const result = await auth.forgotPassword(email.value);

    if (result.success) {
      currentView.value = 'reset-sent';
    }
  };

  const handleResetPassword = async () => {
    if (!props.resetToken || password.value !== confirmPassword.value) return;
    const result = await auth.resetPassword(props.resetToken, password.value);
    if (result.success) {
      resetToSignIn();
      confirmPassword.value = '';
      successMessage.value = 'Password saved. Sign in to continue.';
      emit('passwordReset');
    }
  };

  const handleOtpInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    otpCode.value = target.value.replace(/\D/g, '').slice(0, 6);
  };

  const startResendCooldown = () => {
    resendCooldown.value = 60;
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = setInterval(() => {
      resendCooldown.value--;
      if (resendCooldown.value <= 0 && cooldownInterval) {
        clearInterval(cooldownInterval);
      }
    }, 1000);
  };

  const resetToSignIn = () => {
    currentView.value = 'signin';
    auth.clearPendingVerification();
    otpCode.value = '';
    password.value = '';
  };

  const close = () => {
    // Prevent closing if mandatory
    if (props.mandatory) return;

    if (!auth.loading) {
      emit('update:modelValue', false);
      // Reset state when closing
      setTimeout(() => {
        currentView.value = 'signin';
        email.value = '';
        password.value = '';
        confirmPassword.value = '';
        otpCode.value = '';
        successMessage.value = '';
      }, 300);
    }
  };

  // Handle ESC key press
  const handleEscKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && props.modelValue && !props.mandatory) {
      close();
    }
  };

  // Watch for pending verification to show OTP view
  watch(
    () => auth.pendingVerificationEmail,
    (newEmail) => {
      if (newEmail && currentView.value !== 'verify-otp') {
        currentView.value = 'verify-otp';
        startResendCooldown();
      }
    }
  );

  // Listen for magic link verification
  const handleEmailVerified = () => {
    if (auth.user) complete();
  };

  // Add/remove event listener
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        document.addEventListener('keydown', handleEscKey);
        document.body.style.overflow = 'hidden';

        // Check if there's a pending verification
        if (auth.pendingVerificationEmail) {
          currentView.value = 'verify-otp';
          startResendCooldown();
        }
      } else {
        document.removeEventListener('keydown', handleEscKey);
        document.body.style.overflow = '';
      }
    }
  );

  onMounted(() => {
    if (props.modelValue) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden';
    }

    window.addEventListener('email-verified', handleEmailVerified);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleEscKey);
    document.body.style.overflow = '';
    if (cooldownInterval) clearInterval(cooldownInterval);
    window.removeEventListener('email-verified', handleEmailVerified);
  });
</script>
