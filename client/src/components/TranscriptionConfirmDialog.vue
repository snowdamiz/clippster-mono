<template>
  <Modal
    :open="modelValue"
    title="Generate transcript"
    description="AI-powered speech-to-text for this video."
    :icon="FileText"
    tone="ai"
    size="md"
    :dismissible="!isProcessing"
    :hide-close="isProcessing"
    @close="close"
  >
    <div class="flex flex-col gap-4">
      <InfoList compact class="rounded-lg border border-line-subtle bg-surface px-3 py-2.5" v-if="summaryRows.length" :rows="summaryRows" />

      <Alert v-if="isTranscribed" variant="success">
        <Check />
        <AlertTitle>Already transcribed</AlertTitle>
        <AlertDescription>This video already has a transcript. No additional credits needed.</AlertDescription>
      </Alert>

      <CreditSourcePicker
        v-if="showCreditSourceSelector && !isTranscribed"
        :options="creditSourceOptions"
        :selected-source="selectedSource"
        :selected-organization-id="selectedOrganizationId"
        @select-personal="selectPersonal"
        @select-organization="selectOrganization"
      />

      <Alert v-if="!isTranscribed" :variant="!isAdmin && !hasEnoughCredits(calculatedCredits) ? 'warning' : 'info'">
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
      <Button variant="primary" :loading="isProcessing" :disabled="isTranscribed" @click="confirm">
        {{ isProcessing ? 'Transcribing...' : isTranscribed ? 'Already done' : 'Transcribe' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { AlertTriangle, Check, FileText, Info } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import CreditSourcePicker from '@/components/workspace/CreditSourcePicker.vue';
  import { InfoList } from '@/components/ui/info-list';
  import { useCreditSource } from '@/composables/useCreditSource';
  import { useAuthStore } from '@/stores/auth';

  interface Props {
    modelValue: boolean;
    videoDuration?: number;
    segmentCount?: number;
    totalDuration?: number;
    isTranscribed?: boolean;
    itemLabel?: string;
  }

  const props = withDefaults(defineProps<Props>(), {
    videoDuration: 0,
    segmentCount: 0,
    totalDuration: 0,
    isTranscribed: false,
    itemLabel: 'segment',
  });

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [organizationId: number | null];
  }>();

  const error = ref('');
  const isProcessing = ref(false);

  const authStore = useAuthStore();

  // Use credit source composable
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

  // Check if user is admin
  const isAdmin = computed(() => selectedSourceHoursRemaining.value === Infinity);

  // Effective duration (use totalDuration for multi-segment, otherwise videoDuration)
  const effectiveDuration = computed(() => {
    if (props.totalDuration > 0) return props.totalDuration;
    return props.videoDuration;
  });

  const itemLabel = computed(() => props.itemLabel || 'segment');
  const itemLabelPlural = computed(() => `${itemLabel.value.charAt(0).toUpperCase()}${itemLabel.value.slice(1)}s`);

  const summaryRows = computed(() => {
    if (props.segmentCount && props.segmentCount > 0) {
      return [
        {
          label: `${itemLabelPlural.value} to transcribe`,
          value: `${props.segmentCount} ${itemLabel.value}${props.segmentCount !== 1 ? 's' : ''}`,
        },
        { label: 'Total duration', value: formatDuration(effectiveDuration.value) },
      ];
    }
    if (props.videoDuration > 0) return [{ label: 'Video duration', value: formatDuration(props.videoDuration) }];
    return [];
  });

  // Calculate credits: 0.3 credits per minute for transcription
  const calculatedCredits = computed(() => {
    const minutesToCharge = effectiveDuration.value / 60;
    return minutesToCharge * 0.3;
  });

  // Credit information text
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
      return `No credits remaining in ${sourceName}. Transcription requires ${roundedCredits} credits (0.3/min).`;
    }

    if (remaining < creditsToCharge) {
      return `Insufficient credits in ${sourceName}. You have ${roundedRemaining} credits, but transcription requires ${roundedCredits} credits (0.3/min).`;
    }

    return `Transcription will charge ${roundedCredits} credits (0.3/min) from ${sourceName}. You have ${roundedRemaining} credits remaining.`;
  });

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
    if (isProcessing.value) return;
    emit('update:modelValue', false);
    error.value = '';
  }

  function confirm() {
    if (isProcessing.value || props.isTranscribed) return;

    error.value = '';

    // Check credits for non-admin users
    if (!isAdmin.value) {
      const creditsToCharge = calculatedCredits.value;

      if (!hasEnoughCredits(creditsToCharge)) {
        error.value = 'Insufficient credits for this operation';
        return;
      }
    }

    emit('confirm', organizationIdForApi.value);
    close();
  }

  // Load credits when dialog opens
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        resetCreditSource();
        fetchBalance();
        error.value = '';
        isProcessing.value = false;
      }
    }
  );
</script>
