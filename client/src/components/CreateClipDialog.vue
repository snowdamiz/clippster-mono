<template>
  <Modal
    :open="show"
    :title="mode === 'new' ? 'Create new clip' : 'Add segment to clip'"
    :description="mode === 'new' ? 'Manually mark a section as a clip' : 'Add this section to an existing clip'"
    :icon="mode === 'new' ? Plus : Layers"
    size="md"
    @close="$emit('close')"
  >
    <div class="flex flex-col gap-4">
      <!-- Time Range Display -->
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line-subtle pb-4">
        <span class="text-xs font-medium text-fg-muted">Time range</span>
        <span class="tabular flex items-center gap-2 font-mono text-sm text-fg">
          {{ formattedStartTime }}
          <ArrowRight class="size-3.5 shrink-0 text-fg-subtle" />
          {{ formattedEndTime }}
          <span class="font-sans text-xs text-fg-subtle">· {{ formattedDuration }}</span>
        </span>
      </div>

      <!-- Mode Toggle (only show if there are existing clips) -->
      <SegmentedControl v-if="existingClips.length > 0" v-model="mode" :options="modeOptions" block />

      <!-- Keyed by mode so switching new / existing eases in -->
      <div :key="mode" class="flex animate-enter flex-col gap-4">
        <!-- New Clip Form -->
        <template v-if="mode === 'new'">
          <Field label="Clip name" for="clip-name" hint="Give your clip a descriptive name or leave empty for default">
            <Input
              id="clip-name"
              ref="nameInput"
              v-model="clipName"
              type="text"
              :placeholder="defaultClipName"
              @keydown.enter="handleCreate"
            />
          </Field>

          <Field for="clip-description">
            <template #label>
              Description <span class="font-normal text-fg-subtle">(optional)</span>
            </template>
            <Textarea
              id="clip-description"
              v-model="clipDescription"
              rows="2"
              placeholder="Add notes about this clip..."
              class="min-h-0 resize-none"
            />
          </Field>
        </template>

        <!-- Existing Clip Selection -->
        <template v-else>
          <Field label="Select clip" hint="The selected time range will be added as a new segment to this clip">
            <Select v-model="selectedClipId">
              <SelectTrigger>
                <SelectValue placeholder="Choose a clip...">
                  {{ selectedClip ? clipOptionLabel(selectedClip) : 'Choose a clip...' }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="clip in existingClips" :key="clip.id" :value="clip.id">
                  {{ clipOptionLabel(clip) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <!-- Selected clip preview -->
          <div v-if="selectedClip" class="flex items-center gap-3">
            <Layers class="size-4 shrink-0 text-fg-subtle" />
            <div class="min-w-0 flex-1">
              <h4 class="truncate text-sm font-medium text-fg">
                {{ selectedClip.title || selectedClip.name || 'Untitled Clip' }}
              </h4>
              <p class="text-xs text-fg-muted">
                Currently has {{ selectedClip.segmentCount }} segment{{ selectedClip.segmentCount !== 1 ? 's' : '' }}
              </p>
            </div>
          </div>
        </template>
      </div>
    </div>

    <template #footer>
      <Button variant="ghost" @click="$emit('close')">Cancel</Button>
      <Button v-if="mode === 'new'" variant="primary" @click="handleCreate">
        <Plus />
        Create clip
      </Button>
      <Button v-else variant="primary" :disabled="!selectedClipId" @click="handleAddSegment">
        <Layers />
        Add segment
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, watch, nextTick } from 'vue';
  import { Plus, ArrowRight, Layers } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Textarea } from '@/components/ui/textarea';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

  interface ExistingClip {
    id: string;
    title?: string;
    name?: string;
    segmentCount: number;
  }

  interface Props {
    show: boolean;
    startTime: number;
    endTime: number;
    existingClips?: ExistingClip[];
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'create', data: { name: string; description: string }): void;
    (e: 'addSegment', data: { clipId: string }): void;
  }

  const props = withDefaults(defineProps<Props>(), {
    existingClips: () => [],
  });
  const emit = defineEmits<Emits>();

  const mode = ref<'new' | 'existing'>('new');
  const clipName = ref('');
  const clipDescription = ref('');
  const selectedClipId = ref('');
  const nameInput = ref<InstanceType<typeof Input> | null>(null);

  const modeOptions = [
    { value: 'new' as const, label: 'New clip', icon: Plus },
    { value: 'existing' as const, label: 'Add to existing', icon: Layers },
  ];

  function clipOptionLabel(clip: ExistingClip): string {
    const count = clip.segmentCount;
    return `${clip.title || clip.name || 'Untitled Clip'} (${count} segment${count !== 1 ? 's' : ''})`;
  }

  // Format time as HH:MM:SS.ms
  function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  // Format duration for display
  function formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  }

  const formattedStartTime = computed(() => formatTime(props.startTime));
  const formattedEndTime = computed(() => formatTime(props.endTime));
  const formattedDuration = computed(() => formatDuration(props.endTime - props.startTime));

  const defaultClipName = computed(() => {
    return `Clip at ${formatTime(props.startTime)}`;
  });

  const selectedClip = computed(() => {
    if (!selectedClipId.value) return null;
    return props.existingClips.find((c) => c.id === selectedClipId.value) || null;
  });

  // Focus input when dialog opens
  watch(
    () => props.show,
    (newShow) => {
      if (newShow) {
        // Reset form
        mode.value = 'new';
        clipName.value = '';
        clipDescription.value = '';
        selectedClipId.value = '';
        // Focus the input after next tick
        nextTick(() => {
          (nameInput.value?.$el as HTMLInputElement | undefined)?.focus();
        });
      }
    }
  );

  function handleCreate() {
    const name = clipName.value.trim() || defaultClipName.value;
    emit('create', {
      name,
      description: clipDescription.value.trim(),
    });
  }

  function handleAddSegment() {
    if (!selectedClipId.value) return;
    emit('addSegment', {
      clipId: selectedClipId.value,
    });
  }
</script>
