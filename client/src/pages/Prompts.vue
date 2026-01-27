<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { getAllPrompts, deletePrompt, type Prompt } from '@/services/database';
  import {
    MessageSquare,
    Plus,
    Clock,
    Copy,
    Check,
    Pencil,
    Trash2,
    MessageCircle,
    Shield,
    Terminal,
    X,
  } from 'lucide-vue-next';
  import { useFormatters } from '@/composables/useFormatters';
  import { useToast } from '@/composables/useToast';
  import { useAuthStore } from '@/stores/auth';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
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
      setTimeout(() => {
        copiedId.value = null;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  }

  function editPrompt(prompt: Prompt) {
    if (!isDefaultPrompt(prompt)) {
      openEditPromptDialog(prompt);
    }
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

  onMounted(() => {
    loadPrompts();
  });
</script>

<template>
  <div class="prompts">
    <PageLayout
      title="Prompts"
      description="Manage your AI prompts and templates"
      :show-header="true"
      :icon="MessageSquare"
    >
      <template #actions>
        <button @click="openNewPromptDialog" class="prompts__new-btn">
          <Plus class="prompts__new-btn-icon" />
          New Prompt
        </button>
      </template>

      <div class="prompts__content">
        <!-- Page Heading -->
        <div class="prompts__heading">
          <h1 class="prompts__title">Your Prompts</h1>
          <p class="prompts__subtitle">Create and manage AI prompt templates for clip detection</p>
        </div>

        <!-- Loading Skeleton -->
        <template v-if="loading">
          <div class="prompts__grid">
            <div v-for="i in 4" :key="i" class="prompts-card prompts-card--skeleton">
              <div class="prompts-card__indicator"></div>
              <div class="prompts-card__inner">
                <div class="prompts-card__header">
                  <div class="prompts-skeleton__icon"></div>
                  <div class="prompts-skeleton__content">
                    <div class="prompts-skeleton__line prompts-skeleton__line--name"></div>
                    <div class="prompts-skeleton__line prompts-skeleton__line--meta"></div>
                  </div>
                </div>
                <div class="prompts-card__body">
                  <div class="prompts-skeleton__preview">
                    <div class="prompts-skeleton__toolbar"></div>
                    <div class="prompts-skeleton__text">
                      <div class="prompts-skeleton__line prompts-skeleton__line--full"></div>
                      <div class="prompts-skeleton__line prompts-skeleton__line--full"></div>
                      <div class="prompts-skeleton__line prompts-skeleton__line--partial"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Prompts Grid -->
        <template v-else-if="prompts.length > 0">
          <div class="prompts__grid">
            <div
              v-for="prompt in prompts"
              :key="prompt.id"
              class="prompts-card"
              :class="{
                'prompts-card--system': isDefaultPrompt(prompt),
                'prompts-card--clickable': !isDefaultPrompt(prompt),
              }"
              @click="editPrompt(prompt)"
            >
              <div
                class="prompts-card__indicator"
                :class="{ 'prompts-card__indicator--system': isDefaultPrompt(prompt) }"
              ></div>
              <div class="prompts-card__inner">
                <!-- Card Header -->
                <div class="prompts-card__header">
                  <div class="prompts-card__header-left">
                    <div class="prompts-card__icon" :class="{ 'prompts-card__icon--system': isDefaultPrompt(prompt) }">
                      <MessageSquare />
                    </div>
                    <div class="prompts-card__header-text">
                      <div class="prompts-card__title-row">
                        <h3 class="prompts-card__name" :title="prompt.name">{{ prompt.name }}</h3>
                        <span v-if="isDefaultPrompt(prompt)" class="prompts-card__badge">
                          <Shield class="prompts-card__badge-icon" />
                          System
                        </span>
                      </div>
                      <p class="prompts-card__meta">
                        <Clock class="prompts-card__meta-icon" />
                        Updated {{ getRelativeTime(prompt.updated_at) }}
                      </p>
                    </div>
                  </div>
                  <div class="prompts-card__header-actions">
                    <button
                      @click.stop="copyPrompt(prompt)"
                      class="prompts-card__action-btn"
                      :class="{ 'prompts-card__action-btn--copied': copiedId === prompt.id }"
                      :title="copiedId === prompt.id ? 'Copied!' : 'Copy to clipboard'"
                    >
                      <Check v-if="copiedId === prompt.id" class="prompts-card__action-icon" />
                      <Copy v-else class="prompts-card__action-icon" />
                    </button>
                  </div>
                </div>

                <!-- Card Body - Preview Window -->
                <div class="prompts-card__body">
                  <div class="prompts-card__preview">
                    <!-- Preview Toolbar -->
                    <div class="prompts-card__preview-toolbar">
                      <div class="prompts-card__preview-dots">
                        <span class="prompts-card__preview-dot"></span>
                        <span class="prompts-card__preview-dot"></span>
                      </div>
                      <div class="prompts-card__preview-divider"></div>
                      <Terminal class="prompts-card__preview-terminal" />
                      <span class="prompts-card__preview-chars">{{ prompt.content.length }} chars</span>
                    </div>
                    <!-- Preview Content -->
                    <div class="prompts-card__preview-content">
                      <pre class="prompts-card__preview-text">{{ prompt.content }}</pre>
                      <div class="prompts-card__preview-fade"></div>
                    </div>
                  </div>
                </div>

                <!-- Hover Actions -->
                <div class="prompts-card__hover-actions">
                  <div class="prompts-card__hover-panel">
                    <template v-if="!isDefaultPrompt(prompt)">
                      <button @click.stop="editPrompt(prompt)" class="prompts-card__hover-btn" title="Edit">
                        <Pencil class="prompts-card__hover-icon" />
                      </button>
                      <div class="prompts-card__hover-divider"></div>
                      <button
                        @click.stop="confirmDelete(prompt)"
                        class="prompts-card__hover-btn prompts-card__hover-btn--danger"
                        title="Delete"
                      >
                        <Trash2 class="prompts-card__hover-icon" />
                      </button>
                    </template>
                    <span v-else class="prompts-card__hover-readonly">Read Only</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Empty State -->
        <EmptyState v-else title="No prompts yet" description="Create your first prompt template to get started">
          <template #icon>
            <div class="prompts__empty-icon">
              <MessageCircle />
            </div>
          </template>
          <template #action>
            <button @click="openNewPromptDialog" class="prompts__empty-btn">
              <Plus class="prompts__empty-btn-icon" />
              Create Prompt
            </button>
          </template>
        </EmptyState>
      </div>
    </PageLayout>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteDialog" class="prompts-modal__overlay" @click.self="closeDeleteDialog">
          <Transition name="dialog" appear>
            <div class="prompts-modal">
              <div class="prompts-modal__accent prompts-modal__accent--danger"></div>

              <!-- Header -->
              <div class="prompts-modal__header">
                <div class="prompts-modal__header-left">
                  <div class="prompts-modal__icon prompts-modal__icon--danger">
                    <Trash2 />
                  </div>
                  <h2 class="prompts-modal__title">Delete Prompt</h2>
                </div>
                <button @click="closeDeleteDialog" class="prompts-modal__close">
                  <X />
                </button>
              </div>

              <!-- Body -->
              <div class="prompts-modal__body">
                <p class="prompts-modal__text">
                  Are you sure you want to delete
                  <strong>"{{ promptToDelete?.name }}"</strong>
                  ?
                </p>
                <p class="prompts-modal__subtext">This action cannot be undone.</p>
              </div>

              <!-- Footer -->
              <div class="prompts-modal__footer">
                <button @click="closeDeleteDialog" class="prompts-modal__btn prompts-modal__btn--secondary">
                  Cancel
                </button>
                <button @click="deletePromptConfirmed" class="prompts-modal__btn prompts-modal__btn--danger">
                  Delete Prompt
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Prompt Dialog -->
    <PromptDialog
      :show="showPromptDialog"
      :prompt="editingPrompt"
      @close="closePromptDialog"
      @saved="handlePromptSaved"
    />

    <!-- Auth Modal -->
    <AuthModal v-model="showAuthModal" />
  </div>
</template>

<style scoped>
  /* ===== Page Container ===== */
  .prompts {
    width: 100%;
    min-height: 100%;
  }

  .prompts__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    padding-bottom: 2rem;
    width: 100%;
  }

  /* ===== Page Heading ===== */
  .prompts__heading {
    margin-bottom: 0.5rem;
  }

  .prompts__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .prompts__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== New Prompt Button ===== */
  .prompts__new-btn {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 0.75rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .prompts__new-btn:hover {
    opacity: 0.9;
  }

  .prompts__new-btn-icon {
    width: 14px;
    height: 14px;
    margin-right: 0.25rem;
  }

  /* ===== Prompts Grid ===== */
  .prompts__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1.25rem;
  }

  @media (min-width: 768px) {
    .prompts__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1400px) {
    .prompts__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 1800px) {
    .prompts__grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 2200px) {
    .prompts__grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  /* ===== Prompt Card ===== */
  .prompts-card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
    height: 280px;
  }

  .prompts-card--clickable {
    cursor: pointer;
  }

  .prompts-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .prompts-card--system:hover {
    border-color: rgba(6, 182, 212, 0.3);
  }

  .prompts-card__indicator {
    width: 4px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .prompts-card__indicator--system {
    background-color: var(--sidebar-accent);
  }

  .prompts-card__inner {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Card Header */
  .prompts-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.875rem;
    padding: 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .prompts-card__header-left {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    min-width: 0;
  }

  .prompts-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .prompts-card__icon svg {
    width: 20px;
    height: 20px;
  }

  .prompts-card__icon--system {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .prompts-card__header-text {
    flex: 1;
    min-width: 0;
  }

  .prompts-card__title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .prompts-card__name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prompts-card__badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.1875rem 0.5rem;
    background-color: rgba(6, 182, 212, 0.15);
    border: 1px solid rgba(6, 182, 212, 0.25);
    border-radius: 12px;
    font-size: 0.5625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .prompts-card__badge-icon {
    width: 10px;
    height: 10px;
  }

  .prompts-card__meta {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .prompts-card__meta-icon {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  .prompts-card__header-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .prompts-card__action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .prompts-card__action-btn:hover {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .prompts-card__action-btn--copied {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .prompts-card__action-btn--copied:hover {
    background-color: rgba(16, 185, 129, 0.25);
    color: #34d399;
  }

  .prompts-card__action-icon {
    width: 14px;
    height: 14px;
  }

  /* Card Body */
  .prompts-card__body {
    flex: 1;
    padding: 1.25rem;
    overflow: hidden;
  }

  .prompts-card__preview {
    height: 100%;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    overflow: hidden;
    background-color: rgba(0, 0, 0, 0.15);
  }

  .prompts-card__preview-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    border-bottom: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.1);
  }

  .prompts-card__preview-dots {
    display: flex;
    gap: 0.375rem;
  }

  .prompts-card__preview-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--sidebar-border);
  }

  .prompts-card__preview-divider {
    width: 1px;
    height: 12px;
    background-color: var(--sidebar-border);
    margin-left: 0.25rem;
  }

  .prompts-card__preview-terminal {
    width: 12px;
    height: 12px;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .prompts-card__preview-chars {
    margin-left: auto;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .prompts-card__preview-content {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .prompts-card__preview-text {
    padding: 0.875rem;
    font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
    font-size: 0.6875rem;
    line-height: 1.6;
    color: var(--sidebar-text-muted);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    overflow: hidden;
  }

  .prompts-card__preview-fade {
    position: absolute;
    inset: auto 0 0 0;
    height: 48px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.3), transparent);
    pointer-events: none;
  }

  /* Hover Actions */
  .prompts-card__hover-actions {
    position: absolute;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 10;
  }

  .prompts-card__hover-panel {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    opacity: 0;
    transform: translateY(8px);
    transition: all 200ms ease;
  }

  .prompts-card:hover .prompts-card__hover-panel {
    opacity: 1;
    transform: translateY(0);
  }

  .prompts-card__hover-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    color: var(--sidebar-text-muted);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .prompts-card__hover-btn:hover {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .prompts-card__hover-btn--danger:hover {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .prompts-card__hover-icon {
    width: 16px;
    height: 16px;
  }

  .prompts-card__hover-divider {
    width: 1px;
    height: 16px;
    background-color: var(--sidebar-border);
    margin: 0 0.125rem;
  }

  .prompts-card__hover-readonly {
    padding: 0.5rem 0.75rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sidebar-text-muted);
  }

  /* ===== Empty State ===== */
  .prompts__empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    color: var(--sidebar-text-muted);
  }

  .prompts__empty-icon svg {
    width: 32px;
    height: 32px;
  }

  .prompts__empty-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .prompts__empty-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .prompts__empty-btn-icon {
    width: 18px;
    height: 18px;
  }

  /* ===== Skeleton Loading ===== */
  .prompts-card--skeleton {
    pointer-events: none;
  }

  .prompts-skeleton__icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .prompts-skeleton__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.25rem;
  }

  .prompts-skeleton__line {
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .prompts-skeleton__line--name {
    height: 16px;
    width: 60%;
  }

  .prompts-skeleton__line--meta {
    height: 12px;
    width: 40%;
  }

  .prompts-skeleton__line--full {
    height: 10px;
    width: 100%;
  }

  .prompts-skeleton__line--partial {
    height: 10px;
    width: 70%;
  }

  .prompts-skeleton__preview {
    height: 100%;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    overflow: hidden;
  }

  .prompts-skeleton__toolbar {
    height: 36px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .prompts-skeleton__text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0.875rem;
  }

  /* ===== Modal ===== */
  .prompts-modal__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  .prompts-modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 400px;
    margin: 1rem;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .prompts-modal__accent {
    height: 3px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7);
  }

  .prompts-modal__accent--danger {
    background: linear-gradient(90deg, #ef4444, #f43f5e, #ec4899);
  }

  .prompts-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .prompts-modal__header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .prompts-modal__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background-color: rgba(99, 102, 241, 0.15);
    color: #818cf8;
    border-radius: 10px;
  }

  .prompts-modal__icon svg {
    width: 20px;
    height: 20px;
  }

  .prompts-modal__icon--danger {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .prompts-modal__title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .prompts-modal__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    color: var(--sidebar-text-muted);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .prompts-modal__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .prompts-modal__close svg {
    width: 18px;
    height: 18px;
  }

  .prompts-modal__body {
    padding: 1.25rem;
  }

  .prompts-modal__text {
    font-size: 0.875rem;
    color: var(--sidebar-text);
    line-height: 1.6;
    margin: 0 0 0.5rem;
  }

  .prompts-modal__text strong {
    color: var(--sidebar-text);
    font-weight: 600;
  }

  .prompts-modal__subtext {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .prompts-modal__footer {
    display: flex;
    gap: 0.75rem;
    padding: 1.25rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .prompts-modal__btn {
    flex: 1;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .prompts-modal__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .prompts-modal__btn--secondary:hover {
    background-color: var(--sidebar-active);
  }

  .prompts-modal__btn--danger {
    background: linear-gradient(135deg, #ef4444 0%, #f43f5e 100%);
    color: white;
  }

  .prompts-modal__btn--danger:hover {
    opacity: 0.9;
  }

  /* ===== Animations ===== */
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  /* Modal Transitions */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.15s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }
</style>
