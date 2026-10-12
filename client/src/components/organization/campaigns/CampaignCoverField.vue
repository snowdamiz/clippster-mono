<script setup lang="ts">
  /**
   * Cover image picker: preview, upload button (hidden file input) or a pasted
   * URL. The upload itself is handled by the parent via the `select` event.
   */
  import { ref } from 'vue';
  import { Upload, X } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import type { CampaignFormState } from './campaignForm';

  defineProps<{
    form: CampaignFormState;
    preview: string;
    uploading: boolean;
  }>();

  const emit = defineEmits<{
    select: [event: Event];
    clear: [];
    'url-input': [];
  }>();

  const coverImageInput = ref<HTMLInputElement | null>(null);

  const handleImageError = (event: Event) => {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  };
</script>

<template>
  <Field label="Cover image" hint="Recommended size: 1200×630px">
    <div
      v-if="form.cover_image_url || preview"
      class="relative aspect-[1200/630] w-full max-w-60 overflow-hidden rounded-lg border border-line-subtle bg-surface-sunken"
    >
      <img :src="preview || form.cover_image_url" alt="" class="size-full object-cover" @error="handleImageError" />
      <Button
        variant="secondary"
        size="icon-xs"
        class="absolute right-2 top-2"
        title="Remove image"
        aria-label="Remove image"
        @click="emit('clear')"
      >
        <X />
      </Button>
    </div>
    <div class="flex items-center gap-2">
      <Button variant="secondary" :loading="uploading" @click="coverImageInput?.click()">
        <Upload v-if="!uploading" />
        {{ uploading ? 'Uploading…' : 'Upload' }}
      </Button>
      <input ref="coverImageInput" type="file" accept="image/*" class="hidden" @change="emit('select', $event)" />
      <span class="text-xs text-fg-subtle">or</span>
      <Input
        v-model="form.cover_image_url"
        type="text"
        placeholder="Paste image URL…"
        class="min-w-0 flex-1"
        @input="emit('url-input')"
      />
    </div>
  </Field>
</template>
