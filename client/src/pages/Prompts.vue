<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { getAllPrompts, deletePrompt, type Prompt } from '@/services/database';
  import { MessageSquare, Plus, Copy, Check, Pencil, Trash2, MessageCircle, Lock } from 'lucide-vue-next';
  import { useFormatters } from '@/composables/useFormatters';
  import { useToast } from '@/composables/useToast';
  import { useAuthStore } from '@/stores/auth';
  import PageLayout from '@/components/PageLayout.vue';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import PromptDialog from '@/components/PromptDialog.vue';
  import AuthModal from '@/components/AuthModal.vue';

  const { success, error } = useToast();
  const authStore = useAuthStore();
  const prompts = ref<Prompt[]>([]);
  const loading = ref(true);
  const { getRelativeTime } = useFormatters();
  const copiedId = ref<string | null>(null);
  const showDeleteDialog = ref(false);
  const promptToDelete = ref<Prompt | null>(null);

  // Prompt dialog state
  const showPromptDialog = ref(false);
  const editingPrompt = ref<Prompt | null>(null);
  const showAuthModal = ref(false);

  function openNewPromptDialog() {
    if (!authStore.isAuthenticated) {
      showAuthModal.value = true;
      return;
    }
    editingPrompt.value = null;
    showPromptDialog.value = true;
  }

  function openEditPromptDialog(prompt: Prompt) {
    editingPrompt.value = prompt;
    showPromptDialog.value = true;
  }

  function closePromptDialog() {
    showPromptDialog.value = false;
    editingPrompt.value = null;
  }

  function handlePromptSaved() {
    loadPrompts();
  }

  function isDefaultPrompt(prompt: Prompt): boolean {
    return prompt.name === 'Default Clip Detector' || 
           prompt.name === 'Gaming Stream Clip Detector' || 
           prompt.name === 'Gambling Stream Clip Detector' ||
           prompt.name === 'Breaking News & Trending Viral';
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
      setTimeout(() => {
        copiedId.value = null;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  }

  function editPrompt(prompt: Prompt) {
    // Allow viewing all prompts, system prompts will be read-only in the dialog
    openEditPromptDialog(prompt);
  }

  function confirmDelete(prompt: Prompt) {
    promptToDelete.value = prompt;
    showDeleteDialog.value = true;
  }

  function closeDeleteDialog() {
    showDeleteDialog.value = false;
    promptToDelete.value = null;
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
      closeDeleteDialog();
    }
  }

  /** Single-paragraph plain-text preview (drops markdown emphasis and blank lines). */
  function previewText(content: string): string {
    return content.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
  }

  onMounted(() => {
    loadPrompts();
  });
</script>

<template>
  <div class="prompts h-full">
    <PageLayout title="Prompts" description="Manage your AI prompts and templates" :icon="MessageSquare">
      <template #actions>
        <Button variant="primary" @click="openNewPromptDialog"><Plus /> New prompt</Button>
      </template>

      <div class="px-5 py-4">
        <!-- Loading skeleton (first load only; reloads after save/delete keep the grid) -->
        <div
          v-if="loading && !prompts.length"
          class="skeleton-group grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3"
          aria-busy="true"
        >
          <div v-for="i in 4" :key="i" class="flex flex-col gap-2 rounded-xl border border-line-subtle px-4 py-3">
            <div class="skeleton h-4 w-1/2" />
            <div class="skeleton h-3 w-1/3" />
            <div class="flex flex-col gap-1.5 pt-1">
              <div class="skeleton h-3 w-full" />
              <div class="skeleton h-3 w-full" />
              <div class="skeleton h-3 w-2/3" />
            </div>
          </div>
        </div>

        <!-- Prompts grid -->
        <div
          v-else-if="prompts.length > 0"
          class="grid animate-fade-in grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3"
        >
          <div
            v-for="prompt in prompts"
            :key="prompt.id"
            class="group flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border border-line-subtle bg-surface px-4 py-3 outline-none transition-colors hover:border-line-strong focus-visible:shadow-[var(--focus-ring)]"
            role="button"
            tabindex="0"
            @click="editPrompt(prompt)"
            @keydown.enter.self="editPrompt(prompt)"
          >
            <div class="flex min-w-0 items-start gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 items-center gap-2">
                  <h3 class="truncate text-sm font-semibold text-fg" :title="prompt.name">{{ prompt.name }}</h3>
                  <Badge v-if="isDefaultPrompt(prompt)" variant="neutral" title="System prompts are read-only">
                    <Lock />
                    System
                  </Badge>
                </div>
                <p class="mt-0.5 flex items-center gap-1.5 text-xs text-fg-subtle">
                  <span>Updated {{ getRelativeTime(prompt.updated_at) }}</span>
                  <span aria-hidden="true" class="text-fg-disabled">·</span>
                  <span class="tabular">{{ prompt.content.length.toLocaleString() }} chars</span>
                </p>
              </div>
              <div class="-mr-1 -mt-1 flex shrink-0 items-center gap-0.5">
                <template v-if="!isDefaultPrompt(prompt)">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="hidden group-focus-within:inline-flex group-hover:inline-flex"
                    title="Edit"
                    aria-label="Edit prompt"
                    @click.stop="editPrompt(prompt)"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="hidden hover:text-danger group-focus-within:inline-flex group-hover:inline-flex"
                    title="Delete"
                    aria-label="Delete prompt"
                    @click.stop="confirmDelete(prompt)"
                  >
                    <Trash2 />
                  </Button>
                </template>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :class="copiedId === prompt.id && 'text-success hover:text-success'"
                  :title="copiedId === prompt.id ? 'Copied' : 'Copy to clipboard'"
                  :aria-label="copiedId === prompt.id ? 'Copied' : 'Copy prompt'"
                  @click.stop="copyPrompt(prompt)"
                >
                  <Check v-if="copiedId === prompt.id" />
                  <Copy v-else />
                </Button>
              </div>
            </div>

            <p class="line-clamp-3 text-xs leading-5 text-fg-muted">{{ previewText(prompt.content) }}</p>
          </div>
        </div>

        <!-- Empty state -->
        <EmptyState
          v-else
          :icon="MessageCircle"
          title="No prompts yet"
          description="Create your first prompt template to get started"
        >
          <Button variant="secondary" @click="openNewPromptDialog"><Plus /> Create prompt</Button>
        </EmptyState>
      </div>
    </PageLayout>

    <ConfirmationModal
      :show="showDeleteDialog"
      title="Delete prompt"
      message="Are you sure you want to delete"
      :item-name="promptToDelete?.name"
      suffix="?"
      confirm-text="Delete prompt"
      variant="destructive"
      @close="closeDeleteDialog"
      @confirm="deletePromptConfirmed"
    />

    <PromptDialog :show="showPromptDialog" :prompt="editingPrompt" @close="closePromptDialog" @saved="handlePromptSaved" />

    <AuthModal v-model="showAuthModal" />
  </div>
</template>
