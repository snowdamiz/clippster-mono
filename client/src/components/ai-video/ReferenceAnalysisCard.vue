<template>
  <section class="animate-enter overflow-hidden rounded-xl border border-line-subtle bg-surface" aria-label="Reference video analysis">
    <header class="flex items-center gap-1.5 border-b border-line-subtle px-3 py-2 text-xs font-semibold text-fg">
      <Palette class="size-3.5 text-fg-muted" />
      <span>Reference edit recipe</span>
      <Badge v-if="analysis" class="ml-auto">v{{ analysis.schemaVersion }}</Badge>
    </header>

    <div v-if="isAnalyzing" class="flex flex-col gap-2 px-3 py-2.5" role="status">
      <div class="flex items-center justify-between gap-2 text-xs text-fg-muted">
        <span class="min-w-0 truncate">{{ progress?.message || 'Analyzing the full timeline…' }}</span>
        <span class="tabular shrink-0">{{ progress?.progress || 0 }}%</span>
      </div>
      <div class="h-1 overflow-hidden rounded-full bg-surface-active">
        <div class="h-full rounded-full bg-brand transition-[width]" :style="{ width: `${progress?.progress || 0}%` }" />
      </div>
      <Button variant="ghost" size="xs" class="self-end" @click="$emit('cancel')">Cancel</Button>
    </div>

    <div v-else-if="analysis" class="flex flex-col gap-2.5 px-3 py-2.5">
      <p class="text-xs text-fg">{{ analysis.summary }}</p>
      <dl class="flex flex-col gap-1.5">
        <ChatPlanRow label="Pacing" :value="analysis.pacing.description" />
        <ChatPlanRow
          label="Captions"
          :value="analysis.captions.detected ? analysis.captions.treatment : 'None detected'"
        />
        <ChatPlanRow
          label="Motion"
          :value="`${analysis.motion.intensity} · ${analysis.motion.cameraBehaviors.join(', ')}`"
        />
        <ChatPlanRow label="Transitions" :value="analysis.transitions.families.join(', ') || 'Cuts only'" />
        <ChatPlanRow label="Layout" :value="analysis.layout.patterns.join(', ')" />
        <ChatPlanRow
          v-if="analysis.colorGrade.palette.length"
          label="Colors"
          :colors="analysis.colorGrade.palette"
          aria-label="Detected color palette"
        />
      </dl>
      <p v-if="analysis.unsupported.length" class="text-2xs text-fg-subtle">
        {{ analysis.unsupported.length }} unsupported technique{{ analysis.unsupported.length === 1 ? '' : 's' }} will
        use declared fallbacks.
      </p>
      <div class="flex justify-end gap-1">
        <Button variant="ghost" size="xs" @click="$emit('replace')">Replace</Button>
        <Button variant="ghost" size="xs" class="hover:text-danger" @click="$emit('remove')"><X /> Remove</Button>
      </div>
    </div>

    <div v-else-if="error" class="flex items-start gap-2 px-3 py-2.5 text-xs text-fg" role="alert">
      <AlertCircle class="mt-px size-3.5 shrink-0 text-danger" />
      <span class="min-w-0 flex-1 break-words">{{ error }}</span>
      <Button variant="secondary" size="xs" @click="$emit('retry')">Retry</Button>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { Palette, X, AlertCircle } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import ChatPlanRow from '@/components/create/chat/ChatPlanRow.vue';
  import type { ReferenceAnalysisProgress, ReferenceEditRecipe } from '@/types/ai-video';

  defineProps<{
    analysis: ReferenceEditRecipe | null;
    isAnalyzing: boolean;
    progress?: ReferenceAnalysisProgress | null;
    error?: string | null;
  }>();

  defineEmits<{ remove: []; cancel: []; replace: []; retry: [] }>();
</script>
