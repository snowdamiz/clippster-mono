<script setup lang="ts">
  /**
   * One scheduled social post: thumbnail, platform + status, caption, meta and
   * row actions (edit / retry / cancel / open). Used by the personal and
   * organization scheduled-post lists.
   */
  import { AlertCircle, Clock, ExternalLink, FileVideo, Folder, Pencil, RefreshCw, User, X } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import type { ScheduledPost } from '@/services/schedulingApi';
  import { formatScheduledAt, scheduledPostStatusVariant } from './scheduledPosts';

  withDefaults(
    defineProps<{
      post: ScheduledPost;
      /** Show who submitted it and the creator / campaign it belongs to (organization view). */
      showOrgMeta?: boolean;
      /** Offer the edit action for editable posts. */
      allowEdit?: boolean;
    }>(),
    { showOrgMeta: false, allowEdit: false }
  );

  const emit = defineEmits<{
    edit: [post: ScheduledPost];
    retry: [post: ScheduledPost];
    cancel: [post: ScheduledPost];
  }>();
</script>

<template>
  <!-- A row inside a framed list (the parent draws the frame) -->
  <article
    class="flex items-start gap-3 border-b border-line-subtle px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-hover"
  >
    <div class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-sunken">
      <img v-if="post.thumbnail_url" :src="post.thumbnail_url" alt="" class="size-full object-cover" />
      <FileVideo v-else class="size-4 text-fg-subtle" />
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <PlatformLogo :platform="post.platform" size="xs" />
        <Badge :variant="scheduledPostStatusVariant(post.status)" class="capitalize">{{ post.status }}</Badge>
        <span v-if="post.social_account" class="truncate text-xs text-fg-muted">@{{ post.social_account.username }}</span>
        <span v-if="showOrgMeta && post.submitted_by" class="truncate text-xs text-fg-subtle">
          by {{ post.submitted_by.name || post.submitted_by.email }}
        </span>
      </div>

      <p class="mt-1 line-clamp-2 text-sm" :class="post.caption ? 'text-fg' : 'text-fg-subtle'">
        {{ post.caption || 'No caption' }}
      </p>

      <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
        <span v-if="post.scheduled_at" class="tabular inline-flex items-center gap-1">
          <Clock class="size-3.5 text-fg-subtle" />
          {{ formatScheduledAt(post.scheduled_at) }}
        </span>
        <template v-if="showOrgMeta">
          <span v-if="post.creator_profile" class="inline-flex items-center gap-1">
            <User class="size-3.5 text-fg-subtle" />
            {{ post.creator_profile.name }}
          </span>
          <span v-if="post.campaign" class="inline-flex items-center gap-1">
            <Folder class="size-3.5 text-fg-subtle" />
            {{ post.campaign.name }}
          </span>
        </template>
        <span v-if="post.attempts > 0" class="inline-flex items-center gap-1 text-warning">
          <AlertCircle class="size-3.5" />
          {{ post.attempts }} attempt(s)
        </span>
      </div>

      <p v-if="post.error_message" class="mt-1.5 line-clamp-1 text-xs text-danger">{{ post.error_message }}</p>
    </div>

    <div class="flex shrink-0 items-center gap-0.5">
      <Button
        v-if="allowEdit && post.can_edit"
        variant="ghost"
        size="icon-sm"
        title="Edit"
        aria-label="Edit"
        @click="emit('edit', post)"
      >
        <Pencil />
      </Button>
      <Button
        v-if="post.status === 'failed'"
        variant="ghost"
        size="icon-sm"
        title="Retry"
        aria-label="Retry"
        @click="emit('retry', post)"
      >
        <RefreshCw />
      </Button>
      <Button
        v-if="post.can_cancel"
        variant="ghost"
        size="icon-sm"
        class="hover:text-danger"
        title="Cancel post"
        aria-label="Cancel post"
        @click="emit('cancel', post)"
      >
        <X />
      </Button>
      <a
        v-if="post.post_url"
        :href="post.post_url"
        target="_blank"
        :class="buttonVariants({ variant: 'ghost', size: 'icon-sm' })"
        title="View post"
        aria-label="View post"
      >
        <ExternalLink />
      </a>
    </div>
  </article>
</template>
