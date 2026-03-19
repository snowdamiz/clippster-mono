<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="realtime-dialog-overlay" @click="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="realtime-dialog" @click.stop role="dialog" aria-modal="true">
            <!-- Header -->
            <div class="realtime-dialog__header">
              <div class="realtime-dialog__header-left">
                <Sparkles class="realtime-dialog__icon" />
                <h2 class="realtime-dialog__title">Real-Time Clip Detection</h2>
              </div>
              <button class="realtime-dialog__close" @click="close" title="Close (Esc)">
                <X :size="16" />
              </button>
            </div>

            <!-- Content -->
            <div class="realtime-dialog__content">
              <!-- Prompt Selection -->
              <div class="realtime-dialog__field">
                <label class="realtime-dialog__label">Detection Prompt</label>
                <div class="relative">
                  <button
                    @click="showPromptDropdown = !showPromptDropdown"
                    class="realtime-dialog__input realtime-dialog__select"
                  >
                    <span class="truncate">
                      {{ selectedPromptName || 'Default (Viral Moments)' }}
                    </span>
                    <ChevronDown
                      class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform"
                      :class="{ 'rotate-180': showPromptDropdown }"
                    />
                  </button>

                  <!-- Dropdown -->
                  <div v-if="showPromptDropdown" class="realtime-dialog__dropdown">
                    <button
                      @click="selectPrompt(null)"
                      class="realtime-dialog__dropdown-item"
                      :class="{ 'realtime-dialog__dropdown-item--selected': !selectedPromptId }"
                    >
                      Default (Viral Moments)
                    </button>
                    <button
                      v-for="prompt in prompts"
                      :key="prompt.id"
                      @click="selectPrompt(prompt)"
                      class="realtime-dialog__dropdown-item"
                      :class="{ 'realtime-dialog__dropdown-item--selected': selectedPromptId === prompt.id }"
                    >
                      {{ prompt.name }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Cost Warning -->
              <div class="realtime-dialog__warning">
                <div class="realtime-dialog__warning-icon">
                  <AlertCircle :size="20" />
                </div>
                <div class="realtime-dialog__warning-content">
                  <h3 class="realtime-dialog__warning-title">Cost: 1 Credit Per Minute</h3>
                  <p class="realtime-dialog__warning-text">
                    Real-time detection runs continuously and costs <strong>1 credit per minute</strong>.
                    Detection will only stop when you manually click "Stop" or the stream ends.
                  </p>
                  <p class="realtime-dialog__warning-estimate" v-if="estimatedCost > 0">
                    Estimated cost for 1 hour: <strong>{{ estimatedCost }} credits</strong>
                  </p>
                </div>
              </div>

              <!-- How It Works -->
              <div class="realtime-dialog__info">
                <h4 class="realtime-dialog__info-title">How It Works</h4>
                <ul class="realtime-dialog__info-list">
                  <li>AI analyzes the stream in real-time every 30 seconds</li>
                  <li>Clips appear in Projects within 1-2 minutes of detection</li>
                  <li>You can review, edit, and build clips at any time</li>
                  <li>Detection runs until you stop it or the stream ends</li>
                </ul>
              </div>
            </div>

            <!-- Footer -->
            <div class="realtime-dialog__footer">
              <button @click="close" class="realtime-dialog__btn realtime-dialog__btn--secondary">
                Cancel
              </button>
              <button @click="confirm" class="realtime-dialog__btn realtime-dialog__btn--primary">
                <Sparkles :size="16" />
                Start Detection
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { X, Sparkles, AlertCircle, ChevronDown } from 'lucide-vue-next';

  interface Prompt {
    id: string;
    name: string;
    content: string;
  }

  interface Props {
    modelValue: boolean;
    prompts?: Prompt[];
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void;
    (e: 'confirm', data: { promptId: string; promptContent: string }): void;
  }

  const props = withDefaults(defineProps<Props>(), {
    prompts: () => [],
  });

  const emit = defineEmits<Emits>();

  const selectedPromptId = ref('');
  const selectedPromptName = ref('');
  const showPromptDropdown = ref(false);
  const estimatedCost = computed(() => 60); // 1 hour = 60 credits

  watch(
    () => props.modelValue,
    (newValue) => {
      if (newValue) {
        selectedPromptId.value = '';
        selectedPromptName.value = '';
        showPromptDropdown.value = false;
      }
    }
  );

  function selectPrompt(prompt: Prompt | null) {
    if (prompt) {
      selectedPromptId.value = prompt.id;
      selectedPromptName.value = prompt.name;
    } else {
      selectedPromptId.value = '';
      selectedPromptName.value = '';
    }
    showPromptDropdown.value = false;
  }

  function close() {
    emit('update:modelValue', false);
  }

  function confirm() {
    const selectedPrompt = props.prompts.find((p) => p.id === selectedPromptId.value);
    emit('confirm', {
      promptId: selectedPromptId.value,
      promptContent: selectedPrompt?.content || '',
    });
    close();
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      showPromptDropdown.value = false;
    }
  }

  // Close on Escape key
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && props.modelValue) {
      close();
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<style scoped>
  .realtime-dialog-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }

  .realtime-dialog {
    background-color: var(--sidebar-bg);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .realtime-dialog__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .realtime-dialog__header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .realtime-dialog__icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-accent);
  }

  .realtime-dialog__title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .realtime-dialog__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background-color: transparent;
    border: none;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .realtime-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .realtime-dialog__content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .realtime-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .realtime-dialog__label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .realtime-dialog__hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .realtime-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .realtime-dialog__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .realtime-dialog__select {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .realtime-dialog__select:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  /* ===== Dropdown ===== */
  .realtime-dialog__dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    overflow: hidden;
    z-index: 10;
    max-height: 12rem;
    overflow-y: auto;
  }

  .realtime-dialog__dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .realtime-dialog__dropdown::-webkit-scrollbar-track {
    background: transparent;
  }

  .realtime-dialog__dropdown::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .realtime-dialog__dropdown-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.625rem 0.75rem;
    border-radius: 5px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    transition: background-color 150ms ease;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .realtime-dialog__dropdown-item:hover {
    background-color: var(--sidebar-hover);
  }

  .realtime-dialog__dropdown-item--selected {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .realtime-dialog__warning {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background-color: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: 8px;
  }

  .realtime-dialog__warning-icon {
    flex-shrink: 0;
    color: #fbbf24;
  }

  .realtime-dialog__warning-content {
    flex: 1;
  }

  .realtime-dialog__warning-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #fbbf24;
    margin: 0 0 0.5rem 0;
  }

  .realtime-dialog__warning-text {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem 0;
    line-height: 1.5;
  }

  .realtime-dialog__warning-estimate {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .realtime-dialog__info {
    padding: 1rem;
    background-color: rgba(6, 182, 212, 0.05);
    border: 1px solid rgba(6, 182, 212, 0.2);
    border-radius: 8px;
  }

  .realtime-dialog__info-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.75rem 0;
  }

  .realtime-dialog__info-list {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.6;
  }

  .realtime-dialog__info-list li {
    margin-bottom: 0.375rem;
  }

  .realtime-dialog__info-list li:last-child {
    margin-bottom: 0;
  }

  .realtime-dialog__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .realtime-dialog__btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .realtime-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .realtime-dialog__btn--secondary:hover {
    background-color: var(--sidebar-active);
  }

  .realtime-dialog__btn--primary {
    background-color: var(--sidebar-accent);
    color: white;
  }

  .realtime-dialog__btn--primary:hover {
    background-color: #0891b2;
  }

  /* Transitions */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active,
  .dialog-leave-active {
    transition: all 200ms ease;
  }

  .dialog-enter-from,
  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.95);
  }
</style>
