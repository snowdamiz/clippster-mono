<template>
  <PageLayout
    title="Edit Prompt"
    description="Update your AI prompt template"
    :show-header="true"
    icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z"
  >
    <!-- Loading State -->
    <LoadingState v-if="loading" message="Loading prompt..." />
    <!-- Not Found State -->

    <div v-else-if="!prompt" class="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)]">
      <div class="p-5 bg-muted rounded-full mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-16 w-16 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <h3 class="text-xl font-semibold text-foreground mb-2">Prompt Not Found</h3>

      <p class="text-muted-foreground mb-6">The prompt you're looking for doesn't exist.</p>
      <button
        @click="router.push('/prompts')"
        class="px-5 py-2.5 bg-gradient-to-br from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-md font-medium shadow-sm transition-all"
      >
        Back to Prompts
      </button>
    </div>
    <!-- Edit Form -->
    <div v-else>
      <!-- Main Form -->
      <div>
        <!-- Form Card -->
        <div class="bg-card border border-border rounded-md p-6 shadow-sm">
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Name Field -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label for="name" class="block text-sm font-medium text-foreground">
                  Prompt Name
                  <span class="text-red-500 ml-1">*</span>
                </label>
                <span class="text-xs text-muted-foreground">{{ formData.name.length }}/100</span>
              </div>
              <input
                id="name"
                ref="nameInput"
                v-model="formData.name"
                type="text"
                maxlength="100"
                placeholder="e.g., Viral Shorts Creator, Tutorial Intro Template"
                class="w-full px-3.5 py-2.5 bg-background border border-border rounded-md focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 text-foreground placeholder:text-muted-foreground transition-all"
                required
              />
            </div>
            <!-- Content Field -->
            <div class="space-y-1.5">
              <label for="content" class="block text-sm font-medium text-foreground">
                Prompt Content
                <span class="text-red-500 ml-1">*</span>
              </label>
              <textarea
                id="content"
                v-model="formData.content"
                rows="20"
                placeholder="Write your AI prompt here... Be specific about the task and desired output."
                class="w-full px-3.5 py-2.5 bg-background border border-border rounded-md focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 text-foreground placeholder:text-muted-foreground transition-all resize-vertical"
                required
              ></textarea>
            </div>
            <!-- Actions -->
            <div class="flex items-center justify-between">
              <button
                type="button"
                @click="handleCancel"
                class="px-5 py-2.5 text-muted-foreground hover:text-foreground font-medium transition-all flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
                Cancel
              </button>
              <div class="flex items-center gap-3">
                <button
                  v-if="hasChanges"
                  type="button"
                  @click="resetForm"
                  class="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-md font-medium transition-all flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  Reset
                </button>
                <button
                  type="submit"
                  :disabled="saving || !isFormValid || !hasChanges"
                  class="px-5 py-2.5 bg-gradient-to-br from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-md font-medium shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
                >
                  <svg
                    v-if="!saving"
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z"
                    />
                  </svg>
                  <svg
                    v-else
                    class="animate-spin h-5 w-5"
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
                  {{ saving ? 'Saving...' : 'Update Prompt' }}
                </button>
              </div>
            </div>
          </form>
        </div>
        <!-- Tips & Help - Bottom Section -->
        <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Quick Tips Card -->
          <div
            class="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border border-purple-500/20 rounded-md p-5 space-y-3"
          >
            <div class="flex items-center gap-2.5">
              <div class="p-1.5 bg-purple-500/10 rounded-md">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-purple-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                  />
                </svg>
              </div>

              <h3 class="font-medium text-foreground">Quick Tips</h3>
            </div>

            <ul class="space-y-2.5 text-sm text-muted-foreground">
              <li class="flex items-start gap-2">
                <svg
                  class="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span>Be specific about the task and desired output</span>
              </li>

              <li class="flex items-start gap-2">
                <svg
                  class="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span>Create reusable templates for common tasks</span>
              </li>

              <li class="flex items-start gap-2">
                <svg
                  class="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span>Include context about video style and tone</span>
              </li>

              <li class="flex items-start gap-2">
                <svg
                  class="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span>Test and refine your prompts iteratively</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { getPrompt, updatePrompt, type Prompt } from '@/services/database';
  import { useBreadcrumb } from '@/composables/useBreadcrumb';
  import { useToast } from '@/composables/useToast';
  import PageLayout from '@/components/PageLayout.vue';
  import LoadingState from '@/components/LoadingState.vue';

  const router = useRouter();
  const route = useRoute();
  const { success, error } = useToast();
  const loading = ref(true);
  const saving = ref(false);
  const prompt = ref<Prompt | null>(null);
  const nameInput = ref<HTMLInputElement | null>(null);

  // Use breadcrumb composable
  const { setBreadcrumbTitle, clearBreadcrumbTitle } = useBreadcrumb();

  const formData = reactive({
    name: '',
    content: '',
  });

  const originalData = reactive({
    name: '',
    content: '',
  });

  const isFormValid = computed(() => {
    return formData.name.trim().length > 0 && formData.content.trim().length > 0;
  });

  const hasChanges = computed(() => {
    return formData.name !== originalData.name || formData.content !== originalData.content;
  });

  function resetForm() {
    formData.name = originalData.name;
    formData.content = originalData.content;
    nameInput.value?.focus();
  }

  async function loadPrompt() {
    const promptId = route.params.id as string;
    loading.value = true;

    try {
      const data = await getPrompt(promptId);
      if (data) {
        prompt.value = data;
        formData.name = data.name;
        formData.content = data.content;
        originalData.name = data.name;
        originalData.content = data.content;

        // Set breadcrumb title
        setBreadcrumbTitle(data.name);
      }
    } catch (err) {
      error('Failed to load prompt', 'An error occurred while loading the prompt. Please try again.');
    } finally {
      loading.value = false;
    }
  }

  async function handleSubmit() {
    if (!isFormValid.value || !hasChanges.value || !prompt.value) {
      return;
    }

    saving.value = true;
    try {
      await updatePrompt(prompt.value.id, formData.name.trim(), formData.content.trim());
      success('Prompt updated', `"${formData.name.trim()}" has been updated successfully`);
      router.push('/prompts');
    } catch (err) {
      error('Failed to update prompt', 'An error occurred while updating the prompt. Please try again.');
    } finally {
      saving.value = false;
    }
  }

  function handleCancel() {
    router.push('/prompts');
  }

  onMounted(() => {
    loadPrompt();
  });

  onUnmounted(() => {
    // Clear breadcrumb title when leaving the page
    clearBreadcrumbTitle();
  });
</script>
