<template>
  <Modal
    :open="modelValue"
    title="Detect clips"
    description="AI finds the most clip-worthy moments in this video."
    :icon="Sparkles"
    tone="ai"
    size="md"
    :dismissible="!isProcessing"
    :hide-close="isProcessing"
    @close="close"
  >
    <div class="flex flex-col gap-4">
      <InfoList v-if="summaryRows.length" compact class="border-b border-line-subtle pb-4" :rows="summaryRows" />

      <!-- Time range (single video only, not multi-segment) -->
      <Field v-if="!segmentCount && videoDuration > 0" label="Detection time range">
        <TimeRangePicker v-model="timeRange" :total-duration="videoDuration" />
      </Field>

      <Field label="Detection prompt">
        <Select :model-value="selectedPromptId" @update:model-value="onPromptSelected">
          <SelectTrigger>
            <SelectValue placeholder="Select a prompt...">{{ selectedPromptName || 'Select a prompt...' }}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="prompt in prompts" :key="prompt.id" :value="prompt.id">
              {{ prompt.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <!-- Options -->
      <div class="flex flex-col divide-y divide-line-subtle border-y border-line-subtle">
        <label class="flex cursor-pointer items-center gap-3 py-2.5">
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2 text-sm font-medium text-fg">
              Enhanced detection
              <Badge variant="ai">2× credits</Badge>
            </span>
            <span class="mt-0.5 block text-xs text-fg-muted">
              Analyzes transcript, video and audio together for higher-quality clips.
            </span>
          </span>
          <Switch v-model="enhancedDetection" />
        </label>
        <label class="flex cursor-pointer items-center gap-3 py-2.5">
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-fg">Include subtitles</span>
            <span class="mt-0.5 block text-xs text-fg-muted">Automatically add subtitles to every detected clip.</span>
          </span>
          <Switch v-model="subtitlesEnabled" />
        </label>
      </div>

      <!-- Subtitle style (shown when subtitles are enabled) -->
      <Field v-if="subtitlesEnabled" label="Subtitle style" :error="!selectedSubtitlePreset ? 'Select a subtitle style to continue' : undefined">
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="preset in subtitlePresetOptions"
            :key="preset.id"
            type="button"
            class="flex flex-col gap-1.5 rounded-lg border p-1.5 text-left transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
            :class="
              selectedSubtitlePreset === preset.id
                ? 'border-brand-line bg-brand-soft'
                : 'border-line-subtle bg-surface hover:border-line hover:bg-surface-hover'
            "
            :aria-pressed="selectedSubtitlePreset === preset.id"
            @click="selectedSubtitlePreset = preset.id"
          >
            <!-- Sample text styles mirror the actual subtitle presets (user-facing render colors). -->
            <div class="grid h-12 place-items-center overflow-hidden rounded-md bg-surface-sunken">
              <span v-if="preset.id === 'karaoke'" :style="preset.sampleStyle">
                <span style="color: #0ea5e9">WORD</span> BY <span style="color: #0ea5e9">WORD</span>
              </span>
              <span v-else :style="preset.sampleStyle">{{ preset.sample }}</span>
            </div>
            <div class="flex items-center justify-between gap-1 px-0.5">
              <span class="truncate text-xs font-medium text-fg">{{ preset.name }}</span>
              <Check v-if="selectedSubtitlePreset === preset.id" class="size-3.5 shrink-0 text-brand" />
            </div>
            <span class="px-0.5 text-2xs leading-snug text-fg-subtle">{{ preset.description }}</span>
          </button>
        </div>
      </Field>

      <CreditSourcePicker
        v-if="showCreditSourceSelector"
        :options="creditSourceOptions"
        :selected-source="selectedSource"
        :selected-organization-id="selectedOrganizationId"
        @select-personal="selectPersonal"
        @select-organization="selectOrganization"
      />

      <Alert :variant="!isAdmin && !hasEnoughCredits(calculatedCredits) ? 'warning' : 'info'">
        <Info />
        <AlertTitle>Credit cost</AlertTitle>
        <AlertDescription>{{ creditInfo }}</AlertDescription>
      </Alert>

      <Alert v-if="error" variant="destructive">
        <AlertTriangle />
        <AlertDescription class="text-fg">{{ error }}</AlertDescription>
      </Alert>
    </div>

    <template #footer>
      <Button variant="ghost" :disabled="isProcessing" @click="close">Cancel</Button>
      <Button
        variant="primary"
        :loading="isProcessing"
        :disabled="!selectedPromptId || (!isAdmin && !hasEnoughCredits(calculatedCredits))"
        @click="confirm"
      >
        <Sparkles v-if="!isProcessing" />
        {{ isProcessing ? 'Detecting...' : 'Detect clips' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { AlertTriangle, Check, Info, Sparkles } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Field } from '@/components/ui/field';
  import { Switch } from '@/components/ui/switch';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import CreditSourcePicker from '@/components/workspace/CreditSourcePicker.vue';
  import { InfoList } from '@/components/ui/info-list';
  import { useCreditSource } from '@/composables/useCreditSource';
  import { useAuthStore } from '@/stores/auth';
  import { getAllPrompts } from '@/services/database';
  import TimeRangePicker from '@/components/TimeRangePicker.vue';

  interface Prompt {
    id: string;
    name: string;
    content: string;
  }

  const props = defineProps<{
    modelValue: boolean;
    videoDuration: number;
    isTranscribed?: boolean;
    // Multi-segment mode props (for project-level detection)
    segmentCount?: number;
    totalDuration?: number;
    /** From VOD preset / creator clip defaults — pre-select subtitle options when opening */
    initialSubtitleDetectionDefaults?: { enabled: boolean; presetId: string } | null;
  }>();

  // Use totalDuration if provided (multi-segment mode), otherwise use videoDuration
  const effectiveDuration = computed(() => props.totalDuration ?? props.videoDuration);

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [
      promptId: string,
      promptContent: string,
      organizationId: number | null,
      startTime: number,
      endTime: number,
      subtitleSettings?: { enabled: boolean; presetId: string } | null,
      enhanced?: boolean
    ];
  }>();

  const showPromptDropdown = ref(false);
  const selectedPromptId = ref<string>('');
  const selectedPromptName = ref<string>('');
  const selectedPromptContent = ref<string>('');
  const isProcessing = ref(false);
  const error = ref<string>('');
  const prompts = ref<Prompt[]>([]);

  // Enhanced detection (transcript + video + audio)
  const enhancedDetection = ref(false);

  // Subtitle selection
  const subtitlesEnabled = ref(false);
  const selectedSubtitlePreset = ref<string>('');

  watch(
    () => props.modelValue,
    (open) => {
      if (open && props.initialSubtitleDetectionDefaults) {
        subtitlesEnabled.value = props.initialSubtitleDetectionDefaults.enabled;
        selectedSubtitlePreset.value = props.initialSubtitleDetectionDefaults.presetId;
      }
    }
  );

  // Subtitle style choices. Sample styles mirror the real presets' render colors (user content).
  const subtitlePresetOptions: {
    id: string;
    name: string;
    description: string;
    sample: string;
    sampleStyle: Record<string, string>;
  }[] = [
    {
      id: 'mr-beast',
      name: 'MrBeast',
      description: 'Bold yellow, YouTube style',
      sample: 'SAMPLE TEXT',
      sampleStyle: {
        color: '#FACC15',
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '18px',
        fontWeight: 'normal',
        letterSpacing: '1.5px',
        textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 8px rgba(239, 68, 68, 0.5)',
      },
    },
    {
      id: 'tiktok-bold',
      name: 'TikTok Bold',
      description: 'White text, thick outline',
      sample: 'SAMPLE TEXT',
      sampleStyle: {
        color: '#FFFFFF',
        fontFamily: "'Montserrat', sans-serif",
        fontSize: '13px',
        fontWeight: '900',
        background: 'rgba(0,0,0,0.8)',
        padding: '3px 6px',
        borderRadius: '4px',
      },
    },
    {
      id: 'subtitle-tutorial',
      name: 'Clean Subtitle',
      description: 'Professional, readable',
      sample: 'Sample Text',
      sampleStyle: {
        color: '#FFFFFF',
        fontFamily: "'Roboto', sans-serif",
        fontSize: '13px',
        fontWeight: 'normal',
        background: 'rgba(0,0,0,0.6)',
        padding: '3px 6px',
        borderRadius: '4px',
      },
    },
    {
      id: 'neon-glow',
      name: 'Neon Glow',
      description: 'Cyan glow, modern',
      sample: 'SAMPLE TEXT',
      sampleStyle: {
        color: '#FFFFFF',
        fontFamily: "'Montserrat', sans-serif",
        fontSize: '14px',
        fontWeight: 'bold',
        textShadow: '0 0 10px #22D3EE, 0 0 20px #22D3EE, 0 0 30px #22D3EE',
      },
    },
    {
      id: 'karaoke',
      name: 'Karaoke',
      description: 'Word-by-word highlight',
      sample: 'WORD BY WORD',
      sampleStyle: {
        color: '#FFFFFF',
        fontFamily: "'Montserrat', sans-serif",
        fontSize: '13px',
        fontWeight: 'bold',
      },
    },
  ];

  // Time range selection (for single video detection)
  const timeRange = ref({ startTime: 0, endTime: 0 });

  const summaryRows = computed(() => {
    if (props.segmentCount && props.segmentCount > 0) {
      return [
        {
          label: 'Segments to process',
          value: `${props.segmentCount} segment${props.segmentCount !== 1 ? 's' : ''}`,
        },
        { label: 'Total duration', value: formatDuration(effectiveDuration.value) },
      ];
    }
    if (props.videoDuration > 0) return [{ label: 'Video duration', value: formatDuration(props.videoDuration) }];
    return [];
  });

  // Calculate selected duration
  const selectedDuration = computed(() => {
    return Math.max(0, timeRange.value.endTime - timeRange.value.startTime);
  });

  const authStore = useAuthStore();

  // Use credit source composable (includes balance + org allocations)
  const {
    loading: loadingCredits,
    selectedSource,
    selectedOrganizationId,
    creditSourceOptions,
    showCreditSourceSelector,
    selectedOption,
    selectedSourceHoursRemaining,
    organizationIdForApi,
    fetchBalance,
    hasEnoughCredits,
    selectPersonal,
    selectOrganization,
    reset: resetCreditSource,
  } = useCreditSource();

  // Check if user is admin (has unlimited credits)
  const isAdmin = computed(() => selectedSourceHoursRemaining.value === Infinity);

  // Calculate credits based on duration and transcription status.
  // Standard rates (matches server): 0.3/min transcribe + 0.7/min detect, or 0.7/min detect-only.
  // Enhanced is always exactly 2× the standard total (e.g. 60 min → 60 credits → 120 enhanced).
  const calculatedCredits = computed(() => {
    const durationToCharge = props.segmentCount ? effectiveDuration.value : selectedDuration.value;
    const minutesToCharge = durationToCharge / 60;

    const standardCredits = props.isTranscribed
      ? Math.ceil(minutesToCharge * 0.7)
      : Math.ceil(minutesToCharge * 0.3) + Math.ceil(minutesToCharge * 0.7);

    return enhancedDetection.value ? standardCredits * 2 : standardCredits;
  });

  // Computed credit information based on selected source
  const creditInfo = computed(() => {
    if (isAdmin.value) {
      return 'Free (Admin Account)';
    }

    if (loadingCredits.value) {
      return 'Loading credit information...';
    }

    const creditsToCharge = calculatedCredits.value;
    const remaining = selectedSourceHoursRemaining.value;
    const sourceName =
      selectedOption.value?.type === 'organization' ? selectedOption.value.organizationName : 'Personal';

    const roundedCredits = Math.ceil(creditsToCharge);
    const roundedRemaining = Math.round(remaining);

    if (remaining === 0) {
      return `No credits remaining in ${sourceName}. This operation requires ${roundedCredits} credits.`;
    }

    if (remaining < creditsToCharge) {
      const adjustRangeHint = !props.segmentCount && props.videoDuration > 0 
        ? ' Adjust the time range above to reduce the cost.' 
        : '';
      return `Insufficient credits in ${sourceName}. You have ${roundedRemaining} credits, but this operation requires ${roundedCredits} credits.${adjustRangeHint}`;
    }

    return `This operation will charge ${roundedCredits} credits from ${sourceName}. You have ${roundedRemaining} credits remaining.`;
  });

  // Close dropdown when clicking outside
  function handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      showPromptDropdown.value = false;
    }
  }

  function onPromptSelected(id: unknown) {
    const prompt = prompts.value.find((p) => p.id === id);
    if (prompt) selectPrompt(prompt);
  }

  function selectPrompt(prompt: Prompt) {
    selectedPromptId.value = prompt.id;
    selectedPromptName.value = prompt.name;
    selectedPromptContent.value = prompt.content;
    showPromptDropdown.value = false;
    error.value = '';
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  function close() {
    if (!isProcessing.value) {
      emit('update:modelValue', false);
    }
  }

  async function confirm() {
    if (!selectedPromptId.value) {
      error.value = 'Please select a detection prompt';
      return;
    }

    // Validate subtitle selection if enabled
    if (subtitlesEnabled.value && !selectedSubtitlePreset.value) {
      error.value = 'Please select a subtitle style';
      return;
    }

    // Check authentication
    if (!authStore.isAuthenticated) {
      close();
      window.dispatchEvent(new CustomEvent('show-auth-modal'));
      return;
    }

    // Check credits for non-admin users
    if (!isAdmin.value) {
      const creditsToCharge = calculatedCredits.value;

      if (!hasEnoughCredits(creditsToCharge)) {
        error.value = `Insufficient credits. This operation requires ${creditsToCharge} credits but you don't have enough.`;
        return;
      }
    }

    isProcessing.value = true;
    error.value = '';

    try {
      // Include organizationId and time range
      // Prepare subtitle settings
      const subtitleSettings = subtitlesEnabled.value && selectedSubtitlePreset.value
        ? { enabled: true, presetId: selectedSubtitlePreset.value }
        : null;

      console.log(
        '[ClipDetectionConfirmDialog] Emitting confirm subtitles:',
        subtitleSettings,
        'time range:',
        timeRange.value.startTime,
        '-',
        timeRange.value.endTime
      );
      emit(
        'confirm',
        selectedPromptId.value,
        selectedPromptContent.value,
        organizationIdForApi.value,
        timeRange.value.startTime,
        timeRange.value.endTime,
        subtitleSettings,
        enhancedDetection.value
      );
      emit('update:modelValue', false);
    } catch (err) {
      console.error('Detection failed:', err);
      error.value = err instanceof Error ? err.message : 'Detection failed';
    } finally {
      isProcessing.value = false;
    }
  }

  // Load user credits on mount
  async function loadUserCredits() {
    await fetchBalance();
  }

  // Load prompts function
  async function loadPrompts() {
    try {
      prompts.value = await getAllPrompts();
      console.log(`[ClipDetectionConfirmDialog] Loaded ${prompts.value.length} prompts`);

      // Select default prompt if none selected
      if (prompts.value.length > 0 && !selectedPromptId.value) {
        const defaultPrompt = prompts.value.find((p) => p.name === 'Default Clip Detector');
        if (defaultPrompt) {
          selectPrompt(defaultPrompt);
        } else {
          selectPrompt(prompts.value[0]);
        }
      }
    } catch (error) {
      console.error('[ClipDetectionConfirmDialog] Failed to load prompts:', error);
      prompts.value = [];
    }
  }

  // Load credits and prompts when dialog opens
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        // Reset prompt selection state so user can choose fresh each time
        selectedPromptId.value = '';
        selectedPromptName.value = '';
        selectedPromptContent.value = '';
        showPromptDropdown.value = false;

        // Reset subtitle selection (default off; initialSubtitleDetectionDefaults watcher may apply preset)
        subtitlesEnabled.value = false;
        selectedSubtitlePreset.value = '';

        // Enhanced is opt-in per run — never persist from last detection
        enhancedDetection.value = false;

        // Reset time range to full video duration
        timeRange.value = { startTime: 0, endTime: props.videoDuration };

        // Reset credit source selection
        resetCreditSource();

        loadUserCredits();
        loadPrompts();
        error.value = '';
        isProcessing.value = false;
      }
    }
  );

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>
