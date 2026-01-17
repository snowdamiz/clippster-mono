<template>
  <Transition name="modal">
    <div v-if="show" class="delete-modal__overlay" @click.self="$emit('close')">
      <Transition name="dialog" appear>
        <div v-if="show" class="delete-modal" role="dialog" aria-modal="true">
          <!-- Accent bar -->
          <div class="delete-modal__accent"></div>

          <!-- Header -->
          <div class="delete-modal__header">
            <div class="delete-modal__icon">
              <Trash2 :size="24" />
            </div>
            <h2 class="delete-modal__title">{{ title }}</h2>
          </div>

          <!-- Content -->
          <div class="delete-modal__content">
            <p class="delete-modal__message">
              {{ message }}
              <span v-if="itemName" class="delete-modal__item-name">"{{ itemName }}"</span>
              {{ suffix }}
            </p>
            <p class="delete-modal__warning">This action cannot be undone.</p>
          </div>

          <!-- Footer -->
          <div class="delete-modal__footer">
            <button @click="$emit('close')" class="delete-modal__btn delete-modal__btn--secondary">Cancel</button>
            <button @click="$emit('confirm')" class="delete-modal__btn delete-modal__btn--primary">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { Trash2 } from 'lucide-vue-next';

  interface Props {
    show: boolean;
    title?: string;
    message?: string;
    itemName?: string;
    suffix?: string;
    confirmText?: string;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'confirm'): void;
  }

  withDefaults(defineProps<Props>(), {
    title: 'Delete Item',
    message: 'Are you sure you want to delete',
    suffix: '?',
    confirmText: 'Delete',
  });

  defineEmits<Emits>();
</script>

<style scoped>
  /* ===== Overlay ===== */
  .delete-modal__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  /* ===== Dialog Container ===== */
  .delete-modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 448px;
    margin: 1rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .delete-modal__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .delete-modal__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .delete-modal__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .delete-modal__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  /* ===== Content Area ===== */
  .delete-modal__content {
    padding: 0 1.5rem 1.5rem;
    text-align: center;
  }

  .delete-modal__message {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0 0 0.5rem;
  }

  .delete-modal__item-name {
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .delete-modal__warning {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
    margin: 0;
  }

  /* ===== Footer ===== */
  .delete-modal__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .delete-modal__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .delete-modal__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .delete-modal__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .delete-modal__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .delete-modal__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .delete-modal__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
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
