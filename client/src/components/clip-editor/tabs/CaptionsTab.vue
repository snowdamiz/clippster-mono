<template>
  <div class="space-y-4">
    <!-- Sub-tabs -->
    <div class="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
      <button
        @click="activeSubTab = 'subtitles'"
        :class="[
          'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
          activeSubTab === 'subtitles'
            ? 'bg-violet-500/20 text-violet-300'
            : 'text-white/50 hover:text-white/70',
        ]"
      >
        <Captions :size="12" />
        Subtitles
      </button>
      <button
        @click="activeSubTab = 'transcript'"
        :class="[
          'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
          activeSubTab === 'transcript'
            ? 'bg-violet-500/20 text-violet-300'
            : 'text-white/50 hover:text-white/70',
        ]"
      >
        <FileText :size="12" />
        Transcript
      </button>
    </div>

    <!-- Subtitles Sub-tab -->
    <SubtitlesTab
      v-if="activeSubTab === 'subtitles'"
      :settings="settings"
      :preview-aspect-ratio="previewAspectRatio"
      :selected-aspect-ratios="selectedAspectRatios"
      :framing-configs="framingConfigs"
      @settings-changed="$emit('settingsChanged', $event)"
      @update:preview-aspect-ratio="$emit('update:previewAspectRatio', $event)"
    />

    <!-- Transcript Sub-tab -->
    <TranscriptTab
      v-if="activeSubTab === 'transcript'"
      :project-id="projectId"
      :current-time="currentTime"
      :clip-start-time="clipStartTime"
      :clip-end-time="clipEndTime"
      :duration="duration"
      :source-time-ranges="sourceTimeRanges"
      @seek-video="$emit('seekVideo', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Captions, FileText } from 'lucide-vue-next';
import type { ClipSubtitleSettings, ManualFramingConfigs } from '@/types';
import SubtitlesTab from './SubtitlesTab.vue';
import TranscriptTab from './TranscriptTab.vue';

defineProps<{
  settings: ClipSubtitleSettings;
  projectId: string | null;
  currentTime: number;
  clipStartTime: number;
  clipEndTime: number;
  duration: number;
  previewAspectRatio: string;
  selectedAspectRatios: string[];
  framingConfigs: ManualFramingConfigs;
  sourceTimeRanges: Array<{ start: number; end: number; sourcePath: string }>;
}>();

// Match the exact signatures from the original tab components
const emit = defineEmits<{
  (e: 'settingsChanged', settings: ClipSubtitleSettings): void;
  (e: 'update:previewAspectRatio', ratio: string): void;
  (e: 'seekVideo', time: number): void;
}>();

const activeSubTab = ref<'subtitles' | 'transcript'>('subtitles');
</script>
