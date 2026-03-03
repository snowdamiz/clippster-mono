<template>
  <div class="clipper-leaderboard-page">
    <PageLayout
      title="Clipper Leaderboard"
      description="Top performing clippers"
      :show-header="true"
      :icon="Trophy"
    >
      <div class="max-w-3xl pt-4">
        <!-- Leaderboard Type Tabs -->
        <Tabs v-model="leaderboardType" class="mb-4">
          <TabsList>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          </TabsList>
        </Tabs>

        <!-- Period Tabs -->
        <Tabs v-model="period" class="mb-6">
          <TabsList>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>

        <!-- Leaderboard -->
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 10" :key="i" class="bg-card border border-border/60 rounded-xl p-4 animate-pulse">
            <div class="flex items-center gap-4">
              <div class="w-8 h-8 rounded-full bg-muted/40"></div>
              <div class="w-10 h-10 rounded-full bg-muted/40"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-muted/40 rounded w-32"></div>
                <div class="h-3 bg-muted/30 rounded w-24"></div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="entries.length === 0" class="text-center py-16">
          <Trophy class="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 class="text-lg font-medium text-foreground mb-1">No leaderboard data</h3>
          <p class="text-sm text-muted-foreground">Check back later for rankings</p>
        </div>

        <div v-else class="space-y-2">
          <router-link
            v-for="entry in entries"
            :key="entry.rank"
            :to="`/clippers/${entry.profile?.slug}`"
            class="block"
          >
            <div 
              class="flex items-center gap-4 p-4 rounded-xl border transition-all hover:border-primary/30"
              :class="getRankClass(entry.rank)"
            >
              <!-- Rank -->
              <div 
                class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                :class="getRankBadgeClass(entry.rank)"
              >
                {{ entry.rank }}
              </div>

              <!-- Avatar -->
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                <img v-if="entry.profile?.avatar_url" :src="entry.profile.avatar_url" class="w-full h-full object-cover" />
                <UserCircle v-else class="w-5 h-5 text-primary" />
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="font-semibold text-foreground">{{ entry.profile?.display_name || 'Unknown' }}</span>
                  <CheckCircle v-if="entry.profile?.is_verified" class="w-4 h-4 text-blue-500" />
                  <div v-for="badge in entry.profile?.badges || []" :key="badge.id" class="ml-1">
                    <span :class="getBadgeColor(badge.badge_type)" class="text-xs">
                      {{ getBadgeLabel(badge.badge_type) }}
                    </span>
                  </div>
                </div>
                <div class="text-xs text-muted-foreground">
                  <template v-if="leaderboardType === 'posts'">
                    {{ entry.posts_count }} {{ entry.posts_count === 1 ? 'post' : 'posts' }} · {{ entry.total_views.toLocaleString() }} total views
                  </template>
                  <template v-else>
                    {{ entry.clips_delivered }} clips · {{ entry.campaigns_active }} campaigns · {{ entry.endorsements_received }} endorsements
                  </template>
                </div>
              </div>

              <!-- Score -->
              <div class="text-right">
                <div class="text-lg font-bold text-foreground">
                  <template v-if="leaderboardType === 'posts'">
                    {{ entry.total_views.toLocaleString() }}
                  </template>
                  <template v-else>
                    {{ entry.score }}
                  </template>
                </div>
                <div class="text-xs text-muted-foreground">
                  <template v-if="leaderboardType === 'posts'">views</template>
                  <template v-else>points</template>
                </div>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { Trophy, UserCircle, CheckCircle } from 'lucide-vue-next';
import PageLayout from '@/components/PageLayout.vue';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getLeaderboard,
  type LeaderboardEntry,
  getBadgeLabel, getBadgeColor
} from '@/services/clipperProfilesApi';

const loading = ref(true);
const period = ref<'weekly' | 'monthly'>('weekly');
const leaderboardType = ref<'posts' | 'campaigns'>('posts');
const entries = ref<LeaderboardEntry[]>([]);

const loadLeaderboard = async () => {
  loading.value = true;
  try {
    const response = await getLeaderboard(period.value, leaderboardType.value);
    if (response.success) {
      entries.value = response.entries;
    }
  } catch (error) {
    console.error('Failed to load leaderboard:', error);
  } finally {
    loading.value = false;
  }
};

const getRankClass = (rank: number) => {
  if (rank === 1) return 'bg-amber-500/10 border-amber-500/30';
  if (rank === 2) return 'bg-slate-400/10 border-slate-400/30';
  if (rank === 3) return 'bg-orange-600/10 border-orange-600/30';
  return 'bg-card border-border/60';
};

const getRankBadgeClass = (rank: number) => {
  if (rank === 1) return 'bg-amber-500 text-white';
  if (rank === 2) return 'bg-slate-400 text-white';
  if (rank === 3) return 'bg-orange-600 text-white';
  return 'bg-muted text-muted-foreground';
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

<style scoped>
.clipper-leaderboard-page {
  @apply h-full;
}
</style>
