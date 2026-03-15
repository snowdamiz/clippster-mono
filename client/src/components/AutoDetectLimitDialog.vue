<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="autodetect-dialog__overlay" @click.self="$emit('close')">
        <Transition name="dialog" appear>
          <div v-if="show" class="autodetect-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="autodetect-dialog__accent"></div>

            <!-- Header -->
            <div class="autodetect-dialog__header">
              <button class="autodetect-dialog__close" @click="$emit('close')" title="Close">
                <X :size="18" />
              </button>
              <div class="autodetect-dialog__icon">
                <AlertCircle :size="24" />
              </div>
              <h2 class="autodetect-dialog__title">Auto-Detection Already Active</h2>
            </div>

            <!-- Content -->
            <div class="autodetect-dialog__content">
              <p class="autodetect-dialog__message">
                You're currently auto-detecting clips on <strong>{{ activeStreamerName }}</strong>. 
                Only one stream can use AI-powered auto-detection at a time.
              </p>
              <p class="autodetect-dialog__message">
                To auto-detect <strong>{{ requestedStreamerName }}</strong>, you'll need to stop the current 
                detection first. Alternatively, you can watch <strong>{{ requestedStreamerName }}</strong> live 
                and manually clip moments as they happen.
              </p>
            </div>

            <!-- Footer -->
            <div class="autodetect-dialog__footer">
              <button @click="$emit('close')" class="autodetect-dialog__btn autodetect-dialog__btn--primary">
                OK
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { X, AlertCircle } from 'lucide-vue-next';

  interface Props {
    show: boolean;
    activeStreamerName: string;
    requestedStreamerName: string;
  }

  interface Emits {
    (e: 'close'): void;
  }

  defineProps<Props>();
  defineEmits<Emits>();
</script>

<style scoped>
  /* ===== Overlay ===== */
  .autodetect-dialog__overlay {
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
  .autodetect-dialog {
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
  .autodetect-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, #f59e0b, rgba(245, 158, 11, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .autodetect-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .autodetect-dialog__close {
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

  .autodetect-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .autodetect-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    margin-bottom: 0.875rem;
  }

  .autodetect-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  /* ===== Content Area ===== */
  .autodetect-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .autodetect-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .autodetect-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .autodetect-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .autodetect-dialog__message {
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--sidebar-text-muted);
    margin: 0 0 1rem 0;
  }

  .autodetect-dialog__message:last-child {
    margin-bottom: 0;
  }

  .autodetect-dialog__message strong {
    color: var(--sidebar-text);
    font-weight: 600;
  }

  /* ===== Footer ===== */
  .autodetect-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .autodetect-dialog__btn {
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

  .autodetect-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .autodetect-dialog__btn--primary:hover {
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
