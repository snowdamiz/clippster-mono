<template>
  <div class="studio-panel">
    <div class="studio-panel__header">
      <h3 class="studio-panel__title">Sources</h3>
      <button type="button" class="studio-panel__refresh" :disabled="loadingDevices" @click="$emit('refresh-devices')">
        {{ loadingDevices ? 'Scanning...' : 'Refresh' }}
      </button>
    </div>

    <div class="studio-panel__field">
      <label class="studio-panel__label">Recording mode</label>
      <CustomDropdown
        v-model="mode"
        :options="modeOptions"
        placeholder="Select mode"
        trigger-class="studio-panel__dropdown-trigger"
      />
    </div>

    <div class="studio-panel__field">
      <label class="studio-panel__label">Aspect ratio</label>
      <CustomDropdown
        v-model="aspectRatio"
        :options="aspectOptions"
        placeholder="Select aspect ratio"
        trigger-class="studio-panel__dropdown-trigger"
      />
    </div>

    <div v-if="mode !== 'camera'" class="studio-panel__field">
      <label class="studio-panel__label">Screen share</label>
      <div class="studio-panel__share-row">
        <button type="button" class="studio-panel__share-btn" @click="$emit('choose-screen')">
          {{ isScreenSharing ? 'Change share' : 'Choose screen' }}
        </button>
        <button
          v-if="isScreenSharing"
          type="button"
          class="studio-panel__share-btn studio-panel__share-btn--stop"
          @click="$emit('stop-screen')"
        >
          Stop
        </button>
      </div>
      <p class="studio-panel__hint">{{ isScreenSharing ? screenShareLabel : 'Pick a screen or window.' }}</p>
    </div>

    <div v-if="mode !== 'screen'" class="studio-panel__field">
      <label class="studio-panel__label">Camera</label>
      <CustomDropdown
        v-model="cameraDeviceId"
        :options="cameraOptions"
        placeholder="Select camera"
        trigger-class="studio-panel__dropdown-trigger"
      />
      <p v-if="cameraOptions.length === 0" class="studio-panel__hint">Allow camera access, then refresh.</p>
    </div>

    <div class="studio-panel__field">
      <label class="studio-panel__label">Microphone</label>
      <CustomDropdown
        v-model="microphoneDeviceId"
        :options="micOptions"
        placeholder="Select microphone"
        trigger-class="studio-panel__dropdown-trigger"
      />
      <p v-if="micOptions.length === 0" class="studio-panel__hint">Allow microphone access, then refresh.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import type { StudioAspectRatio, StudioRecordingMode } from '@/types/studio';

  const mode = defineModel<StudioRecordingMode>('mode', { required: true });
  const aspectRatio = defineModel<StudioAspectRatio>('aspectRatio', { required: true });
  const cameraDeviceId = defineModel<string | null>('cameraDeviceId', { required: true });
  const microphoneDeviceId = defineModel<string | null>('microphoneDeviceId', { required: true });
  const displayId = defineModel<string | null>('displayId', { required: true });

  withDefaults(defineProps<{
    cameraOptions: { label: string; value: string }[];
    micOptions: { label: string; value: string }[];
    displayOptions: { label: string; value: string }[];
    loadingDevices?: boolean;
    isScreenSharing?: boolean;
    screenShareLabel?: string;
  }>(), {
    loadingDevices: false,
    isScreenSharing: false,
    screenShareLabel: '',
  });

  defineEmits<{
    'refresh-devices': [];
    'choose-screen': [];
    'stop-screen': [];
  }>();

  const modeOptions = [
    { label: 'Camera only', value: 'camera' },
    { label: 'Screen only', value: 'screen' },
    { label: 'Screen + Camera PiP', value: 'screen_camera' },
  ];

  const aspectOptions = [
    { label: '16:9 Landscape', value: '16:9' },
    { label: '9:16 Vertical', value: '9:16' },
    { label: '4:5 Portrait', value: '4:5' },
    { label: '1:1 Square', value: '1:1' },
  ];
</script>

<style scoped>
  .studio-panel {
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    padding: 0.65rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    min-height: 0;
  }

  .studio-panel__title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .studio-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .studio-panel__refresh {
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    background: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    cursor: pointer;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.25rem 0.45rem;
  }

  .studio-panel__refresh:hover:not(:disabled) {
    color: var(--sidebar-text);
    border-color: rgba(255, 255, 255, 0.16);
  }

  .studio-panel__refresh:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .studio-panel__field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .studio-panel__label {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .studio-panel__hint {
    color: var(--sidebar-text-muted);
    font-size: 0.625rem;
    line-height: 1.35;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .studio-panel__share-row {
    display: flex;
    gap: 0.35rem;
  }

  .studio-panel__share-btn {
    min-height: 30px;
    flex: 1;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--sidebar-text);
    cursor: pointer;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0 0.5rem;
  }

  .studio-panel__share-btn:hover {
    border-color: rgba(255, 255, 255, 0.16);
    background: var(--sidebar-hover);
  }

  .studio-panel__share-btn--stop {
    flex: 0 0 48px;
    color: #f87171;
  }

  :deep(.studio-panel__dropdown-trigger) {
    width: 100%;
    min-height: 30px;
    font-size: 0.75rem;
  }
</style>
