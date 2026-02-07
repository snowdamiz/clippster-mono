<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="org-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div class="org-dialog org-dialog--cyan org-dialog--lg">
            <!-- Accent Bar -->
            <div class="org-dialog__accent org-dialog__accent--cyan" />

            <!-- Header -->
            <div class="org-dialog__header">
              <button class="org-dialog__close" @click="close" title="Close">
                <X :size="18" />
              </button>
              <div class="org-dialog__icon org-dialog__icon--cyan">
                <Video :size="24" />
              </div>
              <h2 class="org-dialog__title">Configure Intro/Outro per Aspect Ratio</h2>
              <p class="org-dialog__subtitle">
                Set different intro and outro videos for each aspect ratio
              </p>
            </div>

            <!-- Content -->
            <div class="org-dialog__content">
              <!-- Aspect Ratio Tabs -->
              <div class="aspect-ratio-tabs">
                <button
                  v-for="ratio in aspectRatios"
                  :key="ratio.id"
                  @click="activeRatio = ratio.id"
                  class="aspect-ratio-tab"
                  :class="{
                    'aspect-ratio-tab--active': activeRatio === ratio.id,
                    'aspect-ratio-tab--configured': isRatioConfigured(ratio.id)
                  }"
                >
                  <div class="aspect-ratio-tab-preview" :style="{ aspectRatio: ratio.id.replace(':', '/') }"></div>
                  <span class="aspect-ratio-tab-label">{{ ratio.label }}</span>
                  <div v-if="isRatioConfigured(ratio.id)" class="aspect-ratio-tab-indicator">
                    <Check :size="12" />
                  </div>
                </button>
              </div>

              <!-- Current Ratio Configuration -->
              <div class="ratio-config">
                <div class="ratio-config-header">
                  <h3 class="ratio-config-title">{{ getRatioLabel(activeRatio) }}</h3>
                  <div class="ratio-config-toggle">
                    <label class="toggle-label">
                      <input
                        type="checkbox"
                        v-model="enabledRatios[activeRatio]"
                        @change="onRatioToggle(activeRatio)"
                      />
                      <span class="toggle-slider"></span>
                      <span class="toggle-text">Enable</span>
                    </label>
                  </div>
                </div>

                <div v-if="enabledRatios[activeRatio]" class="ratio-config-content">
                  <!-- Intro Selection -->
                  <div class="asset-selector">
                    <label class="asset-selector-label">Intro Video</label>
                    <div class="asset-dropdown-wrapper">
                      <button
                        @click="toggleIntroDropdown"
                        class="asset-dropdown-trigger"
                      >
                        <span class="asset-dropdown-text">
                          {{ getSelectedIntroName() || 'None' }}
                        </span>
                        <ChevronDown
                          class="asset-dropdown-icon"
                          :class="{ 'asset-dropdown-icon--open': showIntroDropdown }"
                        />
                      </button>

                      <div v-if="showIntroDropdown" class="asset-dropdown-menu">
                        <button
                          @click="selectIntro(null)"
                          class="asset-dropdown-item asset-dropdown-item--first"
                        >
                          None
                        </button>
                        <button
                          v-for="intro in intros"
                          :key="intro.id"
                          @click="selectIntro(intro)"
                          class="asset-dropdown-item"
                        >
                          <div class="asset-dropdown-item-content">
                            <span class="asset-dropdown-item-name">{{ intro.name }}</span>
                            <span class="asset-dropdown-item-duration">
                              {{ formatDuration(intro.duration || 0) }}
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Outro Selection -->
                  <div class="asset-selector">
                    <label class="asset-selector-label">Outro Video</label>
                    <div class="asset-dropdown-wrapper">
                      <button
                        @click="toggleOutroDropdown"
                        class="asset-dropdown-trigger"
                      >
                        <span class="asset-dropdown-text">
                          {{ getSelectedOutroName() || 'None' }}
                        </span>
                        <ChevronDown
                          class="asset-dropdown-icon"
                          :class="{ 'asset-dropdown-icon--open': showOutroDropdown }"
                        />
                      </button>

                      <div v-if="showOutroDropdown" class="asset-dropdown-menu">
                        <button
                          @click="selectOutro(null)"
                          class="asset-dropdown-item asset-dropdown-item--first"
                        >
                          None
                        </button>
                        <button
                          v-for="outro in outros"
                          :key="outro.id"
                          @click="selectOutro(outro)"
                          class="asset-dropdown-item"
                        >
                          <div class="asset-dropdown-item-content">
                            <span class="asset-dropdown-item-name">{{ outro.name }}</span>
                            <span class="asset-dropdown-item-duration">
                              {{ formatDuration(outro.duration || 0) }}
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="ratio-config-disabled">
                  <p>Intro and outro videos are disabled for this aspect ratio</p>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="org-dialog__footer">
              <button @click="close" class="org-dialog__btn org-dialog__btn--secondary">
                Cancel
              </button>
              <button @click="save" class="org-dialog__btn org-dialog__btn--primary">
                Save Settings
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { X, Video, ChevronDown, Check } from 'lucide-vue-next';
  import type { CreatorIntroOutroSettings, CreatorIntroOutroRatioConfig } from '@/services/database/types';
  import { getAllIntroOutros, type IntroOutro } from '@/services/database';

  export type AspectRatioId = '16:9' | '9:16' | '1:1' | '4:5';

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
    initialSettings?: CreatorIntroOutroSettings | null;
  }>();

  const emit = defineEmits<{
    'update:show': [value: boolean];
    save: [settings: CreatorIntroOutroSettings];
    close: [];
  }>();

  // State
  const activeRatio = ref<AspectRatioId>('16:9');
  const intros = ref<IntroOutro[]>([]);
  const outros = ref<IntroOutro[]>([]);
  const enabledRatios = ref<Record<AspectRatioId, boolean>>({
    '16:9': false,
    '9:16': false,
    '1:1': false,
    '4:5': false,
  });
  const ratioIntroIds = ref<Record<AspectRatioId, string | null>>({
    '16:9': null,
    '9:16': null,
    '1:1': null,
    '4:5': null,
  });
  const ratioOutroIds = ref<Record<AspectRatioId, string | null>>({
    '16:9': null,
    '9:16': null,
    '1:1': null,
    '4:5': null,
  });
  const showIntroDropdown = ref(false);
  const showOutroDropdown = ref(false);

  // Computed
  const isRatioConfigured = (ratio: AspectRatioId): boolean => {
    return enabledRatios.value[ratio] && 
           (ratioIntroIds.value[ratio] !== null || ratioOutroIds.value[ratio] !== null);
  };

  const getRatioLabel = (ratio: AspectRatioId): string => {
    return aspectRatios.find(r => r.id === ratio)?.label || ratio;
  };

  const getSelectedIntroName = (): string | null => {
    const introId = ratioIntroIds.value[activeRatio.value];
    if (!introId) return null;
    const intro = intros.value.find(i => i.id === introId);
    return intro?.name || null;
  };

  const getSelectedOutroName = (): string | null => {
    const outroId = ratioOutroIds.value[activeRatio.value];
    if (!outroId) return null;
    const outro = outros.value.find(o => o.id === outroId);
    return outro?.name || null;
  };

  // Methods
  const close = () => {
    emit('close');
    emit('update:show', false);
  };

  const onRatioToggle = (ratio: AspectRatioId) => {
    if (!enabledRatios.value[ratio]) {
      // Disabling - clear selections
      ratioIntroIds.value[ratio] = null;
      ratioOutroIds.value[ratio] = null;
    }
  };

  const toggleIntroDropdown = () => {
    showIntroDropdown.value = !showIntroDropdown.value;
    showOutroDropdown.value = false;
  };

  const toggleOutroDropdown = () => {
    showOutroDropdown.value = !showOutroDropdown.value;
    showIntroDropdown.value = false;
  };

  const selectIntro = (intro: IntroOutro | null) => {
    ratioIntroIds.value[activeRatio.value] = intro?.id || null;
    showIntroDropdown.value = false;
  };

  const selectOutro = (outro: IntroOutro | null) => {
    ratioOutroIds.value[activeRatio.value] = outro?.id || null;
    showOutroDropdown.value = false;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const save = () => {
    const buildRatioSettings = (ratio: AspectRatioId): CreatorIntroOutroRatioConfig | null => {
      if (!enabledRatios.value[ratio]) return null;
      return {
        introId: ratioIntroIds.value[ratio],
        outroId: ratioOutroIds.value[ratio],
      };
    };

    const settings: CreatorIntroOutroSettings = {
      '16:9': buildRatioSettings('16:9'),
      '9:16': buildRatioSettings('9:16'),
      '1:1': buildRatioSettings('1:1'),
      '4:5': buildRatioSettings('4:5'),
    };

    emit('save', settings);
    close();
  };

  const loadAssets = async () => {
    try {
      intros.value = await getAllIntroOutros('intro');
      outros.value = await getAllIntroOutros('outro');
    } catch (error) {
      console.error('Failed to load intro/outro assets:', error);
    }
  };

  const initializeFromProps = () => {
    if (!props.initialSettings) return;

    const settings = props.initialSettings;
    
    // Initialize enabled ratios and selections
    for (const ratio of aspectRatios) {
      const ratioConfig = settings[ratio.id];
      if (ratioConfig) {
        enabledRatios.value[ratio.id] = true;
        ratioIntroIds.value[ratio.id] = ratioConfig.introId;
        ratioOutroIds.value[ratio.id] = ratioConfig.outroId;
      } else {
        enabledRatios.value[ratio.id] = false;
        ratioIntroIds.value[ratio.id] = null;
        ratioOutroIds.value[ratio.id] = null;
      }
    }
  };

  // Watch for show prop
  watch(() => props.show, (show) => {
    if (show) {
      loadAssets();
      initializeFromProps();
    }
  });

  // Close dropdowns when clicking outside
  onMounted(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.asset-dropdown-wrapper')) {
        showIntroDropdown.value = false;
        showOutroDropdown.value = false;
      }
    };
    document.addEventListener('click', handleClickOutside);
    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside);
    });
  });
