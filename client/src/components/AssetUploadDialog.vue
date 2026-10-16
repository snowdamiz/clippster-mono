<template>
  <Modal
    :open="show"
    title="Upload asset"
    :description="selectedFile ? 'Choose how this file will be used' : 'Intros, outros, watermarks, audio and images'"
    :icon="Upload"
    size="md"
    :dismissible="!isUploading"
    :hide-close="isUploading"
    @close="handleClose"
  >
    <!-- File selection -->
    <Dropzone
      v-if="!selectedFile"
      :icon="FolderOpen"
      title="Choose a file"
      hint="Video, image, or audio files"
      @select="selectFile"
    />

    <div v-else class="flex animate-enter flex-col gap-4">
      <!-- Selected file -->
      <FileRow
        :name="selectedFile.name"
        :meta="`${fileExtension.toUpperCase()} file`"
        :icon="getFileTypeIcon(fileExtension)"
        @remove="clearSelectedFile"
      />

      <!-- Asset type -->
      <Field label="Asset type">
        <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Asset type">
          <button
            v-for="option in assetTypeOptions"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="selectedType === option.value"
            class="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            :class="
              selectedType === option.value
                ? 'border-brand-line bg-brand-soft text-fg'
                : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg'
            "
            @click="selectedType = option.value"
          >
            <component
              :is="option.icon"
              class="size-4 shrink-0"
              :class="selectedType === option.value ? 'text-brand' : 'text-fg-subtle'"
            />
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ option.label }}</span>
            <Badge v-if="option.recommended" variant="neutral">Suggested</Badge>
          </button>
        </div>
      </Field>

      <!-- Name -->
      <Field label="Name" hint="Optional — defaults to the file name">
        <Input v-model="customName" type="text" :placeholder="selectedFile.name" />
      </Field>
    </div>

    <template #footer>
      <Button variant="ghost" :disabled="isUploading" @click="handleClose">Cancel</Button>
      <Button
        v-if="selectedFile"
        variant="primary"
        :disabled="!selectedType || isUploading"
        :loading="isUploading"
        @click="handleUpload"
      >
        <Upload v-if="!isUploading" />
        {{ isUploading ? 'Uploading…' : 'Upload asset' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import {
    Upload,
    Play,
    Flag,
    Stamp,
    Loader2,
    Image as ImageIcon,
    Music,
    FolderOpen,
    Film,
  } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Dropzone, FileRow } from '@/components/ui/dropzone';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { createIntroOutro, createAudioAsset, createImageAsset } from '@/services/database';
  import { createWatermarkImage } from '@/services/database/watermarks';
  import { generateId } from '@/services/database';
  import { useToast } from '@/composables/useToast';

  const emit = defineEmits<{
    close: [];
    uploaded: [];
  }>();

  const props = defineProps<{
    show: boolean;
  }>();

  const { success, error } = useToast();

  // State
  const selectedFile = ref<{ name: string; path: string } | null>(null);
  const fileExtension = ref('');
  const selectedType = ref<'intro' | 'outro' | 'watermark' | 'audio' | 'image' | null>(null);
  const customName = ref('');
  const isUploading = ref(false);

  // Asset type options based on file type
  type AssetTypeOption = {
    value: 'intro' | 'outro' | 'watermark' | 'audio' | 'image';
    label: string;
    icon: any;
    recommended?: boolean;
  };

  const assetTypeOptions = computed<AssetTypeOption[]>(() => {
    return getAssetOptionsForFileType(fileExtension.value);
  });

  // Reset state when dialog is closed
  watch(
    () => props.show,
    (newValue) => {
      if (!newValue) {
        // Reset state when dialog closes
        setTimeout(() => {
          selectedFile.value = null;
          fileExtension.value = '';
          selectedType.value = null;
          customName.value = '';
        }, 200); // Wait for animation to complete
      }
    }
  );

  function getAssetOptionsForFileType(ext: string): AssetTypeOption[] {
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'tif'];
    const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac', 'wma'];

    if (videoExtensions.includes(ext)) {
      return [
        { value: 'intro', label: 'Intro', icon: Play, recommended: true },
        { value: 'outro', label: 'Outro', icon: Flag },
      ];
    } else if (imageExtensions.includes(ext)) {
      return [
        { value: 'watermark', label: 'Watermark', icon: Stamp, recommended: true },
        { value: 'image', label: 'Sticker / Image', icon: ImageIcon },
      ];
    } else if (audioExtensions.includes(ext)) {
      return [{ value: 'audio', label: 'Audio', icon: Music, recommended: true }];
    }
    return [];
  }

  function getFileTypeIcon(ext: string) {
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'tif'];
    const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac', 'wma'];

    if (videoExtensions.includes(ext)) return Film;
    if (imageExtensions.includes(ext)) return ImageIcon;
    if (audioExtensions.includes(ext)) return Music;
    return FolderOpen;
  }

  async function selectFile() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');

      const filters = [
        {
          name: 'Media Files',
          extensions: [
            'mp4',
            'mov',
            'avi',
            'mkv',
            'webm',
            'flv',
            'wmv',
            'm4v',
            'png',
            'jpg',
            'jpeg',
            'gif',
            'webp',
            'bmp',
            'tiff',
            'tif',
            'mp3',
            'wav',
            'aac',
            'm4a',
            'ogg',
            'flac',
            'wma',
          ],
        },
      ];

      const selected = await open({ multiple: false, filters });
      if (!selected || typeof selected !== 'string') return;

      const fileName = selected.split(/[\\\/]/).pop() || 'file';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      selectedFile.value = { name: fileName, path: selected };
      fileExtension.value = ext;

      // Auto-select recommended type
      const options = getAssetOptionsForFileType(ext);
      const recommended = options.find((o) => o.recommended);
      if (recommended) {
        selectedType.value = recommended.value;
      } else if (options.length > 0) {
        selectedType.value = options[0].value;
      }
    } catch (err: any) {
      console.error('File selection failed:', err);
      error('File selection failed', err.message || 'Failed to select file');
    }
  }

  function clearSelectedFile() {
    selectedFile.value = null;
    fileExtension.value = '';
    selectedType.value = null;
    customName.value = '';
  }

  function handleClose() {
    if (isUploading.value) return;
    emit('close');
  }

  async function handleUpload() {
    if (!selectedFile.value || !selectedType.value) return;

    isUploading.value = true;
    const sourcePath = selectedFile.value.path;
    const assetName = customName.value.trim() || selectedFile.value.name;

    try {
      if (selectedType.value === 'intro' || selectedType.value === 'outro') {
        // Upload intro/outro video (async)
        await uploadVideoAsset(sourcePath, assetName, selectedType.value);
      } else if (selectedType.value === 'watermark') {
        // Upload watermark
        await uploadWatermarkAsset(sourcePath, assetName);
      } else if (selectedType.value === 'audio') {
        // Upload audio
        await uploadAudioAssetFile(sourcePath, assetName);
      } else if (selectedType.value === 'image') {
        // Upload image
        await uploadImageAssetFile(sourcePath, assetName);
      }

      emit('close');
      emit('uploaded');
    } catch (err: any) {
      console.error('Upload failed:', err);
      error('Upload failed', err.message || 'Failed to upload asset');
    } finally {
      isUploading.value = false;
    }
  }

  async function uploadVideoAsset(sourcePath: string, assetName: string, type: 'intro' | 'outro') {
    // Generate unique upload ID and embed metadata
    const uploadId = generateId();
    const uploadMetadata = { type, originalFilename: assetName };
    const encodedMetadata = btoa(JSON.stringify(uploadMetadata));
    const fullUploadId = `${uploadId}:${encodedMetadata}`;

    // Set up listener for upload completion
    const unlisten = await listen('asset-upload-complete', async (event) => {
      const result = event.payload as {
        upload_id: string;
        success: boolean;
        file_path?: string;
        thumbnail_path?: string;
        duration?: number;
        error?: string;
      };

      // Check if this is our upload
      const actualUploadId = result.upload_id.split(':')[0];
      if (actualUploadId !== uploadId) return;

      unlisten();

      if (result.success && result.file_path) {
        try {
          await createIntroOutro(
            type,
            assetName,
            result.file_path,
            result.duration,
            result.thumbnail_path || null,
            'completed'
          );

          const typeLabel = type === 'intro' ? 'Intro' : 'Outro';
          success(`${typeLabel} uploaded`, `"${assetName}" has been uploaded successfully`);
        } catch (dbError) {
          console.error('Failed to create database record:', dbError);
          error('Upload failed', `Failed to save asset: ${dbError}`);
        }
      } else {
        error('Upload failed', result.error || 'Unknown upload error');
      }
    });

    // Start async upload
    await invoke('upload_asset_async', {
      uploadId: fullUploadId,
      assetType: type,
      sourcePath,
      originalFilename: assetName,
    });

    // Show success message for starting upload
    const typeLabel = type === 'intro' ? 'Intro' : 'Outro';
    success(`${typeLabel} upload started`, `"${assetName}" is being processed...`);
  }

  async function uploadWatermarkAsset(sourcePath: string, assetName: string) {
    const result = await invoke<{
      destination_path: string;
      original_filename: string;
      width: number | null;
      height: number | null;
      file_size: number | null;
    }>('copy_watermark_to_storage', { sourcePath });

    await createWatermarkImage(
      assetName,
      result.destination_path,
      result.width ?? undefined,
      result.height ?? undefined,
      result.file_size ?? undefined
    );

    success('Watermark uploaded', `"${assetName}" has been uploaded successfully`);
  }

  async function uploadAudioAssetFile(sourcePath: string, assetName: string) {
    const result = await invoke<{
      destination_path: string;
      original_filename: string;
      duration: number | null;
      file_size: number | null;
      sample_rate: number | null;
      channels: number | null;
    }>('copy_audio_to_storage', { sourcePath });

    await createAudioAsset(
      assetName,
      result.destination_path,
      result.duration ?? undefined,
      result.file_size ?? undefined,
      result.sample_rate ?? undefined,
      result.channels ?? undefined
    );

    success('Audio uploaded', `"${assetName}" has been uploaded successfully`);
  }

  async function uploadImageAssetFile(sourcePath: string, assetName: string) {
    const result = await invoke<{
      destination_path: string;
      original_filename: string;
      width: number | null;
      height: number | null;
      file_size: number | null;
      mime_type: string | null;
    }>('copy_image_to_storage', { sourcePath });

    await createImageAsset(
      assetName,
      result.destination_path,
      result.width ?? undefined,
      result.height ?? undefined,
      result.file_size ?? undefined,
      result.mime_type ?? undefined
    );

    success('Image uploaded', `"${assetName}" has been uploaded successfully`);
  }
</script>
