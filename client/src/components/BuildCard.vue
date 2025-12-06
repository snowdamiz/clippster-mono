<template>
  <div
    class="relative bg-black rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all"
    @click="$emit('play', build)"
  >
    <!-- Thumbnail with correct aspect ratio (letterboxed/pillarboxed) -->
    <div v-if="thumbnailUrl" class="absolute inset-0 z-0 flex items-center justify-center">
      <img
        :src="thumbnailUrl"
        :alt="clipName"
        class="max-w-full max-h-full object-contain"
        :class="isPortrait ? 'h-full w-auto' : 'w-full h-auto'"
      />
      <div class="absolute inset-0 bg-black/10 pointer-events-none"></div>
    </div>
    <div v-else class="absolute inset-0 z-0 bg-muted flex items-center justify-center">
      <Video class="h-12 w-12 text-muted-foreground/30" />
    </div>

    <!-- Top left: Build number badge (only show if multiple builds exist) -->
    <div
      v-if="showBuildNumber !== false && (showBuildNumber || build.build_number > 1)"
      class="absolute top-4 left-4 z-10"
    >
      <span
        class="text-xs px-2 py-1 rounded-md border bg-green-600/90 text-white border-green-500 shadow-sm font-medium"
      >
        Build #{{ build.build_number }}
      </span>
    </div>

    <!-- Top right: Duration -->
    <div v-if="build.duration" class="absolute top-4 right-4 z-10">
      <span class="text-xs px-2 py-1 rounded-md bg-black/60 text-white/90 font-medium backdrop-blur-sm">
        {{ formatDuration(build.duration) }}
      </span>
    </div>

    <!-- Bottom Overlay with Info -->
    <div
      class="absolute bottom-0 left-0 right-0 z-5 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-28 flex flex-col gap-1.5"
    >
      <h3 class="text-base font-bold text-white leading-tight line-clamp-1 group-hover:text-white/90 transition-colors">
        {{ clipName }}
      </h3>

      <div class="flex items-center gap-2 text-xs text-white/70 font-medium">
        <p class="line-clamp-1 max-w-[50%]" v-if="projectName">
          {{ projectName }}
        </p>

        <span v-if="projectName" class="w-0.5 h-0.5 rounded-full bg-white/40"></span>

        <p class="line-clamp-1">
          {{ formattedDate }}
        </p>

        <span v-if="aspectRatio" class="w-0.5 h-0.5 rounded-full bg-white/40"></span>
        <p v-if="aspectRatio" class="text-primary/90">{{ aspectRatio }}</p>
      </div>
    </div>

    <!-- Hover Overlay Buttons -->
    <div
      class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-3"
    >
      <button
        class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
        title="Play"
        @click.stop="$emit('play', build, filePath)"
      >
        <Play class="h-5 w-5" />
      </button>
      <button
        class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
        title="Save to..."
        @click.stop="$emit('save', build, filePath)"
      >
        <Download class="h-5 w-5" />
      </button>
      <button
        class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
        title="Delete build"
        @click.stop="$emit('delete', build)"
      >
        <Trash2 class="h-5 w-5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Play, Trash2, Download, Video } from 'lucide-vue-next';
  import type { ClipBuild } from '@/services/database';
  import { useFormatters } from '@/composables/useFormatters';

  const props = defineProps<{
    build: ClipBuild;
    clipName: string;
    thumbnailUrl: string | null;
    projectName: string | null;
    /** Override file path (for multi-file builds where each file is shown separately) */
    filePath?: string;
    /** Override aspect ratio display */
    displayAspectRatio?: string;
    /** Whether to show the build number badge (hide if clip only has one build) */
    showBuildNumber?: boolean;
  }>();

  defineEmits<{
    (e: 'play', build: ClipBuild, filePath?: string): void;
    (e: 'save', build: ClipBuild, filePath?: string): void;
    (e: 'delete', build: ClipBuild): void;
  }>();

  const { getRelativeTime } = useFormatters();

  const formattedDate = computed(() => {
    if (props.build.completed_at) {
      // Convert from seconds to milliseconds
      return getRelativeTime(props.build.completed_at);
    }
    return getRelativeTime(props.build.created_at);
  });

  const aspectRatio = computed(() => {
    // Use override if provided
    if (props.displayAspectRatio) return props.displayAspectRatio;

    if (!props.build.aspect_ratios) return null;
    try {
      const ratios = JSON.parse(props.build.aspect_ratios);
      return Array.isArray(ratios) && ratios.length > 0 ? ratios[0] : null;
    } catch {
      return null;
    }
  });

  // Check if the aspect ratio is portrait (taller than wide)
  const isPortrait = computed(() => {
    const ratio = aspectRatio.value;
    return ratio === '9:16' || ratio === '4:5' || ratio === '3:4';
  });

  function formatDuration(seconds: number | null): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>
