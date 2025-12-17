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
                      Connect your wallet to unlock AI-powered clip creation and editing
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
                    <span>Secured by Solana blockchain</span>
                  </div>
                </div>
              </div>

              <!-- Right Column - Auth Actions -->
              <div class="p-5 sm:p-6 lg:p-8 flex flex-col justify-center">
                <div class="space-y-4 sm:space-y-6">
                  <!-- Connect Wallet -->
                  <div>
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300 mb-2 sm:mb-3">Sign In</label>
                    <button
                      @click="connectWallet"
                      :disabled="authStore.loading"
                      class="w-full group relative overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-zinc-900"
                    >
                      <div
                        class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                      />
                      <div class="px-4 py-3 sm:py-3.5 flex items-center justify-center gap-2 sm:gap-2.5 relative">
                        <Wallet
                          v-if="!authStore.loading || authMethod !== 'wallet'"
                          class="h-4 w-4 sm:h-5 sm:w-5 text-white"
                        />
                        <Loader2 v-else class="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-white" />
                        <span class="text-xs sm:text-sm font-semibold text-white">
                          {{
                            authStore.loading && authMethod === 'wallet' ? 'Connecting...' : 'Connect Phantom Wallet'
                          }}
                        </span>
                      </div>
                    </button>
                  </div>

                  <!-- OR Divider -->
                  <div class="relative">
                    <div class="absolute inset-0 flex items-center">
                      <div class="w-full border-t border-zinc-800"></div>
                    </div>
                    <div class="relative flex justify-center text-[10px] sm:text-xs uppercase">
                      <span class="bg-zinc-950 px-2 sm:px-3 text-zinc-500">OR</span>
                    </div>
                  </div>

                  <!-- Google Sign-In Button -->
                  <button
                    @click="authenticateWithGoogle"
                    :disabled="authStore.loading"
                    class="w-full relative overflow-hidden rounded-lg sm:rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-zinc-900"
                  >
                    <div class="px-4 py-3 sm:py-3.5 flex items-center justify-center gap-2 sm:gap-2.5">
                      <svg
                        v-if="!authStore.loading || authMethod !== 'google'"
                        class="h-4 w-4 sm:h-5 sm:w-5"
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
                      <Loader2 v-else class="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-zinc-300" />
                      <span class="text-xs sm:text-sm font-semibold text-zinc-200">
                        {{ authStore.loading && authMethod === 'google' ? 'Signing in...' : 'Continue with Google' }}
                      </span>
                    </div>
                  </button>

                  <!-- Error Message -->
                  <Transition name="slide-fade">
                    <div
                      v-if="authStore.error"
                      class="rounded-lg sm:rounded-xl bg-red-500/10 border border-red-500/30 p-3 sm:p-4"
                    >
                      <div class="flex items-start gap-2 sm:gap-2.5">
                        <AlertTriangle class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p class="text-xs sm:text-sm text-red-400">{{ authStore.error }}</p>
                      </div>
                    </div>
                  </Transition>
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
    ExternalLink,
    Info,
  } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';

  const props = defineProps<{
    modelValue: boolean;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
  }>();

  const authStore = useAuthStore();
  const authMethod = ref<'wallet' | 'google' | null>(null);

  const connectWallet = async () => {
    authMethod.value = 'wallet';
    const result = await authStore.authenticateWithWallet();
    if (result.success) {
      // Close the modal after successful authentication
      close();
    }
  };

  const authenticateWithGoogle = async () => {
    authMethod.value = 'google';
    const result = await authStore.authenticateWithGoogle();
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
