<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { BrandingConfig, createSharedClip, SharedClip } from '@/services/sharedClipsApi';
  import { listOrganizationAssets, ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { AlertCircle, Image as ImageIcon, Share2, Video } from 'lucide-vue-next';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import { Switch } from '@/components/ui/switch';
  import { Textarea } from '@/components/ui/textarea';
  import { Dropzone } from '@/components/ui/dropzone';
  import RecipientsPicker from './shared/RecipientsPicker.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';

  const props = defineProps<{
    organizationId: number | string;
    members: Array<{ user_id: number; user: { id: number; name: string | null; email: string } }>;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'created', clip: SharedClip): void;
  }>();

  const open = defineModel<boolean>('open', { default: false });

  const name = ref('');
  const description = ref('');
  const file = ref<File | null>(null);
  const thumbnail = ref<File | null>(null);
  const duration = ref<number | null>(null);
  const shareWithAll = ref(true);
  const selectedRecipients = ref<number[]>([]);
  const brandingRequired = ref(true);
  const brandingConfig = ref<BrandingConfig>({});

  const uploading = ref(false);
  const error = ref<string | null>(null);
  const uploadProgress = ref(0);

  const orgAssets = ref<ServerOrganizationAsset[]>([]);
  const loadingAssets = ref(false);

  const aspectRatios = ['16:9', '9:16', '1:1'];
  const aspectRatioOptions = aspectRatios.map((ratio) => ({ value: ratio, label: ratio }));
  const activeAspectRatio = ref('16:9');

  const watermarks = computed(() => orgAssets.value.filter((a) => a.asset_type === 'watermark'));
  const intros = computed(() => orgAssets.value.filter((a) => a.asset_type === 'intro'));
  const outros = computed(() => orgAssets.value.filter((a) => a.asset_type === 'outro'));

  const brandingFields = computed(() => [
    { field: 'watermark_id', label: 'Watermark', assets: watermarks.value },
    { field: 'intro_id', label: 'Intro video', assets: intros.value },
    { field: 'outro_id', label: 'Outro video', assets: outros.value },
  ]);

  function assetOptions(assets: ServerOrganizationAsset[]) {
    return [{ label: 'None', value: 'none' }, ...assets.map((asset) => ({ label: asset.name, value: String(asset.id) }))];
  }

  const canSubmit = computed(() => {
    return file.value && name.value.trim() && !uploading.value;
  });

  const thumbnailInputRef = ref<HTMLInputElement | null>(null);

  async function loadAssets() {
    loadingAssets.value = true;
    try {
      const response = await listOrganizationAssets(props.organizationId);
      if (response.success) {
        orgAssets.value = response.assets;
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      loadingAssets.value = false;
    }
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const selectedFile = input.files[0];

      // Validate file type
      if (!selectedFile.type.startsWith('video/')) {
        error.value = 'Please select a video file';
        return;
      }

      // Validate file size (500MB max)
      if (selectedFile.size > 500 * 1024 * 1024) {
        error.value = 'File size must be less than 500MB';
        return;
      }

      file.value = selectedFile;
      error.value = null;

      // Auto-fill name if empty
      if (!name.value) {
        name.value = selectedFile.name.replace(/\.[^/.]+$/, '');
      }

      // Try to get video duration
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        duration.value = video.duration;
        URL.revokeObjectURL(video.src);

        // Validate duration (3 minutes max)
        if (video.duration > 180) {
          error.value = 'Video duration must be 3 minutes or less';
          file.value = null;
        }
      };
      video.src = URL.createObjectURL(selectedFile);
    }
  }

  function handleThumbnailSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      thumbnail.value = input.files[0];
    }
  }

  function updateBrandingForAspectRatio(aspectRatio: string, field: string, value: string) {
    if (!brandingConfig.value[aspectRatio]) {
      brandingConfig.value[aspectRatio] = {};
    }

    if (value && value !== 'none') {
      (brandingConfig.value[aspectRatio] as any)[field] = value;
    } else {
      delete (brandingConfig.value[aspectRatio] as any)[field];
    }
  }

  function getBrandingValue(aspectRatio: string, field: string): string {
    return (brandingConfig.value[aspectRatio] as any)?.[field] || 'none';
  }

  async function handleSubmit() {
    if (!file.value || !name.value.trim()) return;

    uploading.value = true;
    error.value = null;
    uploadProgress.value = 0;

    try {
      const response = await createSharedClip(props.organizationId, file.value, {
        name: name.value.trim(),
        description: description.value.trim() || undefined,
        duration: duration.value || undefined,
        shareWithAll: shareWithAll.value,
        recipientUserIds: shareWithAll.value ? undefined : selectedRecipients.value,
        brandingConfig: Object.keys(brandingConfig.value).length > 0 ? brandingConfig.value : undefined,
        brandingRequired: brandingRequired.value,
        thumbnail: thumbnail.value || undefined,
      });

      if (response.success && response.clip) {
        emit('created', response.clip);
        resetForm();
        open.value = false;
      } else {
        error.value = response.error || 'Failed to share clip';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to share clip';
    } finally {
      uploading.value = false;
    }
  }

  function resetForm() {
    name.value = '';
    description.value = '';
    file.value = null;
    thumbnail.value = null;
    duration.value = null;
    shareWithAll.value = true;
    selectedRecipients.value = [];
    brandingRequired.value = true;
    brandingConfig.value = {};
    error.value = null;
    activeAspectRatio.value = '16:9';
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
    if (isOpen) {
      loadAssets();
    } else {
      resetForm();
    }
  });
