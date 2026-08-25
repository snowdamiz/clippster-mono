<template>
  <div class="studio-panel">
    <h3 class="studio-panel__title">Audio Mixer</h3>

    <div class="studio-mixer__row">
      <div class="studio-mixer__header">
        <span>Mic</span>
        <span>{{ micVolume }}%</span>
      </div>
      <input
        :value="micVolume"
        class="studio-mixer__slider"
        type="range"
        min="0"
        max="150"
        step="1"
        @input="emit('update:micVolume', Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div class="studio-mixer__row" :class="{ 'studio-mixer__row--disabled': !hasShareAudio }">
      <div class="studio-mixer__header">
        <span>Share audio</span>
        <span>{{ hasShareAudio ? `${shareAudioVolume}%` : 'None' }}</span>
      </div>
      <input
        :value="shareAudioVolume"
        class="studio-mixer__slider"
        type="range"
        min="0"
        max="150"
        step="1"
        :disabled="!hasShareAudio"
        @input="emit('update:shareAudioVolume', Number(($event.target as HTMLInputElement).value))"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  defineProps<{
    micVolume: number;
    shareAudioVolume: number;
    hasShareAudio: boolean;
  }>();

  const emit = defineEmits<{
    'update:micVolume': [value: number];
    'update:shareAudioVolume': [value: number];
  }>();
</script>

<style scoped>
  .studio-panel {
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .studio-panel__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .studio-mixer__row {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .studio-mixer__row--disabled {
    opacity: 0.55;
  }

  .studio-mixer__header {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    color: var(--sidebar-text-muted);
    font-size: 0.75rem;
  }

  .studio-mixer__slider {
    width: 100%;
    accent-color: var(--sidebar-accent);
  }
</style>
