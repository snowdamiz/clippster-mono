<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { BrandingConfig, createSharedClip, SharedClip } from '@/services/sharedClipsApi';
  import { listOrganizationAssets, ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { Upload, Loader2, Video, Image as ImageIcon, AlertCircle, Share2, X, Users, Palette } from 'lucide-vue-next';

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
  const activeAspectRatio = ref('16:9');

  const watermarks = computed(() => orgAssets.value.filter((a) => a.asset_type === 'watermark'));
  const intros = computed(() => orgAssets.value.filter((a) => a.asset_type === 'intro'));
  const outros = computed(() => orgAssets.value.filter((a) => a.asset_type === 'outro'));

  const canSubmit = computed(() => {
    return file.value && name.value.trim() && !uploading.value;
  });

  const fileInputRef = ref<HTMLInputElement | null>(null);
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
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="share-dialog__overlay" @click.self="close" @keydown.esc="close">
        <Transition name="dialog" appear>
          <div v-if="open" class="share-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="share-dialog__accent"></div>

            <!-- Header -->
            <div class="share-dialog__header">
              <button class="share-dialog__close" @click="close" title="Close" :disabled="uploading">
                <X :size="18" />
              </button>
              <div class="share-dialog__icon">
                <Share2 :size="24" />
              </div>
              <h2 class="share-dialog__title">Share Clip</h2>
              <p class="share-dialog__subtitle">Upload a video clip to share with your organization</p>
            </div>

            <!-- Content -->
            <div class="share-dialog__content">
              <form @submit.prevent="handleSubmit" class="share-dialog__form">
                <p class="share-dialog__description">
                  Upload a video to share with organization members. Clips will expire after 7 days.
                </p>

                <!-- File Upload -->
                <div class="share-dialog__field">
                  <label class="share-dialog__label">Video File *</label>
                  <div
                    class="share-dialog__upload-zone"
                    :class="{ 'share-dialog__upload-zone--has-file': file }"
                    @click="fileInputRef?.click()"
                  >
                    <input
                      ref="fileInputRef"
                      type="file"
                      accept="video/*"
                      class="share-dialog__file-input"
                      @change="handleFileSelect"
                    />
                    <div v-if="file" class="share-dialog__file-preview">
                      <Video class="share-dialog__file-icon" />
                      <div class="share-dialog__file-info">
                        <span class="share-dialog__file-name">{{ file.name }}</span>
                        <span class="share-dialog__file-meta">
                          {{ (file.size / (1024 * 1024)).toFixed(1) }} MB
                          <template v-if="duration">• {{ formatDuration(duration) }}</template>
                        </span>
                      </div>
                    </div>
                    <div v-else class="share-dialog__upload-placeholder">
                      <Upload class="share-dialog__upload-icon" />
                      <span class="share-dialog__upload-text">Click to upload or drag and drop</span>
                      <span class="share-dialog__upload-hint">MP4, MOV, WebM (max 500MB, 3 minutes)</span>
                    </div>
                  </div>
                </div>

                <!-- Name -->
                <div class="share-dialog__field">
                  <label class="share-dialog__label">Name *</label>
                  <input
                    v-model="name"
                    type="text"
                    class="share-dialog__input"
                    placeholder="Enter clip name"
                    :disabled="uploading"
                  />
                </div>

                <!-- Description -->
                <div class="share-dialog__field">
                  <label class="share-dialog__label">Description</label>
                  <textarea
                    v-model="description"
                    class="share-dialog__textarea"
                    placeholder="Optional description or instructions"
                    :disabled="uploading"
                    rows="2"
                  ></textarea>
                </div>

                <!-- Thumbnail -->
                <div class="share-dialog__field">
                  <label class="share-dialog__label">Thumbnail</label>
                  <div class="share-dialog__thumbnail-row">
                    <button
                      type="button"
                      class="share-dialog__thumbnail-btn"
                      @click="thumbnailInputRef?.click()"
                      :disabled="uploading"
                    >
                      <ImageIcon :size="16" />
                      {{ thumbnail ? 'Change' : 'Upload' }} Thumbnail
                    </button>
                    <input
                      ref="thumbnailInputRef"
                      type="file"
                      accept="image/*"
                      class="share-dialog__file-input"
                      @change="handleThumbnailSelect"
                    />
                    <span v-if="thumbnail" class="share-dialog__thumbnail-name">
                      {{ thumbnail.name }}
                    </span>
                  </div>
                </div>

                <!-- Recipients Section -->
                <div class="share-dialog__section">
                  <div class="share-dialog__section-header">
                    <Users :size="16" class="share-dialog__section-icon" />
                    <span class="share-dialog__section-title">Recipients</span>
                  </div>

                  <div class="share-dialog__toggle-row">
                    <span class="share-dialog__toggle-label">Share with all members</span>
                    <button
                      type="button"
                      class="share-dialog__toggle"
                      :class="{ 'share-dialog__toggle--active': shareWithAll }"
                      @click="shareWithAll = !shareWithAll"
                      :disabled="uploading"
                    >
                      <span class="share-dialog__toggle-knob"></span>
                    </button>
                  </div>

                  <div v-if="!shareWithAll" class="share-dialog__recipients-list">
                    <label v-for="member in members" :key="member.user_id" class="share-dialog__recipient">
                      <input
                        type="checkbox"
                        :value="member.user_id"
                        v-model="selectedRecipients"
                        :disabled="uploading"
                        class="share-dialog__checkbox"
                      />
                      <span class="share-dialog__recipient-name">{{ member.user.name || member.user.email }}</span>
                    </label>
                    <p class="share-dialog__recipients-count">{{ selectedRecipients.length }} member(s) selected</p>
                  </div>
                </div>

                <!-- Branding Section -->
                <div class="share-dialog__section">
                  <div class="share-dialog__section-header">
                    <Palette :size="16" class="share-dialog__section-icon" />
                    <span class="share-dialog__section-title">Branding</span>
                  </div>

                  <div class="share-dialog__toggle-row">
                    <div class="share-dialog__toggle-info">
                      <span class="share-dialog__toggle-label">Require Branding on Export</span>
                      <span class="share-dialog__toggle-hint">Members cannot disable branding when exporting</span>
                    </div>
                    <button
                      type="button"
                      class="share-dialog__toggle"
                      :class="{ 'share-dialog__toggle--active': brandingRequired }"
                      @click="brandingRequired = !brandingRequired"
                      :disabled="uploading"
                    >
                      <span class="share-dialog__toggle-knob"></span>
                    </button>
                  </div>

                  <!-- Aspect Ratio Tabs -->
                  <div class="share-dialog__tabs">
                    <button
                      v-for="ratio in aspectRatios"
                      :key="ratio"
                      type="button"
                      class="share-dialog__tab"
                      :class="{ 'share-dialog__tab--active': activeAspectRatio === ratio }"
                      @click="activeAspectRatio = ratio"
                    >
                      {{ ratio }}
                    </button>
                  </div>

                  <!-- Branding Config for Active Ratio -->
                  <div class="share-dialog__branding-fields">
                    <div class="share-dialog__field">
                      <label class="share-dialog__label">Watermark</label>
                      <select
                        :value="getBrandingValue(activeAspectRatio, 'watermark_id')"
                        @change="
                          updateBrandingForAspectRatio(
                            activeAspectRatio,
                            'watermark_id',
                            ($event.target as HTMLSelectElement).value
                          )
                        "
                        class="share-dialog__select"
                      >
                        <option value="none">None</option>
                        <option v-for="asset in watermarks" :key="asset.id" :value="String(asset.id)">
                          {{ asset.name }}
                        </option>
                      </select>
                    </div>

                    <div class="share-dialog__field">
                      <label class="share-dialog__label">Intro Video</label>
                      <select
                        :value="getBrandingValue(activeAspectRatio, 'intro_id')"
                        @change="
                          updateBrandingForAspectRatio(
                            activeAspectRatio,
                            'intro_id',
                            ($event.target as HTMLSelectElement).value
                          )
                        "
                        class="share-dialog__select"
                      >
                        <option value="none">None</option>
                        <option v-for="asset in intros" :key="asset.id" :value="String(asset.id)">
                          {{ asset.name }}
                        </option>
                      </select>
                    </div>

                    <div class="share-dialog__field">
                      <label class="share-dialog__label">Outro Video</label>
                      <select
                        :value="getBrandingValue(activeAspectRatio, 'outro_id')"
                        @change="
                          updateBrandingForAspectRatio(
                            activeAspectRatio,
                            'outro_id',
                            ($event.target as HTMLSelectElement).value
                          )
                        "
                        class="share-dialog__select"
                      >
                        <option value="none">None</option>
                        <option v-for="asset in outros" :key="asset.id" :value="String(asset.id)">
                          {{ asset.name }}
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- Error -->
                <div v-if="error" class="share-dialog__error">
                  <AlertCircle :size="16" />
                  <span>{{ error }}</span>
                </div>
              </form>
            </div>

            <!-- Footer -->
            <div class="share-dialog__footer">
              <button
                type="button"
                class="share-dialog__btn share-dialog__btn--secondary"
                @click="close"
                :disabled="uploading"
              >
                Cancel
              </button>
              <button
                type="button"
                class="share-dialog__btn share-dialog__btn--primary"
                @click="handleSubmit"
                :disabled="!canSubmit"
              >
                <Loader2 v-if="uploading" class="share-dialog__btn-spinner" />
                {{ uploading ? 'Uploading...' : 'Share Clip' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  /* ===== Overlay ===== */
  .share-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  /* ===== Dialog Container ===== */
  .share-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 560px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .share-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .share-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .share-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .share-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .share-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .share-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .share-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .share-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .share-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
  }

  .share-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .share-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .share-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Form ===== */
  .share-dialog__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .share-dialog__description {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  /* ===== Form Field ===== */
  .share-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .share-dialog__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .share-dialog__input,
  .share-dialog__select,
  .share-dialog__textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .share-dialog__input::placeholder,
  .share-dialog__textarea::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .share-dialog__input:focus,
  .share-dialog__select:focus,
  .share-dialog__textarea:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .share-dialog__textarea {
    resize: vertical;
    min-height: 60px;
    line-height: 1.5;
  }

  .share-dialog__select {
    cursor: pointer;
  }

  .share-dialog__select option {
    background-color: var(--sidebar-surface);
    color: var(--sidebar-text);
  }

  /* ===== File Upload Zone ===== */
  .share-dialog__upload-zone {
    border: 2px dashed var(--sidebar-border);
    border-radius: 10px;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: center;
  }

  .share-dialog__upload-zone:hover {
    border-color: var(--sidebar-accent);
    background-color: rgba(6, 182, 212, 0.05);
  }

  .share-dialog__upload-zone--has-file {
    border-style: solid;
    border-color: var(--sidebar-accent);
    background-color: rgba(6, 182, 212, 0.05);
  }

  .share-dialog__file-input {
    display: none;
  }

  .share-dialog__file-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .share-dialog__file-icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-accent);
  }

  .share-dialog__file-info {
    text-align: left;
  }

  .share-dialog__file-name {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .share-dialog__file-meta {
    display: block;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  .share-dialog__upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .share-dialog__upload-icon {
    width: 40px;
    height: 40px;
    color: var(--sidebar-text-muted);
  }

  .share-dialog__upload-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .share-dialog__upload-hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }

  /* ===== Thumbnail ===== */
  .share-dialog__thumbnail-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .share-dialog__thumbnail-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .share-dialog__thumbnail-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .share-dialog__thumbnail-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .share-dialog__thumbnail-name {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  /* ===== Section ===== */
  .share-dialog__section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .share-dialog__section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .share-dialog__section-icon {
    color: var(--sidebar-accent);
  }

  .share-dialog__section-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  /* ===== Toggle ===== */
  .share-dialog__toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .share-dialog__toggle-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .share-dialog__toggle-label {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
  }

  .share-dialog__toggle-hint {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .share-dialog__toggle {
    position: relative;
    width: 40px;
    height: 22px;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 11px;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .share-dialog__toggle--active {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
  }

  .share-dialog__toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background-color: white;
    border-radius: 50%;
    transition: transform 150ms ease;
  }

  .share-dialog__toggle--active .share-dialog__toggle-knob {
    transform: translateX(18px);
  }

  .share-dialog__toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== Recipients List ===== */
  .share-dialog__recipients-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 150px;
    overflow-y: auto;
    padding: 0.5rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .share-dialog__recipient {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .share-dialog__recipient:hover {
    background-color: var(--sidebar-hover);
  }

  .share-dialog__checkbox {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    accent-color: var(--sidebar-accent);
  }

  .share-dialog__recipient-name {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
  }

  .share-dialog__recipients-count {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0.5rem 0 0;
    padding-top: 0.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Tabs ===== */
  .share-dialog__tabs {
    display: flex;
    gap: 0.375rem;
  }

  .share-dialog__tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .share-dialog__tab:hover {
    background-color: var(--sidebar-surface);
    color: var(--sidebar-text);
  }

  .share-dialog__tab--active {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .share-dialog__tab--active:hover {
    background-color: rgba(6, 182, 212, 0.2);
    color: var(--sidebar-accent);
  }

  /* ===== Branding Fields ===== */
  .share-dialog__branding-fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.5rem;
  }

  /* ===== Error ===== */
  .share-dialog__error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 8px;
    font-size: 0.8125rem;
    color: #f87171;
  }

  /* ===== Footer ===== */
  .share-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .share-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .share-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .share-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .share-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .share-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .share-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .share-dialog__btn-spinner {
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
