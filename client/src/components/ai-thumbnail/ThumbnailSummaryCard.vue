<template>
  <ChatPlanCard title="Thumbnail plan">
    <ChatPlanRow v-if="summary.description" label="Concept" :value="summary.description" />
    <ChatPlanRow v-if="summary.hook_text" label="Hook" :tags="[summary.hook_text]" />
    <ChatPlanRow v-if="summary.cta_text" label="CTA" :value="summary.cta_text" />
    <ChatPlanRow v-if="summary.emotion" label="Emotion" :tags="[summary.emotion]" />
    <ChatPlanRow v-if="summary.focal_subject" label="Subject" :value="summary.focal_subject" />
    <ChatPlanRow v-if="summary.layout" label="Layout" :value="summary.layout" />
    <ChatPlanRow v-if="summary.aspect_ratio || summary.canvas_width" label="Canvas" :value="canvasLabel" />
    <ChatPlanRow v-if="palette.length" label="Colors" :colors="palette" />
    <ChatPlanRow v-if="summary.style_notes" label="Style" :value="summary.style_notes" />
  </ChatPlanCard>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import ChatPlanCard from '@/components/create/chat/ChatPlanCard.vue';
  import ChatPlanRow from '@/components/create/chat/ChatPlanRow.vue';

  export interface ThumbnailBriefSummary {
    description?: string;
    hook_text?: string;
    cta_text?: string | null;
    emotion?: string;
    focal_subject?: string;
    layout?: string;
    color_palette?: string[];
    aspect_ratio?: string;
    canvas_width?: number;
    canvas_height?: number;
    style_notes?: string;
    [key: string]: unknown;
  }

  const props = defineProps<{
    summary: ThumbnailBriefSummary;
  }>();

  const palette = computed(() => {
    const raw = props.summary.color_palette;
    if (!Array.isArray(raw)) return [] as string[];
    return raw.filter((c) => typeof c === 'string' && c.length > 0);
  });

  const canvasLabel = computed(() => {
    const ratio = props.summary.aspect_ratio || '16:9';
    const { canvas_width: w, canvas_height: h } = props.summary;
    return w && h ? `${ratio} · ${w}×${h}` : ratio;
  });
</script>
