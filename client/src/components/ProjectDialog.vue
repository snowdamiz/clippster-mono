<template>
  <ProjectDialogFrame
    :model-value="modelValue"
    :editing="isEdit"
    :loading="loading"
    @close="close"
    @submit="handleSubmit"
  >
    <!-- Content -->
    <form @submit.prevent="handleSubmit" class="project-content">
      <!-- Project Name -->
      <div class="project-section">
        <h3 class="project-section__title">Project Details</h3>
        <div class="project-section__items">
          <div class="project-field">
            <label for="project-name" class="project-field__label">
              Project Name
              <span class="project-field__required">*</span>
            </label>
            <input
              id="project-name"
              v-model="formData.name"
              type="text"
              required
              placeholder="Enter project name"
              class="project-field__input"
              :class="{ 'project-field__input--error': errors.name }"
            />
            <p v-if="errors.name" class="project-field__error">{{ errors.name }}</p>
          </div>

          <div class="project-field">
            <label for="project-description" class="project-field__label">
              Description
              <span class="project-field__optional">(optional)</span>
            </label>
            <textarea
              id="project-description"
              v-model="formData.description"
              rows="2"
              placeholder="Enter project description"
              class="project-field__textarea"
            />
          </div>
        </div>
      </div>

      <!-- Creator Profile Selection (optional) -->
      <div class="project-section">
        <h3 class="project-section__title">Creator Profile</h3>
        <div class="project-field">
          <label class="project-field__label">
            Link to Creator
            <span class="project-field__optional">(optional)</span>
          </label>
          <CustomDropdown
            v-model="formData.creatorProfileId"
            :options="creatorProfileOptions"
            placeholder="No creator profile"
            class="project-field__dropdown"
            trigger-class="project-field__dropdown-trigger"
          />
          <p class="project-section__hint">
            Associate this project with a creator to apply their watermark, intro, and outro settings automatically.
          </p>
        </div>
      </div>

      <!-- Video Selection (only for new projects) -->
      <div v-if="!isEdit" class="project-section">
        <div class="project-section__header">
          <h3 class="project-section__title">Source Videos</h3>
          <span class="project-section__required">Required</span>
        </div>

        <!-- Selected Videos List -->
        <div v-if="selectedVideoPaths.length > 0" class="project-videos">
          <div v-for="(path, index) in selectedVideoPaths" :key="index" class="project-video-item">
            <div class="project-video-item__info">
              <div class="project-video-item__icon">
                <Video :size="16" />
              </div>
              <span class="project-video-item__name" :title="path">
                {{ getFileName(path) }}
              </span>
            </div>
            <button type="button" @click="removeVideo(index)" class="project-video-item__remove" title="Remove">
              <X :size="14" />
            </button>
          </div>
        </div>

        <!-- Select Video Button -->
        <button
          type="button"
          @click="openVideoSelector"
          class="project-upload-btn"
          :class="{ 'project-upload-btn--error': errors.selectedVideoPaths }"
        >
          <Upload :size="18" />
          <span>{{ selectedVideoPaths.length > 0 ? 'Add More Videos' : 'Select Videos from Computer' }}</span>
        </button>

        <p v-if="errors.selectedVideoPaths" class="project-field__error">
          {{ errors.selectedVideoPaths }}
        </p>
        <p class="project-section__hint">Selected videos will be imported into the project workspace.</p>
      </div>
    </form>
  </ProjectDialogFrame>
</template>

