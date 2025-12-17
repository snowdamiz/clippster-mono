<template>
  <div class="flex items-center justify-center min-h-screen">
    <!-- Login Card -->
    <div class="w-full max-w-md">
      <div class="relative overflow-hidden rounded-lg border border-border/50 bg-card backdrop-blur-sm">
        <!-- Gradient overlay -->
        <div
          class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none"
        />

        <div class="relative p-8">
          <!-- Logo -->
          <div class="flex justify-center mb-6">
            <img src="/logo.svg" alt="Clippster" class="h-12 w-auto" />
          </div>

          <!-- View: Sign In -->
          <template v-if="currentView === 'signin'">
            <div class="text-center mb-6">
              <h2 class="text-2xl font-bold text-foreground mb-2">Sign In to Clippster</h2>
              <p class="text-muted-foreground text-sm">Choose your preferred authentication method</p>
            </div>

            <!-- Email/Password Form -->
            <form @submit.prevent="handleEmailLogin" class="space-y-4 mb-4">
              <div>
                <label for="email" class="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <input
                  id="email"
                  v-model="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  class="w-full px-3 py-2.5 rounded-md border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <div>
                <label for="password" class="block text-sm font-medium text-foreground mb-1.5">Password</label>
                <input
                  id="password"
                  v-model="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  class="w-full px-3 py-2.5 rounded-md border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <div class="flex justify-end">
                <button
                  type="button"
                  @click="currentView = 'forgot-password'"
                  class="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <button
                type="submit"
                :disabled="authStore.loading"
                class="w-full group relative overflow-hidden rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 p-[1px] transition-all hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                <div
                  class="relative rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2.5 transition-all group-hover:from-purple-500 group-hover:to-indigo-500"
                >
                  <span class="flex items-center justify-center gap-2 font-semibold text-white">
                    <Loader2 v-if="authStore.loading && authMethod === 'email'" class="h-5 w-5 animate-spin" />
                    <Mail v-else class="h-5 w-5" />
                    {{ authStore.loading && authMethod === 'email' ? 'Signing in...' : 'Sign In with Email' }}
                  </span>
                </div>
              </button>
            </form>

            <p class="text-center text-sm text-muted-foreground mb-4">
              Don't have an account?
              <button @click="currentView = 'signup'" class="text-primary hover:underline">Sign up</button>
            </p>

            <!-- OR Divider -->
            <div class="relative my-4">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-border/50"></div>
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-card text-muted-foreground">OR</span>
              </div>
            </div>

            <!-- Social Auth Buttons -->
            <div class="space-y-3">
              <!-- Google Authentication Button -->
              <button
                @click="authenticateWithGoogle"
                :disabled="authStore.loading"
                class="w-full relative overflow-hidden rounded-md border border-border/50 bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span class="flex items-center justify-center gap-2 font-medium px-6 py-2.5">
                  <svg v-if="!authStore.loading || authMethod !== 'google'" class="h-5 w-5" viewBox="0 0 24 24">
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
                  <Loader2 v-else class="h-5 w-5 animate-spin" />
                  {{ authStore.loading && authMethod === 'google' ? 'Signing in...' : 'Continue with Google' }}
                </span>
              </button>

              <!-- Wallet Authentication Button -->
              <button
                @click="connectWallet"
                :disabled="authStore.loading"
                class="w-full relative overflow-hidden rounded-md border border-border/50 bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span class="flex items-center justify-center gap-2 font-medium px-6 py-2.5">
                  <Wallet v-if="!authStore.loading || authMethod !== 'wallet'" class="h-5 w-5" />
                  <Loader2 v-else class="h-5 w-5 animate-spin" />
                  {{ authStore.loading && authMethod === 'wallet' ? 'Connecting...' : 'Connect Phantom Wallet' }}
                </span>
              </button>
            </div>
          </template>

          <!-- View: Sign Up -->
          <template v-else-if="currentView === 'signup'">
            <div class="text-center mb-6">
              <h2 class="text-2xl font-bold text-foreground mb-2">Create Account</h2>
              <p class="text-muted-foreground text-sm">Sign up with your email address</p>
            </div>

            <form @submit.prevent="handleEmailRegister" class="space-y-4 mb-4">
              <div>
                <label for="signup-email" class="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <input
                  id="signup-email"
                  v-model="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  class="w-full px-3 py-2.5 rounded-md border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <div>
                <label for="signup-password" class="block text-sm font-medium text-foreground mb-1.5">Password</label>
                <input
                  id="signup-password"
                  v-model="password"
                  type="password"
                  required
                  minlength="8"
                  placeholder="At least 8 characters"
                  class="w-full px-3 py-2.5 rounded-md border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <div>
                <label for="signup-confirm" class="block text-sm font-medium text-foreground mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="signup-confirm"
                  v-model="confirmPassword"
                  type="password"
                  required
                  minlength="8"
                  placeholder="Confirm your password"
                  class="w-full px-3 py-2.5 rounded-md border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <button
                type="submit"
                :disabled="authStore.loading || password !== confirmPassword"
                class="w-full group relative overflow-hidden rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 p-[1px] transition-all hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                <div
                  class="relative rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2.5 transition-all group-hover:from-purple-500 group-hover:to-indigo-500"
                >
                  <span class="flex items-center justify-center gap-2 font-semibold text-white">
                    <Loader2 v-if="authStore.loading" class="h-5 w-5 animate-spin" />
                    <UserPlus v-else class="h-5 w-5" />
                    {{ authStore.loading ? 'Creating account...' : 'Create Account' }}
                  </span>
                </div>
              </button>
            </form>

            <p v-if="password && confirmPassword && password !== confirmPassword" class="text-sm text-destructive mb-4">
              Passwords do not match
            </p>

            <p class="text-center text-sm text-muted-foreground">
              Already have an account?
              <button @click="currentView = 'signin'" class="text-primary hover:underline">Sign in</button>
            </p>
          </template>

          <!-- View: Verify OTP -->
          <template v-else-if="currentView === 'verify-otp'">
            <div class="text-center mb-6">
              <div class="flex justify-center mb-4">
                <div class="p-3 rounded-full bg-primary/10 border border-primary/20">
                  <Mail class="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 class="text-2xl font-bold text-foreground mb-2">Check your email</h2>
              <p class="text-muted-foreground text-sm">
                We sent a 6-digit code to
                <br />
                <span class="font-medium text-foreground">{{ authStore.pendingVerificationEmail }}</span>
              </p>
            </div>

            <form @submit.prevent="handleVerifyOtp" class="space-y-4 mb-4">
              <div>
                <label for="otp" class="block text-sm font-medium text-foreground mb-1.5 text-center">
                  Verification Code
                </label>
                <input
                  id="otp"
                  ref="otpInput"
                  v-model="otpCode"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength="6"
                  required
                  placeholder="000000"
                  class="w-full px-3 py-4 rounded-md border border-border/50 bg-background text-foreground text-center text-2xl font-mono tracking-[0.5em] placeholder:text-muted-foreground placeholder:tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  @input="handleOtpInput"
                />
              </div>
              <button
                type="submit"
                :disabled="authStore.loading || otpCode.length !== 6"
                class="w-full group relative overflow-hidden rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 p-[1px] transition-all hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                <div
                  class="relative rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2.5 transition-all group-hover:from-purple-500 group-hover:to-indigo-500"
                >
                  <span class="flex items-center justify-center gap-2 font-semibold text-white">
                    <Loader2 v-if="authStore.loading" class="h-5 w-5 animate-spin" />
                    <CheckCircle v-else class="h-5 w-5" />
                    {{ authStore.loading ? 'Verifying...' : 'Verify Email' }}
                  </span>
                </div>
              </button>
            </form>

            <div class="text-center space-y-2">
              <p class="text-sm text-muted-foreground">
                Didn't receive the code?
                <button
                  @click="handleResendCode"
                  :disabled="resendCooldown > 0 || authStore.loading"
                  class="text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code' }}
                </button>
              </p>
              <button @click="resetToSignIn" class="text-sm text-muted-foreground hover:text-foreground">
                ← Back to sign in
              </button>
            </div>
          </template>

          <!-- View: Forgot Password -->
          <template v-else-if="currentView === 'forgot-password'">
            <div class="text-center mb-6">
              <h2 class="text-2xl font-bold text-foreground mb-2">Reset Password</h2>
              <p class="text-muted-foreground text-sm">Enter your email to receive a reset link</p>
            </div>

            <form @submit.prevent="handleForgotPassword" class="space-y-4 mb-4">
              <div>
                <label for="forgot-email" class="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <input
                  id="forgot-email"
                  v-model="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  class="w-full px-3 py-2.5 rounded-md border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <button
                type="submit"
                :disabled="authStore.loading"
                class="w-full group relative overflow-hidden rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 p-[1px] transition-all hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                <div
                  class="relative rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2.5 transition-all group-hover:from-purple-500 group-hover:to-indigo-500"
                >
                  <span class="flex items-center justify-center gap-2 font-semibold text-white">
                    <Loader2 v-if="authStore.loading" class="h-5 w-5 animate-spin" />
                    <Send v-else class="h-5 w-5" />
                    {{ authStore.loading ? 'Sending...' : 'Send Reset Link' }}
                  </span>
                </div>
              </button>
            </form>

            <p class="text-center text-sm text-muted-foreground">
              Remember your password?
              <button @click="currentView = 'signin'" class="text-primary hover:underline">Sign in</button>
            </p>
          </template>

          <!-- View: Reset Email Sent -->
          <template v-else-if="currentView === 'reset-sent'">
            <div class="text-center">
              <div class="flex justify-center mb-4">
                <div class="p-3 rounded-full bg-green-500/10 border border-green-500/20">
                  <CheckCircle class="h-8 w-8 text-green-500" />
                </div>
              </div>
              <h2 class="text-2xl font-bold text-foreground mb-2">Check your email</h2>
              <p class="text-muted-foreground text-sm mb-6">
                If an account exists for {{ email }}, you will receive a password reset link.
              </p>
              <button @click="currentView = 'signin'" class="text-primary hover:underline">Return to sign in</button>
            </div>
          </template>

          <!-- Error Message -->
          <div
            v-if="authStore.error && currentView !== 'verify-otp'"
            class="mt-4 rounded-md bg-destructive/10 border border-destructive/20 p-4"
          >
            <div class="flex items-start gap-3">
              <AlertTriangle class="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p class="text-sm text-destructive">{{ authStore.error }}</p>
            </div>
          </div>

          <!-- Success Message -->
          <div v-if="successMessage" class="mt-4 rounded-md bg-green-500/10 border border-green-500/20 p-4">
            <div class="flex items-start gap-3">
              <CheckCircle class="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p class="text-sm text-green-500">{{ successMessage }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { useAuthStore } from '../stores/auth';
  import { onMounted, onUnmounted, ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { Wallet, Loader2, AlertTriangle, Mail, UserPlus, CheckCircle, Send } from 'lucide-vue-next';

  const authStore = useAuthStore();
  const router = useRouter();

  const currentView = ref('signin'); // 'signin' | 'signup' | 'verify-otp' | 'forgot-password' | 'reset-sent'
  const authMethod = ref(null);
  const email = ref('');
  const password = ref('');
  const confirmPassword = ref('');
  const otpCode = ref('');
  const successMessage = ref('');
  const resendCooldown = ref(0);
  const otpInput = ref(null);

  let cooldownInterval = null;

  const connectWallet = async () => {
    authMethod.value = 'wallet';
    successMessage.value = '';
    const result = await authStore.authenticateWithWallet();
    if (result.success) {
      router.push('/projects');
    }
  };

  const authenticateWithGoogle = async () => {
    authMethod.value = 'google';
    successMessage.value = '';
    const result = await authStore.authenticateWithGoogle();
    if (result.success) {
      router.push('/projects');
    }
  };

  const handleEmailLogin = async () => {
    authMethod.value = 'email';
    successMessage.value = '';
    const result = await authStore.loginWithEmail(email.value, password.value);

    if (result.success) {
      router.push('/projects');
    } else if (result.needsVerification) {
      // User needs to verify email first
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
    const result = await authStore.verifyEmailOtp(authStore.pendingVerificationEmail, otpCode.value);

    if (result.success) {
      router.push('/projects');
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown.value > 0) return;

    successMessage.value = '';
    const result = await authStore.resendVerificationEmail(authStore.pendingVerificationEmail);

    if (result.success) {
      successMessage.value = 'Verification code sent!';
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

  const handleOtpInput = (event) => {
    // Only allow digits
    otpCode.value = event.target.value.replace(/\D/g, '').slice(0, 6);
  };

  const startResendCooldown = () => {
    resendCooldown.value = 60;
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = setInterval(() => {
      resendCooldown.value--;
      if (resendCooldown.value <= 0) {
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
    router.push('/projects');
  };

  onMounted(() => {
    // Check if already authenticated and redirect if so
    authStore.checkAuth();
    if (authStore.isAuthenticated) {
      router.push('/projects');
    }

    // Check if there's a pending verification
    if (authStore.pendingVerificationEmail) {
      currentView.value = 'verify-otp';
      startResendCooldown();
    }

    // Listen for magic link verification completion
    window.addEventListener('email-verified', handleEmailVerified);
  });

  onUnmounted(() => {
    if (cooldownInterval) clearInterval(cooldownInterval);
    window.removeEventListener('email-verified', handleEmailVerified);
  });
</script>
