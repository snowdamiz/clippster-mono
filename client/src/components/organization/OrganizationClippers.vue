<template>
  <div class="organization-clippers">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-semibold text-foreground">Find Clippers</h2>
        <p class="text-sm text-muted-foreground">Browse talented clippers for your campaigns</p>
      </div>
      <div class="flex gap-1 bg-muted/50 rounded-lg p-1">
        <button
          @click="activeView = 'directory'"
          class="px-3 py-1.5 text-sm rounded-md transition-colors"
          :class="activeView === 'directory' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        >
          <Users class="w-4 h-4 inline mr-1.5" />
          Directory
        </button>
        <button
          @click="activeView = 'leaderboard'"
          class="px-3 py-1.5 text-sm rounded-md transition-colors"
          :class="activeView === 'leaderboard' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        >
          <Trophy class="w-4 h-4 inline mr-1.5" />
          Leaderboard
        </button>
      </div>
    </div>

    <!-- Leaderboard View -->
    <div v-if="activeView === 'leaderboard'" class="space-y-6">
      <!-- TODO Banner -->
      <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
        <AlertTriangle class="w-5 h-5 text-amber-500 flex-shrink-0" />
        <div>
          <p class="text-sm font-medium text-amber-600 dark:text-amber-400">Leaderboard In Progress</p>
          <p class="text-xs text-muted-foreground">View tracking not yet implemented. See <code class="bg-muted px-1 rounded">docs/Leaderboard_TODO.md</code> for remaining tasks.</p>
        </div>
      </div>

      <!-- Leaderboard Card -->
      <div class="bg-card border border-border/60 rounded-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-foreground">Top Clippers</h3>
          <div class="flex gap-1 bg-muted/50 rounded-lg p-1">
            <button
              @click="switchLeaderboardPeriod('weekly')"
              class="px-3 py-1 text-sm rounded-md transition-colors"
              :class="leaderboardPeriod === 'weekly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            >
              Weekly
            </button>
            <button
              @click="switchLeaderboardPeriod('monthly')"
              class="px-3 py-1 text-sm rounded-md transition-colors"
              :class="leaderboardPeriod === 'monthly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            >
              Monthly
            </button>
          </div>
        </div>
        
        <div v-if="loadingLeaderboard" class="space-y-3">
          <div v-for="i in 10" :key="i" class="flex items-center gap-4 p-3 bg-muted/20 rounded-lg animate-pulse">
            <div class="w-8 h-8 rounded-full bg-muted/40"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-muted/40 rounded w-32"></div>
              <div class="h-3 bg-muted/30 rounded w-24"></div>
            </div>
          </div>
        </div>

        <div v-else-if="leaderboardEntries.length === 0" class="text-center py-8">
          <Trophy class="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p class="text-sm text-muted-foreground">No leaderboard data yet</p>
        </div>

        <div v-else class="space-y-2">
          <router-link
            v-for="(entry, index) in leaderboardEntries"
            :key="entry.id"
            :to="`/clippers/${entry.clipper_profile?.slug}`"
            class="flex items-center gap-4 p-3 rounded-lg transition-colors bg-muted/20 hover:bg-muted/30"
          >
            <!-- Rank -->
            <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
              :class="{
                'bg-amber-500 text-white': index === 0,
                'bg-gray-400 text-white': index === 1,
                'bg-amber-700 text-white': index === 2,
                'bg-muted text-muted-foreground': index > 2
              }"
            >
              {{ index + 1 }}
            </div>

            <!-- Avatar & Name -->
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img v-if="entry.clipper_profile?.avatar_url" :src="entry.clipper_profile.avatar_url" class="w-full h-full object-cover" />
                <UserCircle v-else class="w-5 h-5 text-primary" />
              </div>
              <div class="min-w-0">
                <div class="font-medium text-foreground truncate flex items-center gap-1.5">
                  {{ entry.clipper_profile?.display_name || 'Anonymous Clipper' }}
                  <CheckCircle v-if="entry.clipper_profile?.is_verified" class="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ entry.clips_delivered }} clips
                </div>
              </div>
            </div>

            <!-- Stats -->
            <div class="text-right flex-shrink-0">
              <div class="font-semibold text-foreground">{{ formatViews(entry.total_views || 0) }}</div>
              <div class="text-xs text-muted-foreground">views</div>
            </div>
          </router-link>
        </div>

        <p class="text-xs text-muted-foreground mt-4 text-center italic">
          Leaderboard based on clips posted and views from clipper social accounts
        </p>
      </div>
    </div>

    <!-- Directory View -->
    <div v-else class="flex gap-6">
      <!-- Filters Sidebar -->
      <div class="w-56 flex-shrink-0 space-y-4">
        <div class="bg-muted/20 border border-border/60 rounded-xl p-4 space-y-4">
          <h3 class="font-semibold text-foreground text-sm">Filters</h3>

          <!-- Looking for Work -->
          <div class="flex items-center justify-between">
            <Label class="text-xs">Available for work</Label>
            <Switch v-model:checked="filters.looking_for_work" @update:checked="loadClippers" />
          </div>

          <!-- Verified Only -->
          <div class="flex items-center justify-between">
            <Label class="text-xs">Verified only</Label>
            <Switch v-model:checked="filters.verified_only" @update:checked="loadClippers" />
          </div>

          <!-- Experience Level -->
          <div class="space-y-1.5">
            <Label class="text-xs">Experience</Label>
            <Select v-model="filters.experience_level" @update:modelValue="loadClippers">
              <SelectTrigger class="h-8 text-xs">
                <SelectValue placeholder="Any level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any level</SelectItem>
                <SelectItem v-for="level in EXPERIENCE_LEVELS" :key="level.value" :value="level.value">
                  {{ level.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Specialty Tags -->
          <div class="space-y-1.5">
            <Label class="text-xs">Specialties</Label>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="tag in SPECIALTY_TAGS.slice(0, 6)"
                :key="tag.value"
                @click="toggleFilter('specialty_tags', tag.value)"
                class="px-1.5 py-0.5 rounded text-[10px] transition-colors"
                :class="filters.specialty_tags.includes(tag.value) 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'"
              >
                {{ tag.label }}
              </button>
            </div>
          </div>

          <!-- Platforms -->
          <div class="space-y-1.5">
            <Label class="text-xs">Platforms</Label>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="platform in PREFERRED_PLATFORMS"
                :key="platform.value"
                @click="toggleFilter('preferred_platforms', platform.value)"
                class="px-1.5 py-0.5 rounded text-[10px] transition-colors"
                :class="filters.preferred_platforms.includes(platform.value) 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'"
              >
                {{ platform.label }}
              </button>
            </div>
          </div>

          <Button variant="outline" size="sm" class="w-full text-xs" @click="clearFilters">
            Clear Filters
          </Button>
        </div>
      </div>

      <!-- Clippers Grid -->
      <div class="flex-1">
        <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <div v-for="i in 6" :key="i" class="bg-card border border-border/60 rounded-xl p-4 animate-pulse">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-full bg-muted/40"></div>
              <div class="space-y-2">
                <div class="h-4 bg-muted/40 rounded w-24"></div>
                <div class="h-3 bg-muted/30 rounded w-16"></div>
              </div>
            </div>
            <div class="h-10 bg-muted/30 rounded"></div>
          </div>
        </div>

        <div v-else-if="clippers.length === 0" class="text-center py-12">
          <Users class="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <h3 class="text-base font-medium text-foreground mb-1">No clippers found</h3>
          <p class="text-sm text-muted-foreground">Try adjusting your filters</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <router-link
            v-for="clipper in clippers"
            :key="clipper.id"
            :to="`/clippers/${clipper.slug}`"
            class="block"
          >
            <div class="bg-card border border-border/60 rounded-xl p-4 hover:border-primary/30 hover:shadow-md transition-all h-full">
              <!-- Header -->
              <div class="flex items-start gap-3 mb-2">
                <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img v-if="clipper.avatar_url" :src="clipper.avatar_url" class="w-full h-full object-cover" />
                  <UserCircle v-else class="w-5 h-5 text-primary" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="font-semibold text-sm text-foreground truncate">{{ clipper.display_name || 'Unnamed' }}</span>
                    <CheckCircle v-if="clipper.is_verified" class="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  </div>
                  <div class="text-[11px] text-muted-foreground">
                    {{ getExperienceLevelLabel(clipper.experience_level || '') }}
                  </div>
                </div>
                <div v-if="clipper.looking_for_work" class="px-1.5 py-0.5 bg-green-500/10 text-green-500 text-[9px] font-medium rounded">
                  Available
                </div>
              </div>

              <!-- Bio -->
              <p v-if="clipper.bio" class="text-xs text-muted-foreground line-clamp-2 mb-2">
                {{ clipper.bio }}
              </p>

              <!-- Tags -->
              <div v-if="clipper.specialty_tags?.length" class="flex flex-wrap gap-1 mb-2">
                <span
                  v-for="tag in clipper.specialty_tags.slice(0, 3)"
                  :key="tag"
                  class="px-1.5 py-0.5 bg-muted/50 text-muted-foreground text-[9px] rounded"
                >
                  {{ getSpecialtyTagLabel(tag) }}
                </span>
              </div>

              <!-- Stats -->
              <div class="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>{{ clipper.total_campaigns_completed }} campaigns</span>
                <span>{{ clipper.total_endorsements }} endorsements</span>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { Users, Trophy, UserCircle, CheckCircle, AlertTriangle } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  listClippers, getLeaderboard,
  type ClipperProfile,
  EXPERIENCE_LEVELS, SPECIALTY_TAGS, PREFERRED_PLATFORMS,
  getExperienceLevelLabel, getSpecialtyTagLabel
} from '@/services/clipperProfilesApi';

// View state
const activeView = ref<'directory' | 'leaderboard'>('directory');

// Directory state
const loading = ref(true);
const clippers = ref<ClipperProfile[]>([]);

// Leaderboard state
const loadingLeaderboard = ref(true);
const leaderboardPeriod = ref<'weekly' | 'monthly'>('weekly');
const leaderboardEntries = ref<LeaderboardEntry[]>([]);

interface LeaderboardEntry {
  id: number;
  rank: number;
  clips_delivered: number;
  total_views: number;
  clipper_profile?: {
    id: number;
    user_id: number;
    display_name: string | null;
    avatar_url: string | null;
    slug: string | null;
    is_verified: boolean;
  };
}

const formatViews = (views: number): string => {
  if (views >= 1000000) {
    return (views / 1000000).toFixed(1) + 'M';
  } else if (views >= 1000) {
    return (views / 1000).toFixed(1) + 'K';
  }
  return views.toString();
};

const switchLeaderboardPeriod = (period: 'weekly' | 'monthly') => {
  if (leaderboardPeriod.value !== period) {
    leaderboardPeriod.value = period;
    loadLeaderboard();
  }
};

const loadLeaderboard = async () => {
  loadingLeaderboard.value = true;
  try {
    const response = await getLeaderboard(leaderboardPeriod.value);
    if (response.success) {
      leaderboardEntries.value = response.entries.map((entry: any, index: number) => ({
        ...entry,
        total_views: entry.total_views || 0,
        rank: index + 1
      }));
    }
  } catch (error) {
    console.error('Failed to load leaderboard:', error);
  } finally {
    loadingLeaderboard.value = false;
  }
};

const filters = reactive({
  looking_for_work: false,
  verified_only: false,
  experience_level: 'any',
  specialty_tags: [] as string[],
  preferred_platforms: [] as string[]
});

const loadClippers = async () => {
  loading.value = true;
  try {
    const response = await listClippers({
      looking_for_work: filters.looking_for_work || undefined,
      verified_only: filters.verified_only || undefined,
      experience_level: filters.experience_level !== 'any' ? filters.experience_level : undefined,
      specialty_tags: filters.specialty_tags.length ? filters.specialty_tags : undefined,
      preferred_platforms: filters.preferred_platforms.length ? filters.preferred_platforms : undefined
    });
    if (response.success) {
      clippers.value = response.profiles;
    }
  } catch (error) {
    console.error('Failed to load clippers:', error);
  } finally {
    loading.value = false;
  }
};

const toggleFilter = (field: 'specialty_tags' | 'preferred_platforms', value: string) => {
  const arr = filters[field];
  const idx = arr.indexOf(value);
  if (idx >= 0) {
    arr.splice(idx, 1);
  } else {
    arr.push(value);
  }
  loadClippers();
};

const clearFilters = () => {
  filters.looking_for_work = false;
  filters.verified_only = false;
  filters.experience_level = 'any';
  filters.specialty_tags = [];
  filters.preferred_platforms = [];
  loadClippers();
};

onMounted(() => {
  loadClippers();
  loadLeaderboard();
});
</script>

<style scoped>
.organization-clippers {
  @apply h-full;
}
</style>
