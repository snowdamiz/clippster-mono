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
    <div v-else-if="prompts.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
      <div
        v-for="prompt in prompts"
        :key="prompt.id"
        class="group relative flex flex-col h-[340px] rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 overflow-hidden cursor-pointer"
        @click="editPrompt(prompt)"
      >
        <div class="flex flex-col h-full p-5">
          <!-- Header -->
          <div class="flex items-start justify-between mb-4">
            <div class="min-w-0 pr-4">
              <div class="flex items-center gap-2 mb-1.5">
                <h3 class="font-semibold text-base text-foreground truncate tracking-tight" :title="prompt.name">
                  {{ prompt.name }}
                </h3>
                <!-- System Badge -->
                <div
                  v-if="isDefaultPrompt(prompt)"
                  class="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-wide"
                  title="System Prompt"
                >
                  <Shield class="w-3 h-3" />
                  <span>System</span>
                </div>
              </div>
              <p class="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock class="w-3 h-3" />
                Updated {{ getRelativeTime(prompt.updated_at) }}
              </p>
            </div>

            <!-- Copy Button -->
            <button
              @click.stop="copyPrompt(prompt)"
              class="shrink-0 p-2 -mr-2 -mt-2 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
              :class="{ 'text-green-500 hover:text-green-600 bg-green-500/10': copiedId === prompt.id }"
              :title="copiedId === prompt.id ? 'Copied!' : 'Copy to clipboard'"
            >
              <Copy v-if="copiedId !== prompt.id" class="h-4 w-4" />
              <Check v-else class="h-4 w-4" />
            </button>
          </div>

          <!-- Content Preview Window -->
          <div
            class="flex-1 relative rounded-lg border border-border/50 bg-muted/20 overflow-hidden group-hover:bg-muted/30 transition-colors flex flex-col"
          >
            <!-- Window Toolbar -->
            <div class="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
              <div class="flex items-center gap-2">
                <div class="flex gap-1.5">
                  <div class="w-2 h-2 rounded-full bg-border/60"></div>
                  <div class="w-2 h-2 rounded-full bg-border/60"></div>
                </div>
                <div class="h-3 w-px bg-border/50 ml-1"></div>
                <Terminal class="w-3 h-3 text-muted-foreground/50" />
              </div>
              <div class="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                {{ prompt.content.length }} chars
              </div>
            </div>

            <!-- Text Content -->
            <div
              class="flex-1 p-3 font-mono text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-wrap overflow-hidden relative"
            >
              {{ prompt.content }}

              <!-- Bottom Fade -->
              <div
                class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-muted/50 to-transparent pointer-events-none"
              ></div>
            </div>
          </div>

          <!-- Hover Actions Overlay -->
          <div class="absolute bottom-6 right-6 z-10">
            <div
              class="flex items-center gap-1 p-1 rounded-lg bg-background/95 backdrop-blur border border-border shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200"
            >
              <template v-if="!isDefaultPrompt(prompt)">
                <button
                  @click.stop="editPrompt(prompt)"
                  class="p-2 rounded-md hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
                  title="Edit"
                >
                  <Edit class="h-4 w-4" />
                </button>
                <div class="w-px h-3 bg-border mx-0.5"></div>
                <button
                  @click.stop="confirmDelete(prompt)"
                  class="p-2 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                  title="Delete"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </template>
              <span
                v-else
                class="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider select-none"
              >
                Read Only
              </span>
            </div>
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
  import {
    MessageSquare,
    Plus,
    Clock,
    Copy,
    Check,
    Edit,
    Trash2,
    MessageCircle,
    Shield,
    Terminal,
  } from 'lucide-vue-next';
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
