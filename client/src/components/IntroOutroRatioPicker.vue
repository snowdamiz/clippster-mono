<template>
  <Modal
    :open="show"
    :title="`${mode === 'intro' ? 'Intro' : 'Outro'} videos per aspect ratio`"
    :description="`Upload a different ${mode} video for each aspect ratio.`"
    :icon="mode === 'intro' ? Play : SkipForward"
    size="md"
    @close="close"
  >
    <div class="flex flex-col gap-3">
      <RatioTabs v-model="activeRatio" :options="ratioTabOptions" :marked="configuredRatios" class="self-start" />

      <p class="text-xs text-fg-muted">{{ getRatioLabel(activeRatio) }}</p>

      <FileRow
        :icon="Film"
        v-if="ratioAssets[activeRatio]"
        :name="ratioAssets[activeRatio]!.name"
        :meta="ratioAssets[activeRatio]!.duration ? formatDuration(ratioAssets[activeRatio]!.duration!) : 'Video file'"
        remove-label="Remove"
        @remove="removeAsset(activeRatio)"
      />
      <Dropzone
        v-else
        :title="uploadingRatio === activeRatio ? 'Uploading…' : `Upload ${mode} video`"
        hint="MP4, MOV, AVI, MKV, WEBM"
        :loading="uploadingRatio === activeRatio"
        @select="uploadForRatio(activeRatio)"
      />
    </div>

    <template #footer>
      <Button variant="ghost" @click="close">Cancel</Button>
      <Button variant="primary" @click="save">Save settings</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { Film, Play, SkipForward } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Modal } from '@/components/ui/modal';
  import RatioTabs from '@/components/branding/RatioTabs.vue';
  import { Dropzone, FileRow } from '@/components/ui/dropzone';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { createIntroOutro, generateId } from '@/services/database';
  import { useToast } from '@/composables/useToast';
  import type { AspectRatioId, RatioAssetMap } from '@/services/database/types';

  interface RatioAssetInfo {
    assetId: string;
    name: string;
    duration?: number;
  }

  interface AspectRatio {
    id: AspectRatioId;
    label: string;
  }

  const aspectRatios: AspectRatio[] = [
    { id: '16:9', label: '16:9 (Landscape)' },
    { id: '9:16', label: '9:16 (Portrait)' },
    { id: '1:1', label: '1:1 (Square)' },
    { id: '4:5', label: '4:5 (Portrait)' },
  ];

  const props = defineProps<{
    show: boolean;
    mode: 'intro' | 'outro';
    initialSettings?: RatioAssetMap | null;
  }>();

  const emit = defineEmits<{
    'update:show': [value: boolean];
    save: [settings: RatioAssetMap];
    close: [];
  }>();

  const { success, error: showError } = useToast();

  // State
  const activeRatio = ref<AspectRatioId>('16:9');
  const uploadingRatio = ref<AspectRatioId | null>(null);
  const ratioAssets = ref<Record<AspectRatioId, RatioAssetInfo | null>>({
    '16:9': null,
    '9:16': null,
    '1:1': null,
    '4:5': null,
  });

  const ratioTabOptions = aspectRatios.map((ratio) => ({ id: ratio.id, label: ratio.id }));

  const configuredRatios = computed(() =>
    Object.fromEntries(aspectRatios.map((ratio) => [ratio.id, ratioAssets.value[ratio.id] !== null])) as Record<
      AspectRatioId,
      boolean
    >
  );

  const isRatioConfigured = (ratio: AspectRatioId): boolean => {
    return ratioAssets.value[ratio] !== null;
  };

  const getRatioLabel = (ratio: AspectRatioId): string => {
    return aspectRatios.find(r => r.id === ratio)?.label || ratio;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const close = () => {
    emit('close');
    emit('update:show', false);
  };

  const removeAsset = (ratio: AspectRatioId) => {
    ratioAssets.value[ratio] = null;
  };

  const uploadForRatio = async (ratio: AspectRatioId) => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'] },
        ],
      });

      if (!selected || typeof selected !== 'string') return;

      const fileName = selected.split(/[\\\/]/).pop() || 'file';
      uploadingRatio.value = ratio;

      const uploadId = generateId();
      const uploadMetadata = { type: props.mode, originalFilename: fileName };
      const encodedMetadata = btoa(JSON.stringify(uploadMetadata));
      const fullUploadId = `${uploadId}:${encodedMetadata}`;

      // Listen for upload completion
      const unlisten = await listen('asset-upload-complete', async (event) => {
        const result = event.payload as {
          upload_id: string;
          success: boolean;
          file_path?: string;
          thumbnail_path?: string;
          duration?: number;
          error?: string;
        };

        const actualUploadId = result.upload_id.split(':')[0];
        if (actualUploadId !== uploadId) return;

        unlisten();

        if (result.success && result.file_path) {
          try {
            const assetId = await createIntroOutro(
              props.mode,
              fileName,
              result.file_path,
              result.duration,
              result.thumbnail_path || null,
              'completed'
            );

            ratioAssets.value[ratio] = {
              assetId,
              name: fileName,
              duration: result.duration,
            };

            const typeLabel = props.mode === 'intro' ? 'Intro' : 'Outro';
            success(`${typeLabel} uploaded`, `"${fileName}" for ${ratio}`);
          } catch (dbError) {
            console.error('Failed to create database record:', dbError);
            showError('Upload failed', `Failed to save asset: ${dbError}`);
          }
        } else {
          showError('Upload failed', result.error || 'Unknown upload error');
        }

        uploadingRatio.value = null;
      });

      // Start async upload
      await invoke('upload_asset_async', {
        uploadId: fullUploadId,
        assetType: props.mode,
        sourcePath: selected,
        originalFilename: fileName,
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      showError('Upload failed', err.message || 'Failed to upload');
      uploadingRatio.value = null;
    }
  };

  const save = () => {
    const settings: RatioAssetMap = {
      '16:9': ratioAssets.value['16:9'] ? { assetId: ratioAssets.value['16:9']!.assetId } : null,
      '9:16': ratioAssets.value['9:16'] ? { assetId: ratioAssets.value['9:16']!.assetId } : null,
      '1:1': ratioAssets.value['1:1'] ? { assetId: ratioAssets.value['1:1']!.assetId } : null,
      '4:5': ratioAssets.value['4:5'] ? { assetId: ratioAssets.value['4:5']!.assetId } : null,
    };

    emit('save', settings);
    close();
  };

  const initializeFromProps = async () => {
    // Reset all
    ratioAssets.value = { '16:9': null, '9:16': null, '1:1': null, '4:5': null };

    if (!props.initialSettings) return;

    // Load asset names for any pre-configured ratios
    const { getAllIntroOutros } = await import('@/services/database');
    const allAssets = await getAllIntroOutros(props.mode);

    for (const ratio of aspectRatios) {
      const config = props.initialSettings[ratio.id];
      if (config && config.assetId) {
        const asset = allAssets.find(a => a.id === config.assetId);
        ratioAssets.value[ratio.id] = {
          assetId: config.assetId,
          name: asset?.name || 'Unknown',
          duration: asset?.duration ?? undefined,
        };
      }
    }
  };

  // Watch for show prop
  watch(() => props.show, (show) => {
    if (show) {
      activeRatio.value = '16:9';
      uploadingRatio.value = null;
      initializeFromProps();
    }
  });
</script>