<script setup lang="ts">
  import ProjectDialogFrame from './ProjectDialogFrame.vue';
  import { ref, watch, reactive, onMounted, computed } from 'vue';
  import { open } from '@tauri-apps/plugin-dialog';
  import { type Project, getAllCreatorProfiles, type CreatorProfileWithLinks } from '@/services/database';
  import { Video, X, Upload } from 'lucide-vue-next';
  import CustomDropdown from '@/components/CustomDropdown.vue';

  export interface ProjectFormData {
    name: string;
    description: string;
    selectedVideoPaths: string[];
    creatorProfileId: string | null;
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
    creatorProfileId: string | null;
  }>({
    name: '',
    description: '',
    creatorProfileId: null,
  });

  const selectedVideoPaths = ref<string[]>([]);
  const errors = reactive<Partial<Record<keyof ProjectFormData, string>>>({});
  const creatorProfiles = ref<CreatorProfileWithLinks[]>([]);

  // Convert creator profiles to dropdown options format
  const creatorProfileOptions = computed(() => {
    return [
      { label: 'No creator profile', value: null },
      ...creatorProfiles.value.map((profile) => ({
        label: profile.name,
        value: profile.id,
      })),
    ];
  });

  // Watch for project prop changes to populate form for editing
  watch(
    () => props.project,
    async (newProject) => {
      if (newProject) {
        isEdit.value = true;
        formData.name = newProject.name;
        formData.description = newProject.description || '';
        formData.creatorProfileId = newProject.creator_profile_id || null;
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
    formData.creatorProfileId = null;
    selectedVideoPaths.value = [];
    Object.keys(errors).forEach((key) => delete errors[key as keyof ProjectFormData]);
  }

  // Load creator profiles when component mounts
  onMounted(async () => {
    try {
      creatorProfiles.value = await getAllCreatorProfiles();
    } catch (err) {
      console.error('[ProjectDialog] Failed to load creator profiles:', err);
      creatorProfiles.value = [];
    }
  });

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
        creatorProfileId: formData.creatorProfileId,
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
  :deep(.project-field__dropdown-trigger) {
    width: 100% !important;
    padding: 0.625rem 0.875rem !important;
    background-color: var(--sidebar-hover) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    font-size: 0.875rem !important;
    color: var(--sidebar-text) !important;
    transition: all 150ms ease !important;
    justify-content: space-between !important;
  }

  :deep(.project-field__dropdown-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  :deep(.project-field__dropdown-trigger:focus-within) {
    border-color: transparent !important;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3) !important;
  }

  :deep(.project-field__dropdown-trigger span) {
    color: var(--sidebar-text) !important;
  }

  :deep(.project-field__dropdown-trigger svg) {
    width: 14px !important;
    height: 14px !important;
    color: var(--sidebar-text-muted) !important;
  }

  .project-field__input--error {
    border-color: rgba(239, 68, 68, 0.5);
  }

  .project-field__input--error:focus {
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3);
  }

  .project-field__textarea {
    resize: none;
    min-height: 60px;
  }

  .project-field__error {
    font-size: 0.75rem;
    color: #ef4444;
    margin: 0;
  }

  /* ===== Videos List ===== */
  .project-videos {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 140px;
    overflow-y: auto;
    margin-bottom: 0.75rem;
  }

  .project-videos::-webkit-scrollbar {
    width: 6px;
  }

  .project-videos::-webkit-scrollbar-track {
    background: transparent;
  }

  .project-videos::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .project-video-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .project-video-item__info {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
    flex: 1;
  }

  .project-video-item__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background-color: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
    flex-shrink: 0;
  }

  .project-video-item__name {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .project-video-item__remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
    opacity: 0.6;
  }

  .project-video-item:hover .project-video-item__remove {
    opacity: 1;
  }

  .project-video-item__remove:hover {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  /* ===== Upload Button ===== */
  .project-upload-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px dashed var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .project-upload-btn:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(6, 182, 212, 0.3);
    color: var(--sidebar-text);
  }

  .project-upload-btn--error {
    border-color: rgba(239, 68, 68, 0.5);
  }

  /* ===== Utility Classes ===== */
  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>

<!-- Global styles for dropdown menu (rendered via Teleport outside component scope) -->
<style>
  /* Project Dialog dropdown menu styling */
  .project-field__dropdown + div[class*='fixed'],
  div.fixed.bg-popover {
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    animation: projectDialogDropdownFade 100ms ease-out !important;
  }

  @keyframes projectDialogDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Dropdown menu items */
  .project-field__dropdown + div[class*='fixed'] button {
    display: flex !important;
    align-items: center !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.875rem !important;
    color: var(--sidebar-text) !important;
    transition: background-color 150ms ease !important;
  }

  .project-field__dropdown + div[class*='fixed'] button:hover {
    background-color: var(--sidebar-hover) !important;
  }

  .project-field__dropdown + div[class*='fixed'] button.bg-primary\/10 {
    background-color: rgba(6, 182, 212, 0.15) !important;
    color: var(--sidebar-accent) !important;
  }
</style>

<style scoped src="../styles/projectForm.css"></style>
