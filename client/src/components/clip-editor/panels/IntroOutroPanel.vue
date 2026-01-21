<template>
  <div class="intro-outro-panel">
    <div class="intro-outro-panel__header">
      <h3 class="intro-outro-panel__title">Intro & Outro</h3>
    </div>

    <!-- Intro Section -->
    <div class="intro-outro-panel__section">
      <div class="intro-outro-panel__section-header">
        <Video :size="16" />
        <span>Intro Video</span>
      </div>

      <div v-if="creatorDefaultIntro" class="intro-outro-panel__asset">
        <div class="intro-outro-panel__asset-info">
          <div class="intro-outro-panel__asset-icon">
            <Video :size="20" />
          </div>
          <div class="intro-outro-panel__asset-details">
            <span class="intro-outro-panel__asset-name">{{ creatorDefaultIntro.name }}</span>
            <span class="intro-outro-panel__asset-duration">
              {{ formatDuration(creatorDefaultIntro.duration || 0) }}
            </span>
          </div>
        </div>

        <label class="intro-outro-panel__toggle">
          <input
            v-model="introEnabled"
            type="checkbox"
            class="intro-outro-panel__checkbox"
          />
          <span>Use Intro</span>
        </label>
      </div>

      <div v-else class="intro-outro-panel__empty">
        <p>No intro video configured in creator profile</p>
      </div>
    </div>

    <!-- Outro Section -->
    <div class="intro-outro-panel__section">
      <div class="intro-outro-panel__section-header">
        <Video :size="16" />
        <span>Outro Video</span>
      </div>

      <div v-if="creatorDefaultOutro" class="intro-outro-panel__asset">
        <div class="intro-outro-panel__asset-info">
          <div class="intro-outro-panel__asset-icon">
            <Video :size="20" />
          </div>
          <div class="intro-outro-panel__asset-details">
            <span class="intro-outro-panel__asset-name">{{ creatorDefaultOutro.name }}</span>
            <span class="intro-outro-panel__asset-duration">
              {{ formatDuration(creatorDefaultOutro.duration || 0) }}
            </span>
          </div>
        </div>

        <label class="intro-outro-panel__toggle">
          <input
            v-model="outroEnabled"
            type="checkbox"
            class="intro-outro-panel__checkbox"
          />
          <span>Use Outro</span>
        </label>
      </div>

      <div v-else class="intro-outro-panel__empty">
        <p>No outro video configured in creator profile</p>
      </div>
    </div>

    <!-- Info -->
    <div class="intro-outro-panel__info">
      <Info :size="14" />
      <p>Intro and outro videos are automatically added from your creator profile settings.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Video, Info } from 'lucide-vue-next';
import type { IntroOutroRef } from '@/types';

const props = defineProps<{
  creatorDefaultIntro: IntroOutroRef | null;
  creatorDefaultOutro: IntroOutroRef | null;
}>();

const emit = defineEmits<{
  (e: 'introToggled', enabled: boolean): void;
  (e: 'outroToggled', enabled: boolean): void;
}>();

const introEnabled = ref(!!props.creatorDefaultIntro);
const outroEnabled = ref(!!props.creatorDefaultOutro);

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.intro-outro-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.intro-outro-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.intro-outro-panel__title {
  font-size: 1rem;
  font-weight: 600;
  color: #f4f4f5;
  margin: 0;
}

.intro-outro-panel__section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.intro-outro-panel__section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.intro-outro-panel__asset {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}

.intro-outro-panel__asset-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.intro-outro-panel__asset-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background-color: rgba(99, 102, 241, 0.2);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 6px;
  color: #818cf8;
}

.intro-outro-panel__asset-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.intro-outro-panel__asset-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #f4f4f5;
}

.intro-outro-panel__asset-duration {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
}

.intro-outro-panel__toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}

.intro-outro-panel__checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.intro-outro-panel__empty {
  padding: 1rem;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  text-align: center;
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.5);
}

.intro-outro-panel__empty p {
  margin: 0;
}

.intro-outro-panel__info {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
}

.intro-outro-panel__info p {
  margin: 0;
}
</style>

