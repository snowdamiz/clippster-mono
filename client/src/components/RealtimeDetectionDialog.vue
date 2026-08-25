<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="realtime-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="realtime-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="realtime-dialog__accent"></div>

            <!-- Header -->
            <div class="realtime-dialog__header">
              <button class="realtime-dialog__close" @click="close" title="Close (Esc)">
                <X :size="18" />
              </button>
              <div class="realtime-dialog__icon">
                <Sparkles :size="24" />
              </div>
              <h2 class="realtime-dialog__title">Real-Time Clip Detection</h2>
              <p class="realtime-dialog__subtitle">AI-powered live stream monitoring</p>
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

              <!-- Creator clip defaults (local user profiles only; eligibility set by caller) -->
              <div v-if="creatorLayoutEligible" class="realtime-dialog__field">
                <label class="realtime-dialog__label">Creator layout</label>
                <label class="realtime-dialog__checkbox-row">
                  <input
                    v-model="useCreatorLayout"
                    type="checkbox"
                    class="realtime-dialog__checkbox"
                  />
                  <span class="realtime-dialog__checkbox-text">Use creator layout</span>
                </label>
                <p class="realtime-dialog__hint">
                  Apply framing, overlays, and subtitle defaults from
                  <strong v-if="creatorLayoutCreatorName">{{ creatorLayoutCreatorName }}</strong
                  ><span v-else>this creator's</span>
                  profile to clips detected in this session.
                </p>
              </div>

              <!-- 60-minute cap (My Creators persistent auto-detect) -->
              <div
                v-if="showSixtyMinuteCap"
                class="realtime-dialog__alert realtime-dialog__alert--info"
              >
                <Info :size="16" />
                <div class="flex-1">
                  <p class="font-medium text-xs sm:text-sm mb-0.5 sm:mb-1">60-Minute Auto-Detect Limit</p>
                  <p class="text-[10px] sm:text-xs opacity-80">
                    Auto-detect runs for up to <strong>60 minutes</strong> or until the stream ends,
                    whichever comes first. If this was enabled from My Creators, that Auto setting
                    stays selected for future streams. To detect another 60 minutes of the same
                    live stream, go to <strong>Live Clip</strong> and click <strong>Auto</strong>
                    on that stream.
                  </p>
                </div>
              </div>

              <!-- Cost Warning -->
              <div class="realtime-dialog__alert realtime-dialog__alert--warning">
                <AlertCircle :size="16" />
                <div class="flex-1">
                  <p class="font-medium text-xs sm:text-sm mb-0.5 sm:mb-1">Cost: 1 Credit Per Minute</p>
                  <p class="text-[10px] sm:text-xs opacity-80">
                    Real-time detection runs continuously and costs <strong>1 credit per minute</strong>.
                    <template v-if="showSixtyMinuteCap">
                      While enabled on My Creators, the automatic run is capped at 60 minutes as described above.
                    </template>
                    <template v-else>
                      Detection will only stop when you manually click "Stop" or the stream ends.
                    </template>
                  </p>
                  <p v-if="estimatedCost > 0" class="text-[10px] sm:text-xs opacity-60 mt-1">
                    Estimated cost for 1 hour: <strong>{{ estimatedCost }} credits</strong>
                  </p>
                </div>
              </div>

              <!-- How It Works -->
              <div class="realtime-dialog__alert realtime-dialog__alert--info">
                <Info :size="16" />
                <div class="flex-1">
                  <p class="font-medium text-xs sm:text-sm mb-0.5 sm:mb-1">How It Works</p>
                  <ul class="text-[10px] sm:text-xs opacity-80 list-disc pl-4 space-y-0.5">
                    <li>AI analyzes the stream in real-time every 30 seconds</li>
                    <li>Clips appear in Projects within 1-2 minutes of detection</li>
                    <li>You can review, edit, and build clips at any time</li>
                    <li v-if="showSixtyMinuteCap">
                      Use Live Clip Auto again to detect another 60 minutes of the same stream
                    </li>
                    <li v-else>Detection runs until you stop it or the stream ends</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="realtime-dialog__footer">
              <button @click="close" class="realtime-dialog__btn realtime-dialog__btn--secondary">
                Cancel
              </button>
              <button @click="confirm" class="realtime-dialog__btn realtime-dialog__btn--primary">
                <Sparkles :size="16" />
                {{ showSixtyMinuteCap ? 'Enable Auto Detect' : 'Start Detection' }}
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
  import { X, Sparkles, AlertCircle, ChevronDown, Info } from 'lucide-vue-next';

  interface Prompt {
    id: string;
    name: string;
    content: string;
  }

  interface Props {
    modelValue: boolean;
    prompts?: Prompt[];
    /** Whether the looked-up creator profile has saved clip_build_defaults. */
    creatorLayoutEligible?: boolean;
    /** Display name of the creator whose layout would be applied. */
    creatorLayoutCreatorName?: string | null;
    /** Show My Creators 60-minute auto-detect cap messaging. */
    showSixtyMinuteCap?: boolean;
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void;
    (
      e: 'confirm',
      data: { promptId: string; promptContent: string; useCreatorLayout: boolean }
    ): void;
  }

  const props = withDefaults(defineProps<Props>(), {
    prompts: () => [],
    creatorLayoutEligible: false,
    creatorLayoutCreatorName: null,
    showSixtyMinuteCap: false,
  });

  const emit = defineEmits<Emits>();

  const selectedPromptId = ref('');
  const selectedPromptName = ref('');
  const showPromptDropdown = ref(false);
  const useCreatorLayout = ref(false);
  const estimatedCost = computed(() => 60); // 1 hour = 60 credits

  watch(
    () => props.modelValue,
    (newValue) => {
      if (newValue) {
        selectedPromptId.value = '';
        selectedPromptName.value = '';
        showPromptDropdown.value = false;
        useCreatorLayout.value = false;
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
      useCreatorLayout: props.creatorLayoutEligible && useCreatorLayout.value,
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
  /* ===== Overlay ===== */
  .realtime-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  /* ===== Dialog Container ===== */
  .realtime-dialog {
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
  }

  /* ===== Accent Bar ===== */
  .realtime-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .realtime-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .realtime-dialog__close {
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

  .realtime-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .realtime-dialog__icon {
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

  .realtime-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .realtime-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .realtime-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .realtime-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .realtime-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .realtime-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Form Field ===== */
  .realtime-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .realtime-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .realtime-dialog__hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .realtime-dialog__checkbox-row {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
  }

  .realtime-dialog__checkbox {
    width: 16px;
    height: 16px;
    accent-color: var(--sidebar-accent);
    cursor: pointer;
    margin: 0;
  }

  .realtime-dialog__checkbox-text {
    font-size: 0.875rem;
    color: var(--sidebar-text);
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

  /* ===== Alert Box ===== */
  .realtime-dialog__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .realtime-dialog__alert--warning {
    background-color: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.2);
    color: #fbbf24;
  }

  .realtime-dialog__alert--info {
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  /* ===== Footer ===== */
  .realtime-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .realtime-dialog__btn {
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

  .realtime-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .realtime-dialog__btn--secondary:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .realtime-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: #000;
  }

  .realtime-dialog__btn--primary:hover {
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
