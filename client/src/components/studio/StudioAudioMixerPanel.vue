<template>
  <StudioPanel title="Audio mixer">
    <RangeField
      label="Mic"
      :model-value="micVolume"
      :min="0"
      :max="150"
      @update:model-value="emit('update:micVolume', $event)"
    />
    <div class="flex flex-col gap-1">
      <RangeField
        label="Share"
        :model-value="shareAudioVolume"
        :min="0"
        :max="150"
        :disabled="!hasShareAudio"
        @update:model-value="emit('update:shareAudioVolume', $event)"
      />
      <p v-if="!hasShareAudio" class="pl-[68px] text-2xs text-fg-subtle">No shared audio</p>
    </div>
  </StudioPanel>
</template>

<script setup lang="ts">
  import RangeField from '@/components/branding/RangeField.vue';
  import StudioPanel from './StudioPanel.vue';

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
