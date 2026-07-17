<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import {
    type SharedAudio,
    listOrganizationSharedAudio,
    getUserSharedAudio,
    deleteSharedAudio,
    getExpirationText,
    markSharedAudioViewed,
  } from '@/services/sharedAudioApi';
  import { downloadSharedAudioToLibrary } from '@/services/sharedAudioDownload';
  import { useToast } from '@/composables/useToast';
  import {
    Music,
    Download,
    Clock,
    Loader2,
    Trash2,
    AlertCircle,
    RefreshCw,
    Users,
    UserCheck,
    Eye,
    CheckCircle,
    Play,
    X,
  } from 'lucide-vue-next';

  const props = defineProps<{
    organizationId: string | number;
    organizationName: string;
    isAdmin: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'share-audio'): void;
  }>();

  const { success: showSuccess, error: showError } = useToast();

  const audioFiles = ref<SharedAudio[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const downloadingId = ref<number | null>(null);
  const deletingId = ref<number | null>(null);
  const previewAudio = ref<SharedAudio | null>(null);

  const sharingFilter = ref<'all' | 'everyone' | 'specific'>('all');

  const filteredAudio = computed(() => {
    let result = [...audioFiles.value];

    if (sharingFilter.value === 'everyone') {
      result = result.filter((a) => a.share_with_all);
    } else if (sharingFilter.value === 'specific') {
      result = result.filter((a) => !a.share_with_all);
    }

    return result.sort(
      (a, b) => new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime()
    );
  });

  async function loadAudio() {
    loading.value = true;
    error.value = null;

    try {
      const response = props.isAdmin
        ? await listOrganizationSharedAudio(props.organizationId)
        : await getUserSharedAudio();

      if (response.success) {
        audioFiles.value = props.isAdmin
          ? response.audio
          : response.audio.filter((a) => String(a.organization_id) === String(props.organizationId));
      } else {
        error.value = response.error || 'Failed to load shared audio';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to load shared audio';
    } finally {
      loading.value = false;
    }
  }

  async function handlePreview(audio: SharedAudio) {
    previewAudio.value = audio;
    if (!audio.viewed_at) {
      await markSharedAudioViewed(audio.id);
      audio.viewed_at = new Date().toISOString();
    }
  }

  async function handleDownload(audio: SharedAudio) {
    downloadingId.value = audio.id;

    try {
      const result = await downloadSharedAudioToLibrary(audio, props.organizationName);
      if (result.success) {
        audio.downloaded_at = new Date().toISOString();
        showSuccess(
          result.alreadyExists
            ? `"${audio.name}" is already in your audio library`
            : `"${audio.name}" added to your audio library`
        );
      } else {
        showError(result.error || 'Failed to download audio');
      }
    } catch (err: any) {
      showError(err.message || 'Failed to download audio');
    } finally {
      downloadingId.value = null;
    }
  }

  async function handleDelete(audio: SharedAudio) {
    if (!confirm(`Delete "${audio.name}"? This cannot be undone.`)) return;

    deletingId.value = audio.id;
    try {
      const response = await deleteSharedAudio(props.organizationId, audio.id);
      if (response.success) {
        audioFiles.value = audioFiles.value.filter((a) => a.id !== audio.id);
        showSuccess('Audio deleted');
      } else {
        showError(response.error || 'Failed to delete audio');
      }
    } catch (err: any) {
      showError(err.message || 'Failed to delete audio');
    } finally {
      deletingId.value = null;
    }
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return 'Unknown';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  onMounted(loadAudio);

  defineExpose({ loadAudio });
</script>

<template>
  <section class="shared-audio">
    <div class="shared-audio__toolbar">
      <div class="shared-audio__filters">
        <button
          class="shared-audio__filter"
          :class="{ 'shared-audio__filter--active': sharingFilter === 'all' }"
          @click="sharingFilter = 'all'"
        >
          All
        </button>
        <button
          class="shared-audio__filter"
          :class="{ 'shared-audio__filter--active': sharingFilter === 'everyone' }"
          @click="sharingFilter = 'everyone'"
        >
          <Users :size="14" />
          All Members
        </button>
        <button
          class="shared-audio__filter"
          :class="{ 'shared-audio__filter--active': sharingFilter === 'specific' }"
          @click="sharingFilter = 'specific'"
        >
          <UserCheck :size="14" />
          Specific
        </button>
      </div>

      <div class="shared-audio__actions">
        <button class="shared-audio__refresh" @click="loadAudio" :disabled="loading">
          <RefreshCw :size="16" :class="{ 'shared-audio__spin': loading }" />
        </button>
        <button v-if="isAdmin" class="shared-audio__share-btn" @click="emit('share-audio')">
          <Music :size="16" />
          Share Audio
        </button>
      </div>
    </div>

    <div v-if="loading && audioFiles.length === 0" class="shared-audio__loading">
      <Loader2 class="shared-audio__spin" :size="32" />
    </div>

    <div v-else-if="error" class="shared-audio__error">
      <AlertCircle :size="24" />
      <p>{{ error }}</p>
      <button @click="loadAudio">Try Again</button>
    </div>

    <div v-else-if="filteredAudio.length === 0" class="shared-audio__empty">
      <Music :size="48" />
      <h3>No shared audio yet</h3>
      <p>
        {{
          isAdmin
            ? 'Share music or sound effects with your team for use in clips'
            : 'No audio has been shared with you yet'
        }}
      </p>
      <button v-if="isAdmin" class="shared-audio__share-btn" @click="emit('share-audio')">
        Share Audio
      </button>
    </div>

    <div v-else class="shared-audio__grid">
      <div
        v-for="audio in filteredAudio"
        :key="audio.id"
        class="shared-audio__card"
        :class="{ 'shared-audio__card--new': !audio.viewed_at && !isAdmin }"
      >
        <div class="shared-audio__card-icon" @click="handlePreview(audio)">
          <Music :size="28" />
          <span v-if="audio.duration" class="shared-audio__duration">{{ formatDuration(audio.duration) }}</span>
        </div>

        <div class="shared-audio__card-body">
          <div class="shared-audio__card-header">
            <h4>{{ audio.name }}</h4>
            <span class="shared-audio__expiry">
              <Clock :size="12" />
              {{ getExpirationText(audio.days_until_expiration) }}
            </span>
          </div>

          <p v-if="audio.description" class="shared-audio__description">{{ audio.description }}</p>

          <div class="shared-audio__meta">
            <span>{{ formatFileSize(audio.file_size) }}</span>
            <span v-if="audio.downloaded_at" class="shared-audio__downloaded">
              <CheckCircle :size="12" />
              In library
            </span>
            <template v-if="isAdmin && audio.stats">
              <span><Eye :size="12" /> {{ audio.stats.viewed }}</span>
              <span><Download :size="12" /> {{ audio.stats.downloaded }}</span>
            </template>
          </div>

          <div class="shared-audio__card-actions">
            <button class="shared-audio__btn" @click="handlePreview(audio)">
              <Play :size="14" />
              Preview
            </button>
            <button
              class="shared-audio__btn shared-audio__btn--primary"
              @click="handleDownload(audio)"
              :disabled="downloadingId === audio.id"
            >
              <Loader2 v-if="downloadingId === audio.id" :size="14" class="shared-audio__spin" />
              <Download v-else :size="14" />
              Add to Library
            </button>
            <button
              v-if="isAdmin"
              class="shared-audio__btn shared-audio__btn--danger"
              @click="handleDelete(audio)"
              :disabled="deletingId === audio.id"
            >
              <Loader2 v-if="deletingId === audio.id" :size="14" class="shared-audio__spin" />
              <Trash2 v-else :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="previewAudio" class="shared-audio__preview-overlay" @click.self="previewAudio = null">
        <div class="shared-audio__preview">
          <button class="shared-audio__preview-close" @click="previewAudio = null">
            <X :size="18" />
          </button>
          <h3>{{ previewAudio.name }}</h3>
          <audio v-if="previewAudio.url" :src="previewAudio.url" controls class="shared-audio__player" />
          <p v-if="previewAudio.description">{{ previewAudio.description }}</p>
          <button class="shared-audio__btn shared-audio__btn--primary" @click="handleDownload(previewAudio)">
            <Download :size="14" />
            Add to Library
          </button>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
  .shared-audio {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .shared-audio__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .shared-audio__filters {
    display: flex;
    gap: 0.5rem;
  }

  .shared-audio__filter {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
  }

  .shared-audio__filter--active {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.4);
    color: #c084fc;
  }

  .shared-audio__actions {
    display: flex;
    gap: 0.5rem;
  }

  .shared-audio__refresh {
    padding: 0.5rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
  }

  .shared-audio__share-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    background: linear-gradient(135deg, #a855f7, #7c3aed);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
  }

  .shared-audio__loading,
  .shared-audio__error,
  .shared-audio__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem;
    text-align: center;
    color: var(--sidebar-text-muted);
    border: 1px dashed var(--sidebar-border);
    border-radius: 12px;
  }

  .shared-audio__empty h3 {
    color: var(--sidebar-text);
    margin: 0;
  }

  .shared-audio__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
  }

  .shared-audio__card {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
  }

  .shared-audio__card--new {
    border-color: rgba(168, 85, 247, 0.5);
    box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.2);
  }

  .shared-audio__card-icon {
    position: relative;
    flex-shrink: 0;
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(168, 85, 247, 0.15);
    border-radius: 10px;
    color: #a855f7;
    cursor: pointer;
  }

  .shared-audio__duration {
    position: absolute;
    bottom: 4px;
    right: 4px;
    font-size: 0.625rem;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .shared-audio__card-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .shared-audio__card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .shared-audio__card-header h4 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shared-audio__expiry {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    white-space: nowrap;
  }

  .shared-audio__description {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .shared-audio__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .shared-audio__meta span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .shared-audio__downloaded {
    color: #4ade80;
  }

  .shared-audio__card-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: auto;
  }

  .shared-audio__btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    color: var(--sidebar-text);
    cursor: pointer;
  }

  .shared-audio__btn--primary {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.4);
    color: #c084fc;
  }

  .shared-audio__btn--danger {
    padding: 0.375rem;
    color: #f87171;
  }

  .shared-audio__preview-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .shared-audio__preview {
    position: relative;
    width: 100%;
    max-width: 480px;
    padding: 1.5rem;
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .shared-audio__preview h3 {
    margin: 0;
    color: var(--sidebar-text);
  }

  .shared-audio__preview-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: transparent;
    border: none;
    color: var(--sidebar-text-muted);
    cursor: pointer;
  }

  .shared-audio__player {
    width: 100%;
  }

  .shared-audio__spin {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
