<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 bg-black/90 z-[30000] flex items-center justify-center" @click.self="$emit('update:modelValue', false)">
        <div class="bg-[#1a1a1c] border border-red-500/30 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle class="w-6 h-6 text-red-400" />
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-white mb-2">{{ title }}</h3>
              <p class="text-gray-300 text-sm leading-relaxed">{{ message }}</p>
            </div>
          </div>
          <div class="mt-6 flex justify-end">
            <button 
              @click="$emit('update:modelValue', false)"
              class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next';

defineProps<{
  modelValue: boolean;
  title: string;
  message: string;
}>();

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
