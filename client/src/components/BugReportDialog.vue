<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
      @click.self="$emit('close')"
    >
      <div class="bg-card rounded-lg p-6 max-w-lg w-full mx-4 border border-border max-h-[90vh] overflow-y-auto">
        <h2 class="text-2xl font-bold mb-4">Report a Bug</h2>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Title/Summary -->
          <div>
            <label for="title" class="block text-sm font-medium text-foreground mb-2">Bug Title *</label>
            <input
              id="title"
              v-model="form.title"
              type="text"
              required
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Brief description of the bug"
            />
          </div>

          <!-- Description -->
          <div>
            <label for="description" class="block text-sm font-medium text-foreground mb-2">Description *</label>
            <textarea
              id="description"
              v-model="form.description"
              required
              rows="4"
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-vertical"
              placeholder="Please describe the bug in detail, including steps to reproduce it"
            ></textarea>
          </div>

          <!-- Severity -->
          <div>
            <label for="severity" class="block text-sm font-medium text-foreground mb-2">Severity</label>
            <select
              id="severity"
              v-model="form.severity"
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="low">Low - Minor inconvenience</option>
              <option value="medium">Medium - Feature not working correctly</option>
              <option value="high">High - Major functionality broken</option>
              <option value="critical">Critical - App unusable or data loss</option>
            </select>
          </div>

          <!-- Expected vs Actual -->
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label for="expected" class="block text-sm font-medium text-foreground mb-2">Expected Behavior</label>
              <textarea
                id="expected"
                v-model="form.expected_behavior"
                rows="2"
                class="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-vertical"
                placeholder="What should have happened"
              ></textarea>
            </div>
            <div>
              <label for="actual" class="block text-sm font-medium text-foreground mb-2">Actual Behavior</label>
              <textarea
                id="actual"
                v-model="form.actual_behavior"
                rows="2"
                class="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-vertical"
                placeholder="What actually happened"
              ></textarea>
            </div>
          </div>

          <!-- Error Display -->
          <div
            v-if="error"
            class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3"
          >
            <p class="text-red-600 dark:text-red-400 text-sm">{{ error }}</p>
          </div>

          <!-- Success Display -->
          <div
            v-if="success"
            class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3"
          >
            <p class="text-green-600 dark:text-green-400 text-sm">{{ success }}</p>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-4">
            <button
              type="button"
              @click="$emit('close')"
              :disabled="submitting"
              class="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="submitting || !formIsValid"
              class="px-4 py-2 bg-gradient-to-r from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-md font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="submitting" class="flex items-center">
                <Loader2 class="h-4 w-4 mr-1 animate-spin" />
                Submitting...
              </span>
              <span v-else>Submit Bug Report</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { Loader2 } from 'lucide-vue-next';
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
  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .resize-vertical {
    resize: vertical;
    min-height: 80px;
  }
</style>
