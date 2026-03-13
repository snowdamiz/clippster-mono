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

    <!-- Top left: Campaign/Org badges -->
    <div class="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
      <!-- Campaign badge (orange) - only show if branding_type is 'campaign' -->
      <span
        v-if="build.branding_type === 'campaign' && build.campaign_name"
        class="text-xs px-2 py-1 rounded-md border bg-orange-500/90 text-white border-orange-400 shadow-sm font-medium"
        :title="`Campaign: ${build.campaign_name}`"
        @click.stop="console.log('[BuildCard] Campaign badge clicked:', { branding_type: build.branding_type, campaign_name: build.campaign_name, organization_name: build.organization_name, build_id: build.id })"
      >
        {{ build.campaign_name }}
      </span>
      <!-- Org badge (unique color per org) - only show if branding_type is 'org' -->
      <span
        v-else-if="build.branding_type === 'org' && build.organization_name"
        class="text-xs px-2 py-1 rounded-md border text-white shadow-sm font-medium"
        :style="{
          backgroundColor: getOrgColor(build.organization_id),
          borderColor: getOrgColor(build.organization_id, 0.8)
        }"
        :title="build.organization_name"
        @click.stop="console.log('[BuildCard] Org badge clicked:', { branding_type: build.branding_type, campaign_name: build.campaign_name, organization_name: build.organization_name, build_id: build.id })"
      >
        {{ build.organization_name }}
      </span>
    </div>

    <!-- Top right: Duration & Published Badge -->
    <div class="absolute top-4 right-4 z-10 flex flex-col gap-1.5 items-end">
      <span v-if="build.duration" class="text-xs px-2 py-1 rounded-md bg-black/60 text-white/90 font-medium backdrop-blur-sm">
        {{ formatDuration(build.duration) }}
      </span>
      <!-- Published Badge (exact StreamVods style) -->
      <span 
        v-if="build.is_published" 
        class="text-xs px-2 py-1 rounded-md bg-green-500/30 text-green-300 border border-green-500/40 font-medium flex items-center gap-1"
        :title="build.published_at ? `Published ${getRelativeTime(build.published_at)}` : 'Published'"
      >
        <Check class="h-2.5 w-2.5" />
        Published
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
        title="Open in project workspace"
        @click.stop="$emit('openProject', build)"
      >
        <ExternalLink class="h-5 w-5" />
      </button>
      <button
        class="p-2 bg-gradient-to-br from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-full transition-all transform hover:scale-110 shadow-lg"
        title="Publish"
        @click.stop="$emit('publish', build, filePath)"
      >
        <Share2 class="h-5 w-5" />
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
  import { Play, Trash2, Download, Video, ExternalLink, Share2, Check } from 'lucide-vue-next';
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
    (e: 'openProject', build: ClipBuild): void;
    (e: 'publish', build: ClipBuild, filePath?: string): void;
  }>();

  const { getRelativeTime } = useFormatters();

  // Generate consistent color for organization based on ID
  function getOrgColor(orgId: number | null, opacity: number = 0.9): string {
    if (!orgId) return `rgba(59, 130, 246, ${opacity})`; // Default blue
    
    const colors = [
      '#8B5CF6', // Purple
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Amber
      '#EF4444', // Red
      '#06B6D4', // Cyan
      '#84CC16', // Lime
      '#EC4899', // Pink
      '#6366F1', // Indigo
      '#14B8A6', // Teal
      '#A855F7', // Violet
      '#F97316', // Orange (different from campaign orange)
    ];
    
    const colorIndex = orgId % colors.length;
    const hex = colors[colorIndex];
    
    // Convert hex to rgba with opacity
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

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
