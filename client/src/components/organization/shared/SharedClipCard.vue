<script setup lang="ts">
  /**
   * Card for a clip shared within an organization: thumbnail with duration and
   * expiry, name/description, a meta row and optional actions. Used by the
   * organization Shared page.
   *
   * Slots: `menu` (top-right of the body), `meta` (inline meta items), `actions` (bottom row).
   */
  import { Clock, Play, Share2 } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { getExpirationText, type SharedClip } from '@/services/sharedClipsApi';
  import { expirationBadgeVariant, formatClock } from './helpers';

  withDefaults(
    defineProps<{
      clip: SharedClip;
      /** Mark as unseen (brand outline + "New" badge). */
      isNew?: boolean;
      /** Show a play affordance on hover over the thumbnail. */
      playable?: boolean;
    }>(),
    { isNew: false, playable: false }
  );

  const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <article
    class="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface transition-colors"
    :class="isNew ? 'border-brand-line' : 'border-line-subtle hover:border-line'"
  >
    <button
      type="button"
      class="group relative aspect-video w-full overflow-hidden bg-surface-sunken focus-visible:outline-none"
      :aria-label="`Open ${clip.name}`"
      @click="emit('open')"
    >
      <img v-if="clip.thumbnail_url" :src="clip.thumbnail_url" :alt="clip.name" class="size-full object-cover" />
      <span v-else class="grid size-full place-items-center">
        <Share2 class="size-6 text-fg-subtle" />
      </span>

      <span
        v-if="playable"
        class="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <span class="grid size-10 place-items-center rounded-full bg-black/60 text-white">
          <Play class="ml-0.5 size-4 fill-current" />
        </span>
      </span>

      <Badge :variant="expirationBadgeVariant(clip.days_until_expiration)" class="absolute left-2 top-2 backdrop-blur-sm">
        <Clock />
        {{ getExpirationText(clip.days_until_expiration) }}
      </Badge>
      <Badge v-if="isNew" variant="brand" class="absolute right-2 top-2">New</Badge>
      <span
        v-if="clip.duration"
        class="tabular absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-2xs font-medium text-white"
      >
        {{ formatClock(clip.duration) }}
      </span>
    </button>

    <div class="flex flex-1 flex-col gap-2 p-3">
      <div class="flex items-start gap-2">
        <div class="min-w-0 flex-1">
          <h4 class="truncate text-sm font-medium text-fg">{{ clip.name }}</h4>
          <p v-if="clip.description" class="mt-0.5 line-clamp-2 text-xs text-fg-muted">{{ clip.description }}</p>
        </div>
        <slot name="menu" />
      </div>

      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle [&_svg]:size-3">
        <slot name="meta" />
        <Badge v-if="clip.branding_required" variant="outline">Branding required</Badge>
      </div>

      <div v-if="$slots.actions" class="mt-auto flex gap-2 pt-1">
        <slot name="actions" />
      </div>
    </div>
  </article>
</template>
