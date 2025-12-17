<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999]"
        @click.self="close"
        @keydown.esc="close"
        tabindex="-1"
      >
        <Transition name="dialog" appear>
          <div
            v-if="modelValue"
            class="relative bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-2xl max-w-md sm:max-w-xl lg:max-w-2xl w-full mx-3 sm:mx-4 overflow-hidden max-h-[95vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

            <!-- Close Button -->
            <button
              @click="close"
              :disabled="authStore.loading"
              class="absolute right-4 top-4 z-10 p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700"
              aria-label="Close dialog"
            >
              <X class="h-4 w-4 text-zinc-400 hover:text-white" />
            </button>

            <!-- Two Column Layout -->
            <div class="grid lg:grid-cols-2">
              <!-- Left Column - Branding & Value Props -->
              <div
                class="bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-5 sm:p-6 lg:p-8 flex flex-col lg:border-r border-b lg:border-b-0 border-white/5"
              >
                <!-- Logo -->
                <div class="mb-4 sm:mb-6 lg:mb-8">
                  <img src="/logo.svg" alt="Clippster" class="h-8 sm:h-10 w-auto" />
                </div>

                <!-- Value Propositions -->
                <div class="flex-1 space-y-4 sm:space-y-6">
                  <div>
                    <h2
                      id="auth-modal-title"
                      class="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-1.5 sm:mb-2 tracking-tight"
                    >
                      Transform Videos into Viral Clips
                    </h2>
                    <p class="text-xs sm:text-sm text-zinc-400">
                      Sign in to unlock AI-powered clip creation and editing
                    </p>
                  </div>

                  <!-- Features List -->
                  <div class="space-y-3 sm:space-y-4">
                    <div class="flex items-start gap-2.5 sm:gap-3 group">
                      <div
                        class="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-violet-500/20 flex items-center justify-center mt-0.5 border border-violet-500/30"
                      >
                        <Zap class="h-4 w-4 sm:h-5 sm:w-5 text-violet-400" />
                      </div>
                      <div>
                        <h3 class="text-xs sm:text-sm font-semibold text-white">AI-Powered Detection</h3>
                        <p class="text-[10px] sm:text-xs text-zinc-500 mt-0.5">
                          Automatically find the best moments in your videos
                        </p>
                      </div>
                    </div>

                    <div class="flex items-start gap-2.5 sm:gap-3 group">
                      <div
                        class="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-purple-500/20 flex items-center justify-center mt-0.5 border border-purple-500/30"
                      >
                        <Film class="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 class="text-xs sm:text-sm font-semibold text-white">Professional Editing</h3>
                        <p class="text-[10px] sm:text-xs text-zinc-500 mt-0.5">
                          Timeline editor with multi-platform formatting
                        </p>
                      </div>
                    </div>

                    <div class="flex items-start gap-2.5 sm:gap-3 group">
                      <div
                        class="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-fuchsia-500/20 flex items-center justify-center mt-0.5 border border-fuchsia-500/30"
                      >
                        <DollarSign class="h-4 w-4 sm:h-5 sm:w-5 text-fuchsia-400" />
                      </div>
                      <div>
                        <h3 class="text-xs sm:text-sm font-semibold text-white">Credit-Based Pricing</h3>
                        <p class="text-[10px] sm:text-xs text-zinc-500 mt-0.5">
                          Pay only for what you use, no subscriptions
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Trust Badge -->
                <div class="mt-4 sm:mt-6 lg:mt-8 pt-4 sm:pt-6 border-t border-white/10">
                  <div class="flex items-center gap-2 text-[10px] sm:text-xs text-zinc-500">
                    <ShieldCheck class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Secure authentication</span>
                  </div>
                </div>
              </div>

              <!-- Right Column - Auth Actions -->
              <div class="p-5 sm:p-6 lg:p-8 flex flex-col justify-center">
                <!-- View: Sign In -->
                <template v-if="currentView === 'signin'">
                  <div class="space-y-4">
                    <div class="text-center mb-2">
                      <h3 class="text-lg font-semibold text-white">Sign In</h3>
                    </div>

                    <!-- Email/Password Form -->
                    <form @submit.prevent="handleEmailLogin" class="space-y-3">
                      <div>
                        <input
                          v-model="email"
                          type="email"
                          required
                          placeholder="Email address"
                          class="w-full px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                        />
                      </div>
                      <div>
                        <input
                          v-model="password"
                          type="password"
                          required
                          placeholder="Password"
                          class="w-full px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                        />
                      </div>
                      <div class="flex justify-end">
                        <button
                          type="button"
                          @click="currentView = 'forgot-password'"
                          class="text-xs text-violet-400 hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <button
                        type="submit"
                        :disabled="authStore.loading"
                        class="w-full group relative overflow-hidden rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div class="px-4 py-2.5 flex items-center justify-center gap-2 relative">
                          <Loader2
                            v-if="authStore.loading && authMethod === 'email'"
                            class="h-4 w-4 animate-spin text-white"
                          />
                          <Mail v-else class="h-4 w-4 text-white" />
                          <span class="text-sm font-semibold text-white">
                            {{ authStore.loading && authMethod === 'email' ? 'Signing in...' : 'Sign In' }}
                          </span>
                        </div>
                      </button>
                    </form>

                    <p class="text-center text-xs text-zinc-400">
                      Don't have an account?
                      <button @click="currentView = 'signup'" class="text-violet-400 hover:underline">Sign up</button>
                    </p>

                    <!-- OR Divider -->
                    <div class="relative">
                      <div class="absolute inset-0 flex items-center">
                        <div class="w-full border-t border-zinc-800"></div>
                      </div>
                      <div class="relative flex justify-center text-[10px] uppercase">
                        <span class="bg-zinc-950 px-2 text-zinc-500">OR</span>
                      </div>
                    </div>

                    <!-- Social Auth Buttons -->
                    <div class="space-y-2">
                      <button
                        @click="authenticateWithGoogle"
                        :disabled="authStore.loading"
                        class="w-full relative overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div class="px-4 py-2.5 flex items-center justify-center gap-2">
                          <svg v-if="!authStore.loading || authMethod !== 'google'" class="h-4 w-4" viewBox="0 0 24 24">
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
                          <Loader2 v-else class="h-4 w-4 animate-spin text-zinc-300" />
                          <span class="text-xs font-medium text-zinc-200">Google</span>
                        </div>
                      </button>

                      <button
                        @click="connectWallet"
                        :disabled="authStore.loading"
                        class="w-full relative overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div class="px-4 py-2.5 flex items-center justify-center gap-2">
                          <Wallet v-if="!authStore.loading || authMethod !== 'wallet'" class="h-4 w-4 text-zinc-200" />
                          <Loader2 v-else class="h-4 w-4 animate-spin text-zinc-300" />
                          <span class="text-xs font-medium text-zinc-200">Phantom Wallet</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </template>

                <!-- View: Sign Up -->
                <template v-else-if="currentView === 'signup'">
                  <div class="space-y-4">
                    <div class="text-center mb-2">
                      <h3 class="text-lg font-semibold text-white">Create Account</h3>
                    </div>

                    <form @submit.prevent="handleEmailRegister" class="space-y-3">
                      <div>
                        <input
                          v-model="email"
                          type="email"
                          required
                          placeholder="Email address"
                          class="w-full px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                        />
                      </div>
                      <div>
                        <input
                          v-model="password"
                          type="password"
                          required
                          minlength="8"
                          placeholder="Password (min 8 characters)"
                          class="w-full px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                        />
                      </div>
                      <div>
                        <input
                          v-model="confirmPassword"
                          type="password"
                          required
                          minlength="8"
                          placeholder="Confirm password"
                          class="w-full px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                        />
                      </div>
                      <p
                        v-if="password && confirmPassword && password !== confirmPassword"
                        class="text-xs text-red-400"
                      >
                        Passwords do not match
                      </p>
                      <button
                        type="submit"
                        :disabled="authStore.loading || password !== confirmPassword"
                        class="w-full group relative overflow-hidden rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div class="px-4 py-2.5 flex items-center justify-center gap-2 relative">
                          <Loader2 v-if="authStore.loading" class="h-4 w-4 animate-spin text-white" />
                          <UserPlus v-else class="h-4 w-4 text-white" />
                          <span class="text-sm font-semibold text-white">
                            {{ authStore.loading ? 'Creating...' : 'Create Account' }}
                          </span>
                        </div>
                      </button>
                    </form>

                    <p class="text-center text-xs text-zinc-400">
                      Already have an account?
                      <button @click="currentView = 'signin'" class="text-violet-400 hover:underline">Sign in</button>
                    </p>
                  </div>
                </template>

                <!-- View: Verify OTP -->
                <template v-else-if="currentView === 'verify-otp'">
                  <div class="space-y-4">
                    <div class="text-center">
                      <div class="flex justify-center mb-3">
                        <div class="p-2.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                          <Mail class="h-6 w-6 text-violet-400" />
                        </div>
                      </div>
                      <h3 class="text-lg font-semibold text-white mb-1">Check your email</h3>
                      <p class="text-xs text-zinc-400">
                        Enter the 6-digit code sent to
                        <br />
                        <span class="font-medium text-zinc-300">{{ authStore.pendingVerificationEmail }}</span>
                      </p>
                    </div>

                    <form @submit.prevent="handleVerifyOtp" class="space-y-3">
                      <input
                        ref="otpInput"
                        v-model="otpCode"
                        type="text"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        maxlength="6"
                        required
                        placeholder="000000"
                        class="w-full px-3 py-3 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-center text-xl font-mono tracking-[0.4em] placeholder:text-zinc-600 placeholder:tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                        @input="handleOtpInput"
                      />
                      <button
                        type="submit"
                        :disabled="authStore.loading || otpCode.length !== 6"
                        class="w-full group relative overflow-hidden rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div class="px-4 py-2.5 flex items-center justify-center gap-2 relative">
                          <Loader2 v-if="authStore.loading" class="h-4 w-4 animate-spin text-white" />
                          <CheckCircle v-else class="h-4 w-4 text-white" />
                          <span class="text-sm font-semibold text-white">
                            {{ authStore.loading ? 'Verifying...' : 'Verify' }}
                          </span>
                        </div>
                      </button>
                    </form>

                    <div class="text-center space-y-1">
                      <p class="text-xs text-zinc-400">
                        Didn't receive it?
                        <button
                          @click="handleResendCode"
                          :disabled="resendCooldown > 0 || authStore.loading"
                          class="text-violet-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend' }}
                        </button>
                      </p>
                      <button @click="resetToSignIn" class="text-xs text-zinc-500 hover:text-zinc-300">← Back</button>
                    </div>
                  </div>
                </template>

                <!-- View: Forgot Password -->
                <template v-else-if="currentView === 'forgot-password'">
                  <div class="space-y-4">
                    <div class="text-center mb-2">
                      <h3 class="text-lg font-semibold text-white">Reset Password</h3>
                      <p class="text-xs text-zinc-400">Enter your email to receive a reset link</p>
                    </div>

                    <form @submit.prevent="handleForgotPassword" class="space-y-3">
                      <input
                        v-model="email"
                        type="email"
                        required
                        placeholder="Email address"
                        class="w-full px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm"
                      />
                      <button
                        type="submit"
                        :disabled="authStore.loading"
                        class="w-full group relative overflow-hidden rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div class="px-4 py-2.5 flex items-center justify-center gap-2 relative">
                          <Loader2 v-if="authStore.loading" class="h-4 w-4 animate-spin text-white" />
                          <Send v-else class="h-4 w-4 text-white" />
                          <span class="text-sm font-semibold text-white">
                            {{ authStore.loading ? 'Sending...' : 'Send Reset Link' }}
                          </span>
                        </div>
                      </button>
                    </form>

                    <p class="text-center text-xs text-zinc-400">
                      <button @click="currentView = 'signin'" class="text-violet-400 hover:underline">
                        ← Back to sign in
                      </button>
                    </p>
                  </div>
                </template>

                <!-- View: Reset Email Sent -->
                <template v-else-if="currentView === 'reset-sent'">
                  <div class="space-y-4 text-center">
                    <div class="flex justify-center mb-3">
                      <div class="p-2.5 rounded-full bg-green-500/10 border border-green-500/20">
                        <CheckCircle class="h-6 w-6 text-green-400" />
                      </div>
                    </div>
                    <h3 class="text-lg font-semibold text-white">Check your email</h3>
                    <p class="text-xs text-zinc-400">
                      If an account exists for {{ email }}, you'll receive a password reset link.
                    </p>
                    <button @click="currentView = 'signin'" class="text-sm text-violet-400 hover:underline">
                      Return to sign in
                    </button>
                  </div>
                </template>

                <!-- Error Message -->
                <Transition name="slide-fade">
                  <div
                    v-if="authStore.error && currentView !== 'verify-otp'"
                    class="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3"
                  >
                    <div class="flex items-start gap-2">
                      <AlertTriangle class="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p class="text-xs text-red-400">{{ authStore.error }}</p>
                    </div>
                  </div>
                </Transition>

                <!-- Success Message -->
                <Transition name="slide-fade">
                  <div v-if="successMessage" class="mt-4 rounded-lg bg-green-500/10 border border-green-500/30 p-3">
                    <div class="flex items-start gap-2">
                      <CheckCircle class="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                      <p class="text-xs text-green-400">{{ successMessage }}</p>
                    </div>
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

  const props = defineProps<{
    modelValue: boolean;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
  }>();

  const authStore = useAuthStore();
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

  const connectWallet = async () => {
    authMethod.value = 'wallet';
    successMessage.value = '';
    const result = await authStore.authenticateWithWallet();
    if (result.success) {
      close();
    }
  };

  const authenticateWithGoogle = async () => {
    authMethod.value = 'google';
    successMessage.value = '';
    const result = await authStore.authenticateWithGoogle();
    if (result.success) {
      close();
    }
  };

  const handleEmailLogin = async () => {
    authMethod.value = 'email';
    successMessage.value = '';
    const result = await authStore.loginWithEmail(email.value, password.value);

    if (result.success) {
      close();
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
  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* Slide fade for error */
  .slide-fade-enter-active {
    transition: all 0.3s ease-out;
  }

  .slide-fade-leave-active {
    transition: all 0.2s ease-in;
  }

  .slide-fade-enter-from {
    opacity: 0;
    transform: translateY(-8px);
  }

  .slide-fade-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
</style>
