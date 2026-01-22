<template>
  <div class="flex flex-col h-full bg-black">
    <div class="flex flex-1 min-h-0">
      <AIVideoSidebar
        class="w-80 flex-shrink-0"
        :media="mediaLibrary"
        :prompt="prompt"
        :aspect-ratio="aspectRatio"
        :duration="duration"
        :style="style"
        :has-media="hasMedia"
        :is-generating="isGenerating"
        @import-local="handleImportLocal"
        @open-asset-picker="showAssetPicker = true"
        @open-clip-picker="showClipPicker = true"
        @remove-media="removeMediaItem"
        @update:prompt="prompt = $event"
        @update:aspect-ratio="aspectRatio = $event"
        @update:duration="duration = $event"
        @update:style="style = $event"
        @generate="handleGenerate"
      />

      <div class="flex-1 flex flex-col min-w-0 min-h-0" style="border: 3px solid yellow;">
        <div class="flex-1 bg-zinc-950 min-h-0 min-w-0 relative overflow-hidden" style="border: 3px solid green;">
          <RemotionPlayerMount
            v-if="composition"
            class="absolute inset-0"
            :composition="composition"
            :current-time="currentTime"
            :is-playing="isPlaying"
            @time-update="currentTime = $event"
            @duration-change="handleDurationChange"
            @playing-change="isPlaying = $event"
          />
          
          <div v-else class="absolute inset-0 flex items-center justify-center text-center text-zinc-500">
            <div>
              <Wand2 class="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p class="text-lg font-medium">No composition yet</p>
              <p class="text-sm mt-2">Add media and generate a video to get started</p>
              <button
                @click="loadTestComposition"
                class="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Load Test Composition
              </button>
            </div>
          </div>
        </div>

        <AIVideoControls
          class="flex-shrink-0"
          :current-time="currentTime"
          :duration="compositionDuration"
          :is-playing="isPlaying"
          :has-composition="hasComposition"
          @play="isPlaying = true"
          @pause="isPlaying = false"
          @seek="handleSeek"
          @export="showExportDialog = true"
        />
      </div>
    </div>

    <AIVideoTimeline
      v-if="composition"
      class="flex-shrink-0"
      :composition="composition"
      :current-time="currentTime"
      :duration="compositionDuration"
    />

    <ExportDialog
      :is-open="showExportDialog"
      :is-exporting="isExporting"
      :progress-percentage="progressPercentage"
      :status-text="statusText"
      @close="showExportDialog = false"
      @export="handleExport"
      @cancel="cancelExport"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Wand2 } from 'lucide-vue-next';
import { open } from '@tauri-apps/plugin-dialog';
import RemotionPlayerMount from '@/components/ai-video/RemotionPlayerMount.vue';
import AIVideoSidebar from '@/components/ai-video/AIVideoSidebar.vue';
import AIVideoControls from '@/components/ai-video/AIVideoControls.vue';
import AIVideoTimeline from '@/components/ai-video/AIVideoTimeline.vue';
import ExportDialog from '@/components/ai-video/ExportDialog.vue';
import { useAIVideoGeneration } from '@/composables/useAIVideoGeneration';
import { useRemotionExport } from '@/composables/useRemotionExport';
import type { AIVideoMediaItem, AIGenerationRequest } from '@/types/ai-video';

const {
  composition,
  isGenerating,
  generationError,
  mediaLibrary,
  hasMedia,
  hasComposition,
  generateComposition,
  addMediaItem,
  removeMediaItem,
  clearMediaLibrary,
} = useAIVideoGeneration();

const {
  exportProgress,
  isExporting,
  progressPercentage,
  statusText,
  startExport,
  cancelExport,
} = useRemotionExport();

const prompt = ref('');
const aspectRatio = ref<'16:9' | '9:16' | '1:1' | '4:5'>('16:9');
const duration = ref(30);
const style = ref('');

const currentTime = ref(0);
const isPlaying = ref(false);
const compositionDuration = ref(0);

const showAssetPicker = ref(false);
const showClipPicker = ref(false);
const showExportDialog = ref(false);

// Test composition for development
function loadTestComposition() {
  composition.value = {
    id: 'test-1',
    name: 'Test Composition',
    duration: 5,
    fps: 30,
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    tracks: [
      {
        id: 'text-1',
        type: 'text',
        name: 'Title Text',
        startTime: 0,
        endTime: 5,
        layer: 1,
        properties: {
          x: 960,
          y: 540,
          text: {
            content: 'Test Video Composition',
            fontFamily: 'Inter',
            fontSize: 72,
            fontWeight: 700,
            color: '#ffffff',
            textAlign: 'center',
            animation: {
              type: 'fade',
              duration: 1
            }
          }
        }
      }
    ]
  };
}

async function handleImportLocal() {
  try {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: 'Media',
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'jpg', 'jpeg', 'png', 'gif']
        }
      ]
    });

    if (selected) {
      const files = Array.isArray(selected) ? selected : [selected];
      
      for (const filePath of files) {
        const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';
        const extension = fileName.split('.').pop()?.toLowerCase() || '';
        
        let type: 'video' | 'audio' | 'image' = 'video';
        if (['mp3', 'wav', 'ogg', 'flac'].includes(extension)) {
          type = 'audio';
        } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
          type = 'image';
        }

        const mediaItem: AIVideoMediaItem = {
          id: crypto.randomUUID(),
          name: fileName,
          type,
          source: {
            type: 'local',
            path: filePath,
          },
          addedAt: new Date(),
        };

        addMediaItem(mediaItem);
      }
    }
  } catch (error) {
    console.error('Failed to import files:', error);
  }
}

async function handleGenerate() {
  if (!hasMedia.value || !prompt.value.trim()) return;

  const request: AIGenerationRequest = {
    prompt: prompt.value,
    media: mediaLibrary.value,
    style: style.value || undefined,
    duration: duration.value,
    aspectRatio: aspectRatio.value,
  };

  try {
    await generateComposition(request);
  } catch (error) {
    console.error('Generation failed:', error);
  }
}

function handleSeek(time: number) {
  currentTime.value = time;
  isPlaying.value = false;
}

function handleDurationChange(dur: number) {
  compositionDuration.value = dur;
}

async function handleExport(settings: { outputPath: string; quality: string; codec: string }) {
  if (!composition.value) return;

  try {
    await startExport(composition.value, {
      outputPath: settings.outputPath,
      codec: settings.codec as 'h264' | 'h265',
      quality: settings.quality as 'draft' | 'standard' | 'high',
    });
  } catch (error) {
    console.error('Export failed:', error);
  }
}
</script>
