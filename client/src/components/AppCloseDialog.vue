<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showCloseDialog" class="app-close-dialog__overlay" @click.self="cancelClose">
        <Transition name="dialog" appear>
          <div v-if="showCloseDialog" class="app-close-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="app-close-dialog__accent"></div>

            <!-- Header -->
            <div class="app-close-dialog__header">
              <div class="app-close-dialog__icon">
                <AlertTriangle :size="24" />
              </div>
              <h2 class="app-close-dialog__title">{{ dialogTitle }}</h2>
            </div>

            <!-- Content -->
            <div class="app-close-dialog__content">
              <!-- Downloads warning -->
              <div v-if="activeDownloadsCount > 0" class="app-close-dialog__info-box">
                <p class="app-close-dialog__info-text">
                  There {{ activeDownloadsCount === 1 ? 'is' : 'are' }}
                  <span class="app-close-dialog__highlight">{{ activeDownloadsCount }}</span>
                  active download{{ activeDownloadsCount !== 1 ? 's' : '' }} in progress.
                </p>
              </div>

              <!-- Clip generation warning -->
              <div v-if="clipGenerationInProgress" class="app-close-dialog__info-box">
                <p class="app-close-dialog__info-text">
                  <span class="app-close-dialog__highlight">Clip generation</span>
                  is currently in progress.
                </p>
                <p class="app-close-dialog__info-subtext">
                  This process requires significant time and computational resources.
                </p>
              </div>

              <!-- Combined warning message -->
              <p class="app-close-dialog__message">
                Are you sure you want to close the application? This will cancel all active operations and may lose
                partially completed work.
              </p>
              <p class="app-close-dialog__warning">This action cannot be undone.</p>
            </div>

            <!-- Footer -->
            <div class="app-close-dialog__footer">
              <button @click="cancelClose" class="app-close-dialog__btn app-close-dialog__btn--secondary">
                Cancel
              </button>
              <button @click="confirmClose" class="app-close-dialog__btn app-close-dialog__btn--primary">
                {{ confirmButtonText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { AlertTriangle } from 'lucide-vue-next';
  import { useWindowClose } from '@/composables/useWindowClose';

  const { showCloseDialog, activeDownloadsCount, clipGenerationInProgress, confirmCloseWithCleanup, cancelClose } =
    useWindowClose();

  // Computed properties for dynamic messaging
  const hasMultipleOperations = computed(() => {
    return activeDownloadsCount.value > 0 && clipGenerationInProgress.value;
  });

  const hasDownloadsOnly = computed(() => {
    return activeDownloadsCount.value > 0 && !clipGenerationInProgress.value;
  });

  const hasClipGenerationOnly = computed(() => {
    return clipGenerationInProgress.value && activeDownloadsCount.value === 0;
  });

  // Computed button text based on active operations
  const confirmButtonText = computed(() => {
    if (hasDownloadsOnly.value) {
      return activeDownloadsCount.value === 1 ? 'Close and Cancel Download' : 'Close and Cancel Downloads';
    } else if (hasClipGenerationOnly.value) {
      return 'Close and Cancel Clip Detection';
    } else if (hasMultipleOperations.value) {
      const downloadText = activeDownloadsCount.value === 1 ? 'Download' : 'Downloads';
      return `Close and Cancel ${downloadText} and Clip Detection`;
    }
    return 'Close Application';
  });

  const dialogTitle = computed(() => {
    if (hasDownloadsOnly.value) {
      return activeDownloadsCount.value === 1 ? 'Close Application?' : 'Downloads in Progress';
    } else if (hasClipGenerationOnly.value) {
      return 'Clip Detection in Progress';
    } else if (hasMultipleOperations.value) {
      return 'Operations in Progress';
    }
    return 'Close Application?';
  });

  async function confirmClose() {
    await confirmCloseWithCleanup();
  }
</script>

<style scoped>
  /* ===== Overlay ===== */
  .app-close-dialog__overlay {
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
  .app-close-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    margin: 1rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .app-close-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .app-close-dialog__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .app-close-dialog__icon {
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

  .app-close-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  /* ===== Content Area ===== */
  .app-close-dialog__content {
    padding: 0 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  /* Info Boxes */
  .app-close-dialog__info-box {
    padding: 0.875rem 1rem;
    border-radius: 8px;
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.2);
  }

  .app-close-dialog__info-text {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    line-height: 1.5;
    margin: 0;
  }

  .app-close-dialog__info-subtext {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    opacity: 0.8;
    margin: 0.375rem 0 0;
    line-height: 1.4;
  }

  .app-close-dialog__highlight {
    font-weight: 600;
    color: var(--sidebar-accent);
  }

  .app-close-dialog__message {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    text-align: center;
    margin: 0;
  }

  .app-close-dialog__warning {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
    text-align: center;
    margin: 0;
  }

  /* ===== Footer ===== */
  .app-close-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .app-close-dialog__btn {
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

  .app-close-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .app-close-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .app-close-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .app-close-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .app-close-dialog__btn--primary:hover:not(:disabled) {
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
