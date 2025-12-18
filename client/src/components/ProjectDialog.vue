<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50">
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md sm:max-w-lg w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

            <div class="p-5 sm:p-6 lg:p-8">
              <!-- Header -->
              <div class="mb-5 sm:mb-6 lg:mb-8 text-center">
                <div
                  class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 mb-3 sm:mb-4"
                >
                  <FolderPlus v-if="!isEdit" class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-violet-400" />
                  <Pencil v-else class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-violet-400" />
                </div>
                <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {{ isEdit ? 'Edit Project' : 'Create Project' }}
                </h2>
                <p class="text-zinc-400 text-xs sm:text-sm mt-1">
                  {{ isEdit ? 'Update project details' : 'Start a new video project' }}
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
                    v-model="formData.name"
                    type="text"
                    required
                    placeholder="Enter project name"
                    class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                    :class="{ 'border-red-500/50 focus:ring-red-500/50': errors.name }"
                  />
                  <p v-if="errors.name" class="text-xs sm:text-sm text-red-400">{{ errors.name }}</p>
                </div>

                <!-- Description -->
                <div class="space-y-1.5 sm:space-y-2">
                  <label for="project-description" class="block text-xs sm:text-sm font-medium text-zinc-300">
                    Description
                  </label>
                  <textarea
                    id="project-description"
                    v-model="formData.description"
                    rows="2"
                    placeholder="Enter project description (optional)"
                    class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all resize-none"
                  />
                </div>

                <!-- Video Selection -->
                <div class="space-y-2 sm:space-y-3">
                  <label class="block text-xs sm:text-sm font-medium text-zinc-300">
                    Source Videos
                    <span class="text-red-400" v-if="!isEdit">*</span>
                  </label>

                  <!-- Selected Videos List -->
                  <div
                    v-if="selectedVideoPaths.length > 0"
                    class="space-y-1.5 sm:space-y-2 max-h-32 sm:max-h-40 overflow-y-auto custom-scrollbar"
                  >
                    <div
                      v-for="(path, index) in selectedVideoPaths"
                      :key="index"
                      class="p-2 sm:p-3 bg-zinc-900/50 rounded-lg sm:rounded-xl border border-zinc-800 flex items-center justify-between gap-2 group"
                    >
                      <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div
                          class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0"
                        >
                          <Video class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-400" />
                        </div>
                        <span class="text-xs sm:text-sm truncate text-zinc-300" :title="path">
                          {{ getFileName(path) }}
                        </span>
                      </div>
                      <button
                        type="button"
                        @click="removeVideo(index)"
                        class="p-1 sm:p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                        title="Remove"
                      >
                        <X class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </div>

                  <!-- Select Video Button -->
                  <button
                    type="button"
                    @click="openVideoSelector"
                    class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/50 hover:bg-zinc-800/50 border border-zinc-800 hover:border-zinc-700 rounded-lg sm:rounded-xl text-zinc-300 transition-all flex items-center justify-center gap-2 text-sm"
                    :class="{ 'border-red-500/50': errors.selectedVideoPaths }"
                  >
                    <Upload class="h-4 w-4 sm:h-5 sm:w-5" />
                    {{ selectedVideoPaths.length > 0 ? 'Add More Videos' : 'Select Videos from Computer' }}
                  </button>
                  <p v-if="errors.selectedVideoPaths" class="text-xs sm:text-sm text-red-400">
                    {{ errors.selectedVideoPaths }}
                  </p>
                  <p class="text-[10px] sm:text-xs text-zinc-500">
                    Selected videos will be imported into the project workspace.
                  </p>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    @click="close"
                    :disabled="loading"
                    class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    :disabled="loading"
                    class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <div
                      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                    />
                    <span class="relative">
                      {{ loading ? 'Saving...' : isEdit ? 'Update Project' : 'Create Project' }}
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
  import { ref, watch, reactive } from 'vue';
  import { open } from '@tauri-apps/plugin-dialog';
  import { type Project } from '@/services/database';
  import { Video, X, Upload, FolderPlus, Pencil } from 'lucide-vue-next';

  export interface ProjectFormData {
    name: string;
    description: string;
    selectedVideoPaths: string[];
  }

  const props = defineProps<{
    modelValue: boolean;
    project?: Project | null;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    submit: [data: ProjectFormData];
  }>();

  const loading = ref(false);
  const isEdit = ref(false);
  const formData = reactive<{
    name: string;
    description: string;
  }>({
    name: '',
    description: '',
  });

  const selectedVideoPaths = ref<string[]>([]);
  const errors = reactive<Partial<Record<keyof ProjectFormData, string>>>({});

  // Watch for project prop changes to populate form for editing
  watch(
    () => props.project,
    async (newProject) => {
      if (newProject) {
        isEdit.value = true;
        formData.name = newProject.name;
        formData.description = newProject.description || '';
        selectedVideoPaths.value = [];
      } else {
        isEdit.value = false;
        resetForm();
      }
    },
    { immediate: true }
  );

  // Reset form when dialog opens/closes
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        if (!props.project) {
          resetForm();
        }
      }
    }
  );

  function resetForm() {
    formData.name = '';
    formData.description = '';
    selectedVideoPaths.value = [];
    Object.keys(errors).forEach((key) => delete errors[key as keyof ProjectFormData]);
  }

  function validateForm(): boolean {
    Object.keys(errors).forEach((key) => delete errors[key as keyof ProjectFormData]);

    if (!formData.name.trim()) {
      errors.name = 'Project name is required';
      return false;
    }

    if (formData.name.trim().length < 2) {
      errors.name = 'Project name must be at least 2 characters';
      return false;
    }

    // Require video selection for new projects
    if (!isEdit.value && selectedVideoPaths.value.length === 0) {
      errors.selectedVideoPaths = 'At least one video is required for new projects';
      return false;
    }

    return true;
  }

  async function handleSubmit() {
    if (!validateForm()) return;

    loading.value = true;
    try {
      emit('submit', {
        name: formData.name.trim(),
        description: formData.description.trim(),
        selectedVideoPaths: [...selectedVideoPaths.value],
      });
    } finally {
      loading.value = false;
    }
  }

  async function openVideoSelector() {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Video',
            extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'],
          },
        ],
      });

      if (selected) {
        if (Array.isArray(selected)) {
          // Append unique paths
          const uniquePaths = new Set([...selectedVideoPaths.value, ...selected]);
          selectedVideoPaths.value = Array.from(uniquePaths);
        } else {
          if (!selectedVideoPaths.value.includes(selected)) {
            selectedVideoPaths.value.push(selected);
          }
        }
        // Clear error if any
        if (errors.selectedVideoPaths) {
          delete errors.selectedVideoPaths;
        }
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
    }
  }

  function removeVideo(index: number) {
    selectedVideoPaths.value.splice(index, 1);
  }

  function getFileName(path: string): string {
    return path.split(/[\\/]/).pop() || path;
  }

  function close() {
    if (!loading.value) {
      emit('update:modelValue', false);
    }
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

  /* Custom scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgb(63 63 70);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgb(82 82 91);
  }
</style>
