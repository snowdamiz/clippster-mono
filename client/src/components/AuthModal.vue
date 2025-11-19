<template>
  <Teleport to="body">
    <Transition name="modal-backdrop">
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="close"
        @keydown.esc="close"
        tabindex="-1"
      >
        <Transition name="modal-content">
          <div
            v-if="modelValue"
            class="relative bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <!-- Close Button -->
            <button
              @click="close"
              :disabled="authStore.loading"
              class="absolute right-3 top-3 z-10 p-1.5 rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Close dialog"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 text-muted-foreground hover:text-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <!-- Two Column Layout -->
            <div class="grid md:grid-cols-2">
              <!-- Left Column - Branding & Value Props -->
              <div class="bg-gradient-to-br from-purple-600/10 via-indigo-600/10 to-purple-600/10 p-8 flex flex-col">
                <!-- Logo -->
                <div class="mb-8">
                  <img src="/logo.svg" alt="Clippster" class="h-10 w-auto" />
                </div>

                <!-- Value Propositions -->
                <div class="flex-1 space-y-6">
                  <div>
                    <h2 id="auth-modal-title" class="text-2xl font-bold text-foreground mb-2">
                      Transform Videos into Viral Clips
                    </h2>
                    <p class="text-sm text-muted-foreground">
                      Connect your wallet to unlock AI-powered clip creation and editing
                    </p>
                  </div>

                  <!-- Features List -->
                  <div class="space-y-4">
                    <div class="flex items-start gap-3 group">
                      <div
                        class="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mt-0.5"
                      >
                        <svg
                          class="h-4 w-4 text-purple-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 class="text-sm font-semibold text-foreground">AI-Powered Detection</h3>
                        <p class="text-xs text-muted-foreground mt-0.5">
                          Automatically find the best moments in your videos
                        </p>
                      </div>
                    </div>

                    <div class="flex items-start gap-3 group">
                      <div
                        class="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center mt-0.5"
                      >
                        <svg
                          class="h-4 w-4 text-indigo-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 class="text-sm font-semibold text-foreground">Professional Editing</h3>
                        <p class="text-xs text-muted-foreground mt-0.5">
                          Timeline editor with multi-platform formatting
                        </p>
                      </div>
                    </div>

                    <div class="flex items-start gap-3 group">
                      <div
                        class="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mt-0.5"
                      >
                        <svg
                          class="h-4 w-4 text-purple-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 class="text-sm font-semibold text-foreground">Credit-Based Pricing</h3>
                        <p class="text-xs text-muted-foreground mt-0.5">Pay only for what you use, no subscriptions</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Trust Badge -->
                <div class="mt-8 pt-6 border-t border-border/20">
                  <div class="flex items-center gap-2 text-xs text-muted-foreground">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                      />
                    </svg>
                    <span>Secured by Solana blockchain</span>
                  </div>
                </div>
              </div>

              <!-- Right Column - Auth Actions -->
              <div class="p-8 flex flex-col justify-center">
                <div class="space-y-6">
                  <!-- Connect Wallet -->
                  <div>
                    <label class="block text-sm font-medium text-foreground mb-3">Sign In</label>
                    <button
                      @click="connectWallet"
                      :disabled="authStore.loading"
                      class="w-full group relative overflow-hidden rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 focus:ring-offset-card"
                    >
                      <div class="px-4 py-3 flex items-center justify-center gap-2.5">
                        <svg
                          v-if="!authStore.loading"
                          class="h-5 w-5 text-white"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                        </svg>
                        <svg
                          v-else
                          class="h-5 w-5 animate-spin text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          ></circle>
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span class="text-sm font-semibold text-white">
                          {{ authStore.loading ? 'Connecting...' : 'Connect Phantom Wallet' }}
                        </span>
                      </div>
                    </button>
                  </div>

                  <!-- Error Message -->
                  <Transition name="error-fade">
                    <div v-if="authStore.error" class="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                      <div class="flex items-start gap-2.5">
                        <svg
                          class="h-4 w-4 text-destructive flex-shrink-0 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <p class="text-sm text-destructive">{{ authStore.error }}</p>
                      </div>
                    </div>
                  </Transition>

                  <!-- Divider -->
                  <div class="relative">
                    <div class="absolute inset-0 flex items-center">
                      <div class="w-full border-t border-border"></div>
                    </div>
                    <div class="relative flex justify-center text-xs uppercase">
                      <span class="bg-card px-2 text-muted-foreground">New to Phantom?</span>
                    </div>
                  </div>

                  <!-- Download Phantom -->
                  <a
                    href="https://phantom.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block text-center px-4 py-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors group"
                  >
                    <div class="flex items-center justify-center gap-2">
                      <span class="text-sm font-medium text-foreground">Download Phantom</span>
                      <svg
                        class="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-all group-hover:translate-x-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </div>
                  </a>

                  <!-- Pricing Hint -->
                  <div class="pt-4 border-t border-border/50">
                    <div class="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                      <svg
                        class="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div>
                        <p class="text-xs font-medium text-foreground">Get started with free credits</p>
                        <p class="text-xs text-muted-foreground mt-0.5">
                          New users receive credits to try all features
                        </p>
                      </div>
                    </div>
                  </div>
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
  import { onMounted, onUnmounted, watch } from 'vue';
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

  // Handle ESC key press
  const handleEscKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && props.modelValue) {
      close();
    }
  };

  // Add/remove event listener
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        document.addEventListener('keydown', handleEscKey);
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
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
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleEscKey);
    document.body.style.overflow = '';
  });
</script>

<style scoped>
  /* Modal Backdrop Transitions */
  .modal-backdrop-enter-active {
    transition: opacity 0.25s ease-out;
  }

  .modal-backdrop-leave-active {
    transition: opacity 0.2s ease-in;
  }

  .modal-backdrop-enter-from,
  .modal-backdrop-leave-to {
    opacity: 0;
  }

  /* Modal Content Transitions */
  .modal-content-enter-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-content-leave-active {
    transition: all 0.2s ease-in;
  }

  .modal-content-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(10px);
  }

  .modal-content-leave-to {
    opacity: 0;
    transform: scale(0.98) translateY(-5px);
  }

  /* Error Fade Transitions */
  .error-fade-enter-active {
    transition: all 0.25s ease-out;
  }

  .error-fade-leave-active {
    transition: all 0.2s ease-in;
  }

  .error-fade-enter-from {
    opacity: 0;
    transform: translateY(-8px);
  }

  .error-fade-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }

  /* Z-index */
  .fixed {
    z-index: 9999;
  }
</style>
