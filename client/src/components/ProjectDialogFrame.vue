<template>
  <Teleport to="body">
    <Transition name="project-modal">
      <div
        v-if="modelValue"
        class="project-modal__overlay"
        @click.self="!loading && emit('close')"
        @keydown.esc="!loading && emit('close')"
        tabindex="-1"
      >
        <Transition name="project-dialog" appear>
          <div
            v-if="modelValue"
            class="project-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-dialog-title"
          >
            <div class="project-modal__accent" />
            <div class="project-modal__header">
              <button
                class="project-modal__close"
                :disabled="loading"
                @click="emit('close')"
                aria-label="Close project dialog"
              >
                <X :size="18" />
              </button>
              <div class="project-modal__icon">
                <Pencil v-if="editing" :size="24" />
                <FolderPlus v-else :size="24" />
              </div>
              <h2 id="project-dialog-title" class="project-modal__title">
                {{ editing ? 'Edit Project' : 'Create Project' }}
              </h2>
              <p class="project-modal__subtitle">
                {{ editing ? 'Update project details' : 'Start a new video project' }}
              </p>
            </div>
            <slot />
            <div class="project-modal__footer">
              <button
                type="button"
                :disabled="loading"
                class="project-btn project-btn--secondary"
                @click="emit('close')"
              >
                Cancel
              </button>
              <button :disabled="loading" class="project-btn project-btn--primary" @click="emit('submit')">
                <Loader2 v-if="loading" :size="16" />
                {{ loading ? 'Saving...' : editing ? 'Update Project' : 'Create Project' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
  import { X, FolderPlus, Pencil, Loader2 } from 'lucide-vue-next';
  defineProps<{ modelValue: boolean; editing?: boolean; loading?: boolean }>();
  const emit = defineEmits<{ close: []; submit: [] }>();
</script>
<style scoped>
  /* ===== Modal Overlay ===== */
  .project-modal__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  /* ===== Modal Container ===== */
  .project-modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .project-modal__accent {
    height: 3px;
    flex-shrink: 0;
    background: linear-gradient(90deg, #06b6d4, #0ea5e9, #3b82f6);
  }

  /* ===== Header ===== */
  .project-modal__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .project-modal__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .project-modal__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .project-modal__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
    background-color: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .project-modal__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .project-modal__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Footer ===== */
  .project-modal__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.2);
  }

  /* ===== Buttons ===== */
  .project-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
  }

  .project-btn--secondary {
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text-muted);
  }

  .project-btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .project-btn--primary {
    background: linear-gradient(135deg, #06b6d4, #0ea5e9);
    color: #000;
  }

  .project-btn--primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #0891b2, #0284c7);
  }

  .project-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== Modal Animations ===== */
  .project-modal-enter-active,
  .project-modal-leave-active {
    transition: opacity 200ms ease;
  }

  .project-modal-enter-from,
  .project-modal-leave-to {
    opacity: 0;
  }

  .project-dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .project-dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .project-dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .project-dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }
</style>
