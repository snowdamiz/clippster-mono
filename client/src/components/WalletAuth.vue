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
            <h2 class="text-2xl font-bold text-foreground mb-2">Connect Your Wallet</h2>

            <p class="text-muted-foreground text-sm">Sign in securely with your Phantom wallet to access Clippster</p>
          </div>
          <!-- Connect Button -->
          <button
            @click="connectWallet"
            :disabled="authStore.loading"
            class="w-full group relative overflow-hidden rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 p-[1px] transition-all hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            <div
              class="relative rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 transition-all group-hover:from-purple-500 group-hover:to-indigo-500"
            >
              <span class="flex items-center justify-center gap-2 font-semibold text-white">
                <Wallet v-if="!authStore.loading" class="h-5 w-5" />
                <Loader2 v-else class="h-5 w-5 animate-spin" />
                {{ authStore.loading ? 'Connecting...' : 'Connect Phantom Wallet' }}
              </span>
            </div>
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
  import { onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { Wallet, Loader2, AlertTriangle } from 'lucide-vue-next';

  const authStore = useAuthStore();
  const router = useRouter();

  const connectWallet = async () => {
    const result = await authStore.authenticateWithWallet();
    if (result.success) {
      // Redirect to dashboard after successful authentication
      router.push('/dashboard');
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  onMounted(() => {
    // Check if already authenticated and redirect if so
    authStore.checkAuth();
    if (authStore.isAuthenticated) {
      router.push('/dashboard');
    }
  });
</script>
