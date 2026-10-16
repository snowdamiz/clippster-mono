<template>
  <Modal
    :open="show"
    title="Save recording"
    description="Name your recording and choose what to do next."
    :icon="Disc"
    size="md"
    :dismissible="!saving"
    @close="emit('close')"
  >
    <div class="flex flex-col gap-4">
      <Field label="Title" for="recording-title" required>
        <Input id="recording-title" v-model="title" required placeholder="My recording" />
      </Field>

      <StatGrid
        size="sm"
        class="border-t border-line-subtle pt-3"
        :items="[
          { label: 'Duration', value: formatDuration(duration) },
          { label: 'Resolution', value: `${width}×${height}` },
          { label: 'Aspect ratio', value: aspectRatio },
        ]"
      />

      <Alert v-if="error" variant="destructive">
        <AlertCircle />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>
    </div>

    <template #footer>
      <Button variant="ghost" class="mr-auto" :disabled="saving" @click="emit('close')">Cancel</Button>
      <Button variant="secondary" :disabled="saving || !title.trim()" @click="emit('save', 'projects')">
        Clip in Projects
      </Button>
      <Button variant="secondary" :disabled="saving || !title.trim()" @click="emit('save', 'editor')">
        Open in editor
      </Button>
      <Button variant="primary" :disabled="saving || !title.trim()" :loading="saving" @click="emit('save', 'publish')">
        {{ saving ? 'Saving…' : 'Save' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Disc, AlertCircle } from 'lucide-vue-next';
  import { StatGrid } from '@/components/ui/stat-card';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';

  const props = defineProps<{
    show: boolean;
    duration: number;
    width: number;
    height: number;
    aspectRatio: string;
    saving: boolean;
    error: string | null;
    defaultTitle?: string;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'save', action: 'projects' | 'editor' | 'publish'): void;
    (e: 'update:title', value: string): void;
  }>();

  const title = ref(props.defaultTitle || '');

  watch(
    () => props.show,
    (open) => {
      if (open) {
        title.value = props.defaultTitle || `Recording ${new Date().toLocaleString()}`;
      }
    }
  );

  watch(title, (v) => emit('update:title', v));

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
</script>
