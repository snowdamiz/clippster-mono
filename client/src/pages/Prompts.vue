<template>
  <PageLayout
    title="Prompts"
    description="Manage your AI prompts and templates"
    :show-header="!loading && prompts.length > 0"
    icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z"
  >
    <template #actions>
      <button
        @click="navigateToNew"
        class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-md flex items-center gap-2 font-medium shadow-sm transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Prompt
      </button>
    </template>
    <!-- Loading State -->
    <LoadingState v-if="loading" message="Loading prompts..." />
    <!-- Prompts List -->

    <div v-else-if="prompts.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div
        v-for="prompt in prompts"
        :key="prompt.id"
        class="group bg-card border border-border rounded-lg overflow-hidden transition-all duration-200 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5"
      >
        <!-- Content -->
        <div class="p-5">
          <!-- Header -->
          <div class="flex items-start gap-4 mb-4">
            <!-- Icon -->
            <div
              class="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z"
                />
              </svg>
            </div>

            <!-- Title and Badge -->
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-base text-foreground mb-2 truncate">{{ prompt.name }}</h3>
              <span
                v-if="isDefaultPrompt(prompt)"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 text-purple-400 text-xs font-medium rounded-md border border-purple-500/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                  />
                </svg>
                Default
              </span>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-1 flex-shrink-0">
              <button
                class="p-2 hover:bg-muted rounded-md transition-colors group/copy"
                :title="copiedId === prompt.id ? 'Copied!' : 'Copy to clipboard'"
                @click.stop="copyPrompt(prompt)"
              >
                <svg
                  v-if="copiedId !== prompt.id"
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-muted-foreground group-hover/copy:text-purple-400 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
              <button
                class="p-2 hover:bg-muted rounded-md transition-colors group/edit"
                title="Edit prompt"
                v-if="!isDefaultPrompt(prompt)"
                @click.stop="editPrompt(prompt)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-muted-foreground group-hover/edit:text-foreground transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                v-if="!isDefaultPrompt(prompt)"
                class="p-2 hover:bg-muted rounded-md transition-colors group/delete"
                title="Delete prompt"
                @click.stop="confirmDelete(prompt)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-muted-foreground group-hover/delete:text-red-400 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>

          <!-- Content -->
          <p class="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
            {{ prompt.content }}
          </p>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-border bg-muted/30">
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Updated {{ getRelativeTime(prompt.updated_at) }}</span>
          </div>
        </div>
      </div>
    </div>
    <!-- Empty State -->
    <EmptyState
      v-else
      title="No prompts yet"
      description="Create your first prompt template to get started"
      button-text="Create Prompt"
      @action="navigateToNew"
    >
      <template #icon>
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
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z"
          />
        </svg>
      </template>
    </EmptyState>
    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showDeleteDialog = false"
    >
      <div class="bg-card rounded-lg p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-4">Delete Prompt</h2>

        <div class="space-y-4">
          <p class="text-muted-foreground">
            Are you sure you want to delete "
            <span class="font-semibold text-foreground">{{ promptToDelete?.name }}</span>
            "? This action cannot be undone.
          </p>
          <button
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md font-semibold hover:from-red-700 hover:to-red-800 transition-all"
            @click="deletePromptConfirmed"
          >
            Delete
          </button>
          <button
            class="w-full py-3 bg-muted text-foreground rounded-md font-semibold hover:bg-muted/80 transition-all"
            @click="showDeleteDialog = false"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { getAllPrompts, deletePrompt, type Prompt } from '@/services/database';
  import { useFormatters } from '@/composables/useFormatters';
  import { useToast } from '@/composables/useToast';
  import PageLayout from '@/components/PageLayout.vue';
  import LoadingState from '@/components/LoadingState.vue';
  import EmptyState from '@/components/EmptyState.vue';

  const router = useRouter();
  const { success, error } = useToast();
  const prompts = ref<Prompt[]>([]);
  const loading = ref(true);
  const { getRelativeTime } = useFormatters();
  const copiedId = ref<string | null>(null);
  const showDeleteDialog = ref(false);
  const promptToDelete = ref<Prompt | null>(null);

  function navigateToNew() {
    router.push('/prompts/new');
  }

  function isDefaultPrompt(prompt: Prompt): boolean {
    return prompt.name === 'Default Clip Detector';
  }

  async function loadPrompts() {
    loading.value = true;
    try {
      prompts.value = await getAllPrompts();
    } catch (err) {
      error('Failed to load prompts', 'An error occurred while loading prompts. Please try again.');
    } finally {
      loading.value = false;
    }
  }

  async function copyPrompt(prompt: Prompt) {
    try {
      await navigator.clipboard.writeText(prompt.content);
      copiedId.value = prompt.id;
      success('Prompt copied', `"${prompt.name}" has been copied to clipboard`);
      // Clear the copied state after 2 seconds
      setTimeout(() => {
        copiedId.value = null;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy prompt:', error);
    }
  }

  function editPrompt(prompt: Prompt) {
    router.push(`/prompts/${prompt.id}/edit`);
  }

  function confirmDelete(prompt: Prompt) {
    promptToDelete.value = prompt;
    showDeleteDialog.value = true;
  }

  async function deletePromptConfirmed() {
    if (!promptToDelete.value) return;

    const deletedPromptName = promptToDelete.value.name;

    try {
      await deletePrompt(promptToDelete.value.id);
      success('Prompt deleted', `"${deletedPromptName}" has been deleted successfully`);
      await loadPrompts();
    } catch (err) {
      error('Failed to delete prompt', 'An error occurred while deleting the prompt. Please try again.');
    } finally {
      showDeleteDialog.value = false;
      promptToDelete.value = null;
    }
  }

  onMounted(() => {
    loadPrompts();
  });
</script>
