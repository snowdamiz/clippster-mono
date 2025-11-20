<template>
  <PageLayout
    title="Prompts"
    description="Manage your AI prompts and templates"
    :show-header="!loading && prompts.length > 0"
    :icon="MessageSquare"
  >
    <template #actions>
      <button
        @click="navigateToNew"
        class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-md flex items-center gap-2 font-medium shadow-sm transition-all active:scale-95"
      >
        <Plus class="h-5 w-5" />
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
              <Clock class="h-3 w-3" />
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
              <Copy v-if="copiedId !== prompt.id" class="h-4 w-4" />
              <Check v-else class="h-4 w-4" />
            </button>

            <button
              v-if="!isDefaultPrompt(prompt)"
              @click.stop="editPrompt(prompt)"
              class="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit prompt"
            >
              <Edit class="h-4 w-4" />
            </button>

            <button
              v-if="!isDefaultPrompt(prompt)"
              @click.stop="confirmDelete(prompt)"
              class="p-2 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Delete prompt"
            >
              <Trash2 class="h-4 w-4" />
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
          <MessageCircle class="h-10 w-10 text-purple-500" />
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
            <Trash2 class="h-6 w-6" />
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
  import { MessageSquare, Plus, Clock, Copy, Check, Edit, Trash2, MessageCircle } from 'lucide-vue-next';
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