</script>

<style scoped>
  /* ===== Aspect Ratio Tabs ===== */
  .aspect-ratio-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--sidebar-border);
    padding-bottom: 1rem;
  }

  .aspect-ratio-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    background: var(--sidebar-surface);
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .aspect-ratio-tab:hover {
    border-color: var(--sidebar-accent);
    background: var(--sidebar-hover);
  }

  .aspect-ratio-tab--active {
    border-color: var(--sidebar-accent);
    background: rgba(6, 182, 212, 0.1);
  }

  .aspect-ratio-tab--configured {
    border-color: var(--success);
  }

  .aspect-ratio-tab-preview {
    width: 32px;
    height: 20px;
    background: var(--sidebar-border);
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .aspect-ratio-tab:hover .aspect-ratio-tab-preview {
    background: var(--sidebar-accent);
  }

  .aspect-ratio-tab--active .aspect-ratio-tab-preview {
    background: var(--sidebar-accent);
  }

  .aspect-ratio-tab--configured .aspect-ratio-tab-preview {
    background: var(--success);
  }

  .aspect-ratio-tab-label {
    font-size: 0.75rem;
    color: var(--sidebar-foreground);
    font-weight: 500;
  }

  .aspect-ratio-tab-indicator {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    width: 16px;
    height: 16px;
    background: var(--success);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ===== Ratio Configuration ===== */
  .ratio-config {
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .ratio-config-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .ratio-config-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-foreground);
    margin: 0;
  }

  .ratio-config-toggle {
    display: flex;
    align-items: center;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .toggle-label input[type="checkbox"] {
    display: none;
  }

  .toggle-slider {
    width: 44px;
    height: 24px;
    background: var(--sidebar-border);
    border-radius: 12px;
    position: relative;
    transition: background 0.2s ease;
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s ease;
  }

  .toggle-label input[type="checkbox"]:checked + .toggle-slider {
    background: var(--sidebar-accent);
  }

  .toggle-label input[type="checkbox"]:checked + .toggle-slider::before {
    transform: translateX(20px);
  }

  .toggle-text {
    font-size: 0.875rem;
    color: var(--sidebar-foreground);
    font-weight: 500;
  }

  .ratio-config-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .ratio-config-disabled {
    text-align: center;
    padding: 2rem;
    color: var(--sidebar-muted);
  }

  /* ===== Asset Selectors ===== */
  .asset-selector {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .asset-selector-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-foreground);
  }

  .asset-dropdown-wrapper {
    position: relative;
  }

  .asset-dropdown-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--input-background);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    color: var(--input-foreground);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .asset-dropdown-trigger:hover {
    border-color: var(--input-border-hover);
    background: var(--input-background-hover);
  }

  .asset-dropdown-text {
    font-size: 0.875rem;
  }

  .asset-dropdown-icon {
    transition: transform 0.2s ease;
  }

  .asset-dropdown-icon--open {
    transform: rotate(180deg);
  }

  .asset-dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.5rem;
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .asset-dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    color: var(--sidebar-foreground);
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .asset-dropdown-item:hover {
    background: var(--sidebar-hover);
  }

  .asset-dropdown-item--first {
    border-bottom: 1px solid var(--sidebar-border);
  }

  .asset-dropdown-item-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .asset-dropdown-item-name {
    font-size: 0.875rem;
    text-align: left;
  }

  .asset-dropdown-item-duration {
    font-size: 0.75rem;
    color: var(--sidebar-muted);
  }

  /* ===== Modal Styles ===== */
  .org-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .org-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 700px;
    margin: 1rem;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .org-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  .org-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .org-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--sidebar-foreground);
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.2s ease;
  }

  .org-dialog__close:hover {
    background: var(--sidebar-hover);
  }

  .org-dialog__icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(6, 182, 212, 0.1);
    color: var(--sidebar-accent);
    border-radius: 12px;
    margin-bottom: 1rem;
  }

  .org-dialog__title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--sidebar-foreground);
    margin: 0 0 0.5rem 0;
  }

  .org-dialog__subtitle {
    color: var(--sidebar-muted);
    margin: 0;
    font-size: 0.875rem;
  }

  .org-dialog__content {
    flex: 1;
    padding: 0 1.5rem 1.5rem;
    overflow-y: auto;
  }

  .org-dialog__footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .org-dialog__btn {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }

  .org-dialog__btn--secondary {
    background: var(--sidebar-surface);
    color: var(--sidebar-foreground);
    border-color: var(--sidebar-border);
  }

  .org-dialog__btn--secondary:hover {
    background: var(--sidebar-hover);
  }

  .org-dialog__btn--primary {
    background: var(--sidebar-accent);
    color: white;
  }

  .org-dialog__btn--primary:hover {
    background: var(--sidebar-accent-hover);
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 0.3s ease;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
</style>
