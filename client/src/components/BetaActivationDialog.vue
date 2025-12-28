<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]">
      <Transition name="dialog" appear>
        <div
          class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-sm sm:max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
        >
          <!-- Decorative top accent -->
          <div class="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

          <div class="p-5 sm:p-6 lg:p-8">
            <!-- Header -->
            <div class="mb-4 sm:mb-6 text-center">
              <div
                class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-3 sm:mb-4"
              >
                <KeyRound class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-amber-400" />
              </div>
              <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">Beta Access Required</h2>
              <p class="text-zinc-400 text-sm mt-2">
                Enter your beta code to activate your account and access all features.
              </p>
            </div>

            <!-- Content -->
            <form @submit.prevent="handleSubmit" class="space-y-4">
              <!-- Beta Code Input -->
              <div>
                <label for="beta-code" class="block text-sm font-medium text-zinc-300 mb-2">Beta Code</label>
                <div class="relative">
                  <input
                    id="beta-code"
                    v-model="betaCode"
                    type="text"
                    maxlength="8"
                    placeholder="XXXXXXXX"
                    :disabled="loading"
                    class="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all uppercase tracking-widest text-center font-mono text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    @input="handleInput"
                  />
                  <Loader2
                    v-if="loading"
                    class="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-amber-400 animate-spin"
                  />
                </div>
                <p class="text-zinc-500 text-xs mt-2 text-center">Beta codes are 8 characters long</p>
              </div>

              <!-- Error Message -->
              <Transition name="fade">
                <div v-if="errorMessage" class="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div class="flex items-center gap-2">
                    <AlertCircle class="h-4 w-4 text-red-400 flex-shrink-0" />
                    <p class="text-red-400 text-sm">{{ errorMessage }}</p>
                  </div>
                </div>
              </Transition>

              <!-- Success Message -->
              <Transition name="fade">
                <div v-if="successMessage" class="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div class="flex items-center gap-2">
                    <CheckCircle class="h-4 w-4 text-green-400 flex-shrink-0" />
                    <p class="text-green-400 text-sm">{{ successMessage }}</p>
                  </div>
                </div>
              </Transition>

              <!-- Actions -->
              <div class="space-y-2 sm:space-y-3 pt-2">
                <button
                  type="submit"
                  :disabled="loading || betaCode.length !== 8"
                  class="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <span class="relative flex items-center justify-center gap-2">
                    <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
                    <span>{{ loading ? 'Activating...' : 'Activate Beta Access' }}</span>
                  </span>
                </button>

                <button
                  type="button"
                  :disabled="loading"
                  class="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="$emit('logout')"
                >
                  Sign Out
                </button>
              </div>
            </form>

            <!-- Help Text -->
            <div class="mt-6 pt-4 border-t border-zinc-800">
              <p class="text-zinc-500 text-xs text-center">
                Don't have a beta code? Contact the administrator to request access.
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { KeyRound, Loader2, AlertCircle, CheckCircle } from 'lucide-vue-next';
  import { activateWithCode } from '@/services/betaCodes';

  interface Props {
    show: boolean;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'activated'): void;
    (e: 'logout'): void;
  }

  defineProps<Props>();
  const emit = defineEmits<Emits>();

  const betaCode = ref('');
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);
  const successMessage = ref<string | null>(null);

  const handleInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    // Convert to uppercase and remove non-alphanumeric characters
    betaCode.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Clear messages on input
    errorMessage.value = null;
    successMessage.value = null;
  };

  const handleSubmit = async () => {
    if (betaCode.value.length !== 8) {
      errorMessage.value = 'Please enter a valid 8-character beta code';
      return;
    }

    loading.value = true;
    errorMessage.value = null;
    successMessage.value = null;

    try {
      const result = await activateWithCode(betaCode.value);

      if (result.success) {
        successMessage.value = result.message || 'Beta access activated successfully!';
        // Emit activated event after a short delay to show success message
        setTimeout(() => {
          emit('activated');
        }, 1500);
      } else {
        errorMessage.value = result.error || 'Invalid or already used beta code';
      }
    } catch (error) {
      console.error('[BetaActivation] Error:', error);
      errorMessage.value = 'An unexpected error occurred. Please try again.';
    } finally {
      loading.value = false;
    }
  };
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

  /* Fade transition for messages */
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.2s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
