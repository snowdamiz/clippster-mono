<template>
  <div class="flex flex-col gap-5">
    <SettingsSection
      title="Clear local storage"
      description="Free up disk space by deleting local media files from your computer."
    >
      <!-- Storage usage -->
      <div v-if="storageInfo" class="animate-enter p-4">
        <div class="flex items-center justify-between gap-3">
          <p class="flex items-center gap-1.5 text-xs text-fg-muted">
            <HardDrive class="size-3.5 shrink-0 text-fg-subtle" />
            Current storage usage
          </p>
          <p class="tabular text-lg font-semibold text-fg">{{ storageInfo.total_formatted }}</p>
        </div>
        <dl v-if="storageInfo.breakdown.length > 0" class="mt-3 flex flex-col gap-1.5 border-t border-line-subtle pt-3">
          <div
            v-for="item in storageInfo.breakdown"
            :key="item.name"
            class="flex items-center justify-between gap-3 text-xs"
          >
            <dt class="truncate text-fg-muted">{{ item.name }}</dt>
            <dd class="tabular shrink-0 font-medium text-fg">{{ item.formatted }}</dd>
          </div>
        </dl>
      </div>

      <!-- Loading -->
      <div v-else-if="isCalculating" class="flex items-center justify-between gap-3 p-4" aria-busy="true">
        <div class="skeleton h-3 w-36" />
        <div class="skeleton h-5 w-20" />
        <span class="sr-only">Calculating storage usage...</span>
      </div>

      <!-- What gets deleted / preserved -->
      <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-4 p-4">
        <div class="flex flex-col gap-2">
          <h3 class="flex items-center gap-1.5 text-xs font-semibold text-fg">
            <Trash2 class="size-3.5 text-danger" />
            What will be deleted
          </h3>
          <ul class="flex flex-col gap-1.5">
            <li v-for="item in deletedItems" :key="item" class="flex items-start gap-2 text-xs text-fg-muted">
              <span class="mt-[7px] size-1 shrink-0 rounded-full bg-danger" />
              {{ item }}
            </li>
          </ul>
        </div>
        <div class="flex flex-col gap-2">
          <h3 class="flex items-center gap-1.5 text-xs font-semibold text-fg">
            <Shield class="size-3.5 text-success" />
            What will be preserved
          </h3>
          <ul class="flex flex-col gap-1.5">
            <li v-for="item in preservedItems" :key="item" class="flex items-start gap-2 text-xs text-fg-muted">
              <span class="mt-[7px] size-1 shrink-0 rounded-full bg-success" />
              {{ item }}
            </li>
          </ul>
        </div>
      </div>

      <template #footer>
        <p class="mr-auto flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
          <AlertTriangle class="size-3.5 shrink-0 text-danger" />
          Local media is deleted permanently. This cannot be undone.
        </p>
        <Button
          variant="destructive"
          size="sm"
          :disabled="!deletionEnabled || isCalculating || !storageInfo"
          @click="handleDeleteClick"
        >
          <Trash2 />
          Clear local storage
        </Button>
      </template>
    </SettingsSection>

    <!-- Confirmation Dialog -->
    <DeleteDataConfirmDialog v-model="showConfirmDialog" :storage-info="storageInfo" @deleted="handleDeleted" />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { AlertTriangle, HardDrive, Trash2, Shield, Loader2 } from 'lucide-vue-next';
  import { useToast } from '@/composables/useToast';
  import { Button } from '@/components/ui/button';
  import { invoke, performCompleteCleanup } from '@/services/settingsRuntime';
  import DeleteDataConfirmDialog from './DeleteDataConfirmDialog.vue';
  import SettingsSection from './SettingsSection.vue';

  interface StorageSizeInfo {
    total_bytes: number;
    total_formatted: string;
    breakdown: Array<{
      name: string;
      bytes: number;
      formatted: string;
    }>;
  }

  interface DeletionResult {
    success: boolean;
    bytes_freed: number;
    formatted_size: string;
    errors: string[];
  }

  const { error, success } = useToast();
  defineProps({ deletionEnabled: { type: Boolean, default: true } });

  const deletedItems = [
    'Raw videos (VOD recordings, livestream recordings)',
    'Video projects and timeline data',
    'Temporary DVR files',
    'Auto-detect temporary files',
    'Proxy files',
    'Downloaded library audio',
  ];

  const preservedItems = [
    'Built clips (final exported videos)',
    'Clip transcripts and metadata',
    'Your profile and account settings',
    'Your subscription and billing information',
  ];

  const storageInfo = ref<StorageSizeInfo | null>(null);
  const isCalculating = ref(false);
  const showConfirmDialog = ref(false);

  const calculateStorageSize = async () => {
    isCalculating.value = true;
    try {
      const info = await invoke<StorageSizeInfo>('calculate_local_storage_size');
      storageInfo.value = info;
    } catch (err) {
      console.error('Failed to calculate storage size:', err);
      error('Error', 'Failed to calculate storage size');
    } finally {
      isCalculating.value = false;
    }
  };

  const handleDeleteClick = () => {
    showConfirmDialog.value = true;
  };

  const handleDeleted = async (result: DeletionResult) => {
    if (result.success) {
      // Clean up database entries
      try {
        await performCompleteCleanup();
        success(
          'Storage Cleared',
          `Successfully freed ${result.formatted_size} of disk space. Refreshing app...`,
          undefined,
          'system'
        );

        // Reload the page after a short delay to allow toast to show
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        console.error('Failed to clean database:', err);
        error('Database Cleanup Failed', 'Files deleted but database cleanup failed', undefined, 'system');

        // Still reload to refresh UI even if database cleanup failed
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } else {
      error(
        'Deletion Failed',
        result.errors.length > 0 ? result.errors[0] : 'Failed to delete local storage',
        undefined,
        'system'
      );
    }
  };

  onMounted(() => {
    calculateStorageSize();
  });
</script>
