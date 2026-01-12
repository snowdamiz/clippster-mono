<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="project-dialog__overlay" @click.self="$emit('cancel')">
        <Transition name="dialog" appear>
          <div v-if="show" class="project-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="project-dialog__accent"></div>

            <!-- Header -->
            <div class="project-dialog__header">
              <button class="project-dialog__close" @click="$emit('cancel')" title="Close">
                <X :size="18" />
              </button>
              <div class="project-dialog__icon">
                <FolderOpen :size="24" />
              </div>
              <h2 class="project-dialog__title">Existing Project Found</h2>
              <p class="project-dialog__subtitle">This clip has been edited before in a video project</p>
            </div>

            <!-- Content -->
            <div class="project-dialog__content">
              <!-- Existing Project Card -->
              <div v-if="existingProject" class="project-dialog__card">
                <div class="project-dialog__card-icon">
                  <Video :size="20" />
                </div>
                <div class="project-dialog__card-info">
                  <h3 class="project-dialog__card-title">{{ existingProject.name }}</h3>
                  <p class="project-dialog__card-meta">Last modified: {{ formatDate(existingProject.updated_at) }}</p>
                  <p v-if="existingProject.total_duration > 0" class="project-dialog__card-duration">
                    Duration: {{ formatDuration(existingProject.total_duration) }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="project-dialog__footer">
              <button class="project-dialog__btn project-dialog__btn--primary" @click="$emit('open-existing')">
                <FolderOpen :size="16" />
                Open Existing Project
              </button>
              <button class="project-dialog__btn project-dialog__btn--secondary" @click="$emit('create-new')">
                <Plus :size="16" />
                Create New Project
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { X, FolderOpen, Video, Plus } from 'lucide-vue-next';
  import type { VideoEditorProject } from '@/services/database';

  interface Props {
    show: boolean;
    existingProject: VideoEditorProject | null;
  }

  interface Emits {
    (e: 'open-existing'): void;
    (e: 'create-new'): void;
    (e: 'cancel'): void;
  }

  defineProps<Props>();
  defineEmits<Emits>();

  function formatDate(timestamp: number): string {
    // Timestamp is in seconds
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>

<style scoped>
  /* ===== Overlay ===== */
  .project-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
  }

  /* ===== Dialog Container ===== */
  .project-dialog {
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
  .project-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .project-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .project-dialog__close {
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

  .project-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .project-dialog__icon {
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

  .project-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .project-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .project-dialog__content {
    padding: 0 1.5rem 1.25rem;
  }

  /* ===== Project Card ===== */
  .project-dialog__card {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .project-dialog__card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background-color: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }

  .project-dialog__card-info {
    flex: 1;
    min-width: 0;
  }

  .project-dialog__card-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .project-dialog__card-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .project-dialog__card-duration {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
    margin: 0.125rem 0 0;
  }

  /* ===== Footer ===== */
  .project-dialog__footer {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .project-dialog__btn {
    width: 100%;
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
    white-space: nowrap;
  }

  .project-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .project-dialog__btn--secondary:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .project-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .project-dialog__btn--primary:hover {
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
