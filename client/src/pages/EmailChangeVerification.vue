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
              <p class="text-muted-foreground">Verifying your email...</p>
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
              <h2 class="text-2xl font-bold text-foreground mb-2">Email Verified!</h2>
              <p class="text-muted-foreground text-sm mb-6">
                Your email address has been successfully changed. You can now use your new email to sign in.
              </p>
              <button
                @click="handleContinue"
                class="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
              >
                Continue to App
              </button>
            </div>
          </template>

          <!-- Error State -->
          <template v-else-if="error">
            <div class="text-center">
              <div class="flex justify-center mb-4">
                <div class="p-3 rounded-full bg-destructive/10 border border-destructive/20">
                  <AlertTriangle class="h-8 w-8 text-destructive" />
                </div>
              </div>
              <h2 class="text-2xl font-bold text-foreground mb-2">Verification Failed</h2>
              <p class="text-muted-foreground text-sm mb-6">
                {{ error }}
              </p>
              <button
                @click="handleRetry"
                class="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
              >
                Try Again
              </button>
            </div>
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
  import { Loader2, CheckCircle, AlertTriangle } from 'lucide-vue-next';

  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();

  const loading = ref(true);
  const success = ref(false);
  const error = ref('');

  const verifyEmail = async () => {
    loading.value = true;
    error.value = '';

    const token = route.params.token as string;

    if (!token) {
      error.value = 'Invalid verification link. Please request a new email change.';
      loading.value = false;
      return;
    }

    const result = await authStore.verifyEmailChange(token);

    if (result.success) {
      success.value = true;
    } else {
      error.value = result.error || 'Failed to verify email change';
    }

    loading.value = false;
  };

  const handleContinue = () => {
    if (authStore.isAuthenticated) {
      router.push('/projects');
    } else {
      router.push('/login');
    }
  };

  const handleRetry = () => {
    verifyEmail();
  };

  onMounted(() => {
    verifyEmail();
  });
</script>
