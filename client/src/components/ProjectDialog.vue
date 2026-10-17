<template>
  <Modal
    :open="modelValue"
    :title="isEdit ? 'Edit project' : 'New project'"
    :description="isEdit ? 'Update project details' : 'Start a new video project'"
    :icon="isEdit ? Pencil : FolderPlus"
    :dismissible="!loading"
    size="md"
    @close="close"
  >
    <form id="project-dialog-form" class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <Field label="Project name" for="project-name" :error="errors.name" required>
        <Input
          id="project-name"
          v-model="formData.name"
          required
          placeholder="Enter project name"
          :aria-invalid="!!errors.name || undefined"
        />
      </Field>

      <Field for="project-description">
        <template #label>
          Description
          <span class="font-normal text-fg-subtle">(optional)</span>
        </template>
        <Textarea
          id="project-description"
          v-model="formData.description"
          rows="2"
          placeholder="Enter project description"
          class="min-h-[60px] resize-none"
        />
      </Field>

      <Field hint="Applies the creator's watermark, intro and outro settings automatically.">
        <template #label>
          Creator profile
          <span class="font-normal text-fg-subtle">(optional)</span>
        </template>
        <Select v-model="creatorProfileValue">
          <SelectTrigger aria-label="Creator profile">
            <SelectValue placeholder="No creator profile" />
          </SelectTrigger>
          <SelectContent class="min-w-[var(--reka-select-trigger-width)]">
            <SelectItem v-for="option in creatorProfileOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <!-- Video Selection (only for new projects) -->
      <Field
        v-if="!isEdit"
        label="Source videos"
        required
        :error="errors.selectedVideoPaths"
        hint="Selected videos will be imported into the project workspace."
      >
        <ul
          v-if="selectedVideoPaths.length > 0"
          class="flex max-h-[148px] flex-col divide-y divide-line-subtle overflow-y-auto rounded-[var(--radius-control)] border border-line"
        >
          <li
            v-for="(path, index) in selectedVideoPaths"
            :key="index"
            class="group flex h-9 items-center gap-2.5 bg-surface pl-2.5 pr-1"
          >
            <Video class="size-4 shrink-0 text-fg-subtle" />
            <span class="min-w-0 flex-1 truncate text-sm text-fg" :title="path">{{ getFileName(path) }}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Remove"
              aria-label="Remove video"
              @click="removeVideo(index)"
            >
              <X />
            </Button>
          </li>
        </ul>
        <button
          type="button"
          class="flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-dashed text-sm font-medium text-fg-muted transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-fg focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
          :class="errors.selectedVideoPaths ? 'border-[var(--danger-line)]' : 'border-line'"
          @click="openVideoSelector"
        >
          <Upload class="size-4" />
          {{ selectedVideoPaths.length > 0 ? 'Add more videos' : 'Select videos from computer' }}
        </button>
      </Field>
    </form>

    <template #footer>
      <Button variant="ghost" :disabled="loading" @click="close">Cancel</Button>
      <Button type="submit" form="project-dialog-form" variant="primary" :loading="loading">
        {{ loading ? 'Saving...' : isEdit ? 'Save changes' : 'Create project' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, watch, reactive, onMounted, computed } from 'vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { type Project } from '@/services/database';
  import { FolderPlus, Pencil, Upload, Video, X } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import { Textarea } from '@/components/ui/textarea';
  import { openFileDialog as open, getAllCreatorProfiles } from '@/services/creatorProfileRuntime';
  import { type CreatorProfileWithLinks } from '@/services/database/types';

  export interface ProjectFormData {
    name: string;
    description: string;
    selectedVideoPaths: string[];
    creatorProfileId: string | null;
  }

  const props = defineProps<{
    modelValue: boolean;
    saving?: boolean;
    project?: { id: string; name: string; description?: string | null; creator_profile_id?: string | null } | null;
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

  // Select items can't carry `null`, so "no profile" uses a sentinel value.
  const NO_CREATOR_PROFILE = '__none__';

  const creatorProfileOptions = computed(() => {
    return [
      { label: 'No creator profile', value: NO_CREATOR_PROFILE },
      ...creatorProfiles.value.map((profile) => ({
        label: profile.name,
        value: String(profile.id),
      })),
    ];
  });

  const creatorProfileValue = computed({
    get: () => formData.creatorProfileId ?? NO_CREATOR_PROFILE,
    set: (value: string) => {
      formData.creatorProfileId = value === NO_CREATOR_PROFILE ? null : value;
    },
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
    if (!loading.value && !props.saving) {
      emit('update:modelValue', false);
    }
  }
</script>
