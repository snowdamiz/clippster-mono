<template>
  <Modal
    :open="modelValue"
    title="Export video"
    description="Choose the formats you need. For each new shape, adjust framing before export."
    :icon="Download"
    size="md"
    :dismissible="!busy"
    @close="close"
  >
    <div class="space-y-4">
      <div class="space-y-2">
        <p class="text-sm font-medium text-fg">Aspect ratios</p>
        <label v-for="ratio in ratios" :key="ratio.value" class="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            :checked="selected.includes(ratio.value)"
            :disabled="ratio.value === sourceRatio || busy"
            class="accent-brand"
            @change="toggle(ratio.value)"
          />
          <span>{{ ratio.value }}</span>
          <span class="text-fg-muted">{{ ratio.description }}</span>
          <span v-if="ratio.value === sourceRatio" class="text-fg-muted">(original)</span>
        </label>
      </div>
      <p v-if="alternateRatios.length" class="text-xs text-fg-muted">
        We'll make the finished video first, then create framed copies. Your original edit stays available.
      </p>
      <div v-if="masterPath && alternateRatios.length" class="space-y-2">
        <div
          v-for="ratio in alternateRatios"
          :key="ratio"
          class="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm"
        >
          <span>{{ ratio }} framing</span>
          <Button variant="secondary" size="sm" :disabled="busy" @click="editRatio = ratio">
            {{
              isManualFramingConfigConfigured(configs[ratio as keyof ManualFramingConfigs])
                ? 'Edit framing'
                : 'Set framing'
            }}
          </Button>
        </div>
      </div>
      <p v-if="busy" class="text-sm text-fg-muted">Rendering… {{ project.exportState.value?.progress ?? 0 }}%</p>
      <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
      <div v-if="done" class="space-y-1 text-sm text-fg">
        <p>
          Saved {{ 1 + (project.exportState.value?.variants?.length ?? 0) }} video{{ selected.length > 1 ? 's' : '' }}:
        </p>
        <p class="break-all text-xs text-fg-muted">{{ masterPath }}</p>
        <p
          v-for="variant in project.exportState.value?.variants ?? []"
          :key="variant.path"
          class="break-all text-xs text-fg-muted"
        >
          {{ variant.ratio }}: {{ variant.path }}
        </p>
        <Button variant="secondary" size="sm" class="mt-2" @click="createThumbnail">
          Open thumbnail creator
        </Button>
      </div>
    </div>
    <template #footer>
      <Button variant="ghost" :disabled="busy" @click="close">{{ done ? 'Close' : 'Cancel' }}</Button>
      <Button
        v-if="!done"
        variant="primary"
        :loading="busy"
        :disabled="busy || (masterPath !== null && !allFramed)"
        @click="next"
      >
        {{ nextLabel }}
      </Button>
    </template>
    <ManualPOIEditor
      v-if="masterPath && editRatio"
      :model-value="!!editRatio"
      :initial-config="configs[editRatio as keyof ManualFramingConfigs] ?? null"
      :target-aspect-ratio="editRatio"
      :source-aspect-ratio="sourceRatio"
      :video-path="masterPath"
      :clip-start-time="0"
      :clip-end-time="duration"
      @update:model-value="if (!$event) editRatio = null;"
      @confirm="onFramingConfirm"
    />
  </Modal>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { Download } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Modal } from '@/components/ui/modal';
  import ManualPOIEditor from '@/components/poi/ManualPOIEditor.vue';
  import type { ManualFramingConfig, ManualFramingConfigs } from '@/types';
  import { isManualFramingConfigConfigured } from '@/editor/lib/export-framing';
  import { useProject } from '../projectContext';

  const props = defineProps<{ modelValue: boolean }>();
  const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
  const project = useProject();
  const router = useRouter();
  const ratios = [
    { value: '16:9', description: 'YouTube and widescreen' },
    { value: '9:16', description: 'Shorts, Reels and TikTok' },
    { value: '1:1', description: 'Square feed' },
    { value: '4:5', description: 'Portrait feed' },
  ];
  const sourceRatio = computed(() => {
    const format = project.document.value?.format;
    return (
      ratios.find(
        (ratio) =>
          format &&
          Number(ratio.value.split(':')[0]) / Number(ratio.value.split(':')[1]) === format.width / format.height
      )?.value ?? '16:9'
    );
  });
  const selected = ref<string[]>([]);
  const configs = ref<ManualFramingConfigs>({});
  const editRatio = ref<string | null>(null);
  const masterPath = ref<string | null>(null);
  const busy = ref(false);
  const done = ref(false);
  const error = ref('');
  const duration = computed(() => project.document.value?.shots.reduce((sum, shot) => sum + shot.duration, 0) ?? 0);
  const alternateRatios = computed(() => selected.value.filter((ratio) => ratio !== sourceRatio.value));
  const nextLabel = computed(() =>
    !masterPath.value ? (alternateRatios.value.length ? 'Prepare video' : 'Export video') : 'Export selected formats'
  );
  const allFramed = computed(() =>
    alternateRatios.value.every((ratio) =>
      isManualFramingConfigConfigured(configs.value[ratio as keyof ManualFramingConfigs])
    )
  );

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return;
      selected.value = [sourceRatio.value];
      configs.value = {};
      editRatio.value = null;
      masterPath.value = null;
      busy.value = false;
      done.value = false;
      error.value = '';
    }
  );

  function toggle(ratio: string) {
    if (selected.value.includes(ratio)) selected.value = selected.value.filter((item) => item !== ratio);
    else selected.value = [...selected.value, ratio];
  }

  function onFramingConfirm(config: ManualFramingConfig) {
    if (editRatio.value) configs.value = { ...configs.value, [editRatio.value]: config };
    editRatio.value = null;
  }

  async function next() {
    if (busy.value) return;
    error.value = '';
    busy.value = true;
    try {
      if (!masterPath.value) {
        await project.exportVideo();
        masterPath.value = project.exportState.value?.path ?? null;
        if (!masterPath.value) throw new Error(project.exportState.value?.error || 'The video could not be prepared.');
        if (alternateRatios.value.length === 0) done.value = true;
      } else {
        if (!allFramed.value) return;
        await project.exportVariants(alternateRatios.value, configs.value);
        done.value = true;
      }
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Export failed.';
    } finally {
      busy.value = false;
    }
  }

  function close() {
    if (!busy.value) emit('update:modelValue', false);
  }

  function createThumbnail() {
    close();
    void router.push('/ai-image/thumbnail');
  }
</script>
