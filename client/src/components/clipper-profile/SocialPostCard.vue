<script setup lang="ts">
  /**
   * Card for a post published to a connected social account: thumbnail with
   * platform + status, caption, engagement stats and a link to the live post.
   * Used by the clipper profile "Posts" tab and UserPostsList (per-account posts).
   * `detailed` adds comments / saves and the last-synced time; the
   * `actions` slot sits next to the stats (e.g. a sync button).
   */
  import { computed } from 'vue';
  import { Bookmark, ExternalLink, Eye, FileVideo, Heart, MessageCircle } from 'lucide-vue-next';
  import type { UserPost } from '@/services/userInstagramApi';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
  import { Badge } from '@/components/ui/badge';
  import { PlatformLogo } from '@/components/ui/platform-logo';

  const props = defineProps<{
    post: UserPost;
    detailed?: boolean;
  }>();

  const PLATFORM_NAMES: Record<string, string> = {
    instagram: 'Instagram',
    x: 'X',
    twitter: 'X',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    tiktok_business: 'TikTok',
    facebook: 'Facebook',
  };

  const platformName = computed(() => PLATFORM_NAMES[props.post.platform?.toLowerCase()] || props.post.platform || 'platform');

  function compact(n: number | null | undefined): string {
    const v = n || 0;
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
    return String(v);
  }

  const stats = computed(() => {
    const base = [
      { icon: Eye, value: props.post.view_count, label: 'Views' },
      { icon: Heart, value: props.post.like_count, label: 'Likes' },
    ];
    if (props.detailed) {
      base.push(
        { icon: MessageCircle, value: props.post.comment_count, label: 'Comments' },
        { icon: Bookmark, value: props.post.save_count, label: 'Saves' }
      );
    }
    return base;
  });
</script>

<template>
  <article class="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line-subtle bg-surface">
    <div class="relative aspect-video bg-surface-sunken">
      <img v-if="post.thumbnail_url" :src="post.thumbnail_url" alt="" class="size-full object-cover" />
      <div v-else class="grid size-full place-items-center">
        <FileVideo class="size-6 text-fg-disabled" />
      </div>
      <PlatformLogo :platform="post.platform" size="sm" class="absolute left-2 top-2" />
      <Badge
        :variant="post.status === 'published' ? 'success' : post.status === 'failed' ? 'danger' : 'neutral'"
        class="absolute right-2 top-2 capitalize"
      >
        {{ post.status }}
      </Badge>
    </div>

    <div class="flex flex-1 flex-col gap-2 px-3 pt-2.5 pb-2">
      <p v-if="post.caption" class="line-clamp-2 text-xs text-fg-muted">{{ post.caption }}</p>

      <!-- One row of figures, then a hairline and the date / link -->
      <div class="mt-auto flex min-h-6 items-center gap-3 text-xs text-fg-subtle">
        <span v-for="stat in stats" :key="stat.label" class="tabular inline-flex items-center gap-1" :title="stat.label">
          <component :is="stat.icon" class="size-3.5" />
          {{ compact(stat.value) }}
        </span>
        <span class="ml-auto flex items-center gap-1">
          <slot name="actions" />
        </span>
      </div>

      <div class="flex items-center gap-2 border-t border-line-subtle pt-2 text-2xs text-fg-subtle">
        <span class="tabular min-w-0 truncate">
          {{ fmtDate(post.published_at || post.inserted_at) }}
          <template v-if="detailed && post.synced_at"> · Synced {{ fmtDate(post.synced_at) }}</template>
        </span>
        <a
          v-if="post.post_url"
          :href="post.post_url"
          target="_blank"
          class="ml-auto inline-flex shrink-0 items-center gap-1 text-fg-muted transition-colors hover:text-brand"
        >
          View on {{ platformName }}
          <ExternalLink class="size-3" />
        </a>
      </div>
    </div>
  </article>
</template>
