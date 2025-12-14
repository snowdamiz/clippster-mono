<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="close"
    >
      <div class="bg-card rounded-lg w-full max-w-md border border-border shadow-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 class="text-lg font-semibold text-foreground">
            {{ project ? 'Edit Project' : 'New Video Project' }}
          </h2>
          <button @click="close" class="p-1.5 hover:bg-white/5 rounded-lg transition-all duration-200 group">
            <X class="h-4 w-4 text-foreground/50 group-hover:text-foreground/90 transition-colors" />
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
          <div class="space-y-2">
            <label for="name" class="text-sm font-medium text-foreground">Project Name</label>
            <Input id="name" v-model="name" placeholder="Enter project name" class="w-full" required />
          </div>

          <div class="space-y-2">
            <label for="description" class="text-sm font-medium text-foreground">Description (optional)</label>
            <Textarea
              id="description"
              v-model="description"
              placeholder="Enter project description"
              class="w-full resize-none"
              rows="3"
            />
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" @click="close">Cancel</Button>
            <Button type="submit" :disabled="!name.trim()">
              {{ project ? 'Save Changes' : 'Create Project' }}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { X } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Textarea } from '@/components/ui/textarea';
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

  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
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
    if (!name.value.trim()) return;

    emit('submit', {
      name: name.value.trim(),
      description: description.value.trim() || undefined,
    });
    close();
  }
</script>
