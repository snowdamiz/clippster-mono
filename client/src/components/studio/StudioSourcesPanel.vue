<template>
  <StudioPanel title="Sources">
    <template #actions>
      <Button variant="ghost" size="xs" :loading="loadingDevices" @click="$emit('refresh-devices')">
        {{ loadingDevices ? 'Scanning…' : 'Refresh' }}
      </Button>
    </template>

    <Field label="Recording mode">
      <CustomDropdown v-model="mode" :options="modeOptions" placeholder="Select mode" />
    </Field>

    <Field label="Aspect ratio">
      <CustomDropdown v-model="aspectRatio" :options="aspectOptions" placeholder="Select aspect ratio" />
    </Field>

    <Field v-if="mode !== 'camera'" label="Screen share" :hint="isScreenSharing ? screenShareLabel : 'Pick a screen or window.'">
      <div class="flex gap-1.5">
        <Button variant="secondary" class="min-w-0 flex-1" @click="$emit('choose-screen')">
          {{ isScreenSharing ? 'Change share' : 'Choose screen' }}
        </Button>
        <Button v-if="isScreenSharing" variant="destructive-soft" @click="$emit('stop-screen')">Stop</Button>
      </div>
    </Field>

    <Field
      v-if="mode !== 'screen'"
      label="Camera"
      :hint="cameraOptions.length === 0 ? 'Allow camera access, then refresh.' : undefined"
    >
      <CustomDropdown v-model="cameraDeviceId" :options="cameraOptions" placeholder="Select camera" />
    </Field>

    <Field label="Microphone" :hint="micOptions.length === 0 ? 'Allow microphone access, then refresh.' : undefined">
      <CustomDropdown v-model="microphoneDeviceId" :options="micOptions" placeholder="Select microphone" />
    </Field>
  </StudioPanel>
</template>

<script setup lang="ts">
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import StudioPanel from './StudioPanel.vue';
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
    { label: 'Screen + camera PiP', value: 'screen_camera' },
  ];

  const aspectOptions = [
    { label: '16:9 landscape', value: '16:9' },
    { label: '9:16 vertical', value: '9:16' },
    { label: '4:5 portrait', value: '4:5' },
    { label: '1:1 square', value: '1:1' },
  ];
</script>
