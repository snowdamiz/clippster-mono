<template>
  <Modal
    :open="modelValue"
    title="Clear local storage"
    description="Permanently delete local media files"
    :icon="Trash2"
    tone="danger"
    size="md"
    :dismissible="!isDeleting"
    :hide-close="isDeleting"
    @update:open="(open) => !open && handleCancel()"
  >
    <!-- Progress -->
    <div v-if="isDeleting" class="flex flex-col gap-3 py-2" aria-live="polite">
      <div class="flex items-center justify-between gap-3">
        <span class="flex min-w-0 items-center gap-2 text-sm text-fg">
          <Loader2 class="size-4 shrink-0 animate-spin text-fg-muted" />
          <span class="truncate">{{ deletionProgress.operation }}</span>
        </span>
        <span class="tabular shrink-0 text-xs text-fg-muted">{{ deletionProgress.percentage }}% complete</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-surface-hover">
        <div
          class="h-full rounded-full bg-danger-solid transition-[width] duration-300"
          :style="{ width: deletionProgress.percentage + '%' }"
        />
      </div>
    </div>

    <div v-else class="flex flex-col gap-4">
      <!-- Space to be freed -->
      <div v-if="storageInfo" class="rounded-lg border border-line-subtle bg-surface p-3">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-fg-muted">Space to be freed</span>
          <span class="tabular text-base font-semibold text-fg">{{ storageInfo.total_formatted }}</span>
        </div>
        <dl v-if="storageInfo.breakdown.length > 0" class="mt-2 flex flex-col gap-1 border-t border-line-subtle pt-2">
          <div v-for="item in storageInfo.breakdown" :key="item.name" class="flex items-center justify-between gap-3 text-xs">
            <dt class="truncate text-fg-subtle">{{ item.name }}</dt>
            <dd class="tabular shrink-0 text-fg-muted">{{ item.formatted }}</dd>
          </div>
        </dl>
      </div>

      <!-- Warning -->
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>This action cannot be undone</AlertTitle>
        <AlertDescription class="flex flex-col gap-1.5">
          <p>
            Permanently deletes all raw videos (VOD and livestream recordings), video projects and timeline data,
            temporary DVR and auto-detect files, proxy files, and downloaded library audio.
          </p>
          <p>
            <span class="font-medium text-fg">Kept:</span> built clips (final exported videos), clip thumbnails, clip
            transcripts and metadata, and your profile and account settings.
          </p>
        </AlertDescription>
      </Alert>

      <!-- Confirmation input -->
      <Field for="delete-data-confirm">
        <template #label>Type <span class="font-semibold text-fg">confirm</span> to proceed</template>
        <Input
          id="delete-data-confirm"
          v-model="confirmText"
          type="text"
          placeholder="confirm"
          autocomplete="off"
          :disabled="isDeleting"
          @keyup.enter="handleDelete"
        />
      </Field>
    </div>

    <template v-if="!isDeleting" #footer>
      <Button variant="ghost" @click="handleCancel">Cancel</Button>
      <Button variant="destructive" :disabled="!isConfirmValid" @click="handleDelete">
        <Trash2 />
        Delete everything
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-vue-next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface StorageSizeInfo {
  total_bytes: number;
  total_formatted: string;
  breakdown: Array<{
    name: string;
    bytes: number;
    formatted: string;
  }>;
}

interface DeletionProgress {
  operation: string;
  percentage: number;
}

interface DeletionResult {
  success: boolean;
  bytes_freed: number;
  formatted_size: string;
  errors: string[];
}

const props = defineProps<{
  modelValue: boolean;
  storageInfo: StorageSizeInfo | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'deleted': [result: DeletionResult];
}>();

const confirmText = ref('');
const isDeleting = ref(false);
const deletionProgress = ref<DeletionProgress>({
  operation: 'Preparing...',
  percentage: 0,
});

const isConfirmValid = computed(() => {
  return confirmText.value.toLowerCase() === 'confirm';
});

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    confirmText.value = '';
    isDeleting.value = false;
    deletionProgress.value = {
      operation: 'Preparing...',
      percentage: 0,
    };
  }
});

const handleCancel = () => {
  if (!isDeleting.value) {
    emit('update:modelValue', false);
  }
};

const handleDelete = async () => {
  if (!isConfirmValid.value || isDeleting.value) {
    return;
  }

  isDeleting.value = true;
  deletionProgress.value = {
    operation: 'Starting deletion...',
    percentage: 0,
  };

  const unlisten = await listen<DeletionProgress>('deletion-progress', (event) => {
    deletionProgress.value = event.payload;
  });

  try {
    const result = await invoke<DeletionResult>('delete_local_storage');
    
    unlisten();
    emit('deleted', result);
    emit('update:modelValue', false);
  } catch (error) {
    console.error('Failed to delete local storage:', error);
    unlisten();
    
    const errorResult: DeletionResult = {
      success: false,
      bytes_freed: 0,
      formatted_size: '0 bytes',
      errors: [String(error)],
    };
    
    emit('deleted', errorResult);
    emit('update:modelValue', false);
  } finally {
    isDeleting.value = false;
  }
};
</script>
