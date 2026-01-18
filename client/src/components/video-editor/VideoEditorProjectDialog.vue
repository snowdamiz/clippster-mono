<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="videoeditor-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="videoeditor-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="videoeditor-dialog__accent"></div>

            <!-- Header -->
            <div class="videoeditor-dialog__header">
              <button class="videoeditor-dialog__close" @click="close" title="Close">
                <X :size="18" />
              </button>
              <div class="videoeditor-dialog__icon">
                <Clapperboard v-if="!project" :size="24" />
                <Pencil v-else :size="24" />
              </div>
              <h2 class="videoeditor-dialog__title">{{ project ? 'Edit Project' : 'New Video Project' }}</h2>
              <p class="videoeditor-dialog__subtitle">
                {{ project ? 'Update your project details' : 'Create a new video editing project' }}
              </p>
            </div>

            <!-- Content -->
            <div class="videoeditor-dialog__content">
              <form @submit.prevent="handleSubmit" class="videoeditor-dialog__form">
                <!-- Project Name -->
                <div class="videoeditor-dialog__field">
                  <label for="project-name" class="videoeditor-dialog__label">Project Name *</label>
                  <input
                    id="project-name"
                    v-model="name"
                    type="text"
                    required
                    placeholder="Enter project name"
                    class="videoeditor-dialog__input"
                    :class="{ 'videoeditor-dialog__input--error': !name.trim() && hasAttemptedSubmit }"
                  />
                  <p v-if="!name.trim() && hasAttemptedSubmit" class="videoeditor-dialog__error">
                    Project name is required
                  </p>
                </div>

                <!-- Description -->
                <div class="videoeditor-dialog__field">
                  <label for="project-description" class="videoeditor-dialog__label">
                    Description
                    <span class="videoeditor-dialog__label-hint">(optional)</span>
                  </label>
                  <textarea
                    id="project-description"
                    v-model="description"
                    rows="3"
                    placeholder="Enter project description"
                    class="videoeditor-dialog__input videoeditor-dialog__textarea"
                  />
                </div>
              </form>
            </div>

            <!-- Footer -->
            <div class="videoeditor-dialog__footer">
              <button @click="close" class="videoeditor-dialog__btn videoeditor-dialog__btn--secondary">Cancel</button>
              <button
                @click="handleSubmit"
                :disabled="!name.trim()"
                class="videoeditor-dialog__btn videoeditor-dialog__btn--primary"
              >
                {{ project ? 'Save Changes' : 'Create Project' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Clapperboard, Pencil, X } from 'lucide-vue-next';
  import type { VideoEditorProject } from '@/types';

  const props = defineProps<{
    modelValue: boolean;
    project?: VideoEditorProject | null;
  }>();

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'submit', data: { name: string; description?: string }): void;
  }>();

  const name = ref('');
  const description = ref('');
  const hasAttemptedSubmit = ref(false);

  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        hasAttemptedSubmit.value = false;
        // Populate form if editing
        if (props.project) {
          name.value = props.project.name;
          description.value = props.project.description || '';
        } else {
          name.value = '';
          description.value = '';
        }
      }
    }
  );

  function close() {
    emit('update:modelValue', false);
  }

  function handleSubmit() {
    hasAttemptedSubmit.value = true;
    if (!name.value.trim()) return;

    emit('submit', {
      name: name.value.trim(),
      description: description.value.trim() || undefined,
    });
    close();
  }
</script>

<style scoped>
  /* ===== Overlay ===== */
  .videoeditor-dialog__overlay {
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
  .videoeditor-dialog {
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
  .videoeditor-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .videoeditor-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .videoeditor-dialog__close {
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

  .videoeditor-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .videoeditor-dialog__icon {
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

  .videoeditor-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .videoeditor-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .videoeditor-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .videoeditor-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .videoeditor-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .videoeditor-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Form ===== */
  .videoeditor-dialog__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ===== Form Field ===== */
  .videoeditor-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .videoeditor-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .videoeditor-dialog__label-hint {
    color: var(--sidebar-text-muted);
    font-weight: 400;
    font-size: 0.8125rem;
  }

  .videoeditor-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .videoeditor-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .videoeditor-dialog__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .videoeditor-dialog__input--error {
    border-color: rgba(239, 68, 68, 0.5);
  }

  .videoeditor-dialog__input--error:focus {
    border-color: rgba(239, 68, 68, 0.5);
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
  }

  .videoeditor-dialog__textarea {
    resize: none;
    min-height: 80px;
  }

  .videoeditor-dialog__error {
    font-size: 0.8125rem;
    color: #f87171;
    margin: 0;
  }

  /* ===== Footer ===== */
  .videoeditor-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .videoeditor-dialog__btn {
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

  .videoeditor-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .videoeditor-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .videoeditor-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .videoeditor-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: #000;
  }

  .videoeditor-dialog__btn--primary:hover:not(:disabled) {
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
