<template>
  <Modal
    :open="modelValue"
    title="Real-time clip detection"
    description="AI watches the live stream and clips the best moments as they happen."
    :icon="Sparkles"
    tone="ai"
    size="md"
    @close="close"
  >
    <div class="flex flex-col gap-4">
      <Field label="Detection prompt">
        <Select :model-value="selectedPromptId || DEFAULT_PROMPT" @update:model-value="onPromptChange">
          <SelectTrigger>
            <SelectValue placeholder="Default (Viral Moments)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="DEFAULT_PROMPT">Default (Viral Moments)</SelectItem>
            <SelectItem v-for="prompt in prompts" :key="prompt.id" :value="prompt.id">
              {{ prompt.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <!-- Creator clip defaults (local user profiles only; eligibility set by caller) -->
      <Field v-if="creatorLayoutEligible" label="Creator layout">
        <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
          <Checkbox v-model="useCreatorLayout" />
          Use creator layout
        </label>
        <p class="text-xs text-fg-subtle">
          Apply framing, overlays, and subtitle defaults from
          <strong v-if="creatorLayoutCreatorName" class="font-medium text-fg-muted">{{ creatorLayoutCreatorName }}</strong
          ><span v-else>this creator's</span>
          profile to clips detected in this session.
        </p>
      </Field>

      <!-- Cost -->
      <Alert variant="warning">
        <AlertCircle />
        <div>
          <AlertTitle class="text-sm">Cost: 1 credit per minute</AlertTitle>
          <AlertDescription class="text-xs text-fg-muted">
            Real-time detection runs continuously and costs
            <strong class="font-medium text-fg">1 credit per minute</strong>.
            <template v-if="showSixtyMinuteCap">
              While enabled on My Creators, the automatic run is capped at 60 minutes as described below.
            </template>
            <template v-else>Detection will only stop when you manually click "Stop" or the stream ends.</template>
            <span v-if="estimatedCost > 0" class="mt-1 block text-fg-subtle">
              Estimated cost for 1 hour: <strong class="font-medium text-fg-muted">{{ estimatedCost }} credits</strong>
            </span>
          </AlertDescription>
        </div>
      </Alert>

      <!-- How it works (+ the 60-minute cap for My Creators persistent auto-detect) -->
      <section class="flex flex-col gap-2 border-t border-line-subtle pt-4 text-xs text-fg-muted">
        <p class="eyebrow">How it works</p>
        <ul class="flex list-disc flex-col gap-0.5 pl-4 marker:text-fg-disabled">
          <li>AI analyzes the stream in real time every 30 seconds</li>
          <li>Clips appear in Projects within 1-2 minutes of detection</li>
          <li>You can review, edit, and build clips at any time</li>
          <li v-if="showSixtyMinuteCap">Use Live Clip Auto again to detect another 60 minutes of the same stream</li>
          <li v-else>Detection runs until you stop it or the stream ends</li>
        </ul>
        <p v-if="showSixtyMinuteCap" class="flex gap-2">
          <Info class="mt-px size-3.5 shrink-0 text-fg-subtle" />
          <span>
            <strong class="font-medium text-fg">60-minute auto-detect limit.</strong>
            Auto-detect runs for up to <strong class="font-medium text-fg">60 minutes</strong> or until the stream
            ends, whichever comes first. If this was enabled from My Creators, that Auto setting stays selected for
            future streams. To detect another 60 minutes of the same live stream, go to
            <strong class="font-medium text-fg">Live Clip</strong> and click
            <strong class="font-medium text-fg">Auto</strong> on that stream.
          </span>
        </p>
      </section>
    </div>

    <template #footer>
      <Button variant="ghost" @click="close">Cancel</Button>
      <Button variant="primary" @click="confirm">
        <Sparkles />
        {{ showSixtyMinuteCap ? 'Enable auto detect' : 'Start detection' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { Sparkles, AlertCircle, Info } from 'lucide-vue-next';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Field } from '@/components/ui/field';
  import { Modal } from '@/components/ui/modal';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

  /** reka Select reserves '' for "no value", so the default prompt uses a sentinel. */
  const DEFAULT_PROMPT = '__default__';

  interface Prompt {
    id: string;
    name: string;
    content: string;
  }

  interface Props {
    modelValue: boolean;
    prompts?: Prompt[];
    /** Whether the looked-up creator profile has saved clip_build_defaults. */
    creatorLayoutEligible?: boolean;
    /** Display name of the creator whose layout would be applied. */
    creatorLayoutCreatorName?: string | null;
    /** Show My Creators 60-minute auto-detect cap messaging. */
    showSixtyMinuteCap?: boolean;
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void;
    (
      e: 'confirm',
      data: { promptId: string; promptContent: string; useCreatorLayout: boolean }
    ): void;
  }

  const props = withDefaults(defineProps<Props>(), {
    prompts: () => [],
    creatorLayoutEligible: false,
    creatorLayoutCreatorName: null,
    showSixtyMinuteCap: false,
  });

  const emit = defineEmits<Emits>();

  const selectedPromptId = ref('');
  const selectedPromptName = ref('');
  const showPromptDropdown = ref(false);
  const useCreatorLayout = ref(false);
  const estimatedCost = computed(() => 60); // 1 hour = 60 credits

  watch(
    () => props.modelValue,
    (newValue) => {
      if (newValue) {
        selectedPromptId.value = '';
        selectedPromptName.value = '';
        showPromptDropdown.value = false;
        useCreatorLayout.value = false;
      }
    }
  );

  function selectPrompt(prompt: Prompt | null) {
    if (prompt) {
      selectedPromptId.value = prompt.id;
      selectedPromptName.value = prompt.name;
    } else {
      selectedPromptId.value = '';
      selectedPromptName.value = '';
    }
    showPromptDropdown.value = false;
  }

  function close() {
    emit('update:modelValue', false);
  }

  function confirm() {
    const selectedPrompt = props.prompts.find((p) => p.id === selectedPromptId.value);
    emit('confirm', {
      promptId: selectedPromptId.value,
      promptContent: selectedPrompt?.content || '',
      useCreatorLayout: props.creatorLayoutEligible && useCreatorLayout.value,
    });
    close();
  }

  function onPromptChange(value: unknown) {
    const prompt = props.prompts.find((p) => p.id === value) ?? null;
    selectPrompt(prompt);
  }
</script>
