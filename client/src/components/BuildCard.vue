<template>
  <MediaTile
    :title="clipName"
    :thumbnail="null"
    :selectable="selectable"
    :selected="selected"
    :actions-visible="menuOpen"
    @open="$emit('play', build)"
    @toggle-select="$emit('toggleSelect', build)"
  >
    <!-- Rendered here (not via `thumbnail`) so portrait builds keep their aspect ratio -->
    <template #placeholder>
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="clipName"
        class="absolute inset-0 size-full"
        :class="isPortrait ? 'bg-black object-contain' : 'object-cover'"
        draggable="false"
      />
      <Video v-else class="size-6" :stroke-width="1.5" />
    </template>

    <template #meta>
      <span v-if="projectName" class="min-w-0 truncate">{{ projectName }}</span>
      <span v-if="projectName" aria-hidden="true" class="text-fg-disabled">·</span>
      <span class="shrink-0 whitespace-nowrap">{{ formattedDate }}</span>
      <template v-if="aspectRatio">
        <span aria-hidden="true" class="text-fg-disabled">·</span>
        <span class="tabular shrink-0">{{ aspectRatio }}</span>
      </template>
      <template v-if="showBuildNumber">
        <span aria-hidden="true" class="text-fg-disabled">·</span>
        <span class="tabular shrink-0">#{{ build.build_number }}</span>
      </template>
    </template>
    <template #overlay>
      <span
        v-if="build.duration"
        class="tabular absolute bottom-2 right-2 z-10 rounded bg-black/70 px-1.5 text-2xs font-medium leading-[18px] text-white"
      >
        {{ formatDuration(build.duration) }}
      </span>
    </template>

    <template #actions>
      <Button variant="secondary" size="icon-xs" title="Play" aria-label="Play" @click="$emit('play', build, filePath)">
        <Play />
      </Button>
      <Button
        variant="secondary"
        size="icon-xs"
        title="Publish"
        aria-label="Publish"
        @click="$emit('publish', build, filePath)"
      >
        <Share2 />
      </Button>
      <DropdownMenu v-model:open="menuOpen">
        <DropdownMenuTrigger as-child>
          <Button variant="secondary" size="icon-xs" title="More actions" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuItem @click="$emit('save', build, filePath)">
            <Download />
            Save to…
          </DropdownMenuItem>
          <DropdownMenuItem @click="$emit('openProject', build)">
            <ExternalLink />
            Open in project
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            class="text-danger focus:bg-danger-soft [&>svg]:!text-danger"
            @click="$emit('delete', build)"
          >
            <Trash2 />
            Delete build
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>

    <template v-if="hasBadges" #badges>
      <Badge
        v-if="build.branding_type === 'campaign' && build.campaign_name"
        class="max-w-[140px] border-transparent bg-black/70 text-white"
        :title="`Campaign: ${build.campaign_name}`"
      >
        <Megaphone />
        <span class="truncate">{{ build.campaign_name }}</span>
      </Badge>
      <Badge
        v-else-if="build.branding_type === 'org' && build.organization_name"
        class="max-w-[140px] border-transparent bg-black/70 text-white"
        :title="build.organization_name"
      >
        <span class="size-1.5 shrink-0 rounded-full" :style="{ backgroundColor: getOrgColor(build.organization_id) }" />
        <span class="truncate">{{ build.organization_name }}</span>
      </Badge>
      <Badge
        v-if="build.is_published"
        class="border-transparent bg-black/70 text-success"
        :title="build.published_at ? `Published ${getRelativeTime(build.published_at)}` : 'Published'"
      >
        <Check />
        Published
      </Badge>
    </template>
  </MediaTile>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import {
    Play,
    Trash2,
    Download,
    Video,
    ExternalLink,
    Share2,
    Check,
    Megaphone,
    MoreHorizontal,
  } from 'lucide-vue-next';
  import { type ClipBuild } from '@/services/database/types';
  import { useFormatters } from '@/composables/useFormatters';
  import { MediaTile } from '@/components/ui/media-tile';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';

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
    /** Show the selection checkbox (top-left of the thumbnail). */
    selectable?: boolean;
    selected?: boolean;
  }>();

  defineEmits<{
    (e: 'play', build: ClipBuild, filePath?: string): void;
    (e: 'save', build: ClipBuild, filePath?: string): void;
    (e: 'delete', build: ClipBuild): void;
    (e: 'openProject', build: ClipBuild): void;
    (e: 'publish', build: ClipBuild, filePath?: string): void;
    (e: 'toggleSelect', build: ClipBuild): void;
  }>();

  const { getRelativeTime } = useFormatters();

  const menuOpen = ref(false);

  const hasBadges = computed(
    () =>
      (props.build.branding_type === 'campaign' && !!props.build.campaign_name) ||
      (props.build.branding_type === 'org' && !!props.build.organization_name) ||
      !!props.build.is_published
  );

  // Consistent identity color per organization (shown as a small dot on the org badge)
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
