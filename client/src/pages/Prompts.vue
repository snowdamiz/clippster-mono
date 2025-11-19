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
        class="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 font-medium shadow-sm shadow-purple-500/20 transition-all active:scale-95"
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
    <div v-else-if="prompts.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-10">
      <div
        v-for="prompt in prompts"
        :key="prompt.id"
        class="group flex flex-col bg-card border border-border hover:border-purple-500/30 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/5 relative"
      >
        <!-- Card Header -->
        <div class="p-5 flex items-start justify-between gap-3">
          <div class="flex items-start gap-3 min-w-0">
            <div
              class="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
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

            <div class="min-w-0 pt-0.5">
              <h3 class="font-semibold text-base text-foreground truncate pr-2" :title="prompt.name">
                {{ prompt.name }}
              </h3>
              <div class="flex items-center gap-2 mt-1">
                <span
                  v-if="isDefaultPrompt(prompt)"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/10 text-purple-500 text-[10px] uppercase tracking-wider font-bold rounded border border-purple-500/20"
                >
                  Default
                </span>
                <span v-else class="text-xs text-muted-foreground">Custom Template</span>
              </div>
            </div>
          </div>

          <!-- Actions Overlay (Visible on Hover or Focus) -->
          <div
            class="flex items-center -mr-1 transition-opacity duration-200 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100"
          >
            <button
              class="p-2 text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10 rounded-md transition-colors"
              :title="copiedId === prompt.id ? 'Copied!' : 'Copy to clipboard'"
              @click.stop="copyPrompt(prompt)"
            >
              <svg
                v-if="copiedId !== prompt.id"
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
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
                class="h-4 w-4 text-green-500"
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

            <template v-if="!isDefaultPrompt(prompt)">
              <button
                class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                title="Edit prompt"
                @click.stop="editPrompt(prompt)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
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
                class="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                title="Delete prompt"
                @click.stop="confirmDelete(prompt)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
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
            </template>
          </div>
        </div>

        <!-- Prompt Preview -->
        <div class="px-5 pb-5 flex-1 flex flex-col">
          <div
            class="relative bg-muted/30 hover:bg-muted/50 transition-colors rounded-md border border-border/50 p-3 flex-1 group/code"
            :class="{ 'cursor-pointer': !isDefaultPrompt(prompt), 'cursor-default': isDefaultPrompt(prompt) }"
            @click="editPrompt(prompt)"
          >
            <div
              class="text-sm text-muted-foreground/80 font-mono line-clamp-4 leading-relaxed whitespace-pre-wrap break-words"
            >
              {{ prompt.content }}
            </div>
            <div
              class="absolute inset-0 bg-gradient-to-t from-muted/10 to-transparent opacity-0 group-hover/code:opacity-100 pointer-events-none"
            ></div>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="px-5 py-3 bg-muted/20 border-t border-border/50 flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5 opacity-70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Updated {{ getRelativeTime(prompt.updated_at) }}</span>
          </div>

          <button
            v-if="!isDefaultPrompt(prompt)"
            @click.stop="editPrompt(prompt)"
            class="text-xs font-medium text-purple-500 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
          >
            Edit
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
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
        <div class="w-20 h-20 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-10 w-10 text-purple-500"
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
        </div>
      </template>
    </EmptyState>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showDeleteDialog = false"
    >
      <div
        class="bg-card rounded-xl p-6 max-w-md w-full mx-4 border border-border shadow-xl shadow-black/10 animate-in fade-in zoom-in duration-200"
      >
        <div class="flex items-center gap-4 mb-5">
          <div class="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
          <div>
            <h2 class="text-lg font-bold text-foreground">Delete Prompt</h2>
            <p class="text-sm text-muted-foreground mt-1">This action cannot be undone.</p>
          </div>
        </div>

        <div class="bg-muted/50 rounded-lg p-3 mb-6 border border-border/50">
          <p class="text-sm text-foreground">
            Are you sure you want to delete
            <span class="font-semibold">"{{ promptToDelete?.name }}"</span>
            ?
          </p>
        </div>

        <div class="flex gap-3 justify-end">
          <button
            class="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition-colors"
            @click="showDeleteDialog = false"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-sm transition-colors"
            @click="deletePromptConfirmed"
          >
            Delete Prompt
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
    if (!isDefaultPrompt(prompt)) {
      router.push(`/prompts/${prompt.id}/edit`);
    }
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
