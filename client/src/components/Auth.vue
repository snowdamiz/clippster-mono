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

          <!-- Title -->
          <div class="text-center mb-8">
            <h2 class="text-2xl font-bold text-foreground mb-2">Sign In to Clippster</h2>
            <p class="text-muted-foreground text-sm">Choose your preferred authentication method</p>
          </div>

          <!-- Wallet Authentication Button -->
          <button
            @click="connectWallet"
            :disabled="authStore.loading"
            class="w-full group relative overflow-hidden rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 p-[1px] transition-all hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none mb-3"
          >
            <div
              class="relative rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 transition-all group-hover:from-purple-500 group-hover:to-indigo-500"
            >
              <span class="flex items-center justify-center gap-2 font-semibold text-white">
                <Wallet v-if="!authStore.loading || authMethod !== 'wallet'" class="h-5 w-5" />
                <Loader2 v-else class="h-5 w-5 animate-spin" />
                {{ authStore.loading && authMethod === 'wallet' ? 'Connecting...' : 'Connect Phantom Wallet' }}
              </span>
            </div>
          </button>

          <!-- OR Divider -->
          <div class="relative my-4">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-border/50"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-card text-muted-foreground">OR</span>
            </div>
          </div>

          <!-- Google Authentication Button -->
          <button
            @click="authenticateWithGoogle"
            :disabled="authStore.loading"
            class="w-full relative overflow-hidden rounded-md border border-border/50 bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span class="flex items-center justify-center gap-2 font-medium px-6 py-3">
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

          <!-- Error Message -->
          <div v-if="authStore.error" class="mt-4 rounded-md bg-destructive/10 border border-destructive/20 p-4">
            <div class="flex items-start gap-3">
              <AlertTriangle class="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p class="text-sm text-destructive">{{ authStore.error }}</p>
            </div>
          </div>

          <!-- Info Section -->
          <div class="mt-6 pt-6 border-t border-border/50">
            <p class="text-xs text-muted-foreground text-center">
              Don't have Phantom?
              <a
                href="https://phantom.app/"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
              >
                Download here
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { useAuthStore } from '../stores/auth';
  import { onMounted, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { Wallet, Loader2, AlertTriangle } from 'lucide-vue-next';

  const authStore = useAuthStore();
  const router = useRouter();
  const authMethod = ref(null);

  const connectWallet = async () => {
    authMethod.value = 'wallet';
    const result = await authStore.authenticateWithWallet();
    if (result.success) {
      router.push('/projects');
    }
  };

  const authenticateWithGoogle = async () => {
    authMethod.value = 'google';
    const result = await authStore.authenticateWithGoogle();
    if (result.success) {
      router.push('/projects');
    }
  };

  onMounted(() => {
    // Check if already authenticated and redirect if so
    authStore.checkAuth();
    if (authStore.isAuthenticated) {
      router.push('/projects');
    }
  });
</script>