</script>

<template>
  <Modal
    v-model:open="open"
    title="Share clip"
    description="Upload a video clip to share with your organization"
    :icon="Share2"
    size="lg"
    :dismissible="!uploading"
    :hide-close="uploading"
  >
    <form id="share-clip-form" class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <p class="text-xs text-fg-subtle">
        Upload a video to share with organization members. Clips will expire after 7 days.
      </p>

      <!-- File Upload -->
      <Field label="Video file" required>
        <Dropzone
          compact
          accept="video/*"
          :file="file"
          :file-icon="Video"
          title="Choose a video"
          hint="MP4, MOV, WebM (max 500MB, 3 minutes)"
          :file-meta="file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB${duration ? ` · ${formatDuration(duration)}` : ''}` : ''"
          :disabled="uploading"
          @change="handleFileSelect"
        />
      </Field>

      <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <!-- Name -->
        <Field label="Name" for="share-clip-name" required>
          <Input id="share-clip-name" v-model="name" placeholder="Enter clip name" :disabled="uploading" />
        </Field>

        <!-- Thumbnail -->
        <Field label="Thumbnail">
          <div class="flex min-w-0 items-center gap-2">
            <Button type="button" variant="secondary" :disabled="uploading" @click="thumbnailInputRef?.click()">
              <ImageIcon />
              {{ thumbnail ? 'Change' : 'Upload' }}
            </Button>
            <input ref="thumbnailInputRef" type="file" accept="image/*" class="hidden" @change="handleThumbnailSelect" />
            <span class="min-w-0 truncate text-xs" :class="thumbnail ? 'text-fg-muted' : 'text-fg-subtle'">
              {{ thumbnail ? thumbnail.name : 'Optional' }}
            </span>
          </div>
        </Field>
      </div>

      <!-- Description -->
      <Field label="Description" for="share-clip-description">
        <Textarea
          id="share-clip-description"
          v-model="description"
          rows="2"
          class="min-h-[60px] resize-none"
          placeholder="Optional description or instructions"
          :disabled="uploading"
        />
      </Field>

      <!-- Recipients -->
      <Field label="Recipients">
        <RecipientsPicker
          v-model:share-with-all="shareWithAll"
          v-model:selected="selectedRecipients"
          :members="members"
          :disabled="uploading"
        />
      </Field>

      <!-- Branding -->
      <Field label="Branding">
        <div class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
          <label class="flex cursor-pointer items-center justify-between gap-4 px-3.5 py-3">
            <span class="min-w-0">
              <span class="block text-sm font-medium text-fg">Require branding on export</span>
              <span class="block text-xs text-fg-subtle">Members cannot disable branding when exporting</span>
            </span>
            <Switch v-model="brandingRequired" :disabled="uploading" />
          </label>

          <div class="flex flex-col gap-3 border-t border-line-subtle px-3.5 py-3">
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs text-fg-muted">Assets per aspect ratio</span>
              <SegmentedControl v-model="activeAspectRatio" :options="aspectRatioOptions" size="sm" />
            </div>
            <div :key="activeAspectRatio" class="grid animate-enter grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
              <Field v-for="item in brandingFields" :key="item.field" :label="item.label">
                <CustomDropdown
                  :model-value="getBrandingValue(activeAspectRatio, item.field)"
                  :options="assetOptions(item.assets)"
                  :aria-label="item.label"
                  :disabled="uploading || loadingAssets"
                  @update:model-value="updateBrandingForAspectRatio(activeAspectRatio, item.field, $event)"
                />
              </Field>
            </div>
          </div>
        </div>
      </Field>

      <!-- Error -->
      <Alert v-if="error" variant="destructive">
        <AlertCircle />
        <AlertDescription class="text-fg">{{ error }}</AlertDescription>
      </Alert>
    </form>

    <template #footer>
      <Button variant="ghost" :disabled="uploading" @click="close">Cancel</Button>
      <Button variant="primary" type="submit" form="share-clip-form" :disabled="!canSubmit" :loading="uploading">
        {{ uploading ? 'Uploading...' : 'Share clip' }}
      </Button>
    </template>
  </Modal>
</template>
