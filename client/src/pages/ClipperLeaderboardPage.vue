<template>
  <div class="h-full w-full">
    <PageLayout
      title="Clipper leaderboard"
      description="Top performing clippers"
      :show-header="true"
      :icon="Trophy"
      :breadcrumbs="[{ label: 'Clipper directory', path: '/clippers' }, { label: 'Leaderboard' }]"
    >
      <template #toolbar>
        <SegmentedControl v-model="leaderboardType" :options="typeOptions" size="sm" />
        <SegmentedControl v-model="period" :options="periodOptions" size="sm" />
      </template>

      <div class="flex flex-1 flex-col px-5 py-4">
        <div class="mx-auto flex w-full max-w-4xl flex-1 flex-col">
          <!-- Loading (first load only; switching type/period keeps the current ranking) -->
          <div
            v-if="loading && !entries.length"
            class="skeleton-group overflow-hidden rounded-xl border border-line-subtle bg-surface"
            aria-busy="true"
          >
            <div class="h-8 border-b border-line-subtle" />
            <div
              v-for="i in 8"
              :key="i"
              class="flex h-11 items-center gap-3 border-b border-line-subtle px-4 last:border-b-0"
            >
              <div class="skeleton size-5 rounded-md" />
              <div class="skeleton ml-3 size-7 rounded-full" />
              <div class="skeleton h-3.5 w-40" />
              <div class="skeleton ml-auto h-3.5 w-14" />
            </div>
          </div>

          <!-- Empty -->
          <EmptyState
            v-else-if="!loading && entries.length === 0"
            :icon="Trophy"
            title="No leaderboard data"
            description="Check back later for rankings."
          />

          <!-- Ranking -->
          <div
            v-else-if="entries.length"
            class="@container animate-fade-in overflow-hidden rounded-xl border border-line-subtle bg-surface"
          >
            <div class="grid h-8 items-center gap-3 border-b border-line-subtle px-4" :class="gridClass">
              <span class="eyebrow">#</span>
              <span class="eyebrow">Clipper</span>
              <template v-if="leaderboardType === 'posts'">
                <span class="eyebrow hidden text-right @xl:block">Posts</span>
                <span class="eyebrow text-right">Views</span>
              </template>
              <template v-else>
                <span class="eyebrow hidden text-right @xl:block">Clips</span>
                <span class="eyebrow hidden text-right @xl:block">Campaigns</span>
                <span class="eyebrow text-right">Points</span>
              </template>
            </div>

            <router-link
              v-for="entry in entries"
              :key="entry.rank"
              :to="`/clippers/${entry.profile?.slug}`"
              class="grid min-h-11 items-center gap-3 border-b border-line-subtle px-4 py-1.5 transition-colors last:border-b-0 hover:bg-surface-hover"
              :class="[gridClass, entry.rank <= 3 && 'bg-[color-mix(in_srgb,var(--brand)_4%,transparent)]']"
            >
              <!-- Rank -->
              <span
                class="tabular grid size-5 place-items-center rounded-md text-xs font-semibold"
                :class="entry.rank <= 3 ? 'bg-brand-soft text-brand' : 'text-fg-subtle'"
              >
                {{ entry.rank }}
              </span>

              <!-- Clipper -->
              <div class="flex min-w-0 items-center gap-3">
                <Avatar :src="entry.profile?.avatar_url" :name="entry.profile?.display_name" size="sm" />
                <div class="min-w-0">
                  <div class="flex min-w-0 items-center gap-1.5">
                    <span class="truncate text-sm font-medium text-fg">{{ entry.profile?.display_name || 'Unknown' }}</span>
                    <BadgeCheck v-if="entry.profile?.is_verified" class="size-3.5 shrink-0 text-brand" aria-label="Verified" />
                    <Badge
                      v-for="badge in entry.profile?.badges || []"
                      :key="badge.id"
                      class="hidden @2xl:inline-flex"
                    >
                      {{ getBadgeLabel(badge.badge_type) }}
                    </Badge>
                  </div>
                  <p class="tabular truncate text-xs text-fg-subtle @xl:hidden">
                    <template v-if="leaderboardType === 'posts'">
                      {{ entry.posts_count }} {{ entry.posts_count === 1 ? 'post' : 'posts' }}
                    </template>
                    <template v-else>
                      {{ entry.clips_delivered }} clips · {{ entry.campaigns_active }} campaigns
                    </template>
                  </p>
                  <p
                    v-if="leaderboardType === 'campaigns'"
                    class="tabular hidden truncate text-xs text-fg-subtle @xl:block"
                  >
                    {{ entry.endorsements_received }} endorsements
                  </p>
                </div>
              </div>

              <!-- Stats -->
              <template v-if="leaderboardType === 'posts'">
                <span class="tabular hidden text-right text-sm text-fg-muted @xl:block">{{ entry.posts_count }}</span>
                <span class="tabular text-right text-sm font-semibold text-fg" :title="entry.total_views.toLocaleString()">
                  {{ formatCompact(entry.total_views) }}
                </span>
              </template>
              <template v-else>
                <span class="tabular hidden text-right text-sm text-fg-muted @xl:block">{{ entry.clips_delivered }}</span>
                <span class="tabular hidden text-right text-sm text-fg-muted @xl:block">{{ entry.campaigns_active }}</span>
                <span class="tabular text-right text-sm font-semibold text-fg">{{ entry.score.toLocaleString() }}</span>
              </template>
            </router-link>
          </div>
        </div>
      </div>
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import { BadgeCheck, Trophy } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Badge } from '@/components/ui/badge';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { Avatar } from '@/components/ui/avatar';
  import { formatCompact } from '@/components/campaigns/campaignDisplay';
  import { getLeaderboard, type LeaderboardEntry, getBadgeLabel } from '@/services/clipperProfilesApi';

  const loading = ref(true);
  const period = ref<'weekly' | 'monthly'>('weekly');
  const leaderboardType = ref<'posts' | 'campaigns'>('posts');
  const entries = ref<LeaderboardEntry[]>([]);

  const typeOptions: SegmentedOption<'posts' | 'campaigns'>[] = [
    { value: 'posts', label: 'Posts' },
    { value: 'campaigns', label: 'Campaigns' },
  ];
  const periodOptions: SegmentedOption<'weekly' | 'monthly'>[] = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  /** Rank · clipper · stats; secondary stat columns appear when the table is wide enough. */
  const gridClass = computed(() =>
    leaderboardType.value === 'posts'
      ? 'grid-cols-[2.5rem_minmax(0,1fr)_6.5rem] @xl:grid-cols-[2.5rem_minmax(0,1fr)_6rem_6.5rem]'
      : 'grid-cols-[2.5rem_minmax(0,1fr)_6.5rem] @xl:grid-cols-[2.5rem_minmax(0,1fr)_6rem_6rem_6.5rem]'
  );

  const loadLeaderboard = async () => {
    loading.value = true;
    try {
      const response = await getLeaderboard(period.value, leaderboardType.value);
      if (response.success) {
        entries.value = response.entries ?? [];
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      loading.value = false;
    }
  };

  watch(period, () => {
    loadLeaderboard();
  });

  watch(leaderboardType, () => {
    loadLeaderboard();
  });

  onMounted(() => {
    loadLeaderboard();
  });
</script>
