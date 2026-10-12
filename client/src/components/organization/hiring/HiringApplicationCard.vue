<script setup lang="ts">
  /**
   * Applicant card on the organization Hiring page: clipper identity (links to
   * the public profile), application message, track record and tags, plus
   * Message / Hire / Reject actions for pending applications.
   */
  import { computed } from 'vue';
  import { useRoute } from 'vue-router';
  import { BadgeCheck, Check, MessageCircle, X } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { Avatar } from '@/components/ui/avatar';
  import { humanize, statusVariant } from '@/components/campaigns/campaignDisplay';
  import { getExperienceLevelLabel, getSpecialtyTagLabel } from '@/services/clipperProfilesApi';
  import type { HiringApplication } from '@/services/hiringApi';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';

  const props = defineProps<{
    app: HiringApplication;
    accepting: boolean;
    rejecting: boolean;
  }>();

  const emit = defineEmits<{ accept: []; reject: [] }>();

  const route = useRoute();

  const profile = computed(() => props.app.clipper_profile);
  const name = computed(
    () => profile.value?.display_name || props.app.user?.name || props.app.user?.email || 'Unknown'
  );
  const tags = computed(() => profile.value?.specialty_tags ?? []);
</script>

<template>
  <article
    class="relative flex min-w-0 flex-col gap-3 rounded-xl border border-line-subtle bg-surface p-3.5 transition-colors hover:border-line"
  >
    <router-link
      v-if="profile?.slug"
      :to="{ path: `/clippers/${profile.slug}`, query: { from: route.fullPath } }"
      class="absolute inset-0 z-0 rounded-xl"
      :aria-label="`View ${name}`"
    />

    <header class="pointer-events-none relative flex items-start gap-3">
      <Avatar :src="profile?.avatar_url" :name="name" />
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-1">
          <h3 class="truncate text-sm font-semibold text-fg">{{ name }}</h3>
          <BadgeCheck v-if="profile?.is_verified" class="size-3.5 shrink-0 text-brand" aria-label="Verified" />
        </div>
        <p class="mt-0.5 truncate text-xs text-fg-muted">
          <template v-if="profile?.experience_level">{{ getExperienceLevelLabel(profile.experience_level) }} · </template>
          Applied {{ fmtDate(app.inserted_at) }}
        </p>
      </div>
      <Badge :variant="statusVariant(app.status === 'accepted' ? 'approved' : app.status)" class="shrink-0">
        {{ humanize(app.status) }}
      </Badge>
    </header>

    <p v-if="app.message" class="pointer-events-none relative line-clamp-2 text-xs leading-[1.125rem] text-fg-muted">
      {{ app.message }}
    </p>

    <div v-if="tags.length" class="pointer-events-none relative flex flex-wrap gap-1">
      <Badge v-for="tag in tags.slice(0, 3)" :key="tag">{{ getSpecialtyTagLabel(tag) }}</Badge>
      <Badge v-if="tags.length > 3" variant="outline">+{{ tags.length - 3 }}</Badge>
    </div>

    <footer
      v-if="profile || app.status === 'pending'"
      class="relative mt-auto flex items-center justify-between gap-2 border-t border-line-subtle pt-2.5"
    >
      <span v-if="profile" class="pointer-events-none tabular truncate text-2xs text-fg-subtle">
        <span class="font-medium text-fg-muted">{{ profile.total_clips_delivered || 0 }}</span> clips ·
        <span class="font-medium text-fg-muted">{{ profile.total_endorsements || 0 }}</span> reviews ·
        <span class="font-medium text-fg-muted">{{ profile.total_campaigns_completed || 0 }}</span> campaigns
      </span>
      <span v-else />
      <div class="relative z-10 flex shrink-0 items-center gap-1">
        <router-link
          v-if="profile?.user_id"
          :to="`/messages?to=${profile.user_id}`"
          :class="buttonVariants({ variant: 'ghost', size: 'icon-xs' })"
          title="Message"
          aria-label="Message"
        >
          <MessageCircle />
        </router-link>
        <template v-if="app.status === 'pending'">
          <Button variant="ghost" size="xs" :loading="rejecting" @click="emit('reject')">
            <X v-if="!rejecting" />
            Reject
          </Button>
          <Button variant="secondary" size="xs" :loading="accepting" @click="emit('accept')">
            <Check v-if="!accepting" />
            Hire
          </Button>
        </template>
      </div>
    </footer>
  </article>
</template>
