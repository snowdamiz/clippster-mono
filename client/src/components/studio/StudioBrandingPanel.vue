<template>
  <StudioPanel title="Branding">
    <Field
      label="Personal studio profile"
      hint="Watermark appears live in the recording. Intro/outro are added when recording stops."
    >
      <CustomDropdown
        :model-value="selectedProfileId ?? ''"
        :options="profileOptions"
        placeholder="None"
        @update:model-value="(value: string) => selectProfile(value || null)"
      />
    </Field>
  </StudioPanel>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Field } from '@/components/ui/field';
  import StudioPanel from './StudioPanel.vue';
  import type { CreatorProfileWithLinks } from '@/services/database/types';

  const selectedProfileId = defineModel<string | null>('selectedProfileId', { required: true });

  const props = defineProps<{
    profiles: CreatorProfileWithLinks[];
  }>();

  const emit = defineEmits<{
    (e: 'profile-selected', profileId: string | null): void;
  }>();

  // CustomDropdown needs a non-null value for "None"
  const profileOptions = computed(() => [
    { label: 'None', value: '' },
    ...props.profiles.map((profile) => ({ label: profile.name, value: profile.id })),
  ]);

  function selectProfile(id: string | null) {
    selectedProfileId.value = id;
    emit('profile-selected', id);
  }

</script>
