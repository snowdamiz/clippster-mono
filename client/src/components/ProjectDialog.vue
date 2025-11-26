<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="close"
    >
      <div class="bg-card rounded-lg p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-6">{{ isEdit ? 'Edit Project' : 'Create Project' }}</h2>

        <form @submit.prevent="handleSubmit" class="space-y-5">
          <!-- Project Name -->
          <div>
            <label for="project-name" class="block text-sm font-medium text-foreground mb-2">
              Project Name
              <span class="text-red-500">*</span>
            </label>
            <input
              id="project-name"
              v-model="formData.name"
              type="text"
              required
              placeholder="Enter project name"
              class="w-full px-4 py-3 bg-muted border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              :class="{ 'border-red-500': errors.name }"
            />
            <p v-if="errors.name" class="mt-1 text-sm text-red-500">{{ errors.name }}</p>
          </div>
          <!-- Description -->
          <div>
            <label for="project-description" class="block text-sm font-medium text-foreground mb-2">Description</label>
            <textarea
              id="project-description"
              v-model="formData.description"
              rows="3"
              placeholder="Enter project description (optional)"
              class="w-full px-4 py-3 bg-muted border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
            />
          </div>
          <!-- Video Selection -->
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">
              Source Videos
              <span class="text-red-500" v-if="!isEdit">*</span>
            </label>

            <!-- Warning message when project has detected/generated clips (only relevant if we were replacing videos, but we are appending now, so maybe less critical, but good to know) -->

            <!-- Selected Videos List -->
            <div v-if="selectedVideoPaths.length > 0" class="mb-3 space-y-2 max-h-40 overflow-y-auto">
              <div
                v-for="(path, index) in selectedVideoPaths"
                :key="index"
                class="p-2 bg-muted/50 rounded-md border border-border flex items-center justify-between gap-2"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <Video class="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span class="text-sm truncate text-foreground" :title="path">
                    {{ getFileName(path) }}
                  </span>
                </div>
                <button
                  type="button"
                  @click="removeVideo(index)"
                  class="p-1 hover:bg-muted rounded text-muted-foreground hover:text-red-500 transition-colors"
                  title="Remove"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>
            </div>

            <!-- Select Video Button -->
            <button
              type="button"
              @click="openVideoSelector"
              class="w-full px-4 py-3 bg-muted hover:bg-muted/80 border rounded-md text-foreground transition-all flex items-center justify-center gap-2"
              :class="{
                'border-red-500': errors.selectedVideoPaths,
              }"
            >
              <Upload class="h-5 w-5" />
              {{ selectedVideoPaths.length > 0 ? 'Add More Videos' : 'Select Videos from Computer' }}
            </button>
            <p v-if="errors.selectedVideoPaths" class="mt-1 text-sm text-red-500">
              {{ errors.selectedVideoPaths }}
            </p>
            <p class="mt-2 text-xs text-muted-foreground">
              Selected videos will be imported into the project workspace.
            </p>
          </div>
          <!-- Action Buttons -->
          <div class="flex gap-3 pt-4">
            <button
              type="submit"
              :disabled="loading"
              class="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md font-semibold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {{ loading ? 'Saving...' : isEdit ? 'Update Project' : 'Create Project' }}
            </button>
            <button
              type="button"
              @click="close"
              :disabled="loading"
              class="flex-1 py-3 bg-muted text-foreground rounded-md font-semibold hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, watch, reactive } from 'vue';
  import { open } from '@tauri-apps/plugin-dialog';
  import { type Project } from '@/services/database';
  import { Video, X, Upload } from 'lucide-vue-next';

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
        selectedVideoPaths.value = []; // Don't preload existing videos for now, as we only support adding new ones
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
