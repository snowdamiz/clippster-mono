<script setup lang="ts">
  /**
   * Clipper card for the directory grid: avatar, name + verified mark,
   * experience and availability, short bio, specialties, platforms and track
   * record. The whole card links to the public profile; the optional `action`
   * slot (e.g. Invite) sits above the link.
   */
  import { computed } from 'vue';
  import { Award, BadgeCheck, Megaphone } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import {
    getExperienceLevelLabel,
    getSpecialtyTagLabel,
    type ClipperProfile,
  } from '@/services/clipperProfilesApi';
  import { Avatar } from '@/components/ui/avatar';
  import { PlatformLogo } from '@/components/ui/platform-logo';

  const props = defineProps<{ clipper: ClipperProfile; to: string }>();

  const MAX_TAGS = 3;
  const tags = computed(() => props.clipper.specialty_tags?.slice(0, MAX_TAGS) ?? []);
  const extraTags = computed(() => Math.max((props.clipper.specialty_tags?.length ?? 0) - MAX_TAGS, 0));
  const platforms = computed(() => props.clipper.preferred_platforms?.slice(0, 4) ?? []);
</script>

<template>
  <article
    class="group relative flex min-w-0 flex-col gap-3 rounded-xl border border-line-subtle bg-surface p-3.5 transition-colors hover:border-line-strong"
  >
    <router-link :to="to" class="absolute inset-0 z-0 rounded-xl" :aria-label="`View ${clipper.display_name || 'clipper'}`" />

    <header class="pointer-events-none relative flex items-center gap-3">
      <Avatar :src="clipper.avatar_url" :name="clipper.display_name" size="md" />
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-1">
          <h3 class="truncate text-sm font-semibold text-fg">{{ clipper.display_name || 'Unnamed' }}</h3>
          <BadgeCheck v-if="clipper.is_verified" class="size-3.5 shrink-0 text-brand" aria-label="Verified" />
        </div>
        <div class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
          <span v-if="clipper.experience_level" class="truncate">
            {{ getExperienceLevelLabel(clipper.experience_level) }}
          </span>
          <span
            v-if="clipper.looking_for_work"
            class="inline-flex shrink-0 items-center gap-1 text-success"
          >
            <span v-if="clipper.experience_level" class="text-fg-disabled">·</span>
            <span class="size-1.5 rounded-full bg-success" />
            Available
          </span>
        </div>
      </div>
      <div v-if="$slots.action" class="pointer-events-auto relative z-10 shrink-0">
        <slot name="action" />
      </div>
    </header>

    <p v-if="clipper.bio" class="pointer-events-none relative line-clamp-2 text-xs leading-[1.125rem] text-fg-muted">
      {{ clipper.bio }}
    </p>

    <div v-if="tags.length" class="pointer-events-none relative flex flex-wrap gap-1">
      <Badge v-for="tag in tags" :key="tag">{{ getSpecialtyTagLabel(tag) }}</Badge>
      <Badge v-if="extraTags" variant="outline">+{{ extraTags }}</Badge>
    </div>

    <footer
      class="pointer-events-none relative mt-auto flex items-center justify-between gap-2 border-t border-line-subtle pt-2.5 text-2xs text-fg-subtle"
    >
      <span class="tabular flex min-w-0 items-center gap-3">
        <span class="flex items-center gap-1" :title="`${clipper.total_campaigns_completed} campaigns completed`">
          <Megaphone class="size-3.5" />
          <span class="font-medium text-fg-muted">{{ clipper.total_campaigns_completed }}</span>
          {{ clipper.total_campaigns_completed === 1 ? 'campaign' : 'campaigns' }}
        </span>
        <span class="flex items-center gap-1" :title="`${clipper.total_endorsements} endorsements`">
          <Award class="size-3.5" />
          <span class="font-medium text-fg-muted">{{ clipper.total_endorsements }}</span>
        </span>
      </span>
      <span v-if="platforms.length" class="flex shrink-0 items-center gap-1">
        <PlatformLogo v-for="platform in platforms" :key="platform" :platform="platform" size="xs" />
      </span>
    </footer>
  </article>
</template>
