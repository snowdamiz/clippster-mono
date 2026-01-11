<template>
  <Teleport to="body">
    <Transition name="asset-modal">
      <div v-if="show" class="asset-modal__overlay" @click.self="$emit('close')">
        <Transition name="asset-dialog" appear>
          <div class="asset-modal">
            <!-- Accent Bar -->
            <div class="asset-modal__accent" />

            <!-- Header -->
            <div class="asset-modal__header">
              <button class="asset-modal__close" @click="$emit('close')" title="Close">
                <X :size="18" />
              </button>
              <div class="asset-modal__icon">
                <Upload :size="24" />
              </div>
              <h2 class="asset-modal__title">Upload Asset</h2>
              <p class="asset-modal__subtitle">Select the type of media to add to your library</p>
            </div>

            <!-- Content -->
            <div class="asset-content">
              <!-- Asset Type Selection - Vertical List -->
              <div class="asset-type-list">
                <!-- Intro -->
                <button
                  @click="selectedType = 'intro'"
                  class="asset-type-card"
                  :class="{ 'asset-type-card--active': selectedType === 'intro' }"
                  :data-color="'cyan'"
                >
                  <div
                    class="asset-type-card__icon"
                    :class="
                      selectedType === 'intro' ? 'asset-type-card__icon--cyan-active' : 'asset-type-card__icon--cyan'
                    "
                  >
                    <Play :size="18" />
                  </div>
                  <div class="asset-type-card__content">
                    <div class="asset-type-card__header">
                      <span class="asset-type-card__name">Intro</span>
                      <Transition name="check-pop">
                        <div
                          v-if="selectedType === 'intro'"
                          class="asset-type-card__check asset-type-card__check--cyan"
                        >
                          <Check :size="10" />
                        </div>
                      </Transition>
                    </div>
                    <p class="asset-type-card__desc">Opening clip before content</p>
                    <div class="asset-type-card__formats">
                      <span
                        v-for="format in ['MP4', 'MOV', 'WebM']"
                        :key="format"
                        class="format-pill format-pill--cyan"
                      >
                        {{ format }}
                      </span>
                    </div>
                  </div>
                </button>

                <!-- Outro -->
                <button
                  @click="selectedType = 'outro'"
                  class="asset-type-card"
                  :class="{ 'asset-type-card--active': selectedType === 'outro' }"
                  :data-color="'violet'"
                >
                  <div
                    class="asset-type-card__icon"
                    :class="
                      selectedType === 'outro'
                        ? 'asset-type-card__icon--violet-active'
                        : 'asset-type-card__icon--violet'
                    "
                  >
                    <Square :size="18" />
                  </div>
                  <div class="asset-type-card__content">
                    <div class="asset-type-card__header">
                      <span class="asset-type-card__name">Outro</span>
                      <Transition name="check-pop">
                        <div
                          v-if="selectedType === 'outro'"
                          class="asset-type-card__check asset-type-card__check--violet"
                        >
                          <Check :size="10" />
                        </div>
                      </Transition>
                    </div>
                    <p class="asset-type-card__desc">Closing clip after content</p>
                    <div class="asset-type-card__formats">
                      <span
                        v-for="format in ['MP4', 'MOV', 'WebM']"
                        :key="format"
                        class="format-pill format-pill--violet"
                      >
                        {{ format }}
                      </span>
                    </div>
                  </div>
                </button>

                <!-- Watermark -->
                <button
                  @click="selectedType = 'watermark'"
                  class="asset-type-card"
                  :class="{ 'asset-type-card--active': selectedType === 'watermark' }"
                  :data-color="'amber'"
                >
                  <div
                    class="asset-type-card__icon"
                    :class="
                      selectedType === 'watermark'
                        ? 'asset-type-card__icon--amber-active'
                        : 'asset-type-card__icon--amber'
                    "
                  >
                    <Stamp :size="18" />
                  </div>
                  <div class="asset-type-card__content">
                    <div class="asset-type-card__header">
                      <span class="asset-type-card__name">Watermark</span>
                      <Transition name="check-pop">
                        <div
                          v-if="selectedType === 'watermark'"
                          class="asset-type-card__check asset-type-card__check--amber"
                        >
                          <Check :size="10" />
                        </div>
                      </Transition>
                    </div>
                    <p class="asset-type-card__desc">Logo overlay on videos</p>
                    <div class="asset-type-card__formats">
                      <span
                        v-for="format in ['PNG', 'WebP', 'GIF']"
                        :key="format"
                        class="format-pill format-pill--amber"
                      >
                        {{ format }}
                      </span>
                    </div>
                  </div>
                </button>

                <!-- Audio -->
                <button
                  @click="selectedType = 'audio'"
                  class="asset-type-card"
                  :class="{ 'asset-type-card--active': selectedType === 'audio' }"
                  :data-color="'emerald'"
                >
                  <div
                    class="asset-type-card__icon"
                    :class="
                      selectedType === 'audio'
                        ? 'asset-type-card__icon--emerald-active'
                        : 'asset-type-card__icon--emerald'
                    "
                  >
                    <Music :size="18" />
                  </div>
                  <div class="asset-type-card__content">
                    <div class="asset-type-card__header">
                      <span class="asset-type-card__name">Audio</span>
                      <Transition name="check-pop">
                        <div
                          v-if="selectedType === 'audio'"
                          class="asset-type-card__check asset-type-card__check--emerald"
                        >
                          <Check :size="10" />
                        </div>
                      </Transition>
                    </div>
                    <p class="asset-type-card__desc">Background music & SFX</p>
                    <div class="asset-type-card__formats">
                      <span
                        v-for="format in ['MP3', 'WAV', 'M4A']"
                        :key="format"
                        class="format-pill format-pill--emerald"
                      >
                        {{ format }}
                      </span>
                    </div>
                  </div>
                </button>

                <!-- Image -->
                <button
                  @click="selectedType = 'image'"
                  class="asset-type-card"
                  :class="{ 'asset-type-card--active': selectedType === 'image' }"
                  :data-color="'blue'"
                >
                  <div
                    class="asset-type-card__icon"
                    :class="
                      selectedType === 'image' ? 'asset-type-card__icon--blue-active' : 'asset-type-card__icon--blue'
                    "
                  >
                    <ImageIcon :size="18" />
                  </div>
                  <div class="asset-type-card__content">
                    <div class="asset-type-card__header">
                      <span class="asset-type-card__name">Image</span>
                      <Transition name="check-pop">
                        <div
                          v-if="selectedType === 'image'"
                          class="asset-type-card__check asset-type-card__check--blue"
                        >
                          <Check :size="10" />
                        </div>
                      </Transition>
                    </div>
                    <p class="asset-type-card__desc">Static graphics & overlays</p>
                    <div class="asset-type-card__formats">
                      <span
                        v-for="format in ['PNG', 'JPG', 'WebP']"
                        :key="format"
                        class="format-pill format-pill--blue"
                      >
                        {{ format }}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <!-- Footer -->
            <div class="asset-modal__footer">
              <button @click="$emit('close')" :disabled="isUploading" class="asset-btn asset-btn--secondary">
                Cancel
              </button>
              <button
                @click="handleUpload"
                :disabled="!selectedType || isUploading"
                class="asset-btn asset-btn--primary"
                :class="{
                  'asset-btn--primary-cyan': selectedType === 'intro',
                  'asset-btn--primary-violet': selectedType === 'outro',
                  'asset-btn--primary-amber': selectedType === 'watermark',
                  'asset-btn--primary-emerald': selectedType === 'audio',
                  'asset-btn--primary-blue': selectedType === 'image',
                }"
              >
                <Loader2 v-if="isUploading" :size="16" class="animate-spin" />
                <Upload v-else :size="16" />
                {{ isUploading ? 'Uploading...' : selectedType ? 'Choose File' : 'Select Type' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { Upload, Play, Square, Stamp, Loader2, Check, Image as ImageIcon, Music, X } from 'lucide-vue-next';
  import { useAssetOperations } from '@/composables/useAssetOperations';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';
  import { useAudioAssetOperations } from '@/composables/useAudioAssetOperations';
  import { useImageAssetOperations } from '@/composables/useImageAssetOperations';

  const emit = defineEmits<{
    close: [];
    uploaded: [];
  }>();

  defineProps<{
    show: boolean;
  }>();

  const { uploading: assetUploading, uploadAsset } = useAssetOperations();
  const { uploading: watermarkUploading, uploadWatermark } = useWatermarkOperations();
  const { uploading: audioUploading, uploadAudioAsset } = useAudioAssetOperations();
  const { uploading: imageUploading, uploadImageAsset } = useImageAssetOperations();

  const selectedType = ref<'intro' | 'outro' | 'watermark' | 'audio' | 'image' | null>(null);

  const isUploading = computed(
    () => assetUploading.value || watermarkUploading.value || audioUploading.value || imageUploading.value
  );

  function handleUpload() {
    if (!selectedType.value) return;

    try {
      // Close dialog immediately
      emit('close');

      if (selectedType.value === 'watermark') {
        // Upload watermark image
        uploadWatermark()
          .then((result) => {
            if (result.success) {
              emit('uploaded');
            }
          })
          .catch((error) => {
            console.error('Watermark upload failed:', error);
          });
      } else if (selectedType.value === 'audio') {
        // Upload audio file
        uploadAudioAsset()
          .then((result) => {
            if (result.success) {
              emit('uploaded');
            }
          })
          .catch((error) => {
            console.error('Audio upload failed:', error);
          });
      } else if (selectedType.value === 'image') {
        // Upload image file
        uploadImageAsset()
          .then((result) => {
            if (result.success) {
              emit('uploaded');
            }
          })
          .catch((error) => {
            console.error('Image upload failed:', error);
          });
      } else {
        // Upload intro/outro video
        uploadAsset(selectedType.value)
          .then((result) => {
            if (result.success) {
              emit('uploaded');
            }
          })
          .catch((error) => {
            console.error('Upload failed:', error);
          });
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }
</script>

<style scoped>
  /* ===== Modal Overlay ===== */
  .asset-modal__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  /* ===== Modal Container ===== */
  .asset-modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 16px;
    width: 100%;
    max-width: 420px;
    margin: 1rem;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.05),
      0 24px 80px rgba(0, 0, 0, 0.5);
  }

  /* ===== Accent Bar ===== */
  .asset-modal__accent {
    height: 3px;
    flex-shrink: 0;
    background: linear-gradient(90deg, #06b6d4, #0ea5e9, #3b82f6);
  }

  /* ===== Header ===== */
  .asset-modal__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.75rem 1.5rem 1.25rem;
    text-align: center;
  }

  .asset-modal__close {
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
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .asset-modal__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .asset-modal__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 14px;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2));
    color: #06b6d4;
    border: 1px solid rgba(6, 182, 212, 0.2);
  }

  .asset-modal__title {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.025em;
  }

  .asset-modal__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0.375rem 0 0;
  }

  /* ===== Content Area ===== */
  .asset-content {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.25rem 1.25rem;
  }

  .asset-content::-webkit-scrollbar {
    width: 6px;
  }

  .asset-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .asset-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .asset-content::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }

  /* ===== Asset Type Grid ===== */
  .asset-type-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.625rem;
  }

  /* ===== Asset Type Card ===== */
  .asset-type-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem;
    padding: 1rem 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 180ms ease;
    text-align: center;
    width: 100%;
  }

  .asset-type-card:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }

  .asset-type-card--active {
    border-width: 1.5px;
  }

  .asset-type-card--active[data-color='cyan'] {
    background-color: rgba(6, 182, 212, 0.08);
    border-color: rgba(6, 182, 212, 0.35);
  }

  .asset-type-card--active[data-color='violet'] {
    background-color: rgba(139, 92, 246, 0.08);
    border-color: rgba(139, 92, 246, 0.35);
  }

  .asset-type-card--active[data-color='amber'] {
    background-color: rgba(245, 158, 11, 0.08);
    border-color: rgba(245, 158, 11, 0.35);
  }

  .asset-type-card--active[data-color='emerald'] {
    background-color: rgba(16, 185, 129, 0.08);
    border-color: rgba(16, 185, 129, 0.35);
  }

  .asset-type-card--active[data-color='blue'] {
    background-color: rgba(59, 130, 246, 0.08);
    border-color: rgba(59, 130, 246, 0.35);
  }

  /* ===== Card Icon ===== */
  .asset-type-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    flex-shrink: 0;
    transition: all 180ms ease;
  }

  .asset-type-card__icon--cyan {
    background-color: rgba(6, 182, 212, 0.12);
    color: #06b6d4;
  }

  .asset-type-card__icon--cyan-active {
    background: linear-gradient(135deg, #06b6d4, #0891b2);
    color: white;
    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
  }

  .asset-type-card__icon--violet {
    background-color: rgba(139, 92, 246, 0.12);
    color: #8b5cf6;
  }

  .asset-type-card__icon--violet-active {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: white;
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }

  .asset-type-card__icon--amber {
    background-color: rgba(245, 158, 11, 0.12);
    color: #f59e0b;
  }

  .asset-type-card__icon--amber-active {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  }

  .asset-type-card__icon--emerald {
    background-color: rgba(16, 185, 129, 0.12);
    color: #10b981;
  }

  .asset-type-card__icon--emerald-active {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .asset-type-card__icon--blue {
    background-color: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
  }

  .asset-type-card__icon--blue-active {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  /* ===== Card Content ===== */
  .asset-type-card__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .asset-type-card__header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    margin-bottom: 0.125rem;
  }

  .asset-type-card__name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    transition: color 150ms ease;
  }

  .asset-type-card--active[data-color='cyan'] .asset-type-card__name {
    color: #22d3ee;
  }

  .asset-type-card--active[data-color='violet'] .asset-type-card__name {
    color: #a78bfa;
  }

  .asset-type-card--active[data-color='amber'] .asset-type-card__name {
    color: #fbbf24;
  }

  .asset-type-card--active[data-color='emerald'] .asset-type-card__name {
    color: #34d399;
  }

  .asset-type-card--active[data-color='blue'] .asset-type-card__name {
    color: #60a5fa;
  }

  .asset-type-card__check {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
  }

  .asset-type-card__check--cyan {
    background: linear-gradient(135deg, #06b6d4, #0891b2);
  }

  .asset-type-card__check--violet {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  }

  .asset-type-card__check--amber {
    background: linear-gradient(135deg, #f59e0b, #d97706);
  }

  .asset-type-card__check--emerald {
    background: linear-gradient(135deg, #10b981, #059669);
  }

  .asset-type-card__check--blue {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
  }

  .asset-type-card__desc {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.5rem;
    line-height: 1.35;
  }

  .asset-type-card__formats {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.25rem;
  }

  /* ===== Format Pills ===== */
  .format-pill {
    display: inline-flex;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text-muted);
    transition: all 150ms ease;
  }

  .asset-type-card--active .format-pill--cyan {
    background-color: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.3);
    color: #22d3ee;
  }

  .asset-type-card--active .format-pill--violet {
    background-color: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.3);
    color: #a78bfa;
  }

  .asset-type-card--active .format-pill--amber {
    background-color: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.3);
    color: #fbbf24;
  }

  .asset-type-card--active .format-pill--emerald {
    background-color: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  .asset-type-card--active .format-pill--blue {
    background-color: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }

  /* ===== Footer ===== */
  .asset-modal__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.15);
  }

  /* ===== Buttons ===== */
  .asset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
  }

  .asset-btn--secondary {
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text-muted);
  }

  .asset-btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .asset-btn--primary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    min-width: 130px;
  }

  .asset-btn--primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .asset-btn--primary-cyan {
    background: linear-gradient(135deg, #06b6d4, #0891b2);
    color: white;
    box-shadow: 0 2px 8px rgba(6, 182, 212, 0.25);
  }

  .asset-btn--primary-cyan:hover:not(:disabled) {
    background: linear-gradient(135deg, #22d3ee, #06b6d4);
    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.35);
    transform: translateY(-1px);
  }

  .asset-btn--primary-violet {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: white;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25);
  }

  .asset-btn--primary-violet:hover:not(:disabled) {
    background: linear-gradient(135deg, #a78bfa, #8b5cf6);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.35);
    transform: translateY(-1px);
  }

  .asset-btn--primary-amber {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.25);
  }

  .asset-btn--primary-amber:hover:not(:disabled) {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
    transform: translateY(-1px);
  }

  .asset-btn--primary-emerald {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
  }

  .asset-btn--primary-emerald:hover:not(:disabled) {
    background: linear-gradient(135deg, #34d399, #10b981);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
    transform: translateY(-1px);
  }

  .asset-btn--primary-blue {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
  }

  .asset-btn--primary-blue:hover:not(:disabled) {
    background: linear-gradient(135deg, #60a5fa, #3b82f6);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
    transform: translateY(-1px);
  }

  .asset-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== Modal Animations ===== */
  .asset-modal-enter-active,
  .asset-modal-leave-active {
    transition: opacity 200ms ease;
  }

  .asset-modal-enter-from,
  .asset-modal-leave-to {
    opacity: 0;
  }

  .asset-dialog-enter-active {
    transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .asset-dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .asset-dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .asset-dialog-leave-to {
    opacity: 0;
    transform: scale(0.97);
  }

  /* ===== Check Pop Animation ===== */
  .check-pop-enter-active {
    transition: all 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .check-pop-leave-active {
    transition: all 150ms ease-in;
  }

  .check-pop-enter-from {
    opacity: 0;
    transform: scale(0);
  }

  .check-pop-leave-to {
    opacity: 0;
    transform: scale(0.5);
  }

  /* ===== Utility Classes ===== */
  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
