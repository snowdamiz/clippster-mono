<template>
  <div class="flex items-center justify-center min-h-screen">
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

          <!-- Loading State -->
          <template v-if="loading">
            <div class="text-center">
              <Loader2 class="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p class="text-muted-foreground">Processing...</p>
            </div>
          </template>

          <!-- Success State -->
          <template v-else-if="success">
            <div class="text-center">
              <div class="flex justify-center mb-4">
                <div class="p-3 rounded-full bg-green-500/10 border border-green-500/20">
                  <CheckCircle class="h-8 w-8 text-green-500" />
                </div>
              </div>
              <h2 class="text-2xl font-bold text-foreground mb-2">Password Reset!</h2>
              <p class="text-muted-foreground text-sm mb-6">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
              <router-link
                to="/login"
                class="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
              >
                Go to Sign In
              </router-link>
            </div>
          </template>

          <!-- Error State (Invalid/Expired Token) -->
          <template v-else-if="error && !canRetry">
            <div class="text-center">
              <div class="flex justify-center mb-4">
                <div class="p-3 rounded-full bg-destructive/10 border border-destructive/20">
                  <AlertTriangle class="h-8 w-8 text-destructive" />
                </div>
              </div>
              <h2 class="text-2xl font-bold text-foreground mb-2">Link Expired</h2>
              <p class="text-muted-foreground text-sm mb-6">
                {{ error }}
              </p>
              <router-link
                to="/login"
                class="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
              >
                Request New Link
              </router-link>
            </div>
          </template>

          <!-- Reset Form -->
          <template v-else>
            <div class="text-center mb-6">
              <h2 class="text-2xl font-bold text-foreground mb-2">Set New Password</h2>
              <p class="text-muted-foreground text-sm">Enter your new password below</p>
            </div>

            <form @submit.prevent="handleResetPassword" class="space-y-4">
              <div>
                <label for="password" class="block text-sm font-medium text-foreground mb-1.5">New Password</label>
                <input
                  id="password"
                  v-model="password"
                  type="password"
                  required
                  minlength="8"
                  placeholder="At least 8 characters"
                  class="w-full px-3 py-2.5 rounded-md border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <div>
                <label for="confirm" class="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                <input
                  id="confirm"
                  v-model="confirmPassword"
                  type="password"
                  required
                  minlength="8"
                  placeholder="Confirm your password"
                  class="w-full px-3 py-2.5 rounded-md border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>

              <p v-if="password && confirmPassword && password !== confirmPassword" class="text-sm text-destructive">
                Passwords do not match
              </p>

              <div v-if="error && canRetry" class="rounded-md bg-destructive/10 border border-destructive/20 p-4">
                <div class="flex items-start gap-3">
                  <AlertTriangle class="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <p class="text-sm text-destructive">{{ error }}</p>
                </div>
              </div>

              <button
                type="submit"
                :disabled="submitting || password !== confirmPassword || password.length < 8"
                class="w-full group relative overflow-hidden rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 p-[1px] transition-all hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                <div
                  class="relative rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2.5 transition-all group-hover:from-purple-500 group-hover:to-indigo-500"
                >
                  <span class="flex items-center justify-center gap-2 font-semibold text-white">
                    <Loader2 v-if="submitting" class="h-5 w-5 animate-spin" />
                    <KeyRound v-else class="h-5 w-5" />
                    {{ submitting ? 'Resetting...' : 'Reset Password' }}
                  </span>
                </div>
              </button>
            </form>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useAuthStore } from '../stores/auth';
  import { Loader2, CheckCircle, AlertTriangle, KeyRound } from 'lucide-vue-next';

  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();

  const loading = ref(false);
  const submitting = ref(false);
  const success = ref(false);
  const error = ref('');
  const canRetry = ref(true);
  const password = ref('');
  const confirmPassword = ref('');

  const token = ref('');

  const handleResetPassword = async () => {
    if (password.value !== confirmPassword.value) {
      return;
    }

    submitting.value = true;
    error.value = '';

    const result = await authStore.resetPassword(token.value, password.value);

    if (result.success) {
      success.value = true;
    } else {
      error.value = result.error || 'Failed to reset password';
      // Check if error indicates expired/invalid token
      if (error.value.includes('expired') || error.value.includes('invalid')) {
        canRetry.value = false;
      }
    }

    submitting.value = false;
  };

  onMounted(() => {
    // Get token from route params
    token.value = route.params.token as string;

    if (!token.value) {
      error.value = 'Invalid reset link. Please request a new one.';
      canRetry.value = false;
    }

    // If user is already authenticated, redirect
    if (authStore.isAuthenticated) {
      router.push('/projects');
    }
  });
</script>
