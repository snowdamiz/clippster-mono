<template>
  <Modal
    :open="modelValue"
    title="Edit subtitles"
    description="Configure subtitles for your clips"
    :icon="Captions"
    size="lg"
    :dismissible="!isSaving"
    @close="close"
  >
    <div class="flex flex-col gap-4">
      <!-- Subtitle Preset Selection -->
      <Field label="Select subtitle style">
        <div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
          <button
            v-for="preset in presetCards"
            :key="preset.id"
            type="button"
            class="group flex flex-col gap-2 rounded-lg border p-2 text-left transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
            :class="
              selectedPreset === preset.id
                ? 'border-brand-line bg-brand-soft'
                : 'border-line-subtle bg-surface hover:border-line-strong'
            "
            :aria-pressed="selectedPreset === preset.id"
            @click="selectedPreset = preset.id"
          >
            <!-- Preview well; the sample text styling is the preset itself -->
            <div class="flex h-16 items-center justify-center overflow-hidden rounded-md bg-surface-sunken">
              <span v-if="preset.id === 'karaoke'" :style="preset.sampleStyle">
                <span style="color: #0ea5e9">WORD</span> BY <span style="color: #0ea5e9">WORD</span>
              </span>
              <span v-else :style="preset.sampleStyle">{{ preset.sampleText }}</span>
            </div>
            <div class="flex items-start justify-between gap-2 px-0.5">
              <div class="min-w-0">
                <div class="truncate text-xs font-semibold text-fg">{{ preset.name }}</div>
                <div class="truncate text-2xs text-fg-subtle">{{ preset.description }}</div>
              </div>
              <span
                v-if="selectedPreset === preset.id"
                class="grid size-4 shrink-0 place-items-center rounded-full bg-brand text-brand-fg"
              >
                <Check :size="11" :stroke-width="3" />
              </span>
            </div>
          </button>
        </div>
      </Field>

      <!-- Info Message -->
      <Alert>
        <Info />
        <AlertTitle>{{ applyScopeTitle }}</AlertTitle>
        <AlertDescription>{{ applyScopeDescription }}</AlertDescription>
      </Alert>

      <!-- Error Message -->
      <Alert v-if="error" variant="destructive">
        <AlertCircle />
        <AlertDescription class="text-fg">{{ error }}</AlertDescription>
      </Alert>
    </div>

    <template #footer>
      <Button variant="ghost" :disabled="isSaving" @click="close">Cancel</Button>
      <Button variant="primary" :loading="isSaving" :disabled="!selectedPreset || clips.length === 0" @click="save">
        {{ isSaving ? 'Saving...' : 'Save' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { Captions, Info, Check, AlertCircle } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import type { Clip, SubtitleSettings } from '@/types';

  interface Props {
    modelValue: boolean;
    clips: Clip[];
    projectId?: string | null;
    /** From VOD preset (creator layout) or local creator profile clip_build_defaults */
    defaultSubtitleSettings?: SubtitleSettings | null;
  }

  const props = withDefaults(defineProps<Props>(), {
    clips: () => [],
    projectId: null,
    defaultSubtitleSettings: null,
  });

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    save: [clipIds: string[], presetId: string, applyToAll: boolean];
  }>();

  // Preset cards. sampleStyle reproduces each preset's look (user-facing subtitle colors/fonts).
  const presetCards = [
    {
      id: 'mr-beast',
      name: 'MrBeast',
      description: 'Bold yellow, YouTube style',
      sampleText: 'SAMPLE TEXT',
      sampleStyle:
        "color: #FACC15; font-family: 'Bebas Neue', sans-serif; font-size: 18px; font-weight: normal; letter-spacing: 1.5px; text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 8px rgba(239, 68, 68, 0.5);",
    },
    {
      id: 'tiktok-bold',
      name: 'TikTok Bold',
      description: 'White text, thick outline',
      sampleText: 'SAMPLE TEXT',
      sampleStyle:
        "color: #FFFFFF; font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 900; background: rgba(0,0,0,0.8); padding: 4px 8px; border-radius: 4px;",
    },
    {
      id: 'subtitle-tutorial',
      name: 'Clean Subtitle',
      description: 'Professional, readable',
      sampleText: 'Sample Text',
      sampleStyle:
        "color: #FFFFFF; font-family: 'Roboto', sans-serif; font-size: 14px; font-weight: normal; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 4px;",
    },
    {
      id: 'neon-glow',
      name: 'Neon Glow',
      description: 'Cyan glow, modern',
      sampleText: 'SAMPLE TEXT',
      sampleStyle:
        "color: #FFFFFF; font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: bold; text-shadow: 0 0 10px #22D3EE, 0 0 20px #22D3EE, 0 0 30px #22D3EE;",
    },
    {
      id: 'karaoke',
      name: 'Karaoke',
      description: 'Word-by-word highlight',
      sampleText: 'WORD BY WORD',
      sampleStyle: "color: #FFFFFF; font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: bold;",
    },
  ];

  const selectedPreset = ref<string>('');
  const isSaving = ref(false);
  const error = ref<string>('');

  const applyScopeTitle = computed(() =>
    props.clips.length === 1 ? 'Applies to this clip' : 'Applies to all clips'
  );
  const applyScopeDescription = computed(() =>
    props.clips.length === 1
      ? 'This style will enable subtitles for the clip open in the framing editor. You can adjust style and position there after saving.'
      : 'This style will enable subtitles for every detected or manually added clip. Remove subtitles from a single clip from its subtitle properties panel.'
  );

  function close() {
    if (!isSaving.value) {
      emit('update:modelValue', false);
    }
  }

  async function save() {
    if (!selectedPreset.value) {
      error.value = 'Please select a subtitle style';
      return;
    }

    if (props.clips.length === 0) {
      error.value = 'No clips available for subtitles';
      return;
    }

    isSaving.value = true;
    error.value = '';

    try {
      emit('save', props.clips.map(c => c.id), selectedPreset.value, true);
      emit('update:modelValue', false);
    } catch (err) {
      console.error('Failed to save subtitle settings:', err);
      error.value = err instanceof Error ? err.message : 'Failed to save subtitle settings';
    } finally {
      isSaving.value = false;
    }
  }

  // Reset state when dialog opens; pre-select style from creator / VOD defaults when present
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        error.value = '';
        isSaving.value = false;

        const d = props.defaultSubtitleSettings;
        if (d?.selectedPresetId && String(d.selectedPresetId).trim()) {
          selectedPreset.value = String(d.selectedPresetId).trim();
        } else if (d) {
          selectedPreset.value = 'tiktok-bold';
        } else {
          selectedPreset.value = '';
        }
      }
    }
  );
</script>
