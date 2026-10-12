<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { createSharedAudio, type SharedAudio } from '@/services/sharedAudioApi';
  import { AlertCircle, Music, Share2 } from 'lucide-vue-next';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { Textarea } from '@/components/ui/textarea';
  import { Dropzone } from '@/components/ui/dropzone';
  import RecipientsPicker from './shared/RecipientsPicker.vue';

  const props = defineProps<{
    organizationId: number | string;
    members: Array<{ user_id: number; user: { id: number; name: string | null; email: string } }>;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'created', audio: SharedAudio): void;
  }>();

  const open = defineModel<boolean>('open', { default: false });

  const name = ref('');
  const description = ref('');
  const file = ref<File | null>(null);
  const duration = ref<number | null>(null);
  const shareWithAll = ref(true);
  const selectedRecipients = ref<number[]>([]);
  const uploading = ref(false);
  const error = ref<string | null>(null);

  const canSubmit = computed(() => file.value && name.value.trim() && !uploading.value);

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    const selectedFile = input.files[0];
    const isAudio =
      selectedFile.type.startsWith('audio/') ||
      /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(selectedFile.name);

    if (!isAudio) {
      error.value = 'Please select an audio file (MP3, WAV, M4A, OGG, AAC)';
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      error.value = 'File size must be less than 50MB';
      return;
    }

    file.value = selectedFile;
    error.value = null;

    if (!name.value) {
      name.value = selectedFile.name.replace(/\.[^/.]+$/, '');
    }

    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      duration.value = audio.duration;
      URL.revokeObjectURL(audio.src);

      if (audio.duration > 600) {
        error.value = 'Audio duration must be 10 minutes or less';
        file.value = null;
      }
    };
    audio.src = URL.createObjectURL(selectedFile);
  }

  async function handleSubmit() {
    if (!file.value || !name.value.trim()) return;

    uploading.value = true;
    error.value = null;

    try {
      const response = await createSharedAudio(props.organizationId, file.value, {
        name: name.value.trim(),
        description: description.value.trim() || undefined,
        duration: duration.value || undefined,
        shareWithAll: shareWithAll.value,
        recipientUserIds: shareWithAll.value ? undefined : selectedRecipients.value,
      });

      if (response.success && response.audio) {
        emit('created', response.audio);
        resetForm();
        open.value = false;
      } else {
        error.value = response.error || 'Failed to share audio';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to share audio';
    } finally {
      uploading.value = false;
    }
  }

  function resetForm() {
    name.value = '';
    description.value = '';
    file.value = null;
    duration.value = null;
    shareWithAll.value = true;
    selectedRecipients.value = [];
    error.value = null;
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function close() {
    open.value = false;
  }

  watch(open, (isOpen) => {
    if (!isOpen) resetForm();
  });
</script>

<template>
  <Modal
    v-model:open="open"
    title="Share audio"
    description="Upload music or sound effects for your team to use in clips"
    :icon="Music"
    size="md"
    :dismissible="!uploading"
    :hide-close="uploading"
  >
    <form id="share-audio-form" class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <p class="text-xs text-fg-subtle">
        Members can download shared audio into their local library for use across all projects. Audio expires after 30
        days.
      </p>

      <Field label="Audio file" required>
        <Dropzone
          compact
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
          :file="file"
          :file-icon="Music"
          title="Choose an audio file"
          hint="MP3, WAV, M4A, OGG, AAC (max 50MB, 10 minutes)"
          :file-meta="file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB${duration ? ` · ${formatDuration(duration)}` : ''}` : ''"
          :disabled="uploading"
          @change="handleFileSelect"
        />
      </Field>

      <Field label="Name" for="share-audio-name" required>
        <Input id="share-audio-name" v-model="name" placeholder="e.g. Campaign background track" :disabled="uploading" />
      </Field>

      <Field label="Description" for="share-audio-description">
        <Textarea
          id="share-audio-description"
          v-model="description"
          rows="2"
          class="min-h-[60px] resize-none"
          placeholder="Optional notes about when or how to use this audio"
          :disabled="uploading"
        />
      </Field>

      <Field label="Recipients">
        <RecipientsPicker
          v-model:share-with-all="shareWithAll"
          v-model:selected="selectedRecipients"
          :members="members"
          :disabled="uploading"
        />
      </Field>

      <Alert v-if="error" variant="destructive">
        <AlertCircle />
        <AlertDescription class="text-fg">{{ error }}</AlertDescription>
      </Alert>
    </form>

    <template #footer>
      <Button variant="ghost" :disabled="uploading" @click="close">Cancel</Button>
      <Button variant="primary" type="submit" form="share-audio-form" :disabled="!canSubmit" :loading="uploading">
        <Share2 v-if="!uploading" />
        {{ uploading ? 'Uploading...' : 'Share audio' }}
      </Button>
    </template>
  </Modal>
</template>
