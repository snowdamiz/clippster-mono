<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
      @click.self="close"
    >
      <div class="bg-card border border-border rounded-lg shadow-xl max-w-md w-full m-4">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h2 class="text-xl font-semibold text-foreground">Connect Your Wallet</h2>
          <button @click="close" class="p-1 hover:bg-[#ffffff]/10 rounded-md transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-foreground/70 hover:text-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-6">
          <!-- Logo -->
          <div class="flex justify-center mb-6">
            <img src="/logo.svg" alt="Clippster" class="h-12 w-auto" />
          </div>

          <!-- Description -->
          <div class="text-center mb-8">
            <p class="text-muted-foreground">Sign in securely with your Phantom wallet to access Clippster</p>
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
                <svg v-if="!authStore.loading" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M6.5 2h11c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2h-11c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm0 2v16h11V4h-11zm2 2h7v2h-7V6zm0 4h7v2h-7v-2zm0 4h4v2h-4v-2z"
                  />
                </svg>
                <svg
                  v-else
                  class="h-5 w-5 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {{ authStore.loading ? 'Connecting...' : 'Connect Phantom Wallet' }}
              </span>
            </div>
          </button>

          <!-- Error Message -->
          <div v-if="authStore.error" class="mt-4 rounded-md bg-destructive/10 border border-destructive/20 p-4">
            <div class="flex items-start gap-3">
              <svg
                class="h-5 w-5 text-destructive flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
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
  </Teleport>
</template>

<script setup lang="ts">
  import { useAuthStore } from '@/stores/auth';

  const props = defineProps<{
    modelValue: boolean;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
  }>();

  const authStore = useAuthStore();

  const connectWallet = async () => {
    const result = await authStore.authenticateWithWallet();
    if (result.success) {
      // Close the modal after successful authentication
      close();
    }
  };

  const close = () => {
    if (!authStore.loading) {
      emit('update:modelValue', false);
    }
  };
</script>

<style scoped>
  .fixed {
    z-index: 9999;
  }
</style>
