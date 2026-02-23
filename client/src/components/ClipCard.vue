<template>
  <div
    class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all"
    @click="$emit('play', clip)"
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
      <!-- Dark vignette overlay handled by bottom gradient now, but keep subtle global one -->
      <div class="absolute inset-0 bg-black/10"></div>
    </div>

    <!-- Top left builds badge -->
    <div v-if="completedBuilds.length > 0" class="absolute top-4 left-4 z-10">
      <div
        class="flex items-center gap-1.5 bg-green-600/90 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-sm cursor-pointer hover:bg-green-500 transition-colors"
        @click.stop="showBuildsDropdown = !showBuildsDropdown"
      >
        <Download class="w-3 h-3" />
        <span>{{ completedBuilds.length }} Build{{ completedBuilds.length !== 1 ? 's' : '' }}</span>
        <ChevronDown class="w-3 h-3" :class="{ 'rotate-180': showBuildsDropdown }" />
      </div>

      <!-- Builds Dropdown -->
      <div
        v-if="showBuildsDropdown"
        class="absolute left-0 top-full mt-1 min-w-[240px] max-w-[320px] bg-popover border border-border rounded-md shadow-lg py-1 max-h-[250px] overflow-y-auto z-50"
        @click.stop
      >
        <div
          class="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/50 mb-1"
        >
          Downloads
        </div>
        <button
          v-for="build in completedBuilds"
          :key="build.id"
          class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50 flex items-center gap-3 border-b border-border/20 last:border-b-0"
          @click.stop="$emit('saveBuild', build)"
        >
          <Download class="h-4 w-4 text-green-500 flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium truncate flex items-center gap-1.5">
              <span class="text-muted-foreground/70">#{{ build.build_number }}</span>
              <span>{{ getBuildFileName(build.file_path) }}</span>
            </div>
            <div class="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
              <span v-if="build.completed_at">{{ formatBuildDate(build.completed_at) }}</span>
              <span v-if="build.file_size">{{ formatFileSize(build.file_size) }}</span>
            </div>
          </div>
          <button
            class="p-1 hover:bg-red-500/20 rounded transition-colors text-muted-foreground hover:text-red-400 flex-shrink-0"
            title="Delete this build"
            @click.stop="$emit('deleteBuild', build)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </button>
      </div>
    </div>

    <!-- Top right status badge -->
    <div class="absolute top-4 right-4 z-5">
      <span
        :class="[
          'text-xs px-2 py-1 rounded-md border',
          thumbnailUrl ? getClipStatusBadgeClass(clip.status) : 'text-muted-foreground bg-muted border-border',
        ]"
      >
        {{ getClipStatusText(clip.status) }}
      </span>
    </div>
    <!-- Bottom Overlay with Info -->
    <div
      class="absolute bottom-0 left-0 right-0 z-5 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-28 flex flex-col gap-1.5"
    >
      <h3 class="text-base font-bold text-white leading-tight line-clamp-1 group-hover:text-white/90 transition-colors">
        {{ clip.name || 'Untitled Clip' }}
      </h3>

      <div class="flex items-center gap-2 text-xs text-white/70 font-medium">
        <p class="line-clamp-1 max-w-[50%]" v-if="projectName">
          {{ projectName }}
        </p>

        <span v-if="projectName" class="w-0.5 h-0.5 rounded-full bg-white/40"></span>

        <p class="line-clamp-1">
          {{ formattedDate }}
        </p>
      </div>
    </div>
    <!-- Hover Overlay Buttons -->
    <div
      v-if="thumbnailUrl"
      class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-4"
    >
      <button
        class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        :title="clip.status === 'detected' && !clip.file_path ? 'Clip not generated yet' : 'Play'"
        @click.stop="$emit('play', clip)"
        :disabled="clip.status === 'detected' && !clip.file_path"
      >
        <Play class="h-6 w-6" />
      </button>
      <!-- Delete button only shown for clips without builds -->
      <button
        v-if="completedBuilds.length === 0"
        class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
        title="Delete clip"
        @click.stop="$emit('delete', clip)"
      >
        <Trash2 class="h-6 w-6" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, onMounted, onUnmounted } from 'vue';
  import { Play, Trash2, Download, ChevronDown } from 'lucide-vue-next';
  import { formatDateTime } from '@/utils/dateTimeUtils';
  import type { Clip, ClipBuild } from '@/services/database';
  import { useFormatters } from '@/composables/useFormatters';

  const props = defineProps<{
    clip: Clip;
    thumbnailUrl: string | null;
    projectName: string | null;
    builds?: ClipBuild[];
  }>();

  defineEmits<{
    (e: 'play', clip: Clip): void;
    (e: 'delete', clip: Clip): void;
    (e: 'saveBuild', build: ClipBuild): void;
    (e: 'deleteBuild', build: ClipBuild): void;
  }>();

  const { getRelativeTime } = useFormatters();
  const showBuildsDropdown = ref(false);

  const formattedDate = computed(() => getRelativeTime(props.clip.created_at));

  const completedBuilds = computed(() => {
    if (!props.builds) return [];
    return props.builds.filter((b) => b.status === 'completed');
  });

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (showBuildsDropdown.value) {
      const target = event.target as HTMLElement;
      if (!target.closest('.builds-dropdown-container')) {
        showBuildsDropdown.value = false;
      }
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  function getBuildFileName(filePath: string | null): string {
    if (!filePath) return 'Built clip';
    return filePath.split(/[/\\]/).pop() || 'Built clip';
  }

  function formatBuildDate(timestamp: number | null): string {
    if (!timestamp) return '';
    return formatDateTime(new Date(timestamp * 1000));
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function getClipStatusBadgeClass(status: string | null): string {
    switch (status) {
      case 'generated':
      case 'completed':
        return 'bg-emerald-600 text-white border-emerald-500 shadow-sm font-medium';
      case 'detected':
        return 'bg-amber-400 text-black border-amber-500 shadow-sm font-medium';
      case 'processing':
        return 'bg-blue-600 text-white border-blue-500 shadow-sm font-medium';
      default:
        return 'bg-gray-600 text-gray-100 border-gray-500 shadow-sm';
    }
  }

  function getClipStatusText(status: string | null): string {
    switch (status) {
      case 'generated':
      case 'completed':
        return 'Generated';
      case 'detected':
        return 'Detected';
      case 'processing':
        return 'Processing';
      default:
        return 'Unknown';
    }
  }
</script>
