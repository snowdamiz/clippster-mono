<template>
  <div class="settings-tab">
    <div class="settings-section">
      <h2 class="settings-section-title">Clear Local Storage</h2>
      <p class="settings-section-description">
        Free up disk space by deleting local media files from your computer.
      </p>

      <!-- Warning Banner -->
      <div class="warning-banner">
        <div class="warning-banner__icon">
          <AlertTriangle :size="20" />
        </div>
        <div class="warning-banner__content">
          <h3 class="warning-banner__title">Permanent Deletion</h3>
          <p class="warning-banner__text">
            This will permanently delete all local media files except built clips. This action cannot be undone.
          </p>
        </div>
      </div>

      <!-- Storage Info Card -->
      <div v-if="storageInfo" class="storage-info-card">
        <div class="storage-info-card__header">
          <div class="storage-info-card__icon">
            <HardDrive :size="24" />
          </div>
          <div>
            <h3 class="storage-info-card__title">Current Storage Usage</h3>
            <p class="storage-info-card__subtitle">Space used by local media files</p>
          </div>
        </div>
        
        <div class="storage-info-card__size">
          {{ storageInfo.total_formatted }}
        </div>

        <div v-if="storageInfo.breakdown.length > 0" class="storage-info-card__breakdown">
          <div
            v-for="item in storageInfo.breakdown"
            :key="item.name"
            class="storage-breakdown-item"
          >
            <span class="storage-breakdown-item__label">{{ item.name }}</span>
            <span class="storage-breakdown-item__value">{{ item.formatted }}</span>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else-if="isCalculating" class="storage-loading">
        <Loader2 :size="24" class="animate-spin" />
        <span>Calculating storage usage...</span>
      </div>

      <!-- What Gets Deleted -->
      <div class="info-section">
        <h3 class="info-section__title">
          <Trash2 :size="18" />
          What will be deleted
        </h3>
        <ul class="info-list info-list--danger">
          <li>Raw videos (VOD recordings, livestream recordings)</li>
          <li>Video projects and timeline data</li>
          <li>Temporary DVR files</li>
          <li>Auto-detect temporary files</li>
          <li>Proxy files</li>
          <li>Downloaded library audio</li>
        </ul>
      </div>

      <!-- What Gets Preserved -->
      <div class="info-section">
        <h3 class="info-section__title info-section__title--success">
          <Shield :size="18" />
          What will be preserved
        </h3>
        <ul class="info-list info-list--success">
          <li>Built clips (final exported videos)</li>
          <li>Clip transcripts and metadata</li>
          <li>Your profile and account settings</li>
          <li>Your subscription and billing information</li>
        </ul>
      </div>

      <!-- Action Button -->
      <div class="settings-actions">
        <button
          @click="handleDeleteClick"
          class="btn-danger"
          :disabled="isCalculating || !storageInfo"
        >
          <Trash2 :size="18" />
          Clear Local Storage
        </button>
      </div>
    </div>

    <!-- Confirmation Dialog -->
    <DeleteDataConfirmDialog
      v-model="showConfirmDialog"
      :storage-info="storageInfo"
      @deleted="handleDeleted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AlertTriangle, HardDrive, Trash2, Shield, Loader2 } from 'lucide-vue-next';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/composables/useToast';
import { performCompleteCleanup } from '@/services/database/storage-cleanup';
import DeleteDataConfirmDialog from './DeleteDataConfirmDialog.vue';

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
      success('Storage Cleared', `Successfully freed ${result.formatted_size} of disk space. Refreshing app...`, undefined, 'system');
      
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
    error('Deletion Failed', result.errors.length > 0 ? result.errors[0] : 'Failed to delete local storage', undefined, 'system');
  }
};

onMounted(() => {
  calculateStorageSize();
});
</script>

<style scoped>
.settings-tab {
  max-width: 800px;
}

.settings-section {
  margin-bottom: 2rem;
}

.settings-section-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #fff;
}

.settings-section-description {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 1.5rem;
}

.warning-banner {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.warning-banner__icon {
  flex-shrink: 0;
  color: #ef4444;
}

.warning-banner__content {
  flex: 1;
}

.warning-banner__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #ef4444;
  margin-bottom: 0.25rem;
}

.warning-banner__text {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.8);
}

.storage-info-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.storage-info-card__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.storage-info-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 8px;
  color: #8b5cf6;
}

.storage-info-card__title {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}

.storage-info-card__subtitle {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.storage-info-card__size {
  font-size: 2.5rem;
  font-weight: 700;
  color: #8b5cf6;
  margin-bottom: 1rem;
}

.storage-info-card__breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.storage-breakdown-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
}

.storage-breakdown-item__label {
  color: rgba(255, 255, 255, 0.6);
}

.storage-breakdown-item__value {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.storage-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin-bottom: 1.5rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
}

.info-section {
  margin-bottom: 1.5rem;
}

.info-section__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #ef4444;
  margin-bottom: 0.75rem;
}

.info-section__title--success {
  color: #10b981;
}

.info-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-list li {
  font-size: 0.8125rem;
  padding-left: 1.5rem;
  position: relative;
}

.info-list li::before {
  content: '•';
  position: absolute;
  left: 0.5rem;
  font-weight: bold;
}

.info-list--danger li {
  color: rgba(255, 255, 255, 0.7);
}

.info-list--danger li::before {
  color: #ef4444;
}

.info-list--success li {
  color: rgba(255, 255, 255, 0.7);
}

.info-list--success li::before {
  color: #10b981;
}

.settings-actions {
  display: flex;
  gap: 1rem;
  padding-top: 1rem;
}

.btn-danger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
  transform: translateY(-1px);
}

.btn-danger:active:not(:disabled) {
  transform: translateY(0);
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
