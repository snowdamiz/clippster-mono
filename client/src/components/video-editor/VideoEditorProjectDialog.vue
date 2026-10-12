<template>
  <Modal
    :open="modelValue"
    :title="project ? 'Edit project' : 'New video project'"
    :description="project ? 'Update your project details.' : 'Start a multi-track edit from your clips and media.'"
    :icon="project ? Pencil : Clapperboard"
    size="md"
    @update:open="(value) => { if (!value) close(); }"
  >
    <form id="video-editor-project-form" class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <Field
        label="Project name"
        for="project-name"
        required
        :error="!name.trim() && hasAttemptedSubmit ? 'Project name is required' : null"
      >
        <Input
          id="project-name"
          v-model="name"
          placeholder="Enter project name"
          autofocus
          :aria-invalid="!name.trim() && hasAttemptedSubmit"
        />
      </Field>

      <Field label="Description" for="project-description" hint="Optional">
        <Textarea
          id="project-description"
          v-model="description"
          rows="3"
          placeholder="What is this edit about?"
          class="resize-none"
        />
      </Field>
    </form>

    <template #footer>
      <Button variant="ghost" @click="close">Cancel</Button>
      <Button variant="primary" type="submit" form="video-editor-project-form" :disabled="!name.trim()">
        {{ project ? 'Save changes' : 'Create project' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Clapperboard, Pencil } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Textarea } from '@/components/ui/textarea';
  import { Button } from '@/components/ui/button';
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
