<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50">
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-xl sm:rounded-2xl max-w-md sm:max-w-lg w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

            <div class="p-5 sm:p-6 lg:p-8">
              <!-- Header -->
              <div class="mb-5 sm:mb-6 lg:mb-8 text-center">
                <div
                  class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 mb-3 sm:mb-4"
                >
                  <Clapperboard v-if="!project" class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-violet-400" />
                  <Pencil v-else class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-violet-400" />
                </div>
                <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {{ project ? 'Edit Project' : 'New Video Project' }}
                </h2>
                <p class="text-zinc-400 text-xs sm:text-sm mt-1">
                  {{ project ? 'Update your project details' : 'Create a new video editing project' }}
                </p>
              </div>

              <form @submit.prevent="handleSubmit" class="space-y-4 sm:space-y-5">
                <!-- Project Name -->
                <div class="space-y-1.5 sm:space-y-2">
                  <label for="project-name" class="block text-xs sm:text-sm font-medium text-zinc-300">
                    Project Name
                    <span class="text-red-400">*</span>
                  </label>
                  <input
                    id="project-name"
                    v-model="name"
                    type="text"
                    required
                    placeholder="Enter project name"
                    class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                    :class="{ 'border-red-500/50 focus:ring-red-500/50': !name.trim() && hasAttemptedSubmit }"
                  />
                  <p v-if="!name.trim() && hasAttemptedSubmit" class="text-xs sm:text-sm text-red-400">
                    Project name is required
                  </p>
                </div>

                <!-- Description -->
                <div class="space-y-1.5 sm:space-y-2">
                  <label for="project-description" class="block text-xs sm:text-sm font-medium text-zinc-300">
                    Description
                    <span class="text-zinc-500 text-xs">(optional)</span>
                  </label>
                  <textarea
                    id="project-description"
                    v-model="description"
                    rows="3"
                    placeholder="Enter project description"
                    class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all resize-none"
                  />
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    @click="close"
                    class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    :disabled="!name.trim()"
                    class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <div
                      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                    />
                    <span class="relative">
                      {{ project ? 'Save Changes' : 'Create Project' }}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Clapperboard, Pencil } from 'lucide-vue-next';
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
  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }
</style>
