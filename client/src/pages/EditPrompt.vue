<template>
  <PageLayout
    title="Edit Prompt"
    description="Update your AI prompt template"
    :show-header="true"
    :icon="MessageSquare"
  >
    <!-- Loading State -->
    <LoadingState v-if="loading" message="Loading prompt..." />
    <!-- Not Found State -->

    <div v-else-if="!prompt" class="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)]">
      <div class="p-5 bg-muted rounded-full mb-6">
        <AlertTriangle class="h-16 w-16 text-muted-foreground" />
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
                <ArrowLeft class="h-4 w-4" />
                Cancel
              </button>
              <div class="flex items-center gap-3">
                <button
                  v-if="hasChanges"
                  type="button"
                  @click="resetForm"
                  class="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-md font-medium transition-all flex items-center gap-2"
                >
                  <RotateCcw class="h-4 w-4" />
                  Reset
                </button>
                <button
                  type="submit"
                  :disabled="saving || !isFormValid || !hasChanges"
                  class="px-5 py-2.5 bg-gradient-to-br from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-md font-medium shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
                >
                  <Save v-if="!saving" class="h-5 w-5" />
                  <Loader2 v-else class="animate-spin h-5 w-5" />
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
                <Star class="h-4 w-4 text-purple-500" />
              </div>

              <h3 class="font-medium text-foreground">Quick Tips</h3>
            </div>

            <ul class="space-y-2.5 text-sm text-muted-foreground">
              <li class="flex items-start gap-2">
                <Check class="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Be specific about the task and desired output</span>
              </li>

              <li class="flex items-start gap-2">
                <Check class="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Create reusable templates for common tasks</span>
              </li>

              <li class="flex items-start gap-2">
                <Check class="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Include context about video style and tone</span>
              </li>

              <li class="flex items-start gap-2">
                <Check class="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
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
  import { MessageSquare, AlertTriangle, ArrowLeft, RotateCcw, Save, Loader2, Star, Check } from 'lucide-vue-next';
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
