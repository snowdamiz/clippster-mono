<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]">
      <Transition name="dialog" appear>
        <div
          class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-sm sm:max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
        >
          <!-- Decorative top accent -->
          <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

          <div class="p-5 sm:p-6 lg:p-8">
            <!-- Header -->
            <div class="mb-4 sm:mb-6 text-center">
              <div
                class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 mb-3 sm:mb-4"
              >
                <AlertTriangle class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-violet-400" />
              </div>
              <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">{{ title }}</h2>
            </div>

            <!-- Content -->
            <div class="mb-5 sm:mb-6 lg:mb-8">
              <p class="text-zinc-400 text-center text-sm sm:text-base">
                {{ message }}
                <span v-if="itemName" class="font-semibold text-white">"{{ itemName }}"</span>
                {{ suffix }}
              </p>
              <p v-if="showCannotUndoneText" class="text-zinc-500 text-xs sm:text-sm text-center mt-2">
                This action cannot be undone.
              </p>
            </div>

            <!-- Actions -->
            <div class="space-y-2 sm:space-y-3">
              <!-- Single button mode (for warnings/errors) -->
              <template v-if="showOnlyCloseButton">
                <button
                  class="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group text-sm sm:text-base"
                  @click="$emit('close')"
                >
                  <div
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <span class="relative">{{ closeText }}</span>
                </button>
              </template>

              <!-- Two button mode (for confirmations) -->
              <template v-else>
                <button
                  class="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group text-sm sm:text-base"
                  @click="$emit('confirm')"
                >
                  <div
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <span class="relative">{{ confirmText }}</span>
                </button>
                <button
                  class="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 text-sm sm:text-base"
                  @click="$emit('close')"
                >
                  {{ closeText }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { AlertTriangle } from 'lucide-vue-next';

  interface Props {
    show: boolean;
    title?: string;
    message?: string;
    itemName?: string;
    suffix?: string;
    confirmText?: string;
    closeText?: string;
    showOnlyCloseButton?: boolean;
    showCannotUndoneText?: boolean;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'confirm'): void;
  }

  withDefaults(defineProps<Props>(), {
    title: 'Confirm Action',
    message: 'Are you sure you want to',
    suffix: '?',
    confirmText: 'Confirm',
    closeText: 'Cancel',
    showOnlyCloseButton: false,
    showCannotUndoneText: true,
  });

  defineEmits<Emits>();
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
</style>
