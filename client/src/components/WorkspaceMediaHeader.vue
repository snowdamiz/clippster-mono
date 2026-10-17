<template>
  <!-- Panel toolbar: clip count + contextual actions -->
  <div class="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line-subtle px-3">
    <p class="tabular shrink-0 text-xs text-fg-muted">{{ clips.length }} clip{{ clips.length !== 1 ? 's' : '' }}</p>

    <div class="flex min-w-0 items-center justify-end gap-1.5">
      <!-- Detection progress (hidden while finalizing — the list shows a centered progress then) -->
      <InlineProgress
        v-if="props.isGenerating && clips.length > 0 && props.generationStage !== 'finalizing'"
        :label="(props.generationStage || 'Processing').replace(/_/g, ' ')"
        :progress="props.generationProgress"
        cancel-title="Cancel detection"
        @cancel="handleCancelDetection"
      />
      <!-- Re-run detection (only when AI is allowed) -->
      <Button
        v-else-if="clips.length > 0 && isAIAllowed && !props.clipDetectionDisabled"
        variant="ghost"
        size="xs"
        title="Run clip detection again"
        @click="handleDetectClips"
      >
        <Sparkles />
        Detect
      </Button>

      <!-- Transcription progress -->
      <InlineProgress
        v-if="props.isTranscribing"
        :label="(props.transcribeStage || 'Transcribing').replace(/_/g, ' ')"
        :progress="props.transcribeProgress"
        cancel-title="Cancel transcription"
        @cancel="handleCancelTranscription"
      />
      <Button
        v-else-if="transcriptData && !props.isGenerating"
        variant="ghost"
        size="xs"
        title="View transcript"
        @click="handleViewTranscript"
      >
        <FileText />
        View transcript
      </Button>
      <Button
        v-else-if="!props.isGenerating && isAIAllowed && !transcriptData"
        variant="ghost"
        size="xs"
        title="Generate transcript"
        @click="handleTranscribe"
      >
        <FileText />
        Transcribe
      </Button>
      <!-- Manual add (when AI is not allowed) -->
      <Button
        v-else-if="clips.length > 0 && !isAIAllowed"
        variant="ghost"
        size="xs"
        title="Manually add a new clip"
        @click="handleAddClip"
      >
        <Plus />
        Add clip
      </Button>
    </div>
  </div>
</template>
<script lang="ts">
  import { defineComponent } from 'vue';
  import { Sparkles, Plus, FileText } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import InlineProgress from '@/components/workspace/InlineProgress.vue';
  export default defineComponent({
    components: { Sparkles, Plus, FileText, Button, InlineProgress },
    props: { model: { type: Object, required: true } },
    setup(props): Record<string, any> {
      return props.model;
    },
  });
</script>
