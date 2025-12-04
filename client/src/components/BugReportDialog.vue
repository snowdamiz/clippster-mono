<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
        @click.self="$emit('close')"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md sm:max-w-lg w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 flex-shrink-0" />

            <div class="p-5 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
              <!-- Header -->
              <div class="mb-4 sm:mb-6 text-center">
                <div
                  class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-3 sm:mb-4"
                >
                  <Bug class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-amber-400" />
                </div>
                <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">Report a Bug</h2>
                <p class="text-zinc-400 text-xs sm:text-sm mt-1">Help us improve by reporting issues</p>
              </div>

              <form @submit.prevent="handleSubmit" class="space-y-4 sm:space-y-5">
                <!-- Title/Summary -->
                <div class="space-y-1.5 sm:space-y-2">
                  <label for="title" class="block text-xs sm:text-sm font-medium text-zinc-300">Bug Title *</label>
                  <input
                    id="title"
                    v-model="form.title"
                    type="text"
                    required
                    class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                    placeholder="Brief description of the bug"
                  />
                </div>

                <!-- Description -->
                <div class="space-y-1.5 sm:space-y-2">
                  <label for="description" class="block text-xs sm:text-sm font-medium text-zinc-300">
                    Description *
                  </label>
                  <textarea
                    id="description"
                    v-model="form.description"
                    required
                    rows="3"
                    class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all resize-y min-h-[80px]"
                    placeholder="Please describe the bug in detail, including steps to reproduce it"
                  ></textarea>
                </div>

                <!-- Severity -->
                <div class="space-y-1.5 sm:space-y-2">
                  <label for="severity" class="block text-xs sm:text-sm font-medium text-zinc-300">Severity</label>
                  <select
                    id="severity"
                    v-model="form.severity"
                    class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                  >
                    <option value="low">Low - Minor inconvenience</option>
                    <option value="medium">Medium - Feature not working correctly</option>
                    <option value="high">High - Major functionality broken</option>
                    <option value="critical">Critical - App unusable or data loss</option>
                  </select>
                </div>

                <!-- Expected vs Actual -->
                <div class="grid grid-cols-1 gap-3 sm:gap-4">
                  <div class="space-y-1.5 sm:space-y-2">
                    <label for="expected" class="block text-xs sm:text-sm font-medium text-zinc-300">
                      Expected Behavior
                    </label>
                    <textarea
                      id="expected"
                      v-model="form.expected_behavior"
                      rows="2"
                      class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all resize-y min-h-[50px]"
                      placeholder="What should have happened"
                    ></textarea>
                  </div>
                  <div class="space-y-1.5 sm:space-y-2">
                    <label for="actual" class="block text-xs sm:text-sm font-medium text-zinc-300">
                      Actual Behavior
                    </label>
                    <textarea
                      id="actual"
                      v-model="form.actual_behavior"
                      rows="2"
                      class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all resize-y min-h-[50px]"
                      placeholder="What actually happened"
                    ></textarea>
                  </div>
                </div>

                <!-- Error Display -->
                <div v-if="error" class="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-red-500/10 border border-red-500/30">
                  <p class="text-red-400 text-xs sm:text-sm">{{ error }}</p>
                </div>

                <!-- Success Display -->
                <div
                  v-if="success"
                  class="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/30"
                >
                  <p class="text-emerald-400 text-xs sm:text-sm">{{ success }}</p>
                </div>

                <!-- Actions -->
                <div class="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    @click="$emit('close')"
                    :disabled="submitting"
                    class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    :disabled="submitting || !formIsValid"
                    class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <div
                      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                    />
                    <span v-if="submitting" class="relative flex items-center justify-center">
                      <Loader2 class="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
                      Submitting...
                    </span>
                    <span v-else class="relative">Submit Report</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { Loader2, Bug } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import api from '@/services/api';

  interface Props {
    show: boolean;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'submitted'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const authStore = useAuthStore();
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const success = ref<string | null>(null);

  const form = ref({
    title: '',
    description: '',
    severity: 'medium',
    expected_behavior: '',
    actual_behavior: '',
  });

  const formIsValid = computed(() => {
    return form.value.title.trim() !== '' && form.value.description.trim() !== '';
  });

  const resetForm = () => {
    form.value = {
      title: '',
      description: '',
      severity: 'medium',
      expected_behavior: '',
      actual_behavior: '',
    };
    error.value = null;
    success.value = null;
    submitting.value = false;
  };

  const handleSubmit = async () => {
    if (!formIsValid.value || submitting.value) return;

    submitting.value = true;
    error.value = null;
    success.value = null;

    try {
      const requestBody = {
        title: form.value.title.trim(),
        description: form.value.description.trim(),
        severity: form.value.severity,
        expected_behavior: form.value.expected_behavior.trim() || null,
        actual_behavior: form.value.actual_behavior.trim() || null,
        user_wallet_address: authStore.walletAddress,
      };

      const response = await api.post('/bug-reports', requestBody);

      const data = response.data;

      if (data.success) {
        success.value = 'Bug report submitted successfully! Thank you for helping us improve the application.';
        // Close dialog after a short delay to show success message
        setTimeout(() => {
          resetForm();
          emit('close');
          emit('submitted');
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to submit bug report');
      }
    } catch (err) {
      console.error('Bug report submission error:', err);
      error.value = err instanceof Error ? err.message : 'An unexpected error occurred while submitting the bug report';
    } finally {
      submitting.value = false;
    }
  };

  // Reset form when dialog opens/closes
  watch(
    () => props.show,
    (newShow) => {
      if (!newShow) {
        resetForm();
      }
    }
  );
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

  /* Custom scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgb(63 63 70);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgb(82 82 91);
  }
</style>
