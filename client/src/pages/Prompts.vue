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
        class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-md flex items-center gap-2 font-medium shadow-sm transition-all active:scale-95"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Prompt
      </button>
    </template>

    <!-- Loading State -->
    <LoadingState v-if="loading" message="Loading prompts..." />

    <!-- Prompts Grid -->
    <div v-else-if="prompts.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-10">
      <div
        v-for="prompt in prompts"
        :key="prompt.id"
        class="group relative flex flex-col h-64 rounded-lg border border-border bg-card/50 hover:bg-muted/10 hover:border-foreground/20 transition-all duration-200 overflow-hidden"
        @click="editPrompt(prompt)"
      >
        <!-- Card Header -->
        <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-semibold text-lg text-foreground truncate tracking-tight" :title="prompt.name">
                {{ prompt.name }}
              </h3>
              <span
                v-if="isDefaultPrompt(prompt)"
                class="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20"
              >
                Default
              </span>
            </div>
            <p class="text-xs text-muted-foreground flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-3 w-3"
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
              Updated {{ getRelativeTime(prompt.updated_at) }}
            </p>
          </div>

          <!-- Action Menu (Visible on Hover) -->
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -mr-2">
            <button
              @click.stop="copyPrompt(prompt)"
              class="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              :class="{ 'text-green-500 hover:text-green-600': copiedId === prompt.id }"
              :title="copiedId === prompt.id ? 'Copied!' : 'Copy to clipboard'"
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
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>

            <button
              v-if="!isDefaultPrompt(prompt)"
              @click.stop="editPrompt(prompt)"
              class="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit prompt"
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
              v-if="!isDefaultPrompt(prompt)"
              @click.stop="confirmDelete(prompt)"
              class="p-2 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Delete prompt"
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
          </div>
        </div>

        <!-- Content Preview -->
        <div class="px-5 pb-5 flex-1 min-h-0 flex flex-col">
          <div
            class="relative flex-1 font-mono text-xs text-muted-foreground/80 leading-relaxed overflow-hidden select-none"
          >
            {{ prompt.content }}

            <!-- Gradient Fade -->
            <div class="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent"></div>
          </div>

          <!-- Footer Stats -->
          <div
            class="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider"
          >
            <span>{{ prompt.content.length }} Characters</span>
            <span class="group-hover:text-purple-400 transition-colors">
              {{ isDefaultPrompt(prompt) ? 'System Template' : 'Custom Template' }}
            </span>
          </div>
        </div>

        <!-- Hover Border Effect -->
        <div
          class="absolute inset-0 border-2 border-transparent group-hover:border-purple-500/10 rounded-lg pointer-events-none transition-colors duration-200"
        ></div>
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
