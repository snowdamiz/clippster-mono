<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="confirm-dialog__overlay" @click.self="$emit('close')">
        <Transition name="dialog" appear>
          <div v-if="show" class="confirm-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="confirm-dialog__accent" :class="accentClass"></div>

            <!-- Header -->
            <div class="confirm-dialog__header">
              <button class="confirm-dialog__close" @click="$emit('close')" title="Close">
                <X :size="18" />
              </button>
              <div class="confirm-dialog__icon" :class="iconClass">
                <AlertTriangle v-if="variant === 'destructive'" :size="24" />
                <component v-else :is="icon" :size="24" />
              </div>
              <h2 class="confirm-dialog__title">{{ title }}</h2>
              <p v-if="subtitle" class="confirm-dialog__subtitle">{{ subtitle }}</p>
            </div>

            <!-- Content -->
            <div class="confirm-dialog__content">
              <p class="confirm-dialog__message">
                {{ message }}
                <span v-if="itemName" class="confirm-dialog__item-name">"{{ itemName }}"</span>
                {{ suffix }}
              </p>
              <p v-if="showCannotUndoneText" class="confirm-dialog__warning">This action cannot be undone.</p>
            </div>

            <!-- Footer -->
            <div class="confirm-dialog__footer">
              <!-- Single button mode (for warnings/errors) -->
              <template v-if="showOnlyCloseButton">
                <button
                  class="confirm-dialog__btn confirm-dialog__btn--primary"
                  :class="buttonClass"
                  @click="$emit('close')"
                >
                  {{ closeText }}
                </button>
              </template>

              <!-- Two button mode (for confirmations) -->
              <template v-else>
                <button class="confirm-dialog__btn confirm-dialog__btn--secondary" @click="$emit('close')">
                  {{ closeText }}
                </button>
                <button
                  class="confirm-dialog__btn confirm-dialog__btn--primary"
                  :class="buttonClass"
                  @click="$emit('confirm')"
                >
                  {{ confirmText }}
                </button>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed, type Component } from 'vue';
  import { AlertTriangle, HelpCircle, X } from 'lucide-vue-next';

  interface Props {
    show: boolean;
    title?: string;
    subtitle?: string;
    message?: string;
    itemName?: string;
    suffix?: string;
    confirmText?: string;
    closeText?: string;
    showOnlyCloseButton?: boolean;
    showCannotUndoneText?: boolean;
    variant?: 'default' | 'destructive';
    icon?: Component;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'confirm'): void;
  }

  const props = withDefaults(defineProps<Props>(), {
    title: 'Confirm Action',
    message: 'Are you sure you want to',
    suffix: '?',
    confirmText: 'Confirm',
    closeText: 'Cancel',
    showOnlyCloseButton: false,
    showCannotUndoneText: true,
    variant: 'default',
    icon: () => HelpCircle,
  });

  defineEmits<Emits>();

  const accentClass = computed(() => ({
    'confirm-dialog__accent--destructive': props.variant === 'destructive',
  }));

  const iconClass = computed(() => ({
    'confirm-dialog__icon--destructive': props.variant === 'destructive',
  }));

  const buttonClass = computed(() => ({
    'confirm-dialog__btn--destructive': props.variant === 'destructive',
  }));
</script>

<style scoped>
  /* ===== Overlay ===== */
  .confirm-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  /* ===== Dialog Container ===== */
  .confirm-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 420px;
    margin: 1rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .confirm-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  .confirm-dialog__accent--destructive {
    background: linear-gradient(90deg, #ef4444, rgba(239, 68, 68, 0.5));
  }

  /* ===== Header ===== */
  .confirm-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .confirm-dialog__close {
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

  .confirm-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .confirm-dialog__icon {
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

  .confirm-dialog__icon--destructive {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .confirm-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .confirm-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .confirm-dialog__content {
    padding: 0.5rem 1.5rem 1.5rem;
    text-align: center;
  }

  .confirm-dialog__message {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.6;
  }

  .confirm-dialog__item-name {
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .confirm-dialog__warning {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.75rem 0 0;
    opacity: 0.7;
  }

  /* ===== Footer ===== */
  .confirm-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .confirm-dialog__btn {
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

  .confirm-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .confirm-dialog__btn--secondary:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .confirm-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: #000;
  }

  .confirm-dialog__btn--primary:hover {
    opacity: 0.9;
  }

  .confirm-dialog__btn--destructive {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
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
