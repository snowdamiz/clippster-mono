<template>
  <Modal
    :open="modelValue"
    title="New project"
    description="Choose image or thumbnail, then name your project."
    :icon="Images"
    size="md"
    :dismissible="!isCreating"
    @close="close"
  >
    <div class="flex flex-col gap-4">
      <Field label="Type">
        <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Project type">
          <OptionTile
            title="Image"
            :icon="Images"
            description="True image creation from a chat brief · 4 credits"
            :selected="creatorMode === 'image'"
            @select="creatorMode = 'image'"
          />
          <OptionTile
            title="Thumbnail"
            :icon="ImagePlay"
            description="Transcript-backed or freeform YouTube-style thumbnails"
            :selected="creatorMode === 'thumbnail'"
            @select="creatorMode = 'thumbnail'"
          />
        </div>
      </Field>

      <Field v-if="creatorMode === 'thumbnail'" label="Thumbnail workflow" class="animate-enter">
        <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Thumbnail workflow">
          <OptionTile
            title="Editable"
            description="Text-free plate + live text layers in Image Editor"
            :selected="generationMode === 'editable'"
            @select="generationMode = 'editable'"
          />
          <OptionTile
            title="Quick"
            description="Finished flat thumbnail with baked hook text"
            :selected="generationMode === 'quick'"
            @select="generationMode = 'quick'"
          />
        </div>
      </Field>

      <Field label="Project name" for="ai-image-project-name" :error="error">
        <Input
          id="ai-image-project-name"
          v-model="name"
          maxlength="100"
          :placeholder="creatorMode === 'image' ? 'e.g. Brand logo concept' : 'e.g. Episode 12 thumbnail'"
          :aria-invalid="!!error"
          autofocus
          @keyup.enter="confirm"
        />
      </Field>
    </div>

    <template #footer>
      <Button variant="ghost" :disabled="isCreating" @click="close">Cancel</Button>
      <Button variant="primary" :loading="isCreating" @click="confirm">
        <Plus v-if="!isCreating" />
        {{ isCreating ? 'Creating…' : 'Create' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { ImagePlay, Images, Plus } from 'lucide-vue-next';
  import OptionTile from '@/components/create/OptionTile.vue';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import type { ThumbnailGenerationMode } from '@/services/aiThumbnailApi';

  export type AIImageCreatorMode = 'image' | 'thumbnail';

  const props = defineProps<{
    modelValue: boolean;
    isCreating?: boolean;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [
      payload: {
        name: string;
        creator_mode: AIImageCreatorMode;
        generation_mode: ThumbnailGenerationMode;
      },
    ];
  }>();

  const creatorMode = ref<AIImageCreatorMode>('image');
  const generationMode = ref<ThumbnailGenerationMode>('editable');
  const name = ref('');
  const error = ref('');

  watch(
    () => props.modelValue,
    (open) => {
      if (open) {
        creatorMode.value = 'image';
        generationMode.value = 'editable';
        name.value = '';
        error.value = '';
      }
    }
  );

  function close() {
    if (props.isCreating) return;
    emit('update:modelValue', false);
  }

  function confirm() {
    const trimmed = name.value.trim();
    if (!trimmed) {
      error.value = 'Project name is required';
      return;
    }
    error.value = '';
    emit('confirm', {
      name: trimmed,
      creator_mode: creatorMode.value,
      generation_mode: generationMode.value,
    });
  }
</script>
