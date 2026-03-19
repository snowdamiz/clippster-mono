<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]"
        @click.self="close"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-2xl w-full mx-4 border border-white/10 overflow-hidden"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

            <div class="p-6">
              <!-- Header -->
              <div class="flex items-center justify-between mb-6">
                <div>
                  <h3 class="text-lg font-semibold text-white">Select Aspect Ratio to Publish</h3>
                  <p class="text-sm text-zinc-400 mt-1">Choose which version you want to publish</p>
                </div>
                <button
                  @click="close"
                  class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Close"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Aspect Ratio Grid -->
              <div class="grid grid-cols-3 gap-4 mb-6">
                <button
                  v-for="ratio in availableRatios"
                  :key="ratio"
                  @click="selectRatio(ratio)"
                  class="aspect-ratio-card"
                  :class="{ 'aspect-ratio-card--selected': selectedRatio === ratio }"
                >
                  <div class="aspect-ratio-card__header">
                    <span class="aspect-ratio-card__label">{{ ratio }}</span>
                    <div
                      class="aspect-ratio-card__check"
                      :class="{ 'aspect-ratio-card__check--active': selectedRatio === ratio }"
                    >
                      <Check v-if="selectedRatio === ratio" class="w-4 h-4" />
                    </div>
                  </div>
                  <div class="aspect-ratio-card__preview">
                    <div
                      class="aspect-ratio-card__box"
                      :class="{
                        'aspect-ratio-card__box--16-9': ratio === '16:9',
                        'aspect-ratio-card__box--9-16': ratio === '9:16',
                        'aspect-ratio-card__box--1-1': ratio === '1:1',
                        'aspect-ratio-card__box--4-5': ratio === '4:5',
                        'aspect-ratio-card__box--selected': selectedRatio === ratio,
                      }"
                    />
                  </div>
                  <div class="aspect-ratio-card__platforms">
                    <p class="aspect-ratio-card__text">
                      {{ getPlatformText(ratio) }}
                    </p>
                  </div>
                </button>
              </div>

              <!-- Actions -->
              <div class="flex gap-3">
                <button
                  @click="close"
                  class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="confirm"
                  :disabled="!selectedRatio"
                  class="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Share2 class="w-4 h-4" />
                  Continue to Publish
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { X, Check, Share2 } from 'lucide-vue-next';

  interface Props {
    modelValue: boolean;
    availableRatios: string[];
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void;
    (e: 'select', ratio: string): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const selectedRatio = ref<string | null>(null);

  function getPlatformText(ratio: string): string {
    switch (ratio) {
      case '16:9':
        return 'YouTube • Twitch';
      case '9:16':
        return 'TikTok • Reels';
      case '1:1':
        return 'Instagram';
      case '4:5':
        return 'Instagram Feed';
      default:
        return '';
    }
  }

  function selectRatio(ratio: string) {
    selectedRatio.value = ratio;
  }

  function confirm() {
    if (selectedRatio.value) {
      emit('select', selectedRatio.value);
      close();
    }
  }

  function close() {
    emit('update:modelValue', false);
    selectedRatio.value = null;
  }
</script>

<style scoped>
  /* Transitions */
  .modal-enter-active,
  .modal-leave-active {
    transition:
      opacity 0.2s ease,
      backdrop-filter 0.2s ease;
  }
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active,
  .dialog-leave-active {
    transition:
      transform 0.3s ease,
      opacity 0.2s ease;
  }
  .dialog-enter-from {
    transform: scale(0.95) translateY(10px);
    opacity: 0;
  }
  .dialog-leave-to {
    transform: scale(0.95) translateY(10px);
    opacity: 0;
  }

  /* Aspect Ratio Cards */
  .aspect-ratio-card {
    padding: 1rem;
    background: rgb(39 39 42);
    border: 2px solid transparent;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .aspect-ratio-card:hover {
    background: rgb(63 63 70);
    border-color: rgba(139, 92, 246, 0.3);
  }

  .aspect-ratio-card--selected {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgb(139 92 246);
  }

  .aspect-ratio-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .aspect-ratio-card__label {
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
  }

  .aspect-ratio-card__check {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid rgb(82 82 91);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .aspect-ratio-card__check--active {
    background: rgb(139 92 246);
    border-color: rgb(139 92 246);
    color: white;
  }

  .aspect-ratio-card__preview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80px;
    margin-bottom: 0.75rem;
  }

  .aspect-ratio-card__box {
    background: rgb(63 63 70);
    border: 2px solid rgb(82 82 91);
    transition: all 0.2s ease;
  }

  .aspect-ratio-card__box--16-9 {
    width: 80px;
    height: 45px;
  }

  .aspect-ratio-card__box--9-16 {
    width: 45px;
    height: 80px;
  }

  .aspect-ratio-card__box--1-1 {
    width: 60px;
    height: 60px;
  }

  .aspect-ratio-card__box--4-5 {
    width: 48px;
    height: 60px;
  }

  .aspect-ratio-card__box--selected {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgb(139 92 246);
  }

  .aspect-ratio-card__platforms {
    text-align: center;
  }

  .aspect-ratio-card__text {
    font-size: 0.75rem;
    color: rgb(161 161 170);
  }
</style>
