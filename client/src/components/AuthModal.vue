<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="auth-modal__overlay" @click.self="close" @keydown.esc="close" tabindex="-1">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
            <!-- Accent bar -->
            <div class="auth-modal__accent"></div>

            <!-- Close Button -->
            <button @click="close" :disabled="authStore.loading" class="auth-modal__close" aria-label="Close dialog">
              <X :size="18" />
            </button>

            <!-- Two Column Layout -->
            <div class="auth-modal__grid">
              <!-- Left Column - Branding & Value Props -->
              <div class="auth-modal__branding">
                <!-- Logo -->
                <div class="auth-modal__logo">
                  <img src="/logo.svg" alt="Clippster" />
                </div>

                <!-- Value Propositions -->
                <div class="auth-modal__value-props">
                  <div class="auth-modal__headline">
                    <h2 id="auth-modal-title" class="auth-modal__title">Transform Videos into Viral Clips</h2>
                    <p class="auth-modal__subtitle">Sign in to unlock AI-powered clip creation and editing</p>
                  </div>

                  <!-- Features List -->
                  <div class="auth-modal__features">
                    <div class="auth-modal__feature">
                      <div class="auth-modal__feature-icon auth-modal__feature-icon--primary">
                        <Zap :size="18" />
                      </div>
                      <div class="auth-modal__feature-content">
                        <h3 class="auth-modal__feature-title">AI-Powered Detection</h3>
                        <p class="auth-modal__feature-desc">Automatically find the best moments in your videos</p>
                      </div>
                    </div>

                    <div class="auth-modal__feature">
                      <div class="auth-modal__feature-icon auth-modal__feature-icon--secondary">
                        <Film :size="18" />
                      </div>
                      <div class="auth-modal__feature-content">
                        <h3 class="auth-modal__feature-title">Professional Editing</h3>
                        <p class="auth-modal__feature-desc">Timeline editor with multi-platform formatting</p>
                      </div>
                    </div>

                    <div class="auth-modal__feature">
                      <div class="auth-modal__feature-icon auth-modal__feature-icon--tertiary">
                        <DollarSign :size="18" />
                      </div>
                      <div class="auth-modal__feature-content">
                        <h3 class="auth-modal__feature-title">Credit-Based Pricing</h3>
                        <p class="auth-modal__feature-desc">Pay only for what you use, no subscriptions</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Trust Badge -->
                <div class="auth-modal__trust">
                  <ShieldCheck :size="14" />
                  <span>Secure authentication</span>
                </div>
              </div>

              <!-- Right Column - Auth Actions -->
              <div class="auth-modal__content">
                <!-- View: Sign In -->
                <template v-if="currentView === 'signin'">
                  <div class="auth-modal__view">
                    <div class="auth-modal__view-header">
                      <h3 class="auth-modal__view-title">Sign In</h3>
                    </div>

                    <!-- Email/Password Form -->
                    <form @submit.prevent="handleEmailLogin" class="auth-modal__form">
                      <div class="auth-modal__field">
                        <input
                          v-model="email"
                          type="email"
                          required
                          placeholder="Email address"
                          class="auth-modal__input"
                        />
                      </div>
                      <div class="auth-modal__field">
                        <input
                          v-model="password"
                          type="password"
                          required
                          placeholder="Password"
                          class="auth-modal__input"
                        />
                      </div>
                      <div class="auth-modal__field-action">
                        <button type="button" @click="currentView = 'forgot-password'" class="auth-modal__link">
                          Forgot password?
                        </button>
                      </div>
                      <button
                        type="submit"
                        :disabled="authStore.loading"
                        class="auth-modal__btn auth-modal__btn--primary"
                      >
                        <Loader2
                          v-if="authStore.loading && authMethod === 'email'"
                          :size="16"
                          class="auth-modal__spinner"
                        />
                        <Mail v-else :size="16" />
                        <span>{{ authStore.loading && authMethod === 'email' ? 'Signing in...' : 'Sign In' }}</span>
                      </button>
                    </form>

                    <p class="auth-modal__switch-text">
                      Don't have an account?
                      <button @click="currentView = 'signup'" class="auth-modal__link">Sign up</button>
                    </p>

                    <!-- OR Divider -->
                    <div class="auth-modal__divider">
                      <span>OR</span>
                    </div>

                    <!-- Social Auth Buttons -->
                    <div class="auth-modal__social">
                      <button
                        @click="authenticateWithGoogle"
                        :disabled="authStore.loading"
                        class="auth-modal__social-btn"
                      >
                        <svg
                          v-if="!authStore.loading || authMethod !== 'google'"
                          class="auth-modal__social-icon"
                          viewBox="0 0 24 24"
                        >
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
                        <Loader2 v-else :size="16" class="auth-modal__spinner" />
                        <span>Google</span>
                      </button>

                      <button @click="connectWallet" :disabled="authStore.loading" class="auth-modal__social-btn">
                        <Wallet v-if="!authStore.loading || authMethod !== 'wallet'" :size="16" />
                        <Loader2 v-else :size="16" class="auth-modal__spinner" />
                        <span>Phantom Wallet</span>
                      </button>
                    </div>
                  </div>
                </template>

                <!-- View: Sign Up -->
                <template v-else-if="currentView === 'signup'">
                  <div class="auth-modal__view">
                    <div class="auth-modal__view-header">
                      <h3 class="auth-modal__view-title">Create Account</h3>
                    </div>

                    <form @submit.prevent="handleEmailRegister" class="auth-modal__form">
                      <div class="auth-modal__field">
                        <input
                          v-model="email"
                          type="email"
                          required
                          placeholder="Email address"
                          class="auth-modal__input"
                        />
                      </div>
                      <div class="auth-modal__field">
                        <input
                          v-model="password"
                          type="password"
                          required
                          minlength="8"
                          placeholder="Password (min 8 characters)"
                          class="auth-modal__input"
                        />
                      </div>
                      <div class="auth-modal__field">
                        <input
                          v-model="confirmPassword"
                          type="password"
                          required
                          minlength="8"
                          placeholder="Confirm password"
                          class="auth-modal__input"
                        />
                      </div>
                      <p
                        v-if="password && confirmPassword && password !== confirmPassword"
                        class="auth-modal__error-inline"
                      >
                        Passwords do not match
                      </p>
                      <button
                        type="submit"
                        :disabled="authStore.loading || password !== confirmPassword"
                        class="auth-modal__btn auth-modal__btn--primary"
                      >
                        <Loader2 v-if="authStore.loading" :size="16" class="auth-modal__spinner" />
                        <UserPlus v-else :size="16" />
                        <span>{{ authStore.loading ? 'Creating...' : 'Create Account' }}</span>
                      </button>
                    </form>

                    <p class="auth-modal__switch-text">
                      Already have an account?
                      <button @click="currentView = 'signin'" class="auth-modal__link">Sign in</button>
                    </p>
                  </div>
                </template>

                <!-- View: Verify OTP -->
                <template v-else-if="currentView === 'verify-otp'">
                  <div class="auth-modal__view">
                    <div class="auth-modal__view-header auth-modal__view-header--centered">
                      <div class="auth-modal__view-icon">
                        <Mail :size="24" />
                      </div>
                      <h3 class="auth-modal__view-title">Check your email</h3>
                      <p class="auth-modal__view-subtitle">
                        Enter the 6-digit code sent to
                        <br />
                        <span class="auth-modal__email-highlight">{{ authStore.pendingVerificationEmail }}</span>
                      </p>
                    </div>

                    <form @submit.prevent="handleVerifyOtp" class="auth-modal__form">
                      <input
                        ref="otpInput"
                        v-model="otpCode"
                        type="text"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        maxlength="6"
                        required
                        placeholder="000000"
                        class="auth-modal__input auth-modal__input--otp"
                        @input="handleOtpInput"
                      />
                      <button
                        type="submit"
                        :disabled="authStore.loading || otpCode.length !== 6"
                        class="auth-modal__btn auth-modal__btn--primary"
                      >
                        <Loader2 v-if="authStore.loading" :size="16" class="auth-modal__spinner" />
                        <CheckCircle v-else :size="16" />
                        <span>{{ authStore.loading ? 'Verifying...' : 'Verify' }}</span>
                      </button>
                    </form>

                    <div class="auth-modal__otp-actions">
                      <p class="auth-modal__switch-text">
                        Didn't receive it?
                        <button
                          @click="handleResendCode"
                          :disabled="resendCooldown > 0 || authStore.loading"
                          class="auth-modal__link"
                        >
                          {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend' }}
                        </button>
                      </p>
                      <button @click="resetToSignIn" class="auth-modal__back-link">← Back</button>
                    </div>
                  </div>
                </template>

                <!-- View: Forgot Password -->
                <template v-else-if="currentView === 'forgot-password'">
                  <div class="auth-modal__view">
                    <div class="auth-modal__view-header">
                      <h3 class="auth-modal__view-title">Reset Password</h3>
                      <p class="auth-modal__view-subtitle">Enter your email to receive a reset link</p>
                    </div>

                    <form @submit.prevent="handleForgotPassword" class="auth-modal__form">
                      <div class="auth-modal__field">
                        <input
                          v-model="email"
                          type="email"
                          required
                          placeholder="Email address"
                          class="auth-modal__input"
                        />
                      </div>
                      <button
                        type="submit"
                        :disabled="authStore.loading"
                        class="auth-modal__btn auth-modal__btn--primary"
                      >
                        <Loader2 v-if="authStore.loading" :size="16" class="auth-modal__spinner" />
                        <Send v-else :size="16" />
                        <span>{{ authStore.loading ? 'Sending...' : 'Send Reset Link' }}</span>
                      </button>
                    </form>

                    <p class="auth-modal__switch-text">
                      <button @click="currentView = 'signin'" class="auth-modal__link">← Back to sign in</button>
                    </p>
                  </div>
                </template>

                <!-- View: Reset Email Sent -->
                <template v-else-if="currentView === 'reset-sent'">
                  <div class="auth-modal__view">
                    <div class="auth-modal__view-header auth-modal__view-header--centered">
                      <div class="auth-modal__view-icon auth-modal__view-icon--success">
                        <CheckCircle :size="24" />
                      </div>
                      <h3 class="auth-modal__view-title">Check your email</h3>
                      <p class="auth-modal__view-subtitle">
                        If an account exists for {{ email }}, you'll receive a password reset link.
                      </p>
                    </div>
                    <button @click="currentView = 'signin'" class="auth-modal__link auth-modal__link--block">
                      Return to sign in
                    </button>
                  </div>
                </template>

                <!-- Error Message -->
                <Transition name="slide-fade">
                  <div
                    v-if="authStore.error && currentView !== 'verify-otp'"
                    class="auth-modal__message auth-modal__message--error"
                  >
                    <AlertTriangle :size="14" />
                    <p>{{ authStore.error }}</p>
                  </div>
                </Transition>

                <!-- Success Message -->
                <Transition name="slide-fade">
                  <div v-if="successMessage" class="auth-modal__message auth-modal__message--success">
                    <CheckCircle :size="14" />
                    <p>{{ successMessage }}</p>
                  </div>
                </Transition>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { onMounted, onUnmounted, watch, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import {
    X,
    Zap,
    Film,
    DollarSign,
    ShieldCheck,
    Wallet,
    Loader2,
    AlertTriangle,
    Mail,
    UserPlus,
    CheckCircle,
    Send,
  } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { getDefaultRoute } from '@/router';

  const props = defineProps<{
    modelValue: boolean;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
  }>();

  const authStore = useAuthStore();
  const router = useRouter();
  const authMethod = ref<'wallet' | 'google' | 'email' | null>(null);
  const currentView = ref<'signin' | 'signup' | 'verify-otp' | 'forgot-password' | 'reset-sent'>('signin');
  const email = ref('');
  const password = ref('');
  const confirmPassword = ref('');
  const otpCode = ref('');
  const successMessage = ref('');
  const resendCooldown = ref(0);
  const otpInput = ref<HTMLInputElement | null>(null);

  let cooldownInterval: ReturnType<typeof setInterval> | null = null;

  // Redirect to appropriate page after successful login
  const redirectAfterLogin = (user: any) => {
    const targetRoute = getDefaultRoute(user);
    router.push(targetRoute);
  };

  const connectWallet = async () => {
    authMethod.value = 'wallet';
    successMessage.value = '';
    const result = await authStore.authenticateWithWallet();
    if (result.success) {
      close();
      redirectAfterLogin(result.user);
    }
  };

  const authenticateWithGoogle = async () => {
    authMethod.value = 'google';
    successMessage.value = '';
    const result = await authStore.authenticateWithGoogle();
    if (result.success) {
      close();
      redirectAfterLogin(result.user);
    }
  };

  const handleEmailLogin = async () => {
    authMethod.value = 'email';
    successMessage.value = '';
    const result = await authStore.loginWithEmail(email.value, password.value);

    if (result.success) {
      close();
      redirectAfterLogin(result.user);
    } else if ((result as any).needsVerification) {
      currentView.value = 'verify-otp';
      startResendCooldown();
    }
  };

  const handleEmailRegister = async () => {
    if (password.value !== confirmPassword.value) {
      return;
    }

    successMessage.value = '';
    const result = await authStore.registerWithEmail(email.value, password.value);

    if (result.success) {
      currentView.value = 'verify-otp';
      startResendCooldown();
    }
  };

  const handleVerifyOtp = async () => {
    successMessage.value = '';
    const result = await authStore.verifyEmailOtp(authStore.pendingVerificationEmail!, otpCode.value);

    if (result.success) {
      close();
      redirectAfterLogin(result.user);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown.value > 0) return;

    successMessage.value = '';
    const result = await authStore.resendVerificationEmail(authStore.pendingVerificationEmail!);

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
    const result = await authStore.forgotPassword(email.value);

    if (result.success) {
      currentView.value = 'reset-sent';
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
    authStore.clearPendingVerification();
    otpCode.value = '';
    password.value = '';
  };

  const close = () => {
    if (!authStore.loading) {
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
    if (event.key === 'Escape' && props.modelValue) {
      close();
    }
  };

  // Watch for pending verification to show OTP view
  watch(
    () => authStore.pendingVerificationEmail,
    (newEmail) => {
      if (newEmail && currentView.value !== 'verify-otp') {
        currentView.value = 'verify-otp';
        startResendCooldown();
      }
    }
  );

  // Listen for magic link verification
  const handleEmailVerified = () => {
    close();
    // After magic link verification, redirect to appropriate page
    redirectAfterLogin(authStore.user);
  };

  // Add/remove event listener
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        document.addEventListener('keydown', handleEscKey);
        document.body.style.overflow = 'hidden';

        // Check if there's a pending verification
        if (authStore.pendingVerificationEmail) {
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

<style scoped>
  /* ===== Overlay ===== */
  .auth-modal__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 9999;
  }

  /* ===== Dialog Container ===== */
  .auth-modal {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 720px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .auth-modal__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Close Button ===== */
  .auth-modal__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 10;
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

  .auth-modal__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .auth-modal__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== Two Column Grid ===== */
  .auth-modal__grid {
    display: grid;
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  @media (min-width: 768px) {
    .auth-modal__grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  /* ===== Branding Column ===== */
  .auth-modal__branding {
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    background-color: rgba(6, 182, 212, 0.04);
    border-bottom: 1px solid var(--sidebar-border);
  }

  @media (min-width: 768px) {
    .auth-modal__branding {
      padding: 2rem;
      border-bottom: none;
      border-right: 1px solid var(--sidebar-border);
    }
  }

  .auth-modal__logo {
    margin-bottom: 1.5rem;
  }

  .auth-modal__logo img {
    height: 2rem;
    width: auto;
  }

  @media (min-width: 768px) {
    .auth-modal__logo img {
      height: 2.5rem;
    }
  }

  .auth-modal__value-props {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .auth-modal__headline {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .auth-modal__title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  @media (min-width: 768px) {
    .auth-modal__title {
      font-size: 1.375rem;
    }
  }

  .auth-modal__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== Features List ===== */
  .auth-modal__features {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .auth-modal__feature {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .auth-modal__feature-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    color: var(--sidebar-accent);
  }

  .auth-modal__feature-icon--primary {
    background-color: rgba(6, 182, 212, 0.15);
    border: 1px solid rgba(6, 182, 212, 0.25);
  }

  .auth-modal__feature-icon--secondary {
    background-color: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.25);
    color: #38bdf8;
  }

  .auth-modal__feature-icon--tertiary {
    background-color: rgba(34, 211, 238, 0.15);
    border: 1px solid rgba(34, 211, 238, 0.25);
    color: #22d3ee;
  }

  .auth-modal__feature-content {
    flex: 1;
    min-width: 0;
  }

  .auth-modal__feature-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .auth-modal__feature-desc {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
    line-height: 1.4;
  }

  /* ===== Trust Badge ===== */
  .auth-modal__trust {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--sidebar-border);
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  /* ===== Content Column ===== */
  .auth-modal__content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 1.5rem;
    overflow-y: auto;
  }

  @media (min-width: 768px) {
    .auth-modal__content {
      padding: 2rem;
    }
  }

  /* ===== View Container ===== */
  .auth-modal__view {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .auth-modal__view-header {
    margin-bottom: 0.25rem;
  }

  .auth-modal__view-header--centered {
    text-align: center;
  }

  .auth-modal__view-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    text-align: center;
  }

  .auth-modal__view-subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
    text-align: center;
    line-height: 1.5;
  }

  .auth-modal__view-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    margin: 0 auto 0.75rem;
    border-radius: 50%;
    background-color: rgba(6, 182, 212, 0.1);
    border: 1px solid rgba(6, 182, 212, 0.2);
    color: var(--sidebar-accent);
  }

  .auth-modal__view-icon--success {
    background-color: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .auth-modal__email-highlight {
    font-weight: 500;
    color: var(--sidebar-text);
  }

  /* ===== Form ===== */
  .auth-modal__form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .auth-modal__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .auth-modal__field-action {
    display: flex;
    justify-content: flex-end;
  }

  .auth-modal__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .auth-modal__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .auth-modal__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .auth-modal__input--otp {
    text-align: center;
    font-size: 1.25rem;
    font-family: monospace;
    letter-spacing: 0.4em;
    padding: 1rem;
  }

  .auth-modal__input--otp::placeholder {
    letter-spacing: 0.4em;
  }

  .auth-modal__error-inline {
    font-size: 0.75rem;
    color: #f87171;
    margin: 0;
  }

  /* ===== Buttons ===== */
  .auth-modal__btn {
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

  .auth-modal__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .auth-modal__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .auth-modal__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .auth-modal__spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* ===== Links ===== */
  .auth-modal__link {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.75rem;
    color: var(--sidebar-accent);
    cursor: pointer;
    transition: color 150ms ease;
  }

  .auth-modal__link:hover {
    color: #67e8f9;
    text-decoration: underline;
  }

  .auth-modal__link:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .auth-modal__link--block {
    display: block;
    text-align: center;
    font-size: 0.875rem;
  }

  .auth-modal__switch-text {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    text-align: center;
    margin: 0;
  }

  .auth-modal__back-link {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: color 150ms ease;
  }

  .auth-modal__back-link:hover {
    color: var(--sidebar-text);
  }

  .auth-modal__otp-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  /* ===== Divider ===== */
  .auth-modal__divider {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0.5rem 0;
  }

  .auth-modal__divider::before,
  .auth-modal__divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: var(--sidebar-border);
  }

  .auth-modal__divider span {
    padding: 0 0.75rem;
    font-size: 0.625rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* ===== Social Auth ===== */
  .auth-modal__social {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .auth-modal__social-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .auth-modal__social-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .auth-modal__social-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .auth-modal__social-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Messages ===== */
  .auth-modal__message {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 8px;
    margin-top: 0.75rem;
  }

  .auth-modal__message p {
    font-size: 0.75rem;
    margin: 0;
    line-height: 1.4;
  }

  .auth-modal__message--error {
    background-color: rgba(248, 113, 113, 0.1);
    border: 1px solid rgba(248, 113, 113, 0.2);
    color: #f87171;
  }

  .auth-modal__message--success {
    background-color: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
    color: #22c55e;
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

  .slide-fade-enter-active {
    transition: all 200ms ease-out;
  }

  .slide-fade-leave-active {
    transition: all 150ms ease-in;
  }

  .slide-fade-enter-from {
    opacity: 0;
    transform: translateY(-6px);
  }

  .slide-fade-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
</style>
