<template>
  <div class="flex items-center gap-4 px-4 py-3 bg-zinc-900 border-t border-zinc-800">
    <button
      @click="togglePlayPause"
      class="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
    >
      <component :is="isPlaying ? Pause : Play" class="w-5 h-5" />
    </button>

    <div class="flex-1 flex items-center gap-3">
      <span class="text-sm text-zinc-400 font-mono">{{ formatTime(currentTime) }}</span>
      
      <div class="flex-1 relative h-2 bg-zinc-800 rounded-full cursor-pointer" @click="handleSeek">
        <div 
          class="absolute h-full bg-blue-500 rounded-full transition-all"
          :style="{ width: `${progressPercentage}%` }"
        />
        <div 
          class="absolute w-3 h-3 bg-white rounded-full -translate-y-1/4 -translate-x-1/2 shadow-lg"
          :style="{ left: `${progressPercentage}%` }"
        />
      </div>
      
      <span class="text-sm text-zinc-400 font-mono">{{ formatTime(duration) }}</span>
    </div>

    <div class="flex items-center gap-2">
      <button
        @click="$emit('export')"
        :disabled="!hasComposition"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-sm font-medium transition-colors"
      >
        Export Video
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Play, Pause } from 'lucide-vue-next';

const props = defineProps<{
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  hasComposition: boolean;
}>();

const emit = defineEmits<{
  (e: 'play'): void;
  (e: 'pause'): void;
  (e: 'seek', time: number): void;
  (e: 'export'): void;
}>();

const progressPercentage = computed(() => {
  if (props.duration === 0) return 0;
  return (props.currentTime / props.duration) * 100;
});

function togglePlayPause() {
  if (props.isPlaying) {
    emit('pause');
  } else {
    emit('play');
  }
}

function handleSeek(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const percentage = x / rect.width;
  const time = percentage * props.duration;
  emit('seek', time);
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
</script>
