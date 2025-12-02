<template>
  <div
    class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all"
    @click="$emit('play', build)"
  >
    <!-- Thumbnail background with vignette -->
    <div
      v-if="thumbnailUrl"
      class="absolute inset-0 z-0"
      :style="{
        backgroundImage: `url(${thumbnailUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }"
    >
      <div class="absolute inset-0 bg-black/10"></div>
    </div>
    <div v-else class="absolute inset-0 z-0 bg-muted flex items-center justify-center">
      <Video class="h-12 w-12 text-muted-foreground/30" />
    </div>

    <!-- Top left: Build number badge -->
    <div class="absolute top-4 left-4 z-10">
      <span
        class="text-xs px-2 py-1 rounded-md border bg-green-600/90 text-white border-green-500 shadow-sm font-medium"
      >
        Build #{{ build.build_number }}
      </span>
    </div>

    <!-- Top right: File size -->
    <div v-if="build.file_size" class="absolute top-4 right-4 z-10">
      <span class="text-xs px-2 py-1 rounded-md bg-black/60 text-white/90 font-medium backdrop-blur-sm">
        {{ formatFileSize(build.file_size) }}
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
      class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-4"
    >
      <button
        class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
        title="Play"
        @click.stop="$emit('play', build)"
      >
        <Play class="h-6 w-6" />
      </button>
      <button
        class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
        title="Save to..."
        @click.stop="$emit('save', build)"
      >
        <Download class="h-6 w-6" />
      </button>
      <button
        class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
        title="Delete build"
        @click.stop="$emit('delete', build)"
      >
        <Trash2 class="h-6 w-6" />
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
  }>();

  defineEmits<{
    (e: 'play', build: ClipBuild): void;
    (e: 'save', build: ClipBuild): void;
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
    if (!props.build.aspect_ratios) return null;
    try {
      const ratios = JSON.parse(props.build.aspect_ratios);
      return Array.isArray(ratios) && ratios.length > 0 ? ratios[0] : null;
    } catch {
      return null;
    }
  });

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
</script>
