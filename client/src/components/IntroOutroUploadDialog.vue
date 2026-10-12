<template>
  <Modal
    :open="show"
    title="Upload intro/outro"
    :description="selectedFile ? 'Configure your intro or outro.' : 'Select a video file to upload.'"
    :icon="Upload"
    size="md"
    :dismissible="!isUploading"
    @close="handleClose"
  >
    <Dropzone
      v-if="!selectedFile"
      :icon="FolderOpen"
      title="Click to browse video files"
      hint="MP4, MOV, AVI, MKV, WEBM, and more"
      @select="selectFile"
    />

    <div v-else class="flex animate-enter flex-col gap-4">
      <FileRow
        :icon="Film"
        :name="selectedFile.name"
        :meta="`${fileExtension.toUpperCase()} file`"
        remove-label="Remove file"
        @remove="clearSelectedFile"
      />

      <Field label="Type">
        <SegmentedControl v-model="selectedType" :options="typeOptions" block />
      </Field>

      <Field label="Name">
        <template #label-end><span class="text-2xs text-fg-subtle">Optional</span></template>
        <Input v-model="customName" :placeholder="selectedFile.name" />
      </Field>
    </div>

    <template #footer>
      <Button variant="ghost" :disabled="isUploading" @click="handleClose">Cancel</Button>
      <Button
        v-if="selectedFile"
        variant="primary"
        :loading="isUploading"
        :disabled="!selectedType"
        @click="handleUpload"
      >
        <Upload v-if="!isUploading" />
        {{ isUploading ? 'Uploading…' : 'Upload' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Upload, Play, Square, FolderOpen, Film } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { Dropzone, FileRow } from '@/components/ui/dropzone';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { createIntroOutro } from '@/services/database';
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
  const selectedType = ref<'intro' | 'outro'>('intro');
  const customName = ref('');
  const isUploading = ref(false);

  const typeOptions: SegmentedOption<'intro' | 'outro'>[] = [
    { value: 'intro', label: 'Intro', icon: Play },
    { value: 'outro', label: 'Outro', icon: Square },
  ];

  // Reset state when dialog is closed
  watch(
    () => props.show,
    (newValue) => {
      if (!newValue) {
        // Reset state when dialog closes
        setTimeout(() => {
          selectedFile.value = null;
          fileExtension.value = '';
          selectedType.value = 'intro';
          customName.value = '';
        }, 200); // Wait for animation to complete
      }
    }
  );

  async function selectFile() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');

      const filters = [
        {
          name: 'Video Files',
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'],
        },
      ];

      const selected = await open({ multiple: false, filters });
      if (!selected || typeof selected !== 'string') return;

      const fileName = selected.split(/[\\\/]/).pop() || 'file';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      selectedFile.value = { name: fileName, path: selected };
      fileExtension.value = ext;
    } catch (err: any) {
      console.error('File selection failed:', err);
      error('File selection failed', err.message || 'Failed to select file');
    }
  }

  function clearSelectedFile() {
    selectedFile.value = null;
    fileExtension.value = '';
    selectedType.value = 'intro';
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
      await uploadVideoAsset(sourcePath, assetName, selectedType.value);
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
</script>
